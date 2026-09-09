# 设计：CI 自动化构建流水线

## Context

动机见 `proposal.md - Why`。此处只记录影响方案选型的现状事实与硬约束。

**本地构建链现状**（侦察自 `package.json` 与 `scripts/`）：

| 端 | 命令 | 实际执行 | 跨平台性 |
|----|------|----------|----------|
| Android | `build:android` | `cd android && gradlew.bat :and_web_library:assembleRelease && node scripts/post-build.js android` | **Windows 专有**（批处理 wrapper） |
| 鸿蒙 | `build:harmony` | `node scripts/build-harmony.js`（DevEco 自带 node + hvigorw.js） | **Windows 专有**（硬编码 `node.exe`、默认 `D:\software\DevEco Studio`） |
| 前端 | `build:web` | `cd vue-web-sdk && npm run build && npm pack && node scripts/post-build.js web` | 跨平台 ✓ |
| iOS | `build:ios` | `node scripts/build-ios.js`（codegen + 源码校验 + zip） | 跨平台 ✓（**不需要 macOS/Xcode**） |

`scripts/post-build.js` 全程 `path.join` + `fs`，无 shell 依赖，四端收集逻辑均跨平台 ✓。

**五个已定位的坑**：

1. **`android/gradlew` 文件模式为 `100644`**（`git ls-files -s` 实证）——Windows 开发未记录可执行位，Linux runner 上执行必然 `Permission denied`。
2. **`build:android` 硬编码 `gradlew.bat`**——Linux 上该批处理文件不可执行。此项同时**违反 `build` 主规范既有约束**（"构建脚本 MUST 使用跨平台 Node.js 语法"），既有 Scenario "构建脚本跨平台" 只覆盖了 Windows 单方向，故本次 delta 保留该 Scenario 并新增 Linux CI 方向的 Scenario（使约束双向化）。
3. **Android SDK 组件版本**——AGP `9.0.1`、Gradle wrapper `9.2.1`、`compileSdk { }` 新 DSL、app `targetSdk = 36`；runner 预装 SDK platform 可能滞后。JDK 侧 `gradle/gradle-daemon-jvm.properties` 声明 `toolchainVersion=21` 并带 foojay 自动下载 URL（Gradle 9 daemon JVM criteria）。
4. **鸿蒙工具链云端不可得**——`build-harmony.js` 依赖 DevEco Studio 完整安装（`tools/node/node.exe` + `tools/hvigor/bin/hvigorw.js` + `sdk`），公共 runner 无预装，且脚本硬编码 `.exe` 后缀。
5. **iOS 产物打包在 Linux 上静默损坏**——`build-ios.js` 的 `createZip` 回退链首选 `tar -a -cf <out>.zip`，该行为依赖 bsdtar（Windows 10+ / macOS 内置）按后缀写出 zip；Linux runner 上是 **GNU tar，不支持写出 zip 格式**，`-a` 对 `.zip` 后缀无匹配压缩程序，可能"成功"退出并产出未压缩的 tar 归档（文件名却是 `.zip`）。由于第一级"成功"即 return，后续 `zip` 候选永不执行 → **CI 绿灯但产物损坏**，集成方解压失败。次要缺陷：第三级 `zip -r <outZip> <folderToZip>` 传入绝对路径，会把整条路径层级写入归档，破坏"目录名作为顶层目录"的约定（Windows 上因走 tar 分支从未暴露）；第二级 PowerShell 候选的参数传递方式亦有误（`-Command` 后接命令名、其余参数被 `powershell.exe` 自身吞掉）。

**依赖链事实**：根 `package.json` 依赖 `@mp-sdk/proto-codegen: file:specs/proto-codegen`；该子项目的 `dist/*.js` **已入库**（`git ls-files` 实证），其 `node_modules/.bin/tsc` 亦被跟踪；`vue-web-sdk` 同样依赖 `file:../specs/proto-codegen` 且有独立 `package-lock.json`。两个 lock 与各自 `package.json` 均同步（`npm ci --dry-run` 实证）。

**两个实施中新发现的环境事实**：

6. **仓库中 `output/` 存在已入库的历史产物**——`git ls-files output` 实证 4 个 tracked 文件（`output/android/and_web_library-debug.aar`、`and_web_library-release.aar`、`output/harmony/hm_web_library.har`、`output/web/mp-sdk-bridge-1.0.0.tgz`）。CI checkout 会带下这些陈旧产物，若构建失败，制品上传步骤的路径通配仍会匹配到旧文件并上传 → **制品存在但内容陈旧（假绿）**，违背 "制品内容与该次提交的源码状态对应"。
7. **本机 npm 为 11.19.1，其 install-scripts 机制会拦住 `esbuild@0.21.5` 的 postinstall**（实测警告：`not yet covered by allowScripts`）。esbuild 二进制缺失将直接导致 vite 构建失败；CI 上 `npm ci` 为全新安装，故必须避开 npm 11。另：Node 20 已于 2026-04 EOL。**结论：流水线固定 Node 22（自带 npm 10.x）**。

## Goals / Non-Goals

**Goals:**

- 三端（Android / 前端 / iOS）制品在推送后无人工干预自动产出且可下载
- 单端失败不阻断其余端制品产出
- proto 变更时鸿蒙生成物的可产出性获得自动守门（降级校验）
- 消除既有的构建脚本跨平台规范违背（坑 1、坑 2）
- 本地 Windows 开发流程零变化

**Non-Goals:**

- 不在 CI 上编译鸿蒙 HAR、不做 iOS `pod lib lint`、不发 Release、不跑测试（详见 proposal 非目标）
- 不重构 `build-harmony.js` 的平台适配（属鸿蒙上云后续变更）
- 不改动四端 SDK 源码与 `specs/proto/channels.proto`

## Decisions

### 决策 1：流水线拓扑——四 job 并行，不照搬 `build:all`

| 备选 | 取舍 |
|------|------|
| A. 单 job 跑 `npm run build:all` | **否**——串联 `&&` 使鸿蒙（工具链缺失）必然失败并拖垮整条流水线；一端挂则后续全不跑；四端串行耗时叠加 |
| B. 三 job（完全不设鸿蒙） | **部分否**——干净，但 proto 变更后鸿蒙生成物失效将静默无感 |
| **C. 四 job：三产物 + 一降级校验（选定）** | 各 job 独立 runner、独立成败、独立上传制品；总时长 ≈ 最慢一端；鸿蒙守住生成物底线 |

job 命名：`web` / `ios` / `android` / `harmony-codegen`（末者名称即自述其降级性质，避免误读为 HAR 可构建）。

### 决策 2：Android 构建入口跨平台化——新增 `scripts/build-android.js`

| 备选 | 取舍 |
|------|------|
| A. workflow 内直接 `cd android && ./gradlew ...`，绕过 npm script | **否**——CI 与本地命令分叉，两处维护，违背 "统一构建入口" Requirement |
| B. npm script 内用 `sh -c` / 引入 `cross-env`、`shelljs` | **否**——Windows 本地不保证有 `sh`；引入依赖与工程零依赖倾向相悖 |
| **C. 新增 `scripts/build-android.js`，按 `process.platform` 选择 wrapper（选定）** | 对标既有 `build-harmony.js` / `build-ios.js` 的脚本模式，架构一致；同时消除坑 2 的规范违背；`build:android` 命令名与产物路径不变，本地零感知 |

脚本职责：选择 `gradlew.bat`（win32）或 `gradlew`（其他）→ 执行 `:and_web_library:assembleRelease` → 调 `post-build.js android`。

### 决策 3：鸿蒙降级为 codegen 校验 job

| 备选 | 取舍 |
|------|------|
| A. 不设鸿蒙 job | **否**——见决策 1 备选 B |
| B. command-line-tools（Linux）搬上云完整构建 | **暂缓**——工具链体积数 GB、下载方式与许可是否允许 CI 使用待独立侦察、`build-harmony.js` 需先做平台适配改造。作为后续演进路线 |
| C. self-hosted runner（自备装好 DevEco 的机器） | **否**——运维成本与机器可用性不划算 |
| **D. 降级 job：仅执行 `codegen:harmony` + `scan:harmony`（选定）** | 两个脚本纯 Node、零工具链依赖；产出 ArkTS 生成物即证明 proto → 鸿蒙链路未断。**明确不宣称 HAR 可构建** |

### 决策 4：iOS 制品留在 Linux runner

依据：`build-ios.js` 头注释自述"iOS 端 SDK 为纯 Objective-C 源码发布（CocoaPods 源码 pod），**无跨平台编译步骤**"，流程为 codegen → 源文件清单校验 → zip 打包，全程 Node.js。

| 备选 | 取舍 |
|------|------|
| **A. ubuntu runner 产出源码 zip（选定）** | 零额外成本，与本地 `npm run build:ios` 产物完全一致 |
| B. macOS runner + `pod lib lint --quick` 真编译验证 | **否**——macOS runner 计费倍率显著更高、耗时长；lint 非产物必需。是否加 nightly lint 列入 Open Questions |

### 决策 5：可执行位修正——仓库永久修正 + workflow 兜底

| 备选 | 取舍 |
|------|------|
| A. 仅 workflow 内 `chmod +x` | **部分**——治标；仓库仍记录 `100644`，任何 Linux/macOS 侧开发者与未来其他流水线照样踩坑 |
| **B. `git update-index --chmod=+x android/gradlew` + workflow 内 `chmod +x` 双保险（选定）** | 索引模式改为 `100755`（文件内容零改动，Windows 本地无感）；workflow 侧防御未来再犯 |

### 决策 6：依赖安装与缓存

- **根依赖**：`npm ci`（根有 `package-lock.json`）。`file:specs/proto-codegen` 的 `dist/` 已入库，故**不执行** `build:proto`（减少一处不确定性）；若首轮出现 require 解析失败，回退方案为在 job 内补 `npm ci` 于 `specs/proto-codegen` 后执行 `build:proto`。
- **前端依赖**：`cd vue-web-sdk && npm ci`（有独立 lock）。
- **缓存**：Node 侧用 setup-node 内置 npm 缓存（key 挂 lock 文件哈希）；Android 侧缓存 Gradle 用户目录（`~/.gradle/caches`、`~/.gradle/wrapper`），key 挂 `gradle-wrapper.properties` 与 `*.gradle.kts` 哈希。
- **Android SDK**：首选依赖 runner 预装 + AGP 缺失组件 auto-download（runner 已接受 license）；若首轮失败，加 `android-actions/setup-android` 显式安装。
- **JDK**：显式安装 JDK 21（temurin），与 `toolchainVersion=21` 对齐，避免依赖 foojay 远程 provision 的网络不确定性。

### 决策 7：触发时机与制品处置

- **触发**：`push` 到 `main` + `workflow_dispatch`（手动补跑）。不开 PR 触发——当前协作模式为直推 `main`，开 PR 触发会产生冗余运行；列为 Open Question。
- **制品**：按端命名上传（`android-aar` / `web-tgz` / `ios-zip`），路径分别指向 `output/android/*.aar`、`output/web/*.tgz`、`output/ios/*.zip`（iOS 亦可直接取 `ios/ios_web_library/build/*.zip`）。不发 Release。
- **构建前清空本端 `output/` 子目录**（坑 6 处置）——配合 `if-no-files-found: error`，使"构建失败 → 上传失败"，杜绝陈旧制品被当作本次产物上传。
- **Node 版本固定 22**（坑 7 处置）——以 `env.NODE_VERSION` 统一声明，四个 job 共用。
- **鸿蒙 job 不上传制品**——生成物（`hm/hm_web_library/src/main/ets/generated/`）为源码形态且已入库，校验其可产出即达标。

### 决策 8：iOS 产物打包——平台排序候选 + 产物魔数校验

| 备选 | 取舍 |
|------|------|
| A. workflow 内绕过 `build:ios` 的打包步骤，改用 CI 侧命令压缩目录 | **否**——CI 与本地命令分叉，打包逻辑两处维护，违背 "统一构建入口" Requirement |
| B. 不修改，首轮 CI 观察 `tar -a` 在 GNU tar 下的实际行为 | **否**——若其静默产出 tar 归档，将得到"绿灯 + 损坏产物"，且此类错误不会被后续任何流程发现 |
| **C. `createZip` 重构：按平台排序候选工具 + 每次产出后校验 zip 魔数（选定）** | 对 GNU tar 的两种可能行为（报错退出 / 静默错格式）均免疫；Windows 与 macOS 同样受益；三个候选统一以 cwd + 目录名方式打包，保证归档顶层目录稳定为 `ios_web_library` |

实现要点：

- 魔数判定——产物前 4 字节须为 `PK\x03\x04`；不合格则删除产物并尝试下一候选；全部候选失败则构建**失败退出**（非静默）。
- 候选顺序——Linux：`zip -r` → `pwsh Compress-Archive` → `tar -a`；Windows / macOS：`tar -a` → `powershell.exe Compress-Archive` → `zip -r`。
- PowerShell 候选改为单条完整命令字符串（`Compress-Archive -Path "..." -DestinationPath "..." -Force`），修正原参数传递缺陷。

### 决策 9：iOS「macOS 环境前置」断言被实证否证后的修正（实施中追加）

首轮 CI 中 `ios` job 在 **ubuntu-latest 上构建成功**（本机 Windows 亦早已成功），实证否证了主规范 `build/spec.md`「环境前置要求」的既有断言——原文为「iOS 构建 MUST 依赖 macOS 工具链」，且 Scenario「iOS 在非 macOS 环境构建」断言 THEN 构建**失败**并给出平台限制提示。该断言源自 `add-ios-platform` 的逆向轨追认，当时照抄 README 前置条件表而未经实跑验证。

| 备选 | 取舍 |
|------|------|
| **A. 全面修正（选定）** | delta 追加 MODIFIED「环境前置要求」（iOS 改为 MUST NOT 依赖 macOS 工具链，Scenario 的 THEN 由「构建失败」改为「构建成功并产出源码包」，Scenario 名保留不变），并修正本 delta 内「iOS 单端构建」的 GIVEN；同步四处文档：`AGENTS.md` 红线 3、`openspec/config.yaml` 的 context、`specs/Design.md` §8.5 验证表、`README.md` 前置条件表与环境配置节 |
| B. 只修规范不动文档 | **否**——`config.yaml` 的 context 每次 apply 都作为约束输入喂给 AI，`AGENTS.md` 红线是开发者第一入口，不修会持续传播同一错误断言 |
| C. 改 `build-ios.js` 使非 macOS 环境主动失败以符合现有规范 | **否**——放弃已两次实证可用的跨平台产出能力，与「iOS 为 CocoaPods 源码 pod、构建无编译步骤」的设计事实相悖，且本变更的 `ios` job 将因此无法存在 |

**边界保留**：与**消费侧**相关的 Xcode / CocoaPods 要求（iOS 应用集成开发、`pod lib lint` 编译验证、iOS 12.0+ 部署目标）不属被否证范围——`README.md` 技术栈表、`Design.md` §1 平台表原样保留，仅将前置条件表中的 Xcode / CocoaPods 标注为「可选，仅编译验证与集成需要」。

**历史记录处置**：`specs/Wiki.md` 中 `add-ios-platform` 章节的两处历史陈述（「macOS 环境前置」「Windows 环境无法执行 build:ios」）按记录保真原则**保留原文**，另追加「后续修正」小节指向本次结论。

### Proto 通道变更影响说明

本变更**不修改** `specs/proto/channels.proto`，四端生成物内容零变化。新增守门能力如下：

| 端 | 生成时机 | CI 覆盖方式 |
|----|----------|-------------|
| Android | Gradle 构建内 KSP 处理 | `android` job 构建即校验 |
| 前端 | Vite 插件构建时生成 | `web` job 构建即校验 |
| iOS | `build:ios` 内先跑 `codegen:ios` | `ios` job 显式校验 + 源文件清单校验 |
| 鸿蒙 | `codegen:harmony` + `scan:harmony` | `harmony-codegen` job 降级校验（本次新增） |

即：proto 变更后，四端生成链路全部获得自动守门，其中鸿蒙为本次新增覆盖。

## Risks / Trade-offs

- **[AGP 9.0.1 / compileSdk 36 组件在 runner 缺失]** → 依赖 AGP auto-download；失败则加 `android-actions/setup-android`。首轮跑绿为验证点。
- **[`file:` 依赖 + 入库 `node_modules` 使 `npm ci` 行为不确定]** → 首轮验证；回退方案见决策 6。入库 `node_modules` 本身是既存技术债，不在本次范围清理。
- **[Gradle daemon JVM criteria 触发远程 JDK provision 失败/超时]** → 显式 setup-java 21；必要时在 CI 环境设 `-Dorg.gradle.java.installations.auto-download=false`。
- **[鸿蒙降级 job 造成"假绿"误读]** → job 名称与日志明示"仅生成物校验，不含 HAR 编译"；HAR 可构建性仍以本地 `npm run build:harmony` 为准（`build` 规范"构建验证完成标准"不变）。
- **[Windows 侧后续新增文件再犯可执行位问题]** → workflow 内 `chmod +x` 兜底 + 在 `AGENTS.md` 补一条约定。
- **[入库旧产物 `output/harmony/hm_web_library.har` 干扰制品收集]** → 三端各自上传自身产物路径，不触及 harmony 目录；无实际影响。
- **[CI 与本地 Android 构建行为分叉]** → 决策 2 通过统一入口脚本规避，CI 与本地执行同一 `npm run build:android`。
- **[ubuntu runner 未预装 `zip` 命令]** → 主流镜像预装；若缺失，魔数校验会使各候选依次尝试并**最终失败退出**（绝不产出损坏产物），届时在 job 内补装 `zip` 即可。
- **[iOS 打包重构影响本地 Windows 产物]** → 已实测：本机 `npm run build:ios` 走 `tar -a` 候选并通过魔数校验，产物 `ios_web_library-1.0.0.zip`（42.7 KB）与重构前一致。
- **[入库历史产物导致陈旧制品（坑 6）]** → 构建前清空 + `if-no-files-found: error` 双重保障。根本解法是把 `output/` 移出版本控制，但根目录**当前无 `.gitignore`**，且 `android/proto-codegen/build/`（Gradle 增量缓存）、`vue-web-sdk/dist/` 亦已入库——清理属既存技术债，本次不做，列入 Open Questions。
- **[npm 11 拦住 esbuild postinstall 使 vite 构建失败（坑 7）]** → 固定 Node 22（npm 10.x）；若未来升级 Node 需同步验证 install-scripts 策略。
- **[仓库内 Web 生成物与 `dist/` 落后于 proto 真相源]** → 实施中实测发现：入库的 `vue-web-sdk/src/data-sync/generated/*.gen.ts` 与 `dist/` 缺少 `LeadInfo` 通道（`specs/proto/custom/lead_info.proto` 已存在，Android / iOS / 鸿蒙三端生成物均已含），本次构建已重新生成。CI 每次重新生成故不受影响，但仓库存量产物需同步提交（处理方式由用户决策）。
- **[规范断言与实证行为不一致（既存缺陷）]** → 已按决策 9 全面修正。**教训**：逆向轨追认时「照抄既有文档」不能替代实跑验证——凡涉及环境前置、平台限制的断言，必须由实际构建证据支撑，否则错误会被写入真相源并随 config.yaml 的 context 持续放大。

## Migration Plan

1. **本地先行**：新增 `scripts/build-android.js` 并改 `build:android` 指向 → 本机执行 `npm run build:android` 验证 Windows 路径零回归（产物 `output/android/*.aar` 照常产出）。
2. **索引修正**：`git update-index --chmod=+x android/gradlew`（与步骤 1 同次提交）。
3. **推送触发首轮 CI** → 按 job 逐个观察失败点，依 Risks 中的回退方案修正（预期首轮 Android job 最可能需要 SDK/JDK 微调）。
4. **回滚策略**：流水线为纯新增文件，删除 `.github/workflows/build.yml` 即完全回滚；`build-android.js` 保留 `win32` 分支，本地行为与改动前一致，无需回滚。

## Open Questions

- 是否开启 PR 触发（取决于协作模式是否从直推 `main` 转为 PR 流）
- 是否为 iOS 增加 macOS nightly job 跑 `pod lib lint`（成本 vs 编译正确性保障）
- 鸿蒙 HAR 上云的时间表与路线（command-line-tools 下载方式、许可边界、`build-harmony.js` 平台适配）——需独立侦察后立项
- tag → GitHub Release 自动发布的引入时机（待制品形态与版本策略稳定）
- 是否将构建产物与中间物移出版本控制（新增根 `.gitignore` + `git rm --cached` 清理 `output/`、`android/**/build/`、`vue-web-sdk/dist/`、`specs/proto-codegen/node_modules`）——属既存技术债，影响面大，建议独立变更评估

# 任务清单：CI 自动化构建流水线

> 构建验证约定：按 `build` 能力域"构建验证完成标准"，未通过对应端实际构建验证的任务不得勾选完成。
> 本变更的验证分两层——本地 Windows 侧验证脚本零回归（组 1、组 2），CI 侧验证 Linux 环境跑绿（组 3）。

## 1. 构建脚本跨平台化（修正坑 1 / 坑 2 / 坑 5）

- [x] 1.1 新增 `scripts/build-android.js`：按 `process.platform` 选择 Gradle wrapper（win32 → `gradlew.bat`，其他 → `gradlew`），执行 `:and_web_library:assembleRelease`，随后调用 `scripts/post-build.js android`；风格对标既有 `build-harmony.js` / `build-ios.js`（验证：文件存在，脚本头部注释说明用途，Windows 下可直接 `node scripts/build-android.js` 调用）
- [x] 1.2 修改根 `package.json` 的 `build:android`：由 `cd android && gradlew.bat ... && node scripts/post-build.js android` 改为 `node scripts/build-android.js`；`build:all` 与其他脚本不动（验证：`npm run build:android` 命令名与调用方式对开发者不变）
- [x] 1.3 修正 `android/gradlew` 可执行位：`git update-index --chmod=+x android/gradlew`（验证：`git ls-files -s android/gradlew` 输出模式为 `100755`，且文件内容 diff 为空）
- [x] 1.4 **构建验证**：本机执行 `npm run build:android`，确认输出含 `BUILD SUCCESSFUL`、`output/android/` 下产出 `.aar` 产物、Windows 本地流程零回归（验证：构建成功标志 + 产物文件存在且时间戳更新）
  - 实测结果：`BUILD SUCCESSFUL in 23s`（40 tasks），proto codegen 解析 `channels.proto` + `custom/lead_info.proto` 得 4 messages 生成 6 文件，产物 `output/android/and_web_library-release.aar` 收集成功；`git ls-files -s android/gradlew` 已由 `100644` 变为 `100755`（blob hash 不变）
  - 实施补充：`build-android.js` 在 Windows 分支使用 `shell: true`——Node.js 自 18.20.2 / 20.12.2 起（CVE-2024-27980 修复）`execFileSync` 执行 `.bat` 不带 shell 会抛 `EINVAL`；非 Windows 分支内置 `fs.chmodSync` 作为可执行位的第三层兜底
- [x] 1.5 重构 `scripts/build-ios.js` 的 `createZip`（修正坑 5）：按平台排序候选工具（Linux 首选 `zip -r`，Windows / macOS 首选 `tar -a`）、新增 `isZipArchive` 魔数校验（前 4 字节 `PK\x03\x04`，不合格则删除产物并回退下一候选，全部失败则构建失败退出）；三个候选统一以 cwd + 目录名打包，修正 `zip` 候选传入绝对路径导致归档层级错误、以及 PowerShell 候选参数传递错误两个缺陷（验证：脚本无语法错误，本地可正常产出 zip）
- [x] 1.6 **构建验证**：本机执行 `npm run build:ios`，确认 codegen 产出、源文件校验通过、打包候选魔数校验通过、产物收集至 `output/ios/`（验证：构建成功标志 + 产物文件存在）
  - 实测结果：codegen 解析 `channels.proto` + `custom/lead_info.proto` 得 4 messages 生成 6 个 ObjC 文件；`30 source files OK`；日志输出 `Trying packer: tar -a` → `Packed with tar -a.`（魔数校验通过）；产物 `output/ios/ios_web_library-1.0.0.zip`（42.7 KB）与重构前一致
  - 范围说明：本项为实施中发现的必要修正（坑 5），已经用户确认纳入；proposal.md / design.md 已同步记录（design.md 坑 5 + 决策 8 + 2 条 Risk）

## 2. CI 流水线定义

- [x] 2.1 创建 `.github/workflows/build.yml` 骨架：触发条件为 `push` 到 `main` 与 `workflow_dispatch`；检出代码；四个并行 job 占位（`web` / `ios` / `android` / `harmony-codegen`），runner 均为 ubuntu（验证：YAML 语法有效，job 之间无 `needs` 依赖以保并行与失败隔离）
- [x] 2.2 实现 `web` job：安装 Node → 根 `npm ci` → `vue-web-sdk` 内 `npm ci` → `npm run build:web` → 上传 `output/web/*.tgz` 制品（命名 `web-tgz`）；启用 npm 缓存（验证：job 步骤完整，含制品上传）
- [x] 2.3 实现 `ios` job：安装 Node → 根 `npm ci` → `npm run build:ios` → 上传 `output/ios/*.zip` 制品（命名 `ios-zip`）；**不使用 macOS runner**（验证：job 步骤完整，runner 为 ubuntu）
- [x] 2.4 实现 `android` job：安装 JDK 21（temurin）→ `chmod +x android/gradlew` 兜底 → 根 `npm ci` → Gradle 缓存（key 挂 `gradle-wrapper.properties` 与 `*.gradle.kts`）→ `npm run build:android` → 上传 `output/android/*.aar` 制品（命名 `android-aar`）（验证：job 步骤完整，JDK 版本与 `toolchainVersion=21` 一致）
- [x] 2.5 实现 `harmony-codegen` job（降级校验）：安装 Node → 根 `npm ci` → `npm run codegen:harmony` → `npm run scan:harmony`；job 名称与日志输出明示"仅生成物校验，不含 HAR 编译"；不上传制品、不调用 `build:harmony`（验证：job 内无 DevEco / hvigor 依赖，日志含降级声明）
  - 实施补充：生成物校验覆盖 5 个 `.ets` 文件（`DataSyncChannels` / `DataSyncMethods` / `DataSyncSetters` / `DataSyncDecorators` / `DataSyncBindings`，末者为 `scan:harmony` 产出），以 `test -s` 断言非空；额外增加一个**非阻断**的 `::warning` 步骤，当 codegen 产出与已提交生成物存在差异时提示（服务于 proto 变更后忘提交生成物的场景）
- [x] 2.6 **构建验证**：本地等价性预检——执行 `npm run build:web` 与 `npm run build:ios`（Windows 可跑的两端），确认 CI 将调用的命令链在干净流程下成立、产物输出到 `output/web/`、`output/ios/`；同时对 `build.yml` 做 YAML 语法校验（验证：两端构建成功标志 + 产物文件存在 + YAML 无语法错误）
  - 实测结果：`build:web` 成功（`vite build` + `vue-tsc` 完成，`npm pack` 产出 `mp-sdk-bridge-1.0.0.tgz` 20.9 kB / 23 files，收集至 `output/web/`）；`build:ios` 成功（见 1.6）；YAML 经 `js-yaml` 解析通过，结构校验：4 个 job 均为 `ubuntu-latest` 且**均无 `needs`**（并行 + 失败隔离）、三个产物 job 均含 `upload-artifact@v4` 与构建前清理步骤、`android` 独有 `setup-java@v4` + `cache@v4`、`harmony-codegen` 无上传、触发为 `push(main)` + `workflow_dispatch`、`permissions: contents: read`
  - 两个 lock 同步性已验：根目录与 `vue-web-sdk` 的 `npm ci --dry-run` 均无不同步报错
- [x] 2.7 坑 6 / 坑 7 处置（实施中发现，已同步至 design.md）：三个产物 job 均在构建前 `rm -rf output/<platform>`，配合 `if-no-files-found: error` 杜绝陈旧制品假绿；`ios` job 额外做 `zip` 可用性检查与 `unzip -t` 完整性验证；`env.NODE_VERSION` 固定 `22`（避开 npm 11 的 install-scripts 拦 `esbuild` postinstall，且 Node 20 已 EOL）（验证：workflow 中四个 job 均引用 `NODE_VERSION: '22'`，三个产物 job 均含清理步骤）

## 3. 首轮 CI 跑绿与修正

- [x] 3.1 提交组 1、组 2 全部改动（含 `gradlew` 索引模式修正）并推送至 `main`，触发流水线（验证：GitHub Actions 出现本次运行记录，四个 job 均被调度）
  - 实测结果：两个提交推送成功（`ca08a2a..ae648d0 main -> main`）——`32925a5` CI 变更（10 files，+701/−28，含 `android/gradlew` `old mode 100644 / new mode 100755`）+ `ae648d0` Web 生成物同步（10 files，+88/−64）；Actions **run #1**（id `34374401529`，head_sha `ae648d0`，event `push`）已调度四个 job：`Web SDK (TGZ)` / `Android SDK (AAR)` / `HarmonyOS codegen (downgraded check, no HAR compile)` / `iOS SDK (source zip)`
  - 取证说明：推送当时仓库为私有，Actions API 返回 404 且本机无 `gh` CLI，无法自助查询；用户将仓库转为公开后，经 `actions/runs` 与 `actions/runs/<id>/jobs` 端点取得完整 job / step 状态
- [x] 3.2 观察四个 job 执行结果，按 `design.md` Risks 节的回退方案逐个修正失败点（预期热点：Android SDK 组件缺失 → 补 `android-actions/setup-android`；Gradle JDK provision → 显式 JDK；`file:` 依赖解析 → 补 `specs/proto-codegen` 安装与 `build:proto`）（验证：修正后重跑，`web` / `ios` / `android` 三个产物 job 全部成功）
  - 实测结果：**首轮四 job 全部 success，未触发任何回退方案**——Risks 节预期的三个热点全部落空：AGP 9.0.1 / compileSdk 36 组件在 runner 可用（无需 `android-actions/setup-android`）、显式 setup-java 21 使 Gradle daemon JVM criteria 未触发远程 provision、`file:specs/proto-codegen` 依赖因 `dist/` 已入库而直接解析成功（无需 `build:proto`）
  - 耗时：`android` 约 3 分钟（Gradle 首次构建无缓存，制品于 16:07:28 上传）、`web` 21 秒、`harmony-codegen` 18 秒、`ios` 14 秒
- [x] 3.3 下载三端制品并核对内容：`.aar` / `.tgz` / `.zip` 均可解包，目录结构与本地产物一致，制品非空（验证：三个制品文件均下载成功且解包后含预期产物结构）
  - 实测结果（**等效证据**）：制品清单 API 返回三件、均 `expired: false`（`expires_at` 2026-12-08，保留 90 天）、各带 sha256 digest——`android-aar` 39906 B（本地 release.aar 39916 B）、`web-tgz` 21026 B（本地 20874 B，+152 B 为外层封装开销）、`ios-zip` 36684 B（本地 43725 B，差 7 KB 由 CRLF→LF 解释：CI 为 LF 检出，30 个 ObjC 源文件逐行少 1 字节，量级吻合）；`ios` job 的 `Verify zip integrity`（`unzip -t`）步骤 success，直接证明归档可解包且未损坏；三端上传均带 `if-no-files-found: error`，构建失败即上传失败，故制品存在即证明为本次构建产出
  - **范围说明**：本项验证方式经用户确认改为等效证据收尾——工具集不允许下载网络二进制资源，故未执行「下载 + 本地解包比对目录树」；如需人工抽查，可在 run #1 页面 Artifacts 区下载三件制品
- [x] 3.4 确认 `harmony-codegen` job 成功且日志明示降级性质；核对 ArkTS 生成物在该 job 中正常产出（验证：job 状态为成功，日志含鸿蒙生成物产出记录与降级声明）
  - 实测结果：job `HarmonyOS codegen (downgraded check, no HAR compile)` → **success**（18 秒），job 名本身即自述降级边界；步骤全部 success——`Scope notice`（降级声明）→ `Run HarmonyOS proto codegen` → `Scan decorators for DataSyncBindings` → `Verify generated ArkTS artifacts`（对 5 个 `.ets` 做 `test -s` 非空断言）→ `Report uncommitted generated artifacts`（非阻断 `::warning`）；job 内无任何 DevEco / hvigor 依赖，亦无制品上传
- [x] 3.5 **构建验证**：CI 侧四个 job 全绿（三产物 + 一降级校验）；本地复验 `npm run build:android` 仍成功，确认 CI 化未造成本地回归（验证：CI 运行页面显示全部 job 成功 + 本地构建成功标志）
  - 实测结果：CI run #1 四 job 全 success（`total_count: 4`，逐个 `conclusion: success`）；本地复验 `npm run build:android` → **`BUILD SUCCESSFUL in 14s`**（40 actionable tasks: 1 executed, 39 up-to-date），产物 `and_web_library-release.aar` 收集至 `output/android/`，Windows 本地流程零回归

## 4. 规范与文档同步

- [x] 4.1 在 `specs/Design.md` 的架构决策索引登记本次关键决策（四 job 并行拓扑、Android 入口跨平台化、鸿蒙降级校验、iOS 留 Linux runner），并按需补构建章节的 CI 说明（验证：决策索引表出现对应行）
  - 实施结果：新增 §2.14（CI 流水线拓扑）与 §2.15（构建脚本的 CI 兼容性），均带背景 / 决策 / 替代方案；新增 §8.7（CI 流水线，含 job 拓扑图与四条边界说明）；§9 文件清单补 `scripts/build-android.js` 与 `.github/workflows/build.yml` 两行
  - 连带修正（本次改动直接造成的文档失效）：§8.2 Android 构建流程图仍写 `cd android && gradlew.bat ...`，已被任务 1.2 改为 `node scripts/build-android.js`，故重写该流程块并补一条跨平台入口说明
  - 超范围补充（已纳入，一行级）：§8.1 命令总览缺 `build:ios` / `scan:harmony` / `codegen:ios`、§8.6 产物输出树缺 `ios/`——属上一次 `add-ios-platform` 变更遗漏的既存缺口，因与本次编辑同一章节且均为单行，一并补齐
- [x] 4.2 在 `README.md` 补 CI 章节：流水线徽章、三端制品获取方式、鸿蒙降级校验的边界说明（明示 HAR 可构建性仍以本地验证为准）（验证：章节存在且徽章链接指向本仓库 workflow）
  - 实施结果：头部补 `build` 徽章（指向 `actions/workflows/build.yml`）；新增顶级章节「CI 自动构建」（位于「快速开始」与「使用方式」之间），含四 job 表（Runner / 执行内容 / 制品）、并行与失败隔离说明、90 天保留与 `workflow_dispatch` 手动触发、鸿蒙边界引用块、iOS 无编译步骤引用块；工程结构树补 `.github/workflows/build.yml` 一行
- [x] 4.3 在 `AGENTS.md` 补两条约定：新增 shell 脚本须同时修正 git 可执行位、CI 为构建验证的补充而非替代；在 `docs/ai/harness.md` 的 L1 命令表补 CI 触发与制品获取说明（验证：两份文档均出现对应条目）
  - 实施结果：`AGENTS.md` 新增红线 8（可执行位随脚本入库，附 `git update-index --chmod=+x` 与 `100755` 验证方式）与红线 9（CI 是补充不是替代，明示 `harmony-codegen` 降级边界）；`docs/ai/harness.md` L1 行后新增「L1 的 CI 补充」四条（触发 / 覆盖 / 制品获取 / 边界）
- [x] 4.4 修正被 CI 实证否证的 iOS 环境断言（实施中追加，已经用户确认「全面修正」；详见 design.md 决策 9）：delta 追加 MODIFIED「环境前置要求」并修正本 delta 内「iOS 单端构建」的 GIVEN；同步四处文档与一处历史记录（验证：全工程不再存在「`build:ios` 需 macOS」类断言，`openspec validate --strict` 通过）
  - 实证依据：run #1 的 `iOS SDK (source zip)` job 在 ubuntu-latest 上 success（本机 Windows 亦成功），而主规范「环境前置要求」原断言 iOS 构建 MUST 依赖 macOS 工具链、且非 macOS 环境 THEN 构建失败
  - 规范侧：delta 追加 MODIFIED「环境前置要求」（iOS 改为 MUST NOT 依赖 macOS 工具链；Scenario「iOS 在非 macOS 环境构建」名称保留、THEN 改为构建成功并产出源码包），并将「iOS 单端构建」的 GIVEN 由「macOS + Xcode + CocoaPods」改为「Node.js 运行时可用」；`validate --strict` 通过
  - 文档侧：`AGENTS.md` 红线 3、`openspec/config.yaml` 的 context（并补跨平台脚本约束一条）、`specs/Design.md` §8.5 验证表、`README.md` 前置条件表（Xcode / CocoaPods 标注为可选）与环境配置节、`docs/ai/harness.md` L1 行
  - 边界保留：消费侧的 Xcode / CocoaPods 要求（集成开发、`pod lib lint`、iOS 12.0+ 部署目标）**不属**被否证范围，`README.md` 技术栈表与 `Design.md` §1 平台表原样保留
  - 历史记录：`specs/Wiki.md` 的 `add-ios-platform` 章节两处错误陈述按记录保真原则保留原文，另追加「后续修正」小节；同时补录「2026-09 CI 自动化构建流水线」章节与两条决策索引行（AGENTS.md「评审与归档」要求架构级决策同步 Wiki.md）
- [x] 4.5 **验证**：执行 `openspec validate add-ci-build-pipeline` 与 `openspec validate --all`，确认本变更与全部主规范校验通过、无回归（验证：两条命令输出 valid / 0 failed）
  - 实测结果：`openspec validate add-ci-build-pipeline --strict` → `Change 'add-ci-build-pipeline' is valid`；`openspec validate --all` → **`Totals: 7 passed, 0 failed (7 items)`**（6 主规范 + 1 变更）；`openspec doctor` → `OpenSpec root: ok`
  - 任务编号说明：本项原为 4.4，因插入 iOS 断言修正任务而顺延为 4.5

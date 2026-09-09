# 提案：CI 自动化构建流水线（三端产物 + 鸿蒙降级校验）

## Why（为什么）

代码已托管至 GitHub，但构建验证仍完全依赖开发者本机工具链：`npm run build:all` 是本地串联脚本，一端失败后续全停，且鸿蒙构建绑定本机 DevEco Studio 路径。这带来两个问题——① proto 或任一端源码变更后，"各端产物是否仍可构建"没有客观门禁，只能靠开发者自觉在本机跑构建；② 产物（AAR / TGZ / zip）没有统一的可获取入口，集成方拿不到与源码提交对应的产物。

侦察确认：Android / Web / iOS 三端产物构建**全部可在 Linux 托管 runner 上完成**（iOS 端为纯 Node.js 的 codegen + 源码校验 + 打包，不需要 macOS 与 Xcode），仅鸿蒙端因开发工具链无法在公共 runner 获得而暂时受阻。因此可先以低成本拿下三端自动化。

## What Changes（变更内容）

- **[仓库修正]** `android/gradlew` 补齐可执行位（当前 git 索引记录为 `100644`，Linux 环境执行必然 `Permission denied`）
- **[脚本跨平台化]** Android 构建入口从 Windows 专有的批处理 wrapper 调用改为跨平台调用（新增 `scripts/build-android.js`，对标既有 `build-harmony.js` / `build-ios.js` 的模式，按运行平台选择 wrapper）；根 `package.json` 的 `build:android` 改为调用该脚本
- **[脚本跨平台化]** iOS 产物打包消除 Linux 上的**静默损坏风险**：`build-ios.js` 的 `createZip` 回退链以 `tar -a` 为首选，而 Linux 的 GNU tar 并不支持写出 zip 格式（可能“成功”产出未压缩的 tar 归档却命名为 `.zip`，并因而阻止后续 `zip` 候选执行）；改为按平台排序候选工具 + **产物魔数校验**（不合格则删除并继续回退）。同时修正 `zip` 候选传入绝对路径导致归档内层级错误的缺陷（实施中发现，详见 design.md 坑 5）
- **[CI 新增]** `.github/workflows/build.yml`：四个并行 job
  - `web`（ubuntu）：安装依赖 → 构建 → 产出 TGZ
  - `ios`（ubuntu）：codegen → 源码完整性校验 → 打包 zip
  - `android`（ubuntu）：JDK 21 → Gradle wrapper 构建 → 产出 AAR
  - `harmony-codegen`（ubuntu，**降级**）：仅执行鸿蒙 proto codegen 与装饰器扫描，校验生成物可产出；不执行 HAR 编译
- **[产物归档]** 各端产物以 CI 制品形式上传，按端命名，与触发提交对应；**构建前清空本端产物目录**——仓库 `output/` 中存在已入库的历史产物，不清空会导致构建失败时仍上传陈旧文件（假绿）
- **[环境约束]** 流水线固定 Node 22（自带 npm 10.x）：本机实测 npm 11.19.1 的 install-scripts 机制会拦住 `esbuild` 的 postinstall，导致 vite 构建失败；Node 20 已于 2026-04 EOL
- **[规范增量]** `build` 能力域：
  - MODIFIED "统一构建入口"——跨平台约束从"Windows 单方向"扩展为"Windows 本地 + Linux CI 双向"
  - MODIFIED "环境前置要求"——**修正被 CI 实证否证的既有断言**（实施中追加）：原文断言"iOS 构建 MUST 依赖 macOS 工具链"且 Scenario"iOS 在非 macOS 环境构建"的 THEN 为构建失败；实测 `build:ios` 在 ubuntu-latest 与 Windows 本机均成功（纯 Node 流程，无编译步骤），故改为 MUST NOT 依赖 macOS 工具链，Scenario 名保留、THEN 改为构建成功（详见 design.md 决策 9）
  - ADDED "CI 自动化构建"——无人工干预产出三端产物、鸿蒙降级校验、产物可获取、失败可观测
- **[文档同步]** `specs/Design.md`：新增 §2.14（CI 流水线拓扑）/ §2.15（构建脚本 CI 兼容性）/ §8.7（CI 流水线），并修正 §8.1 命令总览（补 `build:ios` 等缺失项）、§8.2 Android 构建流程（本次改动使原 `gradlew.bat` 描述失效）、§8.5 验证表、§8.6 产物输出；`specs/Wiki.md`：补录本次变更章节，并为 `add-ios-platform` 章节追加「后续修正」小节（原文按记录保真原则保留）；`README.md`：新增「CI 自动构建」章节与流水线徽章，修正前置条件表与环境配置节的 iOS 断言；`AGENTS.md`：修正红线 3，新增红线 8（可执行位随脚本入库）与红线 9（CI 是补充不是替代）；`docs/ai/harness.md`：L1 命令表修正 iOS 断言并补 CI 触发与制品获取说明；`openspec/config.yaml`：修正 context 中的 iOS 环境断言并补跨平台脚本约束

### 非目标（不在范围内）

- **鸿蒙 HAR 云端编译**——工具链获取与许可问题未解，本次仅做 codegen 层降级校验；后续单独立项（路线见 design.md 决策 3）
- **iOS 编译验证**（`pod lib lint`）——需要 macOS runner 与 Xcode，成本高且非产物必需，本次不做
- **GitHub Release 自动发布**——本次只上传 CI 制品；tag 触发发 Release 留待产物形态稳定后再议
- **单元测试 / 集成测试自动化**——本次流水线只做"构建 + 产物"，不引入测试执行（各端测试体系尚未建立）
- **产物签名与发布到制品仓库**（Maven / npm registry / 私有 pod repo）——不在本次范围
- **self-hosted runner 搭建**——不作为本次方案

## Capabilities（能力域）

**New Capabilities**：无。

**Modified Capabilities**（使用既有路径）：

- `build`——"统一构建入口" Requirement 的跨平台约束双向化（新增 Linux CI 执行场景）；"环境前置要求" Requirement 的 iOS 断言修正（macOS 由 MUST 依赖改为 MUST NOT 依赖，仅可选的 `pod lib lint` 编译验证需 macOS）；新增 "CI 自动化构建" Requirement（三端产物、鸿蒙降级校验、产物获取、失败可观测）

## Impact（影响范围）

| 对象 | 影响 |
|------|------|
| `.github/workflows/build.yml` | **新增**——四 job 流水线定义 |
| `scripts/build-android.js` | **新增**——跨平台 Android 构建入口 |
| `scripts/build-ios.js` | `createZip` 重构：按平台排序候选工具 + zip 魔数校验 + 修正归档顶层目录；产物格式与本地行为不变 |
| `package.json` | `build:android` 脚本改为调用新脚本；`build:all` 语义不变 |
| `android/gradlew` | git 索引文件模式 `100644` → `100755`（内容零改动） |
| `openspec/specs/build/spec.md` | 归档时合并 CI 增量（2 组 MODIFIED + 1 组 ADDED） |
| `openspec/config.yaml` | context 修正 iOS 环境断言 + 补跨平台脚本约束（纯文档） |
| `specs/Design.md` / `specs/Wiki.md` / `README.md` / `AGENTS.md` / `docs/ai/harness.md` | 决策登记、CI 说明补充、iOS 环境断言修正（纯文档，不涉及代码行为） |
| 四端 SDK 源码 | **零改动**——本变更只动构建入口与 CI 配置 |
| 仓库内已入库的构建产物（`output/`、`vue-web-sdk/dist/`、`android/proto-codegen/build/`） | 本变更**不清理**（既存技术债，根目录无 `.gitignore`）；CI 侧通过构建前清空规避陈旧制品，清理建议独立立项 |
| 鸿蒙构建（`build-harmony.js`） | **零改动**——本机行为完全不变；CI 上不调用它，改为直接调用两个纯 Node codegen 脚本 |
| 本地 Windows 开发流程 | `npm run build:android` / `build:all` 命令与产物路径均不变 |

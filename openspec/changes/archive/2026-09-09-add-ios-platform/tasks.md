# 任务：iOS 平台纳入规范体系

> 本变更为逆向轨追认：iOS 实现已存在（远程提交 73e7e60），所有任务为**规范编写与表述统一**，不含任何代码修改。
> 范围补充：实施中经用户确认，`specs/Design.md` 的四端化（8 处表述 + 平台表/验证表/脚本清单/通道流程补 iOS 行）纳入本变更。

## 1. 规范增量撰写

- [x] 1.1 撰写 `specs/bridge/spec.md` delta：MODIFIED "平台自动检测"（新增 iOS 容器场景）与"URL 平台参数注入"（新增 iOS 注入场景），携带全部既有 Scenario 保证归档合并完整性
- [x] 1.2 撰写 `specs/codegen/spec.md` delta：MODIFIED "纯命名约定推导"（三端 → 四端，新增 iOS 端生成场景）与"生成物可重建"（四端再生成）
- [x] 1.3 撰写 `specs/build/spec.md` delta：MODIFIED "统一构建入口"（新增 iOS 单端构建场景）、"构建产物形态"（新增 zip 源码包产物与 pod 可集成场景）、"环境前置要求"（新增 macOS 工具链前置与非 macOS 失败提示场景）
- [x] 1.4 运行 `openspec validate --change add-ios-platform` 确认 delta 格式合规（RFC 2119 关键词 / Scenario 结构 / MODIFIED 完整性）——实际以 `openspec validate add-ios-platform` 执行，返回 valid

## 2. iOS 行为核验（逆向轨取证）

- [x] 2.1 核验 bridge 行为：`ios/ios_web_library/Bridge/MPBridgeUtils.m` 的 `appendPlatformParam`（platform=ios、去重逻辑）、`bridge.js` 注入（WKUserScript DocumentStart、多 Bundle 查找）
- [x] 2.2 核验 codegen 行为：`scripts/proto-codegen-ios.js` 从 `specs/proto/channels.proto` 生成 ObjC 产物（`Generated/` 下通道常量、方法映射、推送 API），确认零端侧映射配置
- [x] 2.3 核验 build 行为：`package.json` 的 `build:ios` / `codegen:ios` / `build:all` 编排，`scripts/build-ios.js` 的 codegen → 校验 → zip 打包流程，`scripts/post-build.js` 的 postBuildIos 产物收集
- [x] 2.4 核验平台中立域无增量理由：`MPAppLinkHandler`（透明弹窗 modal + `__weak` 注册表）、`MPDataSyncHelper`、`MPEventRouter` 满足 applink / data-sync / emitter 现有 Requirement 语义（design.md 决策 3 已记录）

## 3. 文档表述统一（三端 → 四端）

- [x] 3.1 `openspec/config.yaml`：context 中"Android / HarmonyOS / Web 三端"改为四端，技术栈补 iOS（Objective-C + CocoaPods）
- [x] 3.2 `AGENTS.md`：导航表与红线中涉及端数的表述统一为四端
- [x] 3.3 `docs/ai/harness.md`：L1 编译验证命令表补 `npm run build:ios`（注明 macOS 前置）
- [x] 3.4 `README.md`：头部总述与能力概览表的"三端"表述统一为四端（iOS 章节已存在，无需新增）；另修复 L471 构建章节残留

## 4. 收尾验证

- [x] 4.1 `openspec validate --all`：全部主规范 + 变更 delta 通过（7 passed / 0 failed）
- [x] 4.2 复查全工程残留"三端"表述（Grep 三端|three-platform），确认与 iOS 相关处均已更新：README L471 已修复；`specs/Design.md` 8 处经用户确认纳入本变更加以更新（含平台表/验证表/脚本清单/通道流程补 iOS 行）；变更 artifact 自身的迁移叙述合理保留
- [x] 4.3 构建链存在性核验：`build:ios` 链路（scripts + package.json）完整在位（Windows 环境不执行 iOS 真机构建，理由见 design.md 风险节）

# 提案：iOS 平台纳入规范体系

## Why（为什么）

iOS Objective-C SDK（`ios/ios_web_library/`）已在远程仓库完整落地：Bridge / AppLink / Emitter / DataSync 四模块与三端行为对齐，构建链（`build:ios` / `codegen:ios` / `build:all` 含四端）与 CocoaPods 分发就绪，README 已含 iOS 章节。但 `openspec/specs/` 规范体系仍停留在"三端"表述——iOS 是已实现却未被规范覆盖的活行为（与此前透明弹窗的情形同类，规模更大）。规范缺位会导致后续 AI 协作与验收忽略第四端。

## What Changes（变更内容）

- **[规范增量]** `bridge` 能力域：平台自动检测 Requirement 的场景扩展至 iOS 容器（平台参数 `platform=ios` 注入行为追认）
- **[规范增量]** `codegen` 能力域：命名约定推导 Requirement 从三端扩展为四端（iOS 生成 Objective-C 产物）
- **[规范增量]** `build` 能力域：统一构建入口、产物形态、环境前置三组 Requirement 增补 iOS 端（`build:ios`、zip 产物、macOS + Xcode 前置）
- **[规范增量]** `data-sync` 能力域：通道唯一真相源与集成方扩展通道两个 Requirement 的"三端生成物"表述四端化（实施中发现的补录，详见 design.md 决策 4）
- **[文档统一]** 三个主规范的 Purpose 段"三端"表述四端化（文档级卫生，同 design.md 处理逻辑）；`openspec/config.yaml`、`AGENTS.md`、`docs/ai/harness.md`（L1 命令表）、`README.md`、`specs/Design.md`：三端表述统一为四端
- **不改**：`applink` / `emitter` 的 Requirement——其行为表述天然平台中立（"Native 端"），iOS 实现满足现有 Requirement 语义（透明弹窗 modal 形态即"覆盖于当前页面之上的弹窗形态"；applink 仅 Purpose 段一句表述卫生修正）

## Capabilities（能力域）

**New Capabilities**：无。

**Modified Capabilities**（均使用既有路径）：

- `bridge`——"平台自动检测" Requirement 场景集扩展（新增 iOS 容器场景）
- `codegen`——"纯命名约定推导" Requirement 生成端范围扩展（三端 → 四端）
- `build`——"统一构建入口"、"构建产物形态"、"环境前置要求" 三组 Requirement 增补 iOS 行为
- `data-sync`——"通道唯一真相源"、"集成方扩展通道" 两组 Requirement 的"三端生成物"表述四端化（实施中补录）

## Impact（影响范围）

| 对象 | 影响 |
|------|------|
| `openspec/specs/{bridge,codegen,build,data-sync}/spec.md` | 归档时合并 iOS 增量 |
| `openspec/specs/{applink,emitter}/spec.md` 及各域 Purpose 段 | 三端 → 四端表述卫生修正（纯文档） |
| `openspec/config.yaml` / `AGENTS.md` / `docs/ai/harness.md` / `README.md` / `specs/Design.md` | 三端 → 四端表述统一（纯文档） |
| iOS 代码（`ios/ios_web_library/`） | **零改动**——本变更是逆向轨追认，实现已存在 |
| 三端既有行为 | **零影响**——只增不改既有 Requirement 的 Android/HarmonyOS/Web 场景 |

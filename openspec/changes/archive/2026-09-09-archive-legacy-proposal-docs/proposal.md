# 提案：归档旧提案文档清理

## Why（为什么）

三体系初始化后，旧 SSD 体系遗留的三个需求提案文档（`specs/propersal.md`、`specs/propersal-emittor.md`、`specs/propersal_applink.md`）承载的语义已由 `openspec/specs/` 六大能力域规范承接，继续保留会造成双真相源。本次变更将其清理动作固化为 OpenSpec 归档记录，留下可追溯的审计痕迹。

## What Changes（变更内容）

- **[已完成，待归档]** `openspec/specs/applink/spec.md` 补录 2 个 Requirement：透明弹窗页面类型、透明弹窗生命周期（4 个 Scenario）——旧 propersal_applink.md 独有的、已实现但未被规范覆盖的活行为
- **[已完成，待归档]** 删除 `specs/propersal.md`（等待唤醒机制 → 已由 data-sync 规范取代）
- **[已完成，待归档]** 删除 `specs/propersal-emittor.md`（四级消息路由 → 已由 emitter 规范取代）
- **[已完成，待归档]** 删除 `specs/propersal_applink.md`（Scheme 跳转 + 透明弹窗 → 已由 applink 规范取代，独有行为补录完成）
- **[已完成，待归档]** `README.md` 工程结构移除两行旧提案引用；`specs/Design.md` 文件清单移除一行失效引用
- 不涉及任何代码/构建配置改动，`specs/proto/`、`specs/proto-codegen/`、`Design.md`、`Wiki.md`、`bridge-protocol.ts` 全部保留

## Capabilities（能力域）

无新增或修改的能力域。本变更为纯文档清理（spec 级行为无变化——applink 规范补录属于对既有实现行为的规范化记录，已直接合入主规范并通过校验），故声明 `skip_specs: true`。

**说明**：规范补录的内容（透明弹窗 2 个 Requirement）不作为本变更的增量再次提交，避免与主规范重复；其归属记录见 design.md 的追溯链。

## Impact（影响范围）

| 对象 | 影响 |
|------|------|
| `openspec/specs/applink/spec.md` | 已扩充（+2 Requirement / +4 Scenario），校验通过 |
| `specs/` 目录 | 文件数 8 → 5（删除 3 个旧提案） |
| `README.md` / `specs/Design.md` | 索引行修正（已完成） |
| 三端构建链 | **零影响**（proto 真相源、codegen 包、脚本路径均未触碰） |

# 任务清单：归档旧提案文档清理

> 说明：以下任务的动作本体已在探索会话中执行完毕（当时经用户逐项确认）。本清单如实记录动作与验证，apply 阶段做的是**核验与勾选**，不是重做。

## 1. 规范补录（行为语义保全）

- [x] 1.1 在 `openspec/specs/applink/spec.md` 补录"透明弹窗页面类型" Requirement（透明弹窗打开、遮罩关闭 2 个 Scenario）
- [x] 1.2 在 `openspec/specs/applink/spec.md` 补录"透明弹窗生命周期" Requirement（连续弹窗并存、回首页全关闭 2 个 Scenario）

## 2. 旧提案删除（消除双真相源）

- [x] 2.1 删除 `specs/propersal.md`（语义已由 data-sync 规范承接）
- [x] 2.2 删除 `specs/propersal-emittor.md`（语义已由 emitter 规范承接）
- [x] 2.3 删除 `specs/propersal_applink.md`（语义已由 applink 规范承接，含补录部分）

## 3. 索引修正（引用卫生）

- [x] 3.1 `README.md` 工程结构移除 `propersal_applink.md` / `propersal-emittor.md` 两行
- [x] 3.2 `specs/Design.md` 文件清单移除 `specs/propersal.md` 一行

## 4. 验证

- [x] 4.1 `openspec validate --all` 通过（6 passed / 0 failed）
- [x] 4.2 全工程 `propersal` 残留引用扫描零命中（排除 node_modules / build / output 等产物目录）
- [x] 4.3 构建链完整性确认：`specs/proto/channels.proto`、`specs/proto-codegen/`、构建脚本路径均未被触碰（纯文档变更，无需重跑三端构建）

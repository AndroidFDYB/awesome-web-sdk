# 设计：归档旧提案文档清理

## 技术方案

本变更无代码实现，全部为文档操作。设计记录的是**决策过程与追溯链**，供归档后回溯。

### 备选方案与取舍

| 方案 | 内容 | 结论 |
|------|------|------|
| **A（保守清理）** | 仅删除三个旧提案文档，其余不动 | 被否决：尽职核查发现 propersal_applink.md 含三项已实现但未被任何现行规范覆盖的独有行为（透明弹窗、鸿蒙 action 转换、弹窗链表管理），直接删除会造成行为契约丢失 |
| **A'（补录后清理）** | 先将独有行为补录进 applink 主规范，再删除三个旧提案 | **采纳**：消除双真相源的同时保证行为语义零丢失 |
| **B（结构重构）** | 将 proto/、proto-codegen/ 迁出 specs/，重构目录命名 | 被否决：解决的是命名审美问题，代价是 6 处构建配置 + 2 个 package.json 路径改写，收益不成比例 |

### 保留决策（specs/ 目录边界）

`specs/` 整体不可删除——它承担双重角色：

- **构建资产**：`proto/channels.proto`（三端 codegen 消费）、`proto-codegen/`（`file:` 协议被根 package.json 与 vue-web-sdk 依赖）
- **架构文档**：`Design.md` / `Wiki.md` 被 AGENTS.md、docs/ai/、openspec/config.yaml 多处引用

`bridge-protocol.ts` 暂保留：`hm/.../BridgeModels.ets` 注释引用其作为协议对齐参考。

## 追溯链（行为语义迁移对照）

| 旧提案内容 | 迁移去向 | 实现佐证 |
|-----------|----------|----------|
| 等待唤醒 / 装饰器 / 三层架构 | `openspec/specs/data-sync/spec.md`（5 Requirement） | `vue-web-sdk/src/data-sync/` 全套实现 |
| 四级消息格式 / 容器路由 / host 消费 | `openspec/specs/emitter/spec.md`（4 Requirement） | `MPEventRouter.kt` / `EventRouter.ets` |
| Scheme 协议 / 三态结果码 / backHome | `openspec/specs/applink/spec.md`（Requirement 1-3） | `AppLinkParser` 三端实现 |
| **透明弹窗页面类型**（本次补录） | `openspec/specs/applink/spec.md` 新增 Requirement 4 | `TransparentWebActivity.kt` / `TransparentPopupDialog.ets` / SDK 导出 `PAGE_TRANSPARENT` |
| **透明弹窗生命周期**（本次补录） | `openspec/specs/applink/spec.md` 新增 Requirement 5 | `AppLinkHandler.ets` 回调注册表 + `closeAllPopups()` |
| 鸿蒙 `sk://action` 转换 | 不入规范（实现细节），保留于 `AppLinkHandler.ets:12` 注释 | — |

补录以 RFC 2119 行为契约表述，剥离了旧提案中的实现细节（链表、1pixel 背景等），符合"规范只描述可观察行为"的工程约定。

## 文件变更清单（均已在探索会话执行完毕）

- `openspec/specs/applink/spec.md`：+2 Requirement（透明弹窗页面类型、透明弹窗生命周期）
- `specs/propersal.md`、`specs/propersal-emittor.md`、`specs/propersal_applink.md`：删除
- `README.md`：工程结构移除 2 行旧提案引用
- `specs/Design.md`：文件清单移除 1 行失效引用（`specs/propersal.md`）

## 验证

- `openspec validate --all`：6 passed / 0 failed（补录后格式合规）
- 全工程 `propersal` 残留引用扫描：零命中
- 三端构建链关键路径（proto 真相源 / codegen 包 / 脚本）未被触碰，无需重跑构建

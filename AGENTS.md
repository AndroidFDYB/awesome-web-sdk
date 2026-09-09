# AGENTS.md — MP-SDK AI 协作总纲

> 本工程以三套体系规范 AI 协作：**OpenSpec**（行为规范驱动）、**Superpowers**（开发工作流纪律）、**Harness**（SubAgent 军团编排）。开始任何工作前，先读完本文档。

## 工程速览

MP-SDK 是跨平台 JSBridge SDK（Android / HarmonyOS / Web 三端），以 `specs/proto/channels.proto` 为唯一真相源驱动三端 Codegen。四大功能模块：Bridge（通信底座）、DataSync（等待唤醒数据同步）、AppLink（scheme 跳转）、Emitter（跨 WebView 事件路由）。

## 三体系导航

| 问题 | 答案位置 |
|------|----------|
| 系统**现在**是什么行为？ | [openspec/specs/](openspec/specs/) 六大能力域主规范（真相源） |
| 我要**改**系统行为，流程怎么走？ | [docs/ai/workflow.md](docs/ai/workflow.md) 三路径分类 + Architectural 流程 |
| 任务怎么**分派与验证**？ | [docs/ai/harness.md](docs/ai/harness.md) SubAgent 协作 + 测试军团分层 |
| 实现层为什么这样做？ | `specs/Design.md`（架构决策）+ `specs/Wiki.md`（演进历史） |

## 行为红线（违反即返工）

1. **先分类后动手**：任何创造性工作先按 workflow.md 分类（Spike / Bounded / Architectural），未获人类伙伴批准前不写实现代码。
2. **规范先行**：Architectural 变更必须先有 OpenSpec change（proposal / specs 增量 / design / tasks），实现与规范冲突时先修规范。
3. **构建即完成**：代码变更必须实际执行对应端构建（`npm run build:android` / `build:harmony` / `build:web`）并看到成功标志，才允许标记任务完成。仅凭静态推断不算完成。
4. **组合模式**：Android / 鸿蒙端 WebView 一律组合持有，禁止继承式用法（`specs/Design.md` §2.6/§2.7）。
5. **零依赖策略**：前端 SDK 不引入 protobuf 运行时或第三方桥接库依赖；Proto 仅作 Schema，传输用 JSON（§2.10）。
6. **生成物不手改**：Codegen 产物视为构建产物，修改须回到 Proto 真相源。
7. **中文文档**：所有规范与文档用中文 Markdown，技术名词与代码标识符保留英文原文。

## OpenSpec 快速上手

```bash
openspec list --specs          # 查看现有能力域规范
openspec new change <name>     # 创建变更（kebab-case 命名）
openspec status --change <name>
openspec validate --all        # 校验全部规范与变更
```

会话内可用斜杠命令：`/opsx:propose`（提案）、`/opsx:apply`（实施）、`/opsx:update`（修订）、`/opsx:archive`（归档）、`/opsx:explore`（探索）。

**Artifact 写作规范**：见 `openspec/config.yaml` 的 context 与 rules——Requirement 含 RFC 2119 关键词（SHALL/MUST/SHOULD）、Scenario 用 GIVEN/WHEN/THEN、只写行为不写实现细节。

## 评审与归档

- 任务组完成后按 harness.md §5 两段式评审（规范符合性 → 代码质量）
- 归档前按 harness.md §6 检查单逐项确认
- 架构级决策同步 `specs/Design.md` 索引与 `specs/Wiki.md` 变更记录

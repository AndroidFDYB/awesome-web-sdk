# Harness 军团编排规范

> 本文档定义 MP-SDK 工程从需求到验收的 AI 编排体系：SubAgent 协作机制、Phase 流程编排与测试分层。目标是让复杂任务可以安全地并行分派、让"完成"有客观验证标准。

## 1. 角色分工

| 角色 | 职责 | 承载者 |
|------|------|--------|
| **Harness（主编排）** | 任务拆分、SubAgent 调度、结果汇总、面向人类伙伴汇报 | 主对话 Agent |
| **Search SubAgent** | 只读侦察：代码定位、行为追踪、依赖梳理 | 搜索子代理 |
| **Implement SubAgent** | 按 tasks.md 执行单个任务组，完成后回传摘要 | 通用子代理 |
| **Test SubAgent** | 测试军团：按层级执行验证（见 §4） | 通用子代理 |
| **CodeReview SubAgent** | 两段式评审：先规范符合性、后代码质量 | 评审子代理 |
| **人类伙伴** | 设计批准、变更审阅、验收决策 | 用户本人 |

## 2. SubAgent 协作机制

**信息传递以文件为准，上下文只留结论：**

1. **摘要回传**：SubAgent 完成后回传不超过 500 字的结果摘要（做了什么 / 验证结果 / 遗留问题）
2. **文件传递**：大量中间信息（搜索发现、代码位置、任务执行日志）通过工程内文件传递，不塞进对话上下文
3. **并行上限**：同时运行的 SubAgent 不超过 3 个
4. **任务自包含**：每次分派的 prompt MUST 包含：目标、涉及的文件路径、验收标准（含构建命令）、约束（组合模式等红线）
5. **失败上抛**：SubAgent 无法完成时如实报告失败原因，MUST NOT 假装完成

## 3. Phase 流程编排

Architectural 级变更（对应 [workflow.md](workflow.md) §4）的标准五阶段：

```
Phase 0 侦察 ──► Phase 1 提案 ──► Phase 2 实现 ──► Phase 3 验证 ──► Phase 4 归档
  Search          /opsx:propose     并行 Implement      Test 军团        /opsx:archive
  SubAgent        (人类伙伴批准后)    SubAgent ×≤3        + Review         (人类伙伴验收后)
```

| Phase | 编排动作 | 出口条件 |
|-------|----------|----------|
| **0 侦察** | 派 Search SubAgent 梳理受影响面，产出发现文件 | 影响面清单确认 |
| **1 提案** | 主 Agent 按 OpenSpec schema 生成四类 artifact | 人类伙伴批准 change |
| **2 实现** | 按依赖序并行派发 Implement SubAgent（≤3 并行） | tasks.md 全部勾选 |
| **3 验证** | 派 Test SubAgent 跑测试军团 + CodeReview SubAgent 两段式评审 | 全层级通过、无 Critical 问题 |
| **4 归档** | 增量合并回主规范，同步 Design.md / Wiki.md | 人类伙伴验收通过 |

**Bounded 级变更**：跳过 Phase 1 的 artifact 产出，聊天内设计批准后直接 Phase 2→3；实现后仍必须走构建验证。

## 4. 测试军团分层

Test SubAgent 全程参与，按层级递进，**上层验证依赖下层通过**：

| 层级 | 名称 | 验证内容 | MP-SDK 对应命令 |
|------|------|----------|------------------|
| **L1** | 编译层 | 构建通过、生成物正确产出 | `npm run build:android` / `build:harmony` / `build:web` / `build:ios`（iOS 需 macOS + Xcode + CocoaPods） |
| **L2** | 单元层 | 模块级行为符合 specs 的 Scenario | 各端既有单元测试（如 vue-web-sdk 测试） |
| **L3** | 集成层 | 多端联调场景：数据同步全流程、事件路由跨容器 | 示例应用 + 真机/模拟器人工核对清单 |
| **L4** | 回归层 | 既有能力域未被破坏 | 全量构建 + 主规范 Scenario 抽查 |

**铁律**：L1 未通过时 MUST NOT 进入 L2 及以下流程；L1 输出无成功标志（`BUILD SUCCESSFUL` 等）时任务不允许标记完成。

## 5. 两段式评审

每个任务组实现完成后，CodeReview SubAgent 依次执行：

1. **规范符合性评审**：对照 change 的 specs 增量逐条核对 Scenario——实现是否满足了每一条 GIVEN/WHEN/THEN
2. **代码质量评审**：符合工程既有惯例（组合模式、显式导入、零依赖策略）、无越界改动（不夹带无关变更）

问题按严重度分级：**Critical（阻塞，必须修复）** / Major（应修复） / Minor（可延后）。Critical 未解决 MUST NOT 汇报任务完成。

## 6. 归档前检查单

- [ ] tasks.md 全部勾选，且每个任务组对应的构建验证命令有成功输出
- [ ] specs 增量与实际实现一致（评审无未解决的 Critical 问题）
- [ ] L4 回归通过，六个能力域主规范无冲突
- [ ] 架构级决策已同步 `specs/Design.md` 索引与 `specs/Wiki.md` 变更记录
- [ ] 人类伙伴完成验收（`/opsx:archive` 执行）

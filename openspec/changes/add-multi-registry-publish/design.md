## Context

iOS 发布线（add-ios-cocoapods-publish，已归档）建立了「tag 触发 → CI 构建成功 → fail-fast 版本校验 → 纯 git 推送至私有 spec repo」的模式。本变更将该模式推广至 Android 与 Web，但两端发布目标均为 GitHub Packages（托管平台内置私有 registry），认证与推送机制与 iOS 的「跨仓库 git push + PAT」不同。

当前状态的关键事实（探索阶段已核实）：

- `vue-web-sdk/package.json`：包名 `@mp-sdk/bridge`，dependencies 含 `"@mp-sdk/proto-codegen": "file:../specs/proto-codegen"`（发布即炸雷）
- Android `and_web_library` 依赖 `api(project(":library"))`（jsbridge fork），Maven 发布需双坐标；无 `version` 定义
- workflow `permissions: contents: read`，publish-ios 用 PAT secret 跨仓库推送；build job 四个并行无 needs
- `settings.gradle.kts` 的 `dependencyResolutionManagement` 为 `FAIL_ON_PROJECT_REPOS`（消费者仓库配置模式的镜像参考）

## Goals / Non-Goals

**Goals:**

- Android / Web 以 GitHub Packages 为私有 registry，与 iOS 线并列成三端统一发布
- 发布侧零新 secret：复用 workflow 内置 `GITHUB_TOKEN`（`packages: write`）
- 版本治理「一处 tag 驱动三端版本」：tag → Gradle version / npm version，发布前 fail-fast 校验
- npm 包消除 `file:` 依赖地雷，保证消费者可安装

**Non-Goals:**

- 不改造 iOS 线（已归档，工作正常）
- 不覆盖鸿蒙端（无私有 ohpm registry 对应物，维持手动安装）
- 不建 fat AAR（AGP 9.x 不支持 embed 依赖）
- 不做发布后自动 smoke 测试消费（无消费方仓库可托管）

## Decisions

### D1. 私有 registry 选型：GitHub Packages（Maven + npm 双 registry）

- **理由**：与代码同平台托管，认证模型统一（PAT read:packages 消费 / GITHUB_TOKEN 发布），零基础设施
- **被否备选**：
  - JitPack——私有模式收费，`settings.gradle.kts` 中 jitpack.io 仅适用开源库
  - 公共 npmjs.com / Maven Central——项目 Proprietary，不可公开分发
  - 自建 Nexus / Verdaccio——需服务器运维，超出团队当前投入意愿
  - git tag 直装（Maven）——无标准机制；npm git 依赖不支持 monorepo 子目录

### D2. Android 双坐标：`com.sharknade:and-web-library` + `com.sharknade:jsbridge`

- **理由**：`api(project(":library"))` 在 Maven POM 中不可解析，必须拆为独立坐标传递依赖；groupId 沿用 namespace `com.sharknade`，两坐标同 groupId 便于消费者记忆
- **被否备选**：fat AAR 合并（AGP 不支持，社区插件不兼容 9.x）；只发布主坐标（POM 依赖断裂，消费者无法构建）

### D3. 版本注入：tag 驱动 `-Pversion` 属性注入，源码不硬编码版本

- **理由**：Android 侧无包管理器清单文件，源码中硬编码 version 会引入「忘改版本」类失败模式（iOS podspec 已需人工同步）；由 CI 从 tag 提取版本注入 `-Pversion`，本地默认 `0.0.0-SNAPSHOT`，发布版本只有一个真相源（tag）
- **被否备选**：build.gradle.kts 硬编码 version（与 podspec 同样的人工同步负担，且无法本地预览发布版本）；git describe 动态推算（tag 重打场景下与 CI 校验逻辑不一致）

### D4. npm 包名：`@androidfdyb/bridge`

- **理由**：GitHub Packages npm registry 强制 scope = owner（小写），`@mp-sdk` scope 无法发布；owner 为 `AndroidFDYB`，scope 必须为 `androidfdyb`
- **被否备选**：保持 `@mp-sdk/bridge` + 换公共 registry（违背 Proprietary 约束）；TRANSFER org `mp-sdk` 到 GitHub（组织级操作，超出工程变更范围）
- **影响面**：vue-web 演示工程 import、README、TGZ 产物名（自动跟随）

### D5. 发布侧认证：workflow `GITHUB_TOKEN` + `permissions: packages: write`

- **理由**：发布目标即本仓库 packages，内置令牌天然具备该作用域；与 iOS 线 PAT 模式解耦（那是跨仓库 push 的刚需）；零 secret 配置 = 零「加错仓库」类事故（iOS 线实测踩中过）
- **被否备选**：新建 `PACKAGES_TOKEN` PAT secret（多一个轮换负担，无跨仓库需求支撑）；GITHUB_TOKEN 但权限全开（违反最小权限）

### D6. file: 依赖清理：直接移除而非降级 devDependencies

- **理由**：`@mp-sdk/proto-codegen` 是构建期 codegen 工具，其产物已被 vite 打进 dist bundle；根 package.json 已有相同 `file:` 引用满足本地开发场景，vue-web-sdk 内的该依赖实际是冗余安装链路
- **被否备选**：挪到 devDependencies（`npm publish` 不含 devDeps，可行但保留无用的安装开销与 node_modules 膨胀）

### D7. 发布 job 结构：三 publish job 并列，各依赖对应 build job

- **理由**：与既有 `publish-ios`（needs: [ios]）模式对称；单端发布失败不影响其余端（与 build job 的失败隔离哲学一致）；版本校验放在 publish job 内第一步（fail-fast，registry 零写入）
- **被否备选**：单一 publish job 依赖全部 build job（单端发布失败阻断其他端，违背失败隔离）；发布逻辑并入 build job（混合关注点，workflow 膨胀）

### D8. 消费者认证指引：README 单独「消费者配置」章节 + 各端小节

- **理由**：三端凭证配置形态各异（settings.gradle / .npmrc / pod repo add），但共享「PAT + read:packages + 最小权限」原则；集中成章便于跨端检索
- **被否备选**：散落在各端集成小节内（重复且易漂移）；独立 docs/consumers.md（超出 README 单文档约定）

## Risks / Trade-offs

- **[GITHUB_TOKEN 不可跨仓库发布]** → 本设计发布目标锁定本仓库 packages；若未来要发到其他 org 仓库，需另立 PAT 方案（届时参照 iOS 线模式）
- **[双坐标给消费者引入隐式依赖]** → POM 声明为 `compile` scope 传递依赖，消费者可 override；README 集成文档明确列出两个坐标，避免「不知情依赖」
- **[npm 包改名是破坏性变更]** → 本仓库 vue-web 演示工程同步改 import；README 标注 BREAKING；旧 TGZ 手动安装路径继续可用（zip/tgz 产物不受影响）
- **[GitHub Packages npm registry 不可删包重发同名同版本]** → 严格执行「tag 即最终版本」纪律；发布前 fail-fast 校验 + 测试阶段用 `0.0.x-test` 类 tag，正式 tag 一次成功（iOS 线五轮迭代教训已固化：先本地验证提取逻辑再推 tag）
- **[Maven registry 首次发布后版本覆盖限制]** → 同 npm，GitHub Packages Maven 同版本不可覆盖；依赖同一纪律
- **[本地构建无版本号（SNAPSHOT）]** → 本地 AAR 产物仍走 output/ 目录手动分发，版本一致性校验只约束 CI 发布路径，本地开发不受影响

## Migration Plan

1. 先落 Web 线（改名 + 依赖清理 + publish-web job），用 `v0.0.x-test` tag 走通 npm 发布闭环
2. 再落 Android 线（maven-publish 配置 + publish-android job），同法走通 Maven 闭环
3. 全链路通过后打正式 tag（`v1.0.1`，podspec 同步 bump），三端齐发
4. 回滚策略：publish job 失败不影响 build job 制品产出（needs 隔离）；GitHub Packages 已发版本无法回滚删除，但消费者可 pin 旧版本

## Open Questions

（无——命名、坐标、认证、job 结构、清理策略均已在探索阶段与用户确认）

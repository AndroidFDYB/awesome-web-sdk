# 设计：iOS 平台纳入规范体系

## 上下文

iOS SDK（`ios/ios_web_library/`，Objective-C）已由远程提交 `73e7e60` 完整落地，自述为"parity with hm_web_library"（与鸿蒙端对齐）。本变更属**逆向轨追认**：实现与构建链已存在，规范体系（撰写时默认三端）尚未覆盖 iOS。类似上一归档变更 `archive-legacy-proposal-docs` 对透明弹窗的补录，但规模从单个行为扩展到一整个平台。

## 目标 / 非目标

**目标**：
1. iOS 已实现的对外可观察行为进入规范真相源，四端一致性成为可验收对象
2. 全工程"三端"表述统一为四端，消除 AI 协作盲区

**非目标**：
- 不改动任何 iOS / 三端代码
- 不修改 `channels.proto`（无通道变更）
- 不为 iOS 单独新建能力域（沿用既有六域划分，平台是场景维度不是能力维度）

## 决策

### 决策 1：MODIFIED 而非 ADDED——平台是场景维度

iOS 未引入新的对外行为类别，只是既有 Requirement 多了一个承载端：
- `bridge`："平台自动检测"与"URL 平台参数注入"的场景集扩展（`MPBridgeUtils.appendPlatformParam` 的 `platform=ios`、WKWebView 容器）
- `codegen`："纯命名约定推导"从三端扩为四端（`scripts/proto-codegen-ios.js` 生成 ObjC 通道常量/方法映射/推送 API）
- `build`：三组 Requirement 增补 iOS（`build:ios` 入口、zip 源码包产物、macOS+Xcode+CocoaPods 前置）

**被否方案**：新建 `ios` 能力域。拒绝理由：会造成四端各自一套规范、同一行为被四处重复描述，与"规范描述平台中立的可观察行为"原则冲突。

**被否方案**：MODIFIED `applink` / `emitter`。拒绝理由：这两域 Requirement 文本本身平台中立（"Native 端"），iOS 实现（`MPAppLinkHandler` 透明弹窗 modal 形态、`__weak` 回调注册表、`MPEventRouter` 四级路由）满足现有语义，无需修改（applink 仅 Purpose 段一句表述卫生修正）。

### 决策 4：data-sync 补录 delta（实施中发现的设计疏漏修正）

propose 阶段决策 1 曾判定 data-sync 完全平台中立而无需增量，实施复查（任务 4.2 全工程残留扫描）发现该判断有疏漏：`data-sync/spec.md` 的"通道唯一真相源" Requirement 明确写了"三端生成物（注解、装饰器、常量、setter）"，"集成方扩展通道"的 Scenario 也含"执行三端构建"——这些是四端现实下已过时的行为表述，并非平台中立。经用户确认补录 `data-sync` delta（MODIFIED 上述两个 Requirement，四端化表述并补方法映射生成物形态），走归档合并正道。同时三个主规范 Purpose 段的"三端"表述（codegen/build/applink）作为文档级卫生直接修正（同 specs/Design.md 处理逻辑，经用户确认纳入）。

### 决策 2：iOS 分发形态为源码包，与其他三端二进制/包产物并存

`build:ios` 产出 zip 源码包（含 podspec），集成方式为 CocoaPods 源码 pod（本地 `:path =>` 或私有 pod repo）。理由（源自 build-ios.js 头注释）：iOS SDK 以 Objective-C 源码分发，无跨平台编译步骤，与 AAR/HAR/TGZ 并列作为第四种产物形态进入"构建产物形态" Requirement。这是对既成事实的追认，非新设计。

### 决策 3：透明弹窗行为在 iOS 的承载方式（佐证记录，不入 applink 增量）

鸿蒙用自定义 Dialog + 双向链表，Android 用透明 Activity + taskAffinity，iOS 用 `.overFullScreen` + `.crossDissolve` modal + `__weak` close block。三者均为"覆盖于当前页面之上的弹窗形态"这一平台中立规范语义的具体化，`MPAppLinkHandler` 注释明示"SDK 配置 + Delegate 执行"的职责切分。applink/spec.md 现有 5 个 Requirement 已覆盖，不产生增量。

## 四端行为对照（本次核验结论）

| 能力域 | Android | 鸿蒙 | iOS | Web | 规范动作 |
|--------|---------|------|-----|-----|----------|
| 平台检测 | ✓ | ✓ | ✓（URL 参数识别） | ✓（自动检测） | bridge MODIFIED |
| 平台参数注入 | platform=android | platform=harmony（据 Web 实现推定） | platform=ios | — | bridge MODIFIED |
| Codegen | KSP 注解 | 常量 + setter | ObjC 常量/方法/推送 API | 装饰器 | codegen MODIFIED |
| 构建入口 | build:android | build:harmony | build:ios | build:web | build MODIFIED |
| 产物 | AAR | HAR | zip（源码 pod） | TGZ | build MODIFIED |
| AppLink / DataSync / Emitter | ✓ | ✓ | ✓（MPAppLinkHandler / MPDataSyncHelper / MPEventRouter） | ✓ | 无增量（平台中立表述已覆盖） |

## 风险与权衡

- **Windows 环境无法执行 `build:ios`**（macOS 工具链前置）：本变更 apply 阶段不执行 iOS 构建，以"构建链存在性核验"（package.json scripts + build-ios.js 流程审查）替代完成标准；iOS 真机构建验证属后续真实代码变更时的义务
- **`bridge` 平台检测 iOS 场景措辞**：Web SDK 对 iOS 的识别依赖 URL 平台参数（而非容器 API 差异探测，与 Android/鸿蒙的 dsbridge 环境探测不同路径），Scenario 以"URL 携带平台标识参数"为 GIVEN 条件如实表述，避免规范夸大实现能力
- 归档合并时四个 MODIFIED Requirement（bridge 两个、codegen 两个、build 三个、data-sync 两个，共九组）需完整替换主规范对应条目，delta 中已携带全部既有 Scenario

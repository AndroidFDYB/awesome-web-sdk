# MP-SDK 面试准备手册

## 一、项目背景 Story（2 分钟）

> "我上家公司做的是金融会员业务，之前一直是纯原生开发。后来业务决定往 Hybrid 方向转——用 WebView 承载前端页面，实现快速迭代。
>
> 但转型过程中遇到几个核心问题：
> 1. 前端页面需要 Native 的用户登录态（uid、ticket），但 WebView 拿不到
> 2. 四端（Android/iOS/鸿蒙/Web）的 Bridge 调用方式不一致，前端适配成本高
> 3. 页面之间跳转没有统一协议，各端自己维护
>
> 我主导设计了一套跨平台 JSBridge SDK，用 proto 驱动四端代码生成，解决了这些问题。"

### 成果量化（1 分钟）

> "上线后效果很稳定：
> - 新通道接入从 3 天降到 10 分钟（改一行 proto，四端自动生成）
> - 跨端数据不一致的 bug 降为零（编译期就能发现）
> - 前端零改动接入 iOS（兼容策略设计）
>
> 因为方案足够稳定，基本不需要日常维护，SDK 已经变成了基础设施。"

### "为什么离职"话术

> "公司做了组织架构调整，团队业务线有变动。加上 SDK 已经进入稳定维护期，不需要专人投入了。我希望能找到更有挑战性的项目，所以选择了离开。"

---

## 二、架构总览

### 四层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      接入层（四端产物）                            │
│                                                                 │
│   Android AAR    │  HarmonyOS HAR  │  iOS Pod(zip)  │  Web TGZ  │
│   (Kotlin/KSP)   │  (ArkTS/hvigor) │  (ObjC/Xcode)  │(TS/Vite) │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        功能层（三大模块）                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  数据同步     │  │  AppLink     │  │  前端 Emitter       │  │
│  │  DataSync    │  │  标准化      │  │  跨 WebView 通信    │  │
│  │              │  │              │  │                      │  │
│  │ · 等待-唤醒   │  │ · scheme 解析 │  │ · 四级事件路由       │  │
│  │ · 装饰器/注解 │  │ · 透明弹窗栈  │  │ · container:scope   │  │
│  │ · 通道推送    │  │ · backHome   │  │   :model:event      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    一致性保障（Proto SSOT）                        │
│                                                                 │
│              specs/proto/channels.proto                          │
│              ┌──────────────────────┐                            │
│              │ message UserInfo {   │                            │
│              │   string uid = 1;    │    ── codegen ──▶  四端代码 │
│              │ }                    │                            │
│              └──────────────────────┘                            │
│                                                                 │
│   命名约定: UserInfo → userInfo → syncUserInfo                   │
│   扩展方式: custom/*.proto → codegen 自动生成四端                  │
└─────────────────────────────────────────────────────────────────┘
```

### 讲述顺序

| 顺序 | 内容 | 时间 | 目的 |
|---|---|---|---|
| 1 | 问题与背景 | 2 min | 让面试官进入场景 |
| 2 | **核心设计决策（亮点）** | 8 min | 展示思考深度 |
| 3 | 功能全景 | 5 min | 证明方案落地 |
| 4 | 亮点总结 | 2 min | 强化记忆 |

---

## 三、核心设计决策（8 分钟）

### 决策 1：Proto 驱动的 Single Source of Truth

> "我用一个 channels.proto 文件作为四端数据通道的唯一真相源。
> 命名约定：UserInfo → userInfo → syncUserInfo（PascalCase → camelCase → sync + PascalCase）
>
> **为什么选 proto** 而不是 TypeScript 接口或 JSON Schema？
> - proto3 语法简洁，天然支持多语言 codegen
> - 运行时只用 JSON 传输（不引入 protobuf 二进制依赖）
> - 扩展方式明确：集成方在 custom/ 目录新增 .proto，codegen 自动解析
>
> **拒绝的替代方案**：
> - 手写四端常量 → 四端同步成本高，容易遗漏
> - JSON Schema → 没有原生的 codegen 生态"

### 决策 2：共享 codegen 解析器 + 各端独立生成器

> "@mp-sdk/proto-codegen 是一个纯 TS 的共享 proto 解析包（parseProtoFile 返回 ProtoMessage[]），各端的 codegen 脚本消费它：
> - Android: KSP 注解处理器（纯 JVM 模块）
> - 鸿蒙: node scripts/proto-codegen-harmony.js → ArkTS
> - iOS: node scripts/proto-codegen-ios.js → Objective-C
> - Web: Vite 插件 + TypeScript
>
> 这样 proto 文件改一行，四端代码全自动重新生成。"

### 决策 3：协议兼容 + 平台检测的兼容策略

> "iOS 端有一个关键决策：bridge.js 同时设置两个标记：
> - `window.__ios_bridge = true`（身份标记，供未来精确识别）
> - `window.__harmony_bridge = true`（兼容标记）
>
> **为什么设 `__harmony_bridge`**？
> 因为现有前端 SDK 通过 `__harmony_bridge && dsBridge` 来识别 dsBridge 协议环境。
> iOS 的协议格式与鸿蒙完全一致，设置这个标记可以让前端 SDK 零改动接入 iOS。
>
> **拒绝的替代方案**：
> - 改前端 SDK 增加 iOS 检测 → 需要前端配合发版，阻塞 iOS 独立上线"

### 决策 4：iOS 透明弹窗的 .overFullScreen 强制执行

> "iOS 端透明弹窗需要 .overFullScreen 才能透出下方页面。
> 设计上有三个选项：
> 1. SDK 只传 hint（delegate 可忽略）→ 不可控
> 2. SDK 创建 VC → 违反'SDK 无 UI 代码'原则
> 3. SDK 配置 VC 属性 + delegate 执行 present → 最终选择
>
> 我选了方案 3：delegate 创建 VC → SDK 强制设置
> modalPresentationStyle = .overFullScreen + modalTransitionStyle = .crossDissolve
> → delegate present。
>
> 内存安全方面，SDK 内部用 `__weak` 创建 close block，不依赖集成方是否记得用 `__weak`。"

---

## 四、功能全景（5 分钟）

### 模块 1：数据同步（DataSync）

```
核心机制：等待-唤醒（wait-and-wake）

1. 前端发起 HTTP 请求 → 装饰器标记所需通道（如 @waitUserInfoSync）
2. 拦截器阻塞请求，等待 Native 推送数据
3. Native 页面加载完成 → DataSyncHelper 推送数据到 JS
4. 前端收到数据 → 唤醒等待队列 → 请求发出
```

**集成方式**：

| 平台 | 方式 | 代码 |
|---|---|---|
| Android | KSP 注解 | `@NeedsUserInfo` |
| HarmonyOS | ArkTS 装饰器 | `@NeedsUserInfo` / `@NeedsDataSync([...])` |
| Web | TS 装饰器 | `@waitUserInfoSync` |
| iOS | 传统调用 | `initWithRequiredChannels:@[...]` |

### 模块 2：AppLink 标准化

```
统一跳转协议：
sk://native={pageName='vip',url='https://...',title='VIP',backHome='1'}

SDK 负责：
- 解析 scheme（状态机解析器，逐字符处理）
- 透明弹窗管理（关闭回调栈，backHome 时逐一关闭）
- backHome 转换（sk://native= → sk://action= 交由根容器）
```

### 模块 3：前端 Emitter（跨 WebView 通信）

```
四级消息格式：container:scope:model:event
- container: 目标容器（vip / loan / lead / common / host）
- scope: 业务域
- model: Vue 组件名
- event: 事件名

路由规则：
- postToNative: 发到 Native 端（host 容器直接消费）
- postToWeb: 发到指定容器的 WebView（SDK 通过 callJsMethod 转发）
```

---

## 五、Proto Codegen 生成内容

### 命名约定

```
UserInfo → userInfo（通道名）→ syncUserInfo（JSBridge 方法）→ setUserInfo（setter）
```

### 四端生成产物对照表

| 用途 | Android | HarmonyOS | iOS | Web |
|---|---|---|---|---|
| **通道常量** | DataSyncChannels.kt | DataSyncChannels.ets | MPDataSyncChannels.h/.m | config.gen.ts |
| **方法映射** | DataSyncMethods.kt | DataSyncMethods.ets | MPDataSyncMethods.h/.m | handlers.gen.ts |
| **Setter** | HelperSetters.kt | DataSyncSetters.ets | Helper+Generated.h/.m | — |
| **注解/装饰器** | Annotations.kt | DataSyncDecorators.ets | — | decorators.gen.ts |
| **类型定义** | — | — | — | types.gen.ts |
| **元数据** | channel-mappings.json | — | — | — |

### Android KSP 两阶段生成

```
阶段 1: Proto Codegen（Gradle task）
  channels.proto → @NeedsUserInfo + DataSyncChannels + channel-mappings.json

阶段 2: KSP 编译期处理（DataSyncSymbolProcessor）
  channel-mappings.json → 扫描 @Needs* 注解 → 生成 DataSyncBindings.kt

运行时：
  DataSyncBindings.getChannels("LoanActivity") → setOf("userInfo", "loanInfo")
```

### 鸿蒙装饰器 + hvigor 插件

```
阶段 1: Proto Codegen（Node.js 脚本）
  channels.proto → @NeedsUserInfo + DataSyncDecorators.ets

阶段 2: 装饰器扫描（scan-decorators-harmony.js）
  正则扫描 .ets 文件 → 生成 DataSyncBindings.ets

运行时：
  DataSyncBindings.getChannels("LoanPage") → ["userInfo", "loanInfo"]
```

---

## 六、构建链对比：KSP vs hvigor 插件

### Android 构建链

```
gradlew assembleRelease
│
├─ 1. proto-codegen (Gradle Task)
│     → 生成 @NeedsUserInfo 等注解定义
│
├─ 2. KSP 注解处理 (编译前，Kotlin 编译器内部)
│     → 读取 channel-mappings.json
│     → 扫描 @Needs* 注解
│     → 生成 DataSyncBindings.kt
│
├─ 3. compileKotlin
│     → 编译所有 .kt 文件（包括生成的）
│
└─ 4. assembleRelease → AAR 产物
```

### HarmonyOS 构建链

```
npm run build:harmony
│
├─ 1. proto-codegen (Node.js 脚本)
│     → 生成 DataSyncDecorators.ets
│
├─ 2. 装饰器扫描 (Node.js 脚本，编译前独立步骤)
│     → 正则扫描 .ets 文件
│     → 生成 DataSyncBindings.ets
│
├─ 3. hvigor assembleHar (ArkTS 编译)
│     → 编译所有 .ets 文件（包括生成的）
│
└─ 4. → HAR 产物
```

### 关键差异

| 维度 | Android KSP | HarmonyOS hvigor 插件 |
|---|---|---|
| **运行位置** | Kotlin 编译器内部 | 编译器外部的独立脚本 |
| **源码分析** | 完整 AST（类型、继承、注解参数） | 正则匹配（字符串扫描） |
| **类型感知** | 知道 `@NeedsUserInfo` 是注解 | 只知道文本匹配 |
| **生成时机** | 编译阶段内 | 编译前 |
| **增量编译** | KSP 支持增量 | 每次全量扫描 |
| **集成深度** | 深度集成（编译器插件） | 松耦合（文件 I/O） |

---

## 七、iOS .overFullScreen 方案

### 设计原则

> "SDK 配置 VC 属性 + delegate 执行 present"
>
> - SDK 不创建 VC（无 UI 代码）
> - SDK 强制设置 .overFullScreen + .crossDissolve
> - delegate 创建 VC + 执行 present
> - SDK 内部 `__weak` 管理 close block

### 三轮设计迭代

| 方案 | 结果 | 原因 |
|---|---|---|
| SDK 传 hint，delegate 执行 | ❌ 否决 | delegate 可忽略，不可控 |
| SDK 创建 VC | ❌ 否决 | 违反"SDK 无 UI 代码"原则 |
| SDK 配置 VC + delegate present | ✅ 采用 | 强制 + 分离 + 可控 |

### 关键代码

```objc
// SDK 强制执行
- (void)configureTransparentVC:(UIViewController *)vc {
    vc.modalPresentationStyle = UIModalPresentationOverFullScreen;
    vc.modalTransitionStyle = UIModalTransitionStyleCrossDissolve;
}

// SDK 内部 __weak 管理 close block
__weak typeof(vc) weakVC = vc;
[self addPopup:^{
    [weakVC dismissViewControllerAnimated:YES completion:nil];
}];
```

---

## 八、MP-SDK vs DSBridge

### 一句话总结

> DSBridge 是一个 JSBridge 通信库，MP-SDK 是一个基于 JSBridge 的跨平台 SDK 解决方案。
> DSBridge 解决"Native 和 JS 怎么通信"，MP-SDK 解决"四端怎么一致地通信 + 数据同步 + 页面跳转 + 事件路由"。

### 功能对比

| 维度 | DSBridge | MP-SDK |
|---|---|---|
| JSBridge 通信 | 核心能力 | 基于 DSBridge 协议（兼容） |
| 平台支持 | Android / iOS / Web | + **HarmonyOS** |
| 协议一致性 | 各端独立实现 | proto SSOT 保证四端一致 |
| 数据同步 | 无 | wait-and-wake 机制 |
| AppLink 跳转 | 无 | scheme 标准化 + 弹窗栈 |
| 事件路由 | 无 | 四级事件 |
| 编译期安全 | 运行时字符串匹配 | KSP / 装饰器 + codegen |
| 构建工具链 | 各端独立构建 | `npm run build:all` |
| 鸿蒙支持 | 不支持 | 原生支持 |
| 生态成熟度 | GitHub 4k+ stars | 自用项目 |

### MP-SDK 优势

1. **四端协议一致性** —— 改一行 proto，四端代码自动同步
2. **数据时序保证** —— 装饰器自动阻塞/唤醒，零额外代码
3. **鸿蒙原生支持** —— DSBridge 不支持
4. **编译期安全** —— 拼错方法名编译报错，不是运行时才发现

### MP-SDK 劣势

1. **学习成本高** —— 需理解 proto / 状态机 / 装饰器
2. **侵入性高** —— 需集成多模块，修改构建流程
3. **无社区** —— 私有项目，非开源
4. **过度设计风险** —— 小项目用 DSBridge 更轻量

### 面试话术

> "DSBridge 是一个优秀的 JSBridge 通信库，但它只解决通信问题。我们的业务场景更复杂：
> 1. 四端一致性 —— 金融业务，方法名拼错就可能导致数据不同步
> 2. 数据时序 —— 前端请求需要等 Native 数据就绪
> 3. 鸿蒙适配 —— DSBridge 不支持鸿蒙
> 4. 事件路由 —— 多 WebView 之间需要通信
>
> 所以我们基于 DSBridge 协议（兼容前端 dsbridge npm 包），在上层构建了一套跨平台 SDK 解决方案。"

---

## 九、面试官高频追问

### Q1: 为什么不用现有的 DSBridge / WebViewJavascriptBridge？
> 自研可以统一四端协议，第三方库只覆盖单端。

### Q2: proto codegen 的解析器是你写的吗？
> 是的，轻量级 proto3 子集解析器，只解析 message + 标量字段，约 200 行 TS 代码。不用官方 protobuf 编译器是因为我们不需要二进制序列化，只需要 message 定义做 codegen。

### Q3: 鸿蒙端和 iOS 端的桥接机制有什么本质区别？
> 鸿蒙 javaScriptProxy 可以注入同步对象，iOS WKWebView 只有异步消息通道（WKScriptMessageHandler）。

### Q4: DataSyncHelper 的等待-唤醒机制怎么实现的？
> 状态机：前端请求被拦截器阻塞 → Native 推送数据 → 状态变 SYNCED → 唤醒队列。

### Q5: 如果 proto 文件有 breaking change 怎么办？
> codegen 会重新生成所有文件，编译期就能发现不兼容。

### Q6: 如果团队 10 个人同时维护四端，怎么保证不冲突？
> proto 文件是 SSOT，冲突在 proto 层面解决（合并 message 定义），codegen 自动重新生成四端代码。

### Q7: 性能怎么样？有数据吗？
> JSBridge 通信本身是微秒级（同步调用），数据同步的等待-唤醒是零开销（只是 Promise resolve）。KSP 编译期处理不影响运行时性能。

### Q8: 这套方案有什么局限性？
> - iOS 端没有 KSP 等价物，ObjC 无法做编译期注解处理
> - 鸿蒙的装饰器扫描是正则匹配，不如 KSP 精确
> - 目前只支持标量字段，不支持嵌套 message

### Q9: 如果让你重新做，会怎么改？
> 1. 一开始就把 Emitter 事件系统做成独立的 npm 包，Web 端可以单独使用
> 2. 数据同步支持嵌套 message（目前只支持标量字段）
> 3. 增加 SDK 的监控面板，可视化查看各通道数据推送状态

### Q10: 代码是你写的吗？
> "架构设计、协议定义、设计决策都是我做的。编码实现阶段使用了 AI 辅助工具（类似 Copilot），但所有设计约束、接口定义、边界条件都是我指定的。AI 是执行工具，我是架构师。举个例子，iOS 端 .overFullScreen 的强制方案经历了三轮设计迭代，这些决策都是我做的。"

---

## 十、一句话总结（收尾用）

> "这个 SDK 的核心理念是：用 proto 驱动四端代码生成保证协议一致性，用装饰器/注解降低集成成本，用等待-唤醒机制解决数据时序问题，用 scheme 标准化跨页面跳转。好的基础设施就应该是透明的——用了没感觉，但离了它不行。"

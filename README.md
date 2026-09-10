# MP-SDK

> **跨平台 JSBridge SDK 框架** — 为 Android / HarmonyOS / Web / iOS 四端提供统一的 WebView 双向通信与数据同步能力。

[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20HarmonyOS%20%7C%20Web%20%7C%20iOS-blue)]()
[![build](https://github.com/AndroidFDYB/awesome-web-sdk/actions/workflows/build.yml/badge.svg)](https://github.com/AndroidFDYB/awesome-web-sdk/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

---

## 项目简介

MP-SDK 是一套面向金融/会员业务场景的跨平台 JSBridge SDK。它以 **Protocol Buffers** 作为唯一真相源（Single Source of Truth），驱动四端代码自动生成，实现 **零运行时依赖** 的前端 SDK、**编译期注解处理** 的 Android SDK、**低侵入工具注入** 的鸿蒙 SDK、以及 **源码级对齐** 的 iOS SDK（Objective-C + CocoaPods）。

### 核心特性

- **Proto 驱动 Codegen**：单一 `.proto` 文件定义数据通道，四端自动生成注解/装饰器/常量/setter/方法映射
- **等待唤醒数据同步**：解决 Native→Web 大数据量传递的时序问题，请求自动阻塞直到数据就绪
- **AppLink Scheme 跳转**：统一 Scheme 协议，四端一致的页面跳转能力
- **跨 WebView 事件路由**：四级消息格式（`container:scope:model:event`），Native 路由器实现跨 WebView emitter 通信
- **零运行时前端依赖**：自动检测平台，无需 `protobuf.js` 或 `dsbridge` 包
- **Android 编译期注入**：KSP 扫描 `@Needs*` 注解，无运行时反射开销
- **鸿蒙低侵入集成**：原生 Web 组件 + 静态工具类，页面完全掌控配置
- **横向扩展**：新增通道只需在 proto 中添加一个 message

---

## 功能模块

| 模块 | Android | 鸿蒙 | iOS | 前端 SDK | 说明 |
|------|---------|------|-----|----------|------|
| **Bridge** | `MPBridgeWebView` | `JSBridgeManager` | `MPJSBridgeManager` | `bridge.ts` | 平台检测 + 双协议适配（Android WebViewJavascriptBridge / 鸿蒙 dsBridge） |
| **DataSync** | `MPDataSyncHelper` + KSP 注解 | `DataSyncHelper` | `MPDataSyncHelper` | `data-sync/` | 等待唤醒数据同步，Proto 驱动，四端自动生成通道 |
| **AppLink** | `applink/` 子包 | `applink/` 目录 | `AppLink/` 目录 | `app-link/` 目录 | Scheme 协议解析与页面跳转，统一 `mpapp://` 前缀 |
| **Emitter** | `emitter/` 子包 | `emitter/` 目录 | `Emitter/` 目录 | `emitter/` 目录 | 跨 WebView 事件路由，四级消息格式 `container:scope:model:event` |

---

## 架构概览

### Codegen 流程

```
┌─────────────────────────────────────────────────────────────┐
│                  specs/proto/channels.proto                 │
│                    (唯一真相源 - Proto 文件)                   │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  Android     │   │  Vue Web    │   │  HarmonyOS  │
    │  Codegen     │   │  Codegen    │   │  Codegen    │
    │ (Gradle Task │   │ (Vite 插件) │   │ (Node.js    │
    │  + KSP)      │   │             │   │  脚本)      │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                  │                  │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  AAR 产物    │   │  TGZ 产物   │   │  HAR 产物    │
    │  :library    │   │  ESM + CJS  │   │  ArkTS      │
    │  + :and_web  │   │  零依赖     │   │  + bridge.js│
    │  + :data-sync│   │             │   │             │
    │  -processor  │   │             │   │             │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### 功能模块架构

```
┌───────────────────────────────────────────────────────────────────────┐
│                            MP-SDK 功能模块                              │
├───────────┬───────────────┬───────────────┬───────────────────────────┤
│  Bridge   │  DataSync     │  AppLink      │  Emitter                  │
│  (通信核心) │  (数据同步)    │  (Scheme 跳转) │  (跨 WebView 事件路由)     │
│  平台检测  │  等待唤醒机制  │  URL 解析     │  四级消息格式              │
│  双协议适配 │  Proto 驱动   │  页面跳转     │  Native 路由分发           │
└─────┬─────┴───────┬───────┴───────┬───────┴───────────┬──────────────┘
      │             │               │                   │
      └─────────────┴───────────────┴───────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
        │  Android   │  │  Vue Web  │  │ HarmonyOS │
        │  SDK (AAR) │  │  SDK (TGZ)│  │  SDK (HAR) │
        └───────────┘  └───────────┘  └───────────┘
```

### Emitter 跨 WebView 通信流程

```
WebViewForVip                          WebViewForLoan
┌─────────────────┐                   ┌─────────────────┐
│  Vue App (VIP)   │                   │  Vue App (Loan) │
│       │          │                   │       │         │
│  emitter.emit(   │     postToNative  │       │         │
│  'loan:buy:      ├──────────────────▶│       │         │
│   success:done') │                   │       │         │
│       ▲          │                   │       │         │
│       │          │     postToWeb     │       ▼         │
│       │          │◀──────────────────┤  emitter.dispatch│
│       │          │                   │  (loan:buy:...) │
│  emitter.on(     │                   │                 │
│  'loan:buy:      │                   └─────────────────┘
│   success:done') │                          ▲
└─────────────────┘                          │
                                             │
                    ┌────────────────┐       │
                    │  Native 端     │───────┘
                    │  MPEventRouter │
                    │  / EventRouter │
                    │  (路由分发)     │
                    └────────────────┘
```

---

## 工程结构

```
mp_sdk/
├── openspec/                      # OpenSpec 规范驱动开发体系
│   ├── specs/                     # 行为规范真相源（六大能力域）
│   │   ├── bridge/spec.md         # Bridge 通信规范
│   │   ├── data-sync/spec.md      # DataSync 数据同步规范
│   │   ├── applink/spec.md        # AppLink 跳转规范
│   │   ├── emitter/spec.md        # Emitter 跨 WebView 事件路由规范
│   │   ├── codegen/spec.md        # Codegen 代码生成规范
│   │   └── build/spec.md          # Build 构建体系规范
│   ├── changes/                   # 变更提案（增量合并回主规范）
│   └── config.yaml                # Artifact 写作规则与项目上下文
│
├── specs/                        # 规范与设计文档
│   ├── proto/
│   │   ├── channels.proto          # SDK 标准数据通道（唯一真相源）
│   │   └── custom/                 # 集成方扩展通道（可选）
│   ├── proto-codegen/              # 共享 TS Proto 解析器
│   ├── Design.md                   # 架构设计文档
│   └── Wiki.md                     # 架构变更记录
│
├── docs/ai/                       # AI 协作规范
│   ├── workflow.md                 # 开发工作流规范（三路径分类）
│   └── harness.md                  # Harness 军团编排规范（SubAgent + 测试分层）
│
├── AGENTS.md                      # AI 协作总纲（三体系导航 + 行为红线）
│
├── android/                        # Android SDK 工程
│   ├── library/                    # JsBridge 源码模块（Java）
│   ├── and_web_library/            # Android SDK 模块（Kotlin → AAR）
│   │   └── src/main/java/com/sharknade/and_web_library/
│   │       ├── MPBridgeWebView.kt  # WebView + JSBridge 核心
│   │       ├── MPBridgeConfig.kt   # 全局配置
│   │       ├── MPDataSync.kt       # 数据同步核心
│   │       ├── applink/            # ├ AppLink Scheme 跳转模块
│   │       │   ├── AppLinkParams.kt
│   │       │   ├── AppLinkParser.kt
│   │       │   └── AppLinkHandler.kt
│   │       └── emitter/            # └ 跨 WebView 事件路由模块
│   │           └── MPEventRouter.kt
│   ├── data-sync-processor/        # KSP 注解处理器（纯 JVM）
│   ├── proto-codegen/              # Proto 解析器（纯 JVM）
│   └── app/                        # 示例应用
│
├── hm/                             # 鸿蒙 SDK 工程
│   └── hm_web_library/             # 鸿蒙 SDK 模块（ArkTS → HAR）
│       └── src/main/ets/
│           ├── bridge/             # JSBridge 通信核心
│           │   ├── JSBridge.ets
│           │   ├── BridgeHandler.ets
│           │   ├── BridgeModels.ets
│           │   ├── DataSyncHelper.ets
│           │   └── DsBridgeProxy.ets
│           ├── applink/            # ├ AppLink Scheme 跳转模块
│           │   ├── AppLinkParams.ets
│           │   ├── AppLinkParser.ets
│           │   └── AppLinkHandler.ets
│           └── emitter/            # └ 跨 WebView 事件路由模块
│               └── EventRouter.ets
│
├── ios/                            # iOS SDK 工程
│   └── ios_web_library/            # iOS SDK 模块（Objective-C → CocoaPods 源码 pod）
│       ├── Bridge/                 # JSBridge 通信核心
│       ├── AppLink/                # AppLink Scheme 跳转模块
│       ├── Emitter/                # 跨 WebView 事件路由模块
│       ├── Components/             # WebView 容器组件
│       ├── Generated/              # Proto codegen 生成产物
│       ├── Resources/              # 注入脚本（bridge.js）
│       └── ios-web-library.podspec # CocoaPods 发布配置
│
├── vue-web-sdk/                    # 前端 SDK（TypeScript → TGZ）
│   └── src/
│       ├── bridge.ts               # 核心：平台检测 + 双协议适配
│       ├── platform.ts             # 平台检测
│       ├── types.ts                # 类型定义
│       ├── data-sync/              # 数据同步中间件
│       ├── app-link/               # ├ AppLink Scheme 跳转模块
│       │   ├── index.ts
│       │   └── types.ts
│       ├── emitter/                # └ 跨 WebView 事件路由模块
│       │   ├── emitter.ts
│       │   ├── types.ts
│       │   └── index.ts
│       └── proto-plugin/          # Vite Proto Codegen 插件
│
├── vue-web/                        # 前端示例应用（Vue 3 + Vite）
├── scripts/                        # 跨平台构建脚本
├── .github/workflows/build.yml     # CI 流水线（四 job 并行）
└── output/                         # 构建产物输出
```

---

## 快速开始

### 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | ≥ 18 |
| JDK | ≥ 21 |
| Gradle | 9.2.1（Wrapper 自带） |
| DevEco Studio | 最新版（鸿蒙构建需要） |
| Android Studio | 最新版（Android 开发） |
| Xcode | ≥ 14（**可选**，仅 iOS 侧编译验证 `pod lib lint` 与集成开发需要，macOS） |
| CocoaPods | ≥ 1.10（**可选**，iOS 编译验证与集成） |

> `npm run build:ios` 为纯 Node 流程（codegen + 源码完整性校验 + 打包），Windows / Linux / macOS 均可执行，**不需要 macOS 与 Xcode**；仅 `build:harmony` 必须本机 DevEco Studio。CI 侧固定 Node 22。

### 安装依赖

```bash
npm run install:all
```

### 构建全部产物

```bash
npm run build:all
```

产物输出至 `output/` 目录：

```
output/
├── android/and_web_library-release.aar    # Android SDK
├── harmony/hm_web_library.har            # 鸿蒙 SDK
├── ios/ios_web_library-1.0.0.zip         # iOS SDK（CocoaPods 源码 pod）
└── web/mp-sdk-bridge-1.0.0.tgz           # 前端 SDK
```

### 单独构建

```bash
npm run build:proto       # 构建共享 Proto 解析器
npm run build:android     # 仅 Android
npm run build:harmony     # 仅鸿蒙（需 DEVECO_HOME 环境变量）
npm run build:ios         # 仅 iOS（proto codegen + zip 打包）
npm run build:web         # 仅前端 SDK
```

---

## CI 自动构建

推送版本标签（`v*`）后，GitHub Actions 自动构建四端并产出制品（[运行记录](https://github.com/AndroidFDYB/awesome-web-sdk/actions/workflows/build.yml)）：

| Job | Runner | 执行内容 | 制品 |
|-----|--------|----------|------|
| `web` | ubuntu-latest | `npm ci`（根 + vue-web-sdk）→ `build:web` | `web-tgz` |
| `ios` | ubuntu-latest | `npm ci` → `build:ios` → `unzip -t` 完整性校验 | `ios-zip` |
| `android` | ubuntu-latest + JDK 21 | `npm ci` → Gradle 缓存 → `build:android` | `android-aar` |
| `harmony-codegen` | ubuntu-latest | `codegen:harmony` + `scan:harmony` + 生成物非空断言 | 无 |
| `publish-ios` | ubuntu-latest | 校验 podspec 版本 == tag → 推送 podspec 至私有 spec repo | 无（发布到 spec repo） |

- 流水线由 **版本标签（`v*`）触发**，日常 push 不运行 CI；可在 Actions 页手动触发（`workflow_dispatch`）
- 四个 build job 并行且**互不声明依赖**：单端失败不影响其余端制品产出
- `publish-ios` 依赖 `ios` job 成功后执行，仅处理 iOS podspec 发布
- 制品保留 90 天，在对应运行页的 **Artifacts** 区下载

> **鸿蒙边界说明**：`harmony-codegen` 仅校验 proto → ArkTS 生成链路（DevEco Studio / hvigor 工具链在公共 runner 不可得），**不代表 HAR 可构建**。HAR 的可构建性仍以本地 `npm run build:harmony` 为准。

> **iOS 说明**：iOS SDK 以 CocoaPods 源码 pod 形式发布，构建过程为 codegen + 源码完整性校验 + 打包，**无编译步骤**，故制品在 Linux runner 产出；如需编译验证（`pod lib lint`）请在 macOS 侧自行执行。

---

## 使用方式

### 前端 SDK

```typescript
import { bridge, setupDataSyncHandlers, waitUserInfoSync } from '@mp-sdk/bridge';
import axios from 'axios';

// 初始化数据同步
setupDataSyncHandlers();

class LoanApi {
  // 装饰器标记：此方法需要等待 userInfo 数据就绪
  @waitUserInfoSync
  async getUserProfile() {
    return axios.get('/api/user/profile');
    // 拦截器自动将 uid/ticket 注入 headers
  }
}
```

### Android SDK

```kotlin
@NeedsUserInfo
@NeedsLoanInfo
class LoanActivity : AppCompatActivity() {
    private lateinit var webView: MPBridgeWebView
    private lateinit var dataSyncHelper: MPDataSyncHelper

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = MPBridgeWebView(this)
        val channels = DataSyncBindings.getChannels(this.javaClass.name)
        dataSyncHelper = MPDataSyncHelper.create(webView, channels)
        webView.loadBridgeUrl("https://your-page.com")
        dataSyncHelper.setUserInfo("""{"uid":"123","ticket":"abc"}""")
    }
}
```

### 鸿蒙 SDK

```typescript
import { JSBridgeManager, DataSyncHelper, DsBridgeProxy, BridgeUtils, DataSyncChannel } from 'hm_web_library';

// 在 Page 中使用原生 Web 组件
const bridgeManager = new JSBridgeManager(true);
const dataSyncHelper = new DataSyncHelper(bridgeManager, [DataSyncChannel.USER_INFO], true);
const dsBridgeProxy = new DsBridgeProxy(bridgeManager);

Web({ src: url, controller: controller })
  .javaScriptProxy({ object: dsBridgeProxy, name: '_dsbridge', ... })
```

### iOS SDK

```objc
#import <MPWebLibrary.h>

@interface LoanViewController () <MPAppLinkActionDelegate>
@property (nonatomic, strong) MPBridgeWebViewController *webVC;
@property (nonatomic, strong) MPJSBridgeManager *bridgeManager;
@property (nonatomic, strong) MPDataSyncHelper *dataSyncHelper;
@property (nonatomic, strong) MPAppLinkHandler *appLinkHandler;
@end

@implementation LoanViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    // 1. 创建 WebView 容器（自动注入 bridge.js + 追加 platform=ios）
    self.webVC = [[MPBridgeWebViewController alloc] initWithUrl:@"https://your-page.com"];

    // 2. 桥接管理器 + 数据同步
    self.bridgeManager = [[MPJSBridgeManager alloc] initWithWebView:self.webVC.webView];
    self.dataSyncHelper = [[MPDataSyncHelper alloc] initWithBridgeManager:self.bridgeManager
                                                         requiredChannels:@[MPDataSyncChannelUserInfo]];
    [self.dataSyncHelper setUserInfo:@"{\"uid\":\"123\",\"ticket\":\"abc\"}"];

    // 3. AppLink 跳转（SDK 强制 .overFullScreen，delegate 负责创建和展示）
    self.appLinkHandler = [[MPAppLinkHandler alloc] initWithBridgeManager:self.bridgeManager
                                                                 delegate:self
                                                                    debug:YES];
}

#pragma mark - MPAppLinkActionDelegate

- (UIViewController *)createViewControllerForPage:(MPAppLinkParams *)params {
    // 创建 VC（SDK 会自动设置 .overFullScreen + .crossDissolve 用于透明弹窗）
    if ([MPAppLinkParams isTransparentPage:params]) {
        return [[TransparentPopupVC alloc] initWithURL:params.url];
    }
    return [self pageForName:params.pageName];
}

- (void)presentConfiguredViewController:(UIViewController *)vc
                               animated:(BOOL)animated
                             completion:(void (^)(void))completion {
    // 展示 VC（透明弹窗时 SDK 已设置 .overFullScreen，直接 present）
    if (vc.modalPresentationStyle == UIModalPresentationOverFullScreen) {
        [self presentViewController:vc animated:animated completion:completion];
    } else {
        [self.navigationController pushViewController:vc animated:animated];
    }
}

- (void)handleAction:(NSString *)actionScheme {
    // 根容器处理 sk://action=...（回首页 + 打开页面）
}

@end
```

---

## 数据同步流程

```
1. Native 页面创建 WebView + DataSyncHelper，设置业务数据
2. WebView 加载页面（URL 自动追加 ?platform=android|harmony|ios）
3. 前端 SDK 自动检测平台，初始化 Bridge 连接
4. 前端发起 HTTP 请求 → 装饰器标记所需通道 → 拦截器阻塞请求
5. Native 页面加载完成 → DataSyncHelper 推送数据 → JSBridge callHandler
6. 前端 SDK 接收数据 → DataSyncManager 唤醒等待队列
7. 拦截器注入数据到请求 → HTTP 请求发出
```

---

## 跨 WebView Emitter 通信

### 四级消息格式

```
<containerName>:<scope>:<vueModelName>:<vueEventName>
```

| 级别 | 字段 | 说明 |
|------|------|------|
| 1 | container | 目标容器：`vip` / `loan` / `lead` / `common` / `host` |
| 2 | scope | 业务域标识 |
| 3 | model | Vue 组件/模块名 |
| 4 | event | 事件名 |

### 容器名映射

| 容器名 | 目标 WebView | 说明 |
|--------|-------------|------|
| `vip` | WebViewForVip | VIP 会员页面 |
| `loan` | WebViewForLoan | 借款页面 |
| `lead` | WebViewForLead | 线索页面 |
| `common` | WebViewForCommon | 通用页面 |
| `host` | Native 端 | 直接消费，不转发 |

### 前端 SDK 使用

```typescript
import { emitter } from '@mp-sdk/bridge';

// 监听跨 WebView 事件
emitter.on('vip:vipbuy:success:two', (data) => {
  console.log('VIP 买入成功', data);
});

// 发送事件到 loan 容器
emitter.emit('loan:buy:success:done', { orderId: 123 });

// 监听 Native host 事件
emitter.on('host:notify:appState:change', (data) => {
  console.log('App 状态变化', data);
});
```

### Native SDK 使用

**Android:**
```kotlin
val eventRouter = MPEventRouter()

eventRouter.registerWebView(MPEventRouter.CONTAINER_VIP, vipWebView)
eventRouter.registerWebView(MPEventRouter.CONTAINER_LOAN, loanWebView)

eventRouter.onHostEvent { event, data ->
    Log.d("EventRouter", "Host event: $event")
}
```

**鸿蒙:**
```typescript
const eventRouter = new EventRouter(true);

eventRouter.registerWebView(EventRouter.CONTAINER_VIP, vipBridgeManager);
eventRouter.registerWebView(EventRouter.CONTAINER_LOAN, loanBridgeManager);

eventRouter.onHostEvent((event: string, data: string) => {
  console.log(`Host event: ${event}`);
});
```

---

## 扩展数据通道

新增通道只需 3 步：

1. 在 `specs/proto/channels.proto` 中添加 message：
   ```protobuf
   message OrderInfo {
     string orderId = 1;
     double amount = 2;
   }
   ```

2. 运行构建（codegen 自动生成四端代码）：
   ```bash
   npm run build:all
   ```

3. 使用自动生成的 API：
   - Android: `@NeedsOrderInfo` + `helper.setOrderInfo(data)`
   - Vue: `@waitOrderInfoSync` + `OrderInfo` 接口
   - 鸿蒙: `DataSyncChannel.ORDER_INFO` + `helper.setOrderInfo(data)`
   - iOS: `MPDataSyncChannelOrderInfo` + `[helper setOrderInfo:data]`

> **无需修改任何 SDK 源码**，四端代码全自动生成。

---

## 技术栈

| 平台 | 技术 | 关键版本 |
|------|------|----------|
| Android | Kotlin + KSP + JsBridge | AGP 9.0.1, Gradle 9.2.1, Kotlin 2.2.10 |
| HarmonyOS | ArkTS + hvigor | DevEco Studio 内置 |
| iOS | Objective-C + WKWebView | Xcode 14+, iOS 12.0+, CocoaPods |
| Web SDK | TypeScript + Vite | Vite 5.4, TS 5.6 |
| Codegen | Protocol Buffers (Schema) | proto3, 运行时 JSON 传输 |
| 共享解析器 | TypeScript (CommonJS) | `@mp-sdk/proto-codegen` |

---

## 文档索引

### 行为规范（OpenSpec 体系）

| 文档 | 路径 | 说明 |
|------|------|------|
| Bridge 通信规范 | `openspec/specs/bridge/spec.md` | 平台检测、双协议适配、零依赖 |
| DataSync 规范 | `openspec/specs/data-sync/spec.md` | 等待唤醒、通道真相源、扩展通道 |
| AppLink 规范 | `openspec/specs/applink/spec.md` | Scheme 协议、跳转执行、结果状态码 |
| Emitter 规范 | `openspec/specs/emitter/spec.md` | 四级消息格式、容器路由 |
| Codegen 规范 | `openspec/specs/codegen/spec.md` | 命名推导、语法子集、传输编码 |
| Build 规范 | `openspec/specs/build/spec.md` | 统一入口、产物形态、验证标准 |

### 架构与 AI 协作

| 文档 | 路径 | 说明 |
|------|------|------|
| 架构设计 | `specs/Design.md` | 完整的架构决策、模块依赖、API 参考 |
| 变更记录 | `specs/Wiki.md` | 架构演进与关键决策历史 |
| AI 协作总纲 | `AGENTS.md` | 三体系导航 + 行为红线 |
| 开发工作流 | `docs/ai/workflow.md` | Spike/Bounded/Architectural 三路径 |
| Harness 编排 | `docs/ai/harness.md` | SubAgent 军团 + L1-L4 测试分层 |

---

## 环境配置

### Android

```bash
# gradle.properties 关键配置
android.disallowKotlinSourceSets=false
android.sourceset.disallowProvider=false
```

### 鸿蒙

```bash
# 环境变量
export DEVECO_HOME=/path/to/DevEcoStudio
export HOS_SDK_HOME=/path/to/HarmonyOS-SDK
```

### iOS

```bash
# 构建源码包：无需 macOS（纯 Node 流程，三平台均可）
npm run build:ios                         # → output/ios/ios_web_library-1.0.0.zip

# 以下仅编译验证与集成时需要（macOS）
xcode-select --install                    # 安装 Xcode 命令行工具
```

**CocoaPods 集成（标准方式）**：

```bash
# 首次配置：添加私有 spec repo（一次性）
pod repo add mp-specs https://github.com/AndroidFDYB/Specs.git

# Podfile 中引用
source 'https://github.com/AndroidFDYB/Specs.git'
source 'https://cdn.cocoapods.org/'

pod 'ios_web_library', '~> 1.0'

# 安装
pod install
```

**本地开发集成**（覆盖远程 source，使用本地路径）：

```ruby
pod 'ios_web_library', :path => './ios_web_library'
```

### 发版流程

iOS SDK 通过 git tag 触发 CI 自动发布至私有 CocoaPods spec repo：

```bash
# 1. 更新 podspec 版本号
#    编辑 ios/ios_web_library/ios-web-library.podspec，修改 s.version = 'x.y.z'

# 2. 提交变更
git add ios/ios_web_library/ios-web-library.podspec
git commit -m "chore: bump ios_web_library to x.y.z"
git push

# 3. 打 tag 并推送（触发 CI 构建 + 发布）
git tag vx.y.z
git push --tags
```

CI 会自动：构建四端制品 → 校验 podspec 版本与 tag 一致 → 推送 podspec 至 `AndroidFDYB/Specs`。

### 维护者：发布基础设施配置（一次性）

首次启用发布流水线前，需完成以下配置：

1. **创建私有 spec repo**：在 GitHub 创建 `AndroidFDYB/Specs` 私有仓库（可初始化 README）
2. **创建 PAT（Classic）**：GitHub → Settings → Developer settings → Tokens (classic) → Generate new token，勾选 `repo` scope（最小权限，仅覆盖私有仓库读写）
3. **添加 Secret（注意仓库归属）**：在 **SDK 仓库（`awesome-web-sdk`）** 的 Settings → Secrets and variables → Actions → New repository secret 中添加 `SPEC_REPO_TOKEN`，值为上一步的 token

> **易错点**：Secret 必须添加到 **`awesome-web-sdk` 仓库**，而非 `Specs` 仓库——GitHub Actions 的 secret 仅对 workflow 所在仓库可见，加错仓库时 `${{ secrets.SPEC_REPO_TOKEN }}` 会被静默替换为空串，`git clone` 以 exit code 128 失败。publish-ios job 内置了空值防御与明确报错，遇到 `SPEC_REPO_TOKEN is empty` 时请检查 Secret 的仓库归属。

### 通用

- 构建脚本使用 Node.js 跨平台语法，不使用 PowerShell 专有命令，也不硬编码单一操作系统的可执行入口
- shell 脚本（如 `android/gradlew`）在 git 索引中须具备可执行位 `100755`（`git update-index --chmod=+x <path>`）
- 所有构建入口统一在根目录 `package.json` 的 npm scripts，CI 与本地执行同一命令
- CI 固定 Node 22（npm 11 的 install-scripts 机制会拦住 `esbuild` 的 postinstall 使 vite 构建失败）

---

## License

Proprietary — 内部项目，请勿外传。

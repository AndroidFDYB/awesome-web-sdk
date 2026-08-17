# MP-SDK 架构设计文档

> 跨平台 JSBridge SDK 工程的架构决策、模块划分、通信协议与构建体系说明。

---

## 1. 工程概述

MP-SDK 是一套跨平台 JSBridge SDK 框架，为业务方提供 WebView 容器 + JSBridge 双向通信通道。三端各自产出独立的 SDK 产物，通过统一的前端 SDK 实现跨平台适配。

| 平台 | 工程模块 | 产物 | 技术方案 |
|------|----------|------|----------|
| Android | `android/and_web_library` | AAR | 本地 `:library` 模块（JsBridge 源码） + MPBridgeWebView 封装 |
| 鸿蒙 | `hm/hm_web_library` | HAR | 官方 Web 组件 `javaScriptProxy` + 自定义 JSBridgeManager |
| 前端 | `vue-web-sdk` | TGZ (npm) | Vite 库模式，零运行时依赖，自动检测平台，业务数据等待唤醒中间件 |

---

## 2. 架构决策

### 2.1 Android JsBridge 选型变更

- **初始方案**：使用 DSBridge-Android（wendux）
- **问题**：DSBridge-Android 已停止维护，且 JitPack 远程依赖存在解析不稳定问题
- **最终方案**：采用 happydog-intj/JsBridge（lzyzsd/JsBridge 的活跃 fork），将源码作为本地 Gradle `:library` 模块集成
- **优势**：源码可控、无远程依赖风险、可按需修改 API

### 2.2 鸿蒙 JSBridge 实现

- **方案**：使用鸿蒙官方 Web 组件的 `javaScriptProxy` 注入机制
- **协议**：自定义 dsBridge 兼容协议，前端可直接使用 `dsBridge` 风格 API
- **注入流程**：`javaScriptProxy` 注入 `_dsbridge` 对象 → 页面加载时从 rawfile 注入 `bridge.js` → `bridge.js` 在 `window.dsBridge` 上构建用户 API

### 2.3 前端 SDK 零依赖设计

- **初始方案**：依赖 `dsbridge` npm 包
- **最终方案**：移除所有运行时依赖，SDK 内部实现双协议适配层
- **检测逻辑**：`window.WebViewJavascriptBridge` → Android；`window.__harmony_bridge + window.dsBridge` → 鸿蒙；否则纯 Web

### 2.4 构建脚本跨平台

- **约束**：不使用 PowerShell 脚本（Windows 专有）
- **方案**：根目录 `package.json` npm scripts + Node.js 辅助脚本
- **鸿蒙构建**：通过 DevEco Studio 内置 node 执行 hvigorw.js，不依赖系统 node

### 2.5 AGP 9.x 适配

- AGP 9.0.1 要求在 `build.gradle.kts` 中使用 `namespace` 替代 `AndroidManifest.xml` 的 `package` 属性
- `compileSdk` 使用新语法 `release(36) { minorApiLevel = 1 }`
- Kotlin DSL 统一管理构建配置，版本通过 `libs.versions.toml` 集中声明

---

## 3. 模块依赖关系

```
android/
├── settings.gradle.kts
│   ├── :app                    # 示例应用（不参与 SDK 产出）
│   ├── :library                # JsBridge 源码模块（Java，产出 classes.jar）
│   └── :and_web_library        # Android SDK 模块（Kotlin，产出 AAR）
│
├── :and_web_library 依赖
│   ├── project(":library")     # 本地 JsBridge 源码
│   ├── androidx.appcompat      # AppCompat 支持
│   ├── androidx.core.ktx
│   └── material
│
└── :library 依赖
    ├── androidx.appcompat
    └── gson                     # JSON 序列化（Message 模型）
```

```
hm/
└── hm_web_library               # 鸿蒙 SDK 模块（ArkTS，产出 HAR）
    ├── src/main/ets/bridge/
    │   ├── JSBridge.ets          # 核心管理器
    │   ├── BridgeHandler.ets     # Handler 接口
    │   └── BridgeModels.ets      # 数据模型
    ├── src/main/ets/components/
    │   └── MPBridgeWeb.ets       # Web 组件封装
    └── src/main/resources/rawfile/
        └── bridge.js            # JS 端注入代码
```

```
vue-web-sdk/                     # 前端 SDK（TypeScript，产出 TGZ）
├── src/
│   ├── bridge.ts                # 核心实现（平台检测 + 双协议适配）
│   ├── types.ts                # 类型定义
│   └── index.ts                # 导出入口
└── vite.config.ts              # Vite 库模式（ESM + CJS）
```

---

## 4. 通信协议

### 4.1 Android（WebViewJavascriptBridge 协议）

```
JS -> Native:
  bridge.callHandler(methodName, data, callback)
  → BridgeWebView URL scheme 拦截 (yy://)
  → BridgeHelper 消息分发
  → registerHandler 注册的 Native Handler 执行
  → callback.onCallBack(result) 回传结果

Native -> JS:
  BridgeWebView.callHandler(methodName, data, callback)
  → evaluateJavascript("javascript:WebViewJavascriptBridge._handleMessageFromNative(...)")
  → JS 端 registerHandler 注册的 Handler 执行
  → responseCallback(result) 回传结果
```

关键类：
- `BridgeWebView` — 继承 WebView，实现 JS 桥接注入、消息队列管理
- `BridgeHandler` — Native Handler 接口：`void handler(String data, OnBridgeCallback callback)`
- `OnBridgeCallback` — 回调接口：`void onCallBack(String data)`
- `BridgeWebViewClient` — 页面加载时注入 `WebViewJavascriptBridge.js`

### 4.2 鸿蒙（dsBridge 兼容协议）

```
JS -> Native:
  dsBridge.call(method, params)           → 同步调用
  dsBridge.callAsync(method, params, cb)  → 异步调用
  → window._dsbridge.call/callAsync(requestJson)   [javaScriptProxy]
  → JSBridgeManager.handleSyncCall/handleAsyncCall
  → 注册的 SyncBridgeHandler/AsyncBridgeHandler 执行
  → sendResponseToJs(callbackId, response)         [runJavaScript]

Native -> JS:
  JSBridgeManager.callJs(method, args, callback)
  → runJavaScript("window._dsBridge._handleNativeCall(request)")
  → JS 端 register/registerAsyn 注册的 Handler 执行
  → _dsbridge.onNativeCallComplete(callbackId, result)
```

数据模型：
- `BridgeRequest` — `{ callbackId, method, params }`
- `BridgeResponse` — `{ callbackId, code, data, message }`（code: 0=成功, -1=方法不存在, -2=异常）
- `NativeCallRequest` — `{ callbackId, method, params }`

### 4.3 前端 SDK 统一 API

前端 SDK（`@mp-sdk/bridge`）提供统一的跨平台 API，内部自动适配：

| API | Android 实现 | 鸿蒙实现 |
|-----|-------------|----------|
| `call(method, params)` | 不支持（仅异步），输出警告 | `dsBridge.call(method, params)` 同步返回 |
| `callAsync(method, params)` → Promise | `bridge.callHandler` + 回调转 Promise | `dsBridge.callAsync` + 回调转 Promise |
| `register(method, handler)` | `bridge.registerHandler` 包装 | `dsBridge.register` |
| `registerAsyn(method, handler)` | `bridge.registerHandler` 包装 | `dsBridge.registerAsyn` |

平台检测顺序：Android（`window.WebViewJavascriptBridge`）→ 鸿蒙（`window.__harmony_bridge + window.dsBridge`）→ 纯 Web

---

## 5. Android SDK API

### MPBridgeConfig

全局配置对象（`object` 单例）：
- `debug: Boolean` — 调试模式，输出 Logcat 日志
- `callTimeout: Long` — 异步调用超时（默认 30s）
- `LOG_TAG: String` — 日志 TAG（"MPBridge"）

### MPBridgeWebView

继承自 `BridgeWebView`，提供业务友好的 Kotlin API：

```kotlin
// 注册 Native Handler 供 JS 调用
fun registerBridgeHandler(methodName: String, handler: (String, OnBridgeCallback) -> Unit)

// 调用 JS Handler（带回调）
fun callBridgeHandler(methodName: String, data: String?, callback: OnBridgeCallback?)

// 调用 JS Handler（无参数 / 无回调 便捷重载）
fun callBridgeHandler(methodName: String, callback: OnBridgeCallback?)
fun callBridgeHandler(methodName: String, data: String?)

// 加载 URL（自动注入桥接 + 追加 ?platform=android）
fun loadBridgeUrl(url: String)

// 数据同步集成
fun getDataSyncHelper(): MPDataSyncHelper  // 懒加载获取数据同步辅助器
fun notifyPageLoaded()                     // 通知页面加载完成（在 onPageFinished 中调用）
fun notifyPageLoading()                    // 通知页面开始加载（在 onPageStarted 中调用）
```

### MPDataSyncHelper

通过注解自动检测 WebView 子类所需的数据通道，管理页面加载状态和数据推送。

```kotlin
// 注解（标记在 WebView 子类上）
@NeedsUserInfo    // 需要 userInfo 通道
@NeedsLoanInfo    // 需要 loanInfo 通道
@NeedsVipInfo     // 需要 vipInfo 通道
@NeedsDataSync("orderInfo")  // 自定义通道

// API
helper.setUserInfo(data: String)   // 设置用户信息
helper.setLoanInfo(data: String)   // 设置借款信息
helper.setVipInfo(data: String)    // 设置会员信息
helper.setData(channel, data)      // 设置指定通道数据
helper.notifyPageLoaded()          // 通知页面加载完成，触发推送
helper.isAllDataSynced(): Boolean   // 检查是否全部同步完成
helper.reset()                      // 重置状态
```

---

## 6. 鸿蒙 SDK API

### JSBridgeManager

```typescript
// 注册 Handler
registerHandler(method: string, handler: SyncBridgeHandler): void
registerAsyncHandler(method: string, handler: AsyncBridgeHandler): void

// Native 调用 JS
callJs(method: string, args?: Object[], callback?: (result: string) => void): void

// 内部方法（供 javaScriptProxy 调用）
handleSyncCall(requestJson: string): string
handleAsyncCall(requestJson: string): string
hasMethod(method: string): boolean
onNativeCallComplete(callbackId: string, result: string): void
```

### MPBridgeWeb 组件

```typescript
@Entry
@Component
struct MyPage {
  private bridgeManager: JSBridgeManager = new JSBridgeManager(true);
  private dataSyncHelper: DataSyncHelper = new DataSyncHelper(
    this.bridgeManager,
    [DataSyncChannel.USER_INFO, DataSyncChannel.LOAN_INFO],
    true
  );
  @Link controller: webview.WebviewController;

  build() {
    MPBridgeWeb({
      bridgeManager: this.bridgeManager,
      url: 'https://your-page.com',  // 自动追加 ?platform=harmony
      debug: true,
      dataSyncHelper: this.dataSyncHelper,
      controller: this.controller
    })
  }
}
```

### DataSyncHelper

鸿蒙端数据同步辅助器，与 Android 端 MPDataSyncHelper 功能对等，不使用注解。

```typescript
// 构造函数
new DataSyncHelper(bridgeManager, requiredChannels, debug)

// 设置业务数据
helper.setUserInfo(data: string)
helper.setLoanInfo(data: string)
helper.setVipInfo(data: string)
helper.setData(channel: string, data: string)

// 页面状态通知（由 MPBridgeWeb 自动调用）
helper.notifyPageLoaded()
helper.notifyPageLoading()

// 状态查询
helper.isAllDataSynced(): boolean
helper.getSyncState(): SyncState
```

---

## 7. 前端 SDK API

```typescript
import { bridge, getBridge } from '@mp-sdk/bridge'

// 获取平台
bridge.getPlatform()  // 'android' | 'harmony' | 'web'

// 调用 Native（异步，推荐）
const result = await bridge.callAsync('getUserInfo', { userId: 123 })

// 调用 Native（同步，仅鸿蒙支持）
const data = bridge.call('getConfig')

// 注册 JS 方法供 Native 调用
bridge.register('onPageReady', (params) => {
  return { status: 'ok' }
})
bridge.registerAsyn('onDataUpdate', (params, complete) => {
  fetchData().then(data => complete(data))
})

// 检测环境
bridge.hasNativeBridge()  // true if in WebView
bridge.hasMethod('getUserInfo')
```

---

## 8. 构建体系

### 8.1 命令总览

```bash
npm run install:all      # 安装所有依赖
npm run build:android    # 产出 AAR → output/android/
npm run build:harmony    # 产出 HAR → output/harmony/
npm run build:web        # 产出 TGZ → output/web/
npm run build:all        # 产出全部
```

### 8.2 Android 构建

```
npm run build:android
  → cd android && gradlew.bat :and_web_library:assembleRelease
  → node scripts/post-build.js android
  → output/android/and_web_library-release.aar
```

- Gradle 9.2.1 + AGP 9.0.1
- Kotlin DSL（build.gradle.kts）
- 版本目录：`gradle/libs.versions.toml`
- 模块：`:library`（JsBridge 源码） → `:and_web_library`（SDK 封装）

### 8.3 鸿蒙构建

```
npm run build:harmony
  → node scripts/build-harmony.js
    → DevEco Studio/tools/node/node.exe
    → DevEco Studio/tools/hvigor/bin/hvigorw.js
    → --mode module -p module=hm_web_library@default assembleHar
  → node scripts/post-build.js harmony
  → output/harmony/hm_web_library.har
```

- 使用 DevEco Studio 内置 node（不依赖系统 node）
- 环境变量：`DEVECO_HOME`（DevEco 安装路径）、`HOS_SDK_HOME`（鸿蒙 SDK 路径）

### 8.4 前端 SDK 构建

```
npm run build:web
  → cd vue-web-sdk && npm run build (vite build + vue-tsc --declaration)
  → npm pack
  → node scripts/post-build.js web
  → output/web/mp-sdk-bridge-1.0.0.tgz
```

- Vite 库模式：ESM（`mp-bridge.js`）+ CJS（`mp-bridge.cjs`）
- 类型声明：`vite-plugin-dts` 自动生成 `.d.ts`
- 零运行时依赖

### 8.5 产物输出

```
output/
├── android/and_web_library-release.aar
├── harmony/hm_web_library.har
└── web/mp-sdk-bridge-1.0.0.tgz
```

---

## 9. 关键文件清单

### Android
| 文件 | 职责 |
|------|------|
| `android/settings.gradle.kts` | 模块声明：app, library, and_web_library |
| `android/gradle/libs.versions.toml` | 版本目录（AGP, Kotlin, Gson 等） |
| `android/library/build.gradle.kts` | JsBridge 源码模块构建配置 |
| `android/library/src/.../BridgeWebView.java` | WebView 继承类，桥接核心 |
| `android/library/src/.../BridgeHelper.java` | 桥接辅助类，消息队列管理 |
| `android/library/src/.../BridgeHandler.java` | Native Handler 接口 |
| `android/library/src/.../OnBridgeCallback.java` | 回调接口 |
| `android/library/src/.../BridgeWebViewClient.java` | WebViewClient，JS 注入 |
| `android/library/src/.../WebViewJavascriptBridge.js` | 注入 WebView 的 JS 桥接脚本 |
| `android/and_web_library/build.gradle.kts` | SDK 模块构建配置 |
| `android/and_web_library/.../MPBridgeWebView.kt` | 业务封装 WebView + 平台参数 + 数据同步集成 |
| `android/and_web_library/.../MPBridgeConfig.kt` | 全局配置 |
| `android/and_web_library/.../MPDataSync.kt` | 注解 + 通道常量 + MPDataSyncHelper 状态管理器 |

### 鸿蒙
| 文件 | 职责 |
|------|------|
| `hm/hm_web_library/src/.../components/MPBridgeWeb.ets` | Web 组件封装 + 平台参数 + 数据同步集成 |
| `hm/hm_web_library/src/.../bridge/JSBridge.ets` | 桥接管理器，Handler 注册与分发 |
| `hm/hm_web_library/src/.../bridge/BridgeHandler.ets` | Handler 接口定义 |
| `hm/hm_web_library/src/.../bridge/BridgeModels.ets` | 数据模型（Request/Response） |
| `hm/hm_web_library/src/.../bridge/DataSyncHelper.ets` | 通道常量 + DataSyncHelper 状态管理器 |
| `hm/hm_web_library/src/main/resources/rawfile/bridge.js` | JS 端注入代码（window.dsBridge） |

### 前端
| 文件 | 职责 |
|------|------|
| `vue-web-sdk/src/bridge.ts` | 核心实现：平台检测 + 双协议适配 + 单例管理 + 数据同步 Handler |
| `vue-web-sdk/src/types.ts` | 类型定义：IMPBridge, IAndroidJsBridge, IHarmonyBridge |
| `vue-web-sdk/src/index.ts` | 导出入口 |
| `vue-web-sdk/src/platform.ts` | URL 平台检测 |
| `vue-web-sdk/src/data-sync/types.ts` | 数据同步类型与常量 |
| `vue-web-sdk/src/data-sync/manager.ts` | 多通道数据同步管理器 |
| `vue-web-sdk/src/data-sync/interceptor.ts` | Axios 请求拦截器 |
| `vue-web-sdk/src/data-sync/decorators.ts` | 方法装饰器 |
| `vue-web-sdk/vite.config.ts` | Vite 库模式构建配置 |

### 构建 & 协议
| 文件 | 职责 |
|------|------|
| `package.json` | 根目录 npm scripts |
| `scripts/post-build.js` | 产物收集到 output/ |
| `scripts/build-harmony.js` | 鸿蒙 HAR 构建（DevEco node + hvigor） |
| `specs/bridge-protocol.ts` | 三端共享协议定义 |
| `specs/propersal.md` | 需求文档 |

---

## 10. 业务数据等待唤醒中间件

### 10.1 概述

前端 SDK 新增「等待唤醒」数据同步中间件，解决 WebView 容器中 Native → Web 大数据量传递的时序问题。核心场景：前端页面加载后发起的 HTTP 请求需要携带 Native 端的业务数据（uid/ticket/借款信息/会员信息等），但数据到达时机不确定。

### 10.2 三层架构

| 层 | 职责 | 文件 |
|---|---|---|
| DataSyncManager | 多通道数据同步管理器，独立队列/缓存/超时控制 | `src/data-sync/manager.ts` |
| Axios 拦截器 | 请求拦截，等待数据就绪后注入 headers/params/body | `src/data-sync/interceptor.ts` |
| 装饰器 | `@waitUserInfoSync` 等方法级装饰器，标记 API 方法所需通道 | `src/data-sync/decorators.ts` |

### 10.3 数据流

```
Native (Android/HarmonyOS)
  → JSBridge callHandler/callJs("syncUserInfo", data)
  → bridge.ts 自动注册的 Handler 接收
  → DataSyncManager.pushData("userInfo", data)  // 唤醒等待队列
  → Axios 拦截器检测到数据就绪
  → 注入请求配置（headers: X-Uid/X-Ticket 或 body 合并）
  → 发送被阻塞的 HTTP 请求
```

### 10.4 标准数据通道

| 通道名 | Native 方法名 | 注入位置 | 说明 |
|---|---|---|---|
| userInfo | syncUserInfo | headers | uid → X-Uid, ticket → X-Ticket |
| loanInfo | syncLoanInfo | body | 借款信息合并到请求体 |
| vipInfo | syncVipInfo | body | 会员信息合并到请求体 |

### 10.5 两种触发模式

1. **装饰器模式**：`@waitUserInfoSync` 标记的方法，装饰器预先等待数据并设置上下文栈，拦截器从栈顶读取通道
2. **路由模式**：配置 `routes: { '/api/loan/*': ['userInfo', 'loanInfo'] }`，拦截器根据 URL 匹配自动等待

### 10.6 平台检测增强

| 优先级 | 检测方式 | 实现 |
|---|---|---|
| 1 | URL 查询参数 `?platform=android` | `detectPlatformFromUrl()` |
| 2 | Window 对象检测 | `detectPlatformFromWindow()` |
| 3 | 默认 | 返回 `'web'` |

### 10.7 解耦设计

- SDK 提供机制，不含业务逻辑
- Android: `MPBridgeWebView.callBridgeHandler("syncUserInfo", dataJson)`
- 鸿蒙: `JSBridgeManager.callJs("syncUserInfo", [dataJson])`
- 主模块（WebViewForLoan/WebViewForVip/WebViewForThird）仅调用标准方法
- SDK 自动注册 Native→JS Handler，主模块无需关心前端接收逻辑

### 10.8 Native 端数据同步实现

#### Android 端（注解 + 反射）

| 文件 | 职责 |
|------|------|
| `MPDataSync.kt` | 注解定义 + 通道常量 + `MPDataSyncHelper` 状态管理器 |
| `MPBridgeWebView.kt` | URL 平台参数注入 + `getDataSyncHelper()` / `notifyPageLoaded()` 集成 |

**注解体系：**

| 注解 | 通道 | JSBridge 方法 |
|------|------|---------------|
| `@NeedsUserInfo` | userInfo | syncUserInfo |
| `@NeedsLoanInfo` | loanInfo | syncLoanInfo |
| `@NeedsVipInfo` | vipInfo | syncVipInfo |
| `@NeedsDataSync(channel)` | 自定义 | sync{Channel} |

**主模块使用方式：**
```kotlin
@NeedsUserInfo
@NeedsLoanInfo
class WebViewForLoan(context: Context, attrs: AttributeSet) : MPBridgeWebView(context, attrs)

// Activity 中
webView.loadBridgeUrl("https://example.com/loan")  // 自动追加 ?platform=android
webView.getDataSyncHelper().setUserInfo("""{"uid":"123","ticket":"abc"}""")
webView.getDataSyncHelper().setLoanInfo("""{"loanId":"L001","amount":50000}""")
// WebViewClient.onPageFinished 中调用
webView.notifyPageLoaded()  // 自动推送已就绪数据
```

**MPDataSyncHelper 内部机制：**
- 构造时通过反射读取 WebView 子类继承链上的注解，确定所需通道
- 管理 `SyncState` 状态机：IDLE → LOADING → LOADED → SYNCED
- `setData()` 设置通道数据，页面已加载时立即推送
- `notifyPageLoaded()` 触发 `pushPendingData()`，推送所有已就绪未推送的通道
- 通过 `webView.callBridgeHandler(methodName, data)` 推送到 JS

#### 鸿蒙端（直接引入）

| 文件 | 职责 |
|------|------|
| `DataSyncHelper.ets` | 通道常量 + `DataSyncHelper` 状态管理器（无注解） |
| `MPBridgeWeb.ets` | URL 平台参数注入 + 自动调用 `notifyPageLoading/Loaded` |

**主模块使用方式：**
```typescript
private dataSyncHelper: DataSyncHelper = new DataSyncHelper(
  this.bridgeManager,
  [DataSyncChannel.USER_INFO, DataSyncChannel.LOAN_INFO],
  true
);

build() {
  MPBridgeWeb({
    bridgeManager: this.bridgeManager,
    url: 'https://example.com/loan',  // 自动追加 ?platform=harmony
    debug: true,
    dataSyncHelper: this.dataSyncHelper,
    controller: this.controller
  })
}

aboutToAppear() {
  this.dataSyncHelper.setUserInfo('{"uid":"123","ticket":"abc"}');
  this.dataSyncHelper.setLoanInfo('{"loanId":"L001","amount":50000}');
}
```

**与 Android 的差异：**

| 维度 | Android | 鸿蒙 |
|------|---------|------|
| 通道声明 | 注解 + 反射自动检测 | 构造函数传入 `requiredChannels` |
| 推送方式 | `callBridgeHandler(method, data)` | `callJs(method, [data])` |
| 页面状态通知 | 手动调用 `notifyPageLoaded()` | `MPBridgeWeb` 自动在 `onPageBegin/End` 调用 |
| AOP 支持 | Kotlin 注解 + 运行时反射 | 不支持，直接引入 |

#### Native 状态机

```
SyncState:
  IDLE → (notifyPageLoading) → LOADING
  LOADING → (notifyPageLoaded) → LOADED
  LOADED → (pushPendingData: all synced) → SYNCED

数据推送时机：
  1. 页面已加载 + 数据已就绪 → 立即推送
  2. 页面已加载 + 数据未就绪 → 等待数据到达后推送
  3. 页面未加载 + 数据已就绪 → 等待页面加载完成后推送
```

#### 通道与方法名约定

| 通道名 | Native 方法名 | 说明 |
|--------|---------------|------|
| userInfo | syncUserInfo | uid + ticket 认证数据 |
| loanInfo | syncLoanInfo | 借款信息 |
| vipInfo | syncVipInfo | 会员信息 |
| {custom} | sync{Custom} | 自定义通道自动命名 |

---

## 11. 技术栈版本

| 组件 | 版本 |
|------|------|
| Android Gradle Plugin | 9.0.1 |
| Gradle | 9.2.1 |
| Kotlin | 2.0.21 |
| compileSdk | 36 (minorApiLevel=1) |
| minSdk | 24 |
| Java | 11 |
| Gson | 2.10.1 |
| Vite | ^5.4.21 |
| TypeScript | ~5.6.0 |
| 鸿蒙 DevEco Studio | 内置 node + hvigor |

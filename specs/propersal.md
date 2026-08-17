# 需求
业务数据传递：针对数据量传输大的问题，采用了JSBridge进行数据传递。 基于等待唤醒机制的 数据传递机制，前端的 定制axios 拦截器，当加载前端页面时，正常加载。在拦截器中是会阻塞 缺少 业务数据的网络请求，直到对应的业务数据达到之后，补全业务数据，然后进行发送，期间网络请求维护在队列中，并且设置了超时时间。     该工程支持横向扩展：比如 uid和ticket 数据、 借款信息数据、会员信息数据等，都对有对应的队列维护。  使用维度 通过在前端工程的请求方法中 加入对应@waitUserInfoSync   @waitLoanInfoSync   @waitVipInfoSync 等装饰器，可以让前端工程师快速使用。多前端工程间也有更高的易用性。

将 Android 鸿蒙 有各自的一套WebView ， 比如WebViewForLoan / WebViewForVip / WebViewForThird (第三方页面) ， 进行状态，并且将发送 发送UserInfo/ LoanInfo 和 VipInfo的逻辑补全。 最好能做到解耦，如果Android 也能用注解进行关联会更好 ， 因为鸿蒙AOP功能比较差，可以直接引入

# 环境描述
基于当前的工程结构

# 功能要求
1. 前端工程使用axios
2. platform传递时在url，用于前端去判断当前设备的平台
3. Android 鸿蒙 有各自的一套WebView ， 比如WebViewForLoan / WebViewForVip / WebViewForThird (第三方页面) 这些都在各个工程的主模块， 把保证这套中间件不能和主模块有耦合。  同理前端主工程直接使用 @vue-web-sdk 包括的 `@waitUserInfoSync` 这种方法 
# 通用要求
1. 每一次中型改动 都要维护到git
2. 你可以通过一对一采访我的形式弄清楚需求，但是每次只能问我一个问题
3. 你作为一个项目经理，起到解读需求、拆分任务、调度任务的职责，通过SubAgent进行具体任务的实现
4. SubAgent只回传给你必要的结果，如需传递大量信息，需要使用文件传输，减少你的上下文占用
5. 当前阶段目标就是产出不同平台的SDK
6. 将你对需求的理解也要更新到当前markdown中
7. 非极度敏感权限，不需要询问我
8. 只需要我做功能和业务相关的决策

---

# 需求理解与架构设计（PM补充）

## 核心机制

### 等待唤醒数据同步机制

本需求的核心是在前端 SDK（`@mp-sdk/bridge`）中新增一套 **业务数据等待唤醒中间件**，解决 WebView 容器中 Native → Web 大数据量传递的时序问题。

**数据流向：**
```
Native (Android/HarmonyOS)
  → 通过 JSBridge 主动推送业务数据到 JS（如 syncUserInfo / syncLoanInfo / syncVipInfo）
  → 前端 SDK 注册的 Handler 接收数据
  → DataSyncManager.pushData(channelName, data) 唤醒等待队列
  → Axios 拦截器检测到数据就绪，补全请求配置，发送被阻塞的 HTTP 请求
```

### 三层架构设计

| 层 | 职责 | 实现位置 |
|---|---|---|
| **DataSyncManager** | 管理多个数据通道（userInfo/loanInfo/vipInfo等），每个通道独立维护等待队列、数据缓存、超时控制 | `vue-web-sdk/src/data-sync/manager.ts` |
| **Axios 拦截器** | 请求拦截器，检测请求标记的所需数据通道，阻塞请求直到数据就绪或超时，然后将数据注入请求配置（headers/params/body） | `vue-web-sdk/src/data-sync/interceptor.ts` |
| **装饰器** | `@waitUserInfoSync` / `@waitLoanInfoSync` / `@waitVipInfoSync` 等方法级装饰器，标记 API 方法所需的数据通道，等待数据就绪后设置上下文供拦截器读取 | `vue-web-sdk/src/data-sync/decorators.ts` |

### 数据注入策略（可配置）

每个数据通道支持配置注入方式：
- `headers`：将数据字段映射为请求头（如 uid → X-Uid, ticket → X-Ticket）
- `params`：将数据合并到 URL 查询参数
- `body`：将数据合并到请求体
- 自定义注入函数：`inject(config, data) => config`

默认策略：userInfo → headers，其余 → body

### 横向扩展机制

通过 `registerChannel(name, config)` 注册自定义数据通道，内置三个标准通道：
- `userInfo`：uid + ticket（认证数据）
- `loanInfo`：借款信息数据
- `vipInfo`：会员信息数据

前端工程师可自定义通道，如 `registerChannel('orderInfo', { nativeMethod: 'syncOrderInfo', injectTo: 'body' })`

### 平台检测增强

- Native 加载 WebView 时在 URL 追加 `?platform=android` 或 `?platform=harmony` 查询参数
- 前端 SDK 优先从 URL 读取平台标识，其次检测 `window.WebViewJavascriptBridge` / `window.dsBridge`

### 解耦设计

- SDK 提供机制（DataSyncManager + 拦截器 + 装饰器），不包含任何业务逻辑
- Android 端 `MPBridgeWebView.callBridgeHandler("syncUserInfo", dataJson)` 推送数据
- 鸿蒙端 `JSBridgeManager.callJs("syncUserInfo", [dataJson])` 推送数据
- 主模块（WebViewForLoan / WebViewForVip / WebViewForThird）仅调用上述标准方法，不依赖 SDK 内部实现
- SDK 自动注册 Native→JS 数据同步 Handler，主模块无需关心前端接收逻辑

## 实施范围

### 前端 SDK（vue-web-sdk）
- 新增 `src/data-sync/` 模块：types/manager/interceptor/decorators/index
- 新增 `src/platform.ts`：URL 平台检测
- 更新 `src/index.ts`：导出新模块
- 更新 `src/bridge.ts`：桥接就绪后自动注册数据同步 Handler
- 更新 `tsconfig.json`：启用 `experimentalDecorators`
- 更新 `package.json`：axios 作为 peerDependency
- 更新 `vite.config.ts`：axios 配置为 external

### 示例工程（vue-web）
- 更新 `App.vue`：演示装饰器 + 拦截器使用方式
- 更新 `package.json`：添加 axios 依赖
- 更新 `tsconfig.app.json`：启用装饰器

### Native 端（Android SDK）
- 新增 `MPDataSync.kt`：注解（`@NeedsUserInfo` / `@NeedsLoanInfo` / `@NeedsVipInfo` / `@NeedsDataSync`）+ 通道常量 + `MPDataSyncHelper` 状态管理器
  - `MPDataSyncHelper` 通过反射读取 WebView 类上的注解，确定所需数据通道
  - 管理 WebView 状态：页面加载完成、各通道数据是否已推送
  - 页面加载完成 + 数据就绪时自动推送（callBridgeHandler），支持先到先推
- 更新 `MPBridgeWebView.kt`：
  - `loadBridgeUrl(url)` 自动追加 `?platform=android` 查询参数
  - 新增 `getDataSyncHelper()` 获取数据同步辅助器

### Native 端（鸿蒙 SDK）
- 新增 `DataSyncHelper.ets`：通道常量 + `DataSyncHelper` 状态管理器（无注解，直接引入）
  - 管理 WebView 状态：页面加载完成、各通道数据是否已推送
  - 页面加载完成 + 数据就绪时自动推送（callJs），支持先到先推
- 更新 `MPBridgeWeb.ets`：
  - 加载 URL 时自动追加 `?platform=harmony` 查询参数
  - 页面加载完成后通知 DataSyncHelper
- 更新 `Index.ets`：导出 DataSyncHelper

### Native 推送方法名约定
- `syncUserInfo`：推送 uid + ticket 用户信息
- `syncLoanInfo`：推送借款信息
- `syncVipInfo`：推送会员信息

### Native 端状态管理
```
WebView 状态机：
  IDLE → 页面开始加载 → LOADING → 页面加载完成 → LOADED → 数据推送完成 → SYNCED

数据推送时机：
  1. 页面已加载 + 数据已就绪 → 立即推送
  2. 页面已加载 + 数据未就绪 → 等待数据到达后推送
  3. 页面未加载 + 数据已就绪 → 等待页面加载完成后推送
```


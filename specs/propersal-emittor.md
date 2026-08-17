# 需求
增强前端emittor工程：
由于前端工程有 借款工程（WebViewForLoan）、会员工程(WebViewForVip)、还有一些其他H5工程(WebViewForActivity)，
这些工程之间可以在存在着WebView隔离，通Webview之间也可能存在跨域问题。这使得前端Vue中的emittor的通信有了很大的局限性。   
我实现的解决方案是: 
定义四层消息体(<containerName>:<scope>:<vueModelName>:<vueEventName>) 通过Hook前端的emittor，
将该类别的消息通过 JSBridge发往原生端， 再原生端基于原生手段 “透传给” 目标WebView的进而回传给对应的前端工程。
这样前端工程师也是无感的在多个工程中使用emittor，并且能够灵活通行。

##前端
引入emitor库，并且hook   提交和监听两个方法。 
提交方法：当传入的事件名称为 vip:vipbuy:success:two ,这种:分开的4级格式，则就通过JSBridge方法 postToNative方式，传递出去。 如果还有其他参数
则透传给postNative方法。两个方法前面一致即可。 
## 原生端
WebView初始化的时候，就注册postToNative方法。 当有数据到来，则解析vip:vipbuy:success:two 四级参数，并根据第一级内容，使用本地消息发送给对应的WebView。
对应的WebView接收到消息后，通过JSBridge 的postToWeb方法透过过去。
一级事件名有四个： vip , loan, lead,common,host ， 前四个分别对应 WebViewForVip/ WebViewForLoan/WebViewForLead/WebViewForCommon 
这四个页面。 host 代表前端发给原生的。 原生直接消费掉，不会回传给其他位置。 
每个页面只接受自己感兴趣的事件
## 前端
前端收到 postToWeb调用，则将数据发送给 监听vip:vipbuy:success:two四级类型格式调用点。
注意不需要出现内存泄漏
注意整个流程只有四级事件名，其他级别则认为数据异常，忽略即可
前端的emittor hook这套逻辑要放入到前端SDK模块 。


# 需求理解与架构设计（PM补充）

## 核心机制

### 跨 WebView Emitter 通信

前端存在多个独立 WebView 工程（WebViewForVip / WebViewForLoan / WebViewForLead / WebViewForCommon），由于 WebView 隔离和跨域问题，Vue 的 emitter 无法直接跨 WebView 通信。解决方案是定义四级消息体格式，通过 JSBridge 将消息发往原生端，原生端根据第一级容器名路由到目标 WebView，再回传给前端工程，实现无感跨 WebView 事件通信。

**数据流向：**
```
WebView A（如 Loan 页面）
  → emitter.emit('vip:vipbuy:success:two', data)   // 检测到4级事件
  → bridge.callAsync('postToNative', { event, data })  // 前端 SDK 透传
  → JSBridge 传输到 Native
  → Native 端 MPEventRouter / EventRouter 解析第一级 'vip'
  → 路由到 WebViewForVip
  → webView.callHandler('postToWeb', { event, data })  // 转发到目标 WebView
  → 前端 SDK postToWeb Handler 接收
  → emitter.dispatch('vip:vipbuy:success:two', data)  // 分发给本地监听器
  → emitter.on('vip:vipbuy:success:two', handler) 被调用
```

### 四级消息格式

```
<containerName>:<scope>:<vueModelName>:<vueEventName>
```

示例：`vip:vipbuy:success:two`

- **第一级 containerName**：目标 WebView 容器标识，决定消息路由方向
- **第二级 scope**：业务作用域
- **第三级 vueModelName**：Vue 模型名
- **第四级 vueEventName**：Vue 事件名

### 容器名与 WebView 映射

| 容器名 | 目标 WebView | 说明 |
|--------|-------------|------|
| `vip` | WebViewForVip | VIP 会员页面 |
| `loan` | WebViewForLoan | 借款页面 |
| `lead` | WebViewForLead | 线索页面 |
| `common` | WebViewForCommon | 通用页面 |
| `host` | Native 端 | 前端发给原生，Native 直接消费，不转发 |

### 关键规则

1. **只有4级事件名参与跨 WebView 通信**：非4级格式的事件视为本地 emitter 事件，不经过 JSBridge
2. **4级事件 emit 不本地分发**：emit 4级事件时仅发送给 Native，由 Native 路由后通过 postToWeb 回传分发
3. **数据异常忽略**：非4级格式的事件在跨 WebView 流程中被忽略
4. **无内存泄漏**：emitter 提供完整的 off/clear 清理机制，监听器使用 Set 存储，支持 WeakMap

## 实施范围

### 前端 SDK（vue-web-sdk）
- 新增 `src/emitter/types.ts`：四级事件类型定义、容器名常量、PostToNativeParams / PostToWebParams 接口
- 新增 `src/emitter/emitter.ts`：轻量级事件发射器（零依赖，mitt 风格），hook emit/on 方法，4级事件自动路由到 Native
- 新增 `src/emitter/index.ts`：emitter 模块导出
- 更新 `src/bridge.ts`：MPBridgeImpl 注册 postToWeb JS Handler，接收 Native 转发的事件并分发给 emitter
- 更新 `src/types.ts`：IMPBridge 接口增加 postToNative 签名
- 更新 `src/index.ts`：导出 emitter 模块

### Android SDK
- 新增 `MPEventRouter.kt`：跨 WebView 事件路由器
  - `registerWebView(container, webView)` 注册 WebView 并自动注册 postToNative Handler
  - `unregisterWebView(container)` 注销清理
  - `onHostEvent(handler)` 注册 host 事件处理回调
  - 解析4级事件，按第一级路由到目标 WebView 的 postToWeb

### 鸿蒙 SDK
- 新增 `bridge/EventRouter.ets`：跨 WebView 事件路由器（与 Android 逻辑对等）
  - `registerWebView(container, bridgeManager)` 注册并自动注册 postToNative Handler
  - `unregisterWebView(container)` 注销清理
  - `onHostEvent(handler)` 注册 host 事件处理回调
  - 解析4级事件，按第一级通过 callJs('postToWeb', ...) 路由
- 更新 `Index.ets`：导出 EventRouter

### 与现有模块的关系

Emitter 与 DataSync、AppLink 是并列模块，共享 JSBridge 通信基础设施：
- DataSync：Native → Web 数据推送（等待唤醒机制）
- AppLink：Web → Native 页面跳转（scheme 透传）
- Emitter：Web → Native → Web 跨 WebView 事件通信（4级事件路由）

## 技术决策记录

### 1. 零依赖 emitter 实现（不引入外部 emitter 库）

**决策：** SDK 内部实现轻量级事件发射器，不引入 mitt 等外部库。
**理由：** 与前端 SDK 零运行时依赖设计原则一致（Design.md §2.3），emitter 逻辑简单（on/off/emit/clear），自行实现约100行代码即可。

### 2. 4级事件 emit 不本地分发

**决策：** emit 4级格式事件时仅通过 postToNative 发送给 Native，不本地 dispatch。
**理由：** 避免双重分发。Native 路由后通过 postToWeb 回传，由 postToWeb Handler 统一 dispatch，确保同页面监听器也能通过正常流程收到事件。

### 3. 非规则事件走本地 emitter

**决策：** 非4级格式事件（如 `click`、`update`）走本地 emitter 分发，不经过 JSBridge。
**理由：** 保持 emitter 的通用性，SDK 的 emitter 既能做跨 WebView 通信，也能做本地事件总线。

### 4. host 事件由 Native 消费

**决策：** 第一级为 `host` 的事件，Native 端直接消费，不转发给任何 WebView。SDK 提供 `onHostEvent(handler)` 接口供宿主注册处理回调。
**理由：** 满足前端 → Native 的单向事件通信需求（如通知 Native 执行原生逻辑）。

## 前端使用示例

```typescript
import { emitter, getEmitter } from '@mp-sdk/bridge'

// 监听跨 WebView 事件（在 WebViewForVip 页面中）
emitter.on('vip:vipbuy:success:two', (data) => {
  console.log('收到 VIP 购买成功事件', data)
})

// 发射跨 WebView 事件（在 WebViewForLoan 页面中）
emitter.emit('vip:vipbuy:success:two', { orderId: '123', amount: 99 })
// → 自动通过 postToNative 发给 Native → Native 路由到 WebViewForVip → postToWeb → 本地 dispatch

// 发射 host 事件（通知 Native）
emitter.emit('host:payment:completed:done', { orderId: '123' })
// → Native 端 onHostEvent handler 被调用

// 本地事件（非4级格式）
emitter.on('pageReady', () => { ... })
emitter.emit('pageReady')  // 仅本地分发

// 清理监听器（防止内存泄漏）
const handler = (data) => { ... }
emitter.on('vip:vipbuy:success:two', handler)
emitter.off('vip:vipbuy:success:two', handler)  // 移除单个
emitter.clear()  // 清除所有
```

## Native 端使用示例

**Android：**
```kotlin
val eventRouter = MPEventRouter()
// 注册各 WebView（自动注册 postToNative Handler）
eventRouter.registerWebView(MPEventRouter.CONTAINER_VIP, vipWebView)
eventRouter.registerWebView(MPEventRouter.CONTAINER_LOAN, loanWebView)

// 监听 host 事件
eventRouter.onHostEvent { event, data ->
    Log.d("EventRouter", "Host event: $event, data: $data")
}

// 页面销毁时注销
eventRouter.unregisterWebView(MPEventRouter.CONTAINER_VIP)
```

**鸿蒙：**
```typescript
const eventRouter = new EventRouter()
// 注册各 WebView
eventRouter.registerWebView(EventRouter.CONTAINER_VIP, vipBridgeManager)
eventRouter.registerWebView(EventRouter.CONTAINER_LOAN, loanBridgeManager)

// 监听 host 事件
eventRouter.onHostEvent((event: string, data: string) => {
  console.log(`Host event: ${event}, data: ${data}`)
})

// 页面销毁时注销
eventRouter.unregisterWebView(EventRouter.CONTAINER_VIP)
```

---

# 环境描述
基于当前的工程结构

# 通用要求
1. 每一次中型改动 都要维护到git
2. 你可以通过一对一采访我的形式弄清楚需求，但是每次只能问我一个问题
3. 你作为一个项目经理，起到解读需求、拆分任务、调度任务的职责，通过SubAgent进行具体任务的实现
4. SubAgent只回传给你必要的结果，如需传递大量信息，需要使用文件传输，减少你的上下文占用
5. 当前阶段目标就是产出不同平台的SDK
6. 将你对需求的理解也要更新到当前markdown中
7. 非极度敏感权限，不需要询问我
8. 只需要我做功能和业务相关的决策
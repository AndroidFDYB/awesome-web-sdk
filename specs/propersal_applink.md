# 需求
使用scheme协议 格式为 
简单页面跳转：sk://native={pageName='vip',url='https://www.baidu.com',title='aaa'}

先回首页再打开页面：sk://native={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'}

先回首页再打开透明弹窗：sk://native={pageName='transparent',url='https://www.baidu.com',title='aaa',backHome='1'}

解析协议的通用规则：
android、鸿蒙都是一样的。 

前端调用这些协议的方式都是一样，在初始化前端SDK时，传入前端SDK中有平台参数， 然后前端SDK约定了 jump2Native JSBridge方法。 然后调用原生端。
各端解析这套参数的规则逻辑要保持一致。 

如下两个链接有点出入： 
先回首页再打开页面：sk://native={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'}
Android端直接 解析到backHome为1，然后再打开新的页面，标记新打开页面，然后调用自己返回首页的方法（排出新打开的页面，利用hash）。
鸿蒙端 则是将 sk://native={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'} 转换为  sk://action={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'} , 在跟容器处理该Action，回退到首页，然后再打开新的vip页面

先回首页再打开透明弹窗：sk://native={pageName='transparent',url='https://www.baidu.com',title='aaa',backHome='1'}
Android端直接 解析到backHome为1，然后再打开新的透明弹窗（也是一个页面），标记新打开新弹窗，然后调用自己返回首页的方法（排出新打开的页面，利用hash）。

鸿蒙端 则是将 sk://native={pageName='transparent',url='https://www.baidu.com',title='aaa',backHome='1'} 转换为  sk://action={pageName='transparent',url='https://www.baidu.com',title='aaa',backHome='1'} , 在跟容器处理该Action，回退到首页，然后再打开新的vip页面

连续打开透明弹窗： sk://native={pageName='transparent',url='https://www.baidu.com',title='aaa'} ， 鸿蒙端要维护上一个透明弹窗的引用，将其设置1pixel的黑色背景，才能够弹出 当前的弹窗。 注意避免内存泄漏， 这个透明弹窗可以用链表进行维护。 并且如果有返回首页时jsd时，这些弹窗都得 关闭掉。 


# 需求理解与架构设计（PM补充）

## 核心机制

### AppLink Scheme 页面跳转

前端 H5 页面通过 JSBridge 调用 `jump2Native` 方法，将 `sk://native={...}` 格式的 scheme 字符串透传给 Native 端。Native 端负责解析 scheme 并执行对应的页面跳转操作。

**数据流向：**
```
前端 H5 页面
  → jump2Native("sk://native={pageName='vip',url='...',title='aaa'}")  
  → bridge.callAsync('jump2Native', { scheme })  // 前端 SDK 透传
  → JSBridge 通道传输到 Native
  → Native 端 AppLinkParser.parse(scheme) 解析参数
  → AppLinkHandler 根据参数执行导航逻辑
```

### 三种跳转场景

| 场景 | Scheme 示例 | 行为 |
|------|---------|------|
| 简单页面跳转 | `sk://native={pageName='vip',url='...',title='aaa'}` | 直接打开新页面 |
| 回首页再打开页面 | `sk://native={pageName='vip',url='...',title='aaa',backHome='1'}` | 先回首页再打开新页面 |
| 回首页再打开透明弹窗 | `sk://native={pageName='transparent',url='...',title='aaa',backHome='1'}` | 先回首页再打开透明 WebView |

### 平台差异

| 维度 | Android | 鸿蒙 |
|------|---------|------|
| backHome 处理 | 直接处理：先 openPage 打开新页面，再 goBackToHome 回首页（排除新页面） | 转换为 `sk://action={...}` 交由根容器处理 |
| 透明弹窗 | 普通 Activity（Theme.Translucent 透明主题），H5 自行处理透明 UI | @CustomDialog 组件，回调注册表模式管理引用，backHome 时逐一调用 closeFn 关闭 |
| 导航委托 | `AppLinkNavigationDelegate` (openPage + goBackToHome) | `AppLinkActionDelegate` (openPage + handleAction) + registerClose 回调 |

### Scheme 解析规则（三端一致）

```
输入: "sk://native={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'}"
输出: { pageName: "vip", url: "https://www.baidu.com", title: "aaa", backHome: true }
```

- 提取 `sk://native=` 或 `sk://action=` 后的 `{…}` 内容
- 按 `key='value'` 格式解析键值对
- value 内允许包含 `=`、`//`、`:` 等特殊字符
- 解析失败返回 null + 日志输出

## 实施范围

### 前端 SDK（vue-web-sdk）
- 新增 `src/app-link/types.ts`：AppLinkCallParams / AppLinkResult 类型定义
- 新增 `src/app-link/index.ts`：jump2Native() 函数实现，通过 bridge.callAsync 透传 scheme
- 更新 `src/bridge.ts`：MPBridgeImpl 增加 jump2Native 方法实现
- 更新 `src/types.ts`：IMPBridge 接口增加 jump2Native 签名
- 更新 `src/index.ts`：导出 app-link 模块

### Android SDK
- 新增 `applink/AppLinkParams.kt`：解析后的参数 data class
- 新增 `applink/AppLinkParser.kt`：scheme 解析器（object 单例，纯函数）
- 新增 `applink/AppLinkHandler.kt`：跳转处理器 + `AppLinkNavigationDelegate` 回调接口

### 鸿蒙 SDK
- 新增 `applink/AppLinkParams.ets`：AppLinkParams 接口 + 常量
- 新增 `applink/AppLinkParser.ets`：scheme 解析器（与 Android 逻辑一致）
- 新增 `applink/AppLinkHandler.ets`：跳转处理器 + `AppLinkActionDelegate` 接口 + 透明弹窗链表管理
- 更新 `Index.ets`：导出 AppLink 模块

### 与数据同步的关系
AppLink 与 DataSync 是并列模块，共享 JSBridge 通信基础设施，但业务逻辑完全独立：
- DataSync：Native → Web 数据推送（等待唤醒机制）
- AppLink：Web → Native 页面跳转（scheme 透传）

### 鸿蒙透明弹窗链表管理（回调注册表模式）

ArkTS 无 WeakReference/SoftReference，字符串 ID 无法实际控制弹窗关闭。
因此采用回调注册表模式：openPage 传入 registerClose 回调参数，
弹窗创建后调用 registerClose(() => ctrl.close()) 将关闭闭包注册到 SDK 链表。

```
链表结构：head ↔ node1(closeFn) ↔ node2(closeFn) ↔ node3(closeFn) ↔ tail

openPage(params, registerClose) 时：
1. 宿主创建弹窗（如 CustomDialogController）
2. 调用 registerClose(() => controller.close()) 注册关闭回调
3. SDK 创建新节点追加到链表尾部

backHome 时：
1. closeAllPopups()：从尾部开始逐一调用 node.closeFn()
2. 断开所有节点引用
3. 清空 head/tail，popupCount = 0
```

### Native 端使用方式

**Android：**
```kotlin
val appLinkHandler = AppLinkHandler(webView)
appLinkHandler.register(object : AppLinkNavigationDelegate {
    override fun openPage(params: AppLinkParams) {
        startActivity(Intent(this@MyActivity, WebActivity::class.java).apply {
            putExtra("url", params.url)
            putExtra("title", params.title)
        })
    }
    override fun goBackToHome(excludeTop: Boolean) {
        val intent = Intent(this@MyActivity, HomeActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(intent)
    }
})
```

**鸿蒙（回调注册表模式）：**
```typescript
class MyDelegate implements AppLinkActionDelegate {
  // 构造函数注入回调...
  openPage(params: AppLinkParams, registerClose: (closeFn: () => void) => void): void {
    if (params.pageName === 'transparent') {
      const ctrl = new CustomDialogController({
        builder: TransparentPopupDialog({ url: params.url, title: params.title ?? '' }),
        customStyle: true, autoCancel: true
      });
      ctrl.open();
      registerClose(() => ctrl.close()); // 关键：注册关闭回调到 SDK 链表
    } else {
      router.pushUrl({ url: 'pages/' + params.pageName });
    }
  }
  handleAction(actionScheme: string): void {
    router.back(); // backHome 后续处理
  }
}
const handler = new AppLinkHandler(bridgeManager, new MyDelegate(), true);
```

**前端：**
```typescript
import { jump2Native } from '@mp-sdk/bridge'

// 简单跳转
await jump2Native("sk://native={pageName='vip',url='https://example.com',title='VIP'}")

// 回首页再打开
await jump2Native("sk://native={pageName='vip',url='https://example.com',title='VIP',backHome='1'}")
```

---

## WebViewForVip 示例页面集成

### Android 端
- `WebViewForVipActivity.kt`：VIP 会员页面，组合模式持有 MPBridgeWebView + MPDataSyncHelper + AppLinkHandler
  - 标注 `@NeedsUserInfo @NeedsVipInfo`，KSP 编译期生成通道注册表
  - AppLinkNavigationDelegate 实现：openPage 启动 TransparentWebActivity，goBackToHome FLAG_ACTIVITY_CLEAR_TOP 回首页
- `TransparentWebActivity.kt`：透明弹窗 Activity，Theme.Translucent 主题 + MPBridgeWebView 加载 URL
  - H5 页面自行处理透明弹窗 UI（半透明遮罩、关闭按钮等）

### 鸿蒙端
- `VipPage.ets`：VIP 会员页面，集成 DataSyncHelper + AppLinkHandler
  - `VipPageAppLinkDelegate` class 实现 AppLinkActionDelegate（ArkTS 严格模式不允许对象字面量）
  - 透明弹窗：创建 CustomDialogController + registerClose 注册关闭回调
  - backHome：router.back() 返回
- `TransparentPopupDialog.ets`：@CustomDialog 组件，内含 Web + JSBridgeManager + DsBridgeProxy
  - 背景半透明遮罩，点击遮罩关闭
  - 独立 JSBridge 实例，支持弹窗内 JS 通信

### 弹窗引用管理对比
| 平台 | 弹窗形态 | 引用方式 | 关闭方式 |
|------|---------|---------|----------|
| Android | Activity（Theme.Translucent 透明主题） | 系统 Activity 栈 | finish() / 返回键 |
| 鸿蒙 | @CustomDialog | CustomDialogController 闭包 | controller.close() |
| 鸿蒙 SDK | 回调注册表链表 | closeFn: () => void | closeAllPopups() 逐一调用 |

---

## 技术决策记录

### 1. 鸿蒙弹窗引用管理：回调注册表模式

**问题：** ArkTS 无 WeakReference/SoftReference，字符串 ID 无法实际控制弹窗关闭。原方案用链表存 `pageId: string` + `removePopup(pageId)` 无法真正关闭弹窗。

**决策：** 改为回调注册表模式。`openPage` 方法签名变更：
```typescript
// 变更前
openPage(params: AppLinkParams): string;  // 返回 pageId 字符串

// 变更后
openPage(params: AppLinkParams, registerClose: (closeFn: () => void) => void): void;
```
弹窗创建时宿主调用 `registerClose(() => ctrl.close())`，SDK 将闭包存入链表。`closeAllPopups()` 时逐一调用 `closeFn()` 并断开引用。同时移除了 `closeTransparentPage` 和 `removePopup` 方法。

### 2. 鸿蒙弹窗形态：@CustomDialog 而非独立页面

**决策：** 透明弹窗采用 `@CustomDialog` 组件而非 `router.pushUrl` 导航到独立透明页面。理由：
- 弹窗生命周期跟随父页面，父页面销毁时自动关闭
- `CustomDialogController` 天然提供 close() 方法，与回调注册表模式完美配合
- 避免路由栈污染（独立页面会在 router 栈中留下记录）

### 3. ArkTS 严格模式兼容：class implements 替代对象字面量

**问题：** ArkTS 严格模式不允许 `arkts-no-untyped-obj-literals`，即对象字面量不能直接实现接口。

**决策：** 使用 `class VipPageAppLinkDelegate implements AppLinkActionDelegate` 代替对象字面量。通过构造函数注入回调函数（`openPageFn` / `handleActionFn`）桥接组件上下文到委托逻辑，`CustomDialogController` 在组件回调闭包内创建。

### 4. 弹窗独立 JSBridge 实例

**决策：** 每个 `TransparentPopupDialog` 拥有独立的 `JSBridgeManager` + `DsBridgeProxy`。理由：
- 每个 Web 组件需要自己的 JSBridge 连接
- 弹窗内的 JS 通信与父页面隔离，互不干扰
- 弹窗关闭时 JSBridgeManager 自动释放，无内存泄漏风险

### 5. Android 透明弹窗：Activity + 透明主题

**决策：** Android 透明弹窗采用独立 `TransparentWebActivity` + `Theme.Translucent`（`windowIsTranslucent=true`, `backgroundDimEnabled=true`），而非 DialogFragment。理由：
- 与现有 Activity 架构一致，复用 MPBridgeWebView 组合模式
- 系统 Activity 栈天然管理引用和关闭
- H5 页面自行处理透明 UI（半透明遮罩、关闭按钮等），Native 只提供容器

### 6. 前端 scheme 透传

**决策：** 前端 SDK `jump2Native` 直接透传原始 scheme 字符串给 Native，不在前端侧解析。理由：
- 保持前端 SDK 极简，只负责通道传输
- 解析逻辑集中在 Native 端，三端（Android/鸿蒙/iOS）保持一致
- 未来 scheme 格式变更只需改 Native 解析器，前端无需改动

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


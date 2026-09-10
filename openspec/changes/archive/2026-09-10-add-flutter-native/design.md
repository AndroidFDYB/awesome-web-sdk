## Context

MP-SDK 当前覆盖 Android（Kotlin）、iOS（Objective-C）、鸿蒙（ArkTS）三端原生 SDK，每端实现 Bridge、DataSync、AppLink、Emitter 四大模块，外加 Proto Codegen 自动生成通道常量与 setter。前端 SDK（TypeScript）通过平台检测自动适配对应的桥接协议。

iOS 端采用 WKWebView + `WKScriptMessageHandler` 异步消息通道 + `evaluateJavaScript` 回传，bridge.js 通过 `window.webkit.messageHandlers.mpBridge.postMessage` 发送消息到 Native。Flutter 端 WebView 插件（`flutter_inappwebview`）提供高度同构的 API：`addJavaScriptHandler` 接收 JS 消息、`evaluateJavascript` 回传、`addUserScript` 注入脚本。通信模型与 iOS 几乎完全一致——均为异步消息通道。

Flutter 鸿蒙适配版（OpenHarmony-SIG 维护）已支持 `flutter_inappwebview` 的核心 API，使 Flutter SDK 可覆盖 Android / iOS / HarmonyOS 三平台。

详见 proposal.md 的动机说明。

## Goals / Non-Goals

**Goals:**
- 以一套 Dart SDK 实现与三端对等的 Bridge / DataSync / AppLink / Emitter 四大模块
- Proto Codegen 增加 Dart 输出目标，复用现有共享解析器 `@mp-sdk/proto-codegen`
- 前端 SDK 增加 Flutter 平台检测，同时保持向后兼容（旧版 SDK 可识别为鸿蒙）
- Flutter 端代码仅保存本地，不 push 到远程，不纳入 CI

**Non-Goals:**
- 不替代现有三端 Native SDK（共存策略）
- 不修改 `.github/workflows/build.yml`
- 不发布到 pub.dev 或任何远程包仓库
- 不实现 Flutter Plugin（Platform Channel 层）——SDK 为纯 Dart package，WebView 由宿主 App 提供
- 不处理原生页面跳转——AppLink 目标页面假定为 WebView 页面或 Flutter 路由

## Decisions

### 决策 1：WebView 插件选型——`flutter_inappwebview`

**选择**：`flutter_inappwebview`（含 OpenHarmony-SIG 鸿蒙适配版）

**备选方案与取舍**：

| 备选 | 说明 | 否决理由 |
|------|------|----------|
| `webview_flutter`（官方） | Google 维护，API 精简 | 不支持 `addJavaScriptHandler`（仅支持 `runJavaScript`），无法建立 JS→Dart 消息通道 |
| 自研 Platform Channel + 原生 WebView | 完全控制 | 开发量巨大，需要为三平台各写一套 Platform Channel，与引入 Flutter 的初衷矛盾 |
| `flutter_inappwebview` | 功能完整，支持 `addJavaScriptHandler`、`evaluateJavascript`、`addUserScript`、`onLoadStart/Stop` | 第三方依赖，但社区活跃且已有鸿蒙适配版 |

**结论**：`flutter_inappwebview` 是唯一同时满足三平台覆盖 + JS Handler 通道 + 脚本注入能力的方案。

### 决策 2：bridge.js 适配策略——修改 `postToNative` 通道

**选择**：基于 iOS 版 bridge.js 修改，将 `window.webkit.messageHandlers.mpBridge.postMessage(...)` 替换为 `window.flutter_inappwebview.callHandler('mpBridge', ...)`

**备选方案**：

| 备选 | 说明 | 否决理由 |
|------|------|----------|
| 完全复用 iOS bridge.js 不改 | 零改动 | `postMessage` 通道不通，Flutter 无法接收 JS 消息 |
| Dart 侧重新实现 dsBridge 逻辑 | 不注入 JS，纯 Dart 管理 | 前端 SDK 依赖 `window.dsBridge` 对象，需要大量前端适配，违反向后兼容 |
| 修改 postToNative 通道 | 仅改一行消息发送方式 | 无 |

**兼容性设计**：Flutter 版 bridge.js 同时设置 `window.__flutter_bridge = true`（精确检测）和 `window.__harmony_bridge = true`（兼容标记），使旧版前端 SDK 可复用 dsBridge 适配层。

### 决策 3：Proto Codegen——Node.js 脚本 + 共享解析器

**选择**：新增 `scripts/proto-codegen-flutter.js`，复用 `@mp-sdk/proto-codegen` 共享解析器，生成 Dart 源码到 `flutter/lib/generated/` 目录。

**备选方案**：

| 备选 | 说明 | 否决理由 |
|------|------|----------|
| Dart build_runner + 自定义 Generator | Dart 原生构建体系 | 需要引入 build_runner 依赖链，且与项目统一的 Node.js codegen 体系不一致 |
| 独立的 Dart proto 解析器 | 类似 Android 的 Kotlin 解析器 | 过度工程，共享 TS 解析器已成熟 |
| Node.js 脚本 + 共享解析器 | 与 iOS / 鸿蒙 codegen 模式一致 | 无 |

**生成物设计**：

| 生成文件 | 内容 | 对应端 |
|----------|------|--------|
| `data_sync_channels.dart` | `class DataSyncChannel { static const userInfo = 'userInfo'; ... }` | 鸿蒙 `DataSyncChannels.ets` |
| `data_sync_methods.dart` | `class DataSyncMethod { static const syncUserInfo = 'syncUserInfo'; static String? fromChannel(String ch) => ...; }` | 鸿蒙 `DataSyncMethods.ets` |
| `data_sync_setters.dart` | `extension DataSyncSetters on DataSyncHelper { void setUserInfo(String data) => setData(DataSyncChannel.userInfo, data); ... }` | 鸿蒙 `DataSyncSetters.ets` |

### 决策 4：SDK 形态——纯 Dart package（非 Plugin）

**选择**：Flutter SDK 为纯 Dart package，不含有任何 Platform Channel 代码。WebView 实例由宿主 App 通过 `flutter_inappwebview` 创建，SDK 提供配置方法和生命周期钩子。

**理由**：
- 项目定位是"WebView 容器内的桥接逻辑"，不需要访问任何原生系统 API
- 纯 Dart package 无需为三平台各写一套 Platform 实现
- 宿主 App 完全掌控 WebView 配置（URL、JavaScript 开关、导航代理等）

**使用方式**：
```
宿主 App 创建 InAppWebView
  → 调用 SDK 提供的配置方法获取 InAppWebView 的初始配置
    （initialUserScripts、javascriptHandlers、navigationDelegate 回调）
  → SDK 内部完成 bridge.js 注入、Handler 注册、DataSync 管理
```

### 决策 5：目录结构

```
flutter/
├── lib/
│   ├── src/
│   │   ├── bridge/
│   │   │   ├── js_bridge_manager.dart      # 桥接管理器（Handler 注册/分发）
│   │   │   ├── bridge_handler.dart          # Handler 接口定义
│   │   │   ├── bridge_models.dart           # 数据模型（Request/Response）
│   │   │   ├── data_sync_helper.dart        # 数据同步辅助器（状态机）
│   │   │   ├── bridge_utils.dart            # 工具类（URL 参数注入）
│   │   │   └── app_link_handler.dart        # AppLink scheme 解析与导航
│   │   ├── emitter/
│   │   │   └── event_router.dart            # 跨 WebView 事件路由器
│   │   └── config/
│   │       └── mp_bridge_config.dart        # 全局配置（debug 模式、超时等）
│   ├── generated/                           # Proto codegen 生成产物（gitignore）
│   │   ├── data_sync_channels.dart
│   │   ├── data_sync_methods.dart
│   │   └── data_sync_setters.dart
│   └── mp_web_library.dart                  # SDK 导出入口
├── assets/
│   └── bridge.js                            # Flutter 适配版 bridge.js
├── example/                                 # 示例 App（本地验证用）
│   └── lib/main.dart
├── pubspec.yaml
├── analysis_options.yaml
└── .gitignore                               # 忽略 generated/ 和 build/
```

### 决策 6：前端 SDK 平台检测增强

**改动范围**（最小侵入）：

`vue-web-sdk/src/platform.ts`：
- `VALID_PLATFORMS` 增加 `'flutter'`
- `detectPlatformFromWindow()` 增加 `window.__flutter_bridge && window.dsBridge → 'flutter'` 分支（优先级高于鸿蒙检测）

`vue-web-sdk/src/bridge.ts`：
- `detect()` 增加 Flutter 检测分支：`window.__flutter_bridge && window.dsBridge → { platform: 'flutter', bridgeType: 'harmony-dsbridge' }`
- Flutter 复用 `HarmonyBridgeAdapter`（dsBridge 协议完全兼容），无需新增适配层

`vue-web-sdk/src/types.ts`：
- `Platform` 类型增加 `'flutter'`

### 决策 7：Git 隔离策略

**选择**：在仓库根目录 `.gitignore` 中追加 `flutter/` 规则，确保 Flutter 端代码不被推送到远程。

**备选方案**：

| 备选 | 说明 | 否决理由 |
|------|------|----------|
| `.gitignore` 排除整个 `flutter/` | 简单直接 | 无 |
| Git sparse checkout | 更精细控制 | 过度复杂 |
| 独立 Git 仓库 | 完全隔离 | 增加管理成本，本地 path 依赖路径不稳定 |

## Risks / Trade-offs

**[风险] `flutter_inappwebview` 鸿蒙适配版成熟度不足**
→ 缓解：Phase 1 先在 Android + iOS 上验证核心链路，鸿蒙端作为后续验证项；如遇 API 缺失，可降级为原生 Platform View + Platform Channel 方案

**[风险] bridge.js 的 `flutter_inappwebview.callHandler` 与 `webkit.messageHandlers.postMessage` 行为差异**
→ 缓解：`callHandler` 返回 Promise（异步），与 `postMessage` 语义一致；核心差异在于消息序列化方式，需在 Spike 阶段端到端验证

**[权衡] 纯 Dart package vs Flutter Plugin**
→ 选择纯 Dart 牺牲了"SDK 自带 WebView"的开箱即用体验，换取零 Platform Channel 代码和三平台一致性；宿主 App 需要多写几行 WebView 配置代码

**[权衡] `.gitignore` 隔离 vs 独立仓库**
→ 选择 gitignore 牺牲了版本控制可追溯性（本地代码无远程备份），换取零额外仓库管理和稳定的本地 path 依赖

## Open Questions

- Flutter 端 AppLink 的导航委托接口设计：是否需要提供 `AppLinkDelegate` 抽象类让宿主 App 自定义跳转行为？（可在实现阶段确定）
- `flutter_inappwebview` 鸿蒙版对 `addUserScript`（document-start 注入）的支持情况需实测验证

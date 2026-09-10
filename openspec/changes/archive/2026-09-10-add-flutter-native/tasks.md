## 1. 工程初始化与 Git 隔离

- [x] 1.1 在仓库根目录 `.gitignore` 追加 `flutter/` 规则，确认 `git status` 不再跟踪 `flutter/` 目录
- [x] 1.2 创建 `flutter/` 目录骨架（`pubspec.yaml`、`analysis_options.yaml`、`lib/mp_web_library.dart` 导出入口），依赖声明 `flutter_inappwebview`，验证 `flutter pub get` 成功
- [x] 1.3 创建 `flutter/assets/bridge.js`（Flutter 适配版），将 `postToNative` 改为 `window.flutter_inappwebview.callHandler('mpBridge', ...)`，同时设置 `window.__flutter_bridge = true` 和 `window.__harmony_bridge = true`

## 2. Proto Codegen（Dart 输出目标）

- [x] 2.1 新增 `scripts/proto-codegen-flutter.js`，复用 `@mp-sdk/proto-codegen` 共享解析器，解析 `specs/proto/channels.proto` 生成 `flutter/lib/generated/data_sync_channels.dart`（通道常量类）
- [x] 2.2 扩展 codegen 脚本生成 `data_sync_methods.dart`（方法名常量 + `fromChannel()` 映射）和 `data_sync_setters.dart`（`DataSyncHelper` 扩展方法 setter）
- [x] 2.3 在根目录 `package.json` 新增 `codegen:flutter` npm script，验证 `npm run codegen:flutter` 执行后 `flutter/lib/generated/` 下生成 3 个 Dart 文件且内容正确
- [x] 2.4 创建 `flutter/lib/generated/.gitignore`（空文件或忽略规则），确保 codegen 产物不被 git 跟踪

## 3. Bridge 核心实现

- [x] 3.1 实现 `flutter/lib/src/bridge/bridge_handler.dart`（同步/异步 Handler 类型定义）和 `flutter/lib/src/bridge/bridge_models.dart`（`BridgeRequest` / `BridgeResponse` / `NativeCallRequest` 数据模型）
- [x] 3.2 实现 `flutter/lib/src/bridge/js_bridge_manager.dart`（桥接管理器），包含 Handler 注册/分发、`callJs` Native→JS 调用、`handleJsMessage` JS→Dart 消息处理，通过 `InAppWebViewController.evaluateJavascript` 回传结果
- [x] 3.3 实现 `flutter/lib/src/bridge/bridge_utils.dart`（工具类），包含 `appendPlatformParam(url)` 追加 `?platform=flutter`、`getInitialUserScripts()` 返回 bridge.js 注入配置
- [x] 3.4 提供 SDK 顶层配置方法，返回 `InAppWebView` 所需的 `initialUserScripts`、`javascriptHandlers` 注册、`onLoadStart`/`onLoadStop` 回调配置，验证宿主 App 创建 WebView 后桥接通道可建立

## 4. DataSync 实现

- [x] 4.1 实现 `flutter/lib/src/bridge/data_sync_helper.dart`（数据同步辅助器），包含状态机（Idle→Loading→Loaded→Synced）、`setData(channel, data)` 数据设置、`notifyPageLoading()`/`notifyPageLoaded()` 页面状态通知、`pushPendingData()` 数据推送、`isAllDataSynced()` 状态查询
- [x] 4.2 在 `mp_web_library.dart` 导出入口中导出 `DataSyncHelper` 与 codegen 生成的 `DataSyncChannel`、`DataSyncMethod`、`DataSyncSetters`，验证导入后可正常使用

## 5. AppLink 实现

- [x] 5.1 实现 `flutter/lib/src/bridge/app_link_handler.dart`（AppLink 处理器），包含 `jump2Native` 桥接 Handler 注册、scheme 字符串解析（`sk://native={...}`）、通过回调或委托模式执行 Flutter 路由导航、透明弹窗管理（连续打开/回首页关闭全部）
- [x] 5.2 在 `JSBridgeManager` 初始化流程中自动注册 `jump2Native` Handler，验证前端 `bridge.callAsync('jump2Native', { scheme })` 可被正确解析

## 6. Emitter 实现

- [x] 6.1 实现 `flutter/lib/src/emitter/event_router.dart`（事件路由器），包含 WebView 容器注册（按容器名）、`postToNative` 桥接 Handler 注册、四级事件解析与路由转发、宿主事件直接消费、目标容器未注册时安全丢弃
- [x] 6.2 验证路由器可管理多个 `InAppWebView` 实例，事件按容器名正确路由

## 7. 全局配置与导出入口

- [x] 7.1 实现 `flutter/lib/src/config/mp_bridge_config.dart`（全局配置：debug 模式、日志 TAG、超时时间），与 Android `MPBridgeConfig` 对等
- [x] 7.2 完善 `flutter/lib/mp_web_library.dart` 导出入口，统一导出 Bridge、DataSync、AppLink、Emitter、Config、Generated 全部公共 API

## 8. 前端 SDK 平台检测更新

- [x] 8.1 修改 `vue-web-sdk/src/types.ts`，`Platform` 类型增加 `'flutter'`
- [x] 8.2 修改 `vue-web-sdk/src/platform.ts`，`VALID_PLATFORMS` 增加 `'flutter'`，`detectPlatformFromWindow()` 增加 `window.__flutter_bridge && window.dsBridge → 'flutter'` 检测分支（优先级高于鸿蒙检测）
- [x] 8.3 修改 `vue-web-sdk/src/bridge.ts`，`detect()` 增加 Flutter 检测分支返回 `{ platform: 'flutter', bridgeType: 'harmony-dsbridge' }`（复用 `HarmonyBridgeAdapter`），验证 `bridge.getPlatform()` 在 Flutter 容器中返回 `'flutter'`
- [x] 8.4 执行 `npm run build:web`，确认前端 SDK 构建成功且无类型错误

## 9. 构建脚本

- [x] 9.1 新增 `scripts/build-flutter.js`，编排构建流程：先执行 `codegen:flutter`（Proto 生成），再执行 `flutter analyze`（Dart 静态分析），验证脚本在 Windows 下可执行
- [x] 9.2 在根目录 `package.json` 新增 `build:flutter` npm script，指向 `scripts/build-flutter.js`，验证 `npm run build:flutter` 执行成功

## 10. 示例 App 与端到端验证

- [x] 10.1 创建 `flutter/example/` 示例 App，集成 `flutter_inappwebview` + SDK，演示 Bridge 通信、DataSync 数据推送、AppLink 跳转，验证 Flutter App 可编译运行
- [x] 10.2 端到端验证：在示例 App 中加载 Web 页面，确认 JS→Dart 调用、Dart→JS 调用、DataSync 数据推送、平台检测（`getPlatform()` 返回 `'flutter'`）全部正常工作

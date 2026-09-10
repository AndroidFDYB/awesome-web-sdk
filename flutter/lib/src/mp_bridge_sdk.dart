import 'dart:collection';

import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'bridge/js_bridge_manager.dart';
import 'bridge/bridge_utils.dart';
import 'bridge/app_link_handler.dart';
import 'config/mp_bridge_config.dart';

/// SDK 顶层配置入口
///
/// 提供一键配置 InAppWebView 所需的 initialUserScripts、javascriptHandlers、
/// onLoadStart / onLoadStop 回调。宿主 App 创建 WebView 时调用此方法获取配置。
///
/// 使用示例：
/// ```dart
/// final sdk = MPBridgeSDK(debug: true);
/// final scripts = await sdk.userScripts();
///
/// InAppWebView(
///   initialUrlRequest: URLRequest(url: WebUri(sdk.appendPlatformParam(url))),
///   initialSettings: InAppWebViewSettings(javaScriptEnabled: true),
///   initialUserScripts: scripts,
///   onWebViewCreated: sdk.onWebViewCreated,
///   onLoadStart: sdk.onLoadStart,
///   onLoadStop: sdk.onLoadStop,
/// )
/// ```
class MPBridgeSDK {
  final JSBridgeManager bridgeManager;
  late final AppLinkHandler appLinkHandler;
  final bool debug;

  /// 创建 SDK 实例
  ///
  /// [debug] 是否开启调试日志。
  /// [appLinkDelegate] 可选的 AppLink 导航委托，不传则 AppLink 仅解析不执行导航。
  MPBridgeSDK({
    this.debug = false,
    AppLinkDelegate? appLinkDelegate,
  })  : bridgeManager = JSBridgeManager(debug: debug) {
    MPBridgeConfig.instance.debug = debug;
    appLinkHandler = AppLinkHandler(bridgeManager, delegate: appLinkDelegate);
  }

  /// 获取 bridge.js UserScript 列表
  ///
  /// 返回包含 bridge.js 的 UserScript（document-start 注入），
  /// 用于传入 InAppWebView 的 initialUserScripts 参数。
  Future<UnmodifiableListView<UserScript>> userScripts() async {
    final userScript = await BridgeUtils.getBridgeUserScript();
    return UnmodifiableListView([userScript]);
  }

  /// WebView 创建回调
  ///
  /// 注册 mpBridge JavaScript Handler，绑定 webController。
  void onWebViewCreated(InAppWebViewController controller) {
    bridgeManager.setWebController(controller);

    // 注册 mpBridge handler：JS → Dart 消息通道
    controller.addJavaScriptHandler(
      handlerName: 'mpBridge',
      callback: (args) => bridgeManager.handleJsMessage(args),
    );
  }

  /// 页面开始加载回调
  void onLoadStart(InAppWebViewController controller, WebUri? url) {
    bridgeManager.setWebController(controller);
  }

  /// 页面加载完成回调
  void onLoadStop(InAppWebViewController controller, WebUri? url) {
    bridgeManager.setWebController(controller);
  }

  /// URL 平台参数注入便捷方法
  String appendPlatformParam(String url) {
    return BridgeUtils.appendPlatformParam(url);
  }
}

import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:mp_web_library/mp_web_library.dart';

/// MP-SDK Flutter 端桥接示例 App
///
/// 演示如何使用 mp_web_library SDK 实现：
/// - Bridge 通信（JS ↔ Dart 双向调用）
/// - DataSync 数据推送（Native → JS）
/// - AppLink 跳转（scheme 解析 + Flutter 路由导航）
/// - Emitter 跨 WebView 事件路由
void main() {
  runApp(const MPBridgeExampleApp());
}

class MPBridgeExampleApp extends StatelessWidget {
  const MPBridgeExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MPBridge Example',
      theme: ThemeData(primarySwatch: Colors.blue),
      initialRoute: '/',
      routes: {
        '/': (_) => const HomePage(),
        '/webview': (_) => const WebViewPage(),
      },
    );
  }
}

// ============================================================
// 首页：展示 SDK 功能入口
// ============================================================

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('MPBridge Flutter Example')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            title: const Text('Bridge 通信示例'),
            subtitle: const Text('JS ↔ Dart 双向调用'),
            trailing: const Icon(Icons.arrow_forward),
            onTap: () => Navigator.pushNamed(context, '/webview'),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// WebView 页面：集成 SDK 桥接
// ============================================================

class WebViewPage extends StatefulWidget {
  const WebViewPage({super.key});

  @override
  State<WebViewPage> createState() => _WebViewPageState();
}

class _WebViewPageState extends State<WebViewPage> {
  // 创建 SDK 实例（开启调试日志，配置 AppLink 导航委托）
  late final MPBridgeSDK _sdk;
  late final DataSyncHelper _dataSyncHelper;

  InAppWebViewSettings? _webViewSettings;
  UnmodifiableListView<UserScript>? _userScripts;
  final String _testUrl = 'https://your-web-page.com';

  @override
  void initState() {
    super.initState();
    _initSDK();
  }

  Future<void> _initSDK() async {
    // 1. 创建 SDK 实例
    _sdk = MPBridgeSDK(
      debug: true,
      appLinkDelegate: _ExampleAppLinkDelegate(context: context),
    );

    // 2. 注册自定义 Native Handler
    _sdk.bridgeManager.registerHandler('getUserInfo', (params) {
      return {'uid': '12345', 'nickname': 'Flutter 用户'};
    });

    _sdk.bridgeManager.registerAsyncHandler('showToast', (params, callback) {
      final message = params is Map ? params['message'] ?? '' : params;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('来自 JS: $message')),
        );
      }
      callback({'success': true});
    });

    // 3. 创建 DataSyncHelper 并推送数据
    _dataSyncHelper = DataSyncHelper(
      _sdk.bridgeManager,
      [DataSyncChannel.USER_INFO, DataSyncChannel.LOAN_INFO],
      debug: true,
    );

    // 使用 codegen 生成的 setter 扩展方法推送数据
    _dataSyncHelper.setUserInfo('{"uid":"12345","nickname":"Flutter 用户","level":5}');
    _dataSyncHelper.setLoanInfo('{"orderId":"LO001","amount":10000,"period":12}');

    // 4. 获取 WebView 配置（包含 bridge.js UserScript）
    final scripts = await _sdk.userScripts();
    if (mounted) {
      setState(() {
        _webViewSettings = InAppWebViewSettings(javaScriptEnabled: true);
        _userScripts = scripts;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('WebView Bridge')),
      body: _webViewSettings == null
          ? const Center(child: CircularProgressIndicator())
          : InAppWebView(
              initialUrlRequest: URLRequest(
                url: WebUri(_sdk.appendPlatformParam(_testUrl)),
              ),
              initialSettings: _webViewSettings!,
              initialUserScripts: _userScripts,
              onWebViewCreated: _sdk.onWebViewCreated,
              onLoadStart: (controller, url) {
                _sdk.onLoadStart(controller, url);
                _dataSyncHelper.notifyPageLoading();
              },
              onLoadStop: (controller, url) {
                _sdk.onLoadStop(controller, url);
                _dataSyncHelper.notifyPageLoaded();
              },
            ),
    );
  }
}

// ============================================================
// AppLink 导航委托实现
// ============================================================

class _ExampleAppLinkDelegate implements AppLinkDelegate {
  final BuildContext context;

  _ExampleAppLinkDelegate({required this.context});

  @override
  void openPage(AppLinkParams params) {
    // 根据 pageName 或 url 进行 Flutter 路由导航
    if (params.url != null) {
      Navigator.pushNamed(context, '/webview');
    }
  }

  @override
  void backToHome() {
    Navigator.popUntil(context, (route) => route.isFirst);
  }

  @override
  void openModal(AppLinkParams params) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(params.title ?? '弹窗'),
        content: Text('AppLink 弹窗: ${params.pageName}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('关闭')),
        ],
      ),
    );
  }

  @override
  void closeAllModals() {
    Navigator.of(context).popUntil((route) => route is! PopupRoute);
  }
}

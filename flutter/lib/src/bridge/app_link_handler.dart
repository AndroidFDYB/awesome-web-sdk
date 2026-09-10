import 'dart:convert';

import 'js_bridge_manager.dart';

/// AppLink 处理结果
class AppLinkResult {
  final int code;
  final String? message;

  AppLinkResult({required this.code, this.message});

  Map<String, dynamic> toJson() => {
        'code': code,
        if (message != null) 'message': message,
      };
}

/// AppLink scheme 解析后的参数
class AppLinkParams {
  final String? pageName;
  final String? url;
  final String? title;
  final bool backHome;

  AppLinkParams({this.pageName, this.url, this.title, this.backHome = false});
}

/// AppLink 导航委托接口
///
/// 宿主 App 实现此接口来自定义页面跳转行为。
abstract class AppLinkDelegate {
  /// 打开目标页面
  void openPage(AppLinkParams params);

  /// 返回首页（弹出到路由栈底）
  void backToHome();

  /// 打开透明弹窗
  void openModal(AppLinkParams params);

  /// 关闭所有透明弹窗
  void closeAllModals();
}

/// AppLink 处理器
///
/// 注册 jump2Native 桥接 Handler，解析 scheme 字符串，
/// 通过委托执行 Flutter 路由导航。
/// 对标 iOS MPAppLinkHandler。
class AppLinkHandler {
  final JSBridgeManager bridgeManager;
  AppLinkDelegate? delegate;
  final List<String> _modalStack = [];

  /// 透明弹窗页面名
  static const String kTransparentPage = 'transparent';

  AppLinkHandler(this.bridgeManager, {this.delegate}) {
    _registerHandler();
  }

  void _registerHandler() {
    bridgeManager.registerAsyncHandler('jump2Native', _handleJump2Native);
  }

  void _handleJump2Native(dynamic params, void Function(dynamic) callback) {
    String scheme = '';
    if (params is Map && params.containsKey('scheme')) {
      scheme = params['scheme'] as String? ?? '';
    } else if (params is String) {
      scheme = params;
    }

    final parsed = _parseScheme(scheme);
    if (parsed == null) {
      callback(AppLinkResult(code: -1, message: 'Invalid scheme').toJson());
      return;
    }

    // 回首页处理
    if (parsed.backHome) {
      _closeAllModals();
      delegate?.backToHome();
    }

    // 判断是否为透明弹窗
    if (parsed.pageName == kTransparentPage) {
      _modalStack.add(parsed.pageName!);
      delegate?.openModal(parsed);
    } else {
      delegate?.openPage(parsed);
    }

    callback(AppLinkResult(code: 0, message: 'success').toJson());
  }

  /// 解析 scheme 字符串
  ///
  /// 格式: sk://native={"pageName":"xxx","url":"xxx","backHome":true}
  AppLinkParams? _parseScheme(String scheme) {
    if (scheme.isEmpty) return null;

    try {
      // 提取 native= 后面的 JSON
      final nativePrefix = 'native=';
      final idx = scheme.indexOf(nativePrefix);
      if (idx < 0) return null;

      final jsonStr = scheme.substring(idx + nativePrefix.length);
      // URL 解码
      final decoded = Uri.decodeComponent(jsonStr);
      final map = jsonDecode(decoded) as Map<String, dynamic>;

      return AppLinkParams(
        pageName: map['pageName'] as String?,
        url: map['url'] as String?,
        title: map['title'] as String?,
        backHome: map['backHome'] == true,
      );
    } catch (e) {
      return null;
    }
  }

  void _closeAllModals() {
    if (_modalStack.isNotEmpty) {
      delegate?.closeAllModals();
      _modalStack.clear();
    }
  }
}

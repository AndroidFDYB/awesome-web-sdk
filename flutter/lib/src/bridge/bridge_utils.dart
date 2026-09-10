import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// 桥接工具类
///
/// 提供 URL 平台参数注入和 bridge.js 脚本注入配置。
/// 对标 iOS MPBridgeUtils / 鸿蒙 BridgeUtils。
class BridgeUtils {
  /// Flutter 平台标识
  static const String platformValue = 'flutter';

  /// URL 平台参数键名
  static const String platformQueryKey = 'platform';

  /// 在 URL 上追加 ?platform=flutter 参数
  ///
  /// 如果 URL 已含 platform 参数则不重复追加。
  static String appendPlatformParam(String url) {
    final uri = Uri.parse(url);
    if (uri.queryParameters.containsKey(platformQueryKey)) {
      return url;
    }
    final newParams = Map<String, String>.from(uri.queryParameters);
    newParams[platformQueryKey] = platformValue;
    return uri.replace(queryParameters: newParams).toString();
  }

  /// 获取 bridge.js 注入脚本内容
  ///
  /// 从 Flutter assets 中读取 bridge.js 文件内容。
  static Future<String> loadBridgeJs() async {
    return await rootBundle.loadString('packages/mp_web_library/assets/bridge.js');
  }

  /// 获取 bridge.js 的 UserScript 配置（document-start 注入）
  ///
  /// 宿主 App 创建 InAppWebView 时将此配置传入 initialUserScripts。
  static Future<UserScript> getBridgeUserScript() async {
    final js = await loadBridgeJs();
    return UserScript(
      source: js,
      injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
    );
  }
}

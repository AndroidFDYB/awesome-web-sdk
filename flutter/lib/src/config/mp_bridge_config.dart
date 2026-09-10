/// 全局配置
///
/// 对标 Android MPBridgeConfig。
class MPBridgeConfig {
  static final MPBridgeConfig _instance = MPBridgeConfig._();
  static MPBridgeConfig get instance => _instance;

  MPBridgeConfig._();

  /// 调试模式（输出日志）
  bool debug = false;

  /// 日志 TAG
  String logTag = 'MPBridge';

  /// 异步调用超时时间（毫秒）
  int callTimeout = 30000;
}

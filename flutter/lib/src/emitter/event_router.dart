import '../bridge/js_bridge_manager.dart';

/// 宿主容器名常量
const String kHostContainer = 'host';

/// postToNative / postToWeb 方法名
const String kPostToNativeMethod = 'postToNative';
const String kPostToWebMethod = 'postToWeb';

/// 跨 WebView 事件路由器
///
/// 支持按容器名将事件路由到对应 WebView 实例，
/// 支持宿主容器事件的直接消费。
/// 对标 iOS MPEventRouter / 鸿蒙 EventRouter。
class EventRouter {
  final Map<String, _ContainerEntry> _containers = {};
  void Function(String event, dynamic data)? onHostEvent;

  /// 注册 WebView 容器
  ///
  /// [containerName] 为容器名（事件第一级），
  /// [bridgeManager] 为该容器对应的 JSBridgeManager 实例。
  void registerContainer(
      String containerName, JSBridgeManager bridgeManager) {
    _containers[containerName] = _ContainerEntry(
      name: containerName,
      bridgeManager: bridgeManager,
    );

    // 注册 postToNative handler
    bridgeManager.registerAsyncHandler(kPostToNativeMethod, (params, callback) {
      _handlePostToNative(containerName, params);
      callback({'success': true});
    });
  }

  /// 注销容器
  void unregisterContainer(String containerName) {
    _containers.remove(containerName);
  }

  /// 处理 postToNative 消息
  void _handlePostToNative(String sourceContainer, dynamic params) {
    String event = '';
    dynamic data;

    if (params is Map) {
      event = params['event'] as String? ?? '';
      data = params['data'];
    }

    if (event.isEmpty) return;

    // 解析四级事件: container:scope:model:event
    final parts = event.split(':');
    if (parts.length < 4) return;

    final targetContainer = parts[0];

    // host 事件由 Native 直接消费
    if (targetContainer == kHostContainer) {
      onHostEvent?.call(event, data);
      return;
    }

    // 路由到目标容器
    final target = _containers[targetContainer];
    if (target == null) {
      // 目标容器未注册，安全丢弃
      return;
    }

    // 转发到目标 WebView
    target.bridgeManager.callJs(kPostToWebMethod, args: [
      {'event': event, 'data': data}
    ]);
  }
}

class _ContainerEntry {
  final String name;
  final JSBridgeManager bridgeManager;

  _ContainerEntry({required this.name, required this.bridgeManager});
}

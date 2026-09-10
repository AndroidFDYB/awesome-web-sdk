import 'js_bridge_manager.dart';

/// 数据同步状态
enum SyncState {
  idle,
  loading,
  loaded,
  synced,
}

/// 数据同步辅助器
///
/// 管理通道数据状态与页面加载状态，在页面加载完成后将已就绪的数据推送到前端。
/// 对标 Android MPDataSyncHelper / iOS MPDataSyncHelper / 鸿蒙 DataSyncHelper。
class DataSyncHelper {
  final JSBridgeManager bridgeManager;
  final List<String> requiredChannels;
  final bool debug;

  SyncState _state = SyncState.idle;
  final Map<String, String> _channelData = {};
  final Set<String> _pushedChannels = {};

  DataSyncHelper(
    this.bridgeManager,
    this.requiredChannels, {
    this.debug = false,
  });

  /// 当前同步状态
  SyncState get state => _state;

  /// 检查是否全部同步完成
  bool isAllDataSynced() {
    if (requiredChannels.isEmpty) return true;
    return _pushedChannels.containsAll(requiredChannels);
  }

  /// 设置指定通道的业务数据
  ///
  /// 如果页面已加载完成，立即推送到前端。
  void setData(String channel, String data) {
    _channelData[channel] = data;
    _log('setData: $channel');

    if (_state == SyncState.loaded || _state == SyncState.synced) {
      _pushChannelData(channel);
    }
  }

  /// 通知页面开始加载
  void notifyPageLoading() {
    _state = SyncState.loading;
    _log('notifyPageLoading');
  }

  /// 通知页面加载完成
  ///
  /// 触发推送所有已就绪的通道数据。
  void notifyPageLoaded() {
    _state = SyncState.loaded;
    _log('notifyPageLoaded');
    pushPendingData();
  }

  /// 推送所有已就绪但未推送的通道数据
  void pushPendingData() {
    for (final channel in requiredChannels) {
      if (_channelData.containsKey(channel) &&
          !_pushedChannels.contains(channel)) {
        _pushChannelData(channel);
      }
    }
    if (isAllDataSynced()) {
      _state = SyncState.synced;
      _log('All channels synced');
    }
  }

  /// 推送指定通道的数据到前端
  void _pushChannelData(String channel) {
    final data = _channelData[channel];
    if (data == null) return;

    final methodName = _getSyncMethodName(channel);
    _log('Pushing data: $channel -> $methodName');
    bridgeManager.callJs(methodName, args: [data]);
    _pushedChannels.add(channel);
  }

  /// 根据通道名获取对应的 JSBridge 方法名
  ///
  /// 标准通道使用 codegen 生成的方法名，
  /// 自定义通道自动生成 "syncXxx" 格式。
  String _getSyncMethodName(String channel) {
    if (channel.isEmpty) return 'sync';
    final capitalized = channel[0].toUpperCase() + channel.substring(1);
    return 'sync$capitalized';
  }

  /// 重置状态
  void reset() {
    _state = SyncState.idle;
    _channelData.clear();
    _pushedChannels.clear();
  }

  void _log(String msg) {
    if (debug) {
      print('[MPBridge/DataSync] $msg');
    }
  }
}

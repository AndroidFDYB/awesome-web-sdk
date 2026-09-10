// AUTO-GENERATED from proto. DO NOT EDIT.
// ignore_for_file: constant_identifier_names

import 'data_sync_channels.dart';

/// Native → JS 推送数据时调用的 JSBridge 方法名
///
/// 由 proto codegen 自动生成，对标鸿蒙 DataSyncMethods.ets。
class DataSyncMethod {
  static const String SYNC_USER_INFO = 'syncUserInfo';
  static const String SYNC_LOAN_INFO = 'syncLoanInfo';
  static const String SYNC_VIP_INFO = 'syncVipInfo';
  static const String SYNC_LEAD_INFO = 'syncLeadInfo';

  /// 根据通道名获取对应的 JSBridge 方法名
  ///
  /// 标准通道使用预定义方法名，自定义通道自动生成 "syncXxx" 格式。
  static String fromChannel(String channel) {
    switch (channel) {
      case DataSyncChannel.USER_INFO:
        return DataSyncMethod.SYNC_USER_INFO;
      case DataSyncChannel.LOAN_INFO:
        return DataSyncMethod.SYNC_LOAN_INFO;
      case DataSyncChannel.VIP_INFO:
        return DataSyncMethod.SYNC_VIP_INFO;
      case DataSyncChannel.LEAD_INFO:
        return DataSyncMethod.SYNC_LEAD_INFO;
      default:
        final capitalized = channel.isNotEmpty
            ? channel[0].toUpperCase() + channel.substring(1)
            : '';
        return 'sync$capitalized';
    }
  }
}

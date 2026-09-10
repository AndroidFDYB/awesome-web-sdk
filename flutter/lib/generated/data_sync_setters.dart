// AUTO-GENERATED from proto. DO NOT EDIT.

import 'data_sync_channels.dart';
import '../src/bridge/data_sync_helper.dart';

/// DataSyncHelper 的 setter 扩展方法
///
/// 由 proto codegen 自动生成，对标鸿蒙 DataSyncSetters.ets。
/// 使用方式：`dataSyncHelper.setUserInfo(jsonStr)`
extension DataSyncSetters on DataSyncHelper {

  /// - 字段编号从 1 开始连续递增
  void setUserInfo(String data) {
    setData(DataSyncChannel.USER_INFO, data);
  }

  /// LoanInfo 数据
  void setLoanInfo(String data) {
    setData(DataSyncChannel.LOAN_INFO, data);
  }

  /// VipInfo 数据
  void setVipInfo(String data) {
    setData(DataSyncChannel.VIP_INFO, data);
  }

  /// LeadInfo 数据
  void setLeadInfo(String data) {
    setData(DataSyncChannel.LEAD_INFO, data);
  }
}

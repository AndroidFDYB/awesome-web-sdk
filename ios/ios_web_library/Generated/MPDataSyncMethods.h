// AUTO-GENERATED from proto. DO NOT EDIT.

/**
 * Native → JS 推送数据时调用的 JSBridge 方法名
 * 由 proto codegen 自动生成
 *
 * 对应鸿蒙端 generated/DataSyncMethods.ets
 */
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString * const MPDataSyncMethodSyncUserInfo;
FOUNDATION_EXPORT NSString * const MPDataSyncMethodSyncLoanInfo;
FOUNDATION_EXPORT NSString * const MPDataSyncMethodSyncVipInfo;
FOUNDATION_EXPORT NSString * const MPDataSyncMethodSyncLeadInfo;

@interface MPDataSyncMethods : NSObject

/**
 * 根据通道名获取对应的 JSBridge 方法名
 * 标准通道使用预定义方法名，自定义通道自动生成 "syncXxx" 格式
 */
+ (NSString *)methodFromChannel:(NSString *)channel;

@end

NS_ASSUME_NONNULL_END

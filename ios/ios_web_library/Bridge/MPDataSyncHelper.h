/**
 * 数据同步辅助器（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 DataSyncHelper.ets。
 *
 * iOS 端业务数据同步管理器，解决 WebView 中 Native → Web 大数据量传递的时序问题。
 *
 * 与 Android 端 MPDataSyncHelper、鸿蒙端 DataSyncHelper 功能对等，
 * 由调用方直接声明所需数据通道（构造注入，无注解/反射）。
 *
 * 数据推送时机：
 * 1. 页面已加载 + 数据已就绪 → 立即推送
 * 2. 页面已加载 + 数据未就绪 → 等待数据到达后推送
 * 3. 页面未加载 + 数据已就绪 → 等待页面加载完成后推送
 *
 * 使用方式：
 * @code
 * MPJSBridgeManager *bridgeManager = [[MPJSBridgeManager alloc] initWithDebug:YES];
 * MPDataSyncHelper *dataSyncHelper = [[MPDataSyncHelper alloc] initWithBridgeManager:bridgeManager
 *                                                                    requiredChannels:@[MPDataSyncChannelUserInfo, MPDataSyncChannelLoanInfo]
 *                                                                            debug:YES];
 *
 * // 设置业务数据（可在页面加载前或后）
 * [dataSyncHelper setUserInfo:@"{\"uid\":\"123\",\"ticket\":\"abc\"}"];   // Generated 分类方法
 * [dataSyncHelper setLoanInfo:@"{\"loanId\":\"L001\",\"amount\":50000}"];
 * @endcode
 */
#import <Foundation/Foundation.h>

#import "MPJSBridgeManager.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * WebView 数据同步状态
 * Idle → Loading → Loaded → Synced
 */
typedef NS_ENUM(NSInteger, MPSyncState) {
    /** 初始状态 */
    MPSyncStateIdle = 0,
    /** 页面加载中 */
    MPSyncStateLoading,
    /** 页面已加载，等待或正在推送数据 */
    MPSyncStateLoaded,
    /** 所有数据已推送完成 */
    MPSyncStateSynced,
};

@interface MPDataSyncHelper : NSObject

/**
 * 构造函数
 *
 * @param bridgeManager JSBridge 管理器实例
 * @param requiredChannels 所需数据通道列表（如 @[MPDataSyncChannelUserInfo, MPDataSyncChannelLoanInfo]）
 * @param debug 是否开启调试日志
 */
- (instancetype)initWithBridgeManager:(MPJSBridgeManager *)bridgeManager
                      requiredChannels:(NSArray<NSString *> *)requiredChannels
                                debug:(BOOL)debug;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

/** 获取所需数据通道列表 */
- (NSArray<NSString *> *)requiredChannels;

/** 获取当前同步状态 */
- (MPSyncState)syncState;

/**
 * 通知页面已加载完成
 * 应在 WKNavigationDelegate 的 didFinishNavigation 回调中调用
 * 触发推送已就绪的业务数据到前端
 */
- (void)notifyPageLoaded;

/**
 * 通知页面开始加载
 * 应在 WKNavigationDelegate 的 didStartProvisionalNavigation 回调中调用
 * 重置推送状态（新页面需要重新推送）
 */
- (void)notifyPageLoading;

// setUserInfo: / setLoanInfo: / setVipInfo: 由 proto codegen 生成
// 参见 Generated/MPDataSyncHelper+Generated.h

/**
 * 设置指定通道的业务数据
 * 如果页面已加载，会立即尝试推送
 *
 * @param channel 通道名称
 * @param data JSON 字符串
 */
- (void)setData:(NSString *)channel data:(NSString *)data;

/** 检查指定通道的数据是否已推送 */
- (BOOL)isDataSynced:(NSString *)channel;

/** 检查所有所需通道的数据是否已推送完成 */
- (BOOL)isAllDataSynced;

/** 检查指定通道的数据是否已设置 */
- (BOOL)hasData:(NSString *)channel;

/** 重置所有状态（加载新页面前调用） */
- (void)reset;

@end

NS_ASSUME_NONNULL_END

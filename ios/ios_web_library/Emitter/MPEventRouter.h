/**
 * MPEventRouter - 跨 WebView 事件路由器（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 EventRouter.ets。
 *
 * 实现跨 WebView 的 emitter 通信：前端通过 JSBridge postToNative 方法
 * 将四级格式事件（container:scope:model:event）发送到 Native，
 * Native 根据第一级容器名路由到目标 WebView，再通过 postToWeb 转发给前端。
 *
 * 容器名映射：
 * - vip    → WebViewForVip
 * - loan   → WebViewForLoan
 * - lead   → WebViewForLead
 * - common → WebViewForCommon
 * - host   → Native 端直接消费（不转发）
 *
 * 使用方式：
 * @code
 * MPEventRouter *eventRouter = [[MPEventRouter alloc] initWithDebug:YES];
 *
 * // 注册各 WebView（自动注册 postToNative Handler）
 * [eventRouter registerWebView:MPEventRouterContainerVIP bridgeManager:vipBridgeManager];
 * [eventRouter registerWebView:MPEventRouterContainerLoan bridgeManager:loanBridgeManager];
 *
 * // 监听 host 事件
 * [eventRouter onHostEvent:^(NSString *event, NSString *data) {
 *     NSLog(@"Host event: %@, data: %@", event, data);
 * }];
 *
 * // 页面销毁时注销
 * [eventRouter unregisterWebView:MPEventRouterContainerVIP];
 * @endcode
 *
 * 注意：请以强引用持有 EventRouter 实例，且其生命周期需覆盖所有已注册的 WebView
 * （内部对 bridgeManager 的 Handler 使用弱引用，避免 manager ↔ router 引用循环）。
 */
#import <Foundation/Foundation.h>

#import "MPJSBridgeManager.h"

NS_ASSUME_NONNULL_BEGIN

/** 容器名：VIP 会员页面 */
FOUNDATION_EXPORT NSString * const MPEventRouterContainerVIP;

/** 容器名：借款页面 */
FOUNDATION_EXPORT NSString * const MPEventRouterContainerLoan;

/** 容器名：线索页面 */
FOUNDATION_EXPORT NSString * const MPEventRouterContainerLead;

/** 容器名：通用页面 */
FOUNDATION_EXPORT NSString * const MPEventRouterContainerCommon;

/** 容器名：Native 端（直接消费，不转发） */
FOUNDATION_EXPORT NSString * const MPEventRouterContainerHost;

@interface MPEventRouter : NSObject

/**
 * 构造函数
 *
 * @param debug 是否开启调试日志
 */
- (instancetype)initWithDebug:(BOOL)debug;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

/**
 * 注册 WebView 并自动注册 postToNative Handler
 *
 * 注册后，该 WebView 内的前端调用 postToNative 时，
 * 事件会被路由到对应容器的 WebView。
 *
 * @param container 容器名
 * @param bridgeManager 对应的 MPJSBridgeManager 实例
 */
- (void)registerWebView:(NSString *)container bridgeManager:(MPJSBridgeManager *)bridgeManager;

/**
 * 注销 WebView（页面销毁时调用，防止内存泄漏）
 *
 * @param container 容器名
 */
- (void)unregisterWebView:(NSString *)container;

/**
 * 注册 host 事件处理器
 *
 * 当第一级容器名为 "host" 时，Native 直接消费事件，
 * 调用此处理器，不转发给任何 WebView。
 *
 * @param handler 事件处理器（event 为四级事件名，data 为数据 JSON 字符串）
 */
- (void)onHostEvent:(void (^)(NSString *event, NSString *data))handler;

/**
 * 清除所有注册（防止内存泄漏）
 * 页面完全销毁时调用
 */
- (void)clear;

@end

NS_ASSUME_NONNULL_END

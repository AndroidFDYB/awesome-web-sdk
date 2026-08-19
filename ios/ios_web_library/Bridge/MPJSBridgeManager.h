/**
 * JSBridge 核心管理类（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 JSBridge.ets。
 *
 * 负责 Handler 的注册、分发和 Native->JS 调用管理。
 * - JS -> Native：通过 MPDsBridgeProxy（WKScriptMessageHandler）接收消息并分发到注册的 Handler
 * - Native -> JS：通过 WKWebView evaluateJavaScript 调用 window.dsBridge._handleNativeCall
 *
 * 协议兼容 DSBridge（wendux），与鸿蒙端 bridge.js 协议一致，
 * 前端 SDK（@mp-sdk/bridge）可使用统一的 dsBridge API。
 *
 * 与鸿蒙端的差异（平台机制限制）：
 * - 鸿蒙 javaScriptProxy 支持同步调用同步返回（handleSyncCall 直接返回字符串给 JS）
 * - iOS WKWebView 的 messageHandler 为异步通道：
 *   dsBridge.call() 同步调用降级为异步（结果通过回调返回），请优先使用 callAsync()
 *
 * 线程：请在主线程调用本类的所有方法（WKWebView 本身要求主线程操作）。
 */
#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>

#import "MPBridgeHandler.h"

NS_ASSUME_NONNULL_BEGIN

@interface MPJSBridgeManager : NSObject

/** 调试模式（开启后输出日志） */
@property (nonatomic, assign, readonly) BOOL debug;

/**
 * 构造函数
 *
 * @param debug 是否开启调试日志
 */
- (instancetype)initWithDebug:(BOOL)debug;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

/**
 * 绑定 WebView（对应鸿蒙 setWebController）
 * 绑定后 Native -> JS 调用会通过该 WebView 执行
 */
- (void)bindWebView:(WKWebView *)webView;

/**
 * 注册同步 Handler
 *
 * @param method 方法名
 * @param handler 同步处理器
 */
- (void)registerHandler:(NSString *)method handler:(MPSyncBridgeHandler)handler;

/**
 * 注册异步 Handler
 *
 * @param method 方法名
 * @param handler 异步处理器
 */
- (void)registerAsyncHandler:(NSString *)method handler:(MPAsyncBridgeHandler)handler;

/**
 * 检查方法是否已注册（供 MPDsBridgeProxy 调用）
 *
 * @param method 方法名
 * @returns 是否已注册
 */
- (BOOL)hasMethod:(NSString *)method;

/**
 * 处理 JS 同步调用（供 MPDsBridgeProxy 调用）
 *
 * 注意：iOS 消息通道为异步，本方法返回的响应字符串由 Proxy
 * 通过 sendResponseJsonToJs: 异步推送给 JS（对等鸿蒙同步返回的语义）。
 *
 * @param requestJson BridgeRequest JSON 字符串
 * @returns BridgeResponse JSON 字符串
 */
- (nullable NSString *)handleSyncCall:(NSString *)requestJson;

/**
 * 处理 JS 异步调用（供 MPDsBridgeProxy 调用）
 * 结果通过 sendResponseJsonToJs: 异步回传给 JS
 *
 * @param requestJson BridgeRequest JSON 字符串
 */
- (void)handleAsyncCall:(NSString *)requestJson;

/**
 * Native 调用 JS 方法（对应鸿蒙 callJs）
 *
 * @param method JS 方法名
 * @param args 参数数组（JSON 字符串数组）
 * @param callback 返回值回调（可选，结果由 JS 端通过 nativeCallComplete 回传）
 */
- (void)callJsMethod:(NSString *)method
                args:(nullable NSArray<NSString *> *)args
            callback:(nullable void (^)(NSString *result))callback;

/**
 * 处理 JS 端对 Native 调用的返回（供 MPDsBridgeProxy 调用）
 *
 * @param callbackId 回调 ID
 * @param result 结果 JSON 字符串
 */
- (void)onNativeCallComplete:(NSString *)callbackId result:(NSString *)result;

/**
 * 将 BridgeResponse JSON 字符串推送给 JS
 * 内部通过 evaluateJavaScript 调用 window.dsBridge._handleResponse(...)
 */
- (void)sendResponseJsonToJs:(NSString *)responseJson;

/**
 * 将 hasMethod 查询结果推送给 JS（更新 bridge.js 的方法存在性缓存）
 */
- (void)notifyHasMethodResult:(NSString *)method hasMethod:(BOOL)hasMethod;

@end

NS_ASSUME_NONNULL_END

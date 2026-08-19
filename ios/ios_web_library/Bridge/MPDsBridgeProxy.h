/**
 * WKScriptMessageHandler 消息代理（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 DsBridgeProxy.ets。
 *
 * 鸿蒙端通过 javaScriptProxy 将 DsBridgeProxy 注入为 window._dsbridge 原生对象（同步调用）；
 * iOS WKWebView 无同步注入机制，改为消息通道：
 * - JS 端通过 window.webkit.messageHandlers.mpBridge.postMessage({type, payload}) 发送消息
 * - 本类作为 WKScriptMessageHandler 接收消息，转发给 MPJSBridgeManager 处理
 *
 * 消息格式：{ "type": "call" | "callAsync" | "hasMethod" | "nativeCallComplete", "payload": "..." }
 *
 * 注意：本类对 manager 持弱引用（避免 WKUserContentController -> proxy -> manager 引用循环），
 * 请确保 manager 的生命周期覆盖 WebView。
 *
 * 使用方式（低侵入模式，业务方使用自己的 WKWebView）：
 * @code
 * MPJSBridgeManager *bridgeManager = [[MPJSBridgeManager alloc] initWithDebug:YES];
 * MPDsBridgeProxy *proxy = [[MPDsBridgeProxy alloc] initWithManager:bridgeManager];
 *
 * WKUserContentController *ucc = webView.configuration.userContentController;
 * [ucc addScriptMessageHandler:proxy name:[MPDsBridgeProxy messageHandlerName]];
 * @endcode
 */
#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>

#import "MPJSBridgeManager.h"

NS_ASSUME_NONNULL_BEGIN

@interface MPDsBridgeProxy : NSObject <WKScriptMessageHandler>

/** 消息通道名（JS 端：window.webkit.messageHandlers.<name>） */
+ (NSString *)messageHandlerName;

- (instancetype)initWithManager:(MPJSBridgeManager *)manager;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END

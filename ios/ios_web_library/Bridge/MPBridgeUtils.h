/**
 * MPBridgeUtils — iOS 端桥接工具类
 *
 * 对应鸿蒙端 BridgeUtils.ets。
 *
 * 提供桥接注入和平台参数追加的静态工具方法，
 * 供页面直接使用原生 WKWebView 时调用，降低 SDK 侵入性。
 *
 * 使用方式（低侵入模式：原生 WKWebView + 工具注入）：
 * @code
 * MPJSBridgeManager *bridgeManager = [[MPJSBridgeManager alloc] initWithDebug:YES];
 * MPDataSyncHelper *dataSyncHelper = [[MPDataSyncHelper alloc] initWithBridgeManager:bridgeManager
 *                                                                    requiredChannels:@[MPDataSyncChannelUserInfo, MPDataSyncChannelLoanInfo]
 *                                                                            debug:YES];
 * MPDsBridgeProxy *dsBridgeProxy = [[MPDsBridgeProxy alloc] initWithManager:bridgeManager];
 *
 * // viewDidLoad 中：
 * WKUserContentController *ucc = self.webView.configuration.userContentController;
 * [ucc addScriptMessageHandler:dsBridgeProxy name:[MPDsBridgeProxy messageHandlerName]];
 * // document-start 注入 bridge.js（推荐方式，页面脚本执行前就绪）
 * WKUserScript *script = [MPBridgeUtils bridgeUserScript];
 * if (script) {
 *     [ucc addUserScript:script];
 * }
 *
 * // WKNavigationDelegate 回调中：
 * // - didStartProvisionalNavigation → [bridgeManager bindWebView:self.webView]; [dataSyncHelper notifyPageLoading];
 * // - didFinishNavigation → [dataSyncHelper notifyPageLoaded];
 *
 * // 加载页面（自动追加 platform=ios 参数）：
 * NSURL *url = [NSURL URLWithString:[MPBridgeUtils appendPlatformParam:@"https://example.com/loan"]];
 * [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
 * @endcode
 */
#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface MPBridgeUtils : NSObject

/**
 * 在 URL 上追加 platform=ios 查询参数
 * 如果 URL 已包含 platform 参数则不重复追加
 *
 * @param url 原始 URL
 * @returns 追加平台参数后的 URL
 */
+ (NSString *)appendPlatformParam:(NSString *)url;

/**
 * 从 Bundle 加载 bridge.js 源码
 * 查找顺序：类所在 Bundle（含子 Bundle，CocoaPods resource_bundles 场景）→ 主 Bundle → 所有已加载 Bundle
 *
 * @returns bridge.js 源码，找不到返回 nil
 */
+ (nullable NSString *)bridgeJavaScriptString;

/**
 * 构造 bridge.js 的 WKUserScript（document-start 注入，推荐）
 *
 * @returns WKUserScript 实例，bridge.js 加载失败返回 nil
 */
+ (nullable WKUserScript *)bridgeUserScript;

/**
 * 手动注入 bridge.js（对等鸿蒙端 onPageBegin 时 runJavaScript 注入的备选方式）
 *
 * @param webView 目标 WebView
 */
+ (void)injectBridgeScript:(WKWebView *)webView;

@end

NS_ASSUME_NONNULL_END

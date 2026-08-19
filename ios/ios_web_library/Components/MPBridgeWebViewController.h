/**
 * MPBridgeWebViewController 组件（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 MPBridgeWeb.ets 组件。
 * 基于 WKWebView 封装的 JSBridge WebView 控制器。
 * 通过 WKUserScript 注入 bridge.js + WKScriptMessageHandler 接收 JS 消息，
 * 实现 JS <-> Native 双向通信。
 *
 * 自动集成数据同步辅助器：
 * - 加载 URL 时自动追加 ?platform=ios 查询参数
 * - 页面开始加载时通知 [MPDataSyncHelper notifyPageLoading]（重置推送状态）
 * - 页面加载完成时通知 [MPDataSyncHelper notifyPageLoaded]（触发数据推送）
 *
 * 使用方式：
 * @code
 * MPJSBridgeManager *bridgeManager = [[MPJSBridgeManager alloc] initWithDebug:YES];
 * MPDataSyncHelper *dataSyncHelper = [[MPDataSyncHelper alloc] initWithBridgeManager:bridgeManager
 *                                                                    requiredChannels:@[MPDataSyncChannelUserInfo, MPDataSyncChannelLoanInfo]
 *                                                                            debug:YES];
 * // 设置业务数据（可在页面加载前或后）
 * [dataSyncHelper setUserInfo:@"{\"uid\":\"123\",\"ticket\":\"abc\"}"];
 * [dataSyncHelper setLoanInfo:@"{\"loanId\":\"L001\",\"amount\":50000}"];
 *
 * MPBridgeWebViewController *vc = [[MPBridgeWebViewController alloc] initWithURL:@"https://your-page.com"
 *                                                                   bridgeManager:bridgeManager
 *                                                                  dataSyncHelper:dataSyncHelper
 *                                                                           debug:YES];
 * [self.navigationController pushViewController:vc animated:YES];
 * @endcode
 */
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

#import "MPJSBridgeManager.h"
#import "MPDataSyncHelper.h"

NS_ASSUME_NONNULL_BEGIN

@interface MPBridgeWebViewController : UIViewController

/** JSBridge 管理器实例 */
@property (nonatomic, strong, readonly) MPJSBridgeManager *bridgeManager;

/** 数据同步辅助器（未传入时自动创建空通道辅助器） */
@property (nonatomic, strong, readonly) MPDataSyncHelper *dataSyncHelper;

/** 内部持有的 WKWebView */
@property (nonatomic, strong, readonly) WKWebView *webView;

/**
 * 初始化组件
 *
 * @param url 要加载的 URL
 * @param bridgeManager JSBridge 管理器实例
 * @param dataSyncHelper 数据同步辅助器（传 nil 则自动创建空通道辅助器）
 * @param debug 是否开启调试模式
 */
- (instancetype)initWithURL:(NSString *)url
              bridgeManager:(MPJSBridgeManager *)bridgeManager
             dataSyncHelper:(nullable MPDataSyncHelper *)dataSyncHelper
                      debug:(BOOL)debug;

/** 初始化组件（使用自动创建的空通道数据同步辅助器） */
- (instancetype)initWithURL:(NSString *)url
              bridgeManager:(MPJSBridgeManager *)bridgeManager
                      debug:(BOOL)debug;

/**
 * 加载页面（自动追加 platform=ios 参数）
 * 页面加载状态会自动通知 dataSyncHelper
 */
- (void)loadBridgeURL:(NSString *)url;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END

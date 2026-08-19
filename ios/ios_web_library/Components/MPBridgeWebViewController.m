#import "MPBridgeWebViewController.h"
#import "MPDsBridgeProxy.h"
#import "MPBridgeUtils.h"

@interface MPBridgeWebViewController () <WKNavigationDelegate>

@property (nonatomic, strong, readwrite) MPJSBridgeManager *bridgeManager;
@property (nonatomic, strong, readwrite) MPDataSyncHelper *dataSyncHelper;
@property (nonatomic, strong, readwrite) WKWebView *webView;

/** 初始化时传入的 URL（viewDidLoad 时加载） */
@property (nonatomic, copy) NSString *initialUrl;

/** 调试模式 */
@property (nonatomic, assign) BOOL debugFlag;

@end

@implementation MPBridgeWebViewController

#pragma mark - 生命周期

- (instancetype)initWithURL:(NSString *)url
              bridgeManager:(MPJSBridgeManager *)bridgeManager
             dataSyncHelper:(nullable MPDataSyncHelper *)dataSyncHelper
                      debug:(BOOL)debug {
    self = [super init];
    if (self) {
        _bridgeManager = bridgeManager;
        // 未传入时创建空通道辅助器（页面加载通知为空操作）
        _dataSyncHelper = dataSyncHelper ?: [[MPDataSyncHelper alloc] initWithBridgeManager:bridgeManager
                                                                            requiredChannels:@[]
                                                                                    debug:debug];
        _initialUrl = [url copy];
        _debugFlag = debug;
    }
    return self;
}

- (instancetype)initWithURL:(NSString *)url
              bridgeManager:(MPJSBridgeManager *)bridgeManager
                      debug:(BOOL)debug {
    return [self initWithURL:url bridgeManager:bridgeManager dataSyncHelper:nil debug:debug];
}

- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = [UIColor whiteColor];
    [self setupWebView];
    if (self.initialUrl.length > 0) {
        [self loadBridgeURL:self.initialUrl];
    }
}

- (void)setupWebView {
    // 1. 配置消息通道（JS -> Native，对应鸿蒙 javaScriptProxy 注入）
    MPDsBridgeProxy *dsBridgeProxy = [[MPDsBridgeProxy alloc] initWithManager:self.bridgeManager];
    WKUserContentController *userContentController = [[WKUserContentController alloc] init];
    [userContentController addScriptMessageHandler:dsBridgeProxy
                                              name:[MPDsBridgeProxy messageHandlerName]];

    // 2. document-start 注入 bridge.js（提供 window.dsBridge，页面脚本执行前就绪）
    //    对应鸿蒙端 onPageBegin 时注入 rawfile/bridge.js
    WKUserScript *bridgeScript = [MPBridgeUtils bridgeUserScript];
    if (bridgeScript) {
        [userContentController addUserScript:bridgeScript];
    } else {
        NSLog(@"[MPBridgeWeb] Failed to load bridge.js from bundle");
    }

    // 3. 创建 WKWebView
    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    configuration.userContentController = userContentController;

    WKWebView *webView = [[WKWebView alloc] initWithFrame:self.view.bounds configuration:configuration];
    webView.autoresizingMask = (UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight);
    webView.navigationDelegate = self;
    [self.view addSubview:webView];
    self.webView = webView;

    if (self.debugFlag) {
        NSLog(@"[MPBridgeWeb] viewDidLoad, debug mode enabled");
    }
}

- (void)loadBridgeURL:(NSString *)url {
    // 加载 URL，追加平台参数
    NSString *finalUrl = [MPBridgeUtils appendPlatformParam:url];
    NSURL *targetUrl = [NSURL URLWithString:finalUrl];
    if (!targetUrl) {
        NSLog(@"[MPBridgeWeb] invalid url: %@", url);
        return;
    }
    NSURLRequest *request = [NSURLRequest requestWithURL:targetUrl];
    [self.webView loadRequest:request];
}

#pragma mark - WKNavigationDelegate

- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation {
    // 页面开始加载：绑定 WebView（首次或新页面）
    [self.bridgeManager bindWebView:webView];
    // 通知数据同步辅助器页面开始加载（重置推送状态）
    [self.dataSyncHelper notifyPageLoading];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    if (self.debugFlag) {
        NSLog(@"[MPBridgeWeb] page loaded: %@", webView.URL.absoluteString);
    }
    // 通知数据同步辅助器页面加载完成（触发数据推送）
    [self.dataSyncHelper notifyPageLoaded];
}

- (void)dealloc {
    // 移除消息处理器，及时断开 userContentController -> proxy 强引用
    [_webView.configuration.userContentController removeScriptMessageHandlerForName:[MPDsBridgeProxy messageHandlerName]];
}

@end

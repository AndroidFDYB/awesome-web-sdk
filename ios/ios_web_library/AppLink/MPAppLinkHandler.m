#import "MPAppLinkHandler.h"
#import "MPAppLinkParser.h"

NSString * const MPAppLinkJump2NativeMethod = @"jump2Native";

#pragma mark - JSON 工具

static NSString *MPAppLinkJsonStringFromObject(id object) {
    if (!object || object == (id)kCFNull) {
        return nil;
    }
    if (![NSJSONSerialization isValidJSONObject:object]) {
        return nil;
    }
    NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
    if (!data) {
        return nil;
    }
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

static NSDictionary *MPAppLinkJsonObjectFromString(NSString *json) {
    if (json.length == 0) {
        return nil;
    }
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) {
        return nil;
    }
    id object = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    return [object isKindOfClass:[NSDictionary class]] ? object : nil;
}

#pragma mark - MPAppLinkHandler

@interface MPAppLinkHandler ()

/** 调试模式 */
@property (nonatomic, assign, readonly) BOOL debug;

/** 透明弹窗关闭回调列表（注册表模式，对等鸿蒙端链表实现） */
@property (nonatomic, strong) NSMutableArray<dispatch_block_t> *closeBlocks;

@end

@implementation MPAppLinkHandler

- (instancetype)initWithBridgeManager:(MPJSBridgeManager *)bridgeManager
                             delegate:(id<MPAppLinkActionDelegate>)delegate
                                debug:(BOOL)debug {
    self = [super init];
    if (self) {
        _bridgeManager = bridgeManager;
        _delegate = delegate;
        _debug = debug;
        _closeBlocks = [NSMutableArray array];

        // 设置解析器调试模式
        [MPAppLinkParser setDebug:debug];

        // 注册 jump2Native handler
        // 注意使用 __weak 避免 manager → block → handler → manager 引用循环
        __weak typeof(self) weakSelf = self;
        [_bridgeManager registerAsyncHandler:MPAppLinkJump2NativeMethod
                                     handler:^(NSString *params, void (^complete)(NSString *result)) {
                                         __strong typeof(weakSelf) strongSelf = weakSelf;
                                         if (!strongSelf) {
                                             complete(MPAppLinkJsonStringFromObject(@{@"code": @(-1),
                                                                                        @"message": @"AppLinkHandler deallocated"}) ?: @"{}");
                                             return;
                                         }
                                         [strongSelf handleJump2Native:params complete:complete];
                                     }];

        [self logWithFormat:@"AppLinkHandler registered, jump2Native handler ready"];
    }
    return self;
}

#pragma mark - jump2Native 处理

/**
 * 处理 jump2Native 调用
 */
- (void)handleJump2Native:(NSString *)data complete:(void (^)(NSString *result))complete {
    [self logWithFormat:@"jump2Native called with data=%@", data];

    @try {
        // 从 JSON 中提取 scheme
        NSDictionary *json = MPAppLinkJsonObjectFromString(data);
        NSString *scheme = [json[@"scheme"] isKindOfClass:[NSString class]] ? json[@"scheme"] : @"";

        if (scheme.length == 0) {
            [self logWithFormat:@"jump2Native failed: scheme is empty"];
            complete(MPAppLinkJsonStringFromObject(@{@"code": @(-1), @"message": @"scheme is empty"}) ?: @"{}");
            return;
        }

        // 解析 scheme
        MPAppLinkParams *params = [MPAppLinkParser parse:scheme];
        if (!params) {
            [self logWithFormat:@"jump2Native failed: cannot parse scheme=%@", scheme];
            complete(MPAppLinkJsonStringFromObject(@{@"code": @(-1), @"message": @"cannot parse scheme"}) ?: @"{}");
            return;
        }

        // 执行跳转
        [self executeNavigation:params];

        complete(MPAppLinkJsonStringFromObject(@{@"code": @(0), @"message": @"success"}) ?: @"{}");
    } @catch (NSException *exception) {
        [self logWithFormat:@"jump2Native exception: %@", exception];
        complete(MPAppLinkJsonStringFromObject(@{@"code": @(-1),
                                                 @"message": [NSString stringWithFormat:@"exception: %@", exception]}) ?: @"{}");
    }
}

/**
 * 执行导航逻辑
 *
 * SDK 负责配置 VC（强制 .overFullScreen），delegate 负责创建和展示。
 *
 * - backHome 场景：关闭所有透明弹窗 → 转换为 sk://action= 交由根容器处理
 * - 透明弹窗：SDK 强制设置 .overFullScreen + .crossDissolve，delegate 展示
 * - 普通页面：SDK 不修改样式，delegate 自行决定展示方式
 */
- (void)executeNavigation:(MPAppLinkParams *)params {
    [self logWithFormat:@"executeNavigation: pageName=%@, url=%@, backHome=%@",
        params.pageName, params.url, params.backHome ? @"true" : @"false"];

    // backHome 场景：先关闭所有透明弹窗
    if (params.backHome) {
        [self closeAllPopups];

        // 转换为 sk://action= 交由根容器处理
        NSString *actionScheme = [MPAppLinkParser convertToAction:params.rawScheme];
        [self logWithFormat:@"backHome: converted to action scheme=%@", actionScheme];
        [self.delegate handleAction:actionScheme];
        return;
    }

    // 1. Delegate 创建 VC
    UIViewController *vc = [self.delegate createViewControllerForPage:params];
    if (!vc) {
        [self logWithFormat:@"delegate returned nil VC, skip navigation"];
        return;
    }

    BOOL isTransparent = [params.pageName isEqualToString:MPAppLinkPageTransparent];

    // 2. SDK 强制配置（透明弹窗必须 .overFullScreen）
    if (isTransparent) {
        // 主线程保护：modalPresentationStyle 必须在主线程设置
        if ([NSThread isMainThread]) {
            [self configureTransparentVC:vc];
        } else {
            dispatch_sync(dispatch_get_main_queue(), ^{
                [self configureTransparentVC:vc];
            });
        }

        // SDK 内部注册 close block（使用 __weak 安全捕获 VC）
        __weak typeof(vc) weakVC = vc;
        [self addPopup:^{
            [weakVC dismissViewControllerAnimated:YES completion:nil];
        }];
    }

    // 3. Delegate 展示
    [self.delegate presentConfiguredViewController:vc animated:YES completion:nil];
}

/**
 * 配置透明弹窗 VC（强制 .overFullScreen + .crossDissolve）
 */
- (void)configureTransparentVC:(UIViewController *)vc {
    vc.modalPresentationStyle = UIModalPresentationOverFullScreen;
    vc.modalTransitionStyle = UIModalTransitionStyleCrossDissolve;
    [self logWithFormat:@"configured transparent VC: overFullScreen + crossDissolve"];
}

#pragma mark - 透明弹窗管理

/**
 * 添加透明弹窗关闭回调到列表
 *
 * @param closeFn 关闭弹窗的回调函数（SDK 内部使用 __weak 创建，安全）
 */
- (void)addPopup:(dispatch_block_t)closeFn {
    if (!closeFn) {
        return;
    }
    [self.closeBlocks addObject:closeFn];
    [self logWithFormat:@"addPopup: total popups=%lu", (unsigned long)self.closeBlocks.count];
}

/**
 * 关闭所有透明弹窗
 * 在 backHome 时调用，从最新的弹窗开始逐一调用 closeFn 关闭，
 * 并断开引用避免内存泄漏。
 */
- (void)closeAllPopups {
    if (self.closeBlocks.count == 0) {
        return;
    }

    [self logWithFormat:@"closeAllPopups: closing %lu popups", (unsigned long)self.closeBlocks.count];

    // 从尾部开始关闭（最新的先关）
    for (NSInteger i = (NSInteger)self.closeBlocks.count - 1; i >= 0; i--) {
        dispatch_block_t closeFn = self.closeBlocks[i];
        @try {
            closeFn();
        } @catch (NSException *exception) {
            [self logWithFormat:@"closeAllPopups: closeFn exception: %@", exception];
        }
    }

    // 清空列表
    [self.closeBlocks removeAllObjects];

    [self logWithFormat:@"closeAllPopups: all popups closed and references cleared"];
}

- (NSUInteger)popupCount {
    return self.closeBlocks.count;
}

#pragma mark - 日志

- (void)logWithFormat:(NSString *)format, ... {
    if (!self.debug) {
        return;
    }
    va_list args;
    va_start(args, format);
    NSLog(@"[MPBridge/AppLink] %@", [[NSString alloc] initWithFormat:format arguments:args]);
    va_end(args);
}

@end

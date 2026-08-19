#import "MPEventRouter.h"

/** postToNative / postToWeb JSBridge 方法名 */
static NSString * const MPEventRouterMethodPostToNative = @"postToNative";
static NSString * const MPEventRouterMethodPostToWeb = @"postToWeb";

NSString * const MPEventRouterContainerVIP = @"vip";
NSString * const MPEventRouterContainerLoan = @"loan";
NSString * const MPEventRouterContainerLead = @"lead";
NSString * const MPEventRouterContainerCommon = @"common";
NSString * const MPEventRouterContainerHost = @"host";

#pragma mark - JSON 工具

/**
 * 序列化 JSON 对象为字符串
 * 标量（NSString/NSNumber）无法直接序列化，包裹数组后去掉括号
 */
static NSString *MPEventRouterJsonString(id object) {
    if (!object || object == (id)kCFNull) {
        return nil;
    }
    if (![NSJSONSerialization isValidJSONObject:object]) {
        NSString *wrapped = MPEventRouterJsonString(@[object]);
        if (wrapped.length >= 2) {
            return [wrapped substringWithRange:NSMakeRange(1, wrapped.length - 2)];
        }
        return nil;
    }
    NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
    if (!data) {
        return nil;
    }
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

@interface MPEventRouter ()

/** 容器名 → MPJSBridgeManager 映射表 */
@property (nonatomic, strong) NSMutableDictionary<NSString *, MPJSBridgeManager *> *webViews;

/** host 事件处理器（Native 直接消费的事件） */
@property (nonatomic, copy, nullable) void (^hostEventHandler)(NSString *event, NSString *data);

/** 调试模式 */
@property (nonatomic, assign, readwrite) BOOL debug;

@end

@implementation MPEventRouter

- (instancetype)initWithDebug:(BOOL)debug {
    self = [super init];
    if (self) {
        _debug = debug;
        _webViews = [NSMutableDictionary dictionary];
    }
    return self;
}

#pragma mark - 注册管理

- (void)registerWebView:(NSString *)container bridgeManager:(MPJSBridgeManager *)bridgeManager {
    self.webViews[container] = bridgeManager;

    // 注册 postToNative Handler
    // 注意使用 __weak 避免 manager → block → router → manager 引用循环
    __weak MPEventRouter *weakSelf = self;
    MPSyncBridgeHandler handler = ^NSString * _Nullable(NSString *params) {
        return [weakSelf handlePostToNative:params];
    };
    [bridgeManager registerHandler:MPEventRouterMethodPostToNative handler:handler];

    [self logWithFormat:@"registered WebView for container=%@", container];
}

- (void)unregisterWebView:(NSString *)container {
    [self.webViews removeObjectForKey:container];
    [self logWithFormat:@"unregistered WebView for container=%@", container];
}

- (void)onHostEvent:(void (^)(NSString *event, NSString *data))handler {
    self.hostEventHandler = handler;
    [self logWithFormat:@"host event handler registered"];
}

- (void)clear {
    [self.webViews removeAllObjects];
    self.hostEventHandler = nil;
    [self logWithFormat:@"all registrations cleared"];
}

#pragma mark - postToNative 处理

/**
 * 处理前端 postToNative 调用
 *
 * 解析四级事件名，根据第一级容器名路由到目标 WebView：
 * - host：直接消费
 * - vip/loan/lead/common：转发到对应 WebView 的 postToWeb
 * - 非四级格式：忽略（返回错误）
 *
 * @param params JS 传来的 JSON 字符串
 * @returns 处理结果 JSON 字符串
 */
- (nullable NSString *)handlePostToNative:(NSString *)params {
    @try {
        NSData *data = [params dataUsingEncoding:NSUTF8StringEncoding];
        id object = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        if (![object isKindOfClass:[NSDictionary class]]) {
            @throw [NSException exceptionWithName:@"MPEventRouterException"
                                           reason:@"invalid params json"
                                         userInfo:nil];
        }
        NSDictionary *parsed = (NSDictionary *)object;
        NSString *event = [parsed[@"event"] isKindOfClass:[NSString class]] ? parsed[@"event"] : @"";

        // 验证四级格式
        NSArray<NSString *> *parts = [event componentsSeparatedByString:@":"];
        BOOL valid = (parts.count == 4);
        if (valid) {
            for (NSString *part in parts) {
                if (part.length == 0) {
                    valid = NO;
                    break;
                }
            }
        }

        if (!valid) {
            [self logWithFormat:@"invalid event format (not 4-level): %@", event];
            return MPEventRouterJsonString(@{@"success": @NO,
                                             @"message": [NSString stringWithFormat:@"Invalid event format: %@", event]})
                ?: @"{\"success\":false}";
        }

        NSString *container = parts.firstObject;
        BOOL hasData = (parsed[@"data"] != nil) && ![parsed[@"data"] isKindOfClass:[NSNull class]];
        NSString *dataStr = hasData ? (MPEventRouterJsonString(parsed[@"data"]) ?: @"") : @"";

        if ([container isEqualToString:MPEventRouterContainerHost]) {
            // host 事件：Native 直接消费
            if (self.hostEventHandler) {
                self.hostEventHandler(event, dataStr);
            }
            [self logWithFormat:@"host event consumed: %@", event];
        } else {
            // 路由到目标 WebView
            MPJSBridgeManager *targetBridge = self.webViews[container];
            if (targetBridge) {
                NSDictionary *postData = @{
                    @"event": event,
                    @"data": hasData ? parsed[@"data"] : @"",
                };
                NSString *postDataStr = MPEventRouterJsonString(postData) ?: @"{}";
                [targetBridge callJsMethod:MPEventRouterMethodPostToWeb args:@[postDataStr] callback:nil];
                [self logWithFormat:@"routed event '%@' to container=%@", event, container];
            } else {
                [self logWithFormat:@"no WebView registered for container=%@", container];
            }
        }

        return MPEventRouterJsonString(@{@"success": @YES, @"message": @""}) ?: @"{\"success\":true}";
    } @catch (NSException *exception) {
        [self logWithFormat:@"error handling postToNative: %@", exception];
        return MPEventRouterJsonString(@{@"success": @NO,
                                         @"message": [NSString stringWithFormat:@"%@", exception]})
            ?: @"{\"success\":false}";
    }
}

#pragma mark - 日志

- (void)logWithFormat:(NSString *)format, ... {
    if (!self.debug) {
        return;
    }
    va_list args;
    va_start(args, format);
    NSLog(@"[EventRouter] %@", [[NSString alloc] initWithFormat:format arguments:args]);
    va_end(args);
}

@end

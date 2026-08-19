#import "MPDsBridgeProxy.h"

@interface MPDsBridgeProxy ()

/** 弱引用 manager（避免 WKUserContentController -> proxy -> manager 引用循环） */
@property (nonatomic, weak, readonly) MPJSBridgeManager *manager;

@end

@implementation MPDsBridgeProxy

+ (NSString *)messageHandlerName {
    return @"mpBridge";
}

- (instancetype)initWithManager:(MPJSBridgeManager *)manager {
    self = [super init];
    if (self) {
        _manager = manager;
    }
    return self;
}

#pragma mark - WKScriptMessageHandler

- (void)userContentController:(WKUserContentController *)userContentController
      didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.name isEqualToString:[[self class] messageHandlerName]]) {
        return;
    }
    if (![message.body isKindOfClass:[NSDictionary class]]) {
        return;
    }

    NSDictionary *body = (NSDictionary *)message.body;
    NSString *type = [body[@"type"] isKindOfClass:[NSString class]] ? body[@"type"] : nil;
    NSString *payload = [body[@"payload"] isKindOfClass:[NSString class]] ? body[@"payload"] : nil;

    MPJSBridgeManager *manager = self.manager;
    if (!manager) {
        NSLog(@"[MPBridge] MPDsBridgeProxy: manager is nil, drop message type=%@", type);
        return;
    }

    if ([type isEqualToString:@"call"]) {
        // 同步调用：Native 处理后将响应异步回传给 JS（iOS 通道限制的降级处理）
        NSString *responseJson = [manager handleSyncCall:payload ?: @""];
        if (responseJson.length > 0) {
            [manager sendResponseJsonToJs:responseJson];
        }
    } else if ([type isEqualToString:@"callAsync"]) {
        // 异步调用：结果由 manager 处理后异步回传
        [manager handleAsyncCall:payload ?: @""];
    } else if ([type isEqualToString:@"hasMethod"]) {
        // 方法存在性查询：结果回传更新 JS 缓存
        NSString *method = payload ?: @"";
        [manager notifyHasMethodResult:method hasMethod:[manager hasMethod:method]];
    } else if ([type isEqualToString:@"nativeCallComplete"]) {
        // Native -> JS 调用的结果回传：{"callbackId": "...", "result": "..."}
        NSData *data = [payload dataUsingEncoding:NSUTF8StringEncoding];
        NSDictionary *dict = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        if ([dict isKindOfClass:[NSDictionary class]]) {
            NSString *callbackId = [dict[@"callbackId"] isKindOfClass:[NSString class]] ? dict[@"callbackId"] : nil;
            NSString *result = [dict[@"result"] isKindOfClass:[NSString class]] ? dict[@"result"] : @"";
            if (callbackId.length > 0) {
                [manager onNativeCallComplete:callbackId result:result];
            }
        }
    } else {
        NSLog(@"[MPBridge] MPDsBridgeProxy: unknown message type=%@", type);
    }
}

@end

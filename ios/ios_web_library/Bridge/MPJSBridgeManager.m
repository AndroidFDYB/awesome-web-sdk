#import "MPJSBridgeManager.h"
#import "MPBridgeModels.h"

/**
 * 将 JSON 字符串安全嵌入 JS 源码
 *
 * JSON 字符串本身是合法的 JS 对象字面量（对等鸿蒙端 JSON.stringify 后模板拼接），
 * 仅需转义 U+2028/U+2029（JSON 合法但部分 JS 引擎字符串字面量中非法的行分隔符）
 */
static NSString *MPJsonForJsEvaluation(NSString *json) {
    if (json.length == 0) {
        return @"null";
    }
    NSMutableString *mutable = [json mutableCopy];
    NSRange fullRange = NSMakeRange(0, mutable.length);
    [mutable replaceOccurrencesOfString:@"\u2028" withString:@"\\u2028" options:kNilOptions range:fullRange];
    [mutable replaceOccurrencesOfString:@"\u2029" withString:@"\\u2029" options:kNilOptions range:fullRange];
    return [mutable copy];
}

@interface MPJSBridgeManager ()

/** 注册的 Handler 表：method -> MPHandlerEntry */
@property (nonatomic, strong) NSMutableDictionary<NSString *, MPHandlerEntry *> *handlers;

/** 异步回调映射：callbackId -> 回调函数 */
@property (nonatomic, strong) NSMutableDictionary<NSString *, void (^)(NSString *result)> *asyncCallbacks;

/** 自增回调 ID 计数器 */
@property (nonatomic, assign) NSInteger callbackIdCounter;

/** WebView 引用（用于调用 JS） */
@property (nonatomic, strong, nullable) WKWebView *webView;

/** 调试模式 */
@property (nonatomic, assign, readwrite) BOOL debug;

@end

@implementation MPJSBridgeManager

#pragma mark - 生命周期

- (instancetype)initWithDebug:(BOOL)debug {
    self = [super init];
    if (self) {
        _debug = debug;
        _handlers = [NSMutableDictionary dictionary];
        _asyncCallbacks = [NSMutableDictionary dictionary];
        _callbackIdCounter = 0;
    }
    return self;
}

- (void)bindWebView:(WKWebView *)webView {
    _webView = webView;
}

#pragma mark - Handler 注册

- (void)registerHandler:(NSString *)method handler:(MPSyncBridgeHandler)handler {
    self.handlers[method] = [[MPHandlerEntry alloc] initWithMethod:method syncHandler:handler asyncHandler:nil];
    [self logWithFormat:@"registerHandler: %@ (sync)", method];
}

- (void)registerAsyncHandler:(NSString *)method handler:(MPAsyncBridgeHandler)handler {
    self.handlers[method] = [[MPHandlerEntry alloc] initWithMethod:method syncHandler:nil asyncHandler:handler];
    [self logWithFormat:@"registerAsyncHandler: %@ (async)", method];
}

- (BOOL)hasMethod:(NSString *)method {
    return self.handlers[method] != nil;
}

#pragma mark - JS -> Native 调用处理

- (nullable NSString *)handleSyncCall:(NSString *)requestJson {
    [self logWithFormat:@"handleSyncCall: %@", requestJson];
    @try {
        MPBridgeRequest *request = [MPBridgeRequest requestFromJson:requestJson];
        if (!request) {
            @throw [NSException exceptionWithName:@"MPBridgeInvalidRequestException"
                                           reason:@"invalid request json"
                                         userInfo:nil];
        }

        MPHandlerEntry *entry = self.handlers[request.method];
        if (!entry) {
            MPBridgeResponse *response = [MPBridgeResponse responseWithCallbackId:request.callbackId
                                                                              code:-1
                                                                              data:@""
                                                                          message:[NSString stringWithFormat:@"Method not found: %@", request.method]];
            return [response toJsonString];
        }

        if (entry.isAsync) {
            MPBridgeResponse *response = [MPBridgeResponse responseWithCallbackId:request.callbackId
                                                                              code:-2
                                                                              data:@""
                                                                          message:[NSString stringWithFormat:@"Method %@ is async, use handleAsyncCall", request.method]];
            return [response toJsonString];
        }

        NSString *result = entry.syncHandler(request.params);
        MPBridgeResponse *response = [MPBridgeResponse responseWithCallbackId:request.callbackId
                                                                          code:0
                                                                          data:result ?: @""
                                                                      message:@"success"];
        return [response toJsonString];
    } @catch (NSException *exception) {
        MPBridgeResponse *response = [MPBridgeResponse responseWithCallbackId:@""
                                                                          code:-2
                                                                          data:@""
                                                                      message:[NSString stringWithFormat:@"Exception: %@", exception]];
        return [response toJsonString];
    }
}

- (void)handleAsyncCall:(NSString *)requestJson {
    [self logWithFormat:@"handleAsyncCall: %@", requestJson];
    @try {
        MPBridgeRequest *request = [MPBridgeRequest requestFromJson:requestJson];
        if (!request) {
            return;
        }

        MPHandlerEntry *entry = self.handlers[request.method];
        if (!entry) {
            [self sendResponseWithCallbackId:request.callbackId
                                         code:-1
                                         data:@""
                                     message:[NSString stringWithFormat:@"Method not found: %@", request.method]];
            return;
        }

        if (!entry.isAsync) {
            // 同步方法被异步调用，自动包装为异步返回
            NSString *result = entry.syncHandler(request.params);
            [self sendResponseWithCallbackId:request.callbackId code:0 data:result ?: @"" message:@"success"];
            return;
        }

        __weak typeof(self) weakSelf = self;
        entry.asyncHandler(request.params, ^(NSString *result) {
            [weakSelf sendResponseWithCallbackId:request.callbackId code:0 data:result ?: @"" message:@"success"];
        });
    } @catch (NSException *exception) {
        [self logWithFormat:@"handleAsyncCall exception: %@", exception];
    }
}

#pragma mark - Native -> JS 调用

- (void)callJsMethod:(NSString *)method
                args:(nullable NSArray<NSString *> *)args
            callback:(nullable void (^)(NSString *result))callback {
    NSString *callbackId = [NSString stringWithFormat:@"native_cb_%ld", (long)self.callbackIdCounter++];

    // 序列化参数数组（无参数时为 "[]"）
    NSString *paramsJson = @"[]";
    if (args.count > 0) {
        NSData *data = [NSJSONSerialization dataWithJSONObject:args options:0 error:nil];
        if (data) {
            paramsJson = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"[]";
        }
    }

    if (callback) {
        self.asyncCallbacks[callbackId] = callback;
    }

    MPNativeCallRequest *request = [[MPNativeCallRequest alloc] init];
    request.callbackId = callbackId;
    request.method = method;
    request.params = paramsJson;

    // 对等鸿蒙端协议：调用 JS 端 _handleNativeCall
    // （鸿蒙端调用 window._dsbridge._handleNativeCall，iOS 端该方法定义在 window.dsBridge 上，
    //  见 Resources/bridge.js）
    NSString *js = [NSString stringWithFormat:@"window.dsBridge._handleNativeCall(%@);",
                    MPJsonForJsEvaluation([request toJsonString])];
    [self runJavaScript:js];
}

- (void)onNativeCallComplete:(NSString *)callbackId result:(NSString *)result {
    void (^callback)(NSString *) = self.asyncCallbacks[callbackId];
    if (callback) {
        callback(result);
        [self.asyncCallbacks removeObjectForKey:callbackId];
    }
}

#pragma mark - 响应推送

- (void)sendResponseJsonToJs:(NSString *)responseJson {
    NSString *js = [NSString stringWithFormat:@"window.dsBridge._handleResponse(%@);",
                    MPJsonForJsEvaluation(responseJson)];
    [self runJavaScript:js];
}

- (void)notifyHasMethodResult:(NSString *)method hasMethod:(BOOL)hasMethod {
    // 方法名需转义为 JS 字符串字面量
    NSString *escaped = [method stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"\n" withString:@"\\n"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"\r" withString:@"\\r"];
    NSString *js = [NSString stringWithFormat:@"window.dsBridge._handleHasMethodResult(\"%@\", %@);",
                    escaped,
                    hasMethod ? @"true" : @"false"];
    [self runJavaScript:js];
}

- (void)sendResponseWithCallbackId:(NSString *)callbackId
                               code:(NSInteger)code
                               data:(NSString *)data
                            message:(NSString *)message {
    MPBridgeResponse *response = [MPBridgeResponse responseWithCallbackId:callbackId
                                                                      code:code
                                                                      data:data
                                                                   message:message];
    [self sendResponseJsonToJs:[response toJsonString]];
}

#pragma mark - JS 执行

- (void)runJavaScript:(NSString *)code {
    if (code.length == 0) {
        return;
    }
    // WKWebView 的 evaluateJavaScript 必须在主线程执行
    dispatch_async(dispatch_get_main_queue(), ^{
        WKWebView *webView = self->_webView;
        if (!webView) {
            [self logWithFormat:@"runJavaScript failed: webView is nil, code=%@", code];
            return;
        }
        [webView evaluateJavaScript:code completionHandler:^(id _Nullable result, NSError * _Nullable error) {
            if (error && self.debug) {
                NSLog(@"[MPBridge] evaluateJavaScript error: %@, code=%@", error, code);
            }
        }];
    });
}

#pragma mark - 日志

- (void)logWithFormat:(NSString *)format, ... {
    if (!self.debug) {
        return;
    }
    va_list args;
    va_start(args, format);
    NSLog(@"[MPBridge] %@", [[NSString alloc] initWithFormat:format arguments:args]);
    va_end(args);
}

@end

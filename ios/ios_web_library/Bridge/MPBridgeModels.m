#import "MPBridgeModels.h"

#pragma mark - JSON 序列化工具

static NSString *MPJsonStringFromObject(id object) {
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

static NSDictionary *MPJsonObjectFromString(NSString *json) {
    if (json.length == 0) {
        return nil;
    }
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) {
        return nil;
    }
    id object = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![object isKindOfClass:[NSDictionary class]]) {
        return nil;
    }
    return object;
}

#pragma mark - MPBridgeRequest

@implementation MPBridgeRequest

+ (nullable instancetype)requestFromJson:(NSString *)json {
    NSDictionary *dict = MPJsonObjectFromString(json);
    if (!dict) {
        return nil;
    }

    MPBridgeRequest *request = [[MPBridgeRequest alloc] init];
    request.callbackId = [dict[@"callbackId"] isKindOfClass:[NSString class]] ? dict[@"callbackId"] : @"";
    request.method = [dict[@"method"] isKindOfClass:[NSString class]] ? dict[@"method"] : @"";

    id params = dict[@"params"];
    if ([params isKindOfClass:[NSString class]]) {
        request.params = params;
    } else if (params && params != (id)kCFNull) {
        // params 非字符串时（协议异常），重新序列化为 JSON 字符串
        request.params = MPJsonStringFromObject(params) ?: @"";
    } else {
        request.params = @"";
    }
    return request;
}

@end

#pragma mark - MPBridgeResponse

@implementation MPBridgeResponse

+ (instancetype)responseWithCallbackId:(NSString *)callbackId
                                   code:(NSInteger)code
                                   data:(NSString *)data
                                message:(NSString *)message {
    MPBridgeResponse *response = [[MPBridgeResponse alloc] init];
    response.callbackId = callbackId ?: @"";
    response.code = code;
    response.data = data ?: @"";
    response.message = message ?: @"";
    return response;
}

- (NSString *)toJsonString {
    NSDictionary *dict = @{
        @"callbackId": self.callbackId ?: @"",
        @"code": @(self.code),
        @"data": self.data ?: @"",
        @"message": self.message ?: @"",
    };
    return MPJsonStringFromObject(dict) ?: @"{}";
}

@end

#pragma mark - MPNativeCallRequest

@implementation MPNativeCallRequest

- (NSString *)toJsonString {
    NSDictionary *dict = @{
        @"callbackId": self.callbackId ?: @"",
        @"method": self.method ?: @"",
        @"params": self.params ?: @"[]",
    };
    return MPJsonStringFromObject(dict) ?: @"{}";
}

@end

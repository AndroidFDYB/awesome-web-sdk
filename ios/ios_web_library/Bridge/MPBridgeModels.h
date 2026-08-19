/**
 * MPBridge 数据模型定义（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 BridgeModels.ets，
 * 与 specs/bridge-protocol.ts 保持一致的协议格式。
 */

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/** JS -> Native 调用请求 */
@interface MPBridgeRequest : NSObject

/** 回调 ID，异步调用时非空 */
@property (nonatomic, copy) NSString *callbackId;

/** 方法名 */
@property (nonatomic, copy) NSString *method;

/** 参数（JSON 字符串） */
@property (nonatomic, copy) NSString *params;

/** 从 JSON 字符串解析请求（解析失败返回 nil） */
+ (nullable instancetype)requestFromJson:(NSString *)json;

@end

/** Native -> JS 响应 */
@interface MPBridgeResponse : NSObject

/** 对应的回调 ID */
@property (nonatomic, copy) NSString *callbackId;

/** 状态码：0=成功，-1=方法不存在，-2=执行异常 */
@property (nonatomic, assign) NSInteger code;

/** 返回数据（JSON 字符串） */
@property (nonatomic, copy) NSString *data;

/** 描述信息 */
@property (nonatomic, copy) NSString *message;

+ (instancetype)responseWithCallbackId:(NSString *)callbackId
                                   code:(NSInteger)code
                                   data:(NSString *)data
                                message:(NSString *)message;

/** 序列化为 JSON 字符串 */
- (NSString *)toJsonString;

@end

/** Native -> JS 调用请求 */
@interface MPNativeCallRequest : NSObject

/** 回调 ID */
@property (nonatomic, copy) NSString *callbackId;

/** JS 方法名 */
@property (nonatomic, copy) NSString *method;

/** 参数（JSON 字符串，参数数组的序列化形式） */
@property (nonatomic, copy) NSString *params;

/** 序列化为 JSON 字符串 */
- (NSString *)toJsonString;

@end

NS_ASSUME_NONNULL_END

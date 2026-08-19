/**
 * MPBridgeHandler 接口定义（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 BridgeHandler.ets。
 *
 * 业务方实现此 Handler 来注册自定义 API。
 */

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/** 同步 Handler：接收参数 JSON 字符串，返回结果 JSON 字符串 */
typedef NSString * _Nullable (^MPSyncBridgeHandler)(NSString *params);

/**
 * 异步 Handler：接收参数和完成回调
 * 调用 complete(result) 来返回结果给 JS 端
 */
typedef void (^MPAsyncBridgeHandler)(NSString *params, void (^complete)(NSString *result));

/** Handler 注册项 */
@interface MPHandlerEntry : NSObject

/** 方法名 */
@property (nonatomic, copy, readonly) NSString *method;

/** 是否为异步方法 */
@property (nonatomic, assign, readonly) BOOL isAsync;

/** 同步处理器 */
@property (nonatomic, copy, readonly, nullable) MPSyncBridgeHandler syncHandler;

/** 异步处理器 */
@property (nonatomic, copy, readonly, nullable) MPAsyncBridgeHandler asyncHandler;

- (instancetype)initWithMethod:(NSString *)method
                    syncHandler:(nullable MPSyncBridgeHandler)syncHandler
                   asyncHandler:(nullable MPAsyncBridgeHandler)asyncHandler;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END

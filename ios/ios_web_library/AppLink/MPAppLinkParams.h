/**
 * AppLink scheme 解析后的参数模型（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 AppLinkParams.ets。
 *
 * 对应 scheme 格式：sk://native={pageName='vip',url='...',title='aaa',backHome='1'}
 */
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/** 透明弹窗页面名常量 */
FOUNDATION_EXPORT NSString * const MPAppLinkPageTransparent;

@interface MPAppLinkParams : NSObject

/** 页面名称，如 "vip"、"transparent" */
@property (nonatomic, copy) NSString *pageName;

/** 目标页面 URL */
@property (nonatomic, copy) NSString *url;

/** 页面标题（可选） */
@property (nonatomic, copy, nullable) NSString *title;

/** 是否需要先回首页再打开 */
@property (nonatomic, assign) BOOL backHome;

/** 原始 scheme 字符串 */
@property (nonatomic, copy) NSString *rawScheme;

/** 检查是否为透明弹窗页面 */
+ (BOOL)isTransparentPage:(MPAppLinkParams *)params;

@end

NS_ASSUME_NONNULL_END

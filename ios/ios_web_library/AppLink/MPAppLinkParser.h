/**
 * AppLink scheme 字符串解析器（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 AppLinkParser.ets。
 *
 * 解析格式：sk://native={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'}
 * 或：sk://action={pageName='vip',url='...',title='aaa',backHome='1'}
 *
 * 解析规则（三端一致）：
 * 1. 提取 scheme 前缀后的 {…} 内容
 * 2. 按 key='value' 格式解析键值对
 * 3. value 内允许包含 =、//、: 等特殊字符
 * 4. 解析失败返回 nil
 */
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class MPAppLinkParams;

@interface MPAppLinkParser : NSObject

/** 设置调试模式 */
+ (void)setDebug:(BOOL)debug;

/**
 * 解析 scheme 字符串
 *
 * @param scheme 原始 scheme 字符串
 * @returns 解析后的 MPAppLinkParams，解析失败返回 nil
 */
+ (nullable MPAppLinkParams *)parse:(NSString *)scheme;

/**
 * 将 sk://native={...} 转换为 sk://action={...}
 * 用于将 native scheme 转换为 action scheme 交由根容器处理
 */
+ (NSString *)convertToAction:(NSString *)scheme;

@end

NS_ASSUME_NONNULL_END

/**
 * AppLink 页面跳转处理器（iOS / Objective-C 版）
 *
 * 对应鸿蒙端 AppLinkHandler.ets。
 *
 * 负责：
 * 1. 注册 jump2Native JSBridge Handler，接收前端传来的 scheme 字符串
 * 2. 解析 scheme 并根据参数执行对应的页面跳转
 * 3. 通过 MPAppLinkActionDelegate 回调将实际导航操作委托给宿主
 * 4. 管理透明弹窗关闭回调列表（回调注册表模式，避免内存泄漏）
 *
 * 设计原则 —— SDK 配置 + Delegate 执行：
 * - SDK 负责决策：判断是否为透明弹窗，强制设置 modalPresentationStyle
 * - SDK 负责内存安全：内部使用 __weak 创建 close block，避免循环引用
 * - Delegate 负责创建 VC 和执行 present
 * - SDK 不创建 VC、不调用 present，只配置 VC 属性
 *
 * 使用方式：
 * @code
 * @interface LoanPage () <MPAppLinkActionDelegate>
 * @end
 *
 * @implementation LoanPage
 *
 * - (UIViewController *)createViewControllerForPage:(MPAppLinkParams *)params {
 *     if ([MPAppLinkParams isTransparentPage:params]) {
 *         return [[TransparentPopupVC alloc] initWithURL:params.url];
 *     }
 *     return [self pageForName:params.pageName];
 * }
 *
 * - (void)presentConfiguredViewController:(UIViewController *)vc
 *                              animated:(BOOL)animated
 *                            completion:(void (^)(void))completion {
 *     if (vc.modalPresentationStyle == UIModalPresentationOverFullScreen) {
 *         [self presentViewController:vc animated:animated completion:completion];
 *     } else {
 *         [self.navigationController pushViewController:vc animated:animated];
 *     }
 * }
 *
 * - (void)handleAction:(NSString *)actionScheme {
 *     // 根容器处理 sk://action=...（回首页 + 打开页面）
 * }
 * @end
 *
 * // 创建 Handler（请以强引用持有，避免被释放）
 * self.appLinkHandler = [[MPAppLinkHandler alloc] initWithBridgeManager:bridgeManager
 *                                                               delegate:self
 *                                                                  debug:YES];
 * @endcode
 */
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "MPJSBridgeManager.h"
#import "MPAppLinkParams.h"

NS_ASSUME_NONNULL_BEGIN

/** jump2Native JSBridge 方法名（与前端 SDK JUMP2NATIVE_METHOD 一致） */
FOUNDATION_EXPORT NSString * const MPAppLinkJump2NativeMethod;

/**
 * AppLink 导航委托协议
 *
 * 宿主页面实现此协议来处理实际的页面导航操作，
 * SDK 只负责 scheme 解析、流程编排和 VC 属性配置。
 *
 * 透明弹窗处理流程：
 * 1. SDK 调用 createViewControllerForPage: 获取 VC
 * 2. SDK 强制设置 vc.modalPresentationStyle = UIModalPresentationOverFullScreen
 * 3. SDK 设置 vc.modalTransitionStyle = UIModalTransitionStyleCrossDissolve
 * 4. SDK 内部注册 close block（使用 __weak 安全捕获 VC）
 * 5. SDK 调用 presentConfiguredViewController:animated:completion: 让 delegate 展示
 *
 * 内存安全：
 * SDK 内部使用 __weak 创建 close block，VC 被外部释放后 weak 引用自动置 nil，
 * closeAllPopups 调用 dismiss 时为 no-op（安全）。
 */
@protocol MPAppLinkActionDelegate <NSObject>

/**
 * 创建页面 VC（SDK 会自动配置 modalPresentationStyle 后归还）
 *
 * @param params 解析后的页面参数
 * @return 要展示的 VC。SDK 会根据 pageName 设置展示样式：
 *   - 透明弹窗：modalPresentationStyle = UIModalPresentationOverFullScreen
 *   - 普通页面：不修改样式
 * @note 返回 nil 时 SDK 跳过本次导航（记录警告日志）
 */
- (nullable UIViewController *)createViewControllerForPage:(MPAppLinkParams *)params;

/**
 * 展示已配置的 VC（SDK 已设置好展示样式）
 *
 * @param vc SDK 已配置好 modalPresentationStyle 的 VC
 * @param animated 是否动画
 * @param completion 展示完成回调（可为 nil）
 *
 * @note delegate 必须调用 presentViewController: 或 pushViewController: 展示 VC，
 *   否则页面不会出现。透明弹窗时 vc.modalPresentationStyle 已被 SDK 设为 .overFullScreen，
 *   delegate 不应覆盖此值。
 */
- (void)presentConfiguredViewController:(UIViewController *)vc
                               animated:(BOOL)animated
                             completion:(nullable void (^)(void))completion;

/**
 * 处理 action scheme（backHome 场景）
 * 将 sk://native= 转换为 sk://action= 后交由根容器处理
 *
 * @param actionScheme 转换后的 sk://action={...} 格式字符串
 */
- (void)handleAction:(NSString *)actionScheme;

@end

@interface MPAppLinkHandler : NSObject

/** JSBridge 管理器 */
@property (nonatomic, strong, readonly) MPJSBridgeManager *bridgeManager;

/** 导航委托（弱引用，遵循 Objective-C 委托惯例） */
@property (nonatomic, weak, readonly, nullable) id<MPAppLinkActionDelegate> delegate;

/**
 * 构造函数
 *
 * @param bridgeManager JSBridge 管理器实例
 * @param delegate 导航委托实现
 * @param debug 是否开启调试日志
 */
- (instancetype)initWithBridgeManager:(MPJSBridgeManager *)bridgeManager
                             delegate:(id<MPAppLinkActionDelegate>)delegate
                                debug:(BOOL)debug;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

/**
 * 关闭所有透明弹窗
 * 在 backHome 时自动调用，从最新的弹窗开始逐一关闭，
 * 并断开引用避免内存泄漏。也可手动调用。
 */
- (void)closeAllPopups;

/** 获取当前弹窗数量 */
- (NSUInteger)popupCount;

@end

NS_ASSUME_NONNULL_END

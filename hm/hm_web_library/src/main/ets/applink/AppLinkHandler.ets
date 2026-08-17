/**
 * AppLink 页面跳转处理器（鸿蒙端）
 *
 * 负责：
 * 1. 注册 jump2Native JSBridge Handler，接收前端传来的 scheme 字符串
 * 2. 解析 scheme 并根据参数执行对应的页面跳转
 * 3. 通过 AppLinkActionDelegate 回调将实际导航操作委托给宿主
 * 4. 管理透明弹窗链表（回调注册表模式，避免内存泄漏）
 *
 * 鸿蒙端特殊处理：
 * - 简单跳转：直接 delegate.openPage(params)
 * - backHome 场景：将 sk://native= 转换为 sk://action= 交由根容器处理
 * - 透明弹窗：使用链表维护关闭回调，backHome 时逐一调用关闭
 *
 * 弹窗引用管理（回调注册表模式）：
 * ArkTS 无 WeakReference/SoftReference，字符串 ID 无法实际控制弹窗关闭。
 * 因此 openPage 接收 registerClose 回调参数，弹窗创建时宿主调用
 * registerClose(() => controller.close()) 将关闭闭包注册到 SDK 链表中。
 * closeAllPopups() 时逐一调用闭包并断开引用。
 *
 * 使用方式：
 * ```typescript
 * import { AppLinkHandler, AppLinkActionDelegate, JSBridgeManager } from 'hm_web_library';
 *
 * const delegate: AppLinkActionDelegate = {
 *   openPage: (params, registerClose) => {
 *     if (params.pageName === 'transparent') {
 *       const ctrl = new CustomDialogController({
 *         builder: TransparentPopupDialog({ url: params.url }),
 *         customStyle: true
 *       });
 *       ctrl.open();
 *       registerClose(() => ctrl.close());
 *     } else {
 *       router.pushUrl({ url: 'pages/' + params.pageName });
 *     }
 *   },
 *   handleAction: (actionScheme) => {
 *     // 根容器处理 action（回首页 + 打开页面）
 *   }
 * };
 *
 * const handler = new AppLinkHandler(bridgeManager, delegate, true);
 * ```
 */

import { JSBridgeManager } from '../bridge/JSBridge';
import { AppLinkParams, PAGE_TRANSPARENT } from './AppLinkParams';
import { AppLinkParser } from './AppLinkParser';

// ========================
// 委托接口
// ========================

/**
 * AppLink 导航委托接口
 *
 * 宿主页面实现此接口来处理实际的页面导航操作，
 * SDK 只负责 scheme 解析和流程编排。
 *
 * 弹窗引用管理采用回调注册表模式：
 * openPage 的 registerClose 参数用于注册弹窗的关闭回调，
 * SDK 将闭包存入链表，closeAllPopups() 时逐一调用。
 * 这避免了 ArkTS 无 WeakReference 的问题。
 */
export interface AppLinkActionDelegate {
  /**
   * 打开新页面
   *
   * @param params 解析后的页面参数
   * @param registerClose 注册关闭回调（仅透明弹窗场景需要调用）。
   *   弹窗创建后调用 registerClose(() => controller.close())，
   *   SDK 将闭包存入链表，backHome 时自动调用关闭。
   *   非弹窗场景可忽略此参数。
   */
  openPage(params: AppLinkParams, registerClose: (closeFn: () => void) => void): void;

  /**
   * 处理 action scheme（鸿蒙端 backHome 场景）
   * 将 sk://native= 转换为 sk://action= 后交由根容器处理
   * @param actionScheme 转换后的 sk://action={...} 格式字符串
   */
  handleAction(actionScheme: string): void;
}

// ========================
// 透明弹窗链表节点
// ========================

/**
 * 透明弹窗链表节点
 *
 * 使用双向链表维护透明弹窗的关闭回调。
 * 每个节点持有一个 closeFn 闭包，调用即可关闭对应弹窗。
 * backHome 时遍历链表逐一调用 closeFn 并断开引用，避免内存泄漏。
 */
class TransparentPopupNode {
  /** 关闭弹窗的回调函数（如 () => dialogController.close()） */
  closeFn: () => void;
  prev: TransparentPopupNode | null = null;
  next: TransparentPopupNode | null = null;

  constructor(closeFn: () => void) {
    this.closeFn = closeFn;
  }
}

// ========================
// AppLinkHandler
// ========================

export class AppLinkHandler {
  /** JSBridge 管理器 */
  private bridgeManager: JSBridgeManager;
  /** 导航委托 */
  private delegate: AppLinkActionDelegate;
  /** 调试模式 */
  private debug: boolean;

  /** 透明弹窗链表头节点 */
  private popupHead: TransparentPopupNode | null = null;
  /** 透明弹窗链表尾节点 */
  private popupTail: TransparentPopupNode | null = null;
  /** 弹窗数量 */
  private popupCount: number = 0;

  /**
   * 构造函数
   *
   * @param bridgeManager JSBridge 管理器实例
   * @param delegate 导航委托实现
   * @param debug 是否开启调试日志
   */
  constructor(
    bridgeManager: JSBridgeManager,
    delegate: AppLinkActionDelegate,
    debug: boolean = false
  ) {
    this.bridgeManager = bridgeManager;
    this.delegate = delegate;
    this.debug = debug;

    // 设置解析器调试模式
    AppLinkParser.setDebug(debug);

    // 注册 jump2Native handler
    this.bridgeManager.registerAsyncHandler('jump2Native', (params: string, complete: (result: string) => void) => {
      this.handleJump2Native(params, complete);
    });

    this.log('AppLinkHandler registered, jump2Native handler ready');
  }

  // ========================
  // jump2Native 处理
  // ========================

  /**
   * 处理 jump2Native 调用
   */
  private handleJump2Native(data: string, complete: (result: string) => void): void {
    this.log(`jump2Native called with data=${data}`);

    try {
      // 从 JSON 中提取 scheme
      const json = JSON.parse(data) as Record<string, string>;
      const scheme = json['scheme'] || '';

      if (!scheme || scheme.length === 0) {
        this.log('jump2Native failed: scheme is empty');
        complete(JSON.stringify({ code: -1, message: 'scheme is empty' }));
        return;
      }

      // 解析 scheme
      const params = AppLinkParser.parse(scheme);
      if (params === null) {
        this.log(`jump2Native failed: cannot parse scheme=${scheme}`);
        complete(JSON.stringify({ code: -1, message: 'cannot parse scheme' }));
        return;
      }

      // 执行跳转
      this.executeNavigation(params);

      complete(JSON.stringify({ code: 0, message: 'success' }));
    } catch (e) {
      this.log(`jump2Native exception: ${e}`);
      complete(JSON.stringify({ code: -1, message: `exception: ${e}` }));
    }
  }

  /**
   * 执行导航逻辑
   *
   * - 简单跳转（无 backHome）：直接 delegate.openPage
   * - backHome 场景：
   *   - 关闭所有现有透明弹窗
   *   - 转换为 sk://action= 交由根容器处理
   * - 透明弹窗（无 backHome）：加入链表管理
   */
  private executeNavigation(params: AppLinkParams): void {
    this.log(`executeNavigation: pageName=${params.pageName}, url=${params.url}, backHome=${params.backHome}`);

    if (params.backHome) {
      // backHome 场景：先关闭所有透明弹窗
      this.closeAllPopups();

      // 转换为 sk://action= 交由根容器处理
      const actionScheme = AppLinkParser.convertToAction(params.rawScheme);
      this.log(`backHome: converted to action scheme=${actionScheme}`);
      this.delegate.handleAction(actionScheme);
    } else if (params.pageName === PAGE_TRANSPARENT) {
      // 透明弹窗：通过 registerClose 回调将关闭函数注册到链表
      this.delegate.openPage(params, (closeFn: () => void) => {
        this.addPopup(closeFn);
      });
    } else {
      // 简单跳转（非弹窗，registerClose 传空操作）
      this.delegate.openPage(params, (_closeFn: () => void) => {});
    }
  }

  // ========================
  // 透明弹窗链表管理
  // ========================

  /**
   * 添加透明弹窗关闭回调到链表
   *
   * @param closeFn 关闭弹窗的回调函数（如 () => dialogController.close()）
   */
  private addPopup(closeFn: () => void): void {
    const node = new TransparentPopupNode(closeFn);

    if (this.popupTail !== null) {
      // 链接到链表尾部
      node.prev = this.popupTail;
      this.popupTail.next = node;
      this.popupTail = node;
    } else {
      // 第一个弹窗
      this.popupHead = node;
      this.popupTail = node;
    }

    this.popupCount++;
    this.log(`addPopup: total popups=${this.popupCount}`);
  }

  /**
   * 关闭所有透明弹窗
   * 在 backHome 时调用，从尾部开始逐一调用 closeFn 关闭弹窗，
   * 并断开链表引用避免内存泄漏。
   */
  closeAllPopups(): void {
    if (this.popupHead === null) {
      return;
    }

    this.log(`closeAllPopups: closing ${this.popupCount} popups`);

    // 从尾部开始关闭（最新的先关）
    let current = this.popupTail;
    while (current !== null) {
      const prev = current.prev;
      try {
        current.closeFn();
      } catch (e) {
        this.log(`closeAllPopups: closeFn exception: ${e}`);
      }
      // 断开引用
      current.prev = null;
      current.next = null;
      current = prev;
    }

    // 清空链表
    this.popupHead = null;
    this.popupTail = null;
    this.popupCount = 0;

    this.log('closeAllPopups: all popups closed and references cleared');
  }

  /** 获取当前弹窗数量 */
  getPopupCount(): number {
    return this.popupCount;
  }

  // ========================
  // 日志
  // ========================

  private log(msg: string): void {
    if (this.debug) {
      console.log(`[MPBridge/AppLink] ${msg}`);
    }
  }
}

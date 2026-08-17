/**
 * EventRouter - 跨 WebView 事件路由器
 *
 * 实现跨 WebView 的 emitter 通信：前端通过 JSBridge postToNative 方法
 * 将四级格式事件（container:scope:model:event）发送到 Native，
 * Native 根据第一级容器名路由到目标 WebView，再通过 postToWeb 转发给前端。
 *
 * 容器名映射：
 * - vip    → WebViewForVip
 * - loan   → WebViewForLoan
 * - lead   → WebViewForLead
 * - common → WebViewForCommon
 * - host   → Native 端直接消费（不转发）
 *
 * 使用方式：
 * ```typescript
 * const eventRouter = new EventRouter(true);
 *
 * // 注册各 WebView（自动注册 postToNative Handler）
 * eventRouter.registerWebView(EventRouter.CONTAINER_VIP, vipBridgeManager);
 * eventRouter.registerWebView(EventRouter.CONTAINER_LOAN, loanBridgeManager);
 *
 * // 监听 host 事件
 * eventRouter.onHostEvent((event: string, data: string) => {
 *   console.log(`Host event: ${event}, data: ${data}`);
 * });
 *
 * // 页面销毁时注销
 * eventRouter.unregisterWebView(EventRouter.CONTAINER_VIP);
 * ```
 */

import { JSBridgeManager } from '../bridge/JSBridge';
import { SyncBridgeHandler } from '../bridge/BridgeHandler';

/** postToNative 调用参数 */
interface PostToNativeData {
  event: string;
  data?: Object;
}

/** postToWeb 调用参数 */
interface PostToWebData {
  event: string;
  data?: Object;
}

/** 事件处理结果 */
interface EventResponse {
  success: boolean;
  message: string;
}

export class EventRouter {
  /** 容器名：VIP 会员页面 */
  static readonly CONTAINER_VIP: string = 'vip';

  /** 容器名：借款页面 */
  static readonly CONTAINER_LOAN: string = 'loan';

  /** 容器名：线索页面 */
  static readonly CONTAINER_LEAD: string = 'lead';

  /** 容器名：通用页面 */
  static readonly CONTAINER_COMMON: string = 'common';

  /** 容器名：Native 端（直接消费，不转发） */
  static readonly CONTAINER_HOST: string = 'host';

  private static readonly METHOD_POST_TO_NATIVE: string = 'postToNative';
  private static readonly METHOD_POST_TO_WEB: string = 'postToWeb';

  /** 容器名 → JSBridgeManager 映射表 */
  private webViews: Map<string, JSBridgeManager> = new Map();

  /** host 事件处理器（Native 直接消费的事件） */
  private hostEventHandler: ((event: string, data: string) => void) | null = null;

  /** 调试模式 */
  private debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * 注册 WebView 并自动注册 postToNative Handler
   *
   * 注册后，该 WebView 内的前端调用 postToNative 时，
   * 事件会被路由到对应容器的 WebView。
   *
   * @param container 容器名
   * @param bridgeManager 对应的 JSBridgeManager 实例
   */
  registerWebView(container: string, bridgeManager: JSBridgeManager): void {
    this.webViews.set(container, bridgeManager);

    // 注册 postToNative Handler
    const handler: SyncBridgeHandler = (params: string): string => {
      return this.handlePostToNative(params);
    };
    bridgeManager.registerHandler(EventRouter.METHOD_POST_TO_NATIVE, handler);

    this.log(`registered WebView for container=${container}`);
  }

  /**
   * 注销 WebView（页面销毁时调用，防止内存泄漏）
   *
   * @param container 容器名
   */
  unregisterWebView(container: string): void {
    this.webViews.delete(container);
    this.log(`unregistered WebView for container=${container}`);
  }

  /**
   * 注册 host 事件处理器
   *
   * 当第一级容器名为 "host" 时，Native 直接消费事件，
   * 调用此处理器，不转发给任何 WebView。
   *
   * @param handler 事件处理器
   */
  onHostEvent(handler: (event: string, data: string) => void): void {
    this.hostEventHandler = handler;
    this.log('host event handler registered');
  }

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
  private handlePostToNative(params: string): string {
    try {
      const parsed: PostToNativeData = JSON.parse(params) as PostToNativeData;
      const event: string = parsed.event;

      // 验证四级格式
      const parts: string[] = event.split(':');
      let valid: boolean = parts.length === 4;
      if (valid) {
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].length === 0) {
            valid = false;
            break;
          }
        }
      }

      if (!valid) {
        this.log(`invalid event format (not 4-level): ${event}`);
        const errResponse: EventResponse = { success: false, message: `Invalid event format: ${event}` };
        return JSON.stringify(errResponse);
      }

      const container: string = parts[0];
      const hasData: boolean = parsed.data != null;
      const dataStr: string = hasData ? JSON.stringify(parsed.data) : '';

      if (container === EventRouter.CONTAINER_HOST) {
        // host 事件：Native 直接消费
        if (this.hostEventHandler) {
          this.hostEventHandler(event, dataStr);
        }
        this.log(`host event consumed: ${event}`);
      } else {
        // 路由到目标 WebView
        const targetBridge = this.webViews.get(container);
        if (targetBridge) {
          const postData: PostToWebData = {
            event: event,
            data: hasData ? parsed.data : '',
          };
          const postDataStr: string = JSON.stringify(postData);
          targetBridge.callJs(EventRouter.METHOD_POST_TO_WEB, [postDataStr]);
          this.log(`routed event '${event}' to container=${container}`);
        } else {
          this.log(`no WebView registered for container=${container}`);
        }
      }

      const response: EventResponse = { success: true, message: '' };
      return JSON.stringify(response);
    } catch (e) {
      this.log(`error handling postToNative: ${e}`);
      const errResponse: EventResponse = { success: false, message: `${e}` };
      return JSON.stringify(errResponse);
    }
  }

  /**
   * 清除所有注册（防止内存泄漏）
   * 页面完全销毁时调用
   */
  clear(): void {
    this.webViews.clear();
    this.hostEventHandler = null;
    this.log('all registrations cleared');
  }

  private log(msg: string): void {
    if (this.debug) {
      console.log(`[EventRouter] ${msg}`);
    }
  }
}

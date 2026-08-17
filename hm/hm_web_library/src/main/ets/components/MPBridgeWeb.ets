/**
 * MPBridgeWeb 组件
 *
 * 基于鸿蒙官方 Web 组件封装的 JSBridge WebView 组件。
 * 通过 javaScriptProxy 注入桥接对象，实现 JS <-> Native 双向通信。
 *
 * 使用方式：
 * ```typescript
 * import { MPBridgeWeb, JSBridgeManager } from 'hm_web_library'
 *
 * @Entry
 * @Component
 * struct MyPage {
 *   private bridgeManager: JSBridgeManager = new JSBridgeManager(true);
 *
 *   build() {
 *     MPBridgeWeb({
 *       bridgeManager: this.bridgeManager,
 *       url: 'https://your-page.com'
 *     })
 *   }
 * }
 * ```
 */
import { webview } from '@kit.ArkWeb';
import { JSBridgeManager } from '../bridge/JSBridge';
import { SyncBridgeHandler, AsyncBridgeHandler } from '../bridge/BridgeHandler';

/**
 * javaScriptProxy 注入对象
 * 注册到 window._dsbridge，供 bridge.js 调用
 */
class DsBridgeProxy {
  private manager: JSBridgeManager;

  constructor(manager: JSBridgeManager) {
    this.manager = manager;
  }

  /**
   * 同步调用 Native Handler
   * @param requestJson BridgeRequest JSON 字符串
   * @returns BridgeResponse JSON 字符串
   */
  call(requestJson: string): string {
    return this.manager.handleSyncCall(requestJson);
  }

  /**
   * 异步调用 Native Handler
   * @param requestJson BridgeRequest JSON 字符串
   * @returns 空字符串
   */
  callAsync(requestJson: string): string {
    return this.manager.handleAsyncCall(requestJson);
  }

  /**
   * 检查方法是否存在
   * @param method 方法名
   * @returns 是否存在
   */
  hasMethod(method: string): boolean {
    return this.manager.hasMethod(method);
  }

  /**
   * Native 调用 JS 后的结果回传
   * @param callbackId 回调 ID
   * @param result 结果
   */
  onNativeCallComplete(callbackId: string, result: string): void {
    this.manager.onNativeCallComplete(callbackId, result);
  }
}

@Component
export struct MPBridgeWeb {
  /** JSBridge 管理器实例 */
  @Prop bridgeManager: JSBridgeManager = new JSBridgeManager();
  /** 要加载的 URL */
  @Prop url: string = '';
  /** 是否开启调试模式 */
  @Prop debug: boolean = false;
  /** WebView 控制器（外部可传入以获取控制权） */
  @Link controller: webview.WebviewController;

  /** 内部代理对象 */
  private dsBridgeProxy: DsBridgeProxy = new DsBridgeProxy(this.bridgeManager);

  aboutToAppear(): void {
    // 启用 WebView 调试
    if (this.debug) {
      webview.WebviewController.initializeWebEngine();
      console.log('[MPBridgeWeb] aboutToAppear, debug mode enabled');
    }
  }

  build() {
    Web({ src: this.url, controller: this.controller })
      .javaScriptAccess(true)
      .domStorageAccess(true)
      .javaScriptProxy({
        object: this.dsBridgeProxy,
        name: '_dsbridge',
        methodList: ['call', 'callAsync', 'hasMethod', 'onNativeCallComplete'],
        controller: this.controller
      })
      .onPageBegin(() => {
        // 页面开始加载时注入 bridge.js
        this.bridgeManager.setWebController(this.controller);
        this.injectBridgeJs();
      })
      .onPageEnd(() => {
        if (this.debug) {
          console.log('[MPBridgeWeb] page loaded:', this.url);
        }
      })
      .width('100%')
      .height('100%');
  }

  /**
   * 注入 bridge.js 到 WebView
   * 从 rawfile 读取 bridge.js 并执行
   */
  private injectBridgeJs(): void {
    try {
      let context = getContext(this);
      let rawFile = context.resourceManager.getRawFileContentSync('bridge.js');
      let bridgeJsCode = rawFile.toString();
      this.controller.runJavaScript(bridgeJsCode);
      if (this.debug) {
        console.log('[MPBridgeWeb] bridge.js injected successfully');
      }
    } catch (e) {
      console.error('[MPBridgeWeb] Failed to inject bridge.js:', JSON.stringify(e));
    }
  }
}

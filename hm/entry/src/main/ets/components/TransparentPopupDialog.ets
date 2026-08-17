/**
 * TransparentPopupDialog — 透明弹窗 @CustomDialog 组件
 *
 * 对应 AppLink scheme 中 pageName=transparent 的场景。
 *
 * 设计：
 * 1. @CustomDialog 组件，在父页面内弹出
 * 2. 背景半透明遮罩，点击遮罩可关闭
 * 3. 内含 Web 组件加载目标 URL（由 H5 页面自行处理弹窗 UI）
 * 4. 自带独立的 JSBridgeManager + DsBridgeProxy，支持弹窗内 JS 通信
 *
 * 引用管理：
 * 父页面通过 CustomDialogController 持有引用，
 * 创建后调用 registerClose(() => controller.close()) 注册到 AppLinkHandler 链表。
 * backHome 时 SDK 自动调用 closeFn 关闭弹窗。
 */

import { webview } from '@kit.ArkWeb';
import {
  JSBridgeManager,
  DsBridgeProxy,
  BridgeUtils
} from 'hm_web_library';

@CustomDialog
export struct TransparentPopupDialog {
  controller: CustomDialogController;
  @Prop url: string = '';
  @Prop title: string = '';
  @State private webController: webview.WebviewController = new webview.WebviewController();
  private bridgeManager: JSBridgeManager = new JSBridgeManager(true);
  private dsBridgeProxy: DsBridgeProxy = new DsBridgeProxy(this.bridgeManager);
  private finalUrl: string = '';

  aboutToAppear(): void {
    this.finalUrl = BridgeUtils.appendPlatformParam(this.url);
    console.log(`[TransparentPopupDialog] aboutToAppear, url=${this.url}, finalUrl=${this.finalUrl}`);
  }

  aboutToDisappear(): void {
    console.log('[TransparentPopupDialog] aboutToDisappear');
  }

  build() {
    // 半透明遮罩 + WebView 容器
    Stack() {
      // 遮罩层（点击关闭）
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor('#80000000')
        .onClick(() => {
          this.controller.close();
        })

      // WebView 内容区域
      Column() {
        // 标题栏
        if (this.title.length > 0) {
          Row() {
            Text(this.title)
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .fontColor('#333')
            Button('关闭')
              .fontSize(12)
              .height(28)
              .onClick(() => {
                this.controller.close();
              })
              .margin({ right: 12 })
          }
          .width('100%')
          .height(44)
          .backgroundColor('#FFFFFF')
          .padding({ left: 16, right: 4 })
        }

        // Web 组件
        Web({ src: this.finalUrl, controller: this.webController })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .javaScriptProxy({
            object: this.dsBridgeProxy,
            name: '_dsbridge',
            methodList: ['call', 'callAsync', 'hasMethod', 'onNativeCallComplete'],
            controller: this.webController
          })
          .onPageBegin(() => {
            this.bridgeManager.setWebController(this.webController);
            BridgeUtils.injectBridgeJs(this.webController, getContext(this));
          })
          .layoutWeight(1)
          .width('100%')
      }
      .width('90%')
      .height('80%')
      .backgroundColor('#FFFFFF')
      .borderRadius(12)
      .clip(true)
    }
    .width('100%')
    .height('100%')
  }
}

/**
 * LoanPage — 借款页面数据同步验证（装饰器 + create 工厂）
 *
 * 验证鸿蒙端装饰器方式的数据同步：
 * 1. @NeedsDataSync 装饰器声明所需通道
 * 2. DataSyncHelper.create() 自动从静态绑定 / 运行时注册表获取通道
 * 3. aboutToAppear 中设置业务数据
 * 4. onPageEnd 时通知 DataSyncHelper 触发数据推送
 *
 * 对标 Android 的 @NeedsUserInfo + KSP 方案。
 */

import { webview } from '@kit.ArkWeb';
import { router } from '@kit.ArkUI';
import {
  JSBridgeManager,
  DataSyncHelper,
  DataSyncChannel,
  DsBridgeProxy,
  BridgeUtils,
  NeedsDataSync
} from 'hm_web_library';

@Entry
@Component
@NeedsDataSync([DataSyncChannel.USER_INFO, DataSyncChannel.LOAN_INFO])
struct LoanPage {
  private bridgeManager: JSBridgeManager = new JSBridgeManager(true);
  private dataSyncHelper: DataSyncHelper = DataSyncHelper.create(this.bridgeManager, LoanPage, true);
  private dsBridgeProxy: DsBridgeProxy = new DsBridgeProxy(this.bridgeManager);
  @State controller: webview.WebviewController = new webview.WebviewController();
  @State statusText: string = '准备中...';
  private finalUrl: string = '';

  aboutToAppear(): void {
    // 场景A：页面加载前设置数据
    this.dataSyncHelper.setUserInfo('{"uid":"user_001","ticket":"ticket_abc123"}');
    this.dataSyncHelper.setLoanInfo('{"loanId":"L20240001","amount":50000,"term":12}');
    // 计算最终 URL（追加 platform=harmony）
    this.finalUrl = BridgeUtils.appendPlatformParam('resource://rawfile/demo.html');
    this.statusText = '数据已设置 → 加载页面中';
  }

  build() {
    Column() {
      // 顶部状态栏
      Row() {
        Button('返回')
          .fontSize(14)
          .onClick(() => router.back())
          .margin({ left: 12 })
        Text('LoanPage 数据同步验证')
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
      }
      .width('100%')
      .height(56)
      .backgroundColor('#f5f5f5')

      // 状态文本
      Text(this.statusText)
        .fontSize(12)
        .fontColor('#666')
        .padding(12)
        .width('100%')

      // 原生 Web 组件 + 工具注入
      Web({ src: this.finalUrl, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .javaScriptProxy({
          object: this.dsBridgeProxy,
          name: '_dsbridge',
          methodList: ['call', 'callAsync', 'hasMethod', 'onNativeCallComplete'],
          controller: this.controller
        })
        .onPageBegin(() => {
          // 注入 bridge.js + 通知页面开始加载
          this.bridgeManager.setWebController(this.controller);
          BridgeUtils.injectBridgeJs(this.controller, getContext(this));
          this.dataSyncHelper.notifyPageLoading();
        })
        .onPageEnd(() => {
          // 通知页面加载完成 → 触发数据推送
          this.dataSyncHelper.notifyPageLoaded();
          this.statusText = '页面已加载 → 数据已推送';
        })
        .layoutWeight(1)
        .width('100%')
    }
    .width('100%')
    .height('100%')
  }
}

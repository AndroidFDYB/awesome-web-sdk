/**
 * LoanPage — 借款页面数据同步验证
 *
 * 验证鸿蒙端 DataSyncHelper 的完整流程：
 * 1. 创建 DataSyncHelper 声明所需通道 [USER_INFO, LOAN_INFO]
 * 2. aboutToAppear 中设置业务数据（页面加载前）
 * 3. MPBridgeWeb 自动追加 ?platform=harmony 并加载页面
 * 4. MPBridgeWeb onPageEnd 自动调用 notifyPageLoaded
 * 5. DataSyncHelper.pushPendingData → callJs("syncUserInfo"/"syncLoanInfo")
 */

import { webview } from '@kit.ArkWeb';
import { router } from '@kit.ArkUI';
import { MPBridgeWeb, JSBridgeManager, DataSyncHelper, DataSyncChannel } from 'hm_web_library';

@Entry
@Component
struct LoanPage {
  private bridgeManager: JSBridgeManager = new JSBridgeManager(true);
  private dataSyncHelper: DataSyncHelper = new DataSyncHelper(
    this.bridgeManager,
    [DataSyncChannel.USER_INFO, DataSyncChannel.LOAN_INFO],
    true
  );
  @State controller: webview.WebviewController = new webview.WebviewController();
  @State statusText: string = '准备中...';

  aboutToAppear(): void {
    // 场景A：页面加载前设置数据
    this.dataSyncHelper.setUserInfo('{"uid":"user_001","ticket":"ticket_abc123"}');
    this.dataSyncHelper.setLoanInfo('{"loanId":"L20240001","amount":50000,"term":12}');
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

      // WebView 区域
      MPBridgeWeb({
        bridgeManager: this.bridgeManager,
        url: 'resource://rawfile/demo.html',
        debug: true,
        dataSyncHelper: this.dataSyncHelper,
        controller: this.controller
      })
        .layoutWeight(1)
        .width('100%')
    }
    .width('100%')
    .height('100%')
  }
}

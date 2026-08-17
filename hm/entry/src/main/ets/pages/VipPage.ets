/**
 * VipPage — 会员页面数据同步验证
 *
 * 验证鸿蒙端 DataSyncHelper 的 VipInfo 通道：
 * 1. 创建 DataSyncHelper 声明所需通道 [USER_INFO, VIP_INFO]
 * 2. aboutToAppear 中设置用户信息和会员信息
 * 3. MPBridgeWeb 自动加载页面并推送数据
 *
 * 验证点：
 * - DataSyncChannel.VIP_INFO → syncVipInfo 方法名
 * - callJs("syncVipInfo", [data]) 推送到 JS
 */

import { webview } from '@kit.ArkWeb';
import { router } from '@kit.ArkUI';
import { MPBridgeWeb, JSBridgeManager, DataSyncHelper, DataSyncChannel } from 'hm_web_library';

@Entry
@Component
struct VipPage {
  private bridgeManager: JSBridgeManager = new JSBridgeManager(true);
  private dataSyncHelper: DataSyncHelper = new DataSyncHelper(
    this.bridgeManager,
    [DataSyncChannel.USER_INFO, DataSyncChannel.VIP_INFO],
    true
  );
  @State controller: webview.WebviewController = new webview.WebviewController();
  @State statusText: string = '准备中...';

  aboutToAppear(): void {
    // 设置用户信息和会员信息
    this.dataSyncHelper.setUserInfo('{"uid":"user_002","ticket":"ticket_xyz789"}');
    this.dataSyncHelper.setVipInfo('{"level":"gold","points":12500,"expireDate":"2025-12-31"}');
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
        Text('VipPage 数据同步验证')
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

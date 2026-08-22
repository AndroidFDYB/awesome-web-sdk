/**
 * VipPage — 会员页面 AppLink + DataSync 集成验证（装饰器 + create 工厂）
 *
 * 验证鸿蒙端完整的 AppLink 跳转 + 装饰器数据同步流程：
 *
 * DataSync：
 * 1. @NeedsDataSync 装饰器声明所需通道 [USER_INFO, VIP_INFO]
 * 2. DataSyncHelper.create() 自动获取通道列表
 * 3. aboutToAppear 中设置用户信息和会员信息
 * 4. onPageEnd 时通知 DataSyncHelper 触发数据推送
 *
 * AppLink：
 * 1. AppLinkHandler 注册 jump2Native，前端 H5 可通过 scheme 触发原生跳转
 * 2. VipPageAppLinkDelegate 实现 AppLinkActionDelegate：
 *    - openPage: 透明弹窗用 @CustomDialog（registerClose 注册关闭回调）
 *    - handleAction: backHome 时 router 返回首页
 * 3. 弹窗引用管理采用回调注册表模式，SDK 持有 closeFn 闭包
 */

import { webview } from '@kit.ArkWeb';
import { router } from '@kit.ArkUI';
import {
  JSBridgeManager,
  DataSyncHelper,
  DataSyncChannel,
  DsBridgeProxy,
  BridgeUtils,
  AppLinkHandler,
  AppLinkActionDelegate,
  AppLinkParams,
  PAGE_TRANSPARENT,
  NeedsDataSync
} from 'hm_web_library';
import { TransparentPopupDialog } from '../components/TransparentPopupDialog';

/**
 * VipPage 的 AppLink 委托实现
 *
 * 使用 class 实现 AppLinkActionDelegate 接口（ArkTS 严格模式不允许对象字面量实现接口）。
 * 通过构造函数注入回调函数，将组件上下文桥接到委托逻辑中：
 * - openPageFn: 在组件内执行，可创建 CustomDialogController
 * - handleActionFn: 在组件内执行，可更新状态文本
 */
class VipPageAppLinkDelegate implements AppLinkActionDelegate {
  private openPageFn: (params: AppLinkParams, registerClose: (closeFn: () => void) => void) => void;
  private handleActionFn: (actionScheme: string) => void;

  constructor(
    openPageFn: (params: AppLinkParams, registerClose: (closeFn: () => void) => void) => void,
    handleActionFn: (actionScheme: string) => void
  ) {
    this.openPageFn = openPageFn;
    this.handleActionFn = handleActionFn;
  }

  openPage(params: AppLinkParams, registerClose: (closeFn: () => void) => void): void {
    this.openPageFn(params, registerClose);
  }

  handleAction(actionScheme: string): void {
    this.handleActionFn(actionScheme);
  }
}

@Entry
@Component
@NeedsDataSync([DataSyncChannel.USER_INFO, DataSyncChannel.VIP_INFO])
struct VipPage {
  private bridgeManager: JSBridgeManager = new JSBridgeManager(true);
  private dataSyncHelper: DataSyncHelper = DataSyncHelper.create(this.bridgeManager, VipPage, true);
  private dsBridgeProxy: DsBridgeProxy = new DsBridgeProxy(this.bridgeManager);
  private appLinkHandler: AppLinkHandler = new AppLinkHandler(
    this.bridgeManager,
    new VipPageAppLinkDelegate(
      // openPage 回调：在组件上下文中创建弹窗
      (params: AppLinkParams, registerClose: (closeFn: () => void) => void): void => {
        this.appendStatus(`openPage: ${params.pageName}, url=${params.url}`);

        if (params.pageName === PAGE_TRANSPARENT) {
          // 透明弹窗 → @CustomDialog
          const dialogController: CustomDialogController = new CustomDialogController({
            builder: TransparentPopupDialog({
              url: params.url,
              title: params.title ?? ''
            }),
            customStyle: true,
            autoCancel: true
          });
          dialogController.open();
          // 关键：注册关闭回调到 SDK 链表
          registerClose((): void => {
            dialogController.close();
          });
        } else {
          // 普通页面 → router 导航
          router.pushUrl({
            url: 'pages/' + params.pageName,
            params: { url: params.url, title: params.title ?? '' }
          });
        }
      },
      // handleAction 回调：backHome 处理
      (actionScheme: string): void => {
        this.appendStatus(`handleAction: ${actionScheme}`);
        // backHome 场景：SDK 已自动 closeAllPopups，这里返回到首页
        router.back();
      }
    ),
    true
  );
  @State controller: webview.WebviewController = new webview.WebviewController();
  @State statusText: string = '准备中...';
  private finalUrl: string = '';

  aboutToAppear(): void {
    // 设置用户信息和会员信息
    this.dataSyncHelper.setUserInfo('{"uid":"vip_user_001","ticket":"vip_ticket_abc","nickname":"VIP会员","avatar":"https://example.com/avatar.png","level":5}');
    this.dataSyncHelper.setVipInfo('{"vipId":"VIP20240001","vipLevel":3,"expireDate":"2025-12-31","privileges":["免广告","专属客服","积分加速"]}');
    // 计算最终 URL（追加 platform=harmony）
    this.finalUrl = BridgeUtils.appendPlatformParam('resource://rawfile/demo.html');
    this.statusText = '数据已设置 → 加载页面中';
  }

  /**
   * 测试 jump2Native：模拟前端 H5 调用弹窗 scheme
   */
  private testJump2Native(): void {
    this.appendStatus('\n--- 测试 jump2Native ---');
    const scheme = "sk://native={pageName='transparent',url='resource://rawfile/demo.html',title='VIP弹窗'}";
    this.controller.runJavaScript(
      `window._dsbridge.call('jump2Native', JSON.stringify({scheme: "${scheme}"}), function(r){console.log(r);})`
    );
  }

  /**
   * 测试 backHome：模拟前端 H5 调用 backHome scheme
   */
  private testBackHome(): void {
    this.appendStatus('\n--- 测试 backHome ---');
    const scheme = "sk://native={pageName='vip',url='resource://rawfile/demo.html',title='首页',backHome='1'}";
    this.controller.runJavaScript(
      `window._dsbridge.call('jump2Native', JSON.stringify({scheme: "${scheme}"}), function(r){console.log(r);})`
    );
  }

  private appendStatus(msg: string): void {
    this.statusText = this.statusText + '\n' + msg;
    console.log(`[VipPage] ${msg}`);
  }

  build() {
    Column() {
      // 顶部状态栏
      Row() {
        Button('返回')
          .fontSize(14)
          .onClick(() => router.back())
          .margin({ left: 12 })
        Text('VipPage AppLink + DataSync')
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
      }
      .width('100%')
      .height(48)
      .backgroundColor('#f5f5f5')

      // 测试按钮栏
      Row() {
        Button('测试弹窗')
          .fontSize(12)
          .height(32)
          .onClick(() => this.testJump2Native())
        Button('测试 backHome')
          .fontSize(12)
          .height(32)
          .margin({ left: 8 })
          .onClick(() => this.testBackHome())
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 4, bottom: 4 })
      .justifyContent(FlexAlign.Start)

      // 状态文本
      Text(this.statusText)
        .fontSize(11)
        .fontColor('#666')
        .padding({ left: 12, right: 12, bottom: 4 })
        .width('100%')
        .maxLines(5)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

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
          this.appendStatus('页面已加载 → 数据已推送');
        })
        .layoutWeight(1)
        .width('100%')
    }
    .width('100%')
    .height('100%')
  }
}

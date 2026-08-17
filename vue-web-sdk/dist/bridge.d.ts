/**
 * MPBridge 核心实现
 *
 * 提供统一的跨平台 JSBridge API，自动检测运行环境并适配不同的 Native 桥接：
 *
 * - Android：使用 happydog-intj/JsBridge，通过 BridgeWebView 自动注入 window.WebViewJavascriptBridge
 *   JS 端使用 setupWebViewJavascriptBridge() 初始化，bridge.callHandler / bridge.registerHandler
 *
 * - 鸿蒙：使用 MPBridgeWeb 组件注入 bridge.js，提供 window.dsBridge（自定义协议）
 *   JS 端使用 dsBridge.call / dsBridge.callAsync / dsBridge.register
 *
 * - 纯 Web：提供 fallback 实现，方法调用会输出警告
 */
import type { IMPBridge } from './types';
/**
 * 获取 MPBridge 单例
 */
export declare function getBridge(): IMPBridge;
/**
 * 重置实例（用于测试或环境变化时）
 * 同时重置数据同步 Handler 注册标记，以便重新注册
 */
export declare function resetBridge(): void;
/**
 * 注册数据同步 Handler（委托给 proto codegen 生成的函数）
 *
 * 当 Bridge 就绪后，自动注册以下 JS Handler 供 Native 调用：
 * - syncUserInfo：接收 Native 推送的用户信息
 * - syncLoanInfo：接收 Native 推送的借款信息
 * - syncVipInfo：接收 Native 推送的会员信息
 *
 * 此函数在 bridge onReady 时自动调用，也可手动调用以重新注册。
 */
export declare function setupDataSyncHandlers(): void;

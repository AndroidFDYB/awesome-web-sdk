/**
 * @mp-sdk/bridge
 *
 * 跨平台 JSBridge SDK
 * 提供统一的 JS <-> Native 桥接通信能力
 *
 * 支持平台：Android（DSBridge）、HarmonyOS（javaScriptProxy）、纯 Web
 *
 * 使用示例：
 * ```typescript
 * import { bridge } from '@mp-sdk/bridge'
 *
 * // 调用 Native 方法（同步）
 * const userInfo = bridge.call('getUserInfo')
 *
 * // 调用 Native 方法（异步）
 * const result = await bridge.callAsync('pay', { amount: 100 })
 *
 * // 注册 JS 方法供 Native 调用
 * bridge.register('onPageReady', (params) => {
 *   console.log('Page ready with params:', params)
 *   return { status: 'ok' }
 * })
 * ```
 */
export { getBridge, resetBridge } from './bridge';
export type { IMPBridge, Platform, SyncHandler, AsyncHandler, IDSBridge } from './types';
export declare const bridge: import("./types").IMPBridge;

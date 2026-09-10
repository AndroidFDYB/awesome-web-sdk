/**
 * Emitter 模块导出
 *
 * 跨 WebView 事件通信中间件，提供无感的跨 WebView emitter 通信能力。
 *
 * 核心功能：
 * 1. 跨 WebView 事件通信：4级事件名格式（container:scope:model:event）自动路由到目标 WebView
 * 2. 本地事件总线：非4级事件名走本地分发
 * 3. 内存安全：提供 off/clear 完整清理机制
 *
 * 使用方式：
 * ```typescript
 * import { emitter } from '@androidfdyb/bridge'
 *
 * // 监听跨 WebView 事件（在 WebViewForVip 页面中）
 * emitter.on('vip:vipbuy:success:two', (data) => {
 *   console.log('收到 VIP 购买成功事件', data)
 * })
 *
 * // 发射跨 WebView 事件（在 WebViewForLoan 页面中）
 * emitter.emit('vip:vipbuy:success:two', { orderId: '123', amount: 99 })
 *
 * // 发射 host 事件（通知 Native）
 * emitter.emit('host:payment:completed:done', { orderId: '123' })
 *
 * // 本地事件（非4级格式）
 * emitter.on('pageReady', () => { ... })
 * emitter.emit('pageReady')
 *
 * // 清理监听器（防止内存泄漏）
 * emitter.off('vip:vipbuy:success:two', handler)
 * emitter.clear()
 * ```
 */

export { MPEmitter, getEmitter, resetEmitter } from './emitter';
export type { TransportFunction } from './emitter';

export {
  EMITTER_CONTAINER,
  POST_TO_NATIVE_METHOD,
  POST_TO_WEB_METHOD,
  isFourLevelEvent,
  getContainerName,
} from './types';
export type { PostToNativeParams, PostToWebParams, EmitterHandler } from './types';

// 便捷导出默认实例
import { getEmitter } from './emitter';
export const emitter = getEmitter();

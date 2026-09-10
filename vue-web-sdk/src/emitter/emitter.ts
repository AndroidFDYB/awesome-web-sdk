/**
 * MPEmitter - 跨 WebView 事件发射器
 *
 * 轻量级事件发射器（零依赖），支持：
 * - 本地事件通信（非四级事件名，如 'pageReady'）
 * - 跨 WebView 事件通信（四级事件名，通过 JSBridge 路由到 Native 再转发到目标 WebView）
 *
 * 工作原理：
 * - emit('vip:vipbuy:success:two', data)  → 检测到4级格式 → 通过 transport 发送给 Native
 * - emit('pageReady')                     → 非四级格式 → 本地 dispatch
 * - on('vip:vipbuy:success:two', handler) → 注册监听器
 * - Native 通过 postToWeb 调用 → dispatch → 触发监听器
 *
 * 内存管理（防止内存泄漏）：
 * - 监听器使用 Set 存储，避免重复注册
 * - 提供 off() 移除单个监听器
 * - 提供 clearEvent() 清除指定事件的所有监听器
 * - 提供 clear() 清除所有监听器和引用
 * - 页面销毁时调用 clear() 确保无内存泄漏
 *
 * 使用方式：
 * ```typescript
 * import { emitter } from '@androidfdyb/bridge'
 *
 * // 监听跨 WebView 事件
 * emitter.on('vip:vipbuy:success:two', (data) => { ... })
 *
 * // 发射跨 WebView 事件
 * emitter.emit('vip:vipbuy:success:two', { orderId: '123' })
 *
 * // 本地事件
 * emitter.on('pageReady', () => { ... })
 * emitter.emit('pageReady')
 *
 * // 清理（页面销毁时）
 * emitter.off('vip:vipbuy:success:two', handler)
 * emitter.clear()
 * ```
 */

import { isFourLevelEvent } from './types';
import type { EmitterHandler } from './types';

/** 传输函数签名：将4级事件发送到 Native（由 bridge 在 onReady 时注入） */
export type TransportFunction = (event: string, data?: any) => void;

export class MPEmitter {
  /** 事件处理器映射：eventName -> Set<handler>（使用 Set 避免重复注册） */
  private handlers: Map<string, Set<EmitterHandler>> = new Map();

  /** 传输函数：由 bridge 注入，用于将4级事件发送到 Native */
  private transport: TransportFunction | null = null;

  /** 调试模式 */
  private debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * 设置传输函数（由 bridge 在 onReady 时注入）
   *
   * 4级事件 emit 时通过此函数发送到 Native：
   * transport('vip:vipbuy:success:two', data) → bridge.callAsync('postToNative', { event, data })
   */
  setTransport(fn: TransportFunction): void {
    this.transport = fn;
    this.log('Transport function set');
  }

  /**
   * 注册事件监听器
   *
   * 支持4级格式事件（跨 WebView）和普通事件名（本地）。
   * 同一事件同一 handler 不会重复注册（Set 去重）。
   *
   * @param event 事件名（4级格式如 'vip:vipbuy:success:two' 或普通名如 'pageReady'）
   * @param handler 事件处理器
   */
  on(event: string, handler: EmitterHandler): void {
    if (typeof handler !== 'function') {
      console.warn('[MPEmitter] handler must be a function');
      return;
    }
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    this.log(`on: "${event}", handler count: ${this.handlers.get(event)!.size}`);
  }

  /**
   * 移除事件监听器
   *
   * @param event 事件名
   * @param handler 要移除的处理器（必须与 on 注册时是同一引用）
   */
  off(event: string, handler: EmitterHandler): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
      this.log(`off: "${event}", remaining handlers: ${set.size}`);
    }
  }

  /**
   * 发射事件
   *
   * - 四级格式事件（如 'vip:vipbuy:success:two'）：通过 transport 发送给 Native，不本地分发
   *   Native 路由后通过 postToWeb 回传，由 dispatch 统一触发监听器
   * - 非四级格式事件（如 'pageReady'）：直接本地分发
   * - 若 transport 未设置（纯 Web 环境或 bridge 未就绪），4级事件降级为本地分发
   *
   * @param event 事件名
   * @param data 事件数据（可选）
   */
  emit(event: string, data?: any): void {
    if (isFourLevelEvent(event)) {
      // 4级事件：发送到 Native
      if (this.transport) {
        this.log(`emit (cross-webview): "${event}"`);
        this.transport(event, data);
      } else {
        // 纯 Web 环境降级：本地分发
        this.log(`emit (cross-webview, no transport → local fallback): "${event}"`);
        this.dispatch(event, data);
      }
    } else {
      // 非四级事件：本地分发
      this.log(`emit (local): "${event}"`);
      this.dispatch(event, data);
    }
  }

  /**
   * 本地分发事件（触发所有监听器）
   *
   * 由 postToWeb Handler 调用（Native 转发的事件），也可直接用于本地事件。
   * 复制 handler 列表后遍历，避免迭代中 off 修改导致的问题。
   *
   * @param event 事件名
   * @param data 事件数据（可选）
   */
  dispatch(event: string, data?: any): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) {
      this.log(`dispatch: no handlers for "${event}"`);
      return;
    }
    this.log(`dispatch: "${event}", calling ${set.size} handlers`);
    // 复制一份避免迭代中 off 修改导致跳过
    const handlersCopy = Array.from(set);
    for (const handler of handlersCopy) {
      try {
        handler(data);
      } catch (e) {
        console.error(`[MPEmitter] Handler error for event "${event}":`, e);
      }
    }
  }

  /**
   * 清除指定事件的所有监听器
   *
   * @param event 事件名
   */
  clearEvent(event: string): void {
    this.handlers.delete(event);
    this.log(`clearEvent: "${event}"`);
  }

  /**
   * 清除所有监听器和引用（防止内存泄漏）
   *
   * 页面销毁时调用，确保所有 handler 引用被释放。
   */
  clear(): void {
    this.handlers.clear();
    this.transport = null;
    this.log('All handlers and transport cleared');
  }

  /**
   * 获取指定事件的监听器数量
   */
  getListenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * 获取所有已注册的事件名
   */
  getEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[MPEmitter] ${message}`);
    }
  }
}

// ========================
// 单例管理
// ========================

let instance: MPEmitter | null = null;

/**
 * 获取 MPEmitter 单例
 *
 * @param debug 是否启用调试日志（仅首次创建时生效）
 */
export function getEmitter(debug: boolean = false): MPEmitter {
  if (!instance) {
    instance = new MPEmitter(debug);
  }
  return instance;
}

/**
 * 重置实例（用于测试）
 * 会清除所有监听器和引用
 */
export function resetEmitter(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}

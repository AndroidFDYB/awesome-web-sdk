/**
 * MPBridge 核心实现
 *
 * 封装 DSBridge（dsbridge npm 包），提供统一的跨平台 JSBridge API。
 * 自动检测运行环境（Android / HarmonyOS / 纯 Web），适配不同的 Native 桥接。
 *
 * 在 Android WebView 中：由 DSBridge-Android 的 DWebView 自动注入 window.dsBridge
 * 在鸿蒙 WebView 中：由 MPBridgeWeb 组件注入 bridge.js，提供 window.dsBridge
 * 在纯 Web 中：提供 fallback 实现，方法调用会输出警告
 */

import type { Platform, IMPBridge, SyncHandler, AsyncHandler, IDSBridge } from './types';

/**
 * 检测当前平台
 */
function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown';
  const w = window as any;
  if (w._dsbridge || w.dsBridge) {
    if (w.__harmony_bridge) return 'harmony';
    return 'android';
  }
  return 'web';
}

/**
 * 获取原生 dsBridge 实例
 * DSBridge-Android 注入的是 window.dsBridge
 * 鸿蒙注入的 bridge.js 也设置了 window.dsBridge
 */
function getNativeDsBridge(): IDSBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (w.dsBridge && typeof w.dsBridge.call === 'function') {
    return w.dsBridge as IDSBridge;
  }
  return null;
}

class MPBridgeImpl implements IMPBridge {
  private nativeBridge: IDSBridge | null = null;
  private platform: Platform = 'unknown';
  private jsHandlers: Map<string, SyncHandler> = new Map();
  private jsAsyncHandlers: Map<string, AsyncHandler> = new Map();

  constructor() {
    this.platform = detectPlatform();
    this.nativeBridge = getNativeDsBridge();
  }

  getPlatform(): Platform {
    return this.platform;
  }

  hasNativeBridge(): boolean {
    return this.nativeBridge !== null;
  }

  /**
   * 同步调用 Native 方法
   */
  call(method: string, params?: any): any {
    if (!this.nativeBridge) {
      console.warn(`[MPBridge] No native bridge available. Cannot call "${method}". Platform: ${this.platform}`);
      return null;
    }
    try {
      return this.nativeBridge.call(method, params);
    } catch (e) {
      console.error(`[MPBridge] call "${method}" failed:`, e);
      return null;
    }
  }

  /**
   * 异步调用 Native 方法（Promise 或回调形式）
   */
  callAsync(method: string, params?: any): Promise<any> {
    return new Promise((resolve) => {
      if (!this.nativeBridge) {
        console.warn(`[MPBridge] No native bridge available. Cannot callAsync "${method}". Platform: ${this.platform}`);
        resolve(null);
        return;
      }
      try {
        this.nativeBridge.call(method, params ?? {}, (result: any) => {
          resolve(result);
        });
      } catch (e) {
        console.error(`[MPBridge] callAsync "${method}" failed:`, e);
        resolve(null);
      }
    });
  }

  /**
   * 注册同步方法供 Native 调用
   * 支持两种调用方式：
   * - register(method, handler) - 注册单个方法
   * - register(namespace, apiObject) - 注册命名空间
   */
  register(methodOrNamespace: string, handlerOrObject: SyncHandler | Record<string, Function>): void {
    if (typeof handlerOrObject === 'function') {
      // 单个方法注册
      this.jsHandlers.set(methodOrNamespace, handlerOrObject as SyncHandler);
    } else {
      // 命名空间注册
      const obj = handlerOrObject as Record<string, Function>;
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'function') {
          this.jsHandlers.set(`${methodOrNamespace}.${key}`, obj[key] as SyncHandler);
        }
      }
    }

    // 同步到原生桥
    if (this.nativeBridge) {
      try {
        this.nativeBridge.register(methodOrNamespace, handlerOrObject as any);
      } catch (e) {
        // 某些环境不支持 register，忽略
      }
    }
  }

  /**
   * 注册异步方法供 Native 调用
   */
  registerAsyn(methodOrNamespace: string, handlerOrObject: AsyncHandler | Record<string, Function>): void {
    if (typeof handlerOrObject === 'function') {
      this.jsAsyncHandlers.set(methodOrNamespace, handlerOrObject as AsyncHandler);
    } else {
      const obj = handlerOrObject as Record<string, Function>;
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'function') {
          this.jsAsyncHandlers.set(`${methodOrNamespace}.${key}`, obj[key] as AsyncHandler);
        }
      }
    }

    if (this.nativeBridge) {
      try {
        this.nativeBridge.registerAsyn(methodOrNamespace, handlerOrObject as any);
      } catch (e) {
        // 忽略
      }
    }
  }

  hasMethod(method: string): boolean {
    if (this.jsHandlers.has(method) || this.jsAsyncHandlers.has(method)) {
      return true;
    }
    if (this.nativeBridge) {
      try {
        return this.nativeBridge.hasMethod(method);
      } catch (e) {
        return false;
      }
    }
    return false;
  }
}

/** 单例实例 */
let instance: IMPBridge | null = null;

/**
 * 获取 MPBridge 单例
 */
export function getBridge(): IMPBridge {
  if (!instance) {
    instance = new MPBridgeImpl();
  }
  return instance;
}

/**
 * 重置实例（用于测试或环境变化时）
 */
export function resetBridge(): void {
  instance = null;
}

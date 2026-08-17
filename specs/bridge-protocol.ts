/**
 * MPBridge 跨平台 JSBridge 协议定义
 *
 * 本文件定义了三端（Android / HarmonyOS / Web）共享的 JSBridge 通信协议。
 *
 * Android 端基于 happydog-intj/JsBridge 封装，通过 BridgeWebView 自动注入 window.WebViewJavascriptBridge
 *   JS 端调用: bridge.callHandler(method, data, callback) / bridge.registerHandler(method, handler)
 *
 * HarmonyOS 端基于官方 Web 组件的 javaScriptProxy 实现自定义协议
 *   JS 端调用: dsBridge.call(method, params) / dsBridge.callAsync(method, params, callback)
 *
 * Web 端（vue-web-sdk）自动检测运行环境，提供统一 API
 *
 * 平台检测：
 * - Android: window.WebViewJavascriptBridge 存在
 * - 鸿蒙: window.__harmony_bridge + window.dsBridge 存在
 * - 纯 Web: 以上均不存在
 */

// ========================
// JS -> Native 调用
// ========================

/** JS 调用 Native 的请求参数 */
export interface BridgeRequest {
  /** 调用的方法名 */
  method: string;
  /** 传递给方法的参数 */
  params?: Record<string, any> | any;
  /** 异步回调函数（可选，不传则为同步调用） */
  callback?: (response: any) => void;
}

// ========================
// Native -> JS 调用
// ========================

/** Native 调用 JS 的请求 */
export interface NativeCallRequest {
  /** 调用的 JS 方法名 */
  method: string;
  /** 传递给方法的参数数组 */
  args?: any[];
  /** 返回值回调 */
  callback?: (value: any) => void;
}

// ========================
// Handler 注册
// ========================

/** 同步 Handler 签名 */
export type SyncHandler = (params: any) => any;

/** 异步 Handler 签名 */
export type AsyncHandler = (params: any, completionHandler: (result: any) => void) => void;

/** Handler 注册选项 */
export interface HandlerRegistration {
  /** 方法名 */
  method: string;
  /** 是否为异步方法 */
  async?: boolean;
  /** Handler 函数 */
  handler: SyncHandler | AsyncHandler;
}

// ========================
// DSBridge 核心 API（三端统一）
// ========================

/**
 * MPBridge 统一接口
 * 基于 DSBridge 协议，三端实现此接口
 */
export interface IMPBridge {
  /**
   * 调用 Native 方法（同步）
   * @param method 方法名
   * @param params 参数
   * @returns 返回值
   */
  call(method: string, params?: any): any;

  /**
   * 调用 Native 方法（异步）
   * @param method 方法名
   * @param params 参数
   * @param callback 回调函数
   */
  call(method: string, params: any, callback: (response: any) => void): void;

  /**
   * 注册同步方法供 Native 调用
   * @param method 方法名
   * @param handler 处理函数
   */
  register(method: string, handler: SyncHandler): void;

  /**
   * 注册异步方法供 Native 调用
   * @param method 方法名
   * @param handler 处理函数
   */
  registerAsyn(method: string, handler: AsyncHandler): void;

  /**
   * 注册命名空间下的方法
   * @param namespace 命名空间
   * @param apiObject 包含多个方法的对象
   */
  register(namespace: string, apiObject: Record<string, Function>): void;

  /**
   * 注册命名空间下的异步方法
   * @param namespace 命名空间
   * @param apiObject 包含多个异步方法的对象
   */
  registerAsyn(namespace: string, apiObject: Record<string, Function>): void;

  /**
   * 检测当前是否处于 Native WebView 环境
   */
  hasNativeBridge(): boolean;
}

// ========================
// 平台标识
// ========================

export type Platform = 'android' | 'harmony' | 'web' | 'unknown';

/**
 * 平台检测
 * Android: BridgeWebView 自动注入 window.WebViewJavascriptBridge
 * 鸿蒙: MPBridgeWeb 注入 window.dsBridge + window.__harmony_bridge
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown';
  const w = window as any;
  // Android: JsBridge 注入 WebViewJavascriptBridge
  if (w.WebViewJavascriptBridge) return 'android';
  // 鸿蒙: 自定义协议
  if (w.__harmony_bridge && w.dsBridge) return 'harmony';
  return 'web';
}

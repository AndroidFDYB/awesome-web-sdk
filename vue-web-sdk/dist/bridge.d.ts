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
import type { IMPBridge } from './types';
/**
 * 获取 MPBridge 单例
 */
export declare function getBridge(): IMPBridge;
/**
 * 重置实例（用于测试或环境变化时）
 */
export declare function resetBridge(): void;

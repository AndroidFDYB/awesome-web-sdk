/**
 * Emitter 模块类型定义
 *
 * 定义跨 WebView 事件通信的类型和常量。
 * 四级消息格式: <containerName>:<scope>:<vueModelName>:<vueEventName>
 *
 * 容器名映射：
 * - vip    → WebViewForVip
 * - loan   → WebViewForLoan
 * - lead   → WebViewForLead
 * - common → WebViewForCommon
 * - host   → Native 端（直接消费，不转发）
 */

/** 容器名常量 */
export const EMITTER_CONTAINER = {
  /** VIP 会员页面 */
  VIP: 'vip',
  /** 借款页面 */
  LOAN: 'loan',
  /** 线索页面 */
  LEAD: 'lead',
  /** 通用页面 */
  COMMON: 'common',
  /** Native 端（前端发给原生，Native 直接消费） */
  HOST: 'host',
} as const;

/** postToNative JSBridge 方法名（前端 → Native） */
export const POST_TO_NATIVE_METHOD = 'postToNative';

/** postToWeb JSBridge 方法名（Native → 前端） */
export const POST_TO_WEB_METHOD = 'postToWeb';

/** postToNative 调用参数 */
export interface PostToNativeParams {
  /** 四级事件名，如 'vip:vipbuy:success:two' */
  event: string;
  /** 事件数据（可选） */
  data?: any;
}

/** postToWeb 调用参数 */
export interface PostToWebParams {
  /** 四级事件名 */
  event: string;
  /** 事件数据（可选） */
  data?: any;
}

/** 事件处理器签名 */
export type EmitterHandler = (data?: any) => void;

/**
 * 检查事件名是否为四级格式
 *
 * 四级格式: <containerName>:<scope>:<vueModelName>:<vueEventName>
 * 示例: 'vip:vipbuy:success:two'
 *
 * 规则：以 ':' 分隔，恰好 4 段，每段非空
 */
export function isFourLevelEvent(eventName: string): boolean {
  if (!eventName || typeof eventName !== 'string') return false;
  const parts = eventName.split(':');
  return parts.length === 4 && parts.every((p) => p.length > 0);
}

/**
 * 解析四级事件名的第一级（容器名）
 *
 * @returns 容器名（如 'vip'），非四级格式返回 null
 */
export function getContainerName(eventName: string): string | null {
  if (!isFourLevelEvent(eventName)) return null;
  return eventName.split(':')[0];
}

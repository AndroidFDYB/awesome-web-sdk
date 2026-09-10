/**
 * AppLink 模块
 *
 * 提供 jump2Native 方法，将 sk://native={...} 格式的 scheme 字符串
 * 通过 JSBridge 透传给 Native 端进行页面跳转。
 *
 * 使用方式：
 * ```typescript
 * import { jump2Native } from '@androidfdyb/bridge'
 *
 * // 简单页面跳转
 * await jump2Native("sk://native={pageName='vip',url='https://example.com',title='VIP'}")
 *
 * // 回首页再打开页面
 * await jump2Native("sk://native={pageName='vip',url='https://example.com',title='VIP',backHome='1'}")
 * ```
 */

import { getBridge } from '../bridge';
import type { AppLinkCallParams, AppLinkResult } from './types';

/** jump2Native JSBridge 方法名 */
export const JUMP2NATIVE_METHOD = 'jump2Native';

/**
 * 通过 JSBridge 调用 Native 端的页面跳转
 *
 * 将 scheme 字符串透传给 Native，由 Native 端解析并执行跳转。
 * 非 Native 环境下会返回 code=-2 并输出警告。
 *
 * @param scheme 原始 scheme 字符串，如 sk://native={pageName='vip',url='...'}
 * @returns AppLinkResult 跳转结果
 */
export async function jump2Native(scheme: string): Promise<AppLinkResult> {
  const bridge = getBridge();

  if (!bridge.hasNativeBridge()) {
    console.warn(`[MPBridge/AppLink] No native bridge available. Cannot execute jump2Native.`);
    return { code: -2, message: 'No native bridge available' };
  }

  const params: AppLinkCallParams = { scheme };
  const result = await bridge.callAsync(JUMP2NATIVE_METHOD, params);

  if (result && typeof result === 'object' && 'code' in result) {
    return result as AppLinkResult;
  }

  return { code: 0, message: 'success' };
}

export type { AppLinkCallParams, AppLinkResult } from './types';

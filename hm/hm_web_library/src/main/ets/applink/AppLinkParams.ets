/**
 * AppLink scheme 解析后的参数接口
 *
 * 对应 scheme 格式：sk://native={pageName='vip',url='...',title='aaa',backHome='1'}
 */
export interface AppLinkParams {
  /** 页面名称，如 "vip"、"transparent" */
  pageName: string;
  /** 目标页面 URL */
  url: string;
  /** 页面标题（可选） */
  title?: string;
  /** 是否需要先回首页再打开 */
  backHome: boolean;
  /** 原始 scheme 字符串 */
  rawScheme: string;
}

/** 透明弹窗页面名常量 */
export const PAGE_TRANSPARENT: string = 'transparent';

/**
 * 检查是否为透明弹窗
 */
export function isTransparentPage(params: AppLinkParams): boolean {
  return params.pageName === PAGE_TRANSPARENT;
}

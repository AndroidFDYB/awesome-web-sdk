/**
 * AppLink 模块类型定义
 *
 * 定义前端 → Native 的 scheme 跳转通信协议。
 * 前端通过 jump2Native 方法将 sk://native={...} 格式的 scheme 字符串透传给 Native 端。
 */

/** jump2Native 调用参数 */
export interface AppLinkCallParams {
  /** 原始 scheme 字符串，如 sk://native={pageName='vip',url='...'} */
  scheme: string;
}

/** jump2Native 调用结果 */
export interface AppLinkResult {
  /** 状态码：0=成功, -1=解析失败, -2=非Native环境 */
  code: number;
  /** 描述信息 */
  message: string;
}

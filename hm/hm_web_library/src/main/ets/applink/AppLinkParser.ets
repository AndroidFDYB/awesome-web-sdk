/**
 * AppLink scheme 字符串解析器
 *
 * 解析格式：sk://native={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'}
 * 或：sk://action={pageName='vip',url='...',title='aaa',backHome='1'}
 *
 * 解析规则（三端一致）：
 * 1. 提取 scheme 前缀后的 {…} 内容
 * 2. 按 key='value' 格式解析键值对
 * 3. value 内允许包含 =、//、: 等特殊字符
 * 4. 解析失败返回 null
 */

import { AppLinkParams } from './AppLinkParams';

/** scheme 前缀常量 */
const SCHEME_NATIVE_PREFIX: string = 'sk://native=';
const SCHEME_ACTION_PREFIX: string = 'sk://action=';

export class AppLinkParser {
  /** 调试模式 */
  private static debugFlag: boolean = false;

  /**
   * 设置调试模式
   */
  static setDebug(debug: boolean): void {
    AppLinkParser.debugFlag = debug;
  }

  /**
   * 解析 scheme 字符串
   *
   * @param scheme 原始 scheme 字符串
   * @returns 解析后的 AppLinkParams，解析失败返回 null
   */
  static parse(scheme: string): AppLinkParams | null {
    if (!scheme || scheme.length === 0) {
      AppLinkParser.log('parse failed: scheme is blank');
      return null;
    }

    // 提取 {} 内容
    const content = AppLinkParser.extractContent(scheme);
    if (content === null) {
      AppLinkParser.log(`parse failed: cannot extract content from scheme=${scheme}`);
      return null;
    }

    // 解析键值对
    const params = AppLinkParser.parseKeyValuePairs(content);
    if (params.size === 0) {
      AppLinkParser.log(`parse failed: no key-value pairs found in content=${content}`);
      return null;
    }

    const pageName = params.get('pageName');
    const url = params.get('url');

    if (!pageName || pageName.length === 0 || !url || url.length === 0) {
      AppLinkParser.log(`parse failed: pageName or url is missing. pageName=${pageName}, url=${url}`);
      return null;
    }

    const backHome = params.get('backHome') === '1';
    const title = params.get('title');

    return {
      pageName: pageName,
      url: url,
      title: title,
      backHome: backHome,
      rawScheme: scheme
    } as AppLinkParams;
  }

  /**
   * 将 sk://native={...} 转换为 sk://action={...}
   * 用于鸿蒙端将 native scheme 转换为 action scheme 交由根容器处理
   */
  static convertToAction(scheme: string): string {
    if (scheme.startsWith(SCHEME_NATIVE_PREFIX)) {
      return scheme.replace(SCHEME_NATIVE_PREFIX, SCHEME_ACTION_PREFIX);
    }
    return scheme;
  }

  /**
   * 提取 {…} 中的内容
   */
  private static extractContent(scheme: string): string | null {
    const braceStart = scheme.indexOf('{');
    const braceEnd = scheme.lastIndexOf('}');
    if (braceStart < 0 || braceEnd < 0 || braceEnd <= braceStart) {
      return null;
    }
    return scheme.substring(braceStart + 1, braceEnd);
  }

  /**
   * 解析 key='value' 格式的键值对
   *
   * 格式示例：pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'
   *
   * 解析策略：
   * - 按 key= 分割
   * - value 被单引号包裹：提取 ' 之间的内容
   * - value 无引号：取到下一个逗号为止
   */
  private static parseKeyValuePairs(content: string): Map<string, string> {
    const result = new Map<string, string>();
    let pos = 0;

    while (pos < content.length) {
      // 跳过空白和逗号
      while (pos < content.length && (content.charAt(pos) === ',' || content.charAt(pos) === ' ')) {
        pos++;
      }
      if (pos >= content.length) break;

      // 读取 key
      const eqIndex = content.indexOf('=', pos);
      if (eqIndex < 0) break;
      const key = content.substring(pos, eqIndex).trim();
      pos = eqIndex + 1;

      // 跳过空白
      while (pos < content.length && content.charAt(pos) === ' ') {
        pos++;
      }

      if (pos >= content.length) {
        result.set(key, '');
        break;
      }

      // 读取 value
      let value: string;
      if (content.charAt(pos) === '\'') {
        // 有引号：读取到下一个单引号
        pos++; // 跳过开头引号
        const endQuote = content.indexOf('\'', pos);
        if (endQuote < 0) {
          // 缺少结尾引号，取剩余全部
          value = content.substring(pos);
          pos = content.length;
        } else {
          value = content.substring(pos, endQuote);
          pos = endQuote + 1;
        }
      } else {
        // 无引号：取到下一个逗号
        const commaIndex = content.indexOf(',', pos);
        if (commaIndex < 0) {
          value = content.substring(pos).trim();
          pos = content.length;
        } else {
          value = content.substring(pos, commaIndex).trim();
          pos = commaIndex;
        }
      }

      result.set(key, value);
    }

    return result;
  }

  private static log(msg: string): void {
    if (AppLinkParser.debugFlag) {
      console.log(`[MPBridge/AppLinkParser] ${msg}`);
    }
  }
}

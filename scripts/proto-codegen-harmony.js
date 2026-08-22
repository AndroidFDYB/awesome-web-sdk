/**
 * 鸿蒙端 Proto Codegen 脚本
 *
 * 解析 .proto 文件，生成 ArkTS 源码（通道常量、方法映射、setter）。
 * 在 build-harmony.js 之前执行，确保产物在 hvigor 编译前就绪。
 *
 * 用法：
 *   node scripts/proto-codegen-harmony.js
 */

const path = require('path');
const fs = require('fs');
const { parseProtoFile, collectProtoFiles } = require('@mp-sdk/proto-codegen');

// 命名约定工具（与 TS 版本逻辑一致）
function toCamelCase(pascalCase) {
  if (!pascalCase) return '';
  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}

function toUpperSnakeCase(pascalCase) {
  if (!pascalCase) return '';
  let result = '';
  for (let i = 0; i < pascalCase.length; i++) {
    const c = pascalCase[i];
    if (i > 0 && c >= 'A' && c <= 'Z') {
      result += '_';
    }
    result += c.toUpperCase();
  }
  return result;
}

function messageToChannel(name) { return toCamelCase(name); }
function messageToSyncMethod(name) { return `sync${name}`; }
function messageToConstantName(name) { return toUpperSnakeCase(name); }
function messageToMethodConstantName(name) { return `SYNC_${toUpperSnakeCase(name)}`; }
function messageToSetterName(name) { return `set${name}`; }

const ROOT = path.resolve(__dirname, '..');
const PROTO_FILE = path.join(ROOT, 'specs', 'proto', 'channels.proto');
const CUSTOM_DIR = path.join(ROOT, 'specs', 'proto', 'custom');
const OUTPUT_DIR = path.join(ROOT, 'hm', 'hm_web_library', 'src', 'main', 'ets', 'generated');

function generate() {
  console.log('[ProtoCodegen/Harmony] Parsing:', PROTO_FILE);

  // 确保输出目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 解析主 proto 文件
  const mainResult = parseProtoFile(PROTO_FILE);
  let allMessages = [...mainResult.file.messages];

  for (const warning of mainResult.warnings) {
    console.warn(`[ProtoCodegen/Harmony] WARNING: ${warning}`);
  }

  // 解析 custom 目录
  if (fs.existsSync(CUSTOM_DIR)) {
    const customFiles = collectProtoFiles(CUSTOM_DIR);
    for (const customFile of customFiles) {
      console.log('[ProtoCodegen/Harmony] Parsing custom:', customFile);
      const customResult = parseProtoFile(customFile);
      allMessages.push(...customResult.file.messages);
      for (const warning of customResult.warnings) {
        console.warn(`[ProtoCodegen/Harmony] WARNING: ${warning}`);
      }
    }
  }

  // 去重
  const uniqueMessages = allMessages.filter((msg, idx, self) =>
    idx === self.findIndex(m => m.name === msg.name)
  );

  console.log(`[ProtoCodegen/Harmony] Found ${uniqueMessages.length} messages: ${uniqueMessages.map(m => m.name).join(', ')}`);

  // 生成 DataSyncChannels.ets
  const channelsCode = generateChannelsEts(uniqueMessages);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'DataSyncChannels.ets'), channelsCode);
  console.log('[ProtoCodegen/Harmony] Generated DataSyncChannels.ets');

  // 生成 DataSyncMethods.ets
  const methodsCode = generateMethodsEts(uniqueMessages);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'DataSyncMethods.ets'), methodsCode);
  console.log('[ProtoCodegen/Harmony] Generated DataSyncMethods.ets');

  // 生成 DataSyncSetters.ets
  const settersCode = generateSettersEts(uniqueMessages);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'DataSyncSetters.ets'), settersCode);
  console.log('[ProtoCodegen/Harmony] Generated DataSyncSetters.ets');

  // 生成 DataSyncDecorators.ets
  const decoratorsCode = generateDecoratorsEts(uniqueMessages);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'DataSyncDecorators.ets'), decoratorsCode);
  console.log('[ProtoCodegen/Harmony] Generated DataSyncDecorators.ets');

  console.log('[ProtoCodegen/Harmony] Done.');
}

/**
 * 生成 DataSyncDecorators.ets
 *
 * 包含 DecoratorRegistry（运行时注册表）和所有 @Needs* 快捷装饰器。
 * 对标 Android KSP 的 @Needs* 注解。
 */
function generateDecoratorsEts(messages) {
  // 生成 @Needs* 快捷装饰器
  const shortcutDecorators = messages.map(msg => {
    const constName = messageToConstantName(msg.name);
    const decoratorName = `Needs${msg.name}`;
    // 清理注释：过滤分隔线和元数据行，取最靠近 message 的一行
    let comment = `${msg.name} 数据通道`;
    if (msg.comment) {
      const cleanLines = msg.comment.split('\n').map(l => l.trim()).filter(l => {
        if (!l) return false;
        if (/^[=\-*_~#]+$/.test(l)) return false;
        if (/^[-*\s]*(Android|Vue|Method|鸿蒙|iOS)\s*:/i.test(l)) return false;
        return true;
      });
      if (cleanLines.length > 0) {
        comment = cleanLines[cleanLines.length - 1];
      }
    }
    return `/**
 * 声明需要 ${comment}
 * 等价于 @NeedsDataSync([DataSyncChannel.${constName}])
 */
export function ${decoratorName}<T extends Function>(target: T): void {
  const existing: string[] = DecoratorRegistry.getChannels(target.name);
  if (!existing.includes(DataSyncChannel.${constName})) {
    existing.push(DataSyncChannel.${constName});
  }
  DecoratorRegistry.register(target.name, existing);
}`;
  }).join('\n\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.
//
// 鸿蒙端数据同步装饰器系统
//
// 对标 Android KSP 注解方案，使用 ArkTS 类装饰器声明页面所需的数据通道。
// 装饰器在运行时将 className → channels 映射注册到 DecoratorRegistry，
// DataSyncHelper.create() 工厂方法从中读取，实现零手动传参。
//
// 可选增强：hvigor 插件在编译期扫描装饰器，生成静态 DataSyncBindings.ets，
// 提供编译期查表能力（无需运行时注册）。

import { DataSyncChannel } from './DataSyncChannels';

// ============================================================
// 运行时装饰器注册表
// ============================================================

/**
 * 装饰器元数据注册表
 *
 * 存储类装饰器注册的数据通道映射。
 * 导出为 class（非全局变量），符合 ArkTS 严格模式要求。
 */
export class DecoratorRegistry {
  /** className → 所需通道数组 */
  private static registry: Map<string, string[]> = new Map<string, string[]>();

  /**
   * 注册一个类的数据通道
   * @param className 类名（constructor.name 或 struct 名）
   * @param channels 所需数据通道数组
   */
  static register(className: string, channels: string[]): void {
    DecoratorRegistry.registry.set(className, channels);
  }

  /**
   * 查询一个类的数据通道
   * @param className 类名
   * @returns 所需通道数组，未注册时返回空数组
   */
  static getChannels(className: string): string[] {
    return DecoratorRegistry.registry.get(className) ?? [];
  }

  /** 获取所有已注册的类名 */
  static getRegisteredClasses(): string[] {
    return Array.from(DecoratorRegistry.registry.keys());
  }

  /** 清空注册表（测试用） */
  static clear(): void {
    DecoratorRegistry.registry.clear();
  }
}

// ============================================================
// 通用装饰器：@NeedsDataSync([...channels])
// ============================================================

/**
 * 声明组件/页面需要哪些数据同步通道
 *
 * 类装饰器，将 className → channels 映射注册到 DecoratorRegistry。
 * DataSyncHelper.create() 会自动从注册表中读取。
 *
 * @param channels 所需数据通道名数组
 * @returns 类装饰器函数
 */
export function NeedsDataSync(channels: string[]): ClassDecorator {
  return function <T extends Function>(target: T): void {
    DecoratorRegistry.register(target.name, channels);
  };
}

// ============================================================
// 标准通道快捷装饰器（由 proto codegen 自动生成）
// ============================================================

${shortcutDecorators}
`;
}

/**
 * 生成 DataSyncChannels.ets
 */
function generateChannelsEts(messages) {
  const constants = messages.map(msg => {
    const constName = messageToConstantName(msg.name);
    const channelValue = messageToChannel(msg.name);
    return `  static readonly ${constName}: string = '${channelValue}';`;
  }).join('\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

/**
 * 标准数据通道名称
 * 由 proto codegen 自动生成
 */
export class DataSyncChannel {
${constants}
}
`;
}

/**
 * 生成 DataSyncMethods.ets
 */
function generateMethodsEts(messages) {
  const constants = messages.map(msg => {
    const constName = messageToMethodConstantName(msg.name);
    const methodValue = messageToSyncMethod(msg.name);
    return `  static readonly ${constName}: string = '${methodValue}';`;
  }).join('\n');

  const cases = messages.map(msg => {
    const constName = messageToConstantName(msg.name);
    const methodConstName = messageToMethodConstantName(msg.name);
    return `      case DataSyncChannel.${constName}:\n        return DataSyncMethod.${methodConstName};`;
  }).join('\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

import { DataSyncChannel } from './DataSyncChannels';

/**
 * Native → JS 推送数据时调用的 JSBridge 方法名
 * 由 proto codegen 自动生成
 */
export class DataSyncMethod {
${constants}

  /**
   * 根据通道名获取对应的 JSBridge 方法名
   * 标准通道使用预定义方法名，自定义通道自动生成 "syncXxx" 格式
   */
  static fromChannel(channel: string): string {
    switch (channel) {
${cases}
      default: {
        const capitalized = channel.charAt(0).toUpperCase() + channel.slice(1);
        return \`sync\${capitalized}\`;
      }
    }
  }
}
`;
}

/**
 * 生成 DataSyncSetters.ets
 *
 * setter 扩展函数，由 DataSyncHelper 调用方使用。
 */
function generateSettersEts(messages) {
  const setters = messages.map(msg => {
    const setterName = messageToSetterName(msg.name);
    const constName = messageToConstantName(msg.name);
    const comment = msg.comment || `设置 ${msg.name} 数据`;
    return `  /** ${comment} */\n  ${setterName}(data: string): void {\n    this.setData(DataSyncChannel.${constName}, data);\n  }`;
  }).join('\n\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

import { DataSyncChannel } from './DataSyncChannels';

/**
 * DataSyncHelper 的 setter 抽象基类
 * 由 proto codegen 自动生成
 * DataSyncHelper 继承此类，提供 setData() 实现
 */
export abstract class DataSyncSetters {
  /** 子类实现：设置指定通道的业务数据 */
  abstract setData(channel: string, data: string): void;

${setters}
}
`;
}

// 运行生成
generate();

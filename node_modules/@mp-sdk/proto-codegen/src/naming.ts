/**
 * 命名约定工具
 *
 * 从 Proto Message 名推导各端所需的标识符名称。
 * 命名约定是单向推导，改 Message 名即改变所有下游标识符。
 *
 * 推导规则：
 *   Proto Message (PascalCase) → 通道名 (camelCase)
 *   Proto Message → JSBridge 方法名 (sync + PascalCase)
 *   Proto Message → Android 注解 (@Needs + PascalCase)
 *   Proto Message → Vue 装饰器 (@wait + PascalCase + Sync)
 *   Proto Message → Helper Setter (set + PascalCase)
 *   Proto Message → 鸿蒙常量 (UPPER_SNAKE_CASE)
 *   Proto Message → TypeScript 接口 (直接使用 PascalCase)
 */

import type { ProtoScalarType } from './model';

/** Proto 标量类型集合 */
const SCALAR_TYPES = new Set<string>([
  'string', 'int32', 'int64', 'uint32', 'uint64',
  'sint32', 'sint64', 'fixed32', 'fixed64',
  'sfixed32', 'sfixed64', 'float', 'double', 'bool', 'bytes',
]);

/** 判断是否为标量类型 */
export function isScalarType(type: string): type is ProtoScalarType {
  return SCALAR_TYPES.has(type);
}

/**
 * PascalCase → camelCase（首字母小写）
 * UserInfo → userInfo
 */
export function toCamelCase(pascalCase: string): string {
  if (!pascalCase) return '';
  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}

/**
 * PascalCase → UPPER_SNAKE_CASE
 * UserInfo → USER_INFO
 * LeadUserinfo → LEAD_USERINFO
 */
export function toUpperSnakeCase(pascalCase: string): string {
  if (!pascalCase) return '';
  // 在大写字母前插入下划线（但不处理第一个字符）
  const withSeparators = pascalCase.replace(/([A-Z])/g, (match, _p1, offset: number) =>
    offset === 0 ? match : '_' + match
  );
  return withSeparators.toUpperCase();
}

/**
 * 从 PascalCase Message 名推导通道名
 * UserInfo → userInfo
 */
export function messageToChannel(messageName: string): string {
  return toCamelCase(messageName);
}

/**
 * 从 PascalCase Message 名推导 JSBridge 方法名
 * UserInfo → syncUserInfo
 */
export function messageToSyncMethod(messageName: string): string {
  return `sync${messageName}`;
}

/**
 * 从 PascalCase Message 名推导 Android 注解类名
 * UserInfo → NeedsUserInfo
 */
export function messageToAnnotationClass(messageName: string): string {
  return `Needs${messageName}`;
}

/**
 * 从 PascalCase Message 名推导 Android 注解全限定名
 * UserInfo → com.sharknade.and_web_library.NeedsUserInfo
 */
export function messageToAnnotationFqName(messageName: string, basePackage = 'com.sharknade.and_web_library'): string {
  return `${basePackage}.${messageToAnnotationClass(messageName)}`;
}

/**
 * 从 PascalCase Message 名推导 Vue 装饰器名
 * UserInfo → waitUserInfoSync
 */
export function messageToDecoratorName(messageName: string): string {
  return `wait${messageName}Sync`;
}

/**
 * 从 PascalCase Message 名推导 Helper setter 方法名
 * UserInfo → setUserInfo
 */
export function messageToSetterName(messageName: string): string {
  return `set${messageName}`;
}

/**
 * 从 PascalCase Message 名推导鸿蒙通道常量名
 * UserInfo → USER_INFO
 */
export function messageToConstantName(messageName: string): string {
  return toUpperSnakeCase(messageName);
}

/**
 * 从 PascalCase Message 名推导鸿蒙方法常量名
 * UserInfo → SYNC_USER_INFO
 */
export function messageToMethodConstantName(messageName: string): string {
  return `SYNC_${toUpperSnakeCase(messageName)}`;
}

/** Proto 标量类型 → TypeScript 类型映射 */
const PROTO_TO_TS: Record<ProtoScalarType, string> = {
  string: 'string',
  int32: 'number',
  int64: 'number',
  uint32: 'number',
  uint64: 'number',
  sint32: 'number',
  sint64: 'number',
  fixed32: 'number',
  fixed64: 'number',
  sfixed32: 'number',
  sfixed64: 'number',
  float: 'number',
  double: 'number',
  bool: 'boolean',
  bytes: 'string',
};

/** 将 Proto 标量类型映射为 TypeScript 类型 */
export function protoTypeToTs(type: ProtoScalarType): string {
  return PROTO_TO_TS[type] ?? 'any';
}

/** Proto 标量类型 → Kotlin 类型映射 */
const PROTO_TO_KOTLIN: Record<ProtoScalarType, string> = {
  string: 'String',
  int32: 'Int',
  int64: 'Long',
  uint32: 'Int',
  uint64: 'Long',
  sint32: 'Int',
  sint64: 'Long',
  fixed32: 'Int',
  fixed64: 'Long',
  sfixed32: 'Int',
  sfixed64: 'Long',
  float: 'Float',
  double: 'Double',
  bool: 'Boolean',
  bytes: 'ByteArray',
};

/** 将 Proto 标量类型映射为 Kotlin 类型 */
export function protoTypeToKotlin(type: ProtoScalarType): string {
  return PROTO_TO_KOTLIN[type] ?? 'Any';
}

/** Proto 标量类型 → ArkTS (鸿蒙) 类型映射 */
const PROTO_TO_ARKTS: Record<ProtoScalarType, string> = {
  string: 'string',
  int32: 'number',
  int64: 'number',
  uint32: 'number',
  uint64: 'number',
  sint32: 'number',
  sint64: 'number',
  fixed32: 'number',
  fixed64: 'number',
  sfixed32: 'number',
  sfixed64: 'number',
  float: 'number',
  double: 'number',
  bool: 'boolean',
  bytes: 'string',
};

/** 将 Proto 标量类型映射为 ArkTS 类型 */
export function protoTypeToArkTS(type: ProtoScalarType): string {
  return PROTO_TO_ARKTS[type] ?? 'any';
}

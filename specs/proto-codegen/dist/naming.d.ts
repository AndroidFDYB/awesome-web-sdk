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
/** 判断是否为标量类型 */
export declare function isScalarType(type: string): type is ProtoScalarType;
/**
 * PascalCase → camelCase（首字母小写）
 * UserInfo → userInfo
 */
export declare function toCamelCase(pascalCase: string): string;
/**
 * PascalCase → UPPER_SNAKE_CASE
 * UserInfo → USER_INFO
 * LeadUserinfo → LEAD_USERINFO
 */
export declare function toUpperSnakeCase(pascalCase: string): string;
/**
 * 从 PascalCase Message 名推导通道名
 * UserInfo → userInfo
 */
export declare function messageToChannel(messageName: string): string;
/**
 * 从 PascalCase Message 名推导 JSBridge 方法名
 * UserInfo → syncUserInfo
 */
export declare function messageToSyncMethod(messageName: string): string;
/**
 * 从 PascalCase Message 名推导 Android 注解类名
 * UserInfo → NeedsUserInfo
 */
export declare function messageToAnnotationClass(messageName: string): string;
/**
 * 从 PascalCase Message 名推导 Android 注解全限定名
 * UserInfo → com.sharknade.and_web_library.NeedsUserInfo
 */
export declare function messageToAnnotationFqName(messageName: string, basePackage?: string): string;
/**
 * 从 PascalCase Message 名推导 Vue 装饰器名
 * UserInfo → waitUserInfoSync
 */
export declare function messageToDecoratorName(messageName: string): string;
/**
 * 从 PascalCase Message 名推导 Helper setter 方法名
 * UserInfo → setUserInfo
 */
export declare function messageToSetterName(messageName: string): string;
/**
 * 从 PascalCase Message 名推导鸿蒙通道常量名
 * UserInfo → USER_INFO
 */
export declare function messageToConstantName(messageName: string): string;
/**
 * 从 PascalCase Message 名推导鸿蒙方法常量名
 * UserInfo → SYNC_USER_INFO
 */
export declare function messageToMethodConstantName(messageName: string): string;
/** 将 Proto 标量类型映射为 TypeScript 类型 */
export declare function protoTypeToTs(type: ProtoScalarType): string;
/** 将 Proto 标量类型映射为 Kotlin 类型 */
export declare function protoTypeToKotlin(type: ProtoScalarType): string;
/** 将 Proto 标量类型映射为 ArkTS 类型 */
export declare function protoTypeToArkTS(type: ProtoScalarType): string;

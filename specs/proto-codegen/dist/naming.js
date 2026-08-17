"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isScalarType = isScalarType;
exports.toCamelCase = toCamelCase;
exports.toUpperSnakeCase = toUpperSnakeCase;
exports.messageToChannel = messageToChannel;
exports.messageToSyncMethod = messageToSyncMethod;
exports.messageToAnnotationClass = messageToAnnotationClass;
exports.messageToAnnotationFqName = messageToAnnotationFqName;
exports.messageToDecoratorName = messageToDecoratorName;
exports.messageToSetterName = messageToSetterName;
exports.messageToConstantName = messageToConstantName;
exports.messageToMethodConstantName = messageToMethodConstantName;
exports.protoTypeToTs = protoTypeToTs;
exports.protoTypeToKotlin = protoTypeToKotlin;
exports.protoTypeToArkTS = protoTypeToArkTS;
/** Proto 标量类型集合 */
const SCALAR_TYPES = new Set([
    'string', 'int32', 'int64', 'uint32', 'uint64',
    'sint32', 'sint64', 'fixed32', 'fixed64',
    'sfixed32', 'sfixed64', 'float', 'double', 'bool', 'bytes',
]);
/** 判断是否为标量类型 */
function isScalarType(type) {
    return SCALAR_TYPES.has(type);
}
/**
 * PascalCase → camelCase（首字母小写）
 * UserInfo → userInfo
 */
function toCamelCase(pascalCase) {
    if (!pascalCase)
        return '';
    return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}
/**
 * PascalCase → UPPER_SNAKE_CASE
 * UserInfo → USER_INFO
 * LeadUserinfo → LEAD_USERINFO
 */
function toUpperSnakeCase(pascalCase) {
    if (!pascalCase)
        return '';
    // 在大写字母前插入下划线（但不处理第一个字符）
    const withSeparators = pascalCase.replace(/([A-Z])/g, (match, _p1, offset) => offset === 0 ? match : '_' + match);
    return withSeparators.toUpperCase();
}
/**
 * 从 PascalCase Message 名推导通道名
 * UserInfo → userInfo
 */
function messageToChannel(messageName) {
    return toCamelCase(messageName);
}
/**
 * 从 PascalCase Message 名推导 JSBridge 方法名
 * UserInfo → syncUserInfo
 */
function messageToSyncMethod(messageName) {
    return `sync${messageName}`;
}
/**
 * 从 PascalCase Message 名推导 Android 注解类名
 * UserInfo → NeedsUserInfo
 */
function messageToAnnotationClass(messageName) {
    return `Needs${messageName}`;
}
/**
 * 从 PascalCase Message 名推导 Android 注解全限定名
 * UserInfo → com.sharknade.and_web_library.NeedsUserInfo
 */
function messageToAnnotationFqName(messageName, basePackage = 'com.sharknade.and_web_library') {
    return `${basePackage}.${messageToAnnotationClass(messageName)}`;
}
/**
 * 从 PascalCase Message 名推导 Vue 装饰器名
 * UserInfo → waitUserInfoSync
 */
function messageToDecoratorName(messageName) {
    return `wait${messageName}Sync`;
}
/**
 * 从 PascalCase Message 名推导 Helper setter 方法名
 * UserInfo → setUserInfo
 */
function messageToSetterName(messageName) {
    return `set${messageName}`;
}
/**
 * 从 PascalCase Message 名推导鸿蒙通道常量名
 * UserInfo → USER_INFO
 */
function messageToConstantName(messageName) {
    return toUpperSnakeCase(messageName);
}
/**
 * 从 PascalCase Message 名推导鸿蒙方法常量名
 * UserInfo → SYNC_USER_INFO
 */
function messageToMethodConstantName(messageName) {
    return `SYNC_${toUpperSnakeCase(messageName)}`;
}
/** Proto 标量类型 → TypeScript 类型映射 */
const PROTO_TO_TS = {
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
function protoTypeToTs(type) {
    var _a;
    return (_a = PROTO_TO_TS[type]) !== null && _a !== void 0 ? _a : 'any';
}
/** Proto 标量类型 → Kotlin 类型映射 */
const PROTO_TO_KOTLIN = {
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
function protoTypeToKotlin(type) {
    var _a;
    return (_a = PROTO_TO_KOTLIN[type]) !== null && _a !== void 0 ? _a : 'Any';
}
/** Proto 标量类型 → ArkTS (鸿蒙) 类型映射 */
const PROTO_TO_ARKTS = {
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
function protoTypeToArkTS(type) {
    var _a;
    return (_a = PROTO_TO_ARKTS[type]) !== null && _a !== void 0 ? _a : 'any';
}

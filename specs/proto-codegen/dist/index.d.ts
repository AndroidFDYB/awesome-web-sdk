/**
 * @mp-sdk/proto-codegen
 *
 * 共享的轻量级 proto 解析器和命名约定工具。
 * 供 Vue Vite 插件和鸿蒙 hvigor 插件使用。
 */
export type { ProtoFile, ProtoMessage, ProtoField, ProtoScalarType } from './model';
export { parseProto, parseProtoFile, parseProtoFiles, collectProtoFiles } from './parser';
export type { ParseResult } from './parser';
export { isScalarType, toCamelCase, toUpperSnakeCase, messageToChannel, messageToSyncMethod, messageToAnnotationClass, messageToAnnotationFqName, messageToDecoratorName, messageToSetterName, messageToConstantName, messageToMethodConstantName, protoTypeToTs, protoTypeToKotlin, protoTypeToArkTS, } from './naming';

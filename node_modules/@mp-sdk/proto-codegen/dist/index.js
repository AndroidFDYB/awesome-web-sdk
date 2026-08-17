"use strict";
/**
 * @mp-sdk/proto-codegen
 *
 * 共享的轻量级 proto 解析器和命名约定工具。
 * 供 Vue Vite 插件和鸿蒙 hvigor 插件使用。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.protoTypeToArkTS = exports.protoTypeToKotlin = exports.protoTypeToTs = exports.messageToMethodConstantName = exports.messageToConstantName = exports.messageToSetterName = exports.messageToDecoratorName = exports.messageToAnnotationFqName = exports.messageToAnnotationClass = exports.messageToSyncMethod = exports.messageToChannel = exports.toUpperSnakeCase = exports.toCamelCase = exports.isScalarType = exports.collectProtoFiles = exports.parseProtoFiles = exports.parseProtoFile = exports.parseProto = void 0;
// 解析器
var parser_1 = require("./parser");
Object.defineProperty(exports, "parseProto", { enumerable: true, get: function () { return parser_1.parseProto; } });
Object.defineProperty(exports, "parseProtoFile", { enumerable: true, get: function () { return parser_1.parseProtoFile; } });
Object.defineProperty(exports, "parseProtoFiles", { enumerable: true, get: function () { return parser_1.parseProtoFiles; } });
Object.defineProperty(exports, "collectProtoFiles", { enumerable: true, get: function () { return parser_1.collectProtoFiles; } });
// 命名约定
var naming_1 = require("./naming");
Object.defineProperty(exports, "isScalarType", { enumerable: true, get: function () { return naming_1.isScalarType; } });
Object.defineProperty(exports, "toCamelCase", { enumerable: true, get: function () { return naming_1.toCamelCase; } });
Object.defineProperty(exports, "toUpperSnakeCase", { enumerable: true, get: function () { return naming_1.toUpperSnakeCase; } });
Object.defineProperty(exports, "messageToChannel", { enumerable: true, get: function () { return naming_1.messageToChannel; } });
Object.defineProperty(exports, "messageToSyncMethod", { enumerable: true, get: function () { return naming_1.messageToSyncMethod; } });
Object.defineProperty(exports, "messageToAnnotationClass", { enumerable: true, get: function () { return naming_1.messageToAnnotationClass; } });
Object.defineProperty(exports, "messageToAnnotationFqName", { enumerable: true, get: function () { return naming_1.messageToAnnotationFqName; } });
Object.defineProperty(exports, "messageToDecoratorName", { enumerable: true, get: function () { return naming_1.messageToDecoratorName; } });
Object.defineProperty(exports, "messageToSetterName", { enumerable: true, get: function () { return naming_1.messageToSetterName; } });
Object.defineProperty(exports, "messageToConstantName", { enumerable: true, get: function () { return naming_1.messageToConstantName; } });
Object.defineProperty(exports, "messageToMethodConstantName", { enumerable: true, get: function () { return naming_1.messageToMethodConstantName; } });
Object.defineProperty(exports, "protoTypeToTs", { enumerable: true, get: function () { return naming_1.protoTypeToTs; } });
Object.defineProperty(exports, "protoTypeToKotlin", { enumerable: true, get: function () { return naming_1.protoTypeToKotlin; } });
Object.defineProperty(exports, "protoTypeToArkTS", { enumerable: true, get: function () { return naming_1.protoTypeToArkTS; } });

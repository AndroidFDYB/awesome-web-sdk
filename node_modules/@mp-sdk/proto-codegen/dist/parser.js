"use strict";
/**
 * 轻量级 .proto 文件解析器
 *
 * 仅解析 message 定义和标量字段，不处理嵌套 message / enum / oneof / service。
 * 支持单行注释 (//) 和多行注释 (/* *​/)。
 *
 * 解析流程：
 * 1. 去除多行注释（保留行注释作为字段注释）
 * 2. 提取 syntax 和 package 声明
 * 3. 用正则匹配 message 块
 * 4. 在每个 message 块内解析字段
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProto = parseProto;
exports.parseProtoFile = parseProtoFile;
exports.parseProtoFiles = parseProtoFiles;
exports.collectProtoFiles = collectProtoFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const naming_1 = require("./naming");
/**
 * 解析 .proto 文件内容
 *
 * @param content 文件文本内容
 * @param filePath 文件路径（用于错误信息）
 * @returns 解析后的 ProtoFile 模型
 * @throws 如果语法错误
 */
function parseProto(content, filePath) {
    const warnings = [];
    // 1. 提取 syntax
    const syntaxMatch = content.match(/syntax\s*=\s*["']([^"']+)["']/);
    const syntax = syntaxMatch ? syntaxMatch[1] : 'proto3';
    if (!syntaxMatch) {
        warnings.push(`No syntax declaration found, defaulting to "proto3"`);
    }
    // 2. 提取 package
    const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
    const pkg = packageMatch ? packageMatch[1] : '';
    // 3. 提取 message 块（使用正则匹配 message Name { ... }）
    // 注意：此正则不处理嵌套大括号，但约束要求不使用嵌套 message
    const messageRegex = /(?:\/\/[^\n]*\n)*\s*message\s+(\w+)\s*\{([^}]*)\}/g;
    const messages = [];
    let messageMatch;
    while ((messageMatch = messageRegex.exec(content)) !== null) {
        const messageName = messageMatch[1];
        const messageBody = messageMatch[2];
        const precedingComment = extractPrecedingComment(content, messageMatch.index);
        const fields = parseFields(messageBody, messageName, filePath, warnings);
        messages.push({
            name: messageName,
            fields,
            comment: precedingComment,
        });
    }
    if (messages.length === 0) {
        warnings.push(`No messages found in ${filePath}`);
    }
    return {
        file: {
            syntax,
            package: pkg,
            messages,
            filePath,
        },
        warnings,
    };
}
/**
 * 从文件中提取 message 声明前的注释
 * 向上查找最近的 // 注释行
 */
function extractPrecedingComment(content, messageIndex) {
    // 获取 message 声明前的内容
    const before = content.substring(0, messageIndex).trimEnd();
    if (!before)
        return undefined;
    // 按行分割，从最后一行向上收集连续的 // 注释
    const lines = before.split('\n');
    const commentLines = [];
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        const commentMatch = line.match(/^\/\/\s*(.*)$/);
        if (commentMatch) {
            commentLines.unshift(commentMatch[1]);
        }
        else if (line === '') {
            // 空行，跳过
            continue;
        }
        else {
            // 非注释行，停止
            break;
        }
    }
    return commentLines.length > 0 ? commentLines.join('\n') : undefined;
}
/**
 * 解析 message 体内的字段定义
 *
 * 字段格式：
 *   [repeated] type name = number [// comment];
 *
 * 示例：
 *   string uid = 1;
 *   repeated string privileges = 4;
 *   int64 amount = 2; // 借款金额
 */
function parseFields(messageBody, messageName, filePath, warnings) {
    const fields = [];
    // 按行处理
    const lines = messageBody.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        // 跳过空行和注释行
        if (!trimmed || trimmed.startsWith('//'))
            continue;
        // 提取行内注释
        let fieldPart = trimmed;
        let comment;
        const commentIdx = fieldPart.indexOf('//');
        if (commentIdx >= 0) {
            comment = fieldPart.substring(commentIdx + 2).trim();
            fieldPart = fieldPart.substring(0, commentIdx).trim();
        }
        // 移除末尾分号
        fieldPart = fieldPart.replace(/;$/, '').trim();
        // 跳过空行（去除注释后可能为空）
        if (!fieldPart)
            continue;
        // 解析字段：[repeated] type name = number
        const fieldMatch = fieldPart.match(/^(repeated\s+)?(\w+)\s+(\w+)\s*=\s*(\d+)$/);
        if (!fieldMatch) {
            warnings.push(`Skipping unrecognized line in message ${messageName} (${filePath}): "${trimmed}"`);
            continue;
        }
        const [, repeatedPart, type, name, numberStr] = fieldMatch;
        const repeated = !!repeatedPart;
        const fieldNumber = parseInt(numberStr, 10);
        // 验证类型为标量类型
        if (!(0, naming_1.isScalarType)(type)) {
            warnings.push(`Non-scalar type "${type}" in message ${messageName} field ${name} (${filePath}). ` +
                `Nested messages and enums are not supported.`);
            continue;
        }
        fields.push({
            name,
            type: type,
            number: fieldNumber,
            repeated,
            comment,
        });
    }
    return fields;
}
/**
 * 从文件系统读取并解析 .proto 文件
 *
 * @param filePath .proto 文件路径
 * @returns 解析后的 ProtoFile 模型
 */
function parseProtoFile(filePath) {
    const absPath = path.resolve(filePath);
    const content = fs.readFileSync(absPath, 'utf-8');
    return parseProto(content, absPath);
}
/**
 * 批量解析多个 .proto 文件
 *
 * @param filePaths .proto 文件路径数组
 * @returns 合并后的 ProtoFile 数组
 */
function parseProtoFiles(filePaths) {
    return filePaths.map((fp) => parseProtoFile(fp).file);
}
/**
 * 收集目录下所有 .proto 文件
 *
 * @param dirPath 目录路径
 * @returns .proto 文件路径数组
 */
function collectProtoFiles(dirPath) {
    const absDir = path.resolve(dirPath);
    if (!fs.existsSync(absDir))
        return [];
    const results = [];
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(absDir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectProtoFiles(fullPath));
        }
        else if (entry.isFile() && entry.name.endsWith('.proto')) {
            results.push(fullPath);
        }
    }
    return results;
}

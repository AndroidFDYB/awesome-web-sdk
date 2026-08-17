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
import type { ProtoFile } from './model';
/** 解析结果：成功或抛出错误 */
export interface ParseResult {
    file: ProtoFile;
    warnings: string[];
}
/**
 * 解析 .proto 文件内容
 *
 * @param content 文件文本内容
 * @param filePath 文件路径（用于错误信息）
 * @returns 解析后的 ProtoFile 模型
 * @throws 如果语法错误
 */
export declare function parseProto(content: string, filePath: string): ParseResult;
/**
 * 从文件系统读取并解析 .proto 文件
 *
 * @param filePath .proto 文件路径
 * @returns 解析后的 ProtoFile 模型
 */
export declare function parseProtoFile(filePath: string): ParseResult;
/**
 * 批量解析多个 .proto 文件
 *
 * @param filePaths .proto 文件路径数组
 * @returns 合并后的 ProtoFile 数组
 */
export declare function parseProtoFiles(filePaths: string[]): ProtoFile[];
/**
 * 收集目录下所有 .proto 文件
 *
 * @param dirPath 目录路径
 * @returns .proto 文件路径数组
 */
export declare function collectProtoFiles(dirPath: string): string[];

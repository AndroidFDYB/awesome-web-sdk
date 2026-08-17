/**
 * Proto 数据模型定义
 *
 * 解析器输出的结构化数据模型，供各端代码生成器消费。
 */
/** Proto 标量字段类型 */
export type ProtoScalarType = 'string' | 'int32' | 'int64' | 'uint32' | 'uint64' | 'sint32' | 'sint64' | 'fixed32' | 'fixed64' | 'sfixed32' | 'sfixed64' | 'float' | 'double' | 'bool' | 'bytes';
/** Proto 字段定义 */
export interface ProtoField {
    /** 字段名称 */
    name: string;
    /** 字段类型（标量类型） */
    type: ProtoScalarType;
    /** 字段编号 */
    number: number;
    /** 是否为 repeated（数组） */
    repeated: boolean;
    /** 行内注释（如有） */
    comment?: string;
}
/** Proto Message 定义 */
export interface ProtoMessage {
    /** Message 名称（PascalCase） */
    name: string;
    /** 字段列表 */
    fields: ProtoField[];
    /** 上方注释（如有） */
    comment?: string;
}
/** 解析后的 Proto 文件模型 */
export interface ProtoFile {
    /** package 声明 */
    package: string;
    /** syntax 声明（通常为 "proto3"） */
    syntax: string;
    /** Message 列表 */
    messages: ProtoMessage[];
    /** 源文件路径 */
    filePath: string;
}

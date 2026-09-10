/**
 * Flutter 端 Proto Codegen 脚本
 *
 * 解析 .proto 文件，生成 Dart 源码（通道常量、方法映射、setter 扩展）。
 * 在 build-flutter.js 之前执行，确保生成物在 flutter analyze 前就绪。
 *
 * 用法：
 *   node scripts/proto-codegen-flutter.js
 */

const path = require('path');
const fs = require('fs');
const { parseProtoFile, collectProtoFiles } = require('@mp-sdk/proto-codegen');

// 命名约定工具
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
const OUTPUT_DIR = path.join(ROOT, 'flutter', 'lib', 'generated');

function generate() {
  console.log('[ProtoCodegen/Flutter] Parsing:', PROTO_FILE);

  // 确保输出目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 解析主 proto 文件
  const mainResult = parseProtoFile(PROTO_FILE);
  let allMessages = [...mainResult.file.messages];

  for (const warning of mainResult.warnings) {
    console.warn(`[ProtoCodegen/Flutter] WARNING: ${warning}`);
  }

  // 解析 custom 目录
  if (fs.existsSync(CUSTOM_DIR)) {
    const customFiles = collectProtoFiles(CUSTOM_DIR);
    for (const customFile of customFiles) {
      console.log('[ProtoCodegen/Flutter] Parsing custom:', customFile);
      const customResult = parseProtoFile(customFile);
      allMessages.push(...customResult.file.messages);
      for (const warning of customResult.warnings) {
        console.warn(`[ProtoCodegen/Flutter] WARNING: ${warning}`);
      }
    }
  }

  // 去重
  const uniqueMessages = allMessages.filter((msg, idx, self) =>
    idx === self.findIndex(m => m.name === msg.name)
  );

  console.log(`[ProtoCodegen/Flutter] Found ${uniqueMessages.length} messages: ${uniqueMessages.map(m => m.name).join(', ')}`);

  // 生成 data_sync_channels.dart
  const channelsCode = generateChannelsDart(uniqueMessages);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'data_sync_channels.dart'), channelsCode);
  console.log('[ProtoCodegen/Flutter] Generated data_sync_channels.dart');

  // 生成 data_sync_methods.dart
  const methodsCode = generateMethodsDart(uniqueMessages);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'data_sync_methods.dart'), methodsCode);
  console.log('[ProtoCodegen/Flutter] Generated data_sync_methods.dart');

  // 生成 data_sync_setters.dart
  const settersCode = generateSettersDart(uniqueMessages);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'data_sync_setters.dart'), settersCode);
  console.log('[ProtoCodegen/Flutter] Generated data_sync_setters.dart');

  console.log('[ProtoCodegen/Flutter] Done.');
}

/**
 * 生成 data_sync_channels.dart
 *
 * 标准数据通道名称常量类。
 */
function generateChannelsDart(messages) {
  const constants = messages.map(msg => {
    const constName = messageToConstantName(msg.name);
    const channelValue = messageToChannel(msg.name);
    return `  static const String ${constName} = '${channelValue}';`;
  }).join('\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.
// ignore_for_file: constant_identifier_names

/// 标准数据通道名称
///
/// 由 proto codegen 自动生成，对标鸿蒙 DataSyncChannels.ets。
class DataSyncChannel {
${constants}
}
`;
}

/**
 * 生成 data_sync_methods.dart
 *
 * Native → JS 推送数据时调用的 JSBridge 方法名常量 + fromChannel() 映射。
 */
function generateMethodsDart(messages) {
  const constants = messages.map(msg => {
    const constName = messageToMethodConstantName(msg.name);
    const methodValue = messageToSyncMethod(msg.name);
    return `  static const String ${constName} = '${methodValue}';`;
  }).join('\n');

  const cases = messages.map(msg => {
    const constName = messageToConstantName(msg.name);
    const methodConstName = messageToMethodConstantName(msg.name);
    return `      case DataSyncChannel.${constName}:\n        return DataSyncMethod.${methodConstName};`;
  }).join('\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.
// ignore_for_file: constant_identifier_names

import 'data_sync_channels.dart';

/// Native → JS 推送数据时调用的 JSBridge 方法名
///
/// 由 proto codegen 自动生成，对标鸿蒙 DataSyncMethods.ets。
class DataSyncMethod {
${constants}

  /// 根据通道名获取对应的 JSBridge 方法名
  ///
  /// 标准通道使用预定义方法名，自定义通道自动生成 "syncXxx" 格式。
  static String fromChannel(String channel) {
    switch (channel) {
${cases}
      default:
        final capitalized = channel.isNotEmpty
            ? channel[0].toUpperCase() + channel.substring(1)
            : '';
        return 'sync\$capitalized';
    }
  }
}
`;
}

/**
 * 生成 data_sync_setters.dart
 *
 * DataSyncHelper 的 setter 扩展方法。
 */
function generateSettersDart(messages) {
  const setters = messages.map(msg => {
    const setterName = messageToSetterName(msg.name);
    const constName = messageToConstantName(msg.name);
    const comment = msg.comment || `${msg.name} 数据`;
    // 清理注释
    const cleanComment = comment.split('\n').map(l => l.trim()).filter(l => {
      if (!l) return false;
      if (/^[=\-*_~#]+$/.test(l)) return false;
      if (/^[-*\s]*(Android|Vue|Method|鸿蒙|iOS)\s*:/i.test(l)) return false;
      return true;
    }).pop() || `${msg.name} 数据`;

    return `  /// ${cleanComment}\n  void ${setterName}(String data) {\n    setData(DataSyncChannel.${constName}, data);\n  }`;
  }).join('\n\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

import 'data_sync_channels.dart';
import '../src/bridge/data_sync_helper.dart';

/// DataSyncHelper 的 setter 扩展方法
///
/// 由 proto codegen 自动生成，对标鸿蒙 DataSyncSetters.ets。
/// 使用方式：\`dataSyncHelper.setUserInfo(jsonStr)\`
extension DataSyncSetters on DataSyncHelper {

${setters}
}
`;
}

// 运行生成
generate();

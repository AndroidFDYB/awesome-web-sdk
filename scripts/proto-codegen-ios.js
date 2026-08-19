/**
 * iOS 端 Proto Codegen 脚本
 *
 * 解析 .proto 文件，生成 Objective-C 源码（通道常量、方法映射、setter Category）。
 * 在 build-ios.js 之前执行，确保 Generated/ 目录产物就绪。
 *
 * 生成文件（输出到 ios/ios_web_library/Generated/）：
 *   - MPDataSyncChannels.h/.m          通道名常量（对应鸿蒙 DataSyncChannels.ets）
 *   - MPDataSyncMethods.h/.m           JSBridge 方法名常量 + methodFromChannel: 映射
 *   - MPDataSyncHelper+Generated.h/.m  MPDataSyncHelper 的 setter Category（对应 DataSyncSetters.ets）
 *
 * 用法：
 *   node scripts/proto-codegen-ios.js
 */

const path = require('path');
const fs = require('fs');
const { parseProtoFile, collectProtoFiles } = require('@mp-sdk/proto-codegen');

// ---------- 命名约定（与 proto-codegen-harmony.js 保持一致） ----------

function toCamelCase(pascalCase) {
  if (!pascalCase) return '';
  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}

// UserInfo -> userInfo
function messageToChannel(name) { return toCamelCase(name); }
// UserInfo -> syncUserInfo
function messageToSyncMethod(name) { return `sync${name}`; }
// UserInfo -> MPDataSyncChannelUserInfo
function messageToChannelConstantName(name) { return `MPDataSyncChannel${name}`; }
// UserInfo -> MPDataSyncMethodSyncUserInfo
function messageToMethodConstantName(name) { return `MPDataSyncMethodSync${name}`; }
// UserInfo -> setUserInfo
function messageToSetterName(name) { return `set${name}`; }

/**
 * 提取 message 注释中适合作为单行文档注释的一行。
 *
 * proto 中 message 上方的注释可能包含：
 * - 文件头大段说明（首个 message 会携带）
 * - "Android:" / "Vue:" / "Method:" 等平台标注行
 * - 分隔线（======）
 *
 * 过滤后取最靠近 message 声明的一行（即最后一行）。
 */
function sanitizeCommentLine(comment) {
  if (!comment) return '';
  const lines = comment.split('\n').map(l => l.trim()).filter(l => {
    if (!l) return false;
    if (/^[=\-*_~#]+$/.test(l)) return false;                              // 分隔线
    if (/^[-*\s]*(Android|Vue|Method|鸿蒙|iOS)\s*:/i.test(l)) return false; // 平台标注行
    return true;
  });
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

const ROOT = path.resolve(__dirname, '..');
const PROTO_FILE = path.join(ROOT, 'specs', 'proto', 'channels.proto');
const CUSTOM_DIR = path.join(ROOT, 'specs', 'proto', 'custom');
const OUTPUT_DIR = path.join(ROOT, 'ios', 'ios_web_library', 'Generated');

function writeGenerated(fileName, content) {
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content);
  console.log(`[ProtoCodegen/iOS] Generated ${fileName}`);
}

function generate() {
  console.log('[ProtoCodegen/iOS] Parsing:', PROTO_FILE);

  // 确保输出目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 解析主 proto 文件
  const mainResult = parseProtoFile(PROTO_FILE);
  let allMessages = [...mainResult.file.messages];

  for (const warning of mainResult.warnings) {
    console.warn(`[ProtoCodegen/iOS] WARNING: ${warning}`);
  }

  // 解析 custom 目录
  if (fs.existsSync(CUSTOM_DIR)) {
    const customFiles = collectProtoFiles(CUSTOM_DIR);
    for (const customFile of customFiles) {
      console.log('[ProtoCodegen/iOS] Parsing custom:', customFile);
      const customResult = parseProtoFile(customFile);
      allMessages.push(...customResult.file.messages);
      for (const warning of customResult.warnings) {
        console.warn(`[ProtoCodegen/iOS] WARNING: ${warning}`);
      }
    }
  }

  // 去重
  const uniqueMessages = allMessages.filter((msg, idx, self) =>
    idx === self.findIndex(m => m.name === msg.name)
  );

  console.log(`[ProtoCodegen/iOS] Found ${uniqueMessages.length} messages: ${uniqueMessages.map(m => m.name).join(', ')}`);

  writeGenerated('MPDataSyncChannels.h', generateChannelsHeader(uniqueMessages));
  writeGenerated('MPDataSyncChannels.m', generateChannelsImpl(uniqueMessages));
  writeGenerated('MPDataSyncMethods.h', generateMethodsHeader(uniqueMessages));
  writeGenerated('MPDataSyncMethods.m', generateMethodsImpl(uniqueMessages));
  writeGenerated('MPDataSyncHelper+Generated.h', generateSettersHeader(uniqueMessages));
  writeGenerated('MPDataSyncHelper+Generated.m', generateSettersImpl(uniqueMessages));

  console.log('[ProtoCodegen/iOS] Done.');
}

/**
 * 生成 MPDataSyncChannels.h
 */
function generateChannelsHeader(messages) {
  const decls = messages.map(msg => {
    const constName = messageToChannelConstantName(msg.name);
    const comment = sanitizeCommentLine(msg.comment) || `${msg.name} 数据通道`;
    return `/** ${comment} */\nFOUNDATION_EXPORT NSString * const ${constName};`;
  }).join('\n\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

/**
 * 标准数据通道名称
 * 由 proto codegen 自动生成
 *
 * 对应鸿蒙端 generated/DataSyncChannels.ets
 */
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

${decls}

NS_ASSUME_NONNULL_END
`;
}

/**
 * 生成 MPDataSyncChannels.m
 */
function generateChannelsImpl(messages) {
  const defs = messages.map(msg => {
    const constName = messageToChannelConstantName(msg.name);
    const channelValue = messageToChannel(msg.name);
    return `NSString * const ${constName} = @"${channelValue}";`;
  }).join('\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

#import "MPDataSyncChannels.h"

${defs}
`;
}

/**
 * 生成 MPDataSyncMethods.h
 */
function generateMethodsHeader(messages) {
  const decls = messages.map(msg => {
    return `FOUNDATION_EXPORT NSString * const ${messageToMethodConstantName(msg.name)};`;
  }).join('\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

/**
 * Native → JS 推送数据时调用的 JSBridge 方法名
 * 由 proto codegen 自动生成
 *
 * 对应鸿蒙端 generated/DataSyncMethods.ets
 */
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

${decls}

@interface MPDataSyncMethods : NSObject

/**
 * 根据通道名获取对应的 JSBridge 方法名
 * 标准通道使用预定义方法名，自定义通道自动生成 "syncXxx" 格式
 */
+ (NSString *)methodFromChannel:(NSString *)channel;

@end

NS_ASSUME_NONNULL_END
`;
}

/**
 * 生成 MPDataSyncMethods.m
 */
function generateMethodsImpl(messages) {
  const defs = messages.map(msg => {
    return `NSString * const ${messageToMethodConstantName(msg.name)} = @"${messageToSyncMethod(msg.name)}";`;
  }).join('\n');

  const cases = messages.map(msg => {
    const channelConst = messageToChannelConstantName(msg.name);
    const methodConst = messageToMethodConstantName(msg.name);
    return `    if ([channel isEqualToString:${channelConst}]) {\n        return ${methodConst};\n    }`;
  }).join('\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

#import "MPDataSyncMethods.h"
#import "MPDataSyncChannels.h"

${defs}

@implementation MPDataSyncMethods

+ (NSString *)methodFromChannel:(NSString *)channel {
${cases}
    // 自定义通道：首字母大写后拼接 "sync" 前缀
    if (channel.length > 0) {
        NSString *first = [[channel substringToIndex:1] uppercaseString];
        NSString *rest = [channel substringFromIndex:1];
        return [NSString stringWithFormat:@"sync%@%@", first, rest];
    }
    return @"sync";
}

@end
`;
}

/**
 * 生成 MPDataSyncHelper+Generated.h
 *
 * 对应鸿蒙端 DataSyncSetters.ets（抽象基类 + 继承方式），
 * Objective-C 采用 Category 提供同等能力。
 */
function generateSettersHeader(messages) {
  const setters = messages.map(msg => {
    const setterName = messageToSetterName(msg.name);
    return `/** 设置 ${msg.name} 数据 */\n- (void)${setterName}:(NSString *)data;`;
  }).join('\n\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

/**
 * MPDataSyncHelper 的便捷 setter（proto codegen 生成）
 *
 * 对应鸿蒙端 generated/DataSyncSetters.ets（抽象基类 + 继承方式），
 * Objective-C 采用 Category 提供同等能力，调用核心类的 setData:data: 实现。
 */
#import <Foundation/Foundation.h>

#import "MPDataSyncHelper.h"

NS_ASSUME_NONNULL_BEGIN

@interface MPDataSyncHelper (Generated)

${setters}

@end

NS_ASSUME_NONNULL_END
`;
}

/**
 * 生成 MPDataSyncHelper+Generated.m
 */
function generateSettersImpl(messages) {
  const setters = messages.map(msg => {
    const setterName = messageToSetterName(msg.name);
    const constName = messageToChannelConstantName(msg.name);
    return `- (void)${setterName}:(NSString *)data {\n    [self setData:${constName} data:data];\n}`;
  }).join('\n\n');

  return `// AUTO-GENERATED from proto. DO NOT EDIT.

#import "MPDataSyncHelper+Generated.h"
#import "MPDataSyncChannels.h"

@implementation MPDataSyncHelper (Generated)

${setters}

@end
`;
}

// 运行生成
generate();

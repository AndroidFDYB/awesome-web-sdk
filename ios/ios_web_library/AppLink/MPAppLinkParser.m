#import "MPAppLinkParser.h"
#import "MPAppLinkParams.h"

/** scheme 前缀常量 */
static NSString * const kSchemeNativePrefix = @"sk://native=";
static NSString * const kSchemeActionPrefix = @"sk://action=";

/** 调试模式 */
static BOOL gAppLinkParserDebug = NO;

@implementation MPAppLinkParser

+ (void)setDebug:(BOOL)debug {
    gAppLinkParserDebug = debug;
}

+ (nullable MPAppLinkParams *)parse:(NSString *)scheme {
    if (scheme.length == 0) {
        [self log:@"parse failed: scheme is blank"];
        return nil;
    }

    // 提取 {} 内容
    NSString *content = [self extractContent:scheme];
    if (!content) {
        [self log:[NSString stringWithFormat:@"parse failed: cannot extract content from scheme=%@", scheme]];
        return nil;
    }

    // 解析键值对
    NSDictionary<NSString *, NSString *> *params = [self parseKeyValuePairs:content];
    if (params.count == 0) {
        [self log:[NSString stringWithFormat:@"parse failed: no key-value pairs found in content=%@", content]];
        return nil;
    }

    NSString *pageName = params[@"pageName"];
    NSString *url = params[@"url"];

    if (pageName.length == 0 || url.length == 0) {
        [self log:[NSString stringWithFormat:@"parse failed: pageName or url is missing. pageName=%@, url=%@",
                  pageName, url]];
        return nil;
    }

    BOOL backHome = [params[@"backHome"] isEqualToString:@"1"];
    NSString *title = params[@"title"];

    MPAppLinkParams *result = [[MPAppLinkParams alloc] init];
    result.pageName = pageName;
    result.url = url;
    result.title = title.length > 0 ? title : nil;
    result.backHome = backHome;
    result.rawScheme = scheme;
    return result;
}

+ (NSString *)convertToAction:(NSString *)scheme {
    if ([scheme hasPrefix:kSchemeNativePrefix]) {
        return [kSchemeActionPrefix stringByAppendingString:[scheme substringFromIndex:kSchemeNativePrefix.length]];
    }
    return scheme;
}

#pragma mark - 私有方法

/**
 * 提取 {…} 中的内容
 */
+ (nullable NSString *)extractContent:(NSString *)scheme {
    NSRange braceStart = [scheme rangeOfString:@"{"];
    if (braceStart.location == NSNotFound) {
        return nil;
    }
    NSRange braceEnd = [scheme rangeOfString:@"}" options:NSBackwardsSearch];
    if (braceEnd.location == NSNotFound || braceEnd.location <= braceStart.location) {
        return nil;
    }
    NSUInteger start = braceStart.location + braceStart.length;
    return [scheme substringWithRange:NSMakeRange(start, braceEnd.location - start)];
}

/**
 * 解析 key='value' 格式的键值对
 *
 * 格式示例：pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'
 *
 * 解析策略：
 * - 按 key= 分割
 * - value 被单引号包裹：提取 ' 之间的内容
 * - value 无引号：取到下一个逗号为止
 */
+ (NSDictionary<NSString *, NSString *> *)parseKeyValuePairs:(NSString *)content {
    NSMutableDictionary<NSString *, NSString *> *result = [NSMutableDictionary dictionary];
    NSUInteger length = content.length;
    NSUInteger pos = 0;

    while (pos < length) {
        // 跳过空白和逗号
        while (pos < length) {
            unichar ch = [content characterAtIndex:pos];
            if (ch == ',' || ch == ' ') {
                pos++;
            } else {
                break;
            }
        }
        if (pos >= length) {
            break;
        }

        // 读取 key
        NSRange searchRange = NSMakeRange(pos, length - pos);
        NSRange eqRange = [content rangeOfString:@"=" options:kNilOptions range:searchRange];
        if (eqRange.location == NSNotFound) {
            break;
        }
        NSString *key = [[content substringWithRange:NSMakeRange(pos, eqRange.location - pos)]
                         stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
        pos = eqRange.location + eqRange.length;

        // 跳过空白
        while (pos < length && [content characterAtIndex:pos] == ' ') {
            pos++;
        }

        if (pos >= length) {
            result[key] = @"";
            break;
        }

        // 读取 value
        NSString *value;
        if ([content characterAtIndex:pos] == '\'') {
            // 有引号：读取到下一个单引号
            pos++; // 跳过开头引号
            NSRange quoteRange = [content rangeOfString:@"'" options:kNilOptions range:NSMakeRange(pos, length - pos)];
            if (quoteRange.location == NSNotFound) {
                // 缺少结尾引号，取剩余全部
                value = [content substringFromIndex:pos];
                pos = length;
            } else {
                value = [content substringWithRange:NSMakeRange(pos, quoteRange.location - pos)];
                pos = quoteRange.location + quoteRange.length;
            }
        } else {
            // 无引号：取到下一个逗号
            NSRange commaRange = [content rangeOfString:@"," options:kNilOptions range:NSMakeRange(pos, length - pos)];
            if (commaRange.location == NSNotFound) {
                value = [[content substringFromIndex:pos]
                         stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
                pos = length;
            } else {
                value = [[content substringWithRange:NSMakeRange(pos, commaRange.location - pos)]
                         stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
                pos = commaRange.location;
            }
        }

        result[key] = value;
    }

    return result;
}

+ (void)log:(NSString *)msg {
    if (gAppLinkParserDebug) {
        NSLog(@"[MPBridge/AppLinkParser] %@", msg);
    }
}

@end

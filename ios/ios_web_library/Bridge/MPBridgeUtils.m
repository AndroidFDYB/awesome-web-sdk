#import "MPBridgeUtils.h"

@implementation MPBridgeUtils

+ (NSString *)appendPlatformParam:(NSString *)url {
    if ([url containsString:@"platform="]) {
        return url;
    }
    NSString *separator = [url containsString:@"?"] ? @"&" : @"?";
    return [NSString stringWithFormat:@"%@%@platform=ios", url, separator];
}

+ (nullable NSString *)bridgeJavaScriptString {
    NSString *path = [self bridgeJsPath];
    if (!path) {
        NSLog(@"[BridgeUtils] bridge.js not found in any bundle");
        return nil;
    }
    return [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil];
}

+ (nullable WKUserScript *)bridgeUserScript {
    NSString *source = [self bridgeJavaScriptString];
    if (!source) {
        return nil;
    }
    return [[WKUserScript alloc] initWithSource:source
                                   injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                forMainFrameOnly:NO];
}

+ (void)injectBridgeScript:(WKWebView *)webView {
    NSString *source = [self bridgeJavaScriptString];
    if (!source) {
        NSLog(@"[BridgeUtils] Failed to inject bridge.js: file not found");
        return;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
        [webView evaluateJavaScript:source completionHandler:^(id _Nullable result, NSError * _Nullable error) {
            if (error) {
                NSLog(@"[BridgeUtils] Failed to inject bridge.js: %@", error);
            } else {
                NSLog(@"[BridgeUtils] bridge.js injected successfully");
            }
        }];
    });
}

#pragma mark - 私有方法

/**
 * 查找 bridge.js 资源路径
 * 查找顺序：类所在 Bundle（含子 Bundle）→ 主 Bundle → 所有已加载 Bundle/Framework
 */
+ (nullable NSString *)bridgeJsPath {
    NSMutableArray<NSBundle *> *candidates = [NSMutableArray array];
    [candidates addObject:[NSBundle bundleForClass:[self class]]];
    if (![candidates containsObject:[NSBundle mainBundle]]) {
        [candidates addObject:[NSBundle mainBundle]];
    }
    for (NSBundle *bundle in [NSBundle allBundles]) {
        if (![candidates containsObject:bundle]) {
            [candidates addObject:bundle];
        }
    }
    for (NSBundle *bundle in [NSBundle allFrameworks]) {
        if (![candidates containsObject:bundle]) {
            [candidates addObject:bundle];
        }
    }

    for (NSBundle *bundle in candidates) {
        NSString *path = [bundle pathForResource:@"bridge" ofType:@"js"];
        if (path) {
            return path;
        }
        // CocoaPods resource_bundles 子 Bundle 场景
        for (NSURL *subUrl in [bundle URLsForResourcesWithExtension:@"bundle" subdirectory:nil]) {
            NSBundle *subBundle = [NSBundle bundleWithURL:subUrl];
            NSString *subPath = [subBundle pathForResource:@"bridge" ofType:@"js"];
            if (subPath) {
                return subPath;
            }
        }
    }
    return nil;
}

@end

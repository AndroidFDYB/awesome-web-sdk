#import "MPAppLinkParams.h"

NSString * const MPAppLinkPageTransparent = @"transparent";

@implementation MPAppLinkParams

+ (BOOL)isTransparentPage:(MPAppLinkParams *)params {
    return [params.pageName isEqualToString:MPAppLinkPageTransparent];
}

@end

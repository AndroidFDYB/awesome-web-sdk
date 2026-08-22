// AUTO-GENERATED from proto. DO NOT EDIT.

#import "MPDataSyncMethods.h"
#import "MPDataSyncChannels.h"

NSString * const MPDataSyncMethodSyncUserInfo = @"syncUserInfo";
NSString * const MPDataSyncMethodSyncLoanInfo = @"syncLoanInfo";
NSString * const MPDataSyncMethodSyncVipInfo = @"syncVipInfo";
NSString * const MPDataSyncMethodSyncLeadInfo = @"syncLeadInfo";

@implementation MPDataSyncMethods

+ (NSString *)methodFromChannel:(NSString *)channel {
    if ([channel isEqualToString:MPDataSyncChannelUserInfo]) {
        return MPDataSyncMethodSyncUserInfo;
    }
    if ([channel isEqualToString:MPDataSyncChannelLoanInfo]) {
        return MPDataSyncMethodSyncLoanInfo;
    }
    if ([channel isEqualToString:MPDataSyncChannelVipInfo]) {
        return MPDataSyncMethodSyncVipInfo;
    }
    if ([channel isEqualToString:MPDataSyncChannelLeadInfo]) {
        return MPDataSyncMethodSyncLeadInfo;
    }
    // 自定义通道：首字母大写后拼接 "sync" 前缀
    if (channel.length > 0) {
        NSString *first = [[channel substringToIndex:1] uppercaseString];
        NSString *rest = [channel substringFromIndex:1];
        return [NSString stringWithFormat:@"sync%@%@", first, rest];
    }
    return @"sync";
}

@end

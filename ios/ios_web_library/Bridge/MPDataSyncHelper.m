#import "MPDataSyncHelper.h"
#import "MPDataSyncMethods.h"

#pragma mark - 单通道状态

/** 单个数据通道的状态 */
@interface MPChannelState : NSObject

/** 业务数据 JSON 字符串，nil 表示尚未设置 */
@property (nonatomic, copy, nullable) NSString *data;

/** 是否已推送到 JS */
@property (nonatomic, assign) BOOL pushed;

@end

@implementation MPChannelState
@end

#pragma mark - MPDataSyncHelper

@interface MPDataSyncHelper ()

/** JSBridge 管理器，用于调用 JS 方法推送数据 */
@property (nonatomic, strong, readonly) MPJSBridgeManager *bridgeManager;

/** 所需数据通道集合（保持插入顺序，决定推送顺序） */
@property (nonatomic, strong) NSMutableOrderedSet<NSString *> *requiredChannelSet;

/** 各通道状态 */
@property (nonatomic, strong) NSMutableDictionary<NSString *, MPChannelState *> *channelStates;

/** 当前同步状态 */
@property (nonatomic, assign) MPSyncState syncState;

/** 调试模式 */
@property (nonatomic, assign, readonly) BOOL debug;

@end

@implementation MPDataSyncHelper

#pragma mark - 生命周期

- (instancetype)initWithBridgeManager:(MPJSBridgeManager *)bridgeManager
                      requiredChannels:(NSArray<NSString *> *)requiredChannels
                                debug:(BOOL)debug {
    self = [super init];
    if (self) {
        _bridgeManager = bridgeManager;
        _debug = debug;
        _requiredChannelSet = [NSMutableOrderedSet orderedSetWithArray:requiredChannels ?: @[]];
        _channelStates = [NSMutableDictionary dictionary];
        _syncState = MPSyncStateIdle;

        // 初始化所需通道的状态
        for (NSString *channel in _requiredChannelSet) {
            _channelStates[channel] = [[MPChannelState alloc] init];
        }

        [self logWithFormat:@"DataSyncHelper created, requiredChannels=%@", requiredChannels];
    }
    return self;
}

- (NSArray<NSString *> *)requiredChannels {
    return [self.requiredChannelSet array];
}

#pragma mark - 页面加载通知

- (void)notifyPageLoaded {
    if (self.syncState == MPSyncStateLoading || self.syncState == MPSyncStateIdle) {
        self.syncState = MPSyncStateLoaded;
        [self logWithFormat:@"page loaded, checking pending data"];
        [self pushPendingData];
    }
}

- (void)notifyPageLoading {
    self.syncState = MPSyncStateLoading;
    // 重置推送状态（新页面需要重新推送）
    for (MPChannelState *state in [self.channelStates allValues]) {
        state.pushed = NO;
    }
}

#pragma mark - 设置业务数据

- (void)setData:(NSString *)channel data:(NSString *)data {
    MPChannelState *state = self.channelStates[channel];
    if (!state) {
        state = [[MPChannelState alloc] init];
        self.channelStates[channel] = state;
        // 动态添加通道到所需列表
        [self.requiredChannelSet addObject:channel];
    }
    state.data = data;
    state.pushed = NO;

    [self logWithFormat:@"data set for channel=%@, pending push", channel];

    // 页面已加载则立即推送
    if (self.syncState == MPSyncStateLoaded) {
        [self pushPendingData];
    }
}

#pragma mark - 数据推送

/**
 * 推送所有待推送的数据
 * 仅推送所需通道中数据已就绪但尚未推送的通道
 */
- (void)pushPendingData {
    BOOL allPushed = YES;

    for (NSString *channel in self.requiredChannelSet) {
        MPChannelState *state = self.channelStates[channel];
        if (state.data != nil && !state.pushed) {
            NSString *methodName = [MPDataSyncMethods methodFromChannel:channel];
            // 通过 JSBridge 调用 JS 端注册的数据同步 Handler
            [self.bridgeManager callJsMethod:methodName args:@[state.data] callback:nil];

            state.pushed = YES;
            [self logWithFormat:@"pushed data for channel=%@ via method=%@", channel, methodName];
        }
        if (state == nil || state.data == nil || !state.pushed) {
            allPushed = NO;
        }
    }

    if (allPushed && self.requiredChannelSet.count > 0) {
        self.syncState = MPSyncStateSynced;
        [self logWithFormat:@"all data synced!"];
    }
}

#pragma mark - 状态查询

- (BOOL)isDataSynced:(NSString *)channel {
    return self.channelStates[channel].pushed;
}

- (BOOL)isAllDataSynced {
    if (self.requiredChannelSet.count == 0) {
        return YES;
    }
    for (NSString *channel in self.requiredChannelSet) {
        MPChannelState *state = self.channelStates[channel];
        if (!state || !state.pushed) {
            return NO;
        }
    }
    return YES;
}

- (BOOL)hasData:(NSString *)channel {
    return self.channelStates[channel].data != nil;
}

#pragma mark - 重置

- (void)reset {
    self.syncState = MPSyncStateIdle;
    for (MPChannelState *state in [self.channelStates allValues]) {
        state.data = nil;
        state.pushed = NO;
    }
    [self logWithFormat:@"reset"];
}

#pragma mark - 日志

- (void)logWithFormat:(NSString *)format, ... {
    if (!self.debug) {
        return;
    }
    va_list args;
    va_start(args, format);
    NSLog(@"[MPBridge/DataSync] %@", [[NSString alloc] initWithFormat:format arguments:args]);
    va_end(args);
}

@end

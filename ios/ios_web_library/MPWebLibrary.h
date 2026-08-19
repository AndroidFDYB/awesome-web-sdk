/**
 * MP-SDK iOS 端 SDK 总入口
 *
 * 对应鸿蒙端 Index.ets。
 *
 * 模块概览：
 * - Bridge:     MPJSBridgeManager / MPDsBridgeProxy / MPBridgeUtils / MPDataSyncHelper
 * - AppLink:    MPAppLinkParser / MPAppLinkParams / MPAppLinkHandler
 * - Emitter:    MPEventRouter
 * - Generated:  MPDataSyncChannels / MPDataSyncMethods / MPDataSyncHelper+Generated
 * - Components: MPBridgeWebViewController
 */

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

// Bridge 模块
#import "MPBridgeHandler.h"
#import "MPBridgeModels.h"
#import "MPJSBridgeManager.h"
#import "MPDsBridgeProxy.h"
#import "MPBridgeUtils.h"
#import "MPDataSyncHelper.h"

// Generated 模块（proto codegen 自动生成）
#import "MPDataSyncChannels.h"
#import "MPDataSyncMethods.h"
#import "MPDataSyncHelper+Generated.h"

// AppLink 模块
#import "MPAppLinkParams.h"
#import "MPAppLinkParser.h"
#import "MPAppLinkHandler.h"

// Emitter 模块
#import "MPEventRouter.h"

// Components 模块
#import "MPBridgeWebViewController.h"

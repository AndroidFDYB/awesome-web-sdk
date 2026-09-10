/// MP-SDK Flutter 端原生 SDK
///
/// 提供 WebView 容器桥接、数据同步、AppLink 跳转、跨 WebView 事件路由。
/// 对标 Android and_web_library / iOS ios_web_library / 鸿蒙 hm_web_library。
library;

// Bridge 核心
export 'src/bridge/bridge_handler.dart';
export 'src/bridge/bridge_models.dart';
export 'src/bridge/js_bridge_manager.dart';
export 'src/bridge/bridge_utils.dart';
export 'src/bridge/data_sync_helper.dart';
export 'src/bridge/app_link_handler.dart';

// Emitter
export 'src/emitter/event_router.dart';

// Config
export 'src/config/mp_bridge_config.dart';

// Generated（Proto Codegen 产物）
export 'generated/data_sync_channels.dart';
export 'generated/data_sync_methods.dart';
export 'generated/data_sync_setters.dart';

// SDK 顶层配置
export 'src/mp_bridge_sdk.dart';

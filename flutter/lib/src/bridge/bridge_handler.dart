/// 同步处理器类型定义
///
/// JS -> Native 同步调用使用的处理器签名。
typedef SyncBridgeHandler = dynamic Function(dynamic params);

/// 异步处理器类型定义
///
/// JS -> Native 异步调用使用的处理器签名。
/// 第二个参数为回调函数，处理完成后调用回调将结果返回给 JS 端。
typedef AsyncBridgeHandler = void Function(
    dynamic params, void Function(dynamic result) callback);

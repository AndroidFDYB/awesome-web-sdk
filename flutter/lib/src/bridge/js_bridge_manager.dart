import 'dart:convert';

import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'bridge_handler.dart';
import 'bridge_models.dart';
import '../config/mp_bridge_config.dart';

/// JSBridge 管理器
///
/// 负责 Handler 注册/分发、JS↔Dart 双向通信。
/// 对标 iOS MPJSBridgeManager / 鸿蒙 JSBridgeManager。
class JSBridgeManager {
  final bool debug;
  final Map<String, SyncBridgeHandler> _syncHandlers = {};
  final Map<String, AsyncBridgeHandler> _asyncHandlers = {};

  InAppWebViewController? _webController;

  JSBridgeManager({this.debug = false});

  /// 设置 WebView 控制器（由 onLoadStart 回调调用）
  void setWebController(InAppWebViewController controller) {
    _webController = controller;
  }

  /// 注册同步 Handler
  void registerHandler(String method, SyncBridgeHandler handler) {
    _syncHandlers[method] = handler;
    _log('Registered sync handler: $method');
  }

  /// 注册异步 Handler
  void registerAsyncHandler(String method, AsyncBridgeHandler handler) {
    _asyncHandlers[method] = handler;
    _log('Registered async handler: $method');
  }

  /// 检查方法是否已注册
  bool hasMethod(String method) {
    return _syncHandlers.containsKey(method) ||
        _asyncHandlers.containsKey(method);
  }

  /// 处理 JS 端发来的消息（由 addJavaScriptHandler 回调调用）
  ///
  /// bridge.js 通过 flutter_inappwebview.callHandler('mpBridge', jsonStr) 发送消息，
  /// 此方法解析消息并分发到对应的 Handler。
  Future<dynamic> handleJsMessage(dynamic args) async {
    String jsonStr;
    if (args is String) {
      jsonStr = args;
    } else if (args is List && args.isNotEmpty) {
      jsonStr = args[0].toString();
    } else {
      _log('handleJsMessage: invalid args: $args');
      return null;
    }

    final message = JsBridgeMessage.fromJson(
        jsonDecode(jsonStr) as Map<String, dynamic>);

    switch (message.type) {
      case 'call':
        _handleSyncCall(message.payload);
        break;
      case 'callAsync':
        _handleAsyncCall(message.payload);
        break;
      case 'hasMethod':
        _handleHasMethod(message.payload);
        break;
      case 'nativeCallComplete':
        _handleNativeCallComplete(message.payload);
        break;
      default:
        _log('Unknown message type: ${message.type}');
    }
    return null;
  }

  /// 处理同步调用
  void _handleSyncCall(String payloadJson) {
    final request = BridgeRequest.fromJson(
        jsonDecode(payloadJson) as Map<String, dynamic>);
    _log('handleSyncCall: ${request.method}');

    final handler = _syncHandlers[request.method];
    if (handler != null) {
      try {
        final result = handler(request.params);
        _sendResponseToJs(request.callbackId, result);
      } catch (e) {
        _sendErrorResponse(request.callbackId, BridgeResponse.kErrorException,
            e.toString());
      }
    } else {
      _sendErrorResponse(request.callbackId, BridgeResponse.kErrorMethodNotFound,
          'Method not found: ${request.method}');
    }
  }

  /// 处理异步调用
  void _handleAsyncCall(String payloadJson) {
    final request = BridgeRequest.fromJson(
        jsonDecode(payloadJson) as Map<String, dynamic>);
    _log('handleAsyncCall: ${request.method}');

    final asyncHandler = _asyncHandlers[request.method];
    if (asyncHandler != null) {
      try {
        asyncHandler(request.params, (result) {
          _sendResponseToJs(request.callbackId, result);
        });
      } catch (e) {
        _sendErrorResponse(request.callbackId, BridgeResponse.kErrorException,
            e.toString());
      }
      return;
    }

    // 尝试同步 Handler
    final syncHandler = _syncHandlers[request.method];
    if (syncHandler != null) {
      try {
        final result = syncHandler(request.params);
        _sendResponseToJs(request.callbackId, result);
      } catch (e) {
        _sendErrorResponse(request.callbackId, BridgeResponse.kErrorException,
            e.toString());
      }
      return;
    }

    _sendErrorResponse(request.callbackId, BridgeResponse.kErrorMethodNotFound,
        'Method not found: ${request.method}');
  }

  /// 处理 hasMethod 查询
  void _handleHasMethod(String method) {
    final has = hasMethod(method);
    _log('hasMethod: $method -> $has');
    _evaluateJs(
        'window.dsBridge._handleHasMethodResult("${_escapeJs(method)}", $has)');
  }

  /// 处理 Native 调用完成回调
  void _handleNativeCallComplete(String payloadJson) {
    // 这是 JS 端 handler 执行完毕后回传的结果
    // 由 callJs 发起的调用的回调处理
    _log('nativeCallComplete: $payloadJson');
  }

  /// Native -> JS 调用
  ///
  /// 通过 evaluateJavascript 调用 JS 端注册的 handler。
  Future<dynamic> callJs(String method,
      {List<dynamic>? args,
      void Function(dynamic result)? callback}) async {
    if (_webController == null) {
      _log('callJs failed: no web controller');
      return null;
    }

    final callbackId =
        callback != null ? 'ncb_${DateTime.now().millisecondsSinceEpoch}' : '';
    final request = NativeCallRequest(
      callbackId: callbackId,
      method: method,
      params: args ?? [],
    );

    final js =
        'window.dsBridge._handleNativeCall(${jsonEncode(request.toJson())})';
    return _evaluateJs(js);
  }

  /// 发送响应给 JS
  void _sendResponseToJs(String callbackId, dynamic data) {
    final response = BridgeResponse(callbackId: callbackId, data: data);
    final js =
        'window.dsBridge._handleResponse(${jsonEncode(response.toJson())})';
    _evaluateJs(js);
  }

  /// 发送错误响应给 JS
  void _sendErrorResponse(String callbackId, int code, String message) {
    final response = BridgeResponse(
        callbackId: callbackId, code: code, message: message);
    final js =
        'window.dsBridge._handleResponse(${jsonEncode(response.toJson())})';
    _evaluateJs(js);
  }

  /// 执行 JS 代码
  Future<dynamic> _evaluateJs(String js) async {
    if (_webController == null) return null;
    try {
      return await _webController!.evaluateJavascript(source: js);
    } catch (e) {
      _log('evaluateJavascript error: $e');
      return null;
    }
  }

  /// JS 字符串转义
  String _escapeJs(String s) {
    return s
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"')
        .replaceAll('\n', '\\n')
        .replaceAll('\r', '\\r');
  }

  void _log(String msg) {
    if (debug || MPBridgeConfig.instance.debug) {
      print('[${MPBridgeConfig.instance.logTag}] $msg');
    }
  }
}

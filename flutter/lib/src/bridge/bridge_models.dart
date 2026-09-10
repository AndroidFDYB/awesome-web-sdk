import 'dart:convert';

/// JS -> Native 请求数据模型
class BridgeRequest {
  final String callbackId;
  final String method;
  final dynamic params;

  BridgeRequest({
    required this.callbackId,
    required this.method,
    this.params,
  });

  factory BridgeRequest.fromJson(Map<String, dynamic> json) {
    dynamic params = json['params'];
    if (params is String) {
      try {
        params = jsonDecode(params);
      } catch (_) {}
    }
    return BridgeRequest(
      callbackId: json['callbackId'] as String? ?? '',
      method: json['method'] as String? ?? '',
      params: params,
    );
  }

  Map<String, dynamic> toJson() => {
        'callbackId': callbackId,
        'method': method,
        'params': params is String ? params : jsonEncode(params ?? {}),
      };
}

/// Native -> JS 响应数据模型
class BridgeResponse {
  final String callbackId;
  final int code;
  final dynamic data;
  final String? message;

  BridgeResponse({
    required this.callbackId,
    this.code = 0,
    this.data,
    this.message,
  });

  /// 方法不存在错误码
  static const int kErrorMethodNotFound = -1;

  /// 异常错误码
  static const int kErrorException = -2;

  Map<String, dynamic> toJson() => {
        'callbackId': callbackId,
        'code': code,
        'data': data is String ? data : jsonEncode(data ?? ''),
        if (message != null) 'message': message,
      };

  String toJsonString() => jsonEncode(toJson());
}

/// Native -> JS 调用请求模型
class NativeCallRequest {
  final String callbackId;
  final String method;
  final List<dynamic> params;

  NativeCallRequest({
    required this.callbackId,
    required this.method,
    this.params = const [],
  });

  Map<String, dynamic> toJson() => {
        'callbackId': callbackId,
        'method': method,
        'params': jsonEncode(params),
      };

  String toJsonString() => jsonEncode(toJson());
}

/// JS 端消息结构（bridge.js postToNative 发出的消息）
class JsBridgeMessage {
  final String type;
  final String payload;

  JsBridgeMessage({required this.type, required this.payload});

  factory JsBridgeMessage.fromJson(Map<String, dynamic> json) {
    return JsBridgeMessage(
      type: json['type'] as String? ?? '',
      payload: json['payload'] as String? ?? '',
    );
  }
}

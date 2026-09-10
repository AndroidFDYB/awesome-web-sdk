/**
 * MPBridge JS 端桥接代码（Flutter 版）
 *
 * 基于 iOS 版 bridge.js 修改。
 * 注入到 flutter_inappwebview 的 WebView 中，提供与 DSBridge 兼容的 JS API。
 * 注入后 JS 端可使用 window.dsBridge 进行桥接通信。
 *
 * 与 iOS 版的差异：
 * - JS -> Native 使用 window.flutter_inappwebview.callHandler('mpBridge', ...)
 *   替代 window.webkit.messageHandlers.mpBridge.postMessage(...)
 * - Native -> JS 仍使用 evaluateJavascript 调用内部方法
 *
 * 兼容性设计：
 * - 设置 window.__flutter_bridge = true（精确检测）
 * - 同时设置 window.__harmony_bridge = true（兼容标记，旧版前端 SDK 可复用 dsBridge 适配层）
 */

(function () {
  if (window.__dsBridgeInitialized) return;
  window.__dsBridgeInitialized = true;

  // 标记 Flutter 环境
  window.__flutter_bridge = true;
  // 兼容标记：现有前端 SDK 通过 __harmony_bridge && dsBridge 识别 dsBridge 协议环境
  window.__harmony_bridge = true;

  var callbackId = 0;
  var callbacks = {};
  var handlers = {};
  var asyncHandlers = {};
  var nativeMethodsCache = {};

  function genCallbackId() {
    return 'cb_' + (callbackId++) + '_' + Date.now();
  }

  /**
   * 发送消息到 Native（Flutter flutter_inappwebview JavaScriptHandler 通道）
   * @param {string} type 消息类型：call / callAsync / hasMethod / nativeCallComplete
   * @param {string} payload 消息内容
   */
  function postToNative(type, payload) {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
      window.flutter_inappwebview.callHandler('mpBridge', JSON.stringify({ type: type, payload: payload }));
    } else {
      console.warn('[MPBridge] postToNative failed: no flutter_inappwebview.callHandler, type=' + type);
    }
  }

  window.dsBridge = {

    /**
     * 调用 Native 方法（同步语义，Flutter 降级为异步）
     */
    call: function (method, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = {};
      }
      var cbId = genCallbackId();
      if (callback) {
        callbacks[cbId] = callback;
      }
      var request = {
        callbackId: cbId,
        method: method,
        params: JSON.stringify(params !== undefined ? params : {})
      };
      postToNative('call', JSON.stringify(request));
      return undefined;
    },

    /**
     * 调用 Native 方法（异步）
     */
    callAsync: function (method, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = {};
      }
      var cbId = genCallbackId();
      if (callback) {
        callbacks[cbId] = callback;
      }
      var request = {
        callbackId: cbId,
        method: method,
        params: JSON.stringify(params !== undefined ? params : {})
      };
      postToNative('callAsync', JSON.stringify(request));
    },

    register: function (method, handler) {
      if (typeof handler === 'object') {
        var namespace = method;
        var apiObj = handler;
        for (var key in apiObj) {
          if (apiObj.hasOwnProperty(key) && typeof apiObj[key] === 'function') {
            handlers[namespace + '.' + key] = apiObj[key];
          }
        }
      } else {
        handlers[method] = handler;
      }
    },

    registerAsyn: function (method, handler) {
      if (typeof handler === 'object') {
        var namespace = method;
        var apiObj = handler;
        for (var key in apiObj) {
          if (apiObj.hasOwnProperty(key) && typeof apiObj[key] === 'function') {
            asyncHandlers[namespace + '.' + key] = apiObj[key];
          }
        }
      } else {
        asyncHandlers[method] = handler;
      }
    },

    hasMethod: function (method) {
      if (handlers[method] || asyncHandlers[method]) return true;
      if (nativeMethodsCache[method]) return true;
      postToNative('hasMethod', method);
      return false;
    },

    _handleResponse: function (response) {
      var cb = callbacks[response.callbackId];
      if (cb) {
        var data = response.data;
        try { data = JSON.parse(data); } catch (e) {}
        cb(data);
        delete callbacks[response.callbackId];
      }
    },

    _handleNativeCall: function (request) {
      var method = request.method;
      var args = [];
      try { args = JSON.parse(request.params); } catch (e) {}
      var callbackId = request.callbackId;

      if (handlers[method]) {
        var result = handlers[method].apply(null, args);
        postToNative('nativeCallComplete', JSON.stringify({
          callbackId: callbackId,
          result: JSON.stringify(result)
        }));
        return;
      }
      if (asyncHandlers[method]) {
        asyncHandlers[method].apply(null, args.concat([function (result) {
          postToNative('nativeCallComplete', JSON.stringify({
            callbackId: callbackId,
            result: JSON.stringify(result)
          }));
        }]));
        return;
      }

      console.warn('[MPBridge] JS handler not found:', method);
      postToNative('nativeCallComplete', JSON.stringify({
        callbackId: callbackId,
        result: JSON.stringify(null)
      }));
    },

    _handleHasMethodResult: function (method, has) {
      nativeMethodsCache[method] = !!has;
    }
  };
})();

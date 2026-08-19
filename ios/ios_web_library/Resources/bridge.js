/**
 * MPBridge JS 端桥接代码（iOS 版）
 *
 * 对应鸿蒙端 rawfile/bridge.js。
 *
 * 此文件注入到 iOS WKWebView 中，提供与 DSBridge 兼容的 JS API。
 * 注入后 JS 端可使用 window.dsBridge 进行桥接通信。
 *
 * 协议兼容 DSBridge，与鸿蒙端 bridge.js 协议保持一致，
 * 前端 SDK（@mp-sdk/bridge）可使用统一的 API。
 *
 * 注入方式：由 SDK 通过 WKUserScript 在 document-start 注入
 * （或业务方调用 [MPBridgeUtils injectBridgeScript:] 手动注入）
 *
 * 与鸿蒙版的差异（平台机制不同）：
 * - 鸿蒙通过 javaScriptProxy 注入同步原生对象 window._dsbridge
 * - iOS WKWebView 仅支持异步消息通道：
 *   - JS -> Native 使用 window.webkit.messageHandlers.mpBridge.postMessage(...)
 *   - Native -> JS 使用 evaluateJavaScript 调用下方内部方法
 * - 因此 dsBridge.call() 的同步返回在 iOS 上不可用，
 *   降级为异步（结果通过第三个参数 callback 返回），请优先使用 callAsync()
 */

(function () {
  if (window.__dsBridgeInitialized) return;
  window.__dsBridgeInitialized = true;

  // 标记 iOS 环境（供前端 SDK platform.ts 升级后检测：window.__ios_bridge && window.dsBridge → 'ios'）
  window.__ios_bridge = true;

  // 兼容标记：现有前端 SDK 通过 __harmony_bridge && dsBridge 识别 dsBridge 协议环境，
  // iOS 端协议与鸿蒙端完全一致（bridgeType 复用 dsBridge 适配层），
  // 设置此标记可使现有前端 SDK 零改动接入 iOS。
  // 前端 SDK 增加 iOS 平台检测后，可优先识别 __ios_bridge 以精确区分平台。
  window.__harmony_bridge = true;

  var callbackId = 0;
  var callbacks = {};
  var handlers = {};
  var asyncHandlers = {};
  // Native 方法存在性缓存（hasMethod 异步查询的结果，下次调用生效）
  var nativeMethodsCache = {};

  /**
   * 生成唯一回调 ID
   */
  function genCallbackId() {
    return 'cb_' + (callbackId++) + '_' + Date.now();
  }

  /**
   * 发送消息到 Native（iOS WKWebView 异步通道）
   * @param {string} type 消息类型：call / callAsync / hasMethod / nativeCallComplete
   * @param {string} payload 消息内容
   */
  function postToNative(type, payload) {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mpBridge) {
      window.webkit.messageHandlers.mpBridge.postMessage({ type: type, payload: payload });
    } else {
      console.warn('[MPBridge] postToNative failed: no messageHandler "mpBridge", type=' + type);
    }
  }

  /**
   * dsBridge 用户 API
   */
  window.dsBridge = {

    /**
     * 调用 Native 方法（同步语义，iOS 降级为异步）
     *
     * WKWebView 消息通道为异步，无法像鸿蒙一样同步返回结果：
     * - 本方法返回 undefined
     * - 如需获取结果，请传入第三个参数 callback（签名与 callAsync 一致）
     *
     * @param {string} method 方法名
     * @param {*} params 参数
     * @param {function} [callback] 结果回调（可选）
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
      // iOS WKWebView 消息通道为异步，无法同步返回结果
      return undefined;
    },

    /**
     * 调用 Native 方法（异步）
     * @param {string} method 方法名
     * @param {*} params 参数
     * @param {function} callback 回调函数
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

    /**
     * 注册同步 Handler
     * @param {string} method 方法名
     * @param {function} handler 处理器
     */
    register: function (method, handler) {
      if (typeof handler === 'object') {
        // 命名空间注册
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

    /**
     * 注册异步 Handler
     * @param {string} method 方法名
     * @param {function} handler 处理器
     */
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

    /**
     * 检查方法是否已注册
     *
     * 注意：Native 方法存在性为异步查询，首次查询返回 false，
     * 结果通过 _handleHasMethodResult 更新缓存后，下次调用返回准确值。
     *
     * @param {string} method 方法名
     */
    hasMethod: function (method) {
      if (handlers[method] || asyncHandlers[method]) return true;
      if (nativeMethodsCache[method]) return true;
      // 异步查询 Native，结果更新缓存（供下次调用使用）
      postToNative('hasMethod', method);
      return false;
    },

    /**
     * 内部方法：处理 Native 异步调用的响应（由 Native evaluateJavaScript 调用）
     */
    _handleResponse: function (response) {
      var cb = callbacks[response.callbackId];
      if (cb) {
        var data = response.data;
        try { data = JSON.parse(data); } catch (e) {}
        cb(data);
        delete callbacks[response.callbackId];
      }
    },

    /**
     * 内部方法：处理 Native -> JS 的调用（由 Native evaluateJavaScript 调用）
     */
    _handleNativeCall: function (request) {
      var method = request.method;
      var args = [];
      try { args = JSON.parse(request.params); } catch (e) {}
      var callbackId = request.callbackId;

      // 先查 JS 注册的 handler
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

      // 方法不存在
      console.warn('[MPBridge] JS handler not found:', method);
      postToNative('nativeCallComplete', JSON.stringify({
        callbackId: callbackId,
        result: JSON.stringify(null)
      }));
    },

    /**
     * 内部方法：更新 Native 方法存在性缓存（由 Native evaluateJavaScript 调用）
     */
    _handleHasMethodResult: function (method, has) {
      nativeMethodsCache[method] = !!has;
    }
  };
})();

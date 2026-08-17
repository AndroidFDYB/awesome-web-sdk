package com.sharknade.and_web_library

import android.content.Context
import android.util.AttributeSet
import android.util.Log
import wendu.dsbridge.DWebView
import wendu.dsbridge.OnReturnValue

/**
 * MPBridgeWebView
 *
 * 基于 DSBridge（wendux/DSBridge-Android）的 DWebView 封装。
 * 提供统一的 JSBridge 通信能力，支持：
 * - JS 调用 Native（同步 / 异步）
 * - Native 调用 JS
 * - Handler 注册与管理
 *
 * 使用方式：
 * ```kotlin
 * val webView = MPBridgeWebView(context)
 * webView.addJavascriptObject(MyJsApi(), null)  // 注册 API
 * webView.loadUrl("https://your-page.com")
 * ```
 */
class MPBridgeWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : DWebView(context, attrs) {

    init {
        // 根据配置开启调试模式
        if (MPBridgeConfig.debug) {
            setDebug(true)
            Log.d(MPBridgeConfig.LOG_TAG, "MPBridgeWebView initialized in debug mode")
        }
    }

    /**
     * 注册 Native API 对象
     *
     * @param apiObject 包含 @JavascriptInterface 注解方法的对象
     * @param namespace 命名空间，null 表示全局命名空间
     *
     * 示例：
     * ```kotlin
     * class MyApi {
     *     @JavascriptInterface
     *     fun getUserInfo(msg: Any): String {
     *         return """{"name":"test","age":25}"""
     *     }
     *
     *     @JavascriptInterface
     *     fun pay(msg: Any, handler: CompletionHandler<String>) {
     *         // 异步处理
     *         handler.complete("""{"status":"success"}""")
     *     }
     * }
     *
     * webView.addJavascriptObject(MyApi(), "business")
     * // JS 调用: dsBridge.call("business.getUserInfo", params)
     * ```
     */
    override fun addJavascriptObject(apiObject: Any?, namespace: String?): DWebView {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "addJavascriptObject: namespace=$namespace, class=${apiObject?.javaClass?.simpleName}")
        }
        return super.addJavascriptObject(apiObject, namespace)
    }

    /**
     * 调用 JS 方法（带返回值回调）
     *
     * @param methodName JS 方法名
     * @param args 参数数组
     * @param callback 返回值回调
     *
     * 示例：
     * ```kotlin
     * webView.callJsHandler("onDataUpdate", arrayOf("key", "value")) { result ->
     *     Log.d("MPBridge", "JS returned: $result")
     * }
     * ```
     */
    fun <T> callJsHandler(methodName: String, args: Array<Any>?, callback: OnReturnValue<T>?) {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "callJsHandler: method=$methodName, args=${args?.contentToString()}")
        }
        if (args != null) {
            callHandler(methodName, args, callback)
        } else {
            callHandler(methodName, arrayOf(), callback)
        }
    }

    /**
     * 调用 JS 方法（简化版，无参数）
     */
    fun <T> callJsHandler(methodName: String, callback: OnReturnValue<T>?) {
        callJsHandler(methodName, null, callback)
    }

    /**
     * 调用 JS 方法（无回调）
     */
    fun callJsHandler(methodName: String, args: Array<Any>?) {
        callJsHandler<Any>(methodName, args, null)
    }

    /**
     * 加载 URL 并注入桥接
     * DWebView 会自动处理 DSBridge 的注入，无需额外操作
     */
    fun loadBridgeUrl(url: String) {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "loadBridgeUrl: $url")
        }
        loadUrl(url)
    }
}

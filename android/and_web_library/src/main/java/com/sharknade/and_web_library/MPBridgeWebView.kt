package com.sharknade.and_web_library

import android.content.Context
import android.util.AttributeSet
import android.util.Log
import com.github.lzyzsd.jsbridge.BridgeWebView
import com.github.lzyzsd.jsbridge.BridgeHandler
import com.github.lzyzsd.jsbridge.OnBridgeCallback

/**
 * MPBridgeWebView
 *
 * 基于 happydog-intj/JsBridge 的 BridgeWebView 封装。
 * 提供统一的 JSBridge 通信能力，支持：
 * - JS 调用 Native（同步 / 异步）
 * - Native 调用 JS
 * - Handler 注册与管理
 *
 * 使用方式：
 * ```kotlin
 * val webView = MPBridgeWebView(context)
 *
 * // 注册 Native Handler 供 JS 调用
 * webView.registerBridgeHandler("getUserInfo") { data, callback ->
 *     val result = """{"name":"test","age":25}"""
 *     callback.onCallBack(result)
 * }
 *
 * // 调用 JS Handler
 * webView.callBridgeHandler("onPageReady", """{"page":"home"}""") { result ->
 *     Log.d("MPBridge", "JS returned: $result")
 * }
 *
 * webView.loadBridgeUrl("https://your-page.com")
 * ```
 */
open class MPBridgeWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : BridgeWebView(context, attrs) {

    /** 数据同步辅助器（懒加载，子类通过注解自动配置） */
    private var dataSyncHelper: MPDataSyncHelper? = null

    init {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "MPBridgeWebView initialized in debug mode")
        }
        // 设置 WebViewClient 以便自动注入桥接和处理页面加载回调
        initWebViewClient()
    }

    /**
     * 初始化 WebViewClient
     * 如果外部未自定义 WebViewClient，则使用内部的 MPBridgeWebViewClient
     * 自动处理页面加载状态通知
     */
    private fun initWebViewClient() {
        // BridgeWebView 的父类已设置 BridgeWebViewClient
        // 这里补充页面加载完成/开始的通知逻辑
        // 外部可通过 setWebViewClient 覆盖，但建议继承 MPBridgeWebViewClient
    }

    /**
     * 注册 Native Handler 供 JS 调用
     *
     * @param methodName 方法名（JS 端通过 bridge.callHandler(methodName, ...) 调用）
     * @param handler 处理函数：(data: String, callback: CallBackFunction) -> Unit
     *   - data: JS 传来的 JSON 字符串参数
     *   - callback: 调用 callback.onCallBack(result) 返回结果给 JS
     *
     * 示例：
     * ```kotlin
     * webView.registerBridgeHandler("pay") { data, callback ->
     *     val params = JSONObject(data)
     *     // 执行支付逻辑...
     *     callback.onCallBack("""{"status":"success"}""")
     * }
     * // JS 调用: bridge.callHandler("pay", {amount: 100}, function(res) { ... })
     * ```
     */
    fun registerBridgeHandler(methodName: String, handler: (String, OnBridgeCallback) -> Unit) {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "registerBridgeHandler: method=$methodName")
        }
        registerHandler(methodName ,BridgeHandler { data, function ->
            if (MPBridgeConfig.debug) {
                Log.d(MPBridgeConfig.LOG_TAG, "Handler called: method=$methodName, data=$data")
            }
            handler(data, function)

        })
    }

    /**
     * 调用 JS Handler（带回调）
     *
     * @param methodName JS 端注册的方法名
     * @param data 传递给 JS 的参数（JSON 字符串）
     * @param callback JS 返回结果的回调
     *
     * 示例：
     * ```kotlin
     * webView.callBridgeHandler("onDataUpdate", """{"key":"value"}""") { result ->
     *     Log.d("MPBridge", "JS returned: $result")
     * }
     * ```
     */
    fun callBridgeHandler(methodName: String, data: String?, callback: OnBridgeCallback?) {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "callBridgeHandler: method=$methodName, data=$data")
        }
        callHandler(methodName, data ?: "", callback)
    }

    /**
     * 调用 JS Handler（简化版，无参数）
     */
    fun callBridgeHandler(methodName: String, callback: OnBridgeCallback?) {
        callBridgeHandler(methodName, null, callback)
    }

    /**
     * 调用 JS Handler（无回调）
     */
    fun callBridgeHandler(methodName: String, data: String?) {
        callBridgeHandler(methodName, data, null)
    }

    /**
     * 加载 URL 并注入桥接
     * BridgeWebView 会自动注入 WebViewJavascriptBridge，无需额外操作
     * 自动在 URL 追加 ?platform=android 查询参数，供前端检测平台
     *
     * @param url 目标页面 URL
     */
    fun loadBridgeUrl(url: String) {
        val finalUrl = appendPlatformParam(url)
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "loadBridgeUrl: $url → $finalUrl")
        }
        // 通知数据同步辅助器页面开始加载
        getDataSyncHelper().notifyPageLoading()
        loadUrl(finalUrl)
    }

    /**
     * 在 URL 上追加 platform 查询参数
     * 如果 URL 已包含 platform 参数则不重复追加
     */
    private fun appendPlatformParam(url: String): String {
        if (url.contains("platform=")) return url
        val separator = if (url.contains("?")) "&" else "?"
        return "$url${separator}platform=android"
    }

    // ========================
    // 数据同步辅助器集成
    // ========================

    /**
     * 获取数据同步辅助器
     * 懒加载创建，通过反射读取子类注解自动配置所需数据通道
     *
     * 主模块使用方式：
     * ```kotlin
     * @NeedsUserInfo
     * @NeedsLoanInfo
     * class WebViewForLoan(context: Context, attrs: AttributeSet) : MPBridgeWebView(context, attrs)
     *
     * // 在 Activity 中
     * webView.getDataSyncHelper().setUserInfo("""{"uid":"123","ticket":"abc"}""")
     * webView.getDataSyncHelper().setLoanInfo("""{"loanId":"L001","amount":50000}""")
     * ```
     */
    fun getDataSyncHelper(): MPDataSyncHelper {
        if (dataSyncHelper == null) {
            dataSyncHelper = MPDataSyncHelper.create(this)
        }
        return dataSyncHelper!!
    }

    /**
     * 通知页面加载完成
     * 应在 WebViewClient.onPageFinished() 中调用
     * 触发数据同步辅助器推送已就绪的业务数据到前端
     */
    fun notifyPageLoaded() {
        getDataSyncHelper().notifyPageLoaded()
    }

    /**
     * 通知页面开始加载
     * 应在 WebViewClient.onPageStarted() 中调用
     * 重置数据推送状态（新页面需要重新推送）
     */
    fun notifyPageLoading() {
        getDataSyncHelper().notifyPageLoading()
    }
}

package com.sharknade.and_web_library

import android.util.Log
import com.github.lzyzsd.jsbridge.OnBridgeCallback
import org.json.JSONObject

/**
 * MPEventRouter - 跨 WebView 事件路由器
 *
 * 实现跨 WebView 的 emitter 通信：前端通过 JSBridge postToNative 方法
 * 将四级格式事件（container:scope:model:event）发送到 Native，
 * Native 根据第一级容器名路由到目标 WebView，再通过 postToWeb 转发给前端。
 *
 * 容器名映射：
 * - vip    → WebViewForVip
 * - loan   → WebViewForLoan
 * - lead   → WebViewForLead
 * - common → WebViewForCommon
 * - host   → Native 端直接消费（不转发）
 *
 * 使用方式：
 * ```kotlin
 * val eventRouter = MPEventRouter()
 *
 * // 注册各 WebView（自动注册 postToNative Handler）
 * eventRouter.registerWebView(MPEventRouter.CONTAINER_VIP, vipWebView)
 * eventRouter.registerWebView(MPEventRouter.CONTAINER_LOAN, loanWebView)
 *
 * // 监听 host 事件
 * eventRouter.onHostEvent { event, data ->
 *     Log.d("EventRouter", "Host event: $event, data: $data")
 * }
 *
 * // 页面销毁时注销
 * eventRouter.unregisterWebView(MPEventRouter.CONTAINER_VIP)
 * ```
 */
class MPEventRouter {

    companion object {
        private const val TAG = "MPEventRouter"

        /** 容器名：VIP 会员页面 */
        const val CONTAINER_VIP = "vip"

        /** 容器名：借款页面 */
        const val CONTAINER_LOAN = "loan"

        /** 容器名：线索页面 */
        const val CONTAINER_LEAD = "lead"

        /** 容器名：通用页面 */
        const val CONTAINER_COMMON = "common"

        /** 容器名：Native 端（直接消费，不转发） */
        const val CONTAINER_HOST = "host"

        /** JSBridge 方法名：前端 → Native（postToNative） */
        private const val METHOD_POST_TO_NATIVE = "postToNative"

        /** JSBridge 方法名：Native → 前端（postToWeb） */
        private const val METHOD_POST_TO_WEB = "postToWeb"
    }

    /** 容器名 → WebView 映射表 */
    private val webViews = mutableMapOf<String, MPBridgeWebView>()

    /** host 事件处理器（Native 直接消费的事件） */
    private var hostEventHandler: ((String, String?) -> Unit)? = null

    /**
     * 注册 WebView 并自动注册 postToNative Handler
     *
     * 注册后，该 WebView 内的前端调用 postToNative 时，
     * 事件会被路由到对应容器的 WebView。
     *
     * @param container 容器名（CONTAINER_VIP / CONTAINER_LOAN 等）
     * @param webView 对应的 MPBridgeWebView 实例
     */
    fun registerWebView(container: String, webView: MPBridgeWebView) {
        webViews[container] = webView
        webView.registerBridgeHandler(METHOD_POST_TO_NATIVE) { data, callback ->
            handlePostToNative(data, callback)
        }
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "$TAG: registered WebView for container=$container")
        }
    }

    /**
     * 注销 WebView（页面销毁时调用，防止内存泄漏）
     *
     * @param container 容器名
     */
    fun unregisterWebView(container: String) {
        webViews.remove(container)
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "$TAG: unregistered WebView for container=$container")
        }
    }

    /**
     * 注册 host 事件处理器
     *
     * 当第一级容器名为 "host" 时，Native 直接消费事件，
     * 调用此处理器，不转发给任何 WebView。
     *
     * @param handler 事件处理器：(event, data) -> Unit
     */
    fun onHostEvent(handler: (String, String?) -> Unit) {
        hostEventHandler = handler
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "$TAG: host event handler registered")
        }
    }

    /**
     * 处理前端 postToNative 调用
     *
     * 解析四级事件名，根据第一级容器名路由到目标 WebView：
     * - host：直接消费
     * - vip/loan/lead/common：转发到对应 WebView 的 postToWeb
     * - 非四级格式：忽略（返回错误）
     *
     * @param data JS 传来的 JSON 字符串：{"event":"vip:vipbuy:success:two","data":{...}}
     * @param callback 回调函数，返回处理结果给 JS
     */
    private fun handlePostToNative(data: String, callback: OnBridgeCallback) {
        try {
            val json = JSONObject(data)
            val event = json.optString("event", "")

            // 验证四级格式
            val parts = event.split(":")
            if (parts.size != 4 || parts.any { it.isEmpty() }) {
                Log.w(MPBridgeConfig.LOG_TAG, "$TAG: invalid event format (not 4-level): $event")
                callback.onCallBack("""{"success":false,"message":"Invalid event format: $event"}""")
                return
            }

            val container = parts[0]

            if (container == CONTAINER_HOST) {
                // host 事件：Native 直接消费
                val eventData = if (json.has("data")) json.get("data").toString() else null
                hostEventHandler?.invoke(event, eventData)
                if (MPBridgeConfig.debug) {
                    Log.d(MPBridgeConfig.LOG_TAG, "$TAG: host event consumed: $event")
                }
            } else {
                // 路由到目标 WebView
                val targetWebView = webViews[container]
                if (targetWebView != null) {
                    // 构造 postToWeb 数据：{ event, data }
                    val postJson = JSONObject()
                    postJson.put("event", event)
                    if (json.has("data")) {
                        postJson.put("data", json.get("data"))
                    }
                    targetWebView.callBridgeHandler(METHOD_POST_TO_WEB, postJson.toString(), null)
                    if (MPBridgeConfig.debug) {
                        Log.d(MPBridgeConfig.LOG_TAG, "$TAG: routed event '$event' to container=$container")
                    }
                } else {
                    Log.w(MPBridgeConfig.LOG_TAG, "$TAG: no WebView registered for container=$container")
                }
            }

            callback.onCallBack("""{"success":true}""")
        } catch (e: Exception) {
            Log.e(MPBridgeConfig.LOG_TAG, "$TAG: error handling postToNative", e)
            callback.onCallBack("""{"success":false,"message":"${e.message}"}""")
        }
    }

    /**
     * 清除所有注册（防止内存泄漏）
     * 页面完全销毁时调用
     */
    fun clear() {
        webViews.clear()
        hostEventHandler = null
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "$TAG: all registrations cleared")
        }
    }
}

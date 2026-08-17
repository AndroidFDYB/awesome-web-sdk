package com.sharknade.myapplication.webview

import android.content.Context
import android.util.AttributeSet
import com.sharknade.and_web_library.MPBridgeWebView

/**
 * 第三方页面专用 WebView
 *
 * 第三方页面不需要数据同步（无注解），
 * 仅使用基础的 JSBridge 通信能力。
 *
 * 验证点：
 * - 无注解 → getDataSyncHelper().getRequiredChannels() 返回空集
 * - notifyPageLoaded() 不会触发任何数据推送
 * - loadBridgeUrl 仍会追加 ?platform=android
 */
class WebViewForThird @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : MPBridgeWebView(context, attrs)

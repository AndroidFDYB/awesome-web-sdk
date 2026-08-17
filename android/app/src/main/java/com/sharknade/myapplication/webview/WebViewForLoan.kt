package com.sharknade.myapplication.webview

import android.content.Context
import android.util.AttributeSet
import com.sharknade.and_web_library.MPBridgeWebView
import com.sharknade.and_web_library.NeedsLoanInfo
import com.sharknade.and_web_library.NeedsUserInfo

/**
 * 借款页面专用 WebView
 *
 * 通过注解声明需要 userInfo 和 loanInfo 两个数据通道。
 * MPDataSyncHelper 会自动读取这些注解，在页面加载完成时
 * 通过 JSBridge 推送用户信息和借款信息到前端。
 *
 * 验证点：
 * - @NeedsUserInfo → DataSyncChannel.USER_INFO → callBridgeHandler("syncUserInfo", data)
 * - @NeedsLoanInfo → DataSyncChannel.LOAN_INFO → callBridgeHandler("syncLoanInfo", data)
 */
@NeedsUserInfo
@NeedsLoanInfo
class WebViewForLoan @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : MPBridgeWebView(context, attrs)

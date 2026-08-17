package com.sharknade.myapplication.webview

import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.sharknade.and_web_library.MPBridgeConfig
import com.sharknade.and_web_library.SyncState

/**
 * 数据同步验证 Activity
 *
 * 验证 Android 端 MPDataSyncHelper 的完整流程：
 *
 * 1. 创建带注解的 WebViewForLoan（@NeedsUserInfo + @NeedsLoanInfo）
 * 2. MPDataSyncHelper 通过反射读取注解，确定所需通道为 {userInfo, loanInfo}
 * 3. 加载页面（自动追加 ?platform=android）
 * 4. 页面加载完成后自动推送已就绪的数据
 *
 * 验证场景：
 * - 场景A：页面加载前设置数据 → 页面加载完成后立即推送
 * - 场景B：页面加载后设置数据 → setData 时立即推送
 */
class DataSyncDemoActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "DataSyncDemo"
    }

    private lateinit var webView: WebViewForLoan
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 开启调试日志
        MPBridgeConfig.debug = true

        // 构建简单布局：顶部按钮栏 + WebView + 状态文本
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // 按钮栏
        val buttonBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(16, 16, 16, 8)
        }

        val btnLoadPage = Button(this).apply {
            text = "加载页面（场景A：先设数据）"
            setOnClickListener { scenarioA() }
        }

        val btnPushLater = Button(this).apply {
            text = "场景B：后设数据"
            setOnClickListener { scenarioB() }
        }

        buttonBar.addView(btnLoadPage, LinearLayout.LayoutParams(
            0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
        ))
        buttonBar.addView(btnPushLater, LinearLayout.LayoutParams(
            0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
        ))

        rootLayout.addView(buttonBar)

        // 状态文本
        statusText = TextView(this).apply {
            setPadding(16, 8, 16, 8)
            text = "点击按钮开始验证"
            textSize = 12f
        }
        rootLayout.addView(statusText)

        // WebView
        webView = WebViewForLoan(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
            // 设置 WebViewClient，在页面加载完成时通知 DataSyncHelper
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    Log.d(TAG, "onPageStarted: $url")
                    webView.notifyPageLoading()
                    appendStatus("页面开始加载: $url")
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d(TAG, "onPageFinished: $url")
                    // 通知页面加载完成 → 触发 pushPendingData
                    webView.notifyPageLoaded()
                    val state = webView.getDataSyncHelper().getSyncState()
                    appendStatus("页面加载完成, syncState=$state")
                }
            }
        }
        rootLayout.addView(webView)

        setContentView(rootLayout)

        // 打印注解检测结果
        val channels = webView.getDataSyncHelper().getRequiredChannels()
        Log.i(TAG, "=== DataSyncHelper 验证 ===")
        Log.i(TAG, "WebView 类: ${webView.javaClass.simpleName}")
        Log.i(TAG, "注解检测到的所需通道: $channels")
        Log.i(TAG, "初始状态: ${webView.getDataSyncHelper().getSyncState()}")
        appendStatus("WebViewForLoan 注解检测 → 通道: $channels")
    }

    /**
     * 场景A：先设置数据，再加载页面
     * 验证「页面未加载 + 数据已就绪 → 等待页面加载完成后推送」
     */
    private fun scenarioA() {
        Log.i(TAG, "=== 场景A：先设数据，后加载页面 ===")
        appendStatus("\n--- 场景A ---")

        // 1. 设置业务数据（此时页面尚未加载）
        val userInfoJson = """{"uid":"user_001","ticket":"ticket_abc123"}"""
        val loanInfoJson = """{"loanId":"L20240001","amount":50000,"term":12}"""

        webView.getDataSyncHelper().setUserInfo(userInfoJson)
        webView.getDataSyncHelper().setLoanInfo(loanInfoJson)

        Log.i(TAG, "setUserInfo: $userInfoJson")
        Log.i(TAG, "setLoanInfo: $loanInfoJson")
        Log.i(TAG, "hasData(userInfo): ${webView.getDataSyncHelper().hasData("userInfo")}")
        Log.i(TAG, "isDataSynced(userInfo): ${webView.getDataSyncHelper().isDataSynced("userInfo")}")
        appendStatus("已设置 userInfo + loanInfo（页面未加载）")

        // 2. 加载页面 → 自动追加 ?platform=android
        //    页面加载完成后 notifyPageLoaded → pushPendingData
        webView.loadBridgeUrl("file:///android_asset/demo.html")
        appendStatus("loadBridgeUrl → 加载中...")
    }

    /**
     * 场景B：先加载页面，后设置数据
     * 验证「页面已加载 + 数据未就绪 → 等待数据到达后推送」
     */
    private fun scenarioB() {
        Log.i(TAG, "=== 场景B：先加载页面，后设数据 ===")
        appendStatus("\n--- 场景B ---")

        // 1. 加载页面（不预设数据）
        webView.loadBridgeUrl("file:///android_asset/demo.html")
        appendStatus("loadBridgeUrl → 加载中（无数据）")

        // 2. 延迟 3 秒后设置数据（模拟异步获取业务数据）
        webView.postDelayed({
            val userInfoJson = """{"uid":"user_002","ticket":"ticket_xyz789"}"""
            val loanInfoJson = """{"loanId":"L20240002","amount":100000,"term":24}"""

            Log.i(TAG, "延迟设置数据...")
            webView.getDataSyncHelper().setUserInfo(userInfoJson)
            webView.getDataSyncHelper().setLoanInfo(loanInfoJson)

            Log.i(TAG, "setUserInfo: $userInfoJson")
            Log.i(TAG, "setLoanInfo: $loanInfoJson")

            // setData 时 syncState=LOADED → 立即触发 pushPendingData
            val state = webView.getDataSyncHelper().getSyncState()
            Log.i(TAG, "setData 后 syncState=$state")
            Log.i(TAG, "isAllDataSynced: ${webView.getDataSyncHelper().isAllDataSynced()}")
            appendStatus("3秒后设置数据 → 立即推送（syncState=$state）")
        }, 3000)
    }

    private fun appendStatus(msg: String) {
        statusText.text = statusText.text.toString() + "\n" + msg
        Log.d(TAG, "STATUS: $msg")
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
}

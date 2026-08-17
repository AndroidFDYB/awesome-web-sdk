package com.sharknade.myapplication.webview

import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import com.sharknade.and_web_library.MPBridgeConfig
import com.sharknade.and_web_library.MPBridgeWebView

/**
 * 透明弹窗 Activity
 *
 * 对应 AppLink scheme 中 pageName=transparent 的场景：
 * sk://native={pageName='transparent',url='https://xxx',title='弹窗标题'}
 *
 * 职责：
 * 1. 使用透明主题（Theme.Translucent.NoTitleBar）呈现弹窗效果
 * 2. 内部包含 MPBridgeWebView 加载目标 URL
 * 3. 点击返回键或页面自行关闭即可
 *
 * 前端 H5 页面自行处理透明弹窗 UI（如半透明遮罩、关闭按钮等），
 * 本 Activity 仅提供一个全屏 WebView 容器。
 */
class TransparentWebActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "TransparentWeb"
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
    }

    private lateinit var webView: MPBridgeWebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val url = intent.getStringExtra(EXTRA_URL) ?: ""
        val title = intent.getStringExtra(EXTRA_TITLE) ?: ""

        Log.i(TAG, "onCreate: url=$url, title=$title")

        // 全屏 WebView 容器（透明主题下背景可见）
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = MPBridgeWebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    Log.d(TAG, "onPageStarted: $url")
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d(TAG, "onPageFinished: $url")
                }
            }
        }
        rootLayout.addView(webView)

        setContentView(rootLayout)

        // 加载页面
        if (url.isNotBlank()) {
            webView.loadBridgeUrl(url)
        } else {
            Log.w(TAG, "url is empty, finishing")
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
}

package com.sharknade.myapplication.webview

import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.sharknade.and_web_library.MPBridgeConfig
import com.sharknade.and_web_library.MPBridgeWebView
import com.sharknade.and_web_library.MPDataSyncHelper
import com.sharknade.and_web_library.NeedsUserInfo
import com.sharknade.and_web_library.NeedsVipInfo
import com.sharknade.and_web_library.SyncState
import com.sharknade.and_web_library.applink.AppLinkHandler
import com.sharknade.and_web_library.applink.AppLinkNavigationDelegate
import com.sharknade.and_web_library.applink.AppLinkParams
import com.sharknade.and_web_library.generated.DataSyncBindings
import com.sharknade.and_web_library.setUserInfo
import com.sharknade.and_web_library.setVipInfo

/**
 * VIP 会员页面 — AppLink + DataSync 集成验证
 *
 * 验证完整的 AppLink 跳转流程：
 *
 * 1. 组合模式：持有 MPBridgeWebView + MPDataSyncHelper + AppLinkHandler
 * 2. DataSyncHelper 推送 userInfo + vipInfo 到 H5 页面
 * 3. AppLinkHandler 注册 jump2Native，前端 H5 可通过 scheme 触发原生跳转
 * 4. AppLinkNavigationDelegate 实现：
 *    - openPage: 启动 TransparentWebActivity（弹窗）或普通页面
 *    - goBackToHome: FLAG_ACTIVITY_CLEAR_TOP 回到 MainActivity
 *
 * 使用场景：
 * - H5 页面调用 jump2Native("sk://native={pageName='transparent',url='...'}")
 *   → 启动 TransparentWebActivity
 * - H5 页面调用 jump2Native("sk://native={pageName='vip',url='...',backHome='1'}")
 *   → 打开页面 + 回首页
 */
@NeedsUserInfo
@NeedsVipInfo
class WebViewForVipActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "WebViewForVip"
    }

    private lateinit var webView: MPBridgeWebView
    private lateinit var dataSyncHelper: MPDataSyncHelper
    private lateinit var appLinkHandler: AppLinkHandler
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        MPBridgeConfig.debug = true

        // 构建布局：按钮栏 + WebView + 状态文本
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
            text = "加载 VIP 页面"
            setOnClickListener { loadVipPage() }
        }

        val btnTestScheme = Button(this).apply {
            text = "测试 jump2Native"
            setOnClickListener { testJump2Native() }
        }

        buttonBar.addView(btnLoadPage, LinearLayout.LayoutParams(
            0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
        ))
        buttonBar.addView(btnTestScheme, LinearLayout.LayoutParams(
            0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
        ))

        rootLayout.addView(buttonBar)

        // 状态文本
        statusText = TextView(this).apply {
            setPadding(16, 8, 16, 8)
            text = "WebViewForVip 就绪，点击按钮开始"
            textSize = 12f
        }
        rootLayout.addView(statusText)

        // WebView（组合模式）
        webView = MPBridgeWebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    Log.d(TAG, "onPageStarted: $url")
                    dataSyncHelper.notifyPageLoading()
                    appendStatus("页面开始加载: $url")
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d(TAG, "onPageFinished: $url")
                    dataSyncHelper.notifyPageLoaded()
                    val state = dataSyncHelper.getSyncState()
                    appendStatus("页面加载完成, syncState=$state")
                }
            }
        }
        rootLayout.addView(webView)

        setContentView(rootLayout)

        // ===== DataSync 初始化 =====
        val channels = DataSyncBindings.getChannels(this.javaClass.name)
        dataSyncHelper = MPDataSyncHelper.create(webView, channels)

        // 预设业务数据
        dataSyncHelper.setUserInfo("""{"uid":"vip_user_001","ticket":"vip_ticket_abc","nickname":"VIP会员","avatar":"https://example.com/avatar.png","level":5}""")
        dataSyncHelper.setVipInfo("""{"vipId":"VIP20240001","vipLevel":3,"expireDate":"2025-12-31","privileges":["免广告","专属客服","积分加速"]}""")

        // ===== AppLink 初始化 =====
        appLinkHandler = AppLinkHandler(webView)
        appLinkHandler.register(object : AppLinkNavigationDelegate {
            override fun openPage(params: AppLinkParams) {
                Log.i(TAG, "openPage: pageName=${params.pageName}, url=${params.url}")
                appendStatus("AppLink openPage: ${params.pageName}")

                if (params.isTransparent()) {
                    // 透明弹窗 → 启动 TransparentWebActivity
                    val intent = Intent(this@WebViewForVipActivity, TransparentWebActivity::class.java).apply {
                        putExtra(TransparentWebActivity.EXTRA_URL, params.url)
                        putExtra(TransparentWebActivity.EXTRA_TITLE, params.title)
                    }
                    startActivity(intent)
                } else {
                    // 普通页面 → 可以启动对应的 WebViewActivity
                    // 这里示例直接用 TransparentWebActivity 作为通用 WebView 容器
                    val intent = Intent(this@WebViewForVipActivity, TransparentWebActivity::class.java).apply {
                        putExtra(TransparentWebActivity.EXTRA_URL, params.url)
                        putExtra(TransparentWebActivity.EXTRA_TITLE, params.title)
                    }
                    startActivity(intent)
                }
            }

            override fun goBackToHome(excludeTop: Boolean) {
                Log.i(TAG, "goBackToHome: excludeTop=$excludeTop")
                appendStatus("AppLink goBackToHome: excludeTop=$excludeTop")

                val intent = Intent(this@WebViewForVipActivity, com.sharknade.myapplication.MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                startActivity(intent)
            }
        })

        Log.i(TAG, "=== WebViewForVip 初始化完成 ===")
        Log.i(TAG, "KSP 通道: $channels")
        Log.i(TAG, "DataSync 状态: ${dataSyncHelper.getSyncState()}")
        appendStatus("KSP 通道: $channels")
    }

    /**
     * 加载 VIP 页面
     */
    private fun loadVipPage() {
        Log.i(TAG, "=== 加载 VIP 页面 ===")
        appendStatus("\n--- 加载 VIP 页面 ---")
        webView.loadBridgeUrl("file:///android_asset/demo.html")
        appendStatus("loadBridgeUrl → 加载中...")
    }

    /**
     * 通过 JS 调用测试 jump2Native
     * 向 WebView 注入 JS 代码调用 bridge.callHandler("jump2Native", ...)
     */
    private fun testJump2Native() {
        Log.i(TAG, "=== 测试 jump2Native（JS 调用） ===")
        appendStatus("\n--- 测试 jump2Native ---")

        // 通过 JS 调用 jump2Native，模拟前端 H5 触发跳转
        val scheme = "sk://native={pageName='transparent',url='https://m.example.com/vip-popup',title='VIP弹窗'}"
        val js = """
            window.WebViewJavascriptBridge.callHandler('jump2Native', 
                JSON.stringify({scheme: "$scheme"}), 
                function(response) { console.log('jump2Native result:', response); }
            );
        """.trimIndent()

        webView.evaluateJavascript(js) { result ->
            Log.i(TAG, "evaluateJavascript result: $result")
            appendStatus("jump2Native JS 调用: $result")
        }
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

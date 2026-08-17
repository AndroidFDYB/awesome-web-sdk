package com.sharknade.and_web_library.applink

import android.util.Log
import com.github.lzyzsd.jsbridge.OnBridgeCallback
import com.sharknade.and_web_library.MPBridgeConfig
import com.sharknade.and_web_library.MPBridgeWebView
import org.json.JSONObject

/**
 * AppLink 导航委托接口
 *
 * 宿主 Activity 实现此接口来处理实际的页面导航操作，
 * SDK 只负责 scheme 解析和流程编排。
 */
interface AppLinkNavigationDelegate {
    /**
     * 打开新页面
     *
     * @param params 解析后的页面参数
     */
    fun openPage(params: AppLinkParams)

    /**
     * 回到首页
     *
     * @param excludeTop 是否排除栈顶页面（backHome 场景下，新打开的页面不应被关闭）
     */
    fun goBackToHome(excludeTop: Boolean)
}

/**
 * AppLink 页面跳转处理器
 *
 * 负责：
 * 1. 注册 jump2Native JSBridge Handler，接收前端传来的 scheme 字符串
 * 2. 解析 scheme 并根据参数执行对应的页面跳转
 * 3. 通过 AppLinkNavigationDelegate 回调将实际导航操作委托给宿主 Activity
 *
 * 跳转场景：
 * - 简单跳转：直接 delegate.openPage(params)
 * - backHome 跳转：先 delegate.openPage(params) 打开新页面，
 *   再 delegate.goBackToHome(excludeTop=true) 回到首页（排除刚打开的页面）
 *
 * 使用方式：
 * ```kotlin
 * class MyActivity : AppCompatActivity() {
 *     private lateinit var webView: MPBridgeWebView
 *     private lateinit var appLinkHandler: AppLinkHandler
 *
 *     override fun onCreate(savedInstanceState: Bundle?) {
 *         super.onCreate(savedInstanceState)
 *         webView = MPBridgeWebView(this)
 *         appLinkHandler = AppLinkHandler(webView)
 *         appLinkHandler.register(object : AppLinkNavigationDelegate {
 *             override fun openPage(params: AppLinkParams) {
 *                 startActivity(Intent(this@MyActivity, WebActivity::class.java).apply {
 *                     putExtra("url", params.url)
 *                     putExtra("title", params.title)
 *                     putExtra("pageName", params.pageName)
 *                 })
 *             }
 *             override fun goBackToHome(excludeTop: Boolean) {
 *                 val intent = Intent(this@MyActivity, HomeActivity::class.java).apply {
 *                     addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
 *                 }
 *                 startActivity(intent)
 *             }
 *         })
 *     }
 * }
 * ```
 */
class AppLinkHandler(
    private val webView: MPBridgeWebView
) {
    /** 导航委托 */
    private var delegate: AppLinkNavigationDelegate? = null

    /**
     * 注册 jump2Native Handler 并绑定导航委托
     *
     * @param delegate 导航委托实现
     */
    fun register(delegate: AppLinkNavigationDelegate) {
        this.delegate = delegate
        webView.registerBridgeHandler("jump2Native") { data, callback ->
            handleJump2Native(data, callback)
        }
        log("AppLinkHandler registered, jump2Native handler ready")
    }

    /**
     * 处理 jump2Native 调用
     */
    private fun handleJump2Native(data: String, callback: OnBridgeCallback) {
        log("jump2Native called with data=$data")

        try {
            // 从 JSON 中提取 scheme
            val json = JSONObject(data)
            val scheme = json.optString("scheme", "")

            if (scheme.isBlank()) {
                log("jump2Native failed: scheme is empty")
                callback.onCallBack("""{"code":-1,"message":"scheme is empty"}""")
                return
            }

            // 解析 scheme
            val params = AppLinkParser.parse(scheme)
            if (params == null) {
                log("jump2Native failed: cannot parse scheme=$scheme")
                callback.onCallBack("""{"code":-1,"message":"cannot parse scheme"}""")
                return
            }

            // 执行跳转
            executeNavigation(params)

            callback.onCallBack("""{"code":0,"message":"success"}""")
        } catch (e: Exception) {
            log("jump2Native exception: ${e.message}")
            callback.onCallBack("""{"code":-1,"message":"exception: ${e.message}"}""")
        }
    }

    /**
     * 执行导航逻辑
     *
     * - 简单跳转：直接 openPage
     * - backHome 跳转：先 openPage（打开新页面），再 goBackToHome（回到首页，排除新页面）
     */
    private fun executeNavigation(params: AppLinkParams) {
        val currentDelegate = delegate
        if (currentDelegate == null) {
            log("executeNavigation failed: delegate is null")
            return
        }

        log("executeNavigation: pageName=${params.pageName}, url=${params.url}, backHome=${params.backHome}")

        if (params.backHome) {
            // 先打开新页面
            currentDelegate.openPage(params)
            // 再回到首页（排除刚打开的新页面）
            currentDelegate.goBackToHome(excludeTop = true)
        } else {
            // 简单跳转
            currentDelegate.openPage(params)
        }
    }

    private fun log(msg: String) {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "[AppLink] $msg")
        }
    }
}

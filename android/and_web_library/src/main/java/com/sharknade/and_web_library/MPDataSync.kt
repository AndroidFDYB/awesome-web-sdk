package com.sharknade.and_web_library

import android.util.Log

// ========================
// 注解定义
// ========================

/**
 * 标记 WebView 子类需要 UserInfo（uid + ticket）数据同步
 *
 * 使用方式：
 * ```kotlin
 * @NeedsUserInfo
 * @NeedsLoanInfo
 * class WebViewForLoan(context: Context, attrs: AttributeSet) : MPBridgeWebView(context, attrs)
 * ```
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class NeedsUserInfo

/**
 * 标记 WebView 子类需要 LoanInfo（借款信息）数据同步
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class NeedsLoanInfo

/**
 * 标记 WebView 子类需要 VipInfo（会员信息）数据同步
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class NeedsVipInfo

/**
 * 通用数据同步注解，用于标记自定义数据通道
 *
 * @param channel 数据通道名称，如 "orderInfo"
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class NeedsDataSync(val channel: String)

// ========================
// 通道常量
// ========================

/** 标准数据通道名称 */
object DataSyncChannel {
    const val USER_INFO = "userInfo"
    const val LOAN_INFO = "loanInfo"
    const val VIP_INFO = "vipInfo"
}

/** Native → JS 推送数据时调用的 JSBridge 方法名 */
object DataSyncMethod {
    const val SYNC_USER_INFO = "syncUserInfo"
    const val SYNC_LOAN_INFO = "syncLoanInfo"
    const val SYNC_VIP_INFO = "syncVipInfo"

    /** 根据通道名获取对应的 JSBridge 方法名 */
    fun fromChannel(channel: String): String {
        return when (channel) {
            DataSyncChannel.USER_INFO -> SYNC_USER_INFO
            DataSyncChannel.LOAN_INFO -> SYNC_LOAN_INFO
            DataSyncChannel.VIP_INFO -> SYNC_VIP_INFO
            else -> "sync${channel.replaceFirstChar { it.uppercase() }}"
        }
    }
}

// ========================
// WebView 同步状态
// ========================

/** WebView 数据同步状态 */
enum class SyncState {
    /** 初始状态 */
    IDLE,
    /** 页面加载中 */
    LOADING,
    /** 页面已加载，等待或正在推送数据 */
    LOADED,
    /** 所有数据已推送完成 */
    SYNCED
}

// ========================
// 单通道状态
// ========================

/** 单个数据通道的状态 */
private data class ChannelState(
    /** 业务数据 JSON 字符串，null 表示尚未设置 */
    var data: String? = null,
    /** 是否已推送到 JS */
    var pushed: Boolean = false
)

// ========================
// MPDataSyncHelper
// ========================

/**
 * Native 端数据同步辅助器
 *
 * 通过注解自动检测 WebView 子类所需的数据通道，
 * 管理页面加载状态和各通道数据推送状态，
 * 在「页面加载完成」+「数据就绪」时自动通过 JSBridge 推送数据到前端。
 *
 * 数据推送时机：
 * 1. 页面已加载 + 数据已就绪 → 立即推送
 * 2. 页面已加载 + 数据未就绪 → 等待数据到达后推送
 * 3. 页面未加载 + 数据已就绪 → 等待页面加载完成后推送
 *
 * 使用方式：
 * ```kotlin
 * // 1. 主模块定义 WebView 子类，标注所需数据通道
 * @NeedsUserInfo
 * @NeedsLoanInfo
 * class WebViewForLoan(context: Context, attrs: AttributeSet) : MPBridgeWebView(context, attrs)
 *
 * // 2. 加载页面
 * webView.loadBridgeUrl("https://example.com/loan")
 *
 * // 3. 设置业务数据（可在页面加载前或后）
 * webView.getDataSyncHelper().setUserInfo("""{"uid":"123","ticket":"abc"}""")
 * webView.getDataSyncHelper().setLoanInfo("""{"loanId":"L001","amount":50000}""")
 *
 * // 4. 页面加载完成后通知（在 WebViewClient.onPageFinished 中调用）
 * webView.notifyPageLoaded()
 * ```
 */
class MPDataSyncHelper private constructor(
    private val webView: MPBridgeWebView
) {
    /** 通过注解检测到的所需数据通道 */
    private val requiredChannels: Set<String>

    /** 各通道状态 */
    private val channelStates: MutableMap<String, ChannelState> = mutableMapOf()

    /** 当前同步状态 */
    private var syncState: SyncState = SyncState.IDLE

    init {
        requiredChannels = readAnnotations()
        // 初始化所需通道的状态
        for (channel in requiredChannels) {
            channelStates[channel] = ChannelState()
        }
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "MPDataSyncHelper: requiredChannels=$requiredChannels")
        }
    }

    companion object {
        /** 为指定的 MPBridgeWebView 创建 DataSyncHelper */
        fun create(webView: MPBridgeWebView): MPDataSyncHelper {
            return MPDataSyncHelper(webView)
        }
    }

    /**
     * 通过反射读取 WebView 类上的注解，确定所需数据通道
     * 遍历类继承链，直到 MPBridgeWebView 为止
     */
    private fun readAnnotations(): Set<String> {
        val channels = mutableSetOf<String>()
        var clazz: Class<*>? = webView.javaClass

        while (clazz != null && clazz != MPBridgeWebView::class.java && clazz != android.webkit.WebView::class.java) {
            // 标准注解
            if (clazz.isAnnotationPresent(NeedsUserInfo::class.java)) {
                channels.add(DataSyncChannel.USER_INFO)
            }
            if (clazz.isAnnotationPresent(NeedsLoanInfo::class.java)) {
                channels.add(DataSyncChannel.LOAN_INFO)
            }
            if (clazz.isAnnotationPresent(NeedsVipInfo::class.java)) {
                channels.add(DataSyncChannel.VIP_INFO)
            }
            // 自定义通道注解
            clazz.getAnnotation(NeedsDataSync::class.java)?.let {
                channels.add(it.channel)
            }
            clazz = clazz.superclass
        }

        return channels
    }

    /** 获取所需数据通道列表 */
    fun getRequiredChannels(): Set<String> = requiredChannels.toSet()

    /** 获取当前同步状态 */
    fun getSyncState(): SyncState = syncState

    /**
     * 通知页面已加载完成
     * 应在 WebViewClient.onPageFinished() 中调用
     * 或通过 MPBridgeWebView.notifyPageLoaded() 调用
     */
    fun notifyPageLoaded() {
        if (syncState == SyncState.LOADING || syncState == SyncState.IDLE) {
            syncState = SyncState.LOADED
            if (MPBridgeConfig.debug) {
                Log.d(MPBridgeConfig.LOG_TAG, "MPDataSyncHelper: page loaded, checking pending data")
            }
            pushPendingData()
        }
    }

    /** 通知页面开始加载 */
    fun notifyPageLoading() {
        syncState = SyncState.LOADING
        // 重置推送状态（新页面需要重新推送）
        for (state in channelStates.values) {
            state.pushed = false
        }
    }

    // ========================
    // 设置业务数据
    // ========================

    /** 设置用户信息数据（uid + ticket） */
    fun setUserInfo(data: String) = setData(DataSyncChannel.USER_INFO, data)

    /** 设置借款信息数据 */
    fun setLoanInfo(data: String) = setData(DataSyncChannel.LOAN_INFO, data)

    /** 设置会员信息数据 */
    fun setVipInfo(data: String) = setData(DataSyncChannel.VIP_INFO, data)

    /**
     * 设置指定通道的业务数据
     * 如果页面已加载，会立即尝试推送
     *
     * @param channel 通道名称
     * @param data JSON 字符串
     */
    fun setData(channel: String, data: String) {
        val state = channelStates.getOrPut(channel) { ChannelState() }
        state.data = data
        state.pushed = false

        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "MPDataSyncHelper: data set for channel=$channel, pending push")
        }

        // 页面已加载则立即推送
        if (syncState == SyncState.LOADED) {
            pushPendingData()
        }
    }

    // ========================
    // 数据推送
    // ========================

    /**
     * 推送所有待推送的数据
     * 仅推送 requiredChannels 中标记为需要且数据已就绪但尚未推送的通道
     */
    private fun pushPendingData() {
        var allPushed = true

        for (channel in requiredChannels) {
            val state = channelStates[channel]
            if (state != null && state.data != null && !state.pushed) {
                val methodName = DataSyncMethod.fromChannel(channel)
                webView.callBridgeHandler(methodName, state.data)

                state.pushed = true
                if (MPBridgeConfig.debug) {
                    Log.d(MPBridgeConfig.LOG_TAG, "MPDataSyncHelper: pushed data for channel=$channel via method=$methodName")
                }
            }
            if (state == null || state.data == null || !state.pushed) {
                allPushed = false
            }
        }

        if (allPushed && requiredChannels.isNotEmpty()) {
            syncState = SyncState.SYNCED
            if (MPBridgeConfig.debug) {
                Log.d(MPBridgeConfig.LOG_TAG, "MPDataSyncHelper: all data synced!")
            }
        }
    }

    // ========================
    // 状态查询
    // ========================

    /** 检查指定通道的数据是否已推送 */
    fun isDataSynced(channel: String): Boolean {
        return channelStates[channel]?.pushed == true
    }

    /** 检查所有所需通道的数据是否已推送完成 */
    fun isAllDataSynced(): Boolean {
        if (requiredChannels.isEmpty()) return true
        return requiredChannels.all { channel ->
            channelStates[channel]?.pushed == true
        }
    }

    /** 检查指定通道的数据是否已设置 */
    fun hasData(channel: String): Boolean {
        return channelStates[channel]?.data != null
    }

    // ========================
    // 重置
    // ========================

    /**
     * 重置所有状态（加载新页面前调用）
     */
    fun reset() {
        syncState = SyncState.IDLE
        for (state in channelStates.values) {
            state.data = null
            state.pushed = false
        }
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "MPDataSyncHelper: reset")
        }
    }
}

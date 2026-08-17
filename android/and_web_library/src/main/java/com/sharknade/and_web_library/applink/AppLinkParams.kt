package com.sharknade.and_web_library.applink

/**
 * AppLink scheme 解析后的参数数据类
 *
 * 对应 scheme 格式：sk://native={pageName='vip',url='...',title='aaa',backHome='1'}
 */
data class AppLinkParams(
    /** 页面名称，如 "vip"、"transparent" */
    val pageName: String,
    /** 目标页面 URL */
    val url: String,
    /** 页面标题（可选） */
    val title: String?,
    /** 是否需要先回首页再打开 */
    val backHome: Boolean,
    /** 原始 scheme 字符串 */
    val rawScheme: String
) {
    companion object {
        /** 透明弹窗页面名 */
        const val PAGE_TRANSPARENT = "transparent"
    }

    /** 是否为透明弹窗 */
    fun isTransparent(): Boolean = pageName == PAGE_TRANSPARENT
}

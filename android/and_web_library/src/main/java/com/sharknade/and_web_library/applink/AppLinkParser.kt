package com.sharknade.and_web_library.applink

import android.util.Log
import com.sharknade.and_web_library.MPBridgeConfig

/**
 * AppLink scheme 字符串解析器
 *
 * 解析格式：sk://native={pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'}
 * 或：sk://action={pageName='vip',url='...',title='aaa',backHome='1'}
 *
 * 解析规则（三端一致）：
 * 1. 提取 scheme 前缀后的 {…} 内容
 * 2. 按 key='value' 格式解析键值对
 * 3. value 内允许包含 =、//、: 等特殊字符
 * 4. 解析失败返回 null
 */
object AppLinkParser {

    private const val LOG_TAG = "AppLinkParser"

    /** scheme 前缀 */
    private const val SCHEME_NATIVE_PREFIX = "sk://native="
    private const val SCHEME_ACTION_PREFIX = "sk://action="

    /**
     * 解析 scheme 字符串
     *
     * @param scheme 原始 scheme 字符串
     * @return 解析后的 AppLinkParams，解析失败返回 null
     */
    fun parse(scheme: String): AppLinkParams? {
        if (scheme.isBlank()) {
            log("parse failed: scheme is blank")
            return null
        }

        // 提取 {} 内容
        val content = extractContent(scheme)
        if (content == null) {
            log("parse failed: cannot extract content from scheme=$scheme")
            return null
        }

        // 解析键值对
        val params = parseKeyValuePairs(content)
        if (params.isEmpty()) {
            log("parse failed: no key-value pairs found in content=$content")
            return null
        }

        val pageName = params["pageName"]
        val url = params["url"]

        if (pageName.isNullOrBlank() || url.isNullOrBlank()) {
            log("parse failed: pageName or url is missing. pageName=$pageName, url=$url")
            return null
        }

        val backHome = params["backHome"] == "1"

        return AppLinkParams(
            pageName = pageName,
            url = url,
            title = params["title"],
            backHome = backHome,
            rawScheme = scheme
        )
    }

    /**
     * 将 sk://native={...} 转换为 sk://action={...}
     * 用于鸿蒙端将 native scheme 转换为 action scheme
     */
    fun convertToAction(scheme: String): String {
        return when {
            scheme.startsWith(SCHEME_NATIVE_PREFIX) ->
                scheme.replaceFirst(SCHEME_NATIVE_PREFIX, SCHEME_ACTION_PREFIX)
            scheme.startsWith(SCHEME_ACTION_PREFIX) -> scheme
            else -> scheme
        }
    }

    /**
     * 提取 {…} 中的内容
     */
    private fun extractContent(scheme: String): String? {
        val braceStart = scheme.indexOf('{')
        val braceEnd = scheme.lastIndexOf('}')
        if (braceStart < 0 || braceEnd < 0 || braceEnd <= braceStart) {
            return null
        }
        return scheme.substring(braceStart + 1, braceEnd)
    }

    /**
     * 解析 key='value' 格式的键值对
     *
     * 格式示例：pageName='vip',url='https://www.baidu.com',title='aaa',backHome='1'
     *
     * 解析策略：
     * - 按 key= 分割
     * - value 被单引号包裹：提取 ' 之间的内容
     * - value 无引号：取到下一个逗号为止
     */
    private fun parseKeyValuePairs(content: String): Map<String, String> {
        val result = mutableMapOf<String, String>()
        var pos = 0

        while (pos < content.length) {
            // 跳过空白和逗号
            while (pos < content.length && (content[pos] == ',' || content[pos] == ' ')) {
                pos++
            }
            if (pos >= content.length) break

            // 读取 key
            val eqIndex = content.indexOf('=', pos)
            if (eqIndex < 0) break
            val key = content.substring(pos, eqIndex).trim()
            pos = eqIndex + 1

            // 跳过空白
            while (pos < content.length && content[pos] == ' ') pos++

            if (pos >= content.length) {
                result[key] = ""
                break
            }

            // 读取 value
            val value: String
            if (content[pos] == '\'') {
                // 有引号：读取到下一个单引号
                pos++ // 跳过开头引号
                val endQuote = content.indexOf('\'', pos)
                if (endQuote < 0) {
                    // 缺少结尾引号，取剩余全部
                    value = content.substring(pos)
                    pos = content.length
                } else {
                    value = content.substring(pos, endQuote)
                    pos = endQuote + 1
                }
            } else {
                // 无引号：取到下一个逗号
                val commaIndex = content.indexOf(',', pos)
                if (commaIndex < 0) {
                    value = content.substring(pos).trim()
                    pos = content.length
                } else {
                    value = content.substring(pos, commaIndex).trim()
                    pos = commaIndex
                }
            }

            result[key] = value
        }

        return result
    }

    private fun log(msg: String) {
        if (MPBridgeConfig.debug) {
            Log.d(MPBridgeConfig.LOG_TAG, "[$LOG_TAG] $msg")
        }
    }
}

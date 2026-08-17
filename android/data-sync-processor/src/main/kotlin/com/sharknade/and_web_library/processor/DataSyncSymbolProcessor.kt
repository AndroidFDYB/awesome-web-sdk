package com.sharknade.and_web_library.processor

import com.google.devtools.ksp.processing.CodeGenerator
import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.processing.KSPLogger
import com.google.devtools.ksp.processing.Resolver
import com.google.devtools.ksp.processing.SymbolProcessor
import com.google.devtools.ksp.symbol.KSAnnotated
import com.google.devtools.ksp.symbol.KSClassDeclaration

/**
 * KSP 数据同步注解处理器
 *
 * 在编译期扫描以下注解：
 * - @NeedsUserInfo     → 通道 "userInfo"
 * - @NeedsLoanInfo     → 通道 "loanInfo"
 * - @NeedsVipInfo      → 通道 "vipInfo"
 * - @NeedsDataSync(channel) → 通道 = channel 参数值
 *
 * 生成 DataSyncBindings 注册表对象，运行时通过类名直接查表获取所需数据通道，
 * 彻底消除运行时反射开销。
 *
 * 生成代码示例：
 * ```kotlin
 * object DataSyncBindings {
 *     fun getChannels(className: String): Set<String> = when (className) {
 *         "com.example.LoanActivity" -> setOf("userInfo", "loanInfo")
 *         "com.example.VipActivity" -> setOf("userInfo", "vipInfo")
 *         else -> emptySet()
 *     }
 * }
 * ```
 */
class DataSyncSymbolProcessor(
    private val codeGenerator: CodeGenerator,
    private val logger: KSPLogger,
    @Suppress("unused") private val options: Map<String, String>
) : SymbolProcessor {

    companion object {
        private const val ANNOT_NEEDS_USER_INFO = "com.sharknade.and_web_library.NeedsUserInfo"
        private const val ANNOT_NEEDS_LOAN_INFO = "com.sharknade.and_web_library.NeedsLoanInfo"
        private const val ANNOT_NEEDS_VIP_INFO = "com.sharknade.and_web_library.NeedsVipInfo"
        private const val ANNOT_NEEDS_DATA_SYNC = "com.sharknade.and_web_library.NeedsDataSync"

        private const val CHANNEL_USER_INFO = "userInfo"
        private const val CHANNEL_LOAN_INFO = "loanInfo"
        private const val CHANNEL_VIP_INFO = "vipInfo"

        private const val GENERATED_PACKAGE = "com.sharknade.and_web_library.generated"
        private const val GENERATED_FILE_NAME = "DataSyncBindings"
    }

    /** 防止多次处理 */
    private var processed = false

    override fun process(resolver: Resolver): List<KSAnnotated> {
        if (processed) return emptyList()
        processed = true

        // className → 通道集合
        val bindings = mutableMapOf<String, MutableSet<String>>()
        val deferred = mutableListOf<KSAnnotated>()

        // 标准注解 → 固定通道
        val standardMappings = mapOf(
            ANNOT_NEEDS_USER_INFO to CHANNEL_USER_INFO,
            ANNOT_NEEDS_LOAN_INFO to CHANNEL_LOAN_INFO,
            ANNOT_NEEDS_VIP_INFO to CHANNEL_VIP_INFO
        )

        for ((annotationFqName, channel) in standardMappings) {
            resolver.getSymbolsWithAnnotation(annotationFqName).forEach { symbol ->
                if (symbol is KSClassDeclaration) {
                    val className = symbol.qualifiedName?.asString()
                    if (className != null) {
                        bindings.getOrPut(className) { mutableSetOf() }.add(channel)
                    }
                } else {
                    deferred.add(symbol)
                }
            }
        }

        // @NeedsDataSync(channel = "xxx") → 动态通道
        resolver.getSymbolsWithAnnotation(ANNOT_NEEDS_DATA_SYNC).forEach { symbol ->
            if (symbol is KSClassDeclaration) {
                val className = symbol.qualifiedName?.asString()
                if (className != null) {
                    val channel = extractChannelArg(symbol)
                    if (channel != null) {
                        bindings.getOrPut(className) { mutableSetOf() }.add(channel)
                    } else {
                        logger.warn("@NeedsDataSync on $className has no channel argument")
                    }
                }
            } else {
                deferred.add(symbol)
            }
        }

        if (bindings.isNotEmpty()) {
            generateBindingsFile(bindings)
            logger.info("DataSyncSymbolProcessor: generated ${bindings.size} bindings")
        }

        return deferred
    }

    /**
     * 从类的注解列表中提取 @NeedsDataSync 的 channel 参数值
     */
    private fun extractChannelArg(classDecl: KSClassDeclaration): String? {
        for (annotation in classDecl.annotations) {
            val typeFqName = try {
                annotation.annotationType.resolve()
                    .declaration.qualifiedName?.asString()
            } catch (e: Exception) {
                null
            }
            if (typeFqName == ANNOT_NEEDS_DATA_SYNC) {
                for (arg in annotation.arguments) {
                    if (arg.name?.asString() == "channel") {
                        return arg.value as? String
                    }
                }
            }
        }
        return null
    }

    /**
     * 生成 DataSyncBindings.kt 源文件
     */
    private fun generateBindingsFile(bindings: Map<String, Set<String>>) {
        val code = buildString {
            appendLine("package $GENERATED_PACKAGE")
            appendLine()
            appendLine("/**")
            appendLine(" * KSP 自动生成的数据同步绑定注册表")
            appendLine(" * 编译期扫描 @NeedsUserInfo / @NeedsLoanInfo / @NeedsVipInfo / @NeedsDataSync 注解")
            appendLine(" * 运行时通过类名查询所需数据通道，无需反射")
            appendLine(" */")
            appendLine("object $GENERATED_FILE_NAME {")
            appendLine("    fun getChannels(className: String): Set<String> = when (className) {")
            for ((className, channels) in bindings) {
                val channelsStr = channels.sorted().joinToString(", ") { "\"$it\"" }
                appendLine("        \"$className\" -> setOf($channelsStr)")
            }
            appendLine("        else -> emptySet()")
            appendLine("    }")
            appendLine("}")
        }

        val file = codeGenerator.createNewFile(
            dependencies = Dependencies(false),
            packageName = GENERATED_PACKAGE,
            fileName = GENERATED_FILE_NAME
        )
        file.use { stream ->
            stream.write(code.toByteArray())
        }
    }
}

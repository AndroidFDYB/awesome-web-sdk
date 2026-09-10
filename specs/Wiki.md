# MP-SDK Wiki — 架构变更记录

> 本文档记录 MP-SDK 项目的架构演进、关键决策与变更历史，便于团队成员快速了解设计背景。

---

## 2025-08 架构重构：组合模式 + KSP 注入 + 鸿蒙原生 Web

### 背景

原有架构中，Android 端采用 **继承模式**（`MPBridgeWebView` 声明为 `open class`，业务方继承后在子类上标注 `@NeedsUserInfo` 等注解，运行时反射读取），存在以下问题：

1. `open class` 破坏了封装性，业务方可以覆盖 SDK 内部方法
2. 运行时反射有性能开销，且在混淆/裁剪环境下可能失效
3. 鸿蒙端 `MPBridgeWeb` 封装组件隐藏了原生 `Web` 组件细节，灵活性差

### 变更内容

#### Android 端：禁止继承，改用组合 + KSP 编译期注入

**核心改动：**

| 项目 | 变更前 | 变更后 |
|------|--------|--------|
| `MPBridgeWebView` | `open class`，可被继承 | `class`（final），禁止继承 |
| 数据同步集成 | 内置于 `MPBridgeWebView`（`getDataSyncHelper()` 等） | 移除，由 Activity 组合持有 `MPDataSyncHelper` |
| 通道检测 | 运行时反射读取注解 | KSP 编译期扫描注解，生成 `DataSyncBindings` 注册表 |
| `MPDataSyncHelper` 构造 | `create(webView: MPBridgeWebView)` 内部反射 | `create(webView: BridgeWebView, channels: Set<String>)` 构造注入 |
| 业务使用方式 | 继承 `MPBridgeWebView` 标注注解 | Activity 持有 `MPBridgeWebView` + `MPDataSyncHelper`，通过 `DataSyncBindings.getChannels()` 查表 |

**新增模块：`data-sync-processor`**

- 纯 Kotlin/JVM 模块，不依赖 Android SDK
- 实现 `SymbolProcessor` 接口，编译期扫描四种注解
- 通过 SPI（`META-INF/services/...SymbolProcessorProvider`）自动注册
- 生成 `DataSyncBindings.kt`：类全限定名 → 通道集合的 `when` 表达式

**关键文件：**

| 文件 | 说明 |
|------|------|
| `android/data-sync-processor/build.gradle.kts` | KSP 模块构建配置 |
| `android/data-sync-processor/.../DataSyncSymbolProcessor.kt` | 核心处理器，`resolver.getSymbolsWithAnnotation()` 扫描注解 |
| `android/data-sync-processor/.../DataSyncSymbolProcessorProvider.kt` | KSP Provider |
| `android/data-sync-processor/.../META-INF/services/...SymbolProcessorProvider` | SPI 注册文件 |

**构建配置变更：**

| 文件 | 变更 |
|------|------|
| `gradle/libs.versions.toml` | 新增 `ksp = "2.2.10-2.0.2"` 版本和插件声明 |
| `settings.gradle.kts` | 新增 `include(":data-sync-processor")` |
| `app/build.gradle.kts` | 新增 `alias(libs.plugins.ksp)` + `ksp(project(":data-sync-processor"))` |
| `gradle.properties` | 新增 `android.disallowKotlinSourceSets=false`（KSP 兼容 AGP 9.x 内置 Kotlin） |

**KSP 生成示例：**

```kotlin
// 由 data-sync-processor 自动生成
object DataSyncBindings {
    fun getChannels(className: String): Set<String> = when (className) {
        "com.sharknade.myapplication.webview.DataSyncDemoActivity" -> setOf("loanInfo", "userInfo")
        else -> emptySet()
    }
}
```

#### 鸿蒙端：原生 Web 组件 + 工具注入

**核心改动：**

| 项目 | 变更前 | 变更后 |
|------|--------|--------|
| 页面组件 | `MPBridgeWeb` 封装组件 | 原生 `Web` 组件 |
| 桥接逻辑 | 内置于 `MPBridgeWeb` | 提取为 `BridgeUtils` 静态工具类 |
| javaScriptProxy | 内联在 `MPBridgeWeb` 中 | 提取为 `DsBridgeProxy` 独立导出类 |
| 平台参数 | `MPBridgeWeb` 内部处理 | `BridgeUtils.appendPlatformParam()` |
| JS 注入 | `MPBridgeWeb` 内部处理 | `BridgeUtils.injectBridgeJs()` |

**新增文件：**

| 文件 | 说明 |
|------|------|
| `hm/hm_web_library/src/main/ets/bridge/DsBridgeProxy.ets` | `javaScriptProxy` 注入对象，实现 `call`/`callAsync`/`hasMethod`/`onNativeCallComplete` |
| `hm/hm_web_library/src/main/ets/bridge/BridgeUtils.ets` | 静态工具类，`appendPlatformParam` + `injectBridgeJs` |

**导出变更：**

`hm/hm_web_library/Index.ets` 新增导出：
```typescript
export { DsBridgeProxy } from './src/main/ets/bridge/DsBridgeProxy';
export { BridgeUtils } from './src/main/ets/bridge/BridgeUtils';
```

**`MPBridgeWeb` 保留为可选便捷组件**，内部委托给 `BridgeUtils` 和 `DsBridgeProxy`，不再包含内联逻辑。

### 技术决策与理由

#### 为什么选择 KSP 而非 KAPT？

- KAPT 不支持增量编译，且依赖 Java 注解处理（APT），性能差
- KSP 是 Kotlin 原生的符号处理 API，支持增量编译
- KSP2 模式下支持 K2 编译器，与 AGP 9.x 内置 Kotlin 2.2.10 兼容

#### 为什么 `data-sync-processor` 用纯 Kotlin/JVM 模块？

- KSP 处理器不需要 Android 运行时，纯 JVM 模块足够
- 纯 JVM 模块构建更快，依赖更少
- 避免与 AGP 内置 Kotlin 插件冲突

#### 为什么 `MPBridgeWebView` 改为 final？

- 防止业务方覆盖 `registerBridgeHandler` / `callBridgeHandler` 等核心方法
- 数据同步逻辑不再内置于 WebView，降低类职责
- Activity 通过组合方式持有 WebView，更灵活

### AGP 9.x + KSP 兼容性

AGP 9.0.1 内置 Kotlin 2.2.10 编译器，与 KSP 集成时遇到以下问题及解决方案：

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `Cannot add extension with name 'kotlin'` | AGP 9.x 已内置 Kotlin 插件，不能重复应用 `kotlin-android` | 不应用 `kotlin-android`，使用 AGP 内置 |
| `ksp-2.0.21-1.0.27 is too old for kotlin-2.2.10` | KSP 版本不匹配 Kotlin 编译器 | 使用 `2.2.10-2.0.2`（KSP2 格式：`{kotlin-version}-2.0.{patch}`） |
| `Using kotlin.sourceSets DSL is not allowed` | AGP 9.x 内置 Kotlin 不允许 KSP 使用 sourceSets DSL | `gradle.properties` 添加 `android.disallowKotlinSourceSets=false` |
| `plugin already on classpath with unknown version` | Kotlin JVM 插件已在全局 classpath | `id("org.jetbrains.kotlin.jvm")` 不带版本号 |
| `Inconsistent JVM-target: compileJava(11) vs compileKotlin(21)` | Java 和 Kotlin JVM target 不一致 | 统一使用 `JavaVersion.VERSION_21` |
| `Resolution of configuration was attempted without an exclusive lock` | Gradle 9.x 禁止执行阶段直接解析其他项目 runtimeClasspath | 在消费方创建 resolvable configuration + `dependencies` 声明引用（详见 Design.md §2.12） |

### 删除的文件

| 文件 | 原因 |
|------|------|
| `android/app/.../WebViewForLoan.kt` | 继承模式子类，已被组合模式 Activity 替代 |
| `android/app/.../WebViewForVip.kt` | 同上 |
| `android/app/.../WebViewForThird.kt` | 同上 |

### 验证结果

- ✅ Android 编译成功（`BUILD SUCCESSFUL`），KSP 正确生成 `DataSyncBindings.kt`
- ✅ 鸿蒙编译成功（`BUILD SUCCESSFUL`，`CompileArkTS` 通过）
- ✅ 三端代码全部就位

---

## 2026-08 流程改进：集成测试验证阶段补齐

### 背景

在修复鸿蒙构建问题（生成代码缺少 import + `DataSyncSetters` 调用不存在的 `setData`）时发现：**SubAgent 完成代码修改后直接标记任务完成，未执行构建命令验证修改是否正确**。导致错误代码进入下一阶段，增加了调试成本。

### 问题

| 问题 | 影响 |
|------|------|
| 代码修改后未执行构建验证 | 错误代码流入下游任务，串联失败 |
| 缺少“开发完成”的统一标准 | SubAgent 主观判断完成状态，不可靠 |
| 缺少 shell 执行的强制要求 | 生成代码缺少 import 等编译期问题未被发现 |

### 改进措施

1. **新增集成测试验证标准**（Design.md §8.5）：每次代码变更后必须执行构建命令
2. **强化 Harness Phase 4**（harness.md）：Test SubAgent 必须实际执行 shell 命令验证
3. **新增交付标准约束**（constraints.md）：未通过构建验证的任务不允许标记完成
4. **DAG 任务验收标准补充**（proposal.md）：每个任务的验收标准包含构建命令执行

### 核心原则

> **代码修改未通过构建验证不算完成。** SubAgent 完成代码变更后，必须执行对应的构建命令，确认 `BUILD SUCCESSFUL` 后才能回传任务完成状态。

### 设计模式对照

```
变更前（继承模式）：
  Activity
    └── WebViewForLoan extends MPBridgeWebView
          └── @NeedsUserInfo @NeedsLoanInfo
          └── 运行时反射读取注解 → 确定通道
          └── getDataSyncHelper() 内置懒加载

变更后（组合模式 + KSP）：
  @NeedsUserInfo @NeedsLoanInfo
  Activity
    ├── MPBridgeWebView (final, 组合持有)
    ├── MPDataSyncHelper (create(webView, channels) 构造注入)
    └── DataSyncBindings.getChannels(class.name) (KSP 编译期生成)
```

---

## 2026-09 iOS 平台纳入规范体系（四端化）

### 背景

iOS Objective-C SDK（`ios/ios_web_library/`）于 2026-08 完整落地（Bridge / AppLink / Emitter / DataSync 四模块与鸿蒙端行为对齐，`build:ios` 构建链与 CocoaPods 分发就绪），但规范体系仍停留在“三端”表述——iOS 是已实现却未被规范覆盖的活行为。

### 变更（OpenSpec 变更 add-ios-platform，逆向轨追认）

- 主规范四端化：bridge（平台自动检测 + URL 平台参数注入增补 iOS 场景）、codegen（纯命名约定推导 + 生成物可重建）、build（统一构建入口 + 产物形态 zip 源码包 + macOS 环境前置）、data-sync（通道唯一真相源 + 集成方扩展通道）
- Purpose 段与全工程文档统一：config.yaml / AGENTS.md / harness.md / README.md / Design.md 的“三端”表述统一为四端
- 平台是场景维度而非能力维度：不新建 ios 能力域；applink / emitter 的 Requirement 平台中立（“Native 端”），iOS 实现（.overFullScreen modal 透明弹窗 + __weak 回调注册表）满足现有语义

### 设计原则

- 逆向轨追认：实现已存在时，规范以既有可观察行为为准追认，不改动代码
- iOS 分发形态为源码包（zip + podspec），与 AAR / HAR / TGZ 并列成为第四种产物形态
- Windows 环境无法执行 build:ios（macOS 工具链前置），以构建链存在性核验替代；真机构建验证属后续代码变更的义务

### 后续修正（2026-09，add-ci-build-pipeline）

上述“macOS 环境前置”与“Windows 环境无法执行 build:ios”两项判断当时未经实跑验证，已被 CI 实证否证：`build:ios` 为纯 Node 流程（codegen + 源码完整性校验 + 打包），已在 Windows 本机与 ubuntu-latest runner 上双双构建成功。主规范「环境前置要求」相应修正为“iOS 构建 MUST NOT 依赖 macOS 工具链”；仅可选的编译验证（`pod lib lint`）需 macOS + Xcode + CocoaPods。本节上文作为历史记录保留不改。

---

## 2026-09 CI 自动化构建流水线（四 job 并行）

### 背景

代码托管至 GitHub 后，构建验证仍完全依赖开发者本机工具链：`build:all` 为串联脚本（一端失败后续全停），鸿蒙构建绑定本机 DevEco Studio 路径，产物无统一的可获取入口。

### 变更（OpenSpec 变更 add-ci-build-pipeline）

- 新增 `.github/workflows/build.yml`：`web` / `ios` / `android` 三个 job 各自产出制品（TGZ / zip / AAR），`harmony-codegen` 仅校验 ArkTS 生成物；四 job 互不声明 `needs`，单端失败不阻断其余端
- Android 构建入口跨平台化：新增 `scripts/build-android.js` 按 `process.platform` 选择 wrapper，消除 `build:android` 硬编码 `gradlew.bat`（该硬编码违反 build 主规范既有的跨平台约束）；`android/gradlew` 索引模式修正为 `100755`
- `build-ios.js` 的 `createZip` 改为“按平台排序候选工具 + 产物魔数校验”，消除 Linux 上 GNU tar 静默产出错格式归档的风险
- 主规范 build 域：跨平台约束双向化（Windows 本地 + Linux CI）、新增「CI 自动化构建」Requirement、修正被实证否证的 iOS macOS 前置断言

### 设计原则

- CI 与本地执行同一 `npm run build:*` 入口，不在 workflow 内另建命令分叉
- 降级校验须自述边界：`harmony-codegen` 的绿灯不代表 HAR 可构建
- 防假绿优先于便利：构建前清空本端 `output/` 子目录 + `if-no-files-found: error`，因仓库内存在已入库的历史产物

---

## 2026-09 iOS CocoaPods 私有 spec repo 发布

### 背景

CI 流水线在每次 push to main 时运行，产出可下载的制品（zip / aar / tgz），iOS 消费者需手动下载 zip 并以 `:path =>` 方式集成——这不是 CocoaPods 的标准体验。同时日常 push 频繁触发四端 CI，成本高且多数时候不需要。

### 变更（OpenSpec 变更 add-ios-cocoapods-publish）

- CI 触发条件从 `push to main` 改为 `push tags: v*`（保留 `workflow_dispatch`），日常 push 不再触发 CI
- podspec `s.source` 从 `{ :path => '.' }` 改为 `{ :git => '...', :tag => s.version.to_s }`，支持远程 `pod install`
- 新增 `publish-ios` job：依赖 ios job 成功，校验 podspec 版本号与 git tag 一致后，通过纯 git 命令将 podspec 推送至私有 spec repo（`AndroidFDYB/Specs`）
- 发布流程在 ubuntu runner 上完成，不引入 macOS / CocoaPods 依赖
- 消费者体验从"下载 zip + `:path =>` 集成"变为"`pod repo add` + `pod install` 标准流程"

### 设计决策

| Design.md 章节 | 决策 |
|----------------|------|
| 2.16 | 合并 build + publish 到同一 workflow（避免跨 workflow 依赖复杂度） |
| 2.17 | 纯 git 命令实现 spec repo push（零额外依赖，不需要 CocoaPods gem） |
| 2.18 | CI 触发条件改为 tag-only（"构建 = 发版"语义） |
| 2.19 | podspec s.source 改为 git + tag（本地 `:path =>` 不受影响） |

### 新增基础设施

- 私有 spec repo `AndroidFDYB/Specs`（GitHub Private 仓库）
- GitHub Secret `SPEC_REPO_TOKEN`（PAT Classic，仅 `repo` scope）

### 风险与缓解

- 日常 push 不再 CI 验证 → `workflow_dispatch` 保留手动触发能力
- `SPEC_REPO_TOKEN` 泄露风险 → 最小权限 PAT（仅 repo scope），仅 tag push 注入 publish job
- podspec 版本号与 tag 不一致 → CI 显式校验，不匹配则 fail fast

---

## 2026-09 多 registry 统一发布（GitHub Packages：Android Maven + Web npm）

### 背景

iOS 线建立「tag 触发 → CI 构建 → fail-fast 校验 → 私有 spec repo 发布」模式后，Android（AAR）与 Web（npm）消费者仍需从 CI Artifacts 手动下载制品安装。本变更将该模式推广至两端，发布目标统一为 GitHub Packages（托管平台内置私有 registry，Maven + npm 双 registry）。

### 变更（OpenSpec 变更 add-multi-registry-publish）

- Web 线：npm 包改名 `@mp-sdk/bridge` → `@androidfdyb/bridge`（GitHub Packages scope = owner 硬约束，BREAKING）；移除 `file:../specs/proto-codegen` 发布炸雷依赖（构建期工具，产物已 bundle）；`publishConfig` 指向 `npm.pkg.github.com`
- Android 线：`library` / `and_web_library` 两模块接入 maven-publish，双坐标 `com.sharknade:jsbridge` + `com.sharknade:and-web-library`；后者 POM 经 `pom.withXml` 把 `project(:library)` 依赖改写为同版本 Maven 坐标；版本由 tag 经 `-Pversion` 注入（源码不硬编码，本地缺省 `0.0.0-SNAPSHOT`）
- CI 线：workflow permissions 扩 `packages: write`；新增 `publish-web` / `publish-android` job，与既有 `publish-ios` 并列（各 `needs` 对应 build job，GITHUB_TOKEN 认证零新增 secret）
- 消费者体验：Android 从「下载 AAR 手动导入」变为「settings.gradle 仓库配置 + 一行 `implementation` 依赖」；Web 从「下载 tgz」变为「`.npmrc` + `npm install`」

### 设计决策

| Design.md 章节 | 决策 |
|----------------|------|
| 2.20 | 私有 registry 选型 GitHub Packages（双 registry；GITHUB_TOKEN 发布 / PAT `read:packages` 消费） |
| 2.21 | Android 双坐标 + POM 依赖改写（含 sourceReleaseJar 隐式依赖实施注记） |
| 2.22 | tag 驱动 `-Pversion` 版本注入（源码不硬编码版本） |
| 2.23 | npm 包改名 `@androidfdyb/bridge` + `file:` 依赖清理（BREAKING） |

### 风险与缓解

- GitHub Packages 已发布版本不可覆盖删除 → 「tag 即最终版本」纪律：发布前 fail-fast 校验，测试迭代用一次性版本号（v0.1.0 验证期 npm 0.1.0 已占坑，即以 bump 0.1.1 重发处置）
- 双坐标给消费者引入隐式 jsbridge 依赖 → POM `compile` scope 传递依赖可 override；README 集成文档显式列出两坐标
- npm 包改名破坏性变更 → README BREAKING 标注；旧 tgz 手动安装路径不受影响
- 发布失败连带影响 → build 与 publish 双层失败隔离，单端发布失败不影响其余端发布

---

## 历史架构决策索引

| 日期 | 主题 | Design.md 章节 |
|------|------|----------------|
| 初始 | Android JsBridge 选型 | 2.1 |
| 初始 | 鸿蒙 JSBridge 实现 | 2.2 |
| 初始 | 前端 SDK 零依赖设计 | 2.3 |
| 初始 | 构建脚本跨平台 | 2.4 |
| 初始 | AGP 9.x 适配 | 2.5 |
| 2025-08 | Android 组合模式 + KSP 编译期注入 | 2.6 |
| 2025-08 | 鸿蒙原生 Web 组件 + 工具注入 | 2.7 |
| 2026-08 | Gradle 9.x 跨项目 JavaExec 配置解析独占锁修复 | 2.12 |
| 2026-08 | Kotlin 扩展函数显式导入规范 | 2.13 |
| 2026-08 | 集成测试验证阶段补齐（开发完成标准） | 8.5 |
| 2026-09 | iOS 平台纳入规范体系（四端化，逆向轨追认） | 1 / 2.8 |
| 2026-09 | CI 流水线拓扑（四 job 并行 + 鸿蒙降级校验） | 2.14 |
| 2026-09 | 构建脚本的 CI 兼容性（跨平台双向约束） | 2.15 / 8.7 |
| 2026-09 | 合并 build + publish 到同一 workflow | 2.16 |
| 2026-09 | 纯 git 命令实现 spec repo push | 2.17 |
| 2026-09 | CI 触发条件改为 tag-only | 2.18 |
| 2026-09 | podspec s.source 改为 git + tag | 2.19 |
| 2026-09 | 私有 registry 选型：GitHub Packages（Maven + npm 双 registry） | 2.20 |
| 2026-09 | Android 双坐标 + POM 依赖改写 | 2.21 |
| 2026-09 | tag 驱动 -Pversion 版本注入 | 2.22 |
| 2026-09 | npm 包改名 @androidfdyb/bridge + file: 依赖清理 | 2.23 |

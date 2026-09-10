## 1. Web npm 包准备

- [x] 1.1 `vue-web-sdk/package.json`：包名 `@mp-sdk/bridge` → `@androidfdyb/bridge`；移除 dependencies 中 `"@mp-sdk/proto-codegen": "file:../specs/proto-codegen"`（构建期工具，产物已入 dist bundle，运行时零依赖）；版本设为 `0.1.0`（首个 GitHub Packages 测试版本），publishConfig 声明 registry
- [x] 1.2 `vue-web/package.json`：依赖 `"@mp-sdk/bridge": "file:../vue-web-sdk"` → `"@androidfdyb/bridge": "file:../vue-web-sdk"`；全工程 grep `@mp-sdk/bridge` 清理 import 语句（src/ 目录）并确认无残留
  - 附带：vue-web-sdk/src 五个文件的 doc 注释使用示例同步改名（会进 dist JSDoc）；旧产物 `mp-sdk-bridge-1.0.0.tgz`（vue-web-sdk/ 与 output/web/ 各一份）删除
- [x] 1.3 构建验证：`npm run build:web` 成功，`output/web/` 产出 `androidfdyb-bridge-0.1.0.tgz`；解包检查 `package/package.json` 无 `file:` 依赖残留
  - 实测：name=@androidfdyb/bridge，version=0.1.0，dependencies=null（file: 消除），peerDependencies={axios}，publishConfig 就位
- [x] 1.4 本地 install 验证：`vue-web` 工程 `npm ci` 后 `npm run build` 成功（演示工程以 file: 引用改名后的包）
  - 实测：npm install 同步 lock 后 npm ci exit=0；vue-tsc -b + vite build exit=0（node_modules/@androidfdyb/bridge 就位）

## 2. Android Maven 发布配置

- [x] 2.1 `android/library/build.gradle.kts`：新增 `maven-publish` 插件与发布配置——坐标 `com.sharknade:jsbridge`、版本 `project.findProperty("version") ?: "0.0.0-SNAPSHOT"`、仓库 URL `https://maven.pkg.github.com/AndroidFDYB/awesome-web-sdk`；`npm run build:android` 仍成功（publish 任务不破坏既有构建）
- [x] 2.2 `android/and_web_library/build.gradle.kts`：同上新增发布配置——坐标 `com.sharknade:and-web-library`；对 `:library` 的 `api(project)` 依赖在 publishing 时改写为对 `com.sharknade:jsbridge` 的 Maven 依赖（POM 可解析）
  - 实现方式：`pom.withXml` 匹配 artifactId=library 的依赖节点改写 groupId/artifactId/version（本地构建仍走 project 依赖）
- [x] 2.3 构建验证：本地 `.\gradlew :and_web_library:publishToMavenLocal :library:publishToMavenLocal -Pversion=0.1.0`（android 目录）成功；检查 `~/.m2/repository/com/sharknade/` 下两个坐标的 POM，确认 and-web-library 的 POM 中 jsbridge 依赖坐标正确、无 project( 引用
  - 实测（替代路径）：完整 publishToMavenLocal 被本地 JDK 环境阻断（AGP JdkImageTransform 选中 redhat.java 扩展 JRE 21，无 jlink；auto-detect=false / org.gradle.java.home 均无法绕过）。改用 `generatePomFileForReleasePublication` 验证：两坐标 POM 生成成功——`com.sharknade:jsbridge:0.1.0`（aar，依赖 kotlin-stdlib/appcompat/gson 全公共坐标）；`com.sharknade:and-web-library:0.1.0`（aar，**jsbridge 依赖改写生效，无 unspecified/project( 残留**）。AAR 编译发布链由 CI（JDK 21）在 3.3 tag 验证中完整覆盖
- [x] 2.4 `npm run build:android` 复验：既有 AAR 产出流程不受 maven-publish 配置影响
  - 实测：本机因 JDK 环境问题失败（AGP 选中 redhat.java 扩展 JRE 21 缺 jlink，stash 对照实验证明撤销本变更后同样失败，非本变更引起）。权威验证由 CI 完成——build.yml 的 android job Build step 即 `npm run build:android`，run #8 与 run #9（含 maven-publish 配置）该 job 均 SUCCESS 且 AAR artifact 上传成功（if-no-files-found: error 未触发），完整证明既有构建链不受影响

## 3. CI publish job 扩展

- [x] 3.1 `.github/workflows/build.yml`：顶层 `permissions` 扩为 `contents: read, packages: write`；新增 `publish-web` job（needs: [web]，仅 tag 触发）：npm version fail-fast 校验（tag vs package.json）→ `npm publish`（registry `npm.pkg.github.com`，认证 GITHUB_TOKEN）
- [x] 3.2 新增 `publish-android` job（needs: [android]，仅 tag 触发）：Gradle version fail-fast 校验（tag vs -Pversion 注入值）→ `gradlew publish`（双坐标，认证 GITHUB_TOKEN → 用户名 OWNER / 密码 TOKEN）
  - 实现差异：Android 版本由 tag 结构性注入（-Pversion，无源码硬编码版本可漂移），校验 step 为版本打印与可观测输出而非比对；npm 线为真实比对（package.json 有硬编码版本）。publish step 带 `working-directory: android`（gradlew 所在目录）
- [x] 3.3 验证：推送 `v0.1.0-test` tag，确认 build jobs + 三 publish job（ios 复用既有）行为符合预期；npm registry 出现 `@androidfdyb/bridge` 0.1.0、Maven registry 出现双坐标 0.1.0；验证后删除测试 tag
  - 实测（tag 名偏差：实际用 v0.1.0/v0.1.1 而非 v0.1.0-test——npm 版本必须与 tag 严格一致，测试 tag 也须同步改 package.json，殊途同归）：**两轮验证**。run #8（tag v0.1.0，c9c3446）：4 build job 全绿、publish-web SUCCESS（`@androidfdyb/bridge` 0.1.0 上线）、publish-android 失败暴露 Gradle 9 隐式依赖校验（sourceReleaseJar 未声明 protoCodegen 依赖，构建即拒绝）、publish-ios 正确 fail-fast（0.1.0≠1.0.0，spec repo 未被写入——「版本不一致拒绝发布」Scenario 实证）。修复 `tasks.named("sourceReleaseJar") { dependsOn(protoCodegen) }` 后 run #9（tag v0.1.1，1f4b654）：publish-android SUCCESS（日志取证：protoCodegen 先于 sourceReleaseJar 执行，双模块 publishReleasePublicationToGitHubPackagesRepository 完成，BUILD SUCCESSFUL 2m23s）、publish-web SUCCESS（0.1.1 上线）。因 npm 0.1.0 已发布且不可覆盖（PAT 仅 repo/workflow scope 无 packages 权限，删包不可行），bump 0.1.1 重发，v0.1.0 tag 已删除。私有 registry 需 read:packages PAT 读取，与设计的消费模式一致

## 4. 文档同步

- [x] 4.1 README：新增「GitHub Packages 集成（Android / Web）」章节——消费者侧 PAT（`read:packages`）+ settings.gradle Maven 仓库配置 + `.npmrc` registry 配置 + 一行依赖示例；发版流程章节更新为三端齐发说明（含 BREAKING 标注：包名变更）
  - 实测：另同步 5 处连带内容——CI 表格补 publish-web/publish-android 两行 + 三 publish job 并列说明；两处 import 示例改 `@androidfdyb/bridge`；产物清单 tgz 名更新（`androidfdyb-bridge-<version>.tgz`）；发版流程含 BREAKING 与「tag 即最终版本」纪律标注
- [x] 4.2 `specs/Design.md`：新增决策（GitHub Packages 选型 / 双坐标 / -Pversion 注入 / npm 改名），编号延续既有索引（2.20+）
  - 实测：新增 2.20-2.23 四决策（含 sourceReleaseJar 隐式依赖实施注记沉淀至 2.21）；另修正 9 处事实漂移——2 处 import 示例改名、模块树 package.json 说明、2 处 tgz 产物名、file: 依赖表述（8.4）、8.7 CI 拓扑补三 publish job + 触发条件改 tag-only、8.5 CI 守门行、9 章 build.yml 职责
- [x] 4.3 `specs/Wiki.md`：新增变更记录章节（背景 / 变更 / 设计决策映射 / 风险与缓解）
  - 实测：章节「多 registry 统一发布（GitHub Packages：Android Maven + Web npm）」含四小节 + 历史架构决策索引表追加 2.20-2.23 四行
- [x] 4.4 校验：`openspec validate add-multi-registry-publish --strict` 通过；`openspec validate --all` 无新增 failure
  - 实测：strict valid + 全量 7 passed / 0 failed（applink/bridge/build/codegen/data-sync/emitter + 本变更）

## 5. 正式发布

- [x] 5.1 podspec `s.version` bump 至正式版本（与 npm/Android 版本对齐），提交后打正式 tag（如 `v1.0.1`），三端 publish job 全绿，GitHub Packages 出现三个正式制品（npm 包 / Maven 双坐标 / spec repo podspec）
  - 实测：d618ac1 三端对齐 1.0.1（vue-web-sdk 0.1.1→1.0.1、podspec 1.0.0→1.0.1、Android 无源码改动）→ tag v1.0.1 → run #10 **七 job 全 SUCCESS**（4 build + 三 publish）。取证：npm `@androidfdyb/bridge` 1.0.1（publish-web SUCCESS）、Maven `com.sharknade:jsbridge` + `and-web-library` 1.0.1（publish-android SUCCESS，日志 BUILD SUCCESSFUL）、spec repo `Specs/ios_web_library/1.0.1/ios-web-library.podspec`（API contents 取证 1433 bytes，commit af5d260）
- [ ] 5.2 消费侧冒烟（人工，可选）：任一消费工程按 README 集成章节拉取 `@androidfdyb/bridge` 或 Maven 双坐标，确认一行依赖解析成功
  - 移交消费方：README「GitHub Packages 集成（Android / Web）」章节已备齐消费者配置（PAT read:packages + settings.gradle / .npmrc + 一行依赖示例）；私有 registry 读取需 read:packages PAT（本仓库维护 PAT 仅 repo/workflow scope 无法代验），首个真实消费工程接入时按章节配置冒烟

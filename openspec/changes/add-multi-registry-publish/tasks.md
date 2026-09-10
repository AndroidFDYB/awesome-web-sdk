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
- [ ] 2.4 `npm run build:android` 复验：既有 AAR 产出流程不受 maven-publish 配置影响
  - 本地环境 blocker：本机 `npm run build:android` 因 JDK 环境问题失败（AGP 选中 redhat JRE 21 缺 jlink）。stash 对照实验证明**撤销本变更改动后同样失败**（失败点在 `:library:compileReleaseJavaWithJavac` 的 androidJdkImage transform，与 publishing 配置无关）。权威验证移交 3.3 的 CI tag 验证（run #7 模式下 android job 全绿）；建议本地安装 JDK 21 恢复本地构建能力

## 3. CI publish job 扩展

- [x] 3.1 `.github/workflows/build.yml`：顶层 `permissions` 扩为 `contents: read, packages: write`；新增 `publish-web` job（needs: [web]，仅 tag 触发）：npm version fail-fast 校验（tag vs package.json）→ `npm publish`（registry `npm.pkg.github.com`，认证 GITHUB_TOKEN）
- [x] 3.2 新增 `publish-android` job（needs: [android]，仅 tag 触发）：Gradle version fail-fast 校验（tag vs -Pversion 注入值）→ `gradlew publish`（双坐标，认证 GITHUB_TOKEN → 用户名 OWNER / 密码 TOKEN）
  - 实现差异：Android 版本由 tag 结构性注入（-Pversion，无源码硬编码版本可漂移），校验 step 为版本打印与可观测输出而非比对；npm 线为真实比对（package.json 有硬编码版本）。publish step 带 `working-directory: android`（gradlew 所在目录）
- [ ] 3.3 验证：推送 `v0.1.0-test` tag，确认 build jobs + 三 publish job（ios 复用既有）行为符合预期；npm registry 出现 `@androidfdyb/bridge` 0.1.0、Maven registry 出现双坐标 0.1.0；验证后删除测试 tag

## 4. 文档同步

- [ ] 4.1 README：新增「GitHub Packages 集成（Android / Web）」章节——消费者侧 PAT（`read:packages`）+ settings.gradle Maven 仓库配置 + `.npmrc` registry 配置 + 一行依赖示例；发版流程章节更新为三端齐发说明（含 BREAKING 标注：包名变更）
- [ ] 4.2 `specs/Design.md`：新增决策（GitHub Packages 选型 / 双坐标 / -Pversion 注入 / npm 改名），编号延续既有索引（2.20+）
- [ ] 4.3 `specs/Wiki.md`：新增变更记录章节（背景 / 变更 / 设计决策映射 / 风险与缓解）
- [ ] 4.4 校验：`openspec validate add-multi-registry-publish --strict` 通过；`openspec validate --all` 无新增 failure

## 5. 正式发布

- [ ] 5.1 podspec `s.version` bump 至正式版本（与 npm/Android 版本对齐），提交后打正式 tag（如 `v1.0.1`），三端 publish job 全绿，GitHub Packages 出现三个正式制品（npm 包 / Maven 双坐标 / spec repo podspec）
- [ ] 5.2 消费侧冒烟（人工，可选）：任一消费工程按 README 集成章节拉取 `@androidfdyb/bridge` 或 Maven 双坐标，确认一行依赖解析成功

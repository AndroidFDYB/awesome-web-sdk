## Why

iOS SDK 已通过私有 CocoaPods spec repo 实现「git tag 触发 CI 自动发布 + 消费者一行集成」，而 Android（AAR）与 Web（npm 包）仍依赖 CI 制品手动下载安装，集成体验与 iOS 不对等。将同一发布模型推广至这两端，使三端消费者都获得「一处 tag、一行依赖」的统一体验。

## What Changes

- Android 双坐标发布至 GitHub Packages (Maven)：`com.sharknade:and-web-library`（主 SDK）与 `com.sharknade:jsbridge`（其依赖的本地库，Maven 消费需独立坐标），消费者经 settings.gradle 凭证配置后 `implementation` 一行集成
- Web 包改名并发布至 GitHub Packages (npm)：`@mp-sdk/bridge` → `@androidfdyb/bridge`（GitHub Packages 硬性要求 scope = owner 且小写），消费者经 `.npmrc` 凭证配置后 `npm install` 一行集成
- 发布侧认证复用 workflow 内置 `GITHUB_TOKEN`（`packages: write`），不新增 secret；发布目标即本仓库 packages，与 iOS 线的跨仓库 PAT 模式解耦
- CI 新增 `publish-android` 与 `publish-web` job（依赖对应 build job 成功，仅 tag 触发执行），与现有 `publish-ios` 并列
- 版本治理扩展为「一处 tag 驱动三端版本」：发布前 fail-fast 校验 tag 与 Android Gradle version、npm package.json version 一致（iOS podspec 校验已存在）
- npm 包清理 `file:` 依赖：`@mp-sdk/proto-codegen` 从 dependencies 移除（其为构建期工具，产物已进入 dist bundle，运行时零依赖），否则发布后消费者安装必然失败
- README 新增 Android / Web 的 GitHub Packages 集成指南（消费者侧 PAT `read:packages` + 仓库配置）

### 不在范围内

- 鸿蒙 HAR 的远程分发（沿用本地 TGZ/HAR 手动安装；HarmonyOS 生态无私有 ohpm registry 可对应 GitHub Packages）
- iOS 发布链路改造（add-ios-cocoapods-publish 已完成并归档，本变更不触碰）
- 发布到公共仓库（Maven Central / npmjs.com）：项目标注 Proprietary，仅内部分发
- 消费侧工程的自动化验证（无现成消费方仓库可托管验证 job）

## Capabilities

### New Capabilities

- `build/publish`: 三端 SDK 私有 registry 发布体系——GitHub Packages (Maven/npm) 的发布契约、版本一致性校验、发布侧零 secret 认证、消费者集成认证

### Modified Capabilities

（无——`build` capability 的 CI 构建契约不受影响，发布契约由新增 capability 单独承载）

## Impact

- **构建脚本**：`vue-web-sdk/package.json`（改名 + 版本 + 依赖清理）、`vue-web`（import 语句随包名）、Android `and_web_library`/`library` 两个 `build.gradle.kts`（新增 maven-publish 配置与版本注入）
- **CI**：`.github/workflows/build.yml` 新增两个 publish job + `permissions: packages: write`
- **文档**：README（集成指南 + 发版流程）、specs/Design.md（新决策）、specs/Wiki.md（变更记录）
- **消费者**：Android 需 settings.gradle 配置 GitHub Packages Maven repo 与凭证；Web 需项目 `.npmrc` 配置 registry 与 token；两者均需自己的 `read:packages` PAT
- **破坏性**：Web 包名变更（`@mp-sdk/bridge` → `@androidfdyb/bridge`），现有 `file:`/TGZ 引用方需同步调整 import 路径；本仓库 vue-web 演示工程同步修改

## Why

当前 CI 流水线在每次 push to main 时运行，产出可下载的制品（zip / aar / tgz），iOS 消费者需手动下载 zip 并以 `:path =>` 方式集成——这不是 CocoaPods 的标准体验。项目需要：
1. iOS SDK 通过私有 CocoaPods spec repo 分发，消费者只需 `pod 'ios_web_library'` 一行集成
2. CI 从"每次 push 都跑"改为"手动打 tag 才跑"，减少无意义的 CI 执行

## Scope

### 范围内

- CI 触发条件：从 `push to main` 改为 `push tags: v*`（保留 `workflow_dispatch`）
- iOS podspec `s.source`：从 `{ :path => '.' }` 改为 `{ :git => '...', :tag => s.version.to_s }`
- CI 新增 `publish-ios` job：iOS 构建成功后，将 podspec 推送至私有 spec repo
- 私有 spec repo 仓库创建与 GitHub Secret 配置说明
- README / Design.md 文档同步

### 不在范围内

- Android AAR 发布到 Maven 仓库
- Web TGZ 发布到 npm registry
- 二进制 `.xcframework` 编译（需 macOS runner，成本过高）
- 版本号自动管理（开发者手动修改 podspec `s.version`）
- `pod lib lint` 编译验证（仍需 macOS 本地执行）

## What Changes

- **CI 触发模型变更**：`build.yml` 的 `on.push.branches: [main]` 改为 `on.push.tags: ['v*']`；日常 push 不再触发 CI，仅 tag push 和 `workflow_dispatch` 触发
- **新增 publish-ios job**：依赖 ios job 成功，校验 podspec 版本号与 git tag 一致后，通过纯 git 命令将 podspec 推送到私有 spec repo（不需要 macOS/CocoaPods）
- **podspec s.source 变更**：`{ :path => '.' }` → `{ :git => 'https://github.com/AndroidFDYB/awesome-web-sdk.git', :tag => s.version.to_s }`；本地开发仍可通过 Podfile 的 `:path =>` 覆盖
- **新增基础设施**：私有 spec repo `AndroidFDYB/Specs` + GitHub Secret `SPEC_REPO_TOKEN`
- **消费者体验升级**：从"下载 zip + `:path =>` 集成"变为"`pod repo add` + `pod install` 标准流程"

## Capabilities

### New Capabilities

（无新增能力域）

### Modified Capabilities

- `build`：MODIFIED「CI 自动化构建」触发条件（push to main → tag-only）+ ADDED「iOS CocoaPods 发布」Requirement（私有 spec repo 发布行为）

## Impact

| 影响项 | 说明 |
|--------|------|
| `.github/workflows/build.yml` | trigger 改 tags；新增 publish-ios job |
| `ios/ios_web_library/ios-web-library.podspec` | s.source 从 :path 改为 :git + :tag |
| `README.md` | CI 章节（触发条件）、iOS 集成章节（pod repo add + pod install） |
| `specs/Design.md` | 新增 CocoaPods 发布设计决策 |
| `specs/Wiki.md` | 新增变更记录 |
| 基础设施 | 创建 `AndroidFDYB/Specs` 私有仓库 + SDK 仓库添加 `SPEC_REPO_TOKEN` Secret |

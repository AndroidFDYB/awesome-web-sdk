## 1. 基础设施准备（手动操作）

- [x] 1.1 在 GitHub 创建私有仓库 `AndroidFDYB/Specs`（空仓库，初始化 README），确认仓库可见性为 Private
- [x] 1.2 创建 PAT（Classic）并授予 `repo` scope，记录 token 值
- [x] 1.3 在 SDK 仓库 Settings → Secrets → Actions 中添加 Secret `SPEC_REPO_TOKEN`，值为 1.2 的 token

## 2. podspec 修改

- [x] 2.1 修改 `ios/ios_web_library/ios-web-library.podspec` 的 `s.source`：从 `{ :path => '.' }` 改为 `{ :git => 'https://github.com/AndroidFDYB/awesome-web-sdk.git', :tag => s.version.to_s }`
- [x] 2.2 验证：`npm run build:ios` 构建成功，zip 产物中包含修改后的 podspec（解压检查 `s.source` 字段）

## 3. CI workflow 修改

- [x] 3.1 修改 `.github/workflows/build.yml` 触发条件：`on.push.branches: [main]` 改为 `on.push.tags: ['v*']`
- [x] 3.2 在 `build.yml` 中新增 `publish-ios` job：`needs: [ios]`，`if: startsWith(github.ref, 'refs/tags/v')`，包含版本校验 + git clone spec repo + cp podspec + commit + push 步骤
- [ ] 3.3 验证：推送一个测试 tag（如 `v0.0.0-test`），确认四端构建 + publish-ios 按预期执行；验证后删除测试 tag

## 4. 文档同步

- [x] 4.1 更新 `README.md`：CI 章节改为 tag 触发说明；iOS 集成章节新增 `pod repo add` + `pod install` 标准流程；发版流程章节（git tag + push --tags）
- [x] 4.2 更新 `specs/Design.md`：新增 CocoaPods 发布设计决策（决策 5-8），同步至架构决策索引
- [x] 4.3 更新 `specs/Wiki.md`：新增 `add-ios-cocoapods-publish` 变更记录章节
- [x] 4.4 验证：`openspec validate add-ios-cocoapods-publish --strict` 通过；`openspec validate --all` 无新增 failure

## 5. 基础设施收尾确认

- [ ] 5.1 确认 spec repo 中已出现 `Specs/ios_web_library/<version>/ios-web-library.podspec`
- [ ] 5.2 在消费方 App 的 Podfile 中测试 `pod 'ios_web_library', '~> 1.0'`（需先 `pod repo add`），确认 `pod install` 成功拉取源码

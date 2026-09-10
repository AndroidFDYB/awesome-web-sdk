## Context

当前 `build.yml` 在每次 push to main 时触发四端并行构建，产出可下载制品（AAR / TGZ / zip / codegen 校验）。iOS 产物为源码 zip，消费者需手动下载并以 `:path =>` 方式集成。

podspec 的 `s.source` 当前为 `{ :path => '.' }`，仅支持本地开发引用，不支持远程 `pod install`。

详见 proposal.md — Why。

## Goals / Non-Goals

**Goals:**
- iOS SDK 通过私有 CocoaPods spec repo 分发，消费者体验 `pod 'ios_web_library', '~> 1.0'`
- CI 仅由版本标签触发，减少无意义的日常 CI 执行
- 发布流程在 ubuntu runner 上完成，不引入 macOS runner 依赖

**Non-Goals:**
- 不为 Android / Web / 鸿蒙 建立分发渠道
- 不实现版本号自动递增
- 不编译二进制 `.xcframework`

## Decisions

### 决策 1：合并 build + publish 到同一 workflow

**选择**：在现有 `build.yml` 上新增 `publish-ios` job，而非创建独立的 `publish.yml`。

**理由**：
- 同一 tag push 触发，逻辑上是一次完整操作（构建 + 发布）
- `publish-ios` 声明 `needs: [ios]`，确保 iOS 构建成功后才发布
- 避免两个 workflow 并行运行同一组构建步骤的浪费

**被否备选**：

| 备选 | 否否决理由 |
|------|------------|
| 独立 `publish.yml` | 同一 tag 触发时两个 workflow 并行跑，iOS 构建执行两次；跨 workflow 依赖（`workflow_run`）配置复杂且有时序风险 |
| publish 作为 ios job 的最后一个 step | 混合关注点：ios job 职责是构建验证，publish 是发布；publish 失败不应导致构建 job 整体回滚 |

### 决策 2：纯 git 命令实现 spec repo push

**选择**：`git clone` spec repo → `mkdir` 版本目录 → `cp` podspec → `git commit && push`。

**理由**：
- `pod repo push` 需要安装 CocoaPods gem（Ruby 依赖），在 ubuntu 上虽可安装但增加环境复杂度
- 纯 git 命令零额外依赖，runner 原生支持
- `pod repo push` 的本质就是上述 git 操作 + podspec 校验；校验已由 ios job 的 codegen + 源文件完整性检查覆盖

**被否备选**：

| 备选 | 否决理由 |
|------|----------|
| `pod repo push`（安装 CocoaPods gem） | 引入 Ruby 工具链依赖；ubuntu runner 上 `pod spec lint --quick` 无法做编译校验（需 Xcode），等于只做语法检查，价值有限 |
| `pod trunk push`（公共源） | 项目为内部项目（Proprietary），不可发布到公共 CocoaPods trunk |

### 决策 3：CI 触发条件改为 tag-only

**选择**：`on.push.tags: ['v*']`，去掉 `on.push.branches: [main]`。

**理由**：
- 日常开发 push 频繁，每次都跑四端 CI 成本高且多数时候不需要
- 版本发布是低频操作，tag 触发更符合"构建 = 发版"的语义
- `workflow_dispatch` 保留，可随时手动触发验证

**被否备选**：

| 备选 | 否决理由 |
|------|----------|
| 混合触发（branches + tags） | 日常 push 仍触发 CI，与"减少无意义执行"的目标矛盾；publish job 需额外 `if` 条件区分 tag / branch 触发 |
| 仅 `workflow_dispatch` | 失去 tag 语义，发版与 git 历史脱钩 |

### 决策 4：podspec s.source 改为 git + tag

**选择**：`s.source = { :git => 'https://github.com/AndroidFDYB/awesome-web-sdk.git', :tag => s.version.to_s }`。

**理由**：
- CocoaPods 从 spec repo 解析 podspec 后，按 `s.source` 的 `:git + :tag` 从 SDK 仓库 clone 对应版本源码
- 本地开发 Podfile 中以 `:path =>` 引用时，`:path` 覆盖 `s.source`，不受影响
- `s.version.to_s` 确保 tag 名与版本号自动对齐，无需手动同步两处

## Risks / Trade-offs

- **[日常 push 不再 CI 验证]** → `workflow_dispatch` 保留手动触发能力；开发者可在 PR 阶段本地验证，tag 发版时 CI 兜底。
- **[SPEC_REPO_TOKEN 泄露风险]** → 使用最小权限 PAT（仅 repo scope）；Secret 仅在 tag push 时注入 publish job，build job 不接触。
- **[podspec 版本号与 tag 不一致]** → CI 显式校验 `tag version == podspec version`，不匹配则 fail fast，不写入 spec repo。
- **[spec repo 不存在或 token 无权限]** → publish job 的 `git clone` 会失败，流水线整体标记为失败；需在实施前手动创建 spec repo 并配置 Secret。
- **[Secret 仓库归属易错（实施实测踩中）]** → GitHub Actions 的 secret 仅对 workflow 所在仓库可见，误加到 `Specs` 仓库时被静默替换为空串、`git clone` 以 exit code 128 失败。已加空值防御（报 `SPEC_REPO_TOKEN is empty`）并在 README「维护者：发布基础设施配置」章节固化仓库归属说明。
- **[版本提取的单行假设（实施实测踩中）]** → 本变更把 `s.source` 改为 `:tag => s.version.to_s` 后，`grep "s.version"` 会命中两行使提取值变多行。已改为 sed 锚定行首的 `s.version` 赋值行匹配 + 空值防御，教训是「修改 podspec 时须同步审视 CI 中所有对该文件的文本提取逻辑」。

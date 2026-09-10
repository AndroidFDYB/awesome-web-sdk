## MODIFIED Requirements

### Requirement: CI 自动化构建
源码托管平台 SHALL 提供无人工干预的自动化构建流水线：流水线 MUST 由版本标签（tag）推送触发，而非每次代码推送；Android、前端、iOS 三端 MUST 各自独立并行构建并产出可下载的制品；鸿蒙端 MUST 至少完成代码生成物的产出校验；任一端构建失败 MUST NOT 阻断其他端制品的产出与获取；流水线执行结果与失败原因 MUST 对提交者可观测。

#### Scenario: 三端制品自动产出
- GIVEN 版本标签已推送至托管仓库
- WHEN 流水线被触发并执行完成
- THEN Android、前端、iOS 三端各自产出制品
- AND 制品可被下载，内容与该标签对应的源码状态一致

#### Scenario: 单端失败隔离
- GIVEN 某一端构建失败
- WHEN 流水线执行完成
- THEN 其余端的制品仍成功产出并可获取
- AND 失败端输出明确的错误信息，流水线整体状态标记为失败

#### Scenario: 鸿蒙生成物降级校验
- GIVEN 流水线运行环境缺少鸿蒙编译工具链
- WHEN 执行鸿蒙校验作业
- THEN 鸿蒙代码生成物成功产出
- AND 作业不因编译工具链缺失而失败

#### Scenario: 手动触发构建
- GIVEN 需要为当前分支重新产出制品
- WHEN 由提交者手动触发流水线
- THEN 流水线按相同流程执行并产出三端制品

## ADDED Requirements

### Requirement: iOS CocoaPods 发布
iOS SDK SHALL 通过私有 CocoaPods spec repo 进行版本发布：流水线在 iOS 构建成功后 MUST 将 podspec 推送至私有 spec repo；podspec 版本号 MUST 与触发的 git tag 版本号一致，不一致时 MUST 发布失败；发布过程 MUST NOT 依赖 macOS 工具链或 CocoaPods 本地安装。

#### Scenario: 版本标签触发的成功发布
- GIVEN iOS 构建成功且 podspec 版本号与 git tag 一致
- WHEN 流水线执行发布步骤
- THEN podspec 被推送至私有 spec repo 的对应版本目录
- AND 消费者可通过 `pod install` 从 spec repo 拉取该版本

#### Scenario: 版本号不一致时拒绝发布
- GIVEN git tag 版本号与 podspec 中声明的版本号不一致
- WHEN 流水线执行发布步骤
- THEN 发布步骤失败并输出明确的版本不匹配错误
- AND 私有 spec repo 不被修改

#### Scenario: 本地开发不受发布流程影响
- GIVEN 消费者 Podfile 中以 `:path =>` 方式引用本地 SDK
- WHEN 执行 `pod install`
- THEN CocoaPods 使用本地路径，忽略 podspec 中的远程 source 配置

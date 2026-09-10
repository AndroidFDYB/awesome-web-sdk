## Purpose

定义 Android 与 Web SDK 经 GitHub Packages（Maven / npm）私有发布的完整行为契约：发布触发、版本一致性校验、发布侧与消费侧认证、消费者一行集成，使三端（含既有 iOS CocoaPods 线）统一为「一处 tag、一行依赖」的分发模型。

## ADDED Requirements

### Requirement: Android 双坐标 Maven 发布
Android SDK SHALL 以两个 Maven 坐标发布至私有 registry：主 SDK 坐标 MUST 声明对桥接基础库坐标的传递依赖；发布产物 MUST 含 AAR 与可解析的 POM；本地工程依赖 MUST NOT 出现在对外发布的依赖声明中。

#### Scenario: 版本标签触发的成功发布
- GIVEN Android 构建成功且版本号与触发标签一致
- WHEN 流水线执行发布作业
- THEN 主 SDK 坐标与桥接基础库坐标均发布至私有 registry 的对应版本
- AND 消费者拉取主 SDK 坐标时自动解析传递依赖

#### Scenario: 本地工程依赖在对外发布中可解析
- GIVEN 消费者按主 SDK 坐标声明一行依赖
- WHEN 解析依赖树
- THEN 桥接基础库从同一私有 registry 解析成功
- AND 不出现指向本地路径或内部工程名的不可解析坐标

#### Scenario: 版本号不一致时拒绝发布
- GIVEN 触发标签的版本号与 Android 构建声明的版本号不一致
- WHEN 流水线执行发布前校验
- THEN 发布作业失败并输出明确的版本不匹配错误
- AND 私有 registry 不被写入

### Requirement: Web npm 包私有发布
Web SDK SHALL 以 npm scoped 包形式发布至私有 registry：包名 scope MUST 与 registry 所属 owner 一致（scope 强制小写）；发布产物 MUST NOT 携带本地路径形式的依赖声明；发布过程 MUST NOT 依赖公共 registry 账号。

#### Scenario: 版本标签触发的成功发布
- GIVEN Web 构建成功且包版本号与触发标签一致
- WHEN 流水线执行发布作业
- THEN 包发布至私有 npm registry 的对应 scope
- AND 消费者配置 registry 凭证后可按版本安装

#### Scenario: 包依赖不携带本地路径
- GIVEN 发布产物已生成
- WHEN 检查包内依赖声明
- THEN 所有运行时依赖均可从公开 registry 解析
- AND 不存在本地路径（file: 协议）形式的依赖

#### Scenario: 版本号不一致时拒绝发布
- GIVEN 触发标签的版本号与包声明的版本号不一致
- WHEN 流水线执行发布前校验
- THEN 发布作业失败并输出明确的版本不匹配错误
- AND 私有 registry 不被写入

### Requirement: 发布侧零 secret 认证
发布至托管平台私有 registry 时，流水线 SHALL 使用托管平台内置的工作流令牌认证，MUST NOT 要求为发布动作单独配置长期凭证；工作流令牌 MUST 具备私有 registry 的写入权限，且权限范围 MUST 限制在托管仓库自身。

#### Scenario: 未配置任何发布凭证时发布成功
- GIVEN 仓库未配置任何发布相关 secret
- WHEN 由版本标签触发发布作业
- THEN 认证由内置工作流令牌完成，发布成功

#### Scenario: 工作流令牌权限不足时明确失败
- GIVEN 工作流令牌缺少私有 registry 写入权限
- WHEN 执行发布作业
- THEN 发布失败并输出权限不足的错误
- AND 失败原因对提交者可观测

### Requirement: 消费者一行集成
三端消费者 SHALL 各自以一行依赖声明完成 SDK 集成：Android 消费者 MUST 经构建工具凭证配置拉取 Maven 坐标；Web 消费者 MUST 经 registry 配置文件拉取 npm 包；集成文档 MUST 说明消费侧所需的最小权限凭证及其配置位置。

#### Scenario: Android 一行依赖集成
- GIVEN 消费者工程已配置私有 Maven 仓库与读取凭证
- WHEN 在构建脚本声明主 SDK 坐标并同步依赖
- THEN 主 SDK 与传递依赖的桥接基础库均成功解析
- AND 无需手动下载制品文件

#### Scenario: Web 一行依赖集成
- GIVEN 消费者工程已配置私有 npm registry 与读取凭证
- WHEN 安装 scoped 包
- THEN 包及其运行时依赖成功安装
- AND 无需手动下载制品文件

#### Scenario: 凭证缺失时给出可行动的指引
- GIVEN 消费者未配置读取凭证
- WHEN 尝试拉取私有包
- THEN 拉取失败且错误信息指向集成文档的凭证配置章节

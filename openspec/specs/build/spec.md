# Build 构建体系规范

## Purpose

定义四端 SDK 的统一构建入口、产物形态、验证标准与自动化构建流水线的行为契约：npm scripts 统一编排、构建产物输出、跨端环境要求、源码托管平台的无人工干预构建。构建是"开发完成"的唯一判定标准。

## Requirements

### Requirement: 统一构建入口
四端构建 SHALL 统一由根目录 package.json 的 npm scripts 编排，构建脚本 MUST 使用跨平台 Node.js 语法，MUST NOT 使用 PowerShell 专有命令，MUST NOT 硬编码单一操作系统专有的可执行入口；构建命令 MUST 在 Windows 本地开发环境与 Linux CI 环境中均可执行。

#### Scenario: 全量构建
- GIVEN 四端构建环境就绪
- WHEN 执行全量构建命令
- THEN Android、鸿蒙、前端、iOS SDK 依次构建完成
- AND 全部产物输出到统一产物目录

#### Scenario: 单端构建
- GIVEN 仅需更新某一端产物
- WHEN 执行对应端的单端构建命令
- THEN 仅该端执行构建并输出产物
- AND 其他端不受影响

#### Scenario: 构建脚本跨平台
- GIVEN 构建脚本在 Windows 环境执行
- WHEN 触发任一构建命令
- THEN 脚本正常执行，不因 shell 差异失败

#### Scenario: 构建脚本在 Linux CI 环境执行
- GIVEN 构建脚本在 Linux 环境执行（CI runner）
- WHEN 触发 Android、前端、iOS 任一端构建命令
- THEN 脚本正常执行，不因可执行入口的平台差异或文件权限而失败
- AND 产物输出到与本地构建一致的统一产物目录

#### Scenario: iOS 单端构建
- GIVEN iOS 构建环境就绪（Node.js 运行时可用）
- WHEN 执行 iOS 单端构建命令
- THEN 先生成 Objective-C 产物，再完成源码完整性校验与产物打包
- AND 打包产物输出到统一产物目录

### Requirement: 构建产物形态
构建产物 SHALL 输出至统一的产物目录并保持稳定命名：Android 为 AAR、鸿蒙为 HAR、前端为 TGZ（双模块格式）、iOS 为源码包（zip，含 CocoaPods podspec）。

#### Scenario: 产物齐全
- GIVEN 全量构建成功
- WHEN 检查产物目录
- THEN 四端产物文件均存在且命名符合约定

#### Scenario: iOS 产物可集成
- GIVEN iOS 源码包已解压
- WHEN 集成方按 CocoaPods 源码 pod 方式引入
- THEN podspec 描述的源文件与资源全部可被解析
- AND SDK 功能可用

### Requirement: 环境前置要求
构建体系 SHALL 明确各端环境前置要求，鸿蒙构建 MUST 依赖开发工具路径环境变量；iOS 构建 MUST NOT 依赖 macOS 工具链（其产物为源码包，构建过程无编译步骤）；环境缺失时构建 MUST 给出明确的失败提示而非静默跳过。

#### Scenario: 鸿蒙环境变量缺失
- GIVEN 未配置鸿蒙开发工具路径环境变量
- WHEN 执行鸿蒙构建
- THEN 构建失败并提示所需的环境变量

#### Scenario: iOS 在非 macOS 环境构建
- GIVEN 构建环境缺少 macOS 工具链（Linux CI runner 或 Windows 开发机）
- WHEN 执行 iOS 构建
- THEN 构建成功并产出源码包
- AND 源码完整性校验通过

#### Scenario: 环境齐全时构建
- GIVEN 各端环境变量与工具链就绪
- WHEN 执行全量构建
- THEN 四端均构建成功

### Requirement: 构建验证完成标准
任何代码变更 SHALL 在标记完成前通过对应端的实际构建验证，构建输出 MUST 出现明确的成功标志；仅凭静态推断 MUST NOT 作为完成依据。

#### Scenario: 变更后验证
- GIVEN 某端源码发生变更
- WHEN 执行该端构建命令
- THEN 构建输出包含成功标志
- AND 对应任务方可标记完成

#### Scenario: 构建失败阻止完成
- GIVEN 某端构建失败
- WHEN 尝试标记对应任务完成
- THEN 该任务不允许被标记为完成

### Requirement: CI 自动化构建
源码托管平台 SHALL 提供无人工干预的自动化构建流水线：Android、前端、iOS 三端 MUST 各自独立并行构建并产出可下载的制品；鸿蒙端 MUST 至少完成代码生成物的产出校验；任一端构建失败 MUST NOT 阻断其他端制品的产出与获取；流水线执行结果与失败原因 MUST 对提交者可观测。

#### Scenario: 三端制品自动产出
- GIVEN 源码变更已推送至托管仓库
- WHEN 流水线被触发并执行完成
- THEN Android、前端、iOS 三端各自产出制品
- AND 制品可被下载，内容与该次提交的源码状态对应

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

## MODIFIED Requirements

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
- GIVEN iOS 构建环境就绪（macOS + Xcode + CocoaPods）
- WHEN 执行 iOS 单端构建命令
- THEN 先生成 Objective-C 产物，再完成源码完整性校验与产物打包
- AND 打包产物输出到统一产物目录

## ADDED Requirements

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

# Delta for Build

## MODIFIED Requirements

### Requirement: 统一构建入口
四端构建 SHALL 统一由根目录 package.json 的 npm scripts 编排，构建脚本 MUST 使用跨平台 Node.js 语法，MUST NOT 使用 PowerShell 专有命令。

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

#### Scenario: iOS 单端构建
- GIVEN iOS 构建环境就绪（macOS + Xcode + CocoaPods）
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
构建体系 SHALL 明确各端环境前置要求，鸿蒙构建 MUST 依赖开发工具路径环境变量，iOS 构建 MUST 依赖 macOS 工具链；缺失时构建 MUST 给出明确的失败提示而非静默跳过。

#### Scenario: 鸿蒙环境变量缺失
- GIVEN 未配置鸿蒙开发工具路径环境变量
- WHEN 执行鸿蒙构建
- THEN 构建失败并提示所需的环境变量

#### Scenario: iOS 在非 macOS 环境构建
- GIVEN 构建环境缺少 macOS 工具链
- WHEN 执行 iOS 构建
- THEN 构建失败并给出明确的平台限制提示

#### Scenario: 环境齐全时构建
- GIVEN 各端环境变量与工具链就绪
- WHEN 执行全量构建
- THEN 四端均构建成功

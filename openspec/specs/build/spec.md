# Build 构建体系规范

## Purpose

定义三端 SDK 的统一构建入口、产物形态与验证标准的行为契约：npm scripts 统一编排、构建产物输出、跨端环境要求。构建是"开发完成"的唯一判定标准。

## Requirements

### Requirement: 统一构建入口
三端构建 SHALL 统一由根目录 package.json 的 npm scripts 编排，构建脚本 MUST 使用跨平台 Node.js 语法，MUST NOT 使用 PowerShell 专有命令。

#### Scenario: 全量构建
- GIVEN 三端构建环境就绪
- WHEN 执行全量构建命令
- THEN Android、鸿蒙、前端 SDK 依次构建完成
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

### Requirement: 构建产物形态
构建产物 SHALL 输出至统一的产物目录并保持稳定命名：Android 为 AAR、鸿蒙为 HAR、前端为 TGZ（双模块格式）。

#### Scenario: 产物齐全
- GIVEN 全量构建成功
- WHEN 检查产物目录
- THEN 三端产物文件均存在且命名符合约定

### Requirement: 环境前置要求
构建体系 SHALL 明确各端环境前置要求，鸿蒙构建 MUST 依赖开发工具路径环境变量，缺失时构建 MUST 给出明确的失败提示而非静默跳过。

#### Scenario: 鸿蒙环境变量缺失
- GIVEN 未配置鸿蒙开发工具路径环境变量
- WHEN 执行鸿蒙构建
- THEN 构建失败并提示所需的环境变量

#### Scenario: 环境齐全时构建
- GIVEN 各端环境变量与工具链就绪
- WHEN 执行全量构建
- THEN 三端均构建成功

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

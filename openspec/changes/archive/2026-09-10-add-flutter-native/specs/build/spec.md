## MODIFIED Requirements

### Requirement: 统一构建入口
五端构建 SHALL 统一由根目录 package.json 的 npm scripts 编排，构建脚本 MUST 使用跨平台 Node.js 语法，MUST NOT 使用 PowerShell 专有命令，MUST NOT 硬编码单一操作系统专有的可执行入口；构建命令 MUST 在 Windows 本地开发环境与 Linux CI 环境中均可执行。Flutter 端构建命令仅用于本地开发验证，MUST NOT 纳入 CI 自动化流水线。

#### Scenario: 全量构建
- GIVEN 五端构建环境就绪
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

#### Scenario: Flutter 单端构建
- GIVEN Flutter 开发环境就绪（Flutter SDK 可用）
- WHEN 执行 Flutter 单端构建命令
- THEN 先执行 Proto Codegen 生成 Dart 产物
- AND 再执行 Dart 静态分析与依赖解析
- AND 构建结果在本地可验证
- AND 该命令不纳入 CI 自动化流水线

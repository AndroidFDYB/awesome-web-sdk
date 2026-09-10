# Codegen 代码生成规范

## Purpose

定义从 Proto 真相源到五端（Android / Web / 鸿蒙 / iOS / Flutter）生成物 derivation 规则的行为契约：命名推导、生成物形态、Proto 语法子集约束与传输编码。Codegen 保证"一处定义、五端一致"，是 SDK 横向扩展能力的根基。

## Requirements

### Requirement: 纯命名约定推导
五端（Android / Web / 鸿蒙 / iOS / Flutter）生成物 SHALL 全部由命名约定从 Proto message 名自动推导，MUST NOT 要求在 Proto 之外的任何端维护额外映射配置。

#### Scenario: 标准推导链
- GIVEN 真相源中存在 PascalCase 命名的 message
- WHEN Codegen 执行
- THEN 通道名按约定转换为 camelCase
- AND JSBridge 方法名按约定组合生成
- AND 五端推导结果完全一致

#### Scenario: 无额外配置参与
- GIVEN 仅提供 Proto 真相源文件
- WHEN 执行任一端 Codegen
- THEN 生成成功且不读取任何端私有的通道映射配置文件

#### Scenario: iOS 端生成
- GIVEN 真相源中定义了数据通道
- WHEN iOS 端 Codegen 执行
- THEN 生成 Objective-C 形态的通道常量、方法映射与数据推送 API
- AND 生成物位于构建前产物目录，缺失时构建流程先行补生成

#### Scenario: Flutter 端生成
- GIVEN 真相源中定义了数据通道
- WHEN Flutter 端 Codegen 执行
- THEN 生成 Dart 形态的通道常量、方法映射与数据推送 API
- AND 生成物位于 SDK 源码目录内的生成产物子目录

### Requirement: Proto 语法子集
Codegen SHALL 仅支持 message 加标量字段与 repeated 标量字段的语法子集，遇到嵌套 message、enum、oneof 等超出子集的语法时 MUST 构建失败并给出明确错误信息。

#### Scenario: 子集内定义解析成功
- GIVEN message 仅含 string/int32/int64/double/bool 标量字段与 repeated 标量字段
- WHEN Codegen 解析
- THEN 解析成功并生成对应字段

#### Scenario: 超出子集的定义
- GIVEN message 中使用了嵌套 message
- WHEN Codegen 解析
- THEN 构建失败
- AND 错误信息指明不支持的语法位置

#### Scenario: 字段编号不连续
- GIVEN message 字段编号存在跳号
- WHEN Codegen 解析
- THEN 构建失败或给出明确警告，不允许静默通过

### Requirement: 传输编码策略
数据同步通道在 JSBridge 传输层 SHALL 使用 JSON 字符串编码，两端 MUST NOT 引入任何协议库运行时依赖；Proto 仅承担 Schema 定义职责。

#### Scenario: 纯浏览器端无协议依赖
- GIVEN 前端 SDK 构建产物
- WHEN 检查其依赖清单
- THEN 不存在任何协议库运行时依赖

#### Scenario: 数据往返一致
- GIVEN 按 Schema 定义构造的数据对象
- WHEN 经序列化传输后反序列化
- THEN 字段名与值与原对象一致

### Requirement: 生成物可重建
生成代码 SHALL 视为构建产物，MUST 可随时由真相源删除重建，重建结果与既有生成物语义一致；手工修改生成代码 MUST NOT 作为受支持的变更方式。

#### Scenario: 删除后重建
- GIVEN 某端生成代码被删除
- WHEN 重新执行构建
- THEN 生成代码恢复且内容语义一致

#### Scenario: 真相源变更触发再生成
- GIVEN 真相源 Proto 文件发生变更
- WHEN 执行构建
- THEN 五端生成物自动更新，无需人工介入

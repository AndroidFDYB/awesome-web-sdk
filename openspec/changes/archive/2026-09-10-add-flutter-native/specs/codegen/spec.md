## MODIFIED Requirements

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

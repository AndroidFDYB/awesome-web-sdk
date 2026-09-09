# Delta for Codegen

## MODIFIED Requirements

### Requirement: 纯命名约定推导
四端（Android / Web / 鸿蒙 / iOS）生成物 SHALL 全部由命名约定从 Proto message 名自动推导，MUST NOT 要求在 Proto 之外的任何端维护额外映射配置。

#### Scenario: 标准推导链
- GIVEN 真相源中存在 PascalCase 命名的 message
- WHEN Codegen 执行
- THEN 通道名按约定转换为 camelCase
- AND JSBridge 方法名按约定组合生成
- AND 四端推导结果完全一致

#### Scenario: 无额外配置参与
- GIVEN 仅提供 Proto 真相源文件
- WHEN 执行任一端 Codegen
- THEN 生成成功且不读取任何端私有的通道映射配置文件

#### Scenario: iOS 端生成
- GIVEN 真相源中定义了数据通道
- WHEN iOS 端 Codegen 执行
- THEN 生成 Objective-C 形态的通道常量、方法映射与数据推送 API
- AND 生成物位于构建前产物目录，缺失时构建流程先行补生成

### Requirement: 生成物可重建
生成代码 SHALL 视为构建产物，MUST 可随时由真相源删除重建，重建结果与既有生成物语义一致；手工修改生成代码 MUST NOT 作为受支持的变更方式。

#### Scenario: 删除后重建
- GIVEN 某端生成代码被删除
- WHEN 重新执行构建
- THEN 生成代码恢复且内容语义一致

#### Scenario: 真相源变更触发再生成
- GIVEN 真相源 Proto 文件发生变更
- WHEN 执行构建
- THEN 四端生成物自动更新，无需人工介入

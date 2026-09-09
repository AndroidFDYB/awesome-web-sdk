# Delta for DataSync

## MODIFIED Requirements

### Requirement: 通道唯一真相源
数据同步通道的定义 SHALL 以 Proto 文件为唯一真相源，四端生成物（注解、装饰器、常量、setter、方法映射）MUST 全部由 Codegen 从该文件自动生成，MUST NOT 在任何一端手工维护通道清单。

#### Scenario: 标准通道生成
- GIVEN Proto 真相源中定义了用户信息通道（含 uid、ticket 等字段）
- WHEN 执行任一端的构建流程
- THEN 该端生成对应的通道标记 API 与数据推送 API
- AND 四端生成的通道名与 JSBridge 方法名完全一致

#### Scenario: 真相源未定义的通道
- GIVEN 某通道未在 Proto 真相源中定义
- WHEN 构建各端
- THEN 四端均不存在该通道的任何生成物

### Requirement: 集成方扩展通道
集成方 SHALL 通过在扩展目录新增 Proto 文件来扩展数据通道，扩展过程 MUST NOT 要求修改任何端 SDK 的源代码。

#### Scenario: 新增扩展通道
- GIVEN 集成方在扩展目录新增一个符合约束的 Proto message
- WHEN 执行四端构建
- THEN 四端自动生成该通道对应的标记 API 与推送 API
- AND SDK 源码零修改

# DataSync 数据同步规范

## Purpose

定义 Native 端向 Web 端推送业务数据的等待唤醒同步机制的行为契约：通道声明、请求阻塞、数据注入与唤醒。该机制解决 Native→Web 大数据量传递的时序问题——页面先于数据到达时，依赖该数据的请求自动等待，直到数据就绪。

## Requirements

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

### Requirement: 等待唤醒数据同步
前端依赖指定通道数据的请求 SHALL 自动阻塞直到数据就绪；数据由 Native 端在页面加载完成后推送，前端接收后 MUST 唤醒全部等待该通道的请求。

#### Scenario: 数据先于请求就绪
- GIVEN Native 端已推送某通道数据
- WHEN 前端发起依赖该通道的请求
- THEN 请求立即携带已就绪的数据发出，不发生等待

#### Scenario: 请求先于数据到达
- GIVEN 前端已发起依赖某通道的请求且数据未就绪
- WHEN Native 端随后推送该通道数据
- THEN 阻塞中的请求被唤醒并携带数据继续发出

#### Scenario: 多请求等待同一通道
- GIVEN 多个请求依赖同一通道且数据未就绪
- WHEN 该通道数据到达
- THEN 全部等待请求均被唤醒

### Requirement: 请求数据注入
被标记依赖某通道的前端网络请求 SHALL 在发出前自动获得该通道数据的注入，业务代码 MUST NOT 手工读取通道数据并拼装请求参数。

#### Scenario: 请求头注入
- GIVEN 用户信息通道数据已就绪
- WHEN 前端发起标记依赖用户信息的请求
- THEN 请求自动携带该通道定义的凭证字段

#### Scenario: 未标记的请求不受影响
- GIVEN 通道数据未就绪
- WHEN 前端发起未标记任何通道依赖的请求
- THEN 请求不阻塞、不注入，立即发出

### Requirement: 通道声明与使用一致性
Native 端页面声明依赖的通道集合 SHALL 在编译期确定，声明了通道依赖的页面 MUST 在数据就绪前保持对应等待语义，未声明通道的页面 MUST NOT 参与数据同步流程。

#### Scenario: 页面声明多通道
- GIVEN 页面声明依赖用户信息与借款信息两个通道
- WHEN 构建完成
- THEN 该页面的通道集合在编译期生成且运行时不可篡改

#### Scenario: 页面未声明任何通道
- GIVEN 页面未声明通道依赖
- WHEN 数据同步流程初始化
- THEN 该页面不注册任何等待语义

### Requirement: 集成方扩展通道
集成方 SHALL 通过在扩展目录新增 Proto 文件来扩展数据通道，扩展过程 MUST NOT 要求修改任何端 SDK 的源代码。

#### Scenario: 新增扩展通道
- GIVEN 集成方在扩展目录新增一个符合约束的 Proto message
- WHEN 执行四端构建
- THEN 四端自动生成该通道对应的标记 API 与推送 API
- AND SDK 源码零修改

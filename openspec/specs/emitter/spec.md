# Emitter 跨 WebView 事件路由规范

## Purpose

定义跨 WebView 事件通信的行为契约：四级消息格式、容器路由、Native 转发与宿主事件消费。Emitter 解决多个业务 WebView 之间互相隔离、无法直接通信的问题，由 Native 端路由器统一转发事件。

## Requirements

### Requirement: 四级消息格式
事件名 SHALL 采用四级冒号分隔格式（容器名:业务域:模块名:事件名），每级 MUST 非空且为合法标识符，不符合格式的消息 MUST 被拒绝且不进入路由。

#### Scenario: 合法事件名
- GIVEN 一个四级均为合法标识符的事件名
- WHEN 提交给事件系统
- THEN 格式校验通过并进入路由流程

#### Scenario: 缺级事件名
- GIVEN 一个仅含三级的事件名
- WHEN 提交给事件系统
- THEN 格式校验失败
- AND 该消息不进入路由

### Requirement: 容器路由转发
事件系统 SHALL 依据事件名第一级容器名将事件路由到对应 WebView；目标为宿主容器的事件 MUST 由 Native 端直接消费而不转发。

#### Scenario: 跨 WebView 转发
- GIVEN 容器 A 中的页面发出目标为容器 B 的事件
- WHEN Native 路由器收到该事件
- THEN 事件被转发到容器 B 的 WebView
- AND 容器 B 中监听该事件的处理器被触发

#### Scenario: 宿主容器消费
- GIVEN 页面发出目标为宿主容器的事件
- WHEN Native 路由器收到该事件
- THEN Native 端注册的宿主事件处理器被触发
- AND 事件不被转发到任何 WebView

#### Scenario: 目标容器未注册
- GIVEN 页面发出的事件目标容器未在路由器注册
- WHEN Native 路由器收到该事件
- THEN 该事件被安全丢弃
- AND 路由器不抛出异常

### Requirement: 容器注册
Native 端 SHALL 支持将 WebView 按容器名注册到路由器，同一容器名重复注册时 MUST 保持行为确定（后注册生效或明确拒绝），注册关系 MUST NOT 影响其他容器的路由。

#### Scenario: 注册多个容器
- GIVEN 路由器注册了两个不同容器名的 WebView
- WHEN 任一容器发出事件
- THEN 路由按注册关系正确转发

#### Scenario: 容器内监听
- GIVEN 容器 B 中页面监听某事件名
- WHEN 容器 A 发出该事件名且目标容器为 B
- THEN 容器 B 的监听器收到事件数据

### Requirement: 事件监听与取消
前端事件系统 SHALL 支持按事件名监听与取消监听，取消监听后 MUST NOT 再收到该事件名的后续推送。

#### Scenario: 监听后收到事件
- GIVEN 页面监听某事件名
- WHEN 该事件被路由到本容器
- THEN 监听回调收到事件数据

#### Scenario: 取消监听后不再收到
- GIVEN 页面已取消某事件名的监听
- WHEN 该事件再次被路由到本容器
- THEN 页面不触发任何回调

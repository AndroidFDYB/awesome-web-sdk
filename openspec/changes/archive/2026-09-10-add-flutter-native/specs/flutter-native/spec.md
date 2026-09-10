## Purpose

Flutter 端原生 SDK 的行为规范：在 Flutter 宿主应用中为 WebView 容器提供与 Android / iOS / 鸿蒙对等的四大能力——Bridge（JS↔Dart 双向通信）、DataSync（等待唤醒数据同步）、AppLink（Scheme 跳转）、Emitter（跨 WebView 事件路由），以及 Proto Codegen 的 Dart 输出目标。Flutter 端作为第 4 个原生端与现有三端并存，通过本地路径依赖分发。

## ADDED Requirements

### Requirement: JS↔Dart 双向桥接通信

Flutter 端 SHALL 在 WebView 容器初始化时注入桥接脚本，建立 JS 与 Dart 之间的双向通信通道。JS 端发起的方法调用 MUST 被路由到 Dart 端注册的处理器，Dart 端发起的调用 MUST 被路由到 JS 端注册的处理器。通信模型为异步消息通道。

#### Scenario: JS 调用 Dart 已注册方法
- GIVEN WebView 桥接通道已建立
- WHEN JS 端发起异步方法调用，且 Dart 端已注册对应处理器
- THEN Dart 处理器被执行并将结果回传给 JS 端
- AND JS 端回调收到正确结果

#### Scenario: Dart 调用 JS 已注册方法
- GIVEN WebView 桥接通道已建立
- WHEN Dart 端发起方法调用，且 JS 端已注册对应处理器
- THEN JS 处理器被执行并将结果回传给 Dart 端

#### Scenario: JS 调用 Dart 未注册方法
- GIVEN WebView 桥接通道已建立
- WHEN JS 端调用一个 Dart 端未注册的方法
- THEN 调用返回可识别的失败状态（方法不存在错误码）
- AND 不影响后续其他方法的调用

#### Scenario: 桥接脚本幂等注入
- GIVEN 页面发生导航或重新加载
- WHEN 桥接脚本被多次注入
- THEN 仅首次注入生效，重复注入被安全忽略
- AND 已注册的处理器和数据状态不丢失

### Requirement: URL 平台参数注入

Flutter 端加载 WebView 页面时 SHALL 在页面 URL 上自动追加 Flutter 平台标识参数，前端 SDK MUST 能通过该参数识别宿主为 Flutter 容器。

#### Scenario: Flutter 加载页面
- GIVEN Flutter 端发起页面加载
- WHEN 页面 URL 不含平台参数
- THEN 加载的 URL 自动追加平台标识参数，取值为 Flutter 平台标识
- AND 前端 SDK 读取该参数识别为 Flutter 平台

#### Scenario: URL 已含平台参数
- GIVEN 页面 URL 已含平台标识参数
- WHEN Flutter 端处理该 URL
- THEN 不重复追加平台参数
- AND 既有参数值保持不变

### Requirement: 等待唤醒数据同步

Flutter 端 SHALL 实现与 Android / iOS / 鸿蒙对等的数据同步辅助器，管理通道数据状态与页面加载状态，在页面加载完成后将已就绪的数据通过桥接通道推送到前端。

#### Scenario: 数据先于页面加载就绪
- GIVEN Flutter 端在页面加载完成前已设置某通道数据
- WHEN 页面加载完成通知到达
- THEN 已就绪的通道数据立即推送到前端
- AND 前端对应的等待请求被唤醒

#### Scenario: 页面先于数据加载完成
- GIVEN 页面已加载完成但某通道数据尚未设置
- WHEN Flutter 端随后设置该通道数据
- THEN 数据立即推送到前端

#### Scenario: 全部通道同步完成
- GIVEN Flutter 端声明依赖多个通道
- WHEN 全部通道数据均已设置且页面已加载完成
- THEN 辅助器状态变更为全部同步完成
- AND 状态查询方法返回完成标识

#### Scenario: 未声明通道的页面
- GIVEN Flutter 端页面未声明任何通道依赖
- WHEN 数据同步辅助器初始化
- THEN 不注册任何等待语义
- AND 状态查询方法返回完成标识

### Requirement: Scheme 跳转处理

Flutter 端 SHALL 注册桥接跳转处理器，接收前端透传的 scheme 字符串，解析目标页面标识与可选参数，在 Flutter 路由体系中执行页面导航。

#### Scenario: 直接打开目标页面
- GIVEN Flutter 端收到不含回首页标记的合法 scheme
- WHEN 解析成功
- THEN 在 Flutter 路由栈中打开目标页面

#### Scenario: 回首页后打开目标页面
- GIVEN Flutter 端收到携带回首页标记的合法 scheme
- WHEN 解析成功
- THEN 先弹出至路由栈底（首页）
- AND 随后打开目标页面

#### Scenario: 非法 scheme 处理
- GIVEN Flutter 端收到不符合协议格式的 scheme
- WHEN 解析失败
- THEN 返回明确的失败状态码给前端
- AND 不发生任何页面跳转

### Requirement: 跨 WebView 事件路由

Flutter 端 SHALL 实现事件路由器，支持按容器名将事件路由到对应 WebView 实例，支持宿主容器事件的直接消费。

#### Scenario: 跨 WebView 转发
- GIVEN Flutter 端路由器注册了两个不同容器名的 WebView
- WHEN 容器 A 中的页面发出目标为容器 B 的事件
- THEN 事件被转发到容器 B 的 WebView
- AND 容器 B 中监听该事件的处理器被触发

#### Scenario: 宿主容器消费
- GIVEN Flutter 端路由器已注册宿主事件处理器
- WHEN 页面发出目标为宿主容器的事件
- THEN Flutter 端宿主处理器被触发
- AND 事件不被转发到任何 WebView

#### Scenario: 目标容器未注册
- GIVEN 页面发出的事件目标容器未在路由器注册
- WHEN 路由器收到该事件
- THEN 该事件被安全丢弃
- AND 路由器不抛出异常

### Requirement: 前端 Flutter 平台检测

前端 SDK SHALL 在平台检测逻辑中增加 Flutter 平台的识别能力。Flutter 端注入的桥接脚本 MUST 设置可被前端 SDK 检测到的平台标记。

#### Scenario: Flutter 容器内加载
- GIVEN 页面运行于 Flutter 容器的 WebView 中
- WHEN 前端 SDK 初始化
- THEN 检测结果为 Flutter 平台
- AND 使用与鸿蒙端兼容的 dsBridge 桥接协议

#### Scenario: URL 参数识别 Flutter
- GIVEN 页面 URL 携带 Flutter 平台标识参数
- WHEN 前端 SDK 执行平台检测
- THEN 返回 Flutter 平台标识

#### Scenario: 前端 SDK 向后兼容
- GIVEN Flutter 端桥接脚本同时设置兼容标记
- WHEN 旧版前端 SDK（未含 Flutter 检测逻辑）运行
- THEN 旧版 SDK 将 Flutter 容器识别为鸿蒙平台（dsBridge 协议兼容）
- AND 桥接功能正常工作

### Requirement: 本地分发与隔离

Flutter 端 SDK SHALL 仅通过本地路径依赖方式分发，MUST NOT 发布到任何远程包仓库。Flutter 端代码 MUST NOT 被推送到远程代码仓库。

#### Scenario: 本地路径依赖集成
- GIVEN 宿主 Flutter 项目与 SDK 位于同一开发环境
- WHEN 宿主项目在依赖配置中通过本地路径引入 SDK
- THEN SDK 可被正常解析和使用

#### Scenario: 代码仓库隔离
- GIVEN Flutter 端代码已提交到本地版本控制
- WHEN 执行推送操作
- THEN Flutter 端代码不被包含在推送范围内

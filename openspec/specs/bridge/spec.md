# Bridge 通信规范

## Purpose

定义前端 SDK 与 Native 容器（Android / HarmonyOS）之间 JSBridge 双向通信的行为契约：平台检测、双协议适配、URL 平台参数注入、方法调用与回调。Bridge 是 DataSync、AppLink、Emitter 三大功能模块的通信底座。

## Requirements

### Requirement: 平台自动检测
前端 SDK SHALL 在页面加载时自动检测当前运行环境（Android 容器 / HarmonyOS 容器 / 纯浏览器），并根据检测结果选择对应的桥接协议，MUST NOT 要求业务代码手工指定平台类型。

#### Scenario: Android 容器内加载
- GIVEN 页面运行于 Android 容器的 WebView 中
- WHEN 前端 SDK 初始化
- THEN 检测结果为 Android 平台
- AND 使用 Android 桥接协议建立双向通信通道

#### Scenario: 鸿蒙容器内加载
- GIVEN 页面运行于 HarmonyOS 容器的 Web 组件中
- WHEN 前端 SDK 初始化
- THEN 检测结果为 HarmonyOS 平台
- AND 使用鸿蒙桥接协议建立双向通信通道

#### Scenario: 纯浏览器加载
- GIVEN 页面运行于无 Native 容器的普通浏览器中
- WHEN 前端 SDK 初始化
- THEN SDK 不抛出异常
- AND 桥接能力标记为不可用，依赖 Native 的功能返回明确的失败状态码

### Requirement: URL 平台参数注入
Native 端加载 WebView 页面时 SHALL 在页面 URL 上自动追加平台标识参数，前端 SDK MUST 能通过该参数识别宿主平台。

#### Scenario: Android 加载页面
- GIVEN Android 端发起页面加载
- WHEN 页面 URL 不含平台参数
- THEN 加载的 URL 自动追加平台标识参数
- AND 前端 SDK 读取该参数识别为 Android 平台

#### Scenario: URL 已含查询参数
- GIVEN 页面 URL 已携带其他查询参数
- WHEN Native 端追加平台参数
- THEN 平台参数以正确的拼接方式加入
- AND 原有查询参数保持不变

### Requirement: 零运行时依赖
前端 SDK 的桥接层 MUST NOT 依赖任何第三方桥接库或协议库的运行时包，SHALL 通过自身代码完成双协议适配与数据序列化。

#### Scenario: 纯浏览器环境安装
- GIVEN 一个不含任何 Native 桥接库依赖的前端工程
- WHEN 安装并引入前端 SDK
- THEN SDK 正常完成模块加载
- AND 平台检测与失败状态返回行为符合预期

### Requirement: 异步方法调用与回调
前端 SDK SHALL 支持向 Native 端发起异步方法调用，并在 Native 返回结果后正确回调；调用失败或超时时 MUST 返回可识别的错误状态而非无限挂起。

#### Scenario: 调用 Native 方法成功
- GIVEN 桥接通道已建立
- WHEN 前端调用一个 Native 已注册的方法
- THEN 前端在 Native 处理完成后收到结果回调

#### Scenario: 调用 Native 未注册方法
- GIVEN 桥接通道已建立
- WHEN 前端调用一个 Native 未注册的方法
- THEN 调用返回可识别的失败状态
- AND 不影响后续其他方法的调用

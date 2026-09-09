# Delta for Bridge

## MODIFIED Requirements

### Requirement: 平台自动检测
前端 SDK SHALL 在页面加载时自动检测当前运行环境（Android 容器 / HarmonyOS 容器 / iOS 容器 / 纯浏览器），并根据检测结果选择对应的桥接协议，MUST NOT 要求业务代码手工指定平台类型。

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

#### Scenario: iOS 容器内加载
- GIVEN 页面运行于 iOS 容器的 WKWebView 中，且页面 URL 携带平台标识参数
- WHEN 前端 SDK 初始化
- THEN 检测结果为 iOS 平台
- AND 使用 iOS 桥接协议建立双向通信通道

#### Scenario: 纯浏览器加载
- GIVEN 页面运行于无 Native 容器的普通浏览器中
- WHEN 前端 SDK 初始化
- THEN SDK 不抛出异常
- AND 桥接能力标记为不可用，依赖 Native 的功能返回明确的失败状态码

### Requirement: URL 平台参数注入
Native 端加载 WebView 页面时 SHALL 在页面 URL 上自动追加平台标识参数（Android / HarmonyOS / iOS 各自的平台标识值），前端 SDK MUST 能通过该参数识别宿主平台。

#### Scenario: Android 加载页面
- GIVEN Android 端发起页面加载
- WHEN 页面 URL 不含平台参数
- THEN 加载的 URL 自动追加平台标识参数
- AND 前端 SDK 读取该参数识别为 Android 平台

#### Scenario: iOS 加载页面
- GIVEN iOS 端发起页面加载
- WHEN 页面 URL 不含平台参数
- THEN 加载的 URL 自动追加平台标识参数，取值为 iOS 平台标识
- AND 前端 SDK 读取该参数识别为 iOS 平台

#### Scenario: URL 已含查询参数
- GIVEN 页面 URL 已携带其他查询参数
- WHEN Native 端追加平台参数
- THEN 平台参数以正确的拼接方式加入
- AND 原有查询参数保持不变

#### Scenario: URL 已含平台参数
- GIVEN 页面 URL 已含平台标识参数
- WHEN Native 端处理该 URL
- THEN 不重复追加平台参数
- AND 既有参数值保持不变

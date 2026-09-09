# AppLink 跳转规范

## Purpose

定义前端页面向 Native 端发起页面跳转的 Scheme 协议行为契约：scheme 透传、解析、跳转执行与结果反馈。AppLink 统一四端一致的页面跳转能力，前端无需感知宿主平台差异。

## Requirements

### Requirement: Scheme 协议格式
AppLink SHALL 使用统一前缀的 scheme 字符串承载跳转意图，scheme 内容 MUST 包含目标页面标识，MAY 携带页面标题、回首页标记等可选参数。

#### Scenario: 最小合法 scheme
- GIVEN 一个仅含目标页面标识的 scheme 字符串
- WHEN 交由 Native 端解析
- THEN 解析成功并得到目标页面标识

#### Scenario: 携带可选参数的 scheme
- GIVEN 一个含目标页面标识、页面地址与回首页标记的 scheme 字符串
- WHEN 交由 Native 端解析
- THEN 全部参数解析成功且类型正确

#### Scenario: 非法 scheme
- GIVEN 一个不符合协议格式的 scheme 字符串
- WHEN 交由 Native 端解析
- THEN 解析返回明确的失败状态码
- AND 不发生跳转

### Requirement: 前端跳转调用
前端 SHALL 提供统一的跳转方法将 scheme 字符串透传给 Native 端，调用结果 MUST 以状态码区分成功、解析失败与不可用环境三种情况。

#### Scenario: Native 环境跳转成功
- GIVEN 页面运行于 Native 容器且桥接可用
- WHEN 前端调用跳转方法传入合法 scheme
- THEN scheme 透传至 Native 端
- AND 调用返回成功状态码

#### Scenario: 非 Native 环境调用
- GIVEN 页面运行于纯浏览器环境
- WHEN 前端调用跳转方法
- THEN 调用返回不可用环境状态码
- AND 输出警告信息

#### Scenario: Native 解析失败回传
- GIVEN 页面运行于 Native 容器
- WHEN 前端调用跳转方法传入非法 scheme
- THEN 调用返回解析失败状态码及描述信息

### Requirement: Native 跳转执行
Native 端收到合法 scheme 后 SHALL 执行对应页面跳转；当 scheme 携带回首页标记时 MUST 先返回首页再打开目标页面。

#### Scenario: 直接打开目标页面
- GIVEN Native 端收到不含回首页标记的合法 scheme
- WHEN 解析成功
- THEN 直接打开目标页面

#### Scenario: 回首页后打开目标页面
- GIVEN Native 端收到携带回首页标记的合法 scheme
- WHEN 解析成功
- THEN 先返回首页
- AND 随后打开目标页面

### Requirement: 透明弹窗页面类型
Scheme 中目标页面标识为透明弹窗类型时，Native 端 SHALL 以覆盖于当前页面之上的弹窗形态打开目标页面；弹窗 SHALL 支持通过遮罩关闭，SDK MUST 导出该页面类型的标识常量供集成方识别。

#### Scenario: 透明弹窗打开
- GIVEN scheme 中目标页面标识为透明弹窗类型
- WHEN Native 端解析成功
- THEN 目标页面以覆盖在当前页面之上的弹窗形态打开
- AND 弹窗背景为半透明遮罩

#### Scenario: 遮罩关闭弹窗
- GIVEN 透明弹窗已打开
- WHEN 用户点击弹窗外围的遮罩区域
- THEN 弹窗关闭
- AND 底层页面状态不受破坏

### Requirement: 透明弹窗生命周期
连续打开的多个透明弹窗 SHALL 由 SDK 统一管理并保持可正常关闭；当发生携带回首页标记的跳转时，SDK MUST 关闭全部已打开的透明弹窗，且关闭过程 MUST NOT 残留弹窗的关闭回调引用。

#### Scenario: 连续打开多个弹窗
- GIVEN 已有一个透明弹窗打开
- WHEN 发起打开新的透明弹窗
- THEN 新旧弹窗并存且均可正常关闭

#### Scenario: 回首页关闭全部弹窗
- GIVEN 已打开多个透明弹窗
- WHEN 发起携带回首页标记的跳转
- THEN 全部已打开的透明弹窗被关闭
- AND 关闭后不存在残留的回调引用

# 需求
实现一套跨平台业务的封装。产出各端不同的SDK。 
比如：
1. android平台基于and_web_library产出aar
2. 鸿蒙平台基于hm_web_library产出har
3. 前端基于vue-web-sdk产出tgz并且可以通过npm进行安装
三端的交互手段是JSBridge
4. 期望能通过脚本 设置不同参数 按需产出SDK

# 环境描述
本机是Windows平台
Android SDK目录是  E:\AndroidDevTool\ASSDK
鸿蒙 SDK目录是 : D:\software\DevEco Studio\sdk
鸿蒙工具目录是 : D:\software\DevEco Studio\tools

# 要求
1. 每一次中型改动 都要维护到git
2. 你可以通过一对一采访我的形式弄清楚需求，但是每次只能问我一个问题
3. 你作为一个项目经理，起到解读需求、拆分任务、调度任务的职责，通过SubAgent进行具体任务的实现
4. SubAgent只回传给你必要的结果，如需传递大量信息，需要使用文件传输，减少你的上下文占用
5. 当前阶段目标就是产出不同平台的SDK
6. 将你对需求的理解也要更新到当前markdown中
7. 非极度敏感权限，不需要询问我
8. 只需要我做功能和业务相关的决策

---

# 需求理解与架构设计

## 总体架构
实现一套跨平台通用 JSBridge SDK 框架，提供 WebView 容器 + JSBridge 双向通信通道。业务方可自行注册自定义 Handler 扩展 API。

## 技术选型

| 平台 | 技术方案 | 产出物 |
|------|----------|--------|
| Android | DSBridge (wendux/DSBridge-Android) 开源库 + MPBridgeWebView 封装 | AAR |
| 鸿蒙 | 官方 Web 组件 javaScriptProxy + 自定义 JSBridgeManager | HAR |
| 前端 | Vite 库模式 + dsbridge npm 包封装 | TGZ (npm install) |

## JSBridge 协议
- 采用 DSBridge 协议作为统一协议，三端保持兼容
- JS 端统一入口：`window.dsBridge`
- Android：DSBridge 的 DWebView 自动注入
- 鸿蒙：通过 javaScriptProxy 注入 `_dsbridge` 对象 + bridge.js 提供 `dsBridge` API
- 前端：封装 dsbridge npm 包，自动检测运行环境

## 构建方式
根目录 `package.json` 提供 npm scripts（跨平台）：
- `npm run build:android` — 产出 AAR
- `npm run build:harmony` — 产出 HAR
- `npm run build:web` — 产出 TGZ
- `npm run build:all` — 产出全部

## 文件结构
```
specs/bridge-protocol.ts     # 三端共享协议定义
android/and_web_library/     # Android SDK
  src/main/java/.../MPBridgeWebView.kt
  src/main/java/.../MPBridgeConfig.kt
hm/hm_web_library/           # 鸿蒙 SDK
  src/main/ets/components/MPBridgeWeb.ets
  src/main/ets/bridge/JSBridge.ets
  src/main/ets/bridge/BridgeHandler.ets
  src/main/ets/bridge/BridgeModels.ets
  src/main/resources/rawfile/bridge.js
vue-web-sdk/                 # 前端 SDK
  src/bridge.ts
  src/types.ts
  src/index.ts
scripts/                     # 构建脚本
  post-build.js
  build-harmony.js
output/                      # 构建产物输出
  android/*.aar
  harmony/*.har
  web/*.tgz
```

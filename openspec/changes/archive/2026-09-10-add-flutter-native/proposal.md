## Why

MP-SDK 当前覆盖 Android / iOS / HarmonyOS 三端原生 SDK，每端各自维护一套近乎重复的桥接逻辑（Bridge、DataSync、AppLink、Emitter），代码总量约 5000 行且功能对等。Flutter 已有成熟的 WebView 插件（`flutter_inappwebview`）并支持 Android / iOS / HarmonyOS 三平台，具备以一套 Dart SDK 统一承载原生桥接逻辑的技术条件。本次变更将 Flutter 作为第 4 个原生端加入，与现有三端并存，为后续架构演进建立基础。

## What Changes

- 新增 `flutter/` 目录，包含 Dart SDK 模块，实现与 Android / iOS / 鸿蒙对等的四大功能：Bridge、DataSync、AppLink、Emitter
- 新增 Flutter 端 Proto Codegen：Node.js 脚本解析 `channels.proto` 生成 Dart 源码（通道常量、方法映射、setter）
- 新增 `bridge.js` Flutter 适配版：将 `postToNative` 通道从 `webkit.messageHandlers` / `javaScriptProxy` 适配为 `flutter_inappwebview` 的 JavaScriptHandler
- 前端 SDK（`vue-web-sdk`）平台检测增加 `'flutter'` 平台标识（URL 参数 `?platform=flutter` + Window 对象 `window.__flutter_bridge`）
- 新增本地构建脚本 `scripts/build-flutter.js` 和 `scripts/proto-codegen-flutter.js`
- 根目录 `package.json` 增加 `build:flutter`、`codegen:flutter` 等 npm scripts

## Capabilities

### New Capabilities

- `flutter-native`：Flutter 端原生 SDK 的完整行为规范，覆盖 Bridge（JS↔Dart 双向通信）、DataSync（等待唤醒数据同步）、AppLink（scheme 跳转）、Emitter（跨 WebView 事件路由）四大模块，以及 Proto Codegen 的 Dart 输出目标

### Modified Capabilities

- `codegen`：增加 Flutter/Dart 作为 Proto Codegen 的输出目标，命名约定推导规则扩展
- `build`：增加 `build:flutter` 构建命令（仅本地，不纳入 CI）

## Impact

- **代码**：新增 `flutter/` 目录（Dart 源码）、`scripts/` 下新增两个脚本、前端 SDK `platform.ts` 和 `bridge.ts` 增加 Flutter 分支
- **依赖**：Flutter SDK 通过本地 `path` 依赖分发，不发布到 pub.dev；宿主 App 需引入 `flutter_inappwebview`（含鸿蒙适配版）
- **构建**：新增 `npm run build:flutter` 和 `npm run codegen:flutter`，不影响现有四端构建流程
- **CI**：不修改 `.github/workflows/build.yml`，Flutter 端不纳入 CI 守门
- **分发**：仅本地分发，禁止 push 到远程服务器
- **现有端**：Android / iOS / 鸿蒙三端代码零改动

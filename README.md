# 工程目录介绍
`android` 是一个 Android工程
`android/android_web_library` 是一个 Android支持WebView的模块（基于 DSBridge 封装 JSBridge）

同理： 

`hm` 是一个 鸿蒙工程
`hm/hm_web_library` 是一个 鸿蒙支持WebView的模块（基于官方 javaScriptProxy 实现 JSBridge）

`vue-web` 是一个基于Vite+Vue3的前端工程
`vue-web-sdk` 是一个基于Vite+Vue3的库，可以提供为`vue-web` 使用

---

## 构建命令

```bash
# 安装依赖
npm run install:all

# 构建单平台 SDK
npm run build:android    # 产出 AAR -> output/android/
npm run build:harmony    # 产出 HAR -> output/harmony/
npm run build:web        # 产出 TGZ -> output/web/

# 构建全部平台 SDK
npm run build:all
```

## 产出物

```
output/
  android/and_web_library-release.aar    # Android SDK
  harmony/hm_web_library.har             # 鸿蒙 SDK
  web/mp-sdk-bridge-x.x.x.tgz            # 前端 SDK (npm install)
```

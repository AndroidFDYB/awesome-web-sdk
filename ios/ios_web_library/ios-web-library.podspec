Pod::Spec.new do |s|
  s.name             = 'ios_web_library'
  s.version          = '1.0.0'
  s.summary          = 'MP-SDK iOS 端 JSBridge SDK'

  s.description      = <<-DESC
  MP-SDK iOS 端 SDK：基于 WKWebView 的 JSBridge 双向通信 + 数据同步（等待唤醒）+ AppLink Scheme 跳转 + 跨 WebView 事件路由。
  对等鸿蒙端 hm_web_library，协议兼容 DSBridge，前端可使用 @mp-sdk/bridge 统一 API。
  DESC

  s.homepage         = 'https://example.com/mp-sdk'
  s.license          = { :type => 'Proprietary', :text => 'Proprietary — 内部项目，请勿外传。' }
  s.author           = { 'MP-SDK Team' => 'dev@example.com' }
  s.source           = { :path => '.' }

  s.ios.deployment_target = '12.0'
  s.frameworks       = 'UIKit', 'WebKit'

  s.source_files        = 'MPWebLibrary.h',
                          'Bridge/*.{h,m}',
                          'AppLink/*.{h,m}',
                          'Emitter/*.{h,m}',
                          'Components/*.{h,m}',
                          'Generated/*.{h,m}'

  s.public_header_files = 'MPWebLibrary.h',
                          'Bridge/*.h',
                          'AppLink/*.h',
                          'Emitter/*.h',
                          'Components/*.h',
                          'Generated/*.h'

  s.resources           = 'Resources/bridge.js'
end

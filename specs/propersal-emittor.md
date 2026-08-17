# 需求
增强前端emittor工程：
由于前端工程有 借款工程（WebViewForLoan）、会员工程(WebViewForVip)、还有一些其他H5工程(WebViewForActivity)，
这些工程之间可以在存在着WebView隔离，通Webview之间也可能存在跨域问题。这使得前端Vue中的emittor的通信有了很大的局限性。   
我实现的解决方案是: 
定义四层消息体(<containerName>:<scope>:<vueModelName>:<vueEventName>) 通过Hook前端的emittor，
将该类别的消息通过 JSBridge发往原生端， 再原生端基于原生手段 “透传给” 目标WebView的进而回传给对应的前端工程。
这样前端工程师也是无感的在多个工程中使用emittor，并且能够灵活通行。

##前端
引入emitor库，并且hook   提交和监听两个方法。 
提交方法：当传入的事件名称为 vip:vipbuy:success:two ,这种:分开的4级格式，则就通过JSBridge方法 postToNative方式，传递出去。 如果还有其他参数
则透传给postNative方法。两个方法前面一致即可。 
## 原生端
WebView初始化的时候，就注册postToNative方法。 当有数据到来，则解析vip:vipbuy:success:two 四级参数，并根据第一级内容，使用本地消息发送给对应的WebView。
对应的WebView接收到消息后，通过JSBridge 的postToWeb方法透过过去。
一级事件名有四个： vip , loan, lead,common,host ， 前四个分别对应 WebViewForVip/ WebViewForLoan/WebViewForLead/WebViewForCommon 
这四个页面。 host 代表前端发给原生的。 原生直接消费掉，不会回传给其他位置。 
每个页面只接受自己感兴趣的事件
## 前端
前端收到 postToWeb调用，则将数据发送给 监听vip:vipbuy:success:two四级类型格式调用点。
注意不需要出现内存泄漏
注意整个流程只有四级事件名，其他级别则认为数据异常，忽略即可
前端的emittor hook这套逻辑要放入到前端SDK模块 。


# 通用要求
1. 每一次中型改动 都要维护到git
2. 你可以通过一对一采访我的形式弄清楚需求，但是每次只能问我一个问题
3. 你作为一个项目经理，起到解读需求、拆分任务、调度任务的职责，通过SubAgent进行具体任务的实现
4. SubAgent只回传给你必要的结果，如需传递大量信息，需要使用文件传输，减少你的上下文占用
5. 当前阶段目标就是产出不同平台的SDK
6. 将你对需求的理解也要更新到当前markdown中
7. 非极度敏感权限，不需要询问我
8. 只需要我做功能和业务相关的决策
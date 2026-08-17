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
鸿蒙 SDK目录是 : D:\software\DevEco Studio\sdk\default

# 要求
1. 每一次中型改动 都要维护到git
2. 你可以通过一对一采访我的形式弄清楚需求，但是每次只能问我一个问题
3. 你作为一个项目经理，起到解读需求、拆分任务、调度任务的职责，通过SubAgent进行具体任务的实现
4. SubAgent只回传给你必要的结果，如需传递大量信息，需要使用文件传输，减少你的上下文占用
5. 当前阶段目标就是产出不同平台的SDK
6. 将你对需求的理解也要更新到当前markdown中
7. 非极度敏感权限，不需要询问我
8. 只需要我做功能和业务相关的决策

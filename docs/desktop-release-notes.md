流光忆庭 / Garden of Recollection 0.7.0：Mac 与 Windows 统一体验版。

打开书籍后铺满应用内容区。“外部对话”在右侧打开独立网页面板，可输入网址，拖动分隔线调整比例；支持网页导航、收起恢复和站点偏好保存。原有 AI 消息展示保留在“回传记录”。

网页加载与 AI 工具连接是独立能力。DreamEdge 本地网页适配、第三方 AI 登录及控制阅读器的完整联动尚未完成；普通网页不会自动获得阅读器权限。

| 设备 | 下载文件 | 打开方式 |
| --- | --- | --- |
| Apple Silicon Mac，macOS 26+ | macos-arm64.dmg | 打开 DMG，将流光忆庭.app 拖到应用程序 |
| Windows Intel / AMD | windows-x64.zip | 完整解压，运行 RecollectionGarden.exe |
| Windows on ARM | windows-arm64.zip | 完整解压，运行 RecollectionGarden.exe |

各包均附 SHA-256，内置 Node；Windows 另附 .NET 运行环境，系统需有 Microsoft Edge WebView2 Runtime。

Mac CI 验证 DMG 完整性、解挂载后重定位、应用深度签名、独立 CLI、包内服务驱动的浏览器阅读与 MCP 联调；该浏览器验收不等同于 AppKit/WKWebView 原生窗口验收。
Windows x64 验证原生 WebView2、页面和文本层、CLI 输出及 MCP 书架、打开和原文读取；ARM64 仍需真机验证。

Mac 采用 ad-hoc 签名，尚未 Developer ID 签名或公证；Windows 尚无发布者签名。书架和笔记保存在各设备本地，暂不跨设备同步。

流光忆庭 / Garden of Recollection 0.7.2：极光玻璃全应用主题体验版。

书架、阅读区、笔记、引用、回传记录、设置及弹窗统一为冰蓝、透明白和少量淡粉点缀的极光玻璃风格。原有数据和业务能力保留。

阅读与 AI 区默认 65/35，可拖动、用左右方向键调整，双击或 Enter 恢复默认；阅读区最小 420px、AI 区最小 300px。目录收起后保留展开层级；窄窗口使用浮层目录或上下布局。点击页码可跳转，笔记、引用及回传记录在“更多”中。

AI 窗口右上角“设置”管理连接与网址；原生网页独立承载，设置打开时隐藏表面但不卸载会话。macOS 保留已配置的 AI 上下文会话入口；Windows 当前支持网址嵌入，尚不支持同等的自动上下文会话启动。

| 设备 | 下载文件 | 打开方式 |
| --- | --- | --- |
| Apple Silicon Mac，macOS 26+ | macos-arm64.dmg | 打开 DMG，将流光忆庭.app 拖到应用程序 |
| Windows Intel / AMD | windows-x64.zip | 完整解压，运行 RecollectionGarden.exe |
| Windows on ARM | windows-arm64.zip | 完整解压，运行 RecollectionGarden.exe |

各包均附 SHA-256，内置 Node；Windows 另附 .NET 运行环境，系统需有 Microsoft Edge WebView2 Runtime。不要下载 GitHub 自动生成的 Source code ZIP 来直接运行应用。

macOS 0.7.2 已完成本机升级、数据和配置保留检查，用户试用后确认暂未发现问题。Windows x64 发布流程包含原生 WebView2、阅读页面与文本层、AI 容器边界、设置切换及 CLI/MCP 验证；ARM64 为交叉构建，仍需实际设备试用。

书架、笔记与阅读进度保存在各设备本地，Mac 与 Windows 暂不自动同步。更新 Windows 包时先退出旧版，再完整解压新包；不要删除 `%LOCALAPPDATA%\RecollectionGarden`。

Mac 采用 ad-hoc 签名，尚未 Developer ID 签名或公证；Windows 尚无发布者签名。本次发布用于阶段性测试，真实第三方 AI 登录和跨平台设备适配仍需按实际环境验证。

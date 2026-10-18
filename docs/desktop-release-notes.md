流光忆庭 0.7.3 + DreamEdge 0.0.2：Windows 阅读上下文配套测试包。

本版补齐 Windows 原生 AI 入口导入、后台启动、当前窗口 / 书籍绑定、DreamEdge 嵌入会话与 MCP 交接。沿用极光玻璃主题与现有业务能力，macOS 原有连接方式保留。

## Windows 使用

1. Intel / AMD 设备下载两份 `windows-x64.zip`；Windows on ARM 下载两份 `windows-arm64.zip`。两份分别是 RecollectionGarden 与 DreamEdge，均需完整解压。
2. 运行 DreamEdge.exe，配置自己的模型服务。首次启动会在 `%APPDATA%\DreamEdge` 生成 `connection.local.json` 与 `credentials.local.json`；测试包不包含 API 密钥或个人会话。
3. 运行 RecollectionGarden.exe，导入并打开 PDF。在右侧“设置 → 更多连接操作 → 配置 AI”中选择 DreamEdge 解压目录的 `ai-entry.json`，确认启动器路径。
4. 点击“连接”。首次在 DreamEdge 确认应用与当前书籍的 MCP 范围后，即可在嵌入界面询问当前页、读取目录或翻页。

移动 DreamEdge 文件夹后重新导入入口配置。切书、窗口离线或上下文版本变化会拒绝旧范围调用；不要手动复制临时嵌入网址作为固定入口。关闭设置保留会话，取消连接会丢弃过期启动结果。

Windows 包内置 Node / .NET 所需运行环境，阅读器系统需有 Microsoft Edge WebView2 Runtime。Mac 与 Windows 的书架和会话保存在各自设备，暂不自动同步。更新前退出旧版；不要删除 `%LOCALAPPDATA%\RecollectionGarden` 或 `%APPDATA%\DreamEdge`。

发布门槛：两端 Windows 构建与协议测试通过，x64 使用实际两端包验证原生嵌入、MCP 上下文和原文读取、翻页及设置切换。模型使用本地协议夹具，不代表真实服务商与 ARM64 实机人工验收。配套源码版本由发布工作流固定，ZIP 附 SHA-256。

Mac 包采用 ad-hoc 签名；Windows 包尚无发布者签名。不要下载 GitHub 自动生成的 Source code ZIP 当作应用运行。

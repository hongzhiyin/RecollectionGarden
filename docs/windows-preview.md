# Windows 体验版

在仓库的 Releases 中下载 Windows 包。一般 Intel / AMD 设备选 `windows-x64.zip`，Windows on ARM 设备选 `windows-arm64.zip`。
完整解压后双击 `RecollectionGarden.exe`，不要只复制其中一个 exe。包内附 Node 和 .NET 运行环境，无需单独安装开发工具。

系统要求：Windows 10/11 与 Microsoft Edge WebView2 Runtime。缺少 WebView2 时，从 [微软官网](https://developer.microsoft.com/microsoft-edge/webview2/) 安装 Evergreen Runtime。

书籍、笔记与进度保存在本机 `%LOCALAPPDATA%\RecollectionGarden\Desktop\WebView2`，首次导入 PDF。Mac 与 Windows 的书架暂不自动同步。
关闭窗口会退出应用；未保存笔记先提示。重复打开会唤起已有窗口。Markdown 导出使用系统保存面板。

## CLI 与 MCP

在解压目录打开 PowerShell：

```powershell
.\recollection-garden.exe sessions
.\recollection-garden.exe call books.list --input '@request.json'
```

在阅读器点击“连接本地服务”。界面端口 4321，能力服务端口 4322；配置和日志位于 `%LOCALAPPDATA%\RecollectionGarden\Desktop`。
MCP 的 `command` 指向解压目录下 `recollection-garden.exe` 的完整路径，`args` 为 `["mcp"]`。
陪读 skill 位于 `Resources\app\skills\recollection-garden-reading`。

## 构建与验收

安装 Node.js 22.22.2 和 .NET 10 SDK 后运行：

```powershell
npm ci
npm run package:windows -- x64
npm run package:windows -- arm64
```

GitHub Actions 流程用于构建两种架构并发布 ZIP 与 SHA-256；也支持维护者本机交叉构建后上传 Releases。
公开仓库使用标准 GitHub 托管 runner。本轮 Windows runner 已通过 PDF 导入、页面像素、可选文本层、CLI 输出、23 项 MCP 工具发现，以及书架读取、打开书籍和原文读取。ARM64 为交叉构建，仍需真实 ARM64 设备验收。
最新完整结果见 [跨平台验收](cross-platform-verification.md)。
Windows 体验包尚未添加发布者代码签名。完整手动验收还应覆盖大尺寸扫描页、目录、页码跳转、缩放、笔记编辑、导出和退出重开。

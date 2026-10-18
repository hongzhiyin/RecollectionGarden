# Windows 体验版

在仓库的 Releases 中下载 Windows 包。一般 Intel / AMD 设备选 `windows-x64.zip`，Windows on ARM 设备选 `windows-arm64.zip`。
完整解压后双击 `RecollectionGarden.exe`，不要只复制其中一个 exe。包内附 Node 和 .NET 运行环境，无需单独安装开发工具。

系统要求：Windows 10/11 与 Microsoft Edge WebView2 Runtime。缺少 WebView2 时，从 [微软官网](https://developer.microsoft.com/microsoft-edge/webview2/) 安装 Evergreen Runtime。

书籍、笔记与进度保存在本机 `%LOCALAPPDATA%\RecollectionGarden\Desktop\WebView2`，首次导入 PDF。Mac 与 Windows 的书架暂不自动同步。
关闭窗口会退出应用；未保存笔记先提示。重复打开会唤起已有窗口。Markdown 导出使用系统保存面板。

## 0.7.3 双端连接与升级

全应用使用极光玻璃主题。阅读器的笔记、引用和回传记录位于“更多”；右侧设置可填写 AI 网页地址。Windows 已支持 ai-session-launch/v1：在“设置 → 更多连接操作 → 配置 AI”导入配套 DreamEdge 包旁的 ai-entry.json，再点击连接；首次在 DreamEdge 确认应用与书籍范围。直接填写网址只打开网页，不等同于上下文交接。

更新前退出旧版，完整解压新 ZIP；用户数据在 `%LOCALAPPDATA%` 下，不在解压目录中。Mac 的本地书架不会自动出现在 Windows，需在 Windows 导入所需 PDF。

## CLI 与 MCP

在解压目录打开 PowerShell：

```powershell
.\recollection-garden.exe sessions
.\recollection-garden.exe call books.list --input '@request.json'
```

在阅读器右侧“设置”中点击“连接本地服务”，书架也保留该入口。界面端口 4321，能力服务端口 4322；配置和日志位于 `%LOCALAPPDATA%\RecollectionGarden\Desktop`。
MCP 的 `command` 指向解压目录下 `recollection-garden.exe` 的完整路径，`args` 为 `["mcp"]`。
陪读 skill 位于 `Resources\app\skills\recollection-garden-reading`。

## 构建与验收

安装 Node.js 22.22.2 和 .NET 10 SDK 后运行：

```powershell
npm ci
npm run package:windows -- x64
npm run package:windows -- arm64
```

Desktop Release workflow 同时构建 Mac、Windows x64 / ARM64；全部构建和各自验收成功后，在同一 Release 发布 DMG、ZIP 和 SHA-256。也支持维护者本机交叉构建。
公开仓库使用标准 GitHub 托管 runner。Windows x64 runner 会检查 PDF 导入、页面像素、可选文本层、原生 AI 容器与设置切换、CLI 输出、25 项 MCP 工具发现，以及书架读取、打开书籍和原文读取。ARM64 为交叉构建，仍需真实 ARM64 设备验收。
最新完整结果见 [跨平台验收](cross-platform-verification.md)。
Windows 体验包尚未添加发布者代码签名。完整手动验收还应覆盖大尺寸扫描页、目录、页码跳转、缩放、笔记编辑、导出和退出重开。

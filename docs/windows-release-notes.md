Windows 桌面体验版：流光忆庭 / Garden of Recollection。

- Intel / AMD 设备下载 windows-x64.zip；Windows on ARM 下载 windows-arm64.zip。
- 完整解压，双击 RecollectionGarden.exe；保留旁边的 DLL、Resources 和 CLI。
- 内置 Node 与 .NET；系统需有 Microsoft Edge WebView2 Runtime。
- 首次导入 PDF。书架、笔记和阅读进度保存在当前设备，暂不跨设备同步。
- 外部 AI 的 MCP command 指向 recollection-garden.exe，args 为 ["mcp"]。

x64 已执行 Windows runner 原生 WebView2 与打包后 CLI/MCP 冒烟验收；ARM64 为交叉构建，仍需真实设备测试。包尚未添加发布者代码签名。
详见仓库 docs/windows-preview.md。每个 ZIP 都附 SHA-256。

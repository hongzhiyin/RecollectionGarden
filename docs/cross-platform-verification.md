# Mac / Windows 0.6.5 统一发布验收

2026-10-15。Desktop Release workflow 在同一提交上构建 Mac、Windows x64 / ARM64，全部平台构建与各自验收通过后统一发布。

[完整 CI 记录](https://github.com/hongzhiyin/RecollectionGarden/actions/runs/38758471648) · [统一下载](https://github.com/hongzhiyin/RecollectionGarden/releases/tag/v0.6.5-preview.2)

| 范围 | 结果 |
| --- | --- |
| Mac / Windows：56 项单元、三项服务测试、类型检查与构建 | 通过 |
| Mac DMG 校验、卸载原卷后 app 重定位、深度签名检查 | 通过 |
| Mac 包内 CLI 在无系统 Node 的环境中启动 | 通过 |
| Mac 包内服务：Chrome 中实际 PDF 导入、像素与文本层 | 通过 |
| Mac CLI/MCP：23 项工具发现、阅读上下文就绪、书架、打开和原文读取 | 通过 |
| Windows x64 原生 WebView2：导入、页面像素、可选文本层、窗口连接 | 通过 |
| Windows x64 CLI/MCP：握手、23 项工具发现、上下文、书架、打开和原文读取 | 通过 |
| Mac DMG、Windows x64 / ARM64 ZIP 与各自 SHA-256 同版发布 | 通过 |
| ARM64 Windows 原生运行 | 待真实设备验收 |

Mac 使用标准 macos-26 ARM64 runner。CLI/MCP 验收显式等待 context.get 确认 PDF 就绪，Mac 测试对 worker 加载增加延迟以覆盖打开后的等待过程。sessions.list 中有连接快照不代表 PDF 已完成打开。

Mac 云端阅读验收使用 Chrome，不等同于 AppKit/WKWebView 原生窗口自动验收；原生阅读能力沿用既有 macOS 26.6.2 手动验收范围。所有复杂 PDF、笔记编辑、导出及异常恢复的跨平台全量验收未扩展。

各包内置 Node.js 22.22.2，Windows 另附 .NET。资源白名单排除个人 PDF、运行令牌和浏览器数据；验收采用合成 PDF、临时数据目录和独立端口。
Mac 为 ad-hoc 签名，未 Developer ID 签名或公证；Windows 无发布者签名。阅读数据仍在各设备本地保存。

历史 Windows 0.6.4 验收记录：[已通过的 Windows CI](https://github.com/hongzhiyin/RecollectionGarden/actions/runs/38689092428)。公开仓库使用标准 GitHub 托管 runner；[官方规则](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。

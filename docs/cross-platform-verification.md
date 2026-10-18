# 流光忆庭 0.7.3 / DreamEdge 0.0.2 Windows 配套验收

2026-10-19。阅读器提交 `01496bf71c80c40ac5a33b5345007045b8891aca`，DreamEdge 提交 `ac2d7bb37307e9f98419425397a6ae6b31231d4f`。

[本轮 CI](https://github.com/hongzhiyin/RecollectionGarden/actions/runs/39151768743) · [配套下载](https://github.com/hongzhiyin/RecollectionGarden/releases/tag/v0.7.3-preview.18)

| 范围 | 结果 |
| --- | --- |
| Windows x64：DreamEdge 实际包打开对话页、使用独立资料区、提供正常退出菜单 | 通过 |
| Windows x64：阅读器 PDF 导入、文本层、CLI / MCP 原有能力 | 通过 |
| Windows x64：实际两端包的原生嵌入、绑定窗口上下文及当前页原文读取 | 通过 |
| Windows x64：AI 发起翻页，阅读器实际到达第 2 页；设置开关保留会话 | 通过 |
| Windows：入口解析、拒绝授权、取消、输出限制、JSON 分片及管道未关闭回归 | 通过 |
| Windows ARM64：两端打包及 SHA-256 | 通过，原生运行待实机试用 |
| macOS：阅读器打包、重定位、CLI / MCP 与阅读回归 | 通过 |

联动测试使用合成 PDF、独立临时资料区和本地模型协议夹具，未使用个人 API Key 或书籍。原文读取与翻页均由实际 MCP 调用完成，未伪造阅读器状态；真实模型服务商与用户 Windows 设备仍需人工试用。

修复了 Windows 后台进程保留管道句柄导致交接误超时的问题：读取完整 JSON 并确认启动器退出后完成交接，不等待后台关闭输出管道。仍保留取消、超时和输出大小限制。失败后的“重新加载”可以重新发起会话。

截图与机器报告保存在本轮 CI 的 `windows-native-verification` 附件，飞书需求记录保留同版嵌入区截图。下载与配置步骤见 [Windows 体验版](windows-preview.md) 和发布页。

---

# 历史：Mac / Windows 0.6.5 统一发布验收

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

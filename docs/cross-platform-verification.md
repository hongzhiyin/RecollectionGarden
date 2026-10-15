# Windows 0.6.4 体验版验收

2026-10-15。两种架构均由 .NET 10 交叉发布，内置 Node.js 22.22.2，ZIP 附 SHA-256。应用、CLI、WebView2 加载器和 Node 的 PE 架构已分别核对为 x64 / ARM64；包中不包含用户 PDF、运行令牌或浏览器数据。

| 范围 | 结果 |
| --- | --- |
| 本机类型检查、56 项单元测试、桌面服务回归 | 通过 |
| Windows runner 单元与三项服务测试 | 通过 |
| x64 原生 WebView2：导入、页面像素、可选文本层、窗口连接 | 通过 |
| x64 打包后的 CLI JSON 输出、MCP 握手与 23 项工具发现 | 通过 |
| 修正隔离目录传递后的 .NET CLI/MCP 与实际桌面服务调用 | macOS 本机通过，Windows 最终重跑待完成 |
| ARM64 原生运行与完整手动阅读流程 | 待真实设备验收 |

Windows 原生验收记录：[读取窗口与标准流构建](https://github.com/hongzhiyin/RecollectionGarden/actions/runs/38687648213)。该轮完整 RPC 验收停在隔离目录配置，随后已修正脚本传递。
最新重跑因 GitHub 账户账单/额度限制未能启动：[受限任务](https://github.com/hongzhiyin/RecollectionGarden/actions/runs/38688198912)。本次体验包使用修正后的代码在维护者本机交叉生成并手动上传 Releases。

自动构建与发布流程已入库。账户限制解除后，可在 Windows Desktop workflow 中重新运行完整验收。用户体验包尚无发布者代码签名；数据在本机保存，暂不跨设备同步。

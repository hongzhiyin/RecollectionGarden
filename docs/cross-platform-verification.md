# Windows 0.6.4 体验版验收

2026-10-15。仓库已公开，标准 GitHub 托管 runner 正常执行；最新自动构建、验收和发布均成功。

[完整 Windows CI 记录](https://github.com/hongzhiyin/RecollectionGarden/actions/runs/38689092428) · [已验收下载包](https://github.com/hongzhiyin/RecollectionGarden/releases/tag/v0.6.4-preview.7)

| 范围 | 结果 |
| --- | --- |
| Windows 单元与三项服务测试 | 通过 |
| x64 原生 WebView2：导入、页面像素、可选文本层、窗口连接 | 通过 |
| x64 打包后 CLI JSON 输出、MCP 握手与 23 项工具发现 | 通过 |
| x64 MCP：书架读取、打开书籍、读取第一页原文 | 通过 |
| x64、ARM64 自动构建和发布 | 通过 |
| ARM64 原生运行与完整手动阅读流程 | 待真实设备验收 |

两种包均内置 Node.js 22.22.2 与 .NET 运行环境，ZIP 附 SHA-256。打包资源白名单排除用户 PDF、运行令牌和浏览器数据。早期本机交叉构建包的四项原生文件架构也已分别核对为 x64 / ARM64。

历史私有仓库重跑曾受账户账单/额度限制；改为公开仓库后，本轮标准 runner 已恢复。计费规则见 [GitHub Actions 官方说明](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。

体验包尚无发布者代码签名；阅读数据在各设备本地保存，暂不跨设备同步。未将冒烟验收扩展为所有复杂 PDF、笔记编辑、导出及异常恢复的 Windows 全量验收。

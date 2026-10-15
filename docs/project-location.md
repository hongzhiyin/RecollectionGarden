# 项目目录与入口

项目根目录：`/Users/chihoyo/Project/RecollectionGarden`。
桌面应用：`releases/流光忆庭.app`。运行环境、CLI 和 MCP 均在应用包内。

| 环境 | CLI / MCP 入口 | 界面 / 服务 |
| --- | --- | --- |
| 桌面版（Codex 默认） | `releases/流光忆庭.app/Contents/MacOS/recollection-garden`；MCP 参数为 `mcp` | 4321 / 4322 |
| 开发版 | `node bin/recollection-garden.mjs`；MCP 为 `node bridge/mcp.mjs` | 4318 / 4320 |

桌面服务配置：`~/Library/Application Support/RecollectionGarden/Desktop`。
开发服务配置：项目下 `.runtime/bridge.json`。两种环境的数据空间独立；配置中的令牌不得输出。
已安装 skill：`~/.codex/skills/recollection-garden-reading`，本机入口记录于 `references/local-install.md`。

## 迁移验收

2026-10-15，V0.6.3。项目整体原子移动，原目录已移除；依赖、临时文件和已有构建随目录保留。源码、锁文件与应用主程序哈希一致，应用深度签名检查及类型检查通过。

实际桌面窗口正常打开，原书和第 106 页位置恢复；内置 CLI 可列出当前桌面会话。Codex 配置指向新位置的内置 MCP 入口。从 `/private/tmp` 启动该入口，23 项工具发现、书架读取和当前上下文读取通过。开发 MCP 同样通过 23 项工具发现与原有网页书架读取。

Codex 已运行会话中的旧 MCP 进程不会随目录移动刷新，需要重启 Codex 载入新入口。配置文件已备份到 `~/.codex/config.toml.before-recollection-move-20261015`。

详细结果见 [验收摘要](project-move-verification.json)。

# macOS 桌面体验包

V0.6.5，Apple Silicon / macOS 26 桌面体验构建。既有原生阅读能力已在 macOS 26.6.2 验收。原生 AppKit 独立窗口嵌入 WKWebView，随包携带 Node.js 和本地能力服务。

WebKit 文本读取使用 ReadableStream.getReader 兼容路径，避免缺少异步迭代器时无法选取或定位原文。
依据：[PDF.js 上游问题](https://github.com/mozilla/pdf.js/issues/21924)。已在实际桌面 WebKit 中验证原文读取、高亮和返回；没有用浏览器模拟结果代替桌面验收。

从 Releases 下载 `macos-arm64.dmg`，打开后将“流光忆庭.app”拖到应用程序，再双击打开。DMG 内只有应用，不附带其他安装文件。桌面版使用独立数据空间，首次重新导入 PDF；浏览器里的书籍、笔记和进度保留。
关闭窗口后应用继续运行，可从程序坞重新打开；Command-Q 退出。退出时对未保存笔记提供确认，阅读位置恢复到最后成功保存处。
导出 Markdown 使用系统保存面板。

本地界面使用 127.0.0.1:4321，能力服务使用 4322；与开发版的 4318/4320 分开。
服务配置和日志放在 ~/Library/Application Support/RecollectionGarden/Desktop，应用包不包含用户 PDF、笔记、运行令牌或现有 Codex 配置。

CLI：

```sh
/应用所在路径/流光忆庭.app/Contents/MacOS/recollection-garden sessions
/应用所在路径/流光忆庭.app/Contents/MacOS/recollection-garden call notes.search --input @request.json
```

外部 AI 的 MCP command 指向“流光忆庭.app/Contents/MacOS/recollection-garden”的绝对路径，args 为 ["mcp"]。
入口随应用移动；移动后更新 command 路径。本机 Codex 已配置为新目录中的桌面版入口，源码入口仍可单独用于开发环境。

维护者打包：先 npm ci，再 npm run package:mac。直接输出 releases/流光忆庭.app，运行环境与 CLI/MCP 均内置。`npm run package:mac -- --release` 额外生成 DMG 和 SHA-256；`--output <路径.app>` 可指定独立输出以保留正在使用的 app。构建使用 ad-hoc 签名，尚未 Developer ID 签名或公证。
Node.js 许可证与前端依赖许可随包保存，其他依赖保留各自 node_modules 许可证。

## V0.6.1 阅读能力验收

2026-10-15，macOS 26.6.2 / Apple Silicon。56 项单元、45 项生产浏览器和 2 项服务协议测试通过，类型检查与构建通过。

独立 WebKit 验收空间使用 3 页合成 PDF，验证系统文件面板导入、页面渲染、原文读取与精确高亮、返回主位置、笔记编辑保存、Markdown 系统保存面板及完整退出重开后的两条笔记与版本恢复。未保存输入退出确认通过。包内 stdio MCP 可发现 23 项工具，实际原文读取、定位、返回和导出与桌面界面一致。

最终 ZIP 解压到新目录后通过深度签名检查；清除外部 Node 路径后仍可运行包内 CLI。正式体验窗口已成功启动，验收数据与正式数据空间隔离。旧版 macOS、Intel Mac 和全书复杂页面未扩展验收。

结果见 [验收摘要](desktop-verification.json)。

## V0.6.2 启动修复与验收

2026-10-15，macOS 26.6.2 / Apple Silicon。

原因：多个应用副本各自启动固定端口服务，后启动的副本报 EADDRINUSE。
应用以文件锁保证单实例，重复打开时唤起现有窗口，第二个副本立即退出。
窗口唤起使用 [NSRunningApplication](https://developer.apple.com/documentation/appkit/nsrunningapplication?language=objc) 和应用内窗口恢复通知。
父应用通过管道持有服务生命周期；管道断开或收到退出信号时，服务关闭 HTTP、WebSocket 和能力接口。
正常退出等待服务停止后释放实例锁。未保存笔记仍沿用原有退出确认。

验收通过：实际桌面首次启动、异路径副本重复启动、关闭窗口后恢复、Command-Q 释放 4321/4322、退出后重新打开。
重复启动前后服务 PID 不变，未新增端口冲突日志；两项针对性服务回归、类型检查、构建、深度签名检查及无外部 Node 的 CLI 检查通过。
本轮未重复执行 V0.6.1 的完整阅读功能测试。

结果见 [启动验收摘要](desktop-startup-verification.json)。

## V0.6.3 扫描页显示修复

2026-10-15。扫描图像的像素数限制会过滤整页图像，造成空白；改为保留图像，由 PDF.js 在支持的环境中按 32 MB 画布面积预算缩小。最终页面画布仍受 800 万像素限制。
参数行为见 [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)。

原文件第 34 页为 5100 × 6608、600 dpi 的 JBIG2 扫描图，含 3370 万像素，没有文字层。
实际桌面验收确认该页可读，升级后原书和第 34 页阅读位置保留。扫描页选取仍需后续 OCR 能力。
新增同尺寸扫描图回归，覆盖显示像素、翻页、重开恢复和最终画布限制；加上文本选取回归共 6 项通过。类型检查、构建与深度签名检查通过。
用户文件仅放在本地忽略的临时目录，未进入应用包。

结果见 [扫描页验收摘要](desktop-scan-verification.json)。

## 自动构建与统一发布

Desktop Release workflow 使用标准 `macos-26` ARM64 runner 构建 Mac，Windows job 构建 x64 和 ARM64。同一提交的全部平台通过构建与各自验收后，才汇总到一个 Release。

Mac 自动验收挂载 DMG、复制 app 到另一目录、卸载原卷，检查签名和包内 CLI 在无外部 Node 时可用，再用临时数据和端口验证生产阅读页面、像素、文本层、CLI/MCP 及服务退出。浏览器使用 runner 的 Chrome，此范围不等同于原生 AppKit/WKWebView 自动验收。验收结束清理临时数据，不输出配对令牌。

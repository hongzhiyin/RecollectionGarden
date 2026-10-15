# RecollectionGarden

流光忆庭 / Garden of Recollection。V0.6.5 提供本地 PDF 阅读、引用、笔记、CLI/MCP 能力接口和外部对话展示，可打包为 Mac 与 Windows 桌面体验版。

## 运行

Mac / Windows：在 [GitHub Releases](https://github.com/hongzhiyin/RecollectionGarden/releases) 统一下载各平台体验包。Mac 选 `macos-arm64.dmg`，Windows 选对应架构 ZIP；详见 [Mac 使用与打包](docs/desktop-preview.md)和 [Windows 使用与打包](docs/windows-preview.md)。

Mac 桌面体验版：`npm run package:mac` 生成独立 Apple Silicon `.app`，加 `-- --release` 生成 DMG 和校验文件；使用方式及独立数据空间见 [桌面体验包](docs/desktop-preview.md)。

需要 Node.js 22.18+；当前验收使用 22.22.2。CLI 和 MCP 直接使用 Node 的 TypeScript 类型剥离。

```sh
npm ci
npm run dev -- --port 4317
```

开发地址：<http://127.0.0.1:4317>。

```sh
npm run build
npm run preview -- --port 4318
```

生产预览：<http://127.0.0.1:4318>。

## 外部 AI 接入

另一个终端启动本地服务：

```sh
npm run bridge
node bin/recollection-garden.mjs sessions
```

在书架或阅读器的“外部对话”窗口点击“连接本地服务”。连接只允许回环地址和已配置的页面来源；默认应用地址为 4317、4318，能力服务为 4320。

```sh
node bin/recollection-garden.mjs call context.get --input @request.json
node bridge/mcp.mjs
```

CLI 和 MCP 使用相同操作与 JSON 输入。MCP 宿主直接启动 `node`，参数为项目的 `bridge/mcp.mjs` 绝对路径；保持 stdout 为协议输出，不使用带 npm 日志头的启动方式。

随附 [陪读 skill](skills/recollection-garden-reading/SKILL.md)，[接口说明](skills/recollection-garden-reading/references/interfaces.md)包含会话选择、上下文版本、消息回传和重试规则。本机已安装到 `~/.codex/skills/recollection-garden-reading`，并通过 `~/.agents/skills` 中的链接提供发现入口；安装副本的 `references/local-install.md` 记录项目路径。

本机项目目录为 `/Users/chihoyo/Project/RecollectionGarden`。Codex 原生 MCP 名称为 `recollection-garden`，启动 `releases/流光忆庭.app/Contents/MacOS/recollection-garden`，参数为 `["mcp"]`，默认连接桌面版。开发版仍可使用上面的源码入口，数据空间与桌面版独立。可用 `codex mcp get recollection-garden` 检查配置，在 Codex 中调用 `$recollection-garden-reading` 使用陪读流程。配置或项目路径变更后，重启 Codex 刷新已有 MCP 进程，并同步更新 skill 的本机路径记录。配置方式见 [Codex MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

外部 AI 在自己的宿主生成回答，通过 `conversation.publish` 主动回传。阅读器不调用模型、不保存模型凭据、不自动同步宿主完整聊天历史。消息为纯文本并附有效引用，可临时查看原文、返回阅读处或明确从当前位置继续。

## 功能

- 本地文件导入、SHA-256 去重、首页面渲染检查和缩略图。
- 重复文件可打开已有书籍或创建独立副本，副本复用同一 PDF 资产。
- IndexedDB 事务保存，失败回滚；导入前可取消，失败可重试。
- 书名修改、搜索、阅读状态筛选。
- 原版式单页阅读、层级目录与具名目标、物理页跳转、辅助书内页码。
- 25%～300% 缩放、适应宽度，恢复页码、缩放与双轴页内相对位置。
- 旧进度兼容，页面失败与保存失败分别重试；关闭阅读器主动完成保存。
- 同页跨行文字选取与原文复制；解释、举例、提问和笔记的本地引用草稿。
- 原文与编辑文字独立保存，引用跨页回跳及高亮；缩放和重开后重新定位，失效时只回来源页。
- 临时引用查看保留主阅读位置，明确继续后才更新；隐藏阅读窗口时也可通过 MCP 定位原文及返回。
- 23 项 CLI/MCP 操作，包含八项笔记能力，支持显式窗口与书籍、上下文版本、请求去重和消息序号保护。
- 摘录、AI 回答快照及页笔记；个人内容独立编辑，显式保存与重开恢复。
- 书内关键词检索、类型筛选与排序；原文、已存问答和个人内容联合匹配。
- 笔记快照定位、书架打开来源、页笔记定位和返回主阅读处；失效或提取失败明确退回页级。
- 全部笔记或检索结果导出 Markdown；外部按内容摘要分块读取，文件缺失时仍可导出。
- 单条查看、版本冲突保护、保存失败保留输入和删除确认。
- 书架可查看与编辑已保存笔记，PDF 字节或外部连接不可用时仍可使用。
- 多页面导入同步；普通导入不上传 PDF 或调用外部服务。

当前限制：32 MiB、2,000 页，单张图像最多 1,600 万像素。PDF 仅检查基础装载与首个页面；超大图像或后续页面可能无法完整显示。

数据保存在当前浏览器、当前站点，包括笔记及已回传消息。清理站点数据会删除文件与记录；备份、跨设备同步和跨书语义检索尚未实现。异常关闭只恢复最后成功提交的位置；多窗口主进度接管尚未实现。

选段仅限同一页，每段最多 10,000 字符。原文保留 PDF 提取顺序和断行，编辑文字仅清理断行空白；跨页选取、OCR、双栏语义排序和特殊字体修正尚未实现。草稿可保存为引用或摘录笔记；个人笔记正文最多 20,000 字符。

目录只使用 PDF 内置数据，外部链接不执行跳转。单页 Canvas 分配最多 800 万像素、边长最多 8,192；大尺寸页面降低渲染精度以控制分配。

## 验证

```sh
npm run check
npm test
npm run build
npm run test:e2e
E2E_BASE_URL=http://127.0.0.1:4318 npm run test:e2e
node --test tests/service/bridge.test.mjs
```

浏览器测试使用已安装的 Google Chrome。测试样例位于 `tests/fixtures`，包括中文、英文、图像、密码、损坏与页数边界 PDF；无需私人书籍。

浏览器外部接口用例要求本地能力服务已启动。验证环境：macOS、Node.js 22.22.2、Chrome 155.0.8059.39。56 项单元测试、45 项生产构建浏览器用例及 2 项服务协议测试通过。386 页真实书籍完成摘录、AI 回答保存、编辑和重开恢复；当前 Codex 对话已通过原生 MCP 验证笔记创建、读取、编辑、确认删除、去重和版本冲突；删除测试笔记后原书、引用、历史消息及主阅读位置保留。V0.6.0 的检索、来源定位、返回与导出已通过当前 Codex 对话原生 MCP 验收；导出全文及摘要与界面、CLI 一致。具体覆盖见 [验收记录](docs/verification.md)。

## 结构

- `src/import`：导入编排、状态与后台摘要。
- `src/library`：数据模型、事务仓储与书架查询。
- `src/pdf`：文档会话、目录与导航、渲染和位置保存队列。
- `src/citations`：原文锚点、引用草稿与独立存储。
- `src/notes`：来源快照、笔记仓储、编辑与未保存输入保护。
- `src/external`：共享协议、浏览器桥、持久化消息与请求结果。
- `bridge` / `bin`：本地能力服务、CLI、stdio MCP 适配器。
- `skills/recollection-garden-reading`：项目随附陪读 skill。
- `src/ui` / `src/styles`：书架、弹窗与状态反馈。
- `public/pdf`：从锁定的 PDF.js 包生成的字体、CMap 与 WASM 资源，不入版本控制。

项目目录迁移与验证结果见 [目录与入口](docs/project-location.md)。

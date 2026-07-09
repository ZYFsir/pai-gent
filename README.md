# pai-gent

基于 pi coding agent SDK 的网页聊天前端。以报刊式排版美学为核心，采用莫兰迪色系，追求极致的流式交互体验。

## 核心理念

**流畅优先** — 页面加载、会话创建、流式传输全程无卡顿，借助 CSS 动画与 RAF 滚动营造丝滑手感。

**报刊排版** — 借助 pretext 前端排版库，以杂志式的字体层级、字距、行距营造阅读沉浸感。无图标，以纯文字排版传达信息。

**莫兰迪色系** — 低饱和、暖灰基调，视觉柔和且克制。

## 技术栈

| 层 | 选型 |
|---|------|
| 框架 | Next.js 15 (App Router) |
| 样式 | Tailwind CSS v4 + 自定义 CSS 变量 |
| 状态 | Zustand v5 |
| Markdown | react-markdown + remark-gfm |
| SDK | @earendil-works/pi-coding-agent |
| 运行 | Bun / Node.js |

## 项目结构

```
src/
├── app/
│   ├── layout.tsx                    # 根布局，全局元数据
│   ├── globals.css                   # 莫兰迪色系变量 + 动画 + 排版
│   ├── page.tsx                      # 主页面入口
│   ├── login/page.tsx                # 登录页面
│   └── api/
│       ├── auth/route.ts             # 认证 (POST/DELETE)
│       ├── chat/route.ts             # 流式对话 (SSE)
│       ├── models/route.ts           # 模型列表
│       ├── sessions/
│       │   ├── route.ts              # 会话 CRUD
│       │   └── [id]/
│       │       ├── route.ts          # 删除会话
│       │       └── messages/route.ts # 加载历史消息
│       └── settings/route.ts         # 设置读写
├── components/
│   ├── chat/
│   │   ├── chat-view.tsx             # 主聊天视图
│   │   ├── message-card.tsx          # 消息气泡 + Markdown
│   │   ├── message-input.tsx         # 输入框（发送/停止）
│   │   ├── session-sidebar.tsx       # 侧边栏会话列表
│   │   ├── settings-panel.tsx        # 设置面板（模型/思维/密钥）
│   │   ├── thinking-block.tsx        # 思维过程折叠区
│   │   └── tool-call-block.tsx       # 工具调用展示
│   └── ui/
│       ├── button.tsx                # 按钮组件
│       └── error-boundary.tsx        # 错误边界
├── lib/
│   └── pi-bridge.ts                  # SDK 桥接层（会话持久化、SSE）
└── stores/
    └── chat-store.ts                 # Zustand 全局状态
```

## 数据流

```
用户输入 → MessageInput
    → chat-store.sendMessage()
    → POST /api/chat  (SSE 流)
    → pi-bridge → AgentSession.prompt()
    → SSE 事件分流:
       text_delta       → streamContent   (打字机效果)
       thinking_delta   → streamThinking  (折叠区)
       tool_start/exec  → streamToolCalls (执行卡片)
       done             → commitStream()  (写入消息列表)
```

## 莫兰迪色系 (Morandi Palette)

已全部实现为 CSS 变量，定义在 `globals.css`。色板整体低饱和、柔和。

| CSS 变量 | 色值 | 语义 |
|----------|------|------|
| `--bg-page` | `#f3eeea` | 页面底色 |
| `--bg-surface` | `#e4e6e1` | 卡片/面板底色 |
| `--bg-elevated` | `#e8d3c0` | 悬浮层 (暖燕麦灰) |
| `--bg-hover` | `#d4baad` | 悬停态 (烟粉) |
| `--accent` | `#849b91` | 主强调色 (灰绿) |
| `--accent-warm` | `#b77f70` | 暖强调色 (暗砖红) |
| `--accent-rose` | `#b57c82` | 错误/玫瑰强调 |
| `--text-primary` | `#676662` | 正文主色 |
| `--text-secondary` | `#88878d` | 次级文字 |
| `--text-tertiary` | `#aea9a6` | 辅助文字 |
| `--bubble-user` | `#d89c7a` | 用户消息气泡 |
| `--bubble-assistant` | `#e8d3c0` | 助手消息气泡 |
| `--border` | `#aea9a6` | 常规边框 |
| `--border-light` | `#d3d2d0` | 轻边框 |

字体栈:
- 正文: `Noto Serif SC`, Source Han Serif SC, serif
- 标题/展示: `ZCOOL XiaoWei`, Ma Shan Zheng, serif
- 代码: `JetBrains Mono`, Fira Code, monospace

## 动画系统

| 动画 | 用途 | 时长 |
|------|------|------|
| `slide-up` | 新消息卡片滑入 | 200ms ease-out |
| `fade-in` | 设置面板、弹窗出现 | 150ms ease-out |
| `blink` | 流式光标闪烁 | 1s step-end |
| `pulse-slow` | 加载等待指示器 | 2s ease-in-out ∞ |
| RAF 滚动 | 消息区自动滚底 | 16ms (60fps) |

所有动画遵循 `prefers-reduced-motion: reduce` 无障碍。

## 会话持久化

- 内存活跃会话: 30 分钟 TTL
- 磁盘缓存: `.pi/web-sessions/{id}.json`，24 小时 TTL
- 定时清理: 每 5 分钟检查过期会话
- 恢复策略: 从磁盘加载消息注入新 AgentSession，保证上下文连续

## 流式传输 SSE 事件

| 事件 | 数据字段 |
|------|----------|
| `text_delta` | `{ delta: string }` |
| `thinking_delta` | `{ delta: string }` |
| `tool_start` | `{ toolCallId, toolName, args }` |
| `tool_execution_start` | `{ toolCallId, toolName, args }` |
| `tool_execution_update` | `{ toolCallId, delta }` |
| `tool_execution_end` | `{ toolCallId, isError, output, error }` |
| `compaction_start/end` | `{}` |
| `retry_start/end` | `{ attempt, maxAttempts, success }` |
| `error` | `{ message }` |
| `done` | `{}` |

## 性能策略

1. **RAF 滚动**: 消息更新时使用 requestAnimationFrame 驱动滚动，避免 layout thrashing
2. **懒加载历史**: 切换会话时异步加载消息，不阻塞 UI
3. **流式解析**: SSE 解析在浏览器端逐行处理，不做批量缓冲
4. **code splitting**: Next.js 自动组件级代码分割
5. **Overscroll behavior**: 消息区设置 `overscroll-contain` 防止弹性滚动触发意外重载
6. **Tailwind JIT**: 仅生成实际使用的 CSS，样式体积极小
7. **渲染优化**: 消息卡片仅在 resp. 使用 react-markdown，用户消息直接渲染文本

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev        # → http://localhost:3000

# 类型检查
bun run typecheck

# 生产构建
bun run build && bun run start
```

### 生产部署 (Cloudflare Tunnel)

```bash
# 服务已配置于 pi.yifhhh.xyz
cd /root/pai-gent
nohup npx next dev --port 3001 -H 127.0.0.1 > /tmp/pai-gent.log 2>&1 &
```

详见 `.pi/skills/home-server/SKILL.md`。

## 环境变量

无需 `.env`，认证凭据内置于 `middleware.ts`。API Key 通过设置面板运行时注入。

## 实现状态

- [x] pretext 排版库集成 (`@chenglou/pretext` — 文本测量与排版)
- [x] 莫兰迪色系全量迁移 (30 色 CSS 变量)
- [x] 全无图标化界面 (移除 lucide-react，纯文字 + Unicode)
- [x] 报刊排版元素 (首字下沉 `.drop-cap`、引文 `.pull-quote`、栏间线 `.section-rule`)
- [x] 中文 Google Fonts (Noto Serif SC + ZCOOL XiaoWei + JetBrains Mono)
- [x] 流式动画系统 (slide-up, fade-in, stagger, blink-cursor)
- [ ] 会话重命名
- [ ] pretext Canvas 渲染管线（消息卡片手动行排版）
- [ ] 流式 Markdown 增量渲染优化

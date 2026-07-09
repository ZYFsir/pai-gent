---
type: note
title: pai-gent 部署与更新注意事项
description: 更新代码后如何确保新 build 生效，避免旧进程残留导致修改不生效
resource: pai-gent
tags: [deployment, process, checklist]
timestamp: 2026-07-08
---

# pai-gent 部署与更新

## 关键规则

**每次修改源码后，必须 build + 强杀旧进程 + 重启，缺一不可。** 旧进程不杀干净会导致浏览器拿到旧版 JS。

## 标准流程

```bash
# ① 构建
cd /root/pai-gent && bun run build

# ② 强杀旧进程（注意进程名是 next-server，不是 next start/next dev）
pkill -9 -f "next-server" 2>/dev/null
sleep 2

# ③ 启动新进程（绑定 127.0.0.1:3001）
cd /root/pai-gent && nohup bun run start --port 3001 > /tmp/pai-gent.log 2>&1 &

# ④ 验证：确认 serve 的 JS 文件 hash 与 .next/static/chunks/app/ 一致
sleep 3
curl -s http://127.0.0.1:3001/ | grep -o 'page-[a-f0-9]*\.js' | head -1
ls .next/static/chunks/app/page-*.js
```

## 常见陷阱

| 陷阱 | 原因 | 检查方法 |
|------|------|----------|
| 浏览器看不到修改 | 旧进程未杀掉，`next-server` 依旧 serve 旧 build | `ss -tlnp \| grep 3001` 确认 PID，对比进程启动时间 |
| pkill 失效 | 进程名是 `next-server (v1)` 不是 `next start` | 用 `pkill -9 -f next-server` 而非 `pkill -f "next start"` |
| Cloudflare CDN 缓存 | Cloudflare 缓存了旧 JS | 浏览器 Ctrl+Shift+R 硬刷新；或直连 `http://<IP>:3001` 绕过 |
| build 被跳过 | 以为只需重启，实际 `.next/` 仍是旧版本 | 对比 `ls -la .next/static/chunks/app/` 的时间戳 |

## 相关文件

- 服务入口：`package.json` → `"start": "next start"`
- 构建输出：`.next/` 目录
- 服务日志：`/tmp/pai-gent.log`
- Cloudflare Tunnel 配置：`/etc/cloudflared/config.yml`（路由 `pi.yifhhh.xyz` → `localhost:3001`）

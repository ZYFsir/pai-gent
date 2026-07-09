# AGENTS.md

- `doc/` 用于沉淀项目研究与知识文档，按 Google OKF（Open Knowledge Format）组织。
- `doc/` 下文档使用 Markdown + YAML frontmatter，至少包含：`type`、`title`、`description`、`resource`、`tags`、`timestamp`。
- 一份文档表达一个明确主题；目录入口使用 `doc/index.md`，必要时可添加 `log.md`。
- 文档之间优先使用相对 Markdown 链接互相关联，保持人类可读、代理可解析。

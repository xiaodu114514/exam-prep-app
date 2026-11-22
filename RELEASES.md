# 发布记录

> 项目暂未接入 Git（本机无 git），先以本文件记录每次发布，作为可追溯版本记录。

## v1.8.0（2026-11-22 17:05）— 星期任务（替换每日任务）

**发布内容**：
- 「每日任务」概念移除，改为「星期任务」：任务可选择星期（周一~周日，可多选），支持快捷档位「工作日 / 周末 / 每天」；
- 数据：`tasks.weekdays` 位掩码（schema v6），旧 `daily=1` 任务自动迁移为「每天」（全选 7 天）；
- 前端表单：星期按钮多选 + 快捷档位；任务卡片显示「每天 / 工作日 / 周末 / 周一 · 周三」；
- Agent API 支持 `weekdays`（兼容旧 `daily`）。

**数据库迁移**：schema v5 → v6（加 `weekdays` 列 + 迁移 daily=1 → 127）。生产 53 条任务完整保留，5 个旧每日任务迁移为每天型。

**备份位置（/srv/exam-prep/backups/）**：
- 数据库：`app-20261122-170406.db`（迁移前，完整性 ok，user_version=5，53 任务）
- 旧后端源码：`server-src-20261122-170406.tar.gz`
- 旧前端：`frontend-20261122-170406.tar.gz`

**验收结果**：user_version=6、health 200、首页/SPA 200（新 JS hash）、Agent 创建工作日任务→周一出现/周六不出现（线上实测）、测试数据已清理。

**回滚方式**：后端恢复 `server-src-20261122-170406.tar.gz` + 重启；数据库恢复 `app-20261122-170406.db`（v5 快照）；前端恢复 `frontend-20261122-170406.tar.gz`。

**未验证**：浏览器端真人点击验证（本地 296 个测试通过）。

---

## v1.7.0（2026-11-14 15:20）— 每日任务按日期独立记录 + Agent 打勾/删除接口

**发布内容**：
1. **周汇总 Bug 修复**：每日任务完成状态改为按「任务 ID + 日期」独立存储（新表 `task_completions`），历史完成记录永久保留、补录不串日、取消不串日、背诵贡献精确可撤销；
2. **Agent 开放接口新增**：`POST /api/agent/tasks/:id/complete`（打勾/取消，支持 doneDate 补录与 completedAmount）、`DELETE /api/agent/tasks/:id`（删除任务并撤销贡献）；
3. 同步更新 `skills/exam-prep-agent/SKILL.md`。

**数据库迁移**：schema v4 → v5（建 `task_completions` 表 + 迁移 `done_date` 历史记录）。生产库 45 条任务完整保留，迁移 6 条历史完成记录（与迁移源数量一致）。

**备份位置（/srv/exam-prep/backups/）**：
- 数据库：`app-20261114-151936.db`（迁移前，完整性校验 ok，user_version=4）
- 旧后端源码：`server-src-20261114-151936.tar.gz`
- 旧前端：`frontend-20261114-151936.tar.gz`

**验收结果**：user_version=5、task_completions 就绪、health 200、首页/SPA 200（新 JS hash）、Agent 新接口线上实测（创建→打勾→取消→删除→清理）全部通过。

**回滚方式**：后端恢复 `server-src-20261114-151936.tar.gz` + 重启；数据库恢复 `app-20261114-151936.db`（v4 快照）；前端恢复 `frontend-20261114-151936.tar.gz`。

**未验证**：浏览器端真人点击验证（本地单测 283 个通过）。

---

## v1.6.0（2026-10-30 22:30）— 完成任务时填写实际完成量

**发布内容**：
- 完成「有任务量」的任务时弹窗填写**实际完成量**（默认 = 任务设置量，可修改，支持「按计划量填写」）；
- 背诵进度按实际完成量累计（服务端事务计算，`completed_amount` 记录实际量）；
- 主页与每日任务页均生效；无任务量的任务仍直接勾选完成。

**数据库迁移**：v3 → v4（tasks 加 `completed_amount` 列），原有 36 条任务数据完整保留。

**备份位置（/srv/exam-prep/backups/）**：
- 数据库：`app-20261030-222912.db`（迁移前）
- 旧后端源码：`server-src-20261030-222912.tar.gz`
- 前端暂存：`/srv/exam-prep/frontend/releases/v1.6.0-20261030`

**验收结果**：schema v4 生效、health 200、首页/SPA 200（新 JS hash）、Agent 接口 401/200 正常、后端日志无错误。

**回滚方式**：后端恢复 `server-src-20261030-222912.tar.gz` + 重启；数据库恢复 `app-20261030-222912.db`（去掉 completed_amount 列不影响使用）；前端恢复 v1.5.0 暂存。

**未验证**：登录后浏览器端点击完成弹窗流程（无生产账号凭据；本地 155 个测试与本地实测覆盖）。

---

## v1.5.0（2026-10-20 23:59）— Agent 开放接口 + 每日任务按学科分类

**发布内容**：
1. **Agent 开放接口**（独立 API Key 认证，与登录会话分离）：
   - `POST /api/agent/tasks`：添加任务（title 必填，date 默认今天，可选 subjectId/amount/daily）
   - `GET /api/agent/stats?date=`：今日/本周完成度、按学科统计、科目背诵进度、考试倒计时
   - `GET /api/agent/tasks?date=`：任务列表
   - 认证：`X-Agent-Key` 或 `Authorization: Bearer`；未配置 Key 时接口 503
2. **每日任务页改为按学科分类**：按科目分组展示（每组头部显示科目名、单位、已背量、完成数），无科目任务归「其他任务」组。

**配置变更**：`/etc/exam-prep.env` 新增 `AGENT_API_KEY`（随机生成，未打印到部署日志）。

**备份位置（/srv/exam-prep/backups/）**：
- 旧后端源码：`server-src-20261020-235707.tar.gz`
- 前端暂存：`/srv/exam-prep/frontend/releases/v1.5.0-20261020`

**验收结果**：首页 200、SPA 200、health 200、Agent 无 key 401 / 有 key 200、Agent 添加任务 201 并清理、后端日志无错误。

**回滚方式**：后端恢复 `server-src-20261020-235707.tar.gz` + 重启；前端恢复上一版快照（v1.3.0 暂存 `v1.3.0-20261015`）；环境变量删除 AGENT_API_KEY 行。

**未验证**：登录后浏览器端实测（无生产账号凭据）、PWA 浏览器安装/离线、HTTPS。

---

## v1.3.0（2026-10-15 22:32）— 可自定义应用文案（前后端 + 数据库）

**发布内容**：
- 新增「文案设置」：应用名称、主页问候语（留空按时间自动）、主页口号（留空用默认）均可自定义，登录页/侧边栏/浏览器标题/主页同步生效；
- 后端新增 `app_texts` 表（schema v3 迁移）与 `PUT /api/texts` 接口，`GET /api/data` 与导入导出兼容 texts；
- 前端最新 dist（v1.3.0 暂存：`/srv/exam-prep/frontend/releases/v1.3.0-20261015`）。

**数据库迁移**：v1 → v3 自动迁移（tasks 加 daily/done_date + 建 app_texts），线上原数据完整保留（2 条任务）。

**备份位置（服务器 /srv/exam-prep/backups/）**：
- 数据库：`app-20261015-223104.db`（迁移前快照，user_version=1，完整性已校验）
- 旧后端源码：`server-src-20261015-223038.tar.gz`
- 旧前端：`frontend-20261015-222146.tar.gz`
- Nginx 配置：`nginx-8.155.135.143.conf.bak.20261015-222429`

**验收结果**：首页 200、新 JS 200、SPA `/login` `/settings` 200、`/api/health` 200、未登录 me 401、后端日志无错误、schema v3。

**回滚方式**：后端 = 恢复 `server-src-20261015-223038.tar.gz` + 重启；数据库 = 恢复 `app-20261015-223104.db`（停止后端后替换）；前端 = 恢复 `frontend-20261015-222146.tar.gz`。

**未验证**：登录后数据读写（无生产账号凭据）、浏览器端 PWA 安装/离线、HTTPS（未配置，COOKIE_SECURE 保持 0）。

---

## v1.2.0（2026-10-15 22:2x）— 前端发布：登录版 + 每日任务 UI

**发布内容**：
- 新版前端（本地 dist 构建产物）：登录页、初始化门禁、五页面服务器数据版、每日任务 UI、PWA 最新构建（precache 22 项）。
- 新增 SPA 路由回退规则（Nginx 站点伪静态）：`location / { try_files $uri $uri/ /index.html; }`。

**未随本次发布**（线上仍为旧版）：
- 后端源码（每日任务 API、CSRF Origin 校验等仍在线上旧版本运行，前端每日任务开关暂不生效）；
- 数据库（线上 schema v1 未迁移，未触碰线上数据）。

**备份位置（服务器）**：
- 线上前端快照：`/srv/exam-prep/backups/frontend-20261015-222146.tar.gz`（43 条目）
- Nginx 站点配置：`/srv/exam-prep/backups/nginx-8.155.135.143.conf.bak.20261015-222429`
- 新前端暂存：`/srv/exam-prep/frontend/releases/v1.2.0-20261015/`

**验收结果**：首页 200（标题「稳步备考」）、新 JS/SW/manifest 200、SPA `/tasks` `/login` `/memorize` 200、`/api/health` 200、域名 `study.xiaodu0315.top` 200、nginx -t 通过。

**回滚方式**：
1. 前端：`tar -xzf /srv/exam-prep/backups/frontend-20261015-222146.tar.gz -C /www/wwwroot` 恢复旧文件；
2. Nginx：`cp /srv/exam-prep/backups/nginx-8.155.135.143.conf.bak.20261015-222429 /www/server/panel/vhost/nginx/8.155.135.143.conf` + 删除 `/www/server/panel/vhost/nginx/rewrite/8.155.135.143.conf`，然后 `nginx -t && nginx -s reload`。

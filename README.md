# 稳步备考

极简、清爽、移动优先的个人备考管理工具。前端 Vue 3 + TypeScript + Vite，后端 Fastify + SQLite，支持 PWA 离线访问与 Agent 开放接口。

- **线上地址**：https://study.xiaodu0315.top
- **源码仓库**：https://github.com/xiaodu114514/exam-prep-app

## 功能

- **主页**：考试倒计时、今日任务完成情况、各科背诵进度、常用网站快捷入口。
- **每日任务**：按日期切换；**按学科分组展示**（英语 / 政治 / 工程基础 …… 每个科目一组，无科目任务归「其他任务」）；任务增删改、完成状态切换、科目标签、背诵量、每日任务（每天自动出现）。
- **背诵计划**：按科目记录背诵总量 / 已完成量，支持增删改与边界校验。
- **周汇总**：按周统计任务完成情况与每日完成数量、各科进度。
- **设置**：考试信息、科目管理、快捷网站、**自定义文案**（应用名 / 问候语 / 口号）、数据导出、清理本地缓存、账号退出。
- **PWA**：可安装到桌面，离线打开应用壳，Service Worker 自动更新。
- **Agent 开放接口**：外部 Agent / 脚本可通过 API Key 添加任务、查询完成度。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3（`<script setup lang="ts">`）、TypeScript、Vite、Vue Router、lucide-vue-next、原生 CSS、vite-plugin-pwa |
| 后端 | Node.js 24 LTS、TypeScript、Fastify 5、better-sqlite3、@fastify/cookie |
| 数据库 | SQLite（WAL 模式，schema 版本迁移，事务） |
| 测试 | Vitest（前后端共用一套测试命令） |
| 部署 | Nginx（静态资源 + `/api` 反代）、宝塔面板 / `start.sh` 进程 |

## 架构

```
浏览器（PWA）
  │  HTTPS
  ▼
Nginx（study.xiaodu0315.top）
  ├── /            → 前端构建产物 dist/（SPA 回退 index.html）
  └── /api/        → 反向代理 http://127.0.0.1:3001
                        │
                        ▼
                 Fastify（仅监听 127.0.0.1:3001）
                        │
                        ▼
                 SQLite（/srv/exam-prep/data/app.db，WAL）
```

- 认证：登录会话（HttpOnly Cookie，Session Token 的 SHA-256 摘要存库）；Agent 接口使用独立的 `AGENT_API_KEY`。
- 数据以服务器为权威来源；前端登录后通过 `/api/data` 加载，所有变更走实体级接口。
- 背诵联动由服务端事务计算（任务完成 / 取消 / 编辑 / 删除 / 科目变更）。

## 目录结构

```
exam-prep-app/
├── src/                      # 前端
│   ├── main.ts               # 入口
│   ├── App.vue               # 应用壳（侧边栏 / 底部导航 / 加载遮罩）
│   ├── router/index.ts       # 路由 + 登录守卫
│   ├── types/index.ts        # 类型定义
│   ├── utils/date.ts         # 日期工具
│   ├── services/api.ts       # 后端 API 封装（401 全局处理）
│   ├── services/storage.ts   # 本地副本/旧数据兼容工具
│   ├── store/useAppStore.ts  # 集中式状态（loading/authenticated/guest）
│   ├── composables/useToast.ts
│   ├── components/           # 通用组件
│   └── views/                # 五个页面 + 登录页
├── server/                   # 后端（独立依赖）
│   ├── src/index.ts          # Fastify 组装、错误处理、CSRF 同源校验
│   ├── src/config.ts         # 环境变量
│   ├── src/db.ts             # 连接、schema 迁移（user_version）
│   ├── src/auth.ts           # 登录/会话/限流
│   ├── src/crypto.ts         # scrypt 哈希、SHA-256
│   ├── src/domain.ts         # 背诵贡献计算
│   ├── src/routes/           # auth/data/exam/tasks/subjects/sites/texts/importExport/agent/health
│   ├── scripts/init-admin.mjs# 交互式初始化管理员
│   └── test/                 # 后端测试
├── skills/exam-prep-agent/   # Agent 技能说明（SKILL.md）
├── public/                   # PWA 图标、favicon
├── RELEASES.md               # 发布记录
└── vite.config.ts            # Vite + PWA + /api 代理
```

## 本地开发

### 环境要求

- Node.js 24 LTS（`node -v` 应为 v24.x）
- npm 10+

### 启动后端

```bash
cd server
npm install
node scripts/init-admin.mjs data/app.db   # 交互式设置管理员用户名/密码（密码不回显）
npm run start                             # http://127.0.0.1:3001
```

### 启动前端

```bash
npm install
npm run dev                               # http://localhost:5173，/api 自动代理到后端
```

浏览器打开 http://localhost:5173，用初始化的管理员账号登录。

### 环境变量（后端）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3001` | 监听端口（仅 127.0.0.1） |
| `DB_PATH` | `data/app.db` | SQLite 文件路径 |
| `SESSION_TTL_DAYS` | `7` | 会话有效期 |
| `COOKIE_SECURE` | `0` | HTTPS 环境设为 `1` |
| `TRUST_PROXY` | `0` | Nginx 反代后设为 `1`（真实 IP 限流） |
| `AGENT_API_KEY` | 空 | Agent 接口 Key（逗号分隔多个），空 = 禁用 |

## 测试与构建

```bash
# 前端（根目录）
npm run test          # Vitest：前端 + 后端测试
npm run build         # vue-tsc 类型检查 + vite build
npm run verify:build  # 构建产物 PWA 检查

# 后端（server/）
cd server
npm run typecheck
npm run test
```

## Agent 开放接口

外部 Agent / 脚本可通过 API Key 添加任务、查询完成度（详见 [skills/exam-prep-agent/SKILL.md](skills/exam-prep-agent/SKILL.md)）：

```bash
BASE=https://study.xiaodu0315.top
KEY="$EXAM_PREP_API_KEY"

# 今日完成度（今日/本周完成率、各科背诵进度、考试倒计时）
curl -s -H "X-Agent-Key: $KEY" "$BASE/api/agent/stats"

# 添加任务
curl -s -X POST "$BASE/api/agent/tasks" \
  -H "X-Agent-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"title":"行测·判断推理 20 道"}'
```

未配置 `AGENT_API_KEY` 时接口返回 503；Key 错误返回 401。

## 生产部署参考

生产环境（Ubuntu + Nginx + 宝塔）当前结构：

- 网站根目录：`/www/wwwroot/exam-prep`（前端 dist）
- 前端暂存/发布：`/srv/exam-prep/frontend/releases/<version>`
- 后端：`/srv/exam-prep/server`（`start.sh` 加载 `/etc/exam-prep.env` 后以 www 用户运行 `tsx src/index.ts`）
- 数据库：`/srv/exam-prep/data/app.db`
- 备份：`/srv/exam-prep/backups/`

Nginx 站点关键配置（宝塔管理）：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /www/wwwroot/exam-prep;
    index index.html;

    # SPA 前端路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带 hash 的静态资源可长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 后端 API 反代（仅本机）
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

发布流程：备份 → 上传暂存 → 校验 → 替换 → 健康检查（详见 [RELEASES.md](RELEASES.md)）。

## 安全说明

- 管理员密码仅以 scrypt 哈希存于数据库；不要使用弱密码，生产账号不要与本地测试账号共用。
- 登录会话 Cookie：HttpOnly、SameSite=Lax、Path=/；HTTPS 环境开启 `COOKIE_SECURE=1`。
- 数据库、`.env`、备份文件不得放入网站公开目录。
- Agent API Key 请妥善保管，泄露时在 `/etc/exam-prep.env` 中轮换并重启后端。
- 所有 SQL 参数化；非 GET 请求校验同源 Origin。

## 版本记录

- 每次发布记录见 [RELEASES.md](RELEASES.md)；
- Git 提交历史：`git log --oneline`。

# 稳步备考 · 备考管理 App 前端原型

一个移动端优先、极简清爽的备考管理 Web App。使用 Vue 3 + TypeScript + Vite 构建，当前阶段仅前端，不连接后端与数据库。

## 功能

- **主页**：考试倒计时、今日任务完成情况、各科背诵进度、常用网站快捷入口。
- **每日任务**：按日期切换查看，任务的增删改查与完成状态切换。
- **背诵计划**：按科目（英语 / 政治 / 工程基础等）记录背诵总量与完成量。
- **周汇总**：按周查看任务完成统计与每日完成数量、各科进度。
- **设置**：考试信息、科目管理、快捷网站、JSON 导入导出、模拟登录。

## 技术栈

- Vue 3（`<script setup lang="ts">`）
- TypeScript
- Vite
- Vue Router
- lucide-vue-next（图标）
- 原生 CSS（设计令牌 + 响应式，无 UI 框架）

## 目录结构

```
src/
├── main.ts                 # 入口
├── App.vue                 # 应用壳（桌面侧边栏 / 移动底部导航）
├── router/index.ts         # 路由配置
├── types/index.ts          # 类型定义（未来实体模型）
├── utils/date.ts           # 日期工具
├── data/seed.ts            # 首次启动的模拟数据
├── services/storage.ts     # localStorage 持久化封装（未来替换为 API/SQLite）
├── store/useAppStore.ts    # 集中式数据 store（响应式 + 自动持久化）
├── composables/useToast.ts # 全局 Toast 反馈
├── components/             # 通用组件
└── views/                  # 五个页面视图
```

数据操作集中在 `services/` 与 `store/`，页面不直接读写 localStorage，便于后续接入后端 API 与 SQLite。

## 运行命令

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 生产构建
npm run build

# 4. 预览构建产物（可选）
npm run preview
```

启动后访问终端输出的地址（默认 http://localhost:5173），在浏览器开发者工具中切换为手机视口即可预览移动端效果。

## 说明

- 所有数据保存在浏览器 localStorage，刷新后保留；可在设置中导出 / 导入 / 重置。
- 登录为本地模拟，仅用于预览视觉效果，不涉及真实身份验证，也不作为安全边界。

## PWA（渐进式 Web 应用）

项目已接入 `vite-plugin-pwa`（generateSW 模式）：

- 应用名称「稳步备考」，`display: standalone`，主题色 `#4a7cc2`；
- 图标位于 `public/`：`pwa-192x192.png`、`pwa-512x512.png`、`pwa-512x512-maskable.png`、`apple-touch-icon.png`；
- 构建时预缓存全部静态资源（27 项），支持离线打开已缓存页面，SPA 前端路由回退到 `index.html`；
- `registerType: 'autoUpdate'`：发布新版本后自动更新 Service Worker 并清理过期缓存（`cleanupOutdatedCaches`）；
- Service Worker 只管理 Cache Storage，不会触碰 localStorage 中的用户数据；
- 开发模式（`npm run dev`）不注册 Service Worker，避免干扰热更新。

### 验证方式

- **生产预览**：`npm run build && npm run preview`，浏览器打开 http://localhost:4173
  - DevTools → Application → Service Workers：应看到已激活的 `sw.js`；
  - DevTools → Application → Manifest：应显示名称「稳步备考」与全部图标；
  - DevTools → Network 勾选 Offline 后刷新，页面仍可打开；`/tasks` 等前端路由刷新不回 404；
  - Chrome/Edge 地址栏「安装」按钮可将应用安装到桌面，以独立窗口启动。
- **本地开发**：`npm run dev` 不注册 Service Worker，PWA 能力需通过上述生产预览验证。

### Nginx 部署参考

应用部署在域名根路径（`vite.config.ts` 的 `base` 保持默认 `/`）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/exam-prep-app;
    index index.html;

    # SPA 前端路由回退（与 Service Worker 的 navigateFallback 双保险）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带 hash 的静态资源可长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 未来后端 API 反向代理示例（SW 已通过 navigateFallbackDenylist 排除 /api/）
    # location /api/ {
    #     proxy_pass http://127.0.0.1:3000;
    # }
}
```

注意事项：

- `sw.js` 与 `manifest.webmanifest` 需通过 HTTPS 访问（Service Worker 要求安全上下文，localhost 除外）；
- 若部署到子路径，需把 `vite.config.ts` 的 `base` 改为对应子路径（如 `/study/`），manifest 与 Service Worker 的资源路径会自动跟随。

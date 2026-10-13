import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // base 保持默认 '/'：应用部署在域名根路径（配合 Nginx root + try_files 回退）。
  // 若未来部署到子路径（如 https://example.com/study/），将 base 改为 '/study/'，
  // manifest 与 Service Worker 的资源路径会随 base 自动调整。
  plugins: [
    vue(),
    VitePWA({
      // 新版本自动更新：SW 检测到新构建后自动激活，用户下次打开即为新版
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '稳步备考',
        short_name: '稳步备考',
        description: '极简清爽的备考管理工具：倒计时、每日任务、背诵计划与周汇总',
        lang: 'zh-CN',
        theme_color: '#4a7cc2',
        background_color: '#f6f8fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 预缓存构建产物：应用壳资源离线可用。
        // 图标（svg/png）由 includeAssets 与 manifest icons 自动预缓存，此处不再匹配，避免重复条目。
        globPatterns: ['**/*.{js,css,html,woff2,ico}'],
        // SPA 路由回退：/tasks 等前端路由刷新时回退到 index.html
        navigateFallback: 'index.html',
        // 未来后端 API 请求绝不走 SW 回退（避免把接口响应缓存成页面）
        navigateFallbackDenylist: [/^\/api\//],
        // 每次构建自动清理过期缓存版本
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      // 开发模式不注册 SW（避免干扰 HMR 与调试）；仅生产构建启用
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // 本地联调：/api 代理到本机后端。changeOrigin: false 保留原始 Host，
    // 与后端同源 Origin 校验（Origin.host === Host）保持一致。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
})

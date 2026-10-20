import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../store/useAppStore'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: '主页' },
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('../views/TasksView.vue'),
      meta: { title: '每日任务' },
    },
    {
      path: '/memorize',
      name: 'memorize',
      component: () => import('../views/MemorizeView.vue'),
      meta: { title: '背诵计划' },
    },
    {
      path: '/weekly',
      name: 'weekly',
      component: () => import('../views/WeeklyView.vue'),
      meta: { title: '周汇总' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/**
 * 全局守卫（异步初始化门禁）：
 * 1. 等待 init() 完成（幂等），期间不渲染业务页面；
 * 2. 业务路由要求 authenticated，否则跳 /login（带 redirect）；
 * 3. 已登录访问 /login 时跳回主页。
 */
router.beforeEach(async (to) => {
  const store = useAppStore()
  await store.init()

  if (to.meta.public === true) {
    if (to.name === 'login' && store.authStatus.value === 'authenticated') {
      return { path: '/' }
    }
    return true
  }

  if (store.authStatus.value === 'authenticated') return true
  return {
    path: '/login',
    query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined,
  }
})

router.afterEach((to) => {
  const store = useAppStore()
  const appName = store.state.data.texts?.appName?.trim() || '稳步备考'
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · ${appName}` : appName
})

export default router

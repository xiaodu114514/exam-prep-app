import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './services/api'
import { useAppStore } from './store/useAppStore'
import './styles/base.css'

// 401 全局处理：清理私有状态并跳转登录（多标签页会话失效时同样生效）
setUnauthorizedHandler(() => {
  const store = useAppStore()
  store.handleSessionExpired()
  if (router.currentRoute.value.path !== '/login') {
    void router.push({
      path: '/login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
  }
})

const app = createApp(App)
app.use(router)
app.mount('#app')

// 启动异步初始化门禁（路由守卫会 await 同一个 Promise，避免重复请求）
void useAppStore().init()

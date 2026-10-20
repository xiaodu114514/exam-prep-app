<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  ListChecks,
  Settings,
} from 'lucide-vue-next'
import { useToast } from './composables/useToast'
import ToastHost from './components/ToastHost.vue'
import { useAppStore } from './store/useAppStore'

const route = useRoute()
const store = useAppStore()
const { toasts, dismiss } = useToast()

/** 公开页面（登录页）不渲染业务导航 */
const isPublicPage = computed(() => route.meta.public === true)
/** 初始化门禁期间显示加载遮罩，不渲染业务页面 */
const booting = computed(() => store.authStatus.value === 'loading')
/** 自定义应用名，留空使用默认 */
const appName = computed(() => {
  const custom = store.state.data.texts?.appName?.trim()
  return custom ? custom : '稳步备考'
})

const navItems = [
  { path: '/', label: '主页', icon: Home },
  { path: '/tasks', label: '每日任务', icon: ListChecks },
  { path: '/memorize', label: '背诵计划', icon: BookOpen },
  { path: '/weekly', label: '周汇总', icon: CalendarDays },
  { path: '/settings', label: '设置', icon: Settings },
]
</script>

<template>
  <div class="app-shell">
    <aside v-if="!isPublicPage" class="sidebar">
      <div class="sidebar__brand">
        <span class="sidebar__logo">
          <GraduationCap :size="20" />
        </span>
        <span class="sidebar__name">{{ appName }}</span>
      </div>
      <nav class="sidebar__nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'nav-item--active': route.path === item.path }"
        >
          <component :is="item.icon" :size="19" :stroke-width="1.9" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <main class="app-main" :class="{ 'app-main--public': isPublicPage }">
      <RouterView v-slot="{ Component }">
        <!-- 公开页面（登录页）不套切换动画：避免 transform 干扰 fixed 居中布局 -->
        <component v-if="isPublicPage" :is="Component" :key="route.path" />
        <Transition v-else name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <nav v-if="!isPublicPage" class="bottom-nav" aria-label="主导航">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': route.path === item.path }"
      >
        <component :is="item.icon" :size="21" :stroke-width="1.9" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- 初始化门禁遮罩 -->
    <div v-if="booting" class="boot-screen" aria-busy="true">
      <span class="boot-screen__spinner"></span>
      <span class="boot-screen__text">正在加载…</span>
    </div>

    <ToastHost :toasts="toasts" @dismiss="dismiss" />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
}

/* ---------- 桌面侧边栏 ---------- */
.sidebar {
  display: none;
}

/* ---------- 移动端底部导航 ---------- */
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
}
.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 9px 0 7px;
  font-size: 11px;
  color: var(--text-muted);
  min-height: var(--nav-height);
}
.bottom-nav__item--active {
  color: var(--primary-strong);
}

/* ---------- 页面切换动画 ---------- */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ---------- 初始化加载遮罩 ---------- */
.boot-screen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg);
}
.boot-screen__spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid var(--primary-border);
  border-top-color: var(--primary);
  animation: boot-spin 0.8s linear infinite;
}
.boot-screen__text {
  font-size: 13px;
  color: var(--text-muted);
}
@keyframes boot-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 公开页面（登录页）：桌面端无需为侧边栏留边距 */
@media (min-width: 900px) {
  .app-main--public {
    margin-left: 0;
  }
}

@media (min-width: 900px) {
  .sidebar {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--sidebar-width);
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 22px 14px;
    z-index: 110;
  }
  .sidebar__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px 20px;
  }
  .sidebar__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--primary);
    color: #fff;
  }
  .sidebar__name {
    font-size: 16px;
    font-weight: 650;
    color: var(--text);
  }
  .sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border-radius: 10px;
    color: var(--text-secondary);
    font-size: 14.5px;
    font-weight: 520;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .nav-item:hover {
    background: var(--surface-2);
  }
  .nav-item--active {
    background: var(--primary-weak);
    color: var(--primary-strong);
    font-weight: 600;
  }

  .app-main {
    margin-left: var(--sidebar-width);
  }
  .bottom-nav {
    display: none;
  }
}
</style>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GraduationCap, Lock, LogIn, UserRound } from 'lucide-vue-next'
import { useAppStore } from '../store/useAppStore'

const store = useAppStore()
const router = useRouter()
const route = useRoute()

const appName = computed(() => {
  const custom = store.state.data.texts?.appName?.trim()
  return custom ? custom : '稳步备考'
})

const form = reactive({ username: '', password: '' })
const error = ref('')
const pending = ref(false)

async function submit() {
  const username = form.username.trim()
  if (!username) {
    error.value = '请输入用户名'
    return
  }
  if (!form.password) {
    error.value = '请输入密码'
    return
  }
  error.value = ''
  pending.value = true
  try {
    const result = await store.login(username, form.password)
    if (result.ok) {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      router.replace(redirect)
      return
    }
    error.value = result.message ?? '登录失败，请重试'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <div class="login__brand">
        <span class="login__logo">
          <GraduationCap :size="26" />
        </span>
        <h1 class="login__name">{{ appName }}</h1>
      </div>
      <p class="login__sub">登录后开始今天的学习</p>

      <form class="login__form" @submit.prevent="submit">
        <div class="field">
          <label class="label" for="login-username">用户名</label>
          <div class="login__input-wrap">
            <UserRound :size="16" class="login__input-icon" />
            <input
              id="login-username"
              v-model="form.username"
              class="input login__input"
              type="text"
              autocomplete="username"
              placeholder="请输入用户名"
            />
          </div>
        </div>
        <div class="field">
          <label class="label" for="login-password">密码</label>
          <div class="login__input-wrap">
            <Lock :size="16" class="login__input-icon" />
            <input
              id="login-password"
              v-model="form.password"
              class="input login__input"
              type="password"
              autocomplete="current-password"
              placeholder="请输入密码"
            />
          </div>
        </div>

        <p v-if="error" class="login__error">{{ error }}</p>

        <button class="btn btn--primary btn--block" type="submit" :disabled="pending">
          <LogIn :size="16" />
          {{ pending ? '登录中…' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login {
  /* fixed 定位脱离父容器影响，保证移动端始终相对视口居中 */
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 24px;
  padding-top: calc(24px + env(safe-area-inset-top));
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  background: var(--bg);
}
.login__card {
  width: 100%;
  max-width: 380px;
  /* auto margin：软键盘弹出、内容超高时可滚动且不裁顶 */
  margin: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow-card);
  padding: 32px 28px;
}
.login__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}
.login__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: var(--primary);
  color: #fff;
}
.login__name {
  font-size: 21px;
  font-weight: 680;
  color: var(--text);
  letter-spacing: -0.01em;
}
.login__sub {
  margin-top: 10px;
  text-align: center;
  font-size: 13.5px;
  color: var(--text-muted);
}
.login__form {
  margin-top: 24px;
}
.login__input-wrap {
  position: relative;
}
.login__input-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.login__input {
  padding-left: 38px;
}
.login__error {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--danger);
}
</style>

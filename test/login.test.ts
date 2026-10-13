import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '../src/views/LoginView.vue'
import { useAppStore, resetStoreForTest } from '../src/store/useAppStore'
import * as api from '../src/services/api'
import type { AppData } from '../src/types'

vi.mock('../src/services/api')

function emptyData(): AppData {
  return { version: 1, exam: { name: '', date: '' }, subjects: [], sites: [], tasks: [] }
}

describe('登录页', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    vi.clearAllMocks()
    resetStoreForTest()
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginView },
        { path: '/', component: { template: '<div>home</div>' } },
      ],
    })
  })

  async function mountLogin() {
    await router.push('/login')
    await router.isReady()
    return mount(LoginView, { global: { plugins: [router] } })
  }

  it('空表单提交显示校验提示', async () => {
    const wrapper = await mountLogin()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('请输入用户名')
  })

  it('缺少密码时显示校验提示', async () => {
    const wrapper = await mountLogin()
    await wrapper.find('#login-username').setValue('admin')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('请输入密码')
  })

  it('登录失败显示后端错误消息', async () => {
    vi.mocked(api.authLogin).mockRejectedValue(new Error('用户名或密码错误'))
    const wrapper = await mountLogin()
    await wrapper.find('#login-username').setValue('admin')
    await wrapper.find('#login-password').setValue('bad')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('用户名或密码错误')
  })

  it('登录成功跳转主页并加载数据', async () => {
    vi.mocked(api.authLogin).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(emptyData())
    const wrapper = await mountLogin()
    await wrapper.find('#login-username').setValue('admin')
    await wrapper.find('#login-password').setValue('secret123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(useAppStore().authStatus.value).toBe('authenticated')
  })
})

describe('路由守卫（真实 router）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStoreForTest()
  })

  it('守卫三态：未登录跳登录页、已登录放行、已登录访问登录页跳主页', async () => {
    const { default: realRouter } = await import('../src/router')

    // 场景 1：未登录访问业务路由 -> /login
    vi.mocked(api.authMe).mockRejectedValue(new Error('401'))
    resetStoreForTest()
    await realRouter.push('/')
    await realRouter.isReady()
    expect(realRouter.currentRoute.value.path).toBe('/login')

    // 场景 2：已登录访问业务路由 -> 放行
    resetStoreForTest()
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(emptyData())
    await realRouter.replace('/')
    expect(realRouter.currentRoute.value.path).toBe('/')

    // 场景 3：已登录访问 /login -> 跳回主页
    await realRouter.replace('/login')
    expect(realRouter.currentRoute.value.path).toBe('/')

    // 场景 4：已登录访问其他业务路由 -> 放行
    await realRouter.replace('/tasks')
    expect(realRouter.currentRoute.value.path).toBe('/tasks')
  })
})

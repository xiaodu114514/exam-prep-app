import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '../src/views/HomeView.vue'
import { useAppStore, resetStoreForTest } from '../src/store/useAppStore'
import * as api from '../src/services/api'
import { addDays, todayKey } from '../src/utils/date'
import type { AppData } from '../src/types'

vi.mock('../src/services/api')

function makeData(): AppData {
  const today = todayKey()
  return {
    version: 1,
    exam: { name: '测试考试', date: addDays(today, 10) },
    subjects: [{ id: 's1', name: '英语', unit: '单词', total: 100, completed: 10 }],
    sites: [{ id: 'w1', name: '粉笔', url: 'https://fenbi.com' }],
    tasks: [
      { id: 't1', title: '任务一', date: today, completed: true, subjectId: null, amount: null },
      { id: 't2', title: '任务二', date: today, completed: false, subjectId: null, amount: null },
    ],
  }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/tasks', component: { template: '<div />' } },
    { path: '/memorize', component: { template: '<div />' } },
    { path: '/weekly', component: { template: '<div />' } },
    { path: '/settings', component: { template: '<div />' } },
  ],
})

beforeEach(async () => {
  vi.clearAllMocks()
  resetStoreForTest()
  vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
  vi.mocked(api.getData).mockResolvedValue(makeData())
  await useAppStore().init()
})

async function mountHome() {
  await router.push('/')
  await router.isReady()
  return mount(HomeView, { global: { plugins: [router] } })
}

describe('主页：考试倒计时文案边界（服务器数据）', () => {
  it('未来日期显示「距离考试还有 N 天」', async () => {
    const store = useAppStore()
    store.state.data.exam.date = addDays(todayKey(), 10)
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain('距离考试还有 10 天')
  })

  it('考试是今天显示「考试就是今天」', async () => {
    const store = useAppStore()
    store.state.data.exam.date = todayKey()
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain('考试就是今天')
  })

  it('考试已过显示「考试已结束 N 天」', async () => {
    const store = useAppStore()
    store.state.data.exam.date = addDays(todayKey(), -3)
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain('考试已结束 3 天')
  })
})

describe('主页：今日任务完成情况', () => {
  it('完成数量与进度由服务器数据真实计算', async () => {
    const store = useAppStore()
    const today = todayKey()
    const total = store.state.data.tasks.filter((t) => t.date === today).length
    const done = store.state.data.tasks.filter((t) => t.date === today && t.completed).length
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain(`${done} / ${total} 项已完成`)
  })

  it('点击任务行切换完成状态（以服务端响应为准）', async () => {
    const store = useAppStore()
    const first = store.state.data.tasks[0] // completed = true
    vi.mocked(api.patchTask).mockResolvedValue({
      task: { ...first, completed: false },
      subject: null,
    })
    const wrapper = await mountHome()
    const row = wrapper.findAll('.home-task').find((n) => n.text().includes(first.title))
    expect(row).toBeTruthy()
    await row!.trigger('click')
    expect(vi.mocked(api.patchTask)).toHaveBeenCalledWith(first.id, { completed: false })
    expect(store.state.data.tasks.find((t) => t.id === first.id)?.completed).toBe(false)
  })

  it('自定义问候语与口号优先渲染，留空回退默认', async () => {
    const store = useAppStore()
    store.state.data.texts = { appName: '', greeting: '晚上好', slogan: '冲鸭' }
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain('晚上好')
    expect(wrapper.text()).toContain('冲鸭')

    store.state.data.texts = { appName: '', greeting: '', slogan: '' }
    const wrapper2 = await mountHome()
    expect(wrapper2.text()).toContain('今天也要稳步推进')
  })
})

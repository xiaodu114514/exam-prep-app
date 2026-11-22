import { describe, expect, it, vi } from 'vitest'
import { useAppStore, resetStoreForTest } from '../src/store/useAppStore'
import * as api from '../src/services/api'
import type { AppData } from '../src/types'

vi.mock('../src/services/api')

function makeData(): AppData {
  return {
    version: 1,
    exam: { name: '', date: '' },
    subjects: [],
    sites: [],
    tasks: [],
  }
}

function dailyTask(completions: Array<{ date: string; completedAmount: number | null; contributed: number }>) {
  return {
    id: 'd1',
    title: '每日背单词',
    date: '2026-10-19', // 周一创建
    completed: false,
    subjectId: null,
    amount: 40,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    completions,
  }
}

describe('每日任务按日期独立（前端 tasksOn 派生）', () => {
  async function storeWith(tasks: AppData['tasks']) {
    resetStoreForTest()
    vi.clearAllMocks()
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    const data = makeData()
    data.tasks = tasks
    vi.mocked(api.getData).mockResolvedValue(data)
    const store = useAppStore()
    await store.init()
    return store
  }

  it('只完成周二：周一未完成、周二完成', async () => {
    const store = await storeWith([
      dailyTask([{ date: '2026-10-20', completedAmount: 40, contributed: 40 }]),
    ])
    expect(store.tasksOn('2026-10-19')[0].completed).toBe(false)
    expect(store.tasksOn('2026-10-20')[0].completed).toBe(true)
  })

  it('补录周一后：周一、周二都完成（互不影响）', async () => {
    const store = await storeWith([
      dailyTask([
        { date: '2026-10-19', completedAmount: 40, contributed: 40 },
        { date: '2026-10-20', completedAmount: 40, contributed: 40 },
      ]),
    ])
    expect(store.tasksOn('2026-10-19')[0].completed).toBe(true)
    expect(store.tasksOn('2026-10-20')[0].completed).toBe(true)
    expect(store.tasksOn('2026-10-21')[0].completed).toBe(false)
  })

  it('取消周一后：周二仍完成', async () => {
    const store = await storeWith([
      dailyTask([{ date: '2026-10-20', completedAmount: 40, contributed: 40 }]),
    ])
    expect(store.tasksOn('2026-10-19')[0].completed).toBe(false)
    expect(store.tasksOn('2026-10-20')[0].completed).toBe(true)
  })

  it('模拟第二天刷新：周一完成 4 个星期任务 + 1 个普通任务，周一仍 5/5', async () => {
    const store = await storeWith([
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `d${i + 1}`,
        title: `星期任务${i + 1}`,
        date: '2026-10-19',
        completed: false,
        subjectId: null,
        amount: null,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        completions: [{ date: '2026-10-19', completedAmount: null, contributed: 0 }],
      })),
      {
        id: 'n1',
        title: '当日任务',
        date: '2026-10-19',
        completed: true,
        subjectId: null,
        amount: null,
      },
    ])
    const monday = store.tasksOn('2026-10-19')
    expect(monday).toHaveLength(5)
    expect(monday.filter((t) => t.completed)).toHaveLength(5)

    // 周二视图：4 个星期任务（未完成），普通任务不出现，不受周一影响
    const tuesday = store.tasksOn('2026-10-20')
    expect(tuesday).toHaveLength(4)
    expect(tuesday.filter((t) => t.completed)).toHaveLength(0)
  })
})

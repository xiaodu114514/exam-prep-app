import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore, resetStoreForTest } from '../src/store/useAppStore'
import * as api from '../src/services/api'
import type { AppData } from '../src/types'

vi.mock('../src/services/api')

function makeData(): AppData {
  return {
    version: 1,
    exam: { name: '测试考试', date: '2025-12-20' },
    subjects: [{ id: 's1', name: '英语', unit: '单词', total: 100, completed: 10 }],
    sites: [{ id: 'w1', name: '粉笔', url: 'https://fenbi.com' }],
    tasks: [
      {
        id: 't1',
        title: '背单词',
        date: '2025-11-04',
        completed: false,
        subjectId: 's1',
        amount: 50,
        contributed: 0,
      },
    ],
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  resetStoreForTest()
})

describe('初始化门禁（三态）', () => {
  it('me 成功 + 数据加载成功 -> authenticated + 服务器数据', async () => {
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(makeData())
    const store = useAppStore()
    expect(store.authStatus.value).toBe('loading')
    await store.init()
    expect(store.authStatus.value).toBe('authenticated')
    expect(store.state.user?.name).toBe('admin')
    expect(store.state.data.tasks).toHaveLength(1)
  })

  it('me 401 -> guest + 空数据（不渲染旧 localStorage 数据）', async () => {
    // 旧 localStorage 里故意放私有数据，验证 init 不读它
    localStorage.setItem('exam-prep-app:data:v1', JSON.stringify(makeData()))
    vi.mocked(api.authMe).mockRejectedValue(new Error('401'))
    const store = useAppStore()
    await store.init()
    expect(store.authStatus.value).toBe('guest')
    expect(store.state.data.tasks).toHaveLength(0)
    expect(store.state.data.subjects).toHaveLength(0)
    expect(store.state.user).toBeNull()
  })

  it('服务器不可达 -> guest + 空数据', async () => {
    vi.mocked(api.authMe).mockRejectedValue(new Error('网络连接失败，请检查网络'))
    const store = useAppStore()
    await store.init()
    expect(store.authStatus.value).toBe('guest')
    expect(store.state.data.tasks).toHaveLength(0)
  })

  it('数据加载失败 -> guest，不静默使用种子数据', async () => {
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockRejectedValue(new Error('服务器内部错误'))
    const store = useAppStore()
    await store.init()
    expect(store.authStatus.value).toBe('guest')
    expect(store.state.data.tasks).toHaveLength(0)
    expect(store.state.data.exam.name).toBe('')
  })

  it('init 幂等：并发调用只请求一次', async () => {
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(makeData())
    const store = useAppStore()
    await Promise.all([store.init(), store.init(), store.init()])
    expect(vi.mocked(api.authMe)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.getData)).toHaveBeenCalledTimes(1)
  })
})

describe('登录与退出', () => {
  it('登录成功：写入用户并加载服务器数据', async () => {
    vi.mocked(api.authLogin).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(makeData())
    const store = useAppStore()
    const res = await store.login('admin', 'secret123')
    expect(res.ok).toBe(true)
    expect(store.authStatus.value).toBe('authenticated')
    expect(store.state.data.subjects).toHaveLength(1)
  })

  it('登录失败：返回后端错误消息，不加载数据', async () => {
    vi.mocked(api.authLogin).mockRejectedValue(new Error('用户名或密码错误'))
    const store = useAppStore()
    const res = await store.login('admin', 'bad')
    expect(res.ok).toBe(false)
    expect(res.message).toBe('用户名或密码错误')
    expect(store.authStatus.value).toBe('guest')
    expect(vi.mocked(api.getData)).not.toHaveBeenCalled()
  })

  it('退出：清空内存数据、用户与本地用户信息', async () => {
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(makeData())
    const store = useAppStore()
    await store.init()
    expect(store.state.data.tasks).toHaveLength(1)

    localStorage.setItem('exam-prep-app:user:v1', JSON.stringify({ name: 'admin' }))
    vi.mocked(api.authLogout).mockResolvedValue({ ok: true })
    await store.logout()
    expect(store.authStatus.value).toBe('guest')
    expect(store.state.data.tasks).toHaveLength(0)
    expect(store.state.user).toBeNull()
    expect(localStorage.getItem('exam-prep-app:user:v1')).toBeNull()
  })

  it('handleSessionExpired：清空私有状态', async () => {
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(makeData())
    const store = useAppStore()
    await store.init()
    store.handleSessionExpired()
    expect(store.authStatus.value).toBe('guest')
    expect(store.state.data.tasks).toHaveLength(0)
    expect(store.state.user).toBeNull()
  })
})

describe('业务 action：成功 / 失败 / 回滚', () => {
  async function authedStore() {
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    vi.mocked(api.getData).mockResolvedValue(makeData())
    const store = useAppStore()
    await store.init()
    return store
  }

  it('toggleTask：乐观更新 + 以服务端响应替换任务与科目进度', async () => {
    const store = await authedStore()
    const task = store.state.data.tasks[0]
    const serverTask = { ...task, completed: true, contributed: 50 }
    const serverSubject = { id: 's1', name: '英语', unit: '单词', total: 100, completed: 60 }
    vi.mocked(api.patchTask).mockResolvedValue({ task: serverTask, subject: serverSubject })

    const result = await store.toggleTask(task.id)
    expect(result?.task.completed).toBe(true)
    expect(result?.subject?.completed).toBe(60)
    expect(store.state.data.subjects.find((s) => s.id === 's1')?.completed).toBe(60)
    expect(vi.mocked(api.patchTask)).toHaveBeenCalledWith(task.id, { completed: true })
  })

  it('toggleTask：失败回滚到原状态', async () => {
    const store = await authedStore()
    const task = store.state.data.tasks[0]
    vi.mocked(api.patchTask).mockRejectedValue(new Error('服务器内部错误'))
    const result = await store.toggleTask(task.id)
    expect(result).toBeNull()
    expect(store.state.data.tasks[0].completed).toBe(false)
  })

  it('addTask：成功插入服务器返回实体，失败不插入', async () => {
    const store = await authedStore()
    const newTask = {
      id: 't9',
      title: '刷题',
      date: '2025-11-04',
      completed: false,
      subjectId: null,
      amount: null,
      contributed: 0,
    }
    vi.mocked(api.createTask).mockResolvedValue({ task: newTask })
    const added = await store.addTask({ title: '刷题', date: '2025-11-04', subjectId: null, amount: null })
    expect(added?.id).toBe('t9')
    expect(store.state.data.tasks).toHaveLength(2)

    vi.mocked(api.createTask).mockRejectedValue(new Error('任务名称不能为空'))
    const failed = await store.addTask({ title: '', date: '2025-11-04', subjectId: null, amount: null })
    expect(failed).toBeNull()
    expect(store.state.data.tasks).toHaveLength(2)
  })

  it('removeTask：删除成功后静默刷新（联动结果以服务器为准）', async () => {
    const store = await authedStore()
    vi.mocked(api.deleteTask).mockResolvedValue({ ok: true })
    const refreshed = makeData()
    refreshed.tasks = []
    refreshed.subjects = [{ id: 's1', name: '英语', unit: '单词', total: 100, completed: 10 }]
    vi.mocked(api.getData).mockResolvedValue(refreshed)

    const ok = await store.removeTask('t1')
    expect(ok).toBe(true)
    expect(store.state.data.tasks).toHaveLength(0)
    // init 一次 + 删除后刷新一次
    expect(vi.mocked(api.getData).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('updateExam：失败不覆盖现有数据', async () => {
    const store = await authedStore()
    const before = { ...store.state.data.exam }
    vi.mocked(api.updateExam).mockRejectedValue(new Error('考试名称不能为空'))
    const ok = await store.updateExam({ name: 'x' })
    expect(ok).toBe(false)
    expect(store.state.data.exam).toEqual(before)
  })

  it('updateTask：成功以服务端响应为准', async () => {
    const store = await authedStore()
    const task = store.state.data.tasks[0]
    const serverTask = { ...task, title: '改名了', amount: 30 }
    vi.mocked(api.patchTask).mockResolvedValue({ task: serverTask, subject: null })
    const ok = await store.updateTask(task.id, { title: '改名了', amount: 30 })
    expect(ok).toBe(true)
    expect(store.state.data.tasks[0].title).toBe('改名了')
    expect(store.state.data.tasks[0].amount).toBe(30)
  })
})

describe('每日任务：tasksOn 按天展开', () => {
  async function storeWithTasks(tasks: AppData['tasks']) {
    vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
    const data = makeData()
    data.tasks = tasks
    vi.mocked(api.getData).mockResolvedValue(data)
    const store = useAppStore()
    await store.init()
    return store
  }

  it('每日任务从创建日起每天出现，创建日前不出现', async () => {
    const store = await storeWithTasks([
      {
        id: 'd1',
        title: '每日背单词',
        date: '2025-11-01',
        completed: false,
        subjectId: null,
        amount: null,
        daily: true,
        doneDate: null,
      },
    ])
    expect(store.tasksOn('2025-10-31')).toHaveLength(0)
    expect(store.tasksOn('2025-11-01')).toHaveLength(1)
    expect(store.tasksOn('2025-11-10')).toHaveLength(1)
  })

  it('普通任务只在创建日出现', async () => {
    const store = await storeWithTasks([
      {
        id: 'p1',
        title: '普通任务',
        date: '2025-11-01',
        completed: false,
        subjectId: null,
        amount: null,
      },
    ])
    expect(store.tasksOn('2025-11-01')).toHaveLength(1)
    expect(store.tasksOn('2025-11-10')).toHaveLength(0)
  })
})

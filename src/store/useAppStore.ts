import { reactive, ref } from 'vue'
import type { AppData, Exam, StudySite, Subject, Task, UserProfile } from '../types'
import * as api from '../services/api'
import { clearUser } from '../services/storage'
import { useToast } from '../composables/useToast'

/**
 * 集中式数据 store（模块级单例），服务器为权威数据源。
 *
 * 初始化门禁：先验证登录态（GET /api/auth/me），成功后再加载服务器数据（GET /api/data）。
 * 验证期间与 guest 状态下 state.data 恒为空数据 —— 绝不渲染旧的 localStorage 私有数据。
 * 业务操作通过 services/api 调用后端；背诵进度以服务端事务计算结果为准，
 * 前端只做乐观更新与失败回滚，不重复计算贡献。
 */

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

export interface TaskInput {
  title: string
  date: string
  subjectId: string | null
  /** 背诵量，仅关联科目时有效 */
  amount: number | null
  /** 每日任务：从创建日起每天自动出现 */
  daily?: boolean
}

export interface SubjectInput {
  name: string
  unit: string
  total: number
  completed: number
}

export interface SiteInput {
  name: string
  url: string
}

interface AppState {
  data: AppData
  user: UserProfile | null
}

function emptyData(): AppData {
  return { version: 1, exam: { name: '', date: '' }, subjects: [], sites: [], tasks: [] }
}

const state = reactive<AppState>({
  data: emptyData(),
  user: null,
})

const authStatus = ref<AuthStatus>('loading')

let initPromise: Promise<void> | null = null

function toastError(e: unknown): void {
  const toast = useToast()
  const msg = e instanceof Error && e.message !== '' ? e.message : '请求失败，请重试'
  toast.error(msg)
}

function replaceTask(task: Task): void {
  const i = state.data.tasks.findIndex((t) => t.id === task.id)
  if (i >= 0) state.data.tasks[i] = task
  else state.data.tasks.push(task)
}

function replaceSubject(subject: Subject): void {
  const i = state.data.subjects.findIndex((s) => s.id === subject.id)
  if (i >= 0) state.data.subjects[i] = subject
}

export function useAppStore() {
  /**
   * 初始化（幂等）：并发调用共享同一 Promise，不会重复请求。
   * 成功 -> authenticated + 服务器数据；任何失败 -> guest + 空数据。
   */
  function init(): Promise<void> {
    if (!initPromise) initPromise = doInit()
    return initPromise
  }

  async function doInit(): Promise<void> {
    authStatus.value = 'loading'
    state.data = emptyData()
    state.user = null
    try {
      const me = await api.authMe()
      const data = await api.getData()
      state.user = { name: me.user.name }
      state.data = data
      authStatus.value = 'authenticated'
    } catch {
      // 未登录 / 会话失效 / 服务器不可达：一律 guest，不渲染私有数据
      state.data = emptyData()
      state.user = null
      authStatus.value = 'guest'
    }
  }

  /** 401 全局回调：清空私有状态并清除本地用户信息（业务数据键保留给阶段 3 导入） */
  function handleSessionExpired(): void {
    state.data = emptyData()
    state.user = null
    authStatus.value = 'guest'
    clearUser()
  }

  /** 静默刷新全量数据；失败保持现有数据，绝不覆盖为空/种子 */
  async function refreshData(): Promise<void> {
    try {
      state.data = await api.getData()
    } catch {
      /* 保持现有数据 */
    }
  }

  // ---------- 认证 ----------
  async function login(
    username: string,
    password: string,
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await api.authLogin(username, password)
      const data = await api.getData()
      state.user = { name: res.user.name }
      state.data = data
      authStatus.value = 'authenticated'
      return { ok: true }
    } catch (e) {
      // 登录失败保持未认证状态
      state.data = emptyData()
      state.user = null
      authStatus.value = 'guest'
      return { ok: false, message: e instanceof Error ? e.message : '登录失败，请重试' }
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.authLogout()
    } catch {
      /* 服务端失败也继续清理本地状态 */
    }
    state.data = emptyData()
    state.user = null
    authStatus.value = 'guest'
    clearUser()
  }

  // ---------- 任务 ----------
  async function addTask(input: TaskInput): Promise<Task | null> {
    try {
      const { task } = await api.createTask(input)
      state.data.tasks.push(task)
      return task
    } catch (e) {
      toastError(e)
      return null
    }
  }
  /**
   * 切换完成状态：乐观翻转 -> PATCH -> 用服务端响应（task + subject）替换本地状态；
   * 失败回滚。背诵贡献完全由服务端事务计算，前端不叠加。
   */
  async function toggleTask(id: string): Promise<{ task: Task; subject: Subject | null } | null> {
    const t = state.data.tasks.find((x) => x.id === id)
    if (!t) return null
    const prev = t.completed
    t.completed = !prev
    try {
      const res = await api.patchTask(id, { completed: !prev })
      replaceTask(res.task)
      if (res.subject) replaceSubject(res.subject)
      return { task: res.task, subject: res.subject }
    } catch (e) {
      t.completed = prev
      toastError(e)
      return null
    }
  }

  async function updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<boolean> {
    try {
      const res = await api.patchTask(id, patch)
      replaceTask(res.task)
      if (res.subject) replaceSubject(res.subject)
      return true
    } catch (e) {
      toastError(e)
      return false
    }
  }

  async function removeTask(id: string): Promise<boolean> {
    try {
      await api.deleteTask(id)
      state.data.tasks = state.data.tasks.filter((x) => x.id !== id)
      // 删除已完成任务会撤销贡献，科目进度以服务器为准 -> 静默刷新
      await refreshData()
      return true
    } catch (e) {
      toastError(e)
      return false
    }
  }

  /**
   * 某日期的任务列表：当天创建的普通任务 + 创建日早于该日期的每日任务。
   * 字符串日期（YYYY-MM-DD）可直接按字典序比较。
   */
  function tasksOn(date: string): Task[] {
    return state.data.tasks.filter(
      (x) => x.date === date || (x.daily === true && x.date <= date),
    )
  }

  // ---------- 科目 ----------
  async function addSubject(input: SubjectInput): Promise<Subject | null> {
    try {
      const { subject } = await api.createSubject(input)
      state.data.subjects.push(subject)
      return subject
    } catch (e) {
      toastError(e)
      return null
    }
  }

  async function updateSubject(id: string, patch: Partial<Omit<Subject, 'id'>>): Promise<boolean> {
    try {
      const { subject } = await api.patchSubject(id, patch)
      replaceSubject(subject)
      return true
    } catch (e) {
      toastError(e)
      return false
    }
  }

  async function removeSubject(id: string): Promise<boolean> {
    try {
      await api.deleteSubject(id)
      state.data.subjects = state.data.subjects.filter((x) => x.id !== id)
      // 任务标签清理与进度以服务器为准 -> 静默刷新
      await refreshData()
      return true
    } catch (e) {
      toastError(e)
      return false
    }
  }

  function getSubject(id: string | null | undefined): Subject | undefined {
    if (!id) return undefined
    return state.data.subjects.find((s) => s.id === id)
  }

  // ---------- 网站 ----------
  async function addSite(input: SiteInput): Promise<StudySite | null> {
    try {
      const { site } = await api.createSite(input)
      state.data.sites.push(site)
      return site
    } catch (e) {
      toastError(e)
      return null
    }
  }

  async function updateSite(id: string, patch: Partial<Omit<StudySite, 'id'>>): Promise<boolean> {
    try {
      const { site } = await api.patchSite(id, patch)
      const i = state.data.sites.findIndex((x) => x.id === id)
      if (i >= 0) state.data.sites[i] = site
      return true
    } catch (e) {
      toastError(e)
      return false
    }
  }

  async function removeSite(id: string): Promise<boolean> {
    try {
      await api.deleteSite(id)
      state.data.sites = state.data.sites.filter((x) => x.id !== id)
      return true
    } catch (e) {
      toastError(e)
      return false
    }
  }

  // ---------- 考试 ----------
  async function updateExam(patch: Partial<Exam>): Promise<boolean> {
    try {
      const { exam } = await api.updateExam({ ...state.data.exam, ...patch })
      state.data.exam = exam
      return true
    } catch (e) {
      toastError(e)
      return false
    }
  }

  // ---------- 数据管理 ----------
  /** 整份替换数据（阶段 3 服务器导入成功后使用） */
  function replaceData(data: AppData): void {
    state.data = data
  }

  return {
    state,
    authStatus,
    init,
    handleSessionExpired,
    refreshData,
    login,
    logout,
    addTask,
    toggleTask,
    updateTask,
    removeTask,
    tasksOn,
    addSubject,
    updateSubject,
    removeSubject,
    getSubject,
    addSite,
    updateSite,
    removeSite,
    updateExam,
    replaceData,
  }
}

/** 仅供测试使用：重置模块级初始化状态 */
export function resetStoreForTest(): void {
  initPromise = null
  authStatus.value = 'loading'
  state.data = emptyData()
  state.user = null
}

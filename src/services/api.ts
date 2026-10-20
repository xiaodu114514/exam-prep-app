import type { AppData, AppTexts, Exam, StudySite, Subject, Task } from '../types'

/**
 * 后端 API 统一封装：
 * - 相对路径 + credentials: 'same-origin'（开发走 Vite 代理、生产走 Nginx 同源反代，Cookie 自动携带）；
 * - 统一解析 JSON 与 `{error}` 响应；
 * - 401 触发全局回调（由 main.ts 注册，清理私有状态并跳转登录，避免重复跳转）；
 * - 不在客户端保存密码或 Session Token。
 */

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let unauthorizedHandler: (() => void) | null = null

/** 注册 401 全局处理（main.ts 启动时调用一次） */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, '网络连接失败，请检查网络')
  }

  if (res.status === 401) {
    unauthorizedHandler?.()
    throw new ApiError(401, '未登录或会话已过期')
  }

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok) {
    const message =
      payload !== null &&
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `请求失败（${res.status}）`
    throw new ApiError(res.status, message)
  }
  return payload as T
}

// ---------- 认证 ----------
export const authLogin = (username: string, password: string) =>
  request<{ user: { name: string } }>('POST', '/api/auth/login', { username, password })

export const authMe = () => request<{ user: { name: string } }>('GET', '/api/auth/me')

export const authLogout = () => request<{ ok: boolean }>('POST', '/api/auth/logout')

// ---------- 数据 ----------
export const getData = () => request<AppData>('GET', '/api/data')

export const updateExam = (exam: Exam) => request<{ exam: Exam }>('PUT', '/api/exam', exam)

// ---------- 自定义文案 ----------
export const updateTexts = (patch: Partial<AppTexts>) =>
  request<{ texts: AppTexts }>('PUT', '/api/texts', patch)

// ---------- 任务 ----------
export interface TaskPatchInput {
  title?: string
  date?: string
  completed?: boolean
  subjectId?: string | null
  amount?: number | null
  daily?: boolean
}

export const createTask = (input: {
  title: string
  date: string
  subjectId: string | null
  amount: number | null
  daily?: boolean
}) => request<{ task: Task }>('POST', '/api/tasks', input)

export const patchTask = (id: string, patch: TaskPatchInput) =>
  request<{ task: Task; subject: Subject | null }>('PATCH', `/api/tasks/${id}`, patch)

export const deleteTask = (id: string) => request<{ ok: boolean }>('DELETE', `/api/tasks/${id}`)

// ---------- 科目 ----------
export const createSubject = (input: {
  name: string
  unit: string
  total: number
  completed: number
}) => request<{ subject: Subject }>('POST', '/api/subjects', input)

export const patchSubject = (id: string, patch: Partial<Omit<Subject, 'id'>>) =>
  request<{ subject: Subject }>('PATCH', `/api/subjects/${id}`, patch)

export const deleteSubject = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/api/subjects/${id}`)

// ---------- 网站 ----------
export const createSite = (input: { name: string; url: string }) =>
  request<{ site: StudySite }>('POST', '/api/sites', input)

export const patchSite = (id: string, patch: Partial<Omit<StudySite, 'id'>>) =>
  request<{ site: StudySite }>('PATCH', `/api/sites/${id}`, patch)

export const deleteSite = (id: string) => request<{ ok: boolean }>('DELETE', `/api/sites/${id}`)

// ---------- 导入导出 ----------
/** 下载服务器数据备份文件（触发浏览器下载） */
export async function downloadDataExport(): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/data/export', { credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, '网络连接失败，请检查网络')
  }
  if (res.status === 401) {
    unauthorizedHandler?.()
    throw new ApiError(401, '未登录或会话已过期')
  }
  if (!res.ok) {
    let message = `导出失败（${res.status}）`
    try {
      const payload = (await res.json()) as { error?: string }
      if (typeof payload?.error === 'string') message = payload.error
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message)
  }
  const disposition = res.headers.get('content-disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'exam-prep-backup.json'
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

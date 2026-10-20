import type { AppData, Exam, StudySite, Subject, Task, UserProfile } from '../types'
import { todayKey } from '../utils/date'

/**
 * 数据持久化层：集中封装 localStorage 读写。
 * 未来接入后端 API / SQLite 时，只需替换本文件内的实现（可保持同名导出），
 * 上层 store 与页面无需改动。
 *
 * 未来替换为 API 时的接口对照：
 * - loadData()        -> GET  /api/data（或按实体分接口加载）
 * - saveData(data)    -> PUT  /api/data（或按实体 CRUD 增量同步）
 * - loadUser/saveUser -> GET/POST /api/user（单用户登录后由服务端会话管理）
 * - serializeData / parseImportedData -> 可保留本地实现或改为服务端导入导出
 */

const DATA_KEY = 'exam-prep-app:data:v1'
const USER_KEY = 'exam-prep-app:user:v1'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

let fallbackSeq = 0
function fallbackId(prefix: string): string {
  fallbackSeq += 1
  return `${prefix}_migrated_${Date.now().toString(36)}_${fallbackSeq}`
}

/**
 * 校验并规范化数据（非破坏性迁移）。
 *
 * 规则：
 * - JSON 不是对象、或 subjects/tasks/sites 任一核心集合不是数组 -> 返回 null（视为损坏，上层回退种子数据）；
 * - 其余字段级问题用默认值补齐，用户已有数据不会被删除。
 *
 * 未来数据版本升级时，在此按 version 追加迁移步骤（例如 v2 新增字段时补默认值）。
 */
export function normalizeData(parsed: unknown): AppData | null {
  if (!isRecord(parsed)) return null
  if (!Array.isArray(parsed.subjects) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.sites)) {
    return null
  }

  const version = typeof parsed.version === 'number' ? parsed.version : 1

  const exam: Exam = isRecord(parsed.exam)
    ? {
        name: typeof parsed.exam.name === 'string' && parsed.exam.name !== '' ? parsed.exam.name : '我的考试',
        date: typeof parsed.exam.date === 'string' && parsed.exam.date !== '' ? parsed.exam.date : todayKey(),
      }
    : { name: '我的考试', date: todayKey() }

  const subjects: Subject[] = (parsed.subjects as unknown[])
    .filter(isRecord)
    .map((s) => {
      const total =
        typeof s.total === 'number' && Number.isFinite(s.total) && s.total > 0 ? s.total : 1
      const rawCompleted =
        typeof s.completed === 'number' && Number.isFinite(s.completed) && s.completed >= 0
          ? s.completed
          : 0
      return {
        id: typeof s.id === 'string' && s.id !== '' ? s.id : fallbackId('subj'),
        name: typeof s.name === 'string' && s.name !== '' ? s.name : '未命名科目',
        unit: typeof s.unit === 'string' && s.unit !== '' ? s.unit : '项',
        total,
        // 保持业务不变量：0 <= completed <= total
        completed: Math.min(total, rawCompleted),
      }
    })

  const sites: StudySite[] = (parsed.sites as unknown[])
    .filter(isRecord)
    .map((s) => ({
      id: typeof s.id === 'string' && s.id !== '' ? s.id : fallbackId('site'),
      name: typeof s.name === 'string' && s.name !== '' ? s.name : '未命名网站',
      url: typeof s.url === 'string' ? s.url : '',
    }))

  const tasks: Task[] = (parsed.tasks as unknown[])
    .filter(isRecord)
    .map((t) => ({
      id: typeof t.id === 'string' && t.id !== '' ? t.id : fallbackId('task'),
      title: typeof t.title === 'string' && t.title !== '' ? t.title : '未命名任务',
      date: typeof t.date === 'string' && t.date !== '' ? t.date : todayKey(),
      completed: typeof t.completed === 'boolean' ? t.completed : false,
      subjectId: typeof t.subjectId === 'string' ? t.subjectId : null,
      // v1 旧数据没有 amount 字段：补 null（不联动背诵数量，保持旧行为）
      amount: typeof t.amount === 'number' && Number.isFinite(t.amount) ? t.amount : null,
    }))

  // 自定义文案（旧数据缺失时补默认空值）
  const texts = isRecord(parsed.texts)
    ? {
        appName: typeof parsed.texts.appName === 'string' ? parsed.texts.appName : '',
        greeting: typeof parsed.texts.greeting === 'string' ? parsed.texts.greeting : '',
        slogan: typeof parsed.texts.slogan === 'string' ? parsed.texts.slogan : '',
      }
    : { appName: '', greeting: '', slogan: '' }

  return { version, exam, subjects, sites, tasks, texts }
}

/** 读取应用数据，无数据或结构损坏时返回 null（上层回退到种子数据） */
export function loadData(): AppData | null {
  const raw = safeGet(DATA_KEY)
  if (!raw) return null
  try {
    return normalizeData(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function saveData(data: AppData): boolean {
  return safeSet(DATA_KEY, JSON.stringify(data))
}

export function clearData(): void {
  try {
    localStorage.removeItem(DATA_KEY)
  } catch {
    /* ignore */
  }
}

export function loadUser(): UserProfile | null {
  const raw = safeGet(USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null
    if (typeof parsed.name !== 'string') return null
    return {
      name: parsed.name,
      loggedInAt: typeof parsed.loggedInAt === 'string' ? parsed.loggedInAt : undefined,
    }
  } catch {
    return null
  }
}

export function saveUser(user: UserProfile): boolean {
  return safeSet(USER_KEY, JSON.stringify(user))
}

export function clearUser(): void {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * 清空本应用的全部本地键（业务数据 + 用户信息）。
 * 只清理本应用自己的 key，绝不清空整个浏览器 localStorage。
 * 注意：业务数据键里可能保存着尚未导入服务器的旧版数据，清理前应提示用户。
 */
export function clearLocalAll(): void {
  try {
    localStorage.removeItem(DATA_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

/** 导出为格式化的 JSON 字符串 */
export function serializeData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

/** 校验并解析导入的 JSON；结构非法时抛出错误（复用 normalizeData 的校验与迁移） */
export function parseImportedData(json: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('JSON 格式错误，无法解析')
  }
  const data = normalizeData(parsed)
  if (!data) {
    throw new Error('数据缺少必要的字段（tasks / subjects / sites）')
  }
  return data
}

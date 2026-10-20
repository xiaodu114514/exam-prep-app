// 全局数据类型定义。为后续接入后端 API / SQLite 预留：这些接口即未来的实体模型。

/** 考试信息 */
export interface Exam {
  name: string
  /** 考试日期，格式 YYYY-MM-DD */
  date: string
}

/** 背诵科目 */
export interface Subject {
  id: string
  name: string
  /** 计量单位：单词 / 知识点 / 章节 等 */
  unit: string
  /** 总任务量，必须大于 0 */
  total: number
  /** 已完成量，0 <= completed <= total */
  completed: number
}

/** 快捷备考网站 */
export interface StudySite {
  id: string
  name: string
  url: string
}

/** 学习任务 */
export interface Task {
  id: string
  title: string
  /** 任务所属日期，格式 YYYY-MM-DD */
  date: string
  completed: boolean
  /** 可选科目标签，关联 Subject.id */
  subjectId: string | null
  /**
   * 背诵任务的背诵量（如 50 个单词）。
   * 仅当关联了科目且 amount > 0 时，勾选完成会同步累计到对应科目的已完成量。
   */
  amount: number | null
  /** 服务端计算的任务对科目的实际贡献量（后端 API 返回；本地旧数据无此字段） */
  contributed?: number
  /** 每日任务：从创建日起每天自动出现在任务列表，完成状态按天独立 */
  daily?: boolean
  /** 每日任务最近完成日期（YYYY-MM-DD） */
  doneDate?: string | null
}

/** 可自定义的应用文案（留空表示使用默认值） */
export interface AppTexts {
  /** 应用名称，空 = 稳步备考 */
  appName: string
  /** 主页问候语，空 = 按时间自动（早上好/下午好/晚上好等） */
  greeting: string
  /** 主页口号，空 = 今天也要稳步推进 */
  slogan: string
}

/** 应用整体持久化数据 */
export interface AppData {
  version: number
  exam: Exam
  subjects: Subject[]
  sites: StudySite[]
  tasks: Task[]
  /** 自定义文案（旧数据可能缺失，前端用默认值兜底） */
  texts?: AppTexts
}

/** 登录用户信息（服务端会话只返回 name；本地模拟登录历史数据可能带 loggedInAt） */
export interface UserProfile {
  name: string
  loggedInAt?: string
}

/** Toast 反馈类型 */
export type ToastType = 'success' | 'error' | 'info'

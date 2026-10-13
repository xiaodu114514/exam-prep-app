// 轻量日期工具，全部基于本地时间与 YYYY-MM-DD 字符串，避免引入日期库。

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Date -> YYYY-MM-DD */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 今天的日期键 */
export function todayKey(): string {
  return toDateKey(new Date())
}

/** YYYY-MM-DD -> 本地 Date */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 日期键加减天数 */
export function addDays(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** 计算 from -> to 的天数差（to - from） */
export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from)
  const b = parseDateKey(to)
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / 86_400_000)
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 以周一作为一周起点，返回某个日期所在周的周一 */
export function getWeekStart(key: string): string {
  const d = parseDateKey(key)
  const day = d.getDay() // 0 = 周日
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateKey(d)
}

export interface WeekRange {
  start: string
  end: string
  /** 周一到周日，共 7 个日期键 */
  days: string[]
}

/** 返回锚点日期所在周（周一~周日）的范围 */
export function getWeekRange(anchorKey: string): WeekRange {
  const start = getWeekStart(anchorKey)
  const days: string[] = []
  for (let i = 0; i < 7; i++) days.push(addDays(start, i))
  return { start, end: days[6], days }
}

/** 中文短日期：11月4日 */
export function formatDateShort(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 中文长日期：2025年11月4日 周二 */
export function formatDateLong(key: string): string {
  const d = parseDateKey(key)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_CN[d.getDay()]}`
}

/** 周几简称 */
export function weekdayShort(key: string): string {
  const d = parseDateKey(key)
  return `周${WEEK_CN[d.getDay()]}`
}

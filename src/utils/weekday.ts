/** 日期 -> 星期几（1=周一 … 7=周日） */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return wd === 0 ? 7 : wd
}

export const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

export const WEEKDAYS_WORKDAY = [1, 2, 3, 4, 5]
export const WEEKDAYS_WEEKEND = [6, 7]
export const WEEKDAYS_ALL = [1, 2, 3, 4, 5, 6, 7]

function sorted(days: number[]): number[] {
  return [...days].sort((a, b) => a - b)
}

/** 星期集合 -> 显示文案（每天 / 工作日 / 周末 / 周一 · 周三） */
export function weekdaysLabel(days: number[] | undefined): string {
  if (!days || days.length === 0) return ''
  const s = sorted(days)
  if (s.length === 7) return '每天'
  if (s.length === 5 && s[0] === 1 && s[4] === 5) return '工作日'
  if (s.length === 2 && s[0] === 6 && s[1] === 7) return '周末'
  return s.map((d) => WEEKDAY_NAMES[d]).join(' · ')
}

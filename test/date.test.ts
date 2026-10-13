import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  formatDateLong,
  formatDateShort,
  getWeekRange,
  getWeekStart,
  parseDateKey,
  toDateKey,
  weekdayShort,
} from '../src/utils/date'

describe('日期工具：格式转换', () => {
  it('toDateKey / parseDateKey 互逆', () => {
    expect(toDateKey(new Date(2025, 0, 15))).toBe('2025-01-15')
    const p = parseDateKey('2025-01-15')
    expect(p.getFullYear()).toBe(2025)
    expect(p.getMonth()).toBe(0)
    expect(p.getDate()).toBe(15)
  })

  it('中文格式化', () => {
    expect(formatDateShort('2025-11-04')).toBe('11月4日')
    expect(formatDateLong('2025-11-04')).toBe('2025年11月4日 周二')
    expect(weekdayShort('2025-11-04')).toBe('周二')
  })
})

describe('日期工具：加减与差值（考试倒计时边界）', () => {
  it('addDays 跨月 / 跨年 / 闰年', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29') // 闰年
  })

  it('daysBetween：未来为正、过去为负、当天为 0', () => {
    expect(daysBetween('2025-01-01', '2025-01-11')).toBe(10)
    expect(daysBetween('2025-01-11', '2025-01-01')).toBe(-10)
    expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })
})

describe('周统计边界：getWeekStart / getWeekRange', () => {
  it('周一作为一周起点', () => {
    // 2025-11-04 是周二，所在周周一为 2025-11-03
    expect(getWeekStart('2025-11-04')).toBe('2025-11-03')
    expect(getWeekStart('2025-11-03')).toBe('2025-11-03')
  })

  it('周日归属于本周而不是下周', () => {
    // 2025-11-09 是周日，所在周周一仍为 2025-11-03
    expect(getWeekStart('2025-11-09')).toBe('2025-11-03')
  })

  it('getWeekRange 返回周一至周日共 7 天', () => {
    const range = getWeekRange('2025-11-04')
    expect(range.start).toBe('2025-11-03')
    expect(range.end).toBe('2025-11-09')
    expect(range.days).toHaveLength(7)
    expect(range.days[0]).toBe('2025-11-03')
    expect(range.days[6]).toBe('2025-11-09')
  })

  it('跨年周边界', () => {
    // 2026-01-01 是周四，所在周为 2025-12-29 ~ 2026-01-04
    const range = getWeekRange('2026-01-01')
    expect(range.start).toBe('2025-12-29')
    expect(range.end).toBe('2026-01-04')
  })
})

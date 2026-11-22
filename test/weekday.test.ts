import { describe, expect, it } from 'vitest'
import { weekdayOf, weekdaysLabel } from '../src/utils/weekday'

describe('星期工具', () => {
  it('weekdayOf 返回 1-7（周一=1 … 周日=7）', () => {
    expect(weekdayOf('2025-10-27')).toBe(1) // 周一
    expect(weekdayOf('2025-10-28')).toBe(2) // 周二
    expect(weekdayOf('2025-10-31')).toBe(5) // 周五
    expect(weekdayOf('2025-11-01')).toBe(6) // 周六
    expect(weekdayOf('2025-11-02')).toBe(7) // 周日
  })

  it('weekdaysLabel 快捷档位文案', () => {
    expect(weekdaysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('每天')
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe('工作日')
    expect(weekdaysLabel([6, 7])).toBe('周末')
    expect(weekdaysLabel([1, 3])).toBe('周一 · 周三')
    expect(weekdaysLabel([1, 3, 5, 7])).toBe('周一 · 周三 · 周五 · 周日')
    expect(weekdaysLabel([])).toBe('')
    expect(weekdaysLabel(undefined)).toBe('')
  })
})

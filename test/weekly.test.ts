import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WeeklyView from '../src/views/WeeklyView.vue'
import { useAppStore, resetStoreForTest } from '../src/store/useAppStore'
import * as api from '../src/services/api'
import { addDays, getWeekRange, todayKey } from '../src/utils/date'
import type { AppData, Task } from '../src/types'

vi.mock('../src/services/api')

function emptyData(): AppData {
  return {
    version: 1,
    exam: { name: '', date: '' },
    subjects: [],
    sites: [],
    tasks: [],
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  resetStoreForTest()
  vi.mocked(api.authMe).mockResolvedValue({ user: { name: 'admin' } })
  vi.mocked(api.getData).mockResolvedValue(emptyData())
  await useAppStore().init()
})

function seedTasks(tasks: Task[]) {
  const store = useAppStore()
  store.state.data.tasks = tasks
  return store
}

function statValues(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.stat-card__value').map((n) => n.text())
}

describe('周汇总：统计规则', () => {
  it('本周任务总量 / 已完成 / 未完成 / 完成率真实计算', () => {
    const week = getWeekRange(todayKey())
    seedTasks([
      { id: 'a1', title: 'a1', date: week.start, completed: true, subjectId: null, amount: null },
      { id: 'a2', title: 'a2', date: week.start, completed: false, subjectId: null, amount: null },
      { id: 'b1', title: 'b1', date: week.end, completed: false, subjectId: null, amount: null },
      // 上周一的任务不计入本周
      { id: 'out', title: 'out', date: addDays(week.start, -1), completed: true, subjectId: null, amount: null },
    ])

    const wrapper = mount(WeeklyView)
    expect(statValues(wrapper)).toEqual(['3', '1', '2', '33%'])
  })

  it('周日任务计入本周，柱状图周一至周日共 7 列', () => {
    const week = getWeekRange(todayKey())
    seedTasks([{ id: 'b1', title: '周日任务', date: week.end, completed: false, subjectId: null, amount: null }])

    const wrapper = mount(WeeklyView)
    expect(wrapper.findAll('.chart__col')).toHaveLength(7)
    expect(statValues(wrapper)[0]).toBe('1')
  })

  it('切换上一周后统计按周变化', async () => {
    const week = getWeekRange(todayKey())
    seedTasks([
      { id: 'a1', title: '本周任务', date: week.start, completed: false, subjectId: null, amount: null },
      { id: 'out', title: '上周任务', date: addDays(week.start, -7), completed: true, subjectId: null, amount: null },
    ])

    const wrapper = mount(WeeklyView)
    expect(statValues(wrapper)).toEqual(['1', '0', '1', '0%'])

    await wrapper.findAll('.btn--icon')[0].trigger('click')
    expect(statValues(wrapper)).toEqual(['1', '1', '0', '100%'])
  })

  it('背诵任务计入周统计', () => {
    const week = getWeekRange(todayKey())
    seedTasks([
      { id: 't1', title: '背单词', date: week.start, completed: true, subjectId: 's1', amount: 30 },
    ])
    const wrapper = mount(WeeklyView)
    expect(statValues(wrapper)).toEqual(['1', '1', '0', '100%'])
  })

  it('每日任务从创建日起每天计入总量，历史天按未完成计', () => {
    const week = getWeekRange(todayKey())
    // 每日任务创建于本周一、今天已完成：本周 7 天每天出现（总量 7），仅今天算完成（1）
    seedTasks([
      {
        id: 'd1',
        title: '每日背单词',
        date: week.start,
        completed: true,
        subjectId: null,
        amount: null,
        daily: true,
        doneDate: todayKey(),
      },
    ])
    const wrapper = mount(WeeklyView)
    expect(statValues(wrapper)).toEqual(['7', '1', '6', '14%'])
  })
})

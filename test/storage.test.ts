import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadData,
  loadUser,
  normalizeData,
  parseImportedData,
  saveData,
  saveUser,
  serializeData,
} from '../src/services/storage'
import type { AppData } from '../src/types'

const VALID: AppData = {
  version: 1,
  exam: { name: '测试考试', date: '2025-12-20' },
  subjects: [{ id: 's1', name: '英语', unit: '单词', total: 100, completed: 10 }],
  sites: [{ id: 'w1', name: '粉笔', url: 'https://fenbi.com' }],
  tasks: [
    { id: 't1', title: '背单词', date: '2025-11-04', completed: false, subjectId: 's1', amount: 50 },
  ],
}

const DATA_KEY = 'exam-prep-app:data:v1'
const USER_KEY = 'exam-prep-app:user:v1'

beforeEach(() => {
  localStorage.clear()
})

describe('storage：持久化 round-trip', () => {
  it('saveData 后 loadData 读取一致', () => {
    expect(saveData(VALID)).toBe(true)
    const loaded = loadData()
    expect(loaded).not.toBeNull()
    expect(loaded!.exam.name).toBe('测试考试')
    expect(loaded!.tasks[0].amount).toBe(50)
    expect(loaded!.subjects).toHaveLength(1)
    expect(loaded!.sites[0].url).toBe('https://fenbi.com')
  })
})

describe('storage：损坏数据与版本迁移', () => {
  it('非法 JSON 返回 null', () => {
    localStorage.setItem(DATA_KEY, '{oops')
    expect(loadData()).toBeNull()
  })

  it('核心集合缺失返回 null', () => {
    localStorage.setItem(DATA_KEY, JSON.stringify({ exam: {} }))
    expect(loadData()).toBeNull()
  })

  it('v1 旧数据（任务无 amount）迁移后补齐 amount: null 且保留原数据', () => {
    const old = {
      version: 1,
      exam: { name: '旧考试', date: '2025-12-20' },
      subjects: [{ id: 's1', name: '英语', unit: '单词', total: 100, completed: 10 }],
      sites: [],
      tasks: [{ id: 't1', title: '旧任务', date: '2025-11-04', completed: true, subjectId: 's1' }],
    }
    localStorage.setItem(DATA_KEY, JSON.stringify(old))
    const loaded = loadData()
    expect(loaded).not.toBeNull()
    expect(loaded!.tasks[0].amount).toBeNull()
    expect(loaded!.tasks[0].title).toBe('旧任务')
    expect(loaded!.tasks[0].completed).toBe(true)
    expect(loaded!.tasks[0].subjectId).toBe('s1')
  })

  it('字段级问题被补齐而不是丢弃', () => {
    const bad = {
      version: 1,
      exam: null,
      subjects: [],
      sites: [],
      tasks: [{ id: 'x' }],
    }
    const normalized = normalizeData(bad)
    expect(normalized).not.toBeNull()
    expect(normalized!.exam.name).toBe('我的考试')
    expect(normalized!.tasks[0].title).toBe('未命名任务')
    expect(normalized!.tasks[0].completed).toBe(false)
    expect(normalized!.tasks[0].amount).toBeNull()
    expect(normalized!.tasks[0].date).not.toBe('')
  })

  it('科目非法数值被规范到合法范围', () => {
    const bad = {
      version: 1,
      exam: { name: 'x', date: '2025-01-01' },
      subjects: [
        { id: 's1', name: '英语', unit: '', total: -5, completed: 999 },
        { id: 's2', name: '政治', unit: '知识点', total: 100, completed: -3 },
      ],
      sites: [],
      tasks: [],
    }
    const normalized = normalizeData(bad)
    // total -5 非法 -> 1；completed 999 被钳制到 total(1)
    expect(normalized!.subjects[0].total).toBe(1)
    expect(normalized!.subjects[0].completed).toBe(1)
    expect(normalized!.subjects[0].unit).toBe('项')
    // completed -3 非法 -> 0
    expect(normalized!.subjects[1].total).toBe(100)
    expect(normalized!.subjects[1].completed).toBe(0)
  })
})

describe('storage：JSON 导入导出', () => {
  it('serializeData 输出格式化 JSON', () => {
    const json = serializeData(VALID)
    expect(json).toContain('"version": 1')
    expect(json).toContain('\n')
  })

  it('parseImportedData 解析合法数据', () => {
    const data = parseImportedData(JSON.stringify(VALID))
    expect(data.tasks[0].title).toBe('背单词')
    expect(data.exam.name).toBe('测试考试')
  })

  it('parseImportedData 拒绝非法 JSON', () => {
    expect(() => parseImportedData('not json')).toThrow('JSON 格式错误，无法解析')
  })

  it('parseImportedData 拒绝缺核心字段的数据', () => {
    expect(() => parseImportedData('{"exam":{}}')).toThrow('缺少必要的字段')
    expect(() => parseImportedData('null')).toThrow('缺少必要的字段')
  })

  it('parseImportedData 对旧版本数据自动迁移', () => {
    const old = {
      version: 1,
      exam: { name: 'x', date: '2025-01-01' },
      subjects: [],
      sites: [],
      tasks: [{ id: 't', title: 't', date: '2025-01-01', completed: false, subjectId: null }],
    }
    const data = parseImportedData(JSON.stringify(old))
    expect(data.tasks[0].amount).toBeNull()
  })
})

describe('storage：模拟登录用户', () => {
  it('saveUser / loadUser round-trip', () => {
    expect(saveUser({ name: '小明', loggedInAt: '2025-01-01T00:00:00Z' })).toBe(true)
    expect(loadUser()?.name).toBe('小明')
  })

  it('损坏的用户数据返回 null', () => {
    localStorage.setItem(USER_KEY, '{bad')
    expect(loadUser()).toBeNull()
  })
})

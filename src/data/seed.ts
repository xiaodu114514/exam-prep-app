import type { AppData } from '../types'
import { addDays, todayKey } from '../utils/date'

/**
 * 首次启动时写入 localStorage 的种子数据。
 * 考试日期相对“今天”生成，保证任意时间打开都有正向倒计时。
 */
export function createSeedData(): AppData {
  const today = todayKey()
  const examDate = addDays(today, 120)

  return {
    version: 1,
    exam: {
      name: '2026 国家公务员考试',
      date: examDate,
    },
    subjects: [
      { id: 'subj-en', name: '英语', unit: '单词', total: 3000, completed: 780 },
      { id: 'subj-politics', name: '政治', unit: '知识点', total: 240, completed: 96 },
      { id: 'subj-eng', name: '工程基础', unit: '章节', total: 36, completed: 12 },
    ],
    sites: [
      { id: 'site-1', name: '粉笔网', url: 'https://www.fenbi.com' },
      { id: 'site-2', name: '中公教育', url: 'https://www.offcn.com' },
      { id: 'site-3', name: '学习强国', url: 'https://www.xuexi.cn' },
    ],
    tasks: [
      { id: 'task-1', title: '行测·言语理解刷题 30 道', date: today, completed: true, subjectId: null, amount: null },
      { id: 'task-2', title: '英语词汇背诵 50 个', date: today, completed: true, subjectId: 'subj-en', amount: 50 },
      { id: 'task-3', title: '政治·马原知识点复习', date: today, completed: true, subjectId: 'subj-politics', amount: 3 },
      { id: 'task-4', title: '工程基础·第 3 章习题', date: today, completed: false, subjectId: 'subj-eng', amount: 1 },
      { id: 'task-5', title: '申论·每日素材积累', date: today, completed: false, subjectId: null, amount: null },
      { id: 'task-6', title: '行测·判断推理刷题 20 道', date: addDays(today, -1), completed: true, subjectId: null, amount: null },
      { id: 'task-7', title: '英语长难句精读 5 句', date: addDays(today, -1), completed: true, subjectId: 'subj-en', amount: 5 },
      { id: 'task-8', title: '政治·毛中特知识点复习', date: addDays(today, -2), completed: true, subjectId: 'subj-politics', amount: 3 },
      { id: 'task-9', title: '工程基础·第 2 章习题', date: addDays(today, -3), completed: true, subjectId: 'subj-eng', amount: 1 },
      { id: 'task-10', title: '行测·资料分析刷题 20 道', date: addDays(today, -4), completed: false, subjectId: null, amount: null },
    ],
  }
}

import type { CompletionRow, SiteRow, SubjectRow, TaskRow } from '../db'

/** 本地时区今天（YYYY-MM-DD），与前端日期工具保持一致 */
export function todayKeyLocal(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function toTaskDto(row: TaskRow, completions: CompletionRow[] = []) {
  if (row.daily === 1) {
    const today = todayKeyLocal()
    const sorted = [...completions].sort((a, b) => a.date.localeCompare(b.date))
    const todayComp = sorted.find((c) => c.date === today)
    const last = sorted.length > 0 ? sorted[sorted.length - 1] : null
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      // 兼容语义：completed 表示“今天是否完成”（新前端使用 completions 判断任意日期）
      completed: todayComp !== undefined,
      subjectId: row.subject_id,
      amount: row.amount,
      // 兼容语义：今天贡献量（历史日期见 completions）
      contributed: todayComp?.contributed ?? 0,
      completedAmount: todayComp?.completed_amount ?? null,
      daily: true,
      doneDate: last?.date ?? null,
      completions: sorted.map((c) => ({
        date: c.date,
        completedAmount: c.completed_amount,
        contributed: c.contributed,
      })),
    }
  }

  const completed = row.completed === 1
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    completed,
    subjectId: row.subject_id,
    amount: row.amount,
    contributed: row.contributed,
    completedAmount: completed ? row.completed_amount : null,
    daily: false,
    doneDate: null,
    completions: [] as Array<{ date: string; completedAmount: number | null; contributed: number }>,
  }
}

export function toSubjectDto(row: SubjectRow) {
  return { id: row.id, name: row.name, unit: row.unit, total: row.total, completed: row.completed }
}

export function toSiteDto(row: SiteRow) {
  return { id: row.id, name: row.name, url: row.url }
}

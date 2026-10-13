import { badRequest } from './errors'

/** 必填字符串（trim 后非空） */
export function requireString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw badRequest(`${field}不能为空`)
  return v.trim()
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 必填日期键（YYYY-MM-DD，含真实日历校验） */
export function requireDateKey(v: unknown, field = '日期'): string {
  const s = requireString(v, field)
  if (!DATE_RE.test(s)) throw badRequest(`${field}格式应为 YYYY-MM-DD`)
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    throw badRequest(`${field}不是有效日期`)
  }
  return s
}

/** 可选日期键（undefined 返回 null） */
export function optionalDateKey(v: unknown, field = '日期'): string | null {
  if (v === undefined || v === null || v === '') return null
  return requireDateKey(v, field)
}

/** 必填数字 */
export function requireNumber(v: unknown, field: string): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) throw badRequest(`${field}必须是数字`)
  return n
}

/** 可选数字（undefined/null/'' 返回 null） */
export function optionalNumber(v: unknown, field: string): number | null {
  if (v === undefined || v === null || v === '') return null
  return requireNumber(v, field)
}

/** 可选字符串（空串归一为 null） */
export function optionalString(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') throw badRequest('参数类型错误')
  const s = v.trim()
  return s === '' ? null : s
}

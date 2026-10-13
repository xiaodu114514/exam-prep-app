import { describe, expect, it } from 'vitest'
import { computeCompletion, computeRevoke, clampCompleted } from '../src/domain'

describe('背诵贡献计算：勾选与取消严格对称', () => {
  it('正常情况：amount 全部贡献', () => {
    const res = computeCompletion({ total: 3000, completed: 780 }, 50)
    expect(res).toEqual({ contributed: 50, completed: 830 })
  })

  it('到达总量上限时只贡献剩余空间', () => {
    const res = computeCompletion({ total: 100, completed: 95 }, 10)
    expect(res.contributed).toBe(5)
    expect(res.completed).toBe(100)
  })

  it('clamp 场景下取消勾选精确回退到原进度', () => {
    // 95 + 10 -> 100（实际贡献 5）；取消 -> 95
    const done = computeCompletion({ total: 100, completed: 95 }, 10)
    const revoked = computeRevoke({ total: 100, completed: done.completed }, done.contributed)
    expect(revoked.completed).toBe(95)
  })

  it('取消勾选不低于 0', () => {
    const revoked = computeRevoke({ total: 100, completed: 5 }, 30)
    expect(revoked.completed).toBe(0)
  })

  it('amount 为 0 或负数时无贡献', () => {
    expect(computeCompletion({ total: 100, completed: 10 }, 0).contributed).toBe(0)
    expect(computeCompletion({ total: 100, completed: 10 }, -5).contributed).toBe(0)
  })

  it('手动设置进度钳制到 [0, total]', () => {
    expect(clampCompleted(100, 150)).toBe(100)
    expect(clampCompleted(100, -10)).toBe(0)
    expect(clampCompleted(100, 42)).toBe(42)
  })
})

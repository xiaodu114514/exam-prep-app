/**
 * 背诵贡献计算（纯函数，供路由事务编排使用）。
 *
 * 规则（服务端权威，与前端旧逻辑的差异点在于「contributed 精确记账」）：
 * - 每个任务在 tasks.contributed 记录它对科目的实际贡献量（未完成时为 0）；
 * - 勾选完成：contributed = min(amount, total − completed)，completed += contributed；
 * - 取消完成：completed −= contributed（精确回退，不会因 clamp 产生不对称）；
 * - 手动修改科目进度：直接设置（由路由校验 [0, total]），不影响任务贡献记录。
 */

export interface SubjectState {
  total: number
  completed: number
}

/** 完成勾选时的贡献计算 */
export function computeCompletion(
  subject: SubjectState,
  amount: number,
): { contributed: number; completed: number } {
  const headroom = Math.max(0, subject.total - subject.completed)
  const contributed = Math.min(Math.max(0, amount), headroom)
  return { contributed, completed: subject.completed + contributed }
}

/** 取消勾选时的贡献撤销 */
export function computeRevoke(subject: SubjectState, contributed: number): { completed: number } {
  return { completed: Math.max(0, subject.completed - Math.max(0, contributed)) }
}

/** 手动设置进度时钳制到 [0, total] */
export function clampCompleted(total: number, completed: number): number {
  return Math.min(total, Math.max(0, completed))
}

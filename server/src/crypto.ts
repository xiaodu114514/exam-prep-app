import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/** 生成 scrypt 密码哈希，格式 salt:hash（不存明文） */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** 常量时间校验密码 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  let candidate: Buffer
  try {
    candidate = scryptSync(password, salt, 64)
  } catch {
    return false
  }
  const expected = Buffer.from(hash, 'hex')
  if (expected.length !== 64) return false
  return timingSafeEqual(candidate, expected)
}

/** 生成会话原始 token（256 位随机，Cookie 携带；数据库只存其 SHA-256 摘要） */
export function newSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword, newSessionToken, sha256Hex } from '../src/crypto'

describe('密码哈希（scrypt）与常量时间校验', () => {
  it('正确密码验证通过，错误密码失败', () => {
    const stored = hashPassword('secret123')
    expect(stored).not.toContain('secret123')
    expect(verifyPassword('secret123', stored)).toBe(true)
    expect(verifyPassword('wrong-password', stored)).toBe(false)
  })

  it('盐随机：同一密码两次哈希结果不同', () => {
    expect(hashPassword('same-password')).not.toBe(hashPassword('same-password'))
  })

  it('损坏或篡改的存储值一律返回 false', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false)
    expect(verifyPassword('x', 'deadbeef')).toBe(false)
    const stored = hashPassword('secret123')
    const [salt, hash] = stored.split(':')
    const tampered = `${salt}:${'0'.repeat(64)}`
    expect(verifyPassword('secret123', tampered)).toBe(false)
  })

  it('哈希不包含明文密码', () => {
    const stored = hashPassword('super-secret-口令')
    expect(stored).not.toContain('super-secret-口令')
    expect(stored).not.toContain('口令')
  })
})

describe('Session token 与摘要', () => {
  it('token 为 64 位 hex 且每次随机', () => {
    const a = newSessionToken()
    const b = newSessionToken()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })

  it('sha256Hex 输出稳定且长度 64', () => {
    expect(sha256Hex('abc')).toHaveLength(64)
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'))
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'))
  })
})

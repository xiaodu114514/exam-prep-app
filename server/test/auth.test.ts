import { describe, expect, it } from 'vitest'
import { sha256Hex, newSessionToken } from '../src/crypto'
import { createTestApp, login } from './helpers'

describe('登录与会话', () => {
  it('登录成功返回用户并设置带安全属性的 Cookie', async () => {
    const { app } = createTestApp()
    const { res, cookie } = await login(app)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ user: { name: 'admin' } })

    const setCookie = String(res.headers['set-cookie'])
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/')
    expect(cookie.startsWith('sid=')).toBe(true)
  })

  it('密码错误返回 401', async () => {
    const { app } = createTestApp()
    const { res } = await login(app, 'admin', 'wrong-password')
    expect(res.statusCode).toBe(401)
  })

  it('连续失败达到上限后返回 429', async () => {
    const { app } = createTestApp()
    for (let i = 0; i < 5; i++) {
      const { res } = await login(app, 'admin', 'wrong-password')
      expect(res.statusCode).toBe(401)
    }
    const { res } = await login(app, 'admin', 'wrong-password')
    expect(res.statusCode).toBe(429)
  })

  it('未登录访问数据接口返回 401', async () => {
    const { app } = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/data' })
    expect(res.statusCode).toBe(401)
  })

  it('me 接口返回当前用户，退出后失效', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    expect(me.statusCode).toBe(200)
    expect(me.json()).toEqual({ user: { name: 'admin' } })

    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } })
    expect(logout.statusCode).toBe(200)

    const meAfter = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    expect(meAfter.statusCode).toBe(401)
  })

  it('会话过期后返回 401', async () => {
    const { app, db } = createTestApp()
    // 直接写入一个已过期的会话
    const token = 'expired-token-for-test'
    db.prepare(
      `INSERT INTO sessions (token_sha256, user_id, created_at, expires_at)
       VALUES (?, 1, '2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z')`,
    ).run(sha256Hex(token))

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `sid=${token}` },
    })
    expect(res.statusCode).toBe(401)
  })

  it('sessions 表只存 token 摘要，不存原始 token', async () => {
    const { app, db } = createTestApp()
    const { cookie } = await login(app)
    const rawToken = cookie.slice('sid='.length)
    const rows = db.prepare(`SELECT token_sha256 FROM sessions`).all() as { token_sha256: string }[]
    expect(rows.length).toBe(1)
    expect(rows[0].token_sha256).toBe(sha256Hex(rawToken))
    expect(rows[0].token_sha256).not.toBe(rawToken)
    expect(newSessionToken().length).toBe(64)
  })
})

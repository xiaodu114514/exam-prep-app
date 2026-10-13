import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Config } from './config'
import type { DB } from './db'
import { hashPassword, newSessionToken, sha256Hex, verifyPassword } from './crypto'
import { tooManyRequests, unauthorized } from './errors'
import { requireString } from './validation'

export const SESSION_COOKIE = 'sid'

export interface AuthedUser {
  id: number
  username: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthedUser
  }
}

export interface AuthDeps {
  db: DB
  config: Config
}

/** 登录失败限流（内存计数，按 IP，窗口内超过上限返回 429） */
export class LoginRateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>()
  constructor(
    private readonly max = 5,
    private readonly windowMs = 60_000,
  ) {}

  isBlocked(key: string): boolean {
    const rec = this.hits.get(key)
    if (!rec) return false
    if (Date.now() - rec.windowStart >= this.windowMs) {
      this.hits.delete(key)
      return false
    }
    return rec.count >= this.max
  }

  recordFailure(key: string): void {
    const now = Date.now()
    const rec = this.hits.get(key)
    if (!rec || now - rec.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now })
    } else {
      rec.count += 1
    }
  }

  clear(key: string): void {
    this.hits.delete(key)
  }
}

function createSession(db: DB, userId: number, ttlMs: number): string {
  const token = newSessionToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)
  db.prepare(
    `INSERT INTO sessions (token_sha256, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
  ).run(sha256Hex(token), userId, now.toISOString(), expiresAt.toISOString())
  return token
}

function destroySession(db: DB, token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token_sha256 = ?`).run(sha256Hex(token))
}

function setSessionCookie(reply: FastifyReply, token: string, config: Config, maxAgeMs: number): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  })
}

function clearSessionCookie(reply: FastifyReply, config: Config): void {
  reply.setCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/**
 * 会话鉴权中间件（preHandler 使用）。
 * 所有备考数据接口都必须挂载，服务端强制校验，不依赖前端路由守卫。
 */
export function requireAuth(db: DB) {
  return async (req: FastifyRequest): Promise<void> => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined
    if (!token || token === '') throw unauthorized()
    const hash = sha256Hex(token)
    const row = db
      .prepare(
        `SELECT u.id, u.username, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_sha256 = ?`,
      )
      .get(hash) as { id: number; username: string; expires_at: string } | undefined
    if (!row) throw unauthorized()
    if (new Date(row.expires_at).getTime() < Date.now()) {
      db.prepare(`DELETE FROM sessions WHERE token_sha256 = ?`).run(hash)
      throw unauthorized('会话已过期，请重新登录')
    }
    req.user = { id: row.id, username: row.username }
  }
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { db, config } = deps
  const limiter = new LoginRateLimiter()

  app.post('/api/auth/login', async (req, reply) => {
    const key = req.ip
    if (limiter.isBlocked(key)) throw tooManyRequests()

    const body = (req.body ?? {}) as Record<string, unknown>
    const username = requireString(body.username, '用户名')
    const password = requireString(body.password, '密码')

    const user = db
      .prepare(`SELECT id, username, password_hash FROM users WHERE username = ?`)
      .get(username) as { id: number; username: string; password_hash: string } | undefined

    if (!user || !verifyPassword(password, user.password_hash)) {
      limiter.recordFailure(key)
      throw unauthorized('用户名或密码错误')
    }
    limiter.clear(key)

    const token = createSession(db, user.id, config.sessionTtlMs)
    setSessionCookie(reply, token, config, config.sessionTtlMs)
    return { user: { name: user.username } }
  })

  app.get(
    '/api/auth/me',
    { preHandler: requireAuth(db) },
    async (req) => ({ user: { name: req.user!.username } }),
  )

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined
    if (token && token !== '') destroySession(db, token)
    clearSessionCookie(reply, config)
    return { ok: true }
  })
}

export { hashPassword }

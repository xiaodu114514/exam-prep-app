import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/index'
import { openDatabase, type DB } from '../src/db'
import { hashPassword } from '../src/crypto'
import type { Config } from '../src/config'

export const TEST_PASSWORD = 'secret123'

export function createTestApp(overrides?: Partial<Config>) {
  const db: DB = openDatabase(':memory:')
  db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`).run(
    'admin',
    hashPassword(TEST_PASSWORD),
  )
  const config: Config = {
    port: 3001,
    dbPath: ':memory:',
    sessionTtlMs: 60_000,
    cookieSecure: false,
    trustProxy: false,
    ...overrides,
  }
  const app: FastifyInstance = buildApp({ db, config })
  return { app, db, config }
}

/** 登录并提取 sid Cookie */
export async function login(
  app: FastifyInstance,
  username = 'admin',
  password = TEST_PASSWORD,
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  })
  const header = res.headers['set-cookie']
  const setCookie = Array.isArray(header) ? header.join(';') : String(header ?? '')
  const match = /sid=([^;]+)/.exec(setCookie)
  return { res, cookie: match ? `sid=${match[1]}` : '' }
}

export async function authedRequest(
  app: FastifyInstance,
  cookie: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  url: string,
  payload?: unknown,
) {
  return app.inject({
    method,
    url,
    payload: payload as never,
    headers: { cookie },
  })
}

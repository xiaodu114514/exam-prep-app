export interface Config {
  /** 监听端口（只绑定 127.0.0.1） */
  port: number
  /** SQLite 数据库文件路径 */
  dbPath: string
  /** 会话有效期（毫秒） */
  sessionTtlMs: number
  /** 是否给 Cookie 加 Secure（生产 HTTPS 环境） */
  cookieSecure: boolean
  /** 是否信任反向代理头（Nginx 之后取真实 IP 用于限流） */
  trustProxy: boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3001)
  const ttlDays = Number(env.SESSION_TTL_DAYS ?? 7)
  return {
    port: Number.isFinite(port) && port > 0 ? port : 3001,
    dbPath: env.DB_PATH && env.DB_PATH !== '' ? env.DB_PATH : 'data/app.db',
    sessionTtlMs:
      (Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 7) * 24 * 60 * 60 * 1000,
    cookieSecure: env.COOKIE_SECURE === '1',
    trustProxy: env.TRUST_PROXY === '1',
  }
}

import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

describe('健康检查接口', () => {
  it('无需登录即可访问，返回最小状态', async () => {
    const { app } = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('响应不包含任何敏感信息', async () => {
    const { app } = createTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    const body = res.body.toLowerCase()
    for (const sensitive of [
      'password',
      'admin',
      'secret',
      'sqlite',
      'app.db',
      'token',
      'session',
      '127.0.0.1',
      'env',
      'cookie',
    ]) {
      expect(body).not.toContain(sensitive)
    }
  })
})

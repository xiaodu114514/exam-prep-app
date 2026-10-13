import { describe, expect, it } from 'vitest'
import { createTestApp, login } from './helpers'

describe('CSRF 同源 Origin 校验', () => {
  it('无 Origin 头（curl/测试/后端间调用）放行', async () => {
    const { app } = createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'secret123' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('同源 Origin 放行', async () => {
    const { app } = createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'http://localhost:5173', host: 'localhost:5173' },
      payload: { username: 'admin', password: 'secret123' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('跨源 Origin 返回 403，且不执行处理器', async () => {
    const { app } = createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'https://evil.example.com', host: 'localhost:5173' },
      payload: { username: 'admin', password: 'secret123' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('跨源')
  })

  it('非法 Origin 头返回 403', async () => {
    const { app } = createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'not-a-url', host: 'localhost:5173' },
      payload: { username: 'admin', password: 'secret123' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('跨源校验同样拦截数据接口', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { origin: 'https://evil.example.com', host: 'localhost:5173', cookie },
      payload: { title: 'x', date: '2025-11-04' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('GET 请求不受 Origin 校验影响（导航/读取放行）', async () => {
    const { app } = createTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example.com', host: 'localhost:5173' },
    })
    expect(res.statusCode).toBe(200)
  })
})

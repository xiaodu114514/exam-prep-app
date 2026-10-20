import { describe, expect, it } from 'vitest'
import { createTestApp, login, authedRequest } from './helpers'

describe('自定义文案接口', () => {
  it('默认返回空文案', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    expect(data.json().texts).toEqual({ appName: '', greeting: '', slogan: '' })
  })

  it('PUT /api/texts 更新并持久化', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'PUT', '/api/texts', {
      appName: '我的备考',
      greeting: '晚上好',
      slogan: '今天也要稳步推进',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().texts).toEqual({
      appName: '我的备考',
      greeting: '晚上好',
      slogan: '今天也要稳步推进',
    })

    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    expect(data.json().texts.appName).toBe('我的备考')
  })

  it('部分更新保留其他字段', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    await authedRequest(app, cookie, 'PUT', '/api/texts', { appName: 'A' })
    const res = await authedRequest(app, cookie, 'PUT', '/api/texts', { slogan: '加油' })
    expect(res.json().texts).toEqual({ appName: 'A', greeting: '', slogan: '加油' })
  })

  it('超长文案返回 400', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const res = await authedRequest(app, cookie, 'PUT', '/api/texts', { appName: 'x'.repeat(61) })
    expect(res.statusCode).toBe(400)
  })

  it('导入导出包含文案', async () => {
    const { app } = createTestApp()
    const { cookie } = await login(app)
    const payload = {
      version: 1,
      exam: { name: 'x', date: '2025-12-01' },
      subjects: [],
      sites: [],
      tasks: [],
      texts: { appName: '导入名', greeting: '你好', slogan: '前进' },
    }
    const res = await authedRequest(app, cookie, 'POST', '/api/data/import', payload)
    expect(res.statusCode).toBe(200)
    const data = await authedRequest(app, cookie, 'GET', '/api/data')
    expect(data.json().texts.appName).toBe('导入名')

    const exported = await authedRequest(app, cookie, 'GET', '/api/data/export')
    expect(JSON.parse(exported.body).texts.greeting).toBe('你好')
  })
})

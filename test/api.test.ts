import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, authLogin, authMe, setUnauthorizedHandler } from '../src/services/api'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setUnauthorizedHandler(() => {})
})

describe('API 封装：请求与解析', () => {
  it('成功请求返回 JSON，携带 same-origin 凭证', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: { name: 'admin' } }))
    const res = await authMe()
    expect(res).toEqual({ user: { name: 'admin' } })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/me')
    expect(init.credentials).toBe('same-origin')
  })

  it('POST 请求带 JSON 头与序列化 body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: { name: 'admin' } }))
    await authLogin('admin', 'pw')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ username: 'admin', password: 'pw' })
  })

  it('HTTP 错误提取后端 {error} 消息', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: '总任务量必须是大于 0 的数字' }))
    await expect(authMe()).rejects.toThrow('总任务量必须是大于 0 的数字')
  })

  it('非 JSON 错误响应给出通用提示', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 500 }))
    await expect(authMe()).rejects.toThrow('请求失败（500）')
  })

  it('401 触发全局回调且只触发一次', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(jsonResponse(401, { error: '未登录或会话已过期' }))
    await expect(authMe()).rejects.toThrow(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('网络失败抛出友好错误', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(authMe()).rejects.toThrow('网络连接失败')
  })
})

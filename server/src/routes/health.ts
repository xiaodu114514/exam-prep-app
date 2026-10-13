import type { FastifyInstance } from 'fastify'

/**
 * 健康检查：无需登录，仅返回不含敏感信息的状态。
 * 不暴露数据库路径、环境变量、内部错误或版本细节。
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/api/health', async () => ({ status: 'ok' }))
}

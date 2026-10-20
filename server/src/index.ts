import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { loadConfig, type Config } from './config'
import { openDatabase, type DB } from './db'
import { AppError } from './errors'
import { registerAuthRoutes, requireAuth } from './auth'
import { registerHealthRoutes } from './routes/health'
import { registerDataRoutes } from './routes/data'
import { registerExamRoutes } from './routes/exam'
import { registerTaskRoutes } from './routes/tasks'
import { registerSubjectRoutes } from './routes/subjects'
import { registerSiteRoutes } from './routes/sites'
import { registerImportExportRoutes } from './routes/importExport'
import { registerTextRoutes } from './routes/texts'
import { registerAgentRoutes } from './routes/agent'

export interface AppDeps {
  db: DB
  config: Config
}

export function buildApp(deps?: Partial<AppDeps>) {
  const config = deps?.config ?? loadConfig()
  const db = deps?.db ?? openDatabase(config.dbPath)

  const app = Fastify({
    trustProxy: config.trustProxy,
    logger: false,
  })

  void app.register(fastifyCookie)

  // CSRF 防护（与 SameSite=Lax 叠加）：非 GET/HEAD/OPTIONS 的 /api/ 请求，
  // 若携带 Origin 头则必须与请求 Host 同源；无 Origin 的非浏览器客户端（curl/测试）放行。
  app.addHook('onRequest', async (req, reply) => {
    const method = (req.method ?? '').toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
    if (!req.url.startsWith('/api/')) return
    const origin = req.headers.origin
    if (!origin) return
    const host = req.headers.host
    if (!host) return
    try {
      if (new URL(origin).host !== host) {
        return reply.status(403).send({ error: '跨源请求被拒绝' })
      }
    } catch {
      return reply.status(403).send({ error: '非法的 Origin 头' })
    }
  })

  // 统一错误处理：
  // - AppError -> 对应状态码；
  // - Fastify 框架错误（如 415 不支持的媒体类型）-> 保留其状态码；
  // - 其余未知错误 -> 500，不泄露内部信息（本地日志输出堆栈便于排错）。
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: err.message })
    }
    const maybeError = err as { statusCode?: unknown; message?: unknown }
    const statusCode = typeof maybeError.statusCode === 'number' ? maybeError.statusCode : 500
    if (statusCode >= 500) {
      console.error('[unhandled-error]', req.method, req.url)
      console.error(err)
      return reply.status(500).send({ error: '服务器内部错误' })
    }
    return reply.status(statusCode).send({
      error: typeof maybeError.message === 'string' ? maybeError.message : '请求错误',
    })
  })

  // /api/ 下未匹配路由返回 JSON 404，避免与前端 SPA 路由混淆
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.status(404).send({ error: '接口不存在' })
    }
    return reply.status(404).send({ error: '未找到' })
  })

  registerHealthRoutes(app)
  registerAuthRoutes(app, { db, config })

  // 所有备考数据接口统一挂会话鉴权
  const auth = requireAuth(db)
  registerDataRoutes(app, db, auth)
  registerExamRoutes(app, db, auth)
  registerTaskRoutes(app, db, auth)
  registerSubjectRoutes(app, db, auth)
  registerSiteRoutes(app, db, auth)
  registerImportExportRoutes(app, db, auth)
  registerTextRoutes(app, db, auth)
  registerAgentRoutes(app, db, config)

  return app
}

// 仅直接运行时启动（测试通过 buildApp + inject，不监听端口）
const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))

if (isMain) {
  const config = loadConfig()
  const app = buildApp({ config })
  app
    .listen({ host: '127.0.0.1', port: config.port })
    .then(() => {
      console.log(`exam-prep-server listening on http://127.0.0.1:${config.port}`)
    })
    .catch((err) => {
      console.error('failed to start server:', err)
      process.exit(1)
    })
}

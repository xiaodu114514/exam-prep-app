import type { FastifyInstance } from 'fastify'
import type { DB, AppTextsRow } from '../db'
import { badRequest } from '../errors'
import type { AuthPreHandler } from './tasks'

const MAX_LEN = 60

function readTexts(db: DB) {
  const row = db
    .prepare(`SELECT id, app_name, greeting, slogan FROM app_texts WHERE id = 1`)
    .get() as AppTextsRow
  return { appName: row.app_name, greeting: row.greeting, slogan: row.slogan }
}

function optionalText(v: unknown, field: string): string {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string') throw badRequest(`${field}必须是字符串`)
  const s = v.trim()
  if (s.length > MAX_LEN) throw badRequest(`${field}不能超过 ${MAX_LEN} 个字符`)
  return s
}

export function registerTextRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  app.put('/api/texts', { preHandler: auth }, async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const current = readTexts(db)
    const appName = body.appName !== undefined ? optionalText(body.appName, '应用名称') : current.appName
    const greeting = body.greeting !== undefined ? optionalText(body.greeting, '问候语') : current.greeting
    const slogan = body.slogan !== undefined ? optionalText(body.slogan, '主页口号') : current.slogan

    db.prepare(`UPDATE app_texts SET app_name = ?, greeting = ?, slogan = ? WHERE id = 1`).run(
      appName,
      greeting,
      slogan,
    )
    return { texts: readTexts(db) }
  })
}

export { readTexts }

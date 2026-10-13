import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { DB, SiteRow } from '../db'
import { notFound } from '../errors'
import { requireString } from '../validation'
import { toSiteDto } from './shared'
import type { AuthPreHandler } from './tasks'

function findSite(db: DB, id: string): SiteRow | undefined {
  return db.prepare(`SELECT id, name, url FROM sites WHERE id = ?`).get(id) as SiteRow | undefined
}

/** 无协议时自动补 https://（与前端表单行为一致） */
function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function registerSiteRoutes(app: FastifyInstance, db: DB, auth: AuthPreHandler): void {
  app.post('/api/sites', { preHandler: auth }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const name = requireString(body.name, '网站名称')
    const url = normalizeUrl(requireString(body.url, '网址'))
    const id = randomUUID()
    db.prepare(`INSERT INTO sites (id, name, url) VALUES (?, ?, ?)`).run(id, name, url)
    return reply.status(201).send({ site: toSiteDto(findSite(db, id)!) })
  })

  app.patch('/api/sites/:id', { preHandler: auth }, async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const { id } = req.params as { id: string }
    const old = findSite(db, id)
    if (!old) throw notFound('网站不存在')
    const name = body.name !== undefined ? requireString(body.name, '网站名称') : old.name
    const url =
      body.url !== undefined ? normalizeUrl(requireString(body.url, '网址')) : old.url
    db.prepare(`UPDATE sites SET name=?, url=? WHERE id=?`).run(name, url, id)
    return { site: toSiteDto(findSite(db, id)!) }
  })

  app.delete('/api/sites/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    if (!findSite(db, id)) throw notFound('网站不存在')
    db.prepare(`DELETE FROM sites WHERE id = ?`).run(id)
    return { ok: true }
  })
}

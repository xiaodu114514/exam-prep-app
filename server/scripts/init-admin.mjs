/**
 * 初始化管理员账号（交互式，密码隐藏输入 + 二次确认）。
 *
 * 用法：
 *   node scripts/init-admin.mjs [数据库路径]     # 默认 server/data/app.db
 *
 * 也支持一次性环境变量（仅限自动化场景，勿长期保留）：
 *   ADMIN_USERNAME=... ADMIN_PASSWORD=... node scripts/init-admin.mjs
 *
 * 安全说明：密码不写入任何文件、不写入源码；数据库仅保存 scrypt 盐值哈希。
 * 命令历史不会记录交互输入的内容（环境变量方式除外，慎用）。
 */
import Database from 'better-sqlite3'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'

const dbPath = process.argv[2] ? resolve(process.argv[2]) : resolve('data/app.db')

function promptHidden(question) {
  return new Promise((resolvePromise) => {
    if (!input.isTTY) {
      // 非交互环境：交由环境变量（上方已处理），此处兜底
      resolvePromise('')
      return
    }
    output.write(question)
    input.setRawMode(true)
    input.resume()
    input.setEncoding('utf-8')
    let buf = ''
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          input.off('data', onData)
          input.setRawMode(false)
          input.pause()
          output.write('\n')
          resolvePromise(buf)
          return
        }
        if (ch === '\u0003') {
          input.setRawMode(false)
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') {
          buf = buf.slice(0, -1)
        } else {
          buf += ch
        }
      }
    }
    input.on('data', onData)
  })
}

async function main() {
  let username = process.env.ADMIN_USERNAME ?? ''
  let password = process.env.ADMIN_PASSWORD ?? ''

  if (!username) {
    for (;;) {
      username = (await promptHidden('管理员用户名: ')).trim()
      if (username) break
      output.write('用户名不能为空\n')
    }
  }
  if (!password) {
    for (;;) {
      password = await promptHidden('管理员密码（输入不回显）: ')
      if (!password) {
        output.write('密码不能为空\n')
        continue
      }
      const confirm = await promptHidden('再次输入确认: ')
      if (password === confirm) break
      output.write('两次输入不一致，请重新输入\n')
    }
  }

  if (!username || !password) {
    output.write('用户名与密码不能为空\n')
    process.exit(1)
  }

  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  db.prepare(
    `INSERT INTO users (username, password_hash) VALUES (?, ?)
     ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`,
  ).run(username, `${salt}:${hash}`)
  db.close()

  output.write(`管理员账号已初始化: ${username}\n`)
  output.write(`数据库路径: ${dbPath}\n`)
  output.write('密码未以任何形式保存，请妥善记忆。\n')
}

main().catch((err) => {
  output.write(`初始化失败: ${err.message}\n`)
  process.exit(1)
})

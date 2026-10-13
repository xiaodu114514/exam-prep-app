/**
 * 生产构建产物验证脚本（在 `npm run build` 之后执行）：
 * 检查 dist 中的 PWA 文件、manifest 内容、Service Worker 关键逻辑。
 * 用法：npm run verify:build
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')
const failures = []

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  OK  ${name}`)
  } else {
    console.log(`  FAIL ${name} ${detail}`)
    failures.push(name)
  }
}

if (!existsSync(dist)) {
  console.error('dist 目录不存在，请先执行 npm run build')
  process.exit(1)
}

const html = readFileSync(join(dist, 'index.html'), 'utf-8')
const sw = readFileSync(join(dist, 'sw.js'), 'utf-8')
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf-8'))

console.log('== 基础文件 ==')
check('index.html', existsSync(join(dist, 'index.html')))
check('manifest.webmanifest', existsSync(join(dist, 'manifest.webmanifest')))
check('sw.js', existsSync(join(dist, 'sw.js')))
check('registerSW.js', existsSync(join(dist, 'registerSW.js')))
check('workbox 运行库', readdirSync(dist).some((f) => /^workbox-.*\.js$/.test(f)))

console.log('== index.html 集成 ==')
check('包含 manifest 链接', html.includes('rel="manifest"'))
check('包含 registerSW 脚本', html.includes('registerSW.js'))
check('包含 apple-touch-icon', html.includes('apple-touch-icon'))

console.log('== manifest 内容 ==')
check('name = 稳步备考', manifest.name === '稳步备考')
check('short_name = 稳步备考', manifest.short_name === '稳步备考')
check('display = standalone', manifest.display === 'standalone')
check('start_url = /', manifest.start_url === '/')
check('scope = /', manifest.scope === '/')
check('theme_color = #4a7cc2', manifest.theme_color === '#4a7cc2')
check('含 maskable 图标', manifest.icons.some((i) => i.purpose === 'maskable'))
check('图标数量 >= 3', manifest.icons.length >= 3)

console.log('== Service Worker 逻辑 ==')
check('预缓存应用壳 (precacheAndRoute)', sw.includes('precacheAndRoute'))
check('SPA 回退到 index.html', sw.includes('index.html'))
// sw.js 中正则以转义形式存在：denylist:[/^\/api\//]，因此检查关键字而非字面子串
check('排除 /api/（denylist）', sw.includes('denylist') && sw.includes('api'))
check('自动更新（skipWaiting）', sw.includes('skipWaiting'))
check('接管页面（clientsClaim）', sw.includes('clientsClaim'))
check('清理过期缓存', sw.includes('cleanupOutdatedCaches'))

const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1])
const dup = urls.filter((u, i) => urls.indexOf(u) !== i)
check(`precache 无重复条目（共 ${urls.length} 条）`, dup.length === 0, `重复: ${[...new Set(dup)].join(', ')}`)
check('precache 包含应用壳 JS', urls.some((u) => u.startsWith('assets/') && u.endsWith('.js')))

console.log('== 图标 ==')
for (const icon of ['pwa-192x192.png', 'pwa-512x512.png', 'pwa-512x512-maskable.png', 'apple-touch-icon.png']) {
  check(`图标 ${icon}`, existsSync(join(dist, icon)))
}

if (failures.length) {
  console.error(`\n${failures.length} 项检查失败`)
  process.exit(1)
}
console.log('\n全部检查通过')

/* reads the dist sourcemap and reports approximate contribution per source package */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const maps = readdirSync('dist/assets').filter((f) => f.endsWith('.js.map'))
for (const mapName of maps) {
  const raw = readFileSync(join('dist/assets', mapName), 'utf8')
  if (!raw.trimStart().startsWith('{')) continue
  const map = JSON.parse(raw)
  const byRoot = new Map()
  ;(map.sources ?? []).forEach((s, i) => {
    const content = (map.sourcesContent?.[i] ?? '').length
    if (!content) return
    const clean = s.replace(/^webpack:\/\//, '').replace(/^.*node_modules[\\/]/, 'nm/').replace(/\\/g, '/')
    const root = clean.startsWith('nm/')
      ? 'nm/' + clean.slice(3).split('/').filter((p) => !p.startsWith('@') ? true : p).slice(0, 2).join('/')
      : 'src/' + clean.split('src/')[1]?.split('?')[0]?.split('/').slice(0, 2).join('/')
    byRoot.set(root, (byRoot.get(root) ?? 0) + content)
  })
  const rows = [...byRoot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  console.log('\n==', mapName)
  let total = 0
  for (const [k, v] of rows) {
    total += v
    console.log(k.padEnd(40), (v / 1024).toFixed(1) + ' KB')
  }
  console.log('TOTAL (top):', (total / 1024).toFixed(1) + ' KB')
}

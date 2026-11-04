/**
 * Derives PNG PWA icons from public/favicon.svg using sharp (dev-time only).
 * Run once: node scripts/make-icons.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const svg = readFileSync('public/favicon.svg', 'utf8')
mkdirSync('public/icons', { recursive: true })

// full-bleed square for maskable icons (Android safe zone): logo scaled to ~78%
function scaleSvg(s, factor) {
  return s.replace(/<rect width="64" height="64"/, `<rect x="${-64 * ((1 - factor) / 2)}" y="${-64 * ((1 - factor) / 2)}" width="${64 / factor}" height="${64 / factor}"`)
}

async function make(size, svgText, out) {
  const buf = await sharp(Buffer.from(svgText)).resize(size, size).png().toBuffer()
  writeFileSync(out, buf)
  console.log('wrote', out)
}

await make(192, svg, 'public/icons/pwa-192.png')
await make(512, svg, 'public/icons/pwa-512.png')
await make(512, scaleSvg(svg, 0.72), 'public/icons/pwa-512-maskable.png')

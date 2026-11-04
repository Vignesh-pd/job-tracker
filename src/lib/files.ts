/* text extraction from resume files — everything is loaded on demand so the
   main bundle never carries pdf.js (~1MB) or mammoth */

export interface ReadResult {
  text: string
  method: string
}

export async function readResumeText(file: File): Promise<ReadResult> {
  const name = file.name.toLowerCase()
  const ext = name.slice(name.lastIndexOf('.') + 1)

  if (ext === 'txt' || ext === 'md' || ext === 'markdown' || file.type === 'text/plain') {
    const text = await file.text()
    return { text, method: 'text file' }
  }
  if (ext === 'pdf' || file.type === 'application/pdf') return readPdf(file)
  if (ext === 'docx' || file.type.includes('officedocument.wordprocessingml')) return readDocx(file)
  if (ext === 'rtf' || file.type === 'application/rtf') return readRtf(file)
  if (ext === 'doc') {
    const buffer = await file.arrayBuffer()
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    // legacy .doc is binary; if decoding looks like garbage, tell the user instead of parsing mush
    const probe = text.slice(0, 400)
    if (probe.includes('\u0000') || probe.includes('\uFFFD')) text = ''
    return { text, method: text ? 'legacy .doc' : 'legacy .doc (binary — please save as PDF or DOCX)' }
  }
  // fall back to best-effort plain text
  return { text: await file.text(), method: 'file' }
}

async function readPdf(file: File): Promise<ReadResult> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    pages.push(tc.items.map((it) => ('str' in it ? (it as { str: string }).str : '')).join(' '))
  }
  const text = pages.join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  if (!text.trim()) return { text: '', method: 'PDF (scanned image — no text layer. Use a text-based PDF or paste it below.)' }
  return { text, method: `PDF · ${doc.numPages} pages` }
}

async function readDocx(file: File): Promise<ReadResult> {
  // .docx = a zip; fflate (~10 kB) inflates it and we pull the text out of document.xml
  const { unzipSync } = await import('fflate')
  const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const entry = unzipped['word/document.xml'] ?? unzipped['/word/document.xml']
  if (!entry) return { text: '', method: 'DOCX (no document.xml — unsupported variant)' }
  const xml = new TextDecoder('utf-8').decode(entry)
  const body = xml.replace(/^[\s\S]*?<w:body>/, '')
  const paragraphs = body
    .split(/<w:p[ >/]/) // paragraph starts
    .map((p) => {
      const texts = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1])
      const tabs = texts.join('').length ? p.replace(/<w:tab[^>]*\/>/g, '\t') : p
      return tabs
        .split('\t')
        .map((t) => [...t.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''))
        .join('\t')
    })
    .map((s) => decodeXmlEntities(s))
    .filter((s) => s.trim())
  return { text: paragraphs.join('\n'), method: 'DOCX' }
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
function decodeXmlEntities(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos|#(?:x([0-9a-fA-F]+)|(\d+)));/g, (_, name: string, hex: string, dec: string) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16))
    if (dec) return String.fromCodePoint(parseInt(dec, 10))
    return ENTITIES[name] ?? name
  })
}

async function readRtf(file: File): Promise<ReadResult> {
  const raw = await file.text()
  const text: string = raw
    .replace(/\\'([0-9a-fA-F]{2})/g, ' ')
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
  return { text, method: 'RTF (basic extraction)' }
}

/* ---------------------------------------------------------
   No-AI fallback: regex-based contact/structure extraction
   --------------------------------------------------------- */

import type { SkillLevel } from './types'

export interface ResumeExtract {
  full_name: string
  email: string
  phone: string
  location: string
  links: { linkedin: string; github: string; portfolio: string }
  summary: string
  skills: { name: string; level: SkillLevel; category: string }[]
  experience: { company: string; title: string; start: string; end: string; bullets: string[]; technologies: string[] }[]
  education: { degree: string; institution: string; start: string; end: string; details: string }[]
  certifications: { name: string; issuer: string; date: string }[]
  projects: { name: string; description: string; technologies: string[]; link: string }[]
  languages: string[]
}

const emptyExtract = (): ResumeExtract => ({
  full_name: '', email: '', phone: '', location: '',
  links: { linkedin: '', github: '', portfolio: '' },
  summary: '', skills: [], experience: [], education: [], certifications: [], projects: [], languages: [],
})

export function heuristicExtract(text: string): ResumeExtract {
  const out = emptyExtract()
  if (!text.trim()) return out

  const has = (re: RegExp) => text.match(re)?.[0]?.trim() ?? ''

  // contacts ------------------------------------------------
  out.email = has(/[\w+.-]+@[\w-]+\.[\w.-]{2,20}/)
  let phone = has(/(?:\+\d{1,3}[\s./-]?)?(?:\(?\d{2,4}\)?[\s./-]?){2,4}\d{2,4}/)
  // reject matches that are clearly years like "2019-2023"
  if ((phone.match(/\d/g) ?? []).length < 7) phone = ''
  out.phone = phone

  const linkedin = has(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[\w-]+(?:\/[\w.-]+)?/i)
  out.links.linkedin = linkedin.replace(/[),.;]+$/, '')
  const github = has(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)
  out.links.github = github.replace(/[),.;]+$/, '')

  // any https URL that isn't linkedin/github → portfolio
  for (const m of text.matchAll(/(?:https?:\/\/)(?:www\.)?([\w-]+\.[\w-]{2,20})(?:\/[\w./?=&%-]*)?/gi)) {
    const host = (m[1] ?? '').toLowerCase()
    if (host.includes('linkedin') || host.includes('github') || host.endsWith('.edu')) continue
    if (out.location && new RegExp(host.replace(/\./g, '\\.').slice(0, 12), 'i').test(out.location)) continue
    out.links.portfolio = `https://${m[1]}`
    break
  }
  // location: common "City, Country" appearing in the first 3 lines
  const head = text.trim().split('\n').slice(0, 4).join('\n')
  const loc = head.match(/([A-ZÄÖÜ][\wÄÖÜäöü.]+(?:[^,\n]{0,20})),\s*((?:North|South|East|West|Upper|Greater\s)?[A-ZÄÖÜ][\wÄÖÜäöü.-]+(?: [A-ZÄÖÜ][\wÄÖÜäöü.-]+)?)/)
  if (loc && !loc[1].includes('@') && !/linkedin|github/i.test(loc[1])) out.location = `${loc[1]}, ${loc[2]}`.slice(0, 60)

  // full name: first short line of capitalized words, not a contact line
  outer: for (const line of text.trim().split('\n').slice(0, 8)) {
    const l = line.trim().replace(/^[#•\-*/]+/, '').trim()
    if (!l || l.length > 46) continue
    if (/@|https?:|linkedin|github|resume|curriculum|vitae/i.test(l)) continue
    const words = l.split(/\s+/)
    if (words.length < 2 || words.length > 5) continue
    if (!words.every((w) => /^[A-ZÄÖÜ][\wÄÖÜäöü.'-]*$/.test(w) || /^[A-ZÄÖÜ]{2,3}$/.test(w))) continue
    out.full_name = l
    break outer
  }

  return out
}

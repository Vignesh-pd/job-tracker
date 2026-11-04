import Papa from 'papaparse'
import type { AppStatus, Application } from './types'
import { parseAnyDate, addDays, TODAY } from './utils'

/* ---------------- export ---------------- */

export function applicationsToCsv(apps: Application[]): string {
  const header = ['company', 'title', 'status', 'applied_on', 'source', 'match_score', 'follow_up_on', 'url', 'tags', 'notes']
  const rows = apps.map((a) =>
    [a.company, a.title, a.status, a.applied_on ?? '', a.source ?? '', a.match_score ?? '', a.follow_up_on ?? '', a.url ?? '', a.tags.join(';'), a.notes.replace(/\n+/g, ' ')],
  )
  return Papa.unparse([header, ...rows])
}

/* ---------------- import ---------------- */

const HEADER_MAP: Record<string, keyof CsvRow> = {
  company: 'company', employer: 'company', organisation: 'company', organization: 'company', 'company name': 'company',
  title: 'title', position: 'title', role: 'title', 'job title': 'title', vacancy: 'title',
  status: 'status', stage: 'status',
  'applied on': 'applied_on', 'application date': 'applied_on', date: 'applied_on', 'date applied': 'applied_on',
  source: 'source', channel: 'source', via: 'source',
  score: 'match_score', 'match score': 'match_score',
  'follow up': 'follow_up_on', 'follow-up': 'follow_up_on', 'follow up on': 'follow_up_on', followup: 'follow_up_on', reminder: 'follow_up_on',
  url: 'url', link: 'url', 'job url': 'url', posting: 'url',
  notes: 'notes', note: 'notes', comments: 'notes',
  tags: 'tags', label: 'tags',
}

export interface CsvRow {
  company: string
  title: string
  status: string
  applied_on: string
  source: string
  match_score: string
  follow_up_on: string
  url: string
  notes: string
  tags: string
}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ')

function normalizeStatus(v: string): AppStatus {
  const s = v.trim().toLowerCase()
  if (!s) return 'applied'
  if (['saved', 'bookmark', 'bookmarked', 'interested'].includes(s)) return 'saved'
  if (['applied', 'submitted'].includes(s)) return 'applied'
  if (['pending', 'awaiting reply', 'waiting', 'screening', 'hr screen'].includes(s)) return 'pending'
  if (['assessment', 'test', 'oa', 'online assessment', 'task', 'assignment', 'coding test'].includes(s)) return 'assessment'
  if (['interview', 'interviewing', 'onsite', 'technical interview', 'hr interview'].includes(s)) return 'interview'
  if (['offer', 'offer received', 'offered'].includes(s)) return 'offer'
  if (['rejected', 'rejection', 'declined', 'denied', 'not selected'].includes(s)) return 'rejected'
  if (['withdrawn', 'withdrew', 'cancelled', 'canceled'].includes(s)) return 'withdrawn'
  return 'applied'
}

export async function parseCsvFile(file: File): Promise<{ headers: string[]; rows: CsvRow[] }> {
  const text = await file.text()
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normHeader,
  })
  const headers = (parsed.meta.fields ?? []).map((h) => h.trim())
  const rows: CsvRow[] = []
  for (const raw of parsed.data) {
    const row: CsvRow = { company: '', title: '', status: '', applied_on: '', source: '', match_score: '', follow_up_on: '', url: '', notes: '', tags: '' }
    let companyFallback = ''
    for (const [h, v] of Object.entries(raw)) {
      const key = HEADER_MAP[normHeader(h)]
      if (key) row[key] = String(v ?? '')
      else if (!companyFallback && v) companyFallback = String(v)
    }
    // skip completely empty rows
    if (!Object.values(row).some((v) => v && String(v).trim()) && !companyFallback) continue
    if (!row.company) row.company = companyFallback.split(',')[0] ?? ''
    rows.push(row)
  }
  return { headers, rows }
}

/** map validated rows -> application objects (client-side, no AI) */
export function rowsToApplications(rows: CsvRow[]): { application: Omit<Application, 'id'>; row: CsvRow }[] {
  return rows.map((row) => {
    const applied = parseAnyDate(row.applied_on)
    return {
      row,
      application: {
        company: row.company.trim() || 'Unknown company',
        title: row.title.trim() || 'Untitled role',
        status: normalizeStatus(row.status || 'applied'),
        applied_on: applied ?? TODAY(),
        source: row.source.trim(),
        match_score: row.match_score ? Number(row.match_score) || undefined : undefined,
        follow_up_on: parseAnyDate(row.follow_up_on) ?? (applied ? addDays(applied, 7) : undefined),
        url: row.url.trim(),
        notes: row.notes.trim(),
        tags: row.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    }
  })
}

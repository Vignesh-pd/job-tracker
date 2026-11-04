import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Collision-proof-enough id for local rows (experience entries, provider cards, …) */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const TODAY = () => new Date().toISOString().slice(0, 10)

export function fmtDate(d?: string | number | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'number' ? new Date(d) : new Date(d + (String(d).length === 10 ? 'T00:00:00' : ''))
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000)
}

export function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

/** Accepts ISO, dd/mm/yyyy, dd-mm-yyyy, yyyy/mm/dd and returns ISO or null */
export function parseAnyDate(v?: string | null): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (dmy) {
    let [, a, b, y] = dmy
    let day = parseInt(a, 10), month = parseInt(b, 10)
    if (day > 12 && month <= 12) [day, month] = [month, day]
    let yy = parseInt(y, 10)
    if (yy < 100) yy += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${yy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return fmtDate(ts)
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Night owl mode on'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function greetingName(name: string): string {
  return name ? `${greeting()}, ${name.split(' ')[0]}` : greeting()
}

export function statusColor(s: string): string {
  switch (s) {
    case 'saved': return 'bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-300'
    case 'applied': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
    case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
    case 'assessment': return 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
    case 'interview': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
    case 'offer': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
    case 'rejected': return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
    case 'withdrawn': return 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
    default: return 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
  }
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
  return Promise.resolve()
}

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

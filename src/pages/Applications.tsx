import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppStatus } from '../lib/types'
import { STATUSES, STATUS_LABEL } from '../lib/types'
import { useStore } from '../store'
import { Badge, Button, Card, EmptyState, Input, Modal, StatusBadge, Select } from '../components/ui'
import { ApplicationDetail } from '../components/ApplicationDetail'
import { ManualAddModal } from '../components/ManualAdd'
import { fmtDate, cn, downloadBlob } from '../lib/utils'
import { applicationsToCsv, rowsToApplications } from '../lib/csv'
import type { CsvRow } from '../lib/csv'
import { navigate } from '../lib/router'
import { ClipboardList, Download, Filter, KanbanSquare, LayoutList, Plus, Search, Upload, Wand2 } from 'lucide-react'

type SortKey = 'recent' | 'applied' | 'company' | 'match'
type View = 'table' | 'kanban'

export function ApplicationsPage() {
  const store = useStore()
  const { apps, toast, updateApplication, importCsvFile, commitCsvImport, hasAi } = store
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<View>('table')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    let list = apps
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter)
    const needle = q.trim().toLowerCase()
    if (needle) {
      list = list.filter((a) =>
        `${a.company} ${a.title} ${a.source ?? ''} ${a.tags.join(' ')} ${a.notes}`.toLowerCase().includes(needle),
      )
    }
    const sorted = [...list]
    switch (sort) {
      case 'applied':
        sorted.sort((x, y) => (y.applied_on ?? '').localeCompare(x.applied_on ?? ''))
        break
      case 'company':
        sorted.sort((x, y) => x.company.localeCompare(y.company))
        break
      case 'match':
        sorted.sort((x, y) => (y.match_score ?? -1) - (x.match_score ?? -1))
        break
      default:
        sorted.sort((x, y) => (y.updated_at ?? 0) - (x.updated_at ?? 0))
    }
    return sorted
  }, [apps, statusFilter, q, sort])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length }
    for (const s of STATUSES) c[s] = apps.filter((a) => a.status === s).length
    return c
  }, [apps])

  const onCsvFile = async (file: File) => {
    try {
      const { preview } = await importCsvFile(file)
      if (!preview.rows.length) {
        toast('info', 'Nothing to import', 'No data rows detected in the file.')
        return
      }
      if (!preview.headers.some((h) => ['company', 'title', 'position', 'role', 'employer'].includes(h.trim().toLowerCase()))) {
        toast('error', 'Missing required columns', 'The CSV needs at least a company or role column (any of: company, employer, position, role, title).')
        return
      }
      setCsvPreview({ headers: preview.headers, rows: preview.rows.slice(0, 200) })
    } catch (e) {
      toast('error', 'CSV parse failed', (e as Error).message)
    }
  }

  const commitImport = async () => {
    if (!csvPreview) return
    const n = await commitCsvImport(csvPreview.rows)
    setCsvPreview(null)
    toast('success', `${n} application${n === 1 ? '' : 's'} imported`, 'Dates, statuses and sources were mapped automatically.')
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">Applications</h1>
          <p className="text-xs text-ink-400 mt-0.5">
            {apps.length} tracked · {apps.filter((a) => ['applied', 'pending', 'assessment', 'interview'].includes(a.status)).length} in flight
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onCsvFile(f)
              e.currentTarget.value = ''
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Import CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!apps.length) return void toast('info', 'Nothing to export yet')
              void applicationsToCsv(apps).then((csv) => downloadBlob(csv, 'jobpilot-applications.csv', 'text/csv'))
            }}
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => navigate('#/analyzer')}>
            <Wand2 className="size-3.5" /> New with AI
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Manual
          </Button>
        </div>
      </div>

      {!hasAi && apps.length === 0 && (
        <Card className="border-brand-200/70 bg-brand-50/50 dark:border-brand-500/20 dark:bg-brand-500/5 p-4 text-xs text-brand-800 dark:text-brand-200">
          Tip — paste a job description in <b>New with AI</b> to get fields + match analysis automatically, or add keys under Settings → AI Providers (free tiers: Google AI Studio, Groq, OpenRouter).
        </Card>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, role, tag…" className="w-56 pl-8.5 h-8.5 text-xs rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="size-3.5 text-ink-300" />
          <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            All <span className="opacity-60">{counts.all}</span>
          </Chip>
          {STATUSES.map((s) =>
            counts[s] ? (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {STATUS_LABEL[s]} <span className="opacity-60">{counts[s]}</span>
              </Chip>
            ) : null,
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-8.5 w-40 text-xs rounded-lg">
            <option value="recent">Sort: recent activity</option>
            <option value="applied">Sort: applied date</option>
            <option value="company">Sort: company A-Z</option>
            <option value="match">Sort: match score</option>
          </Select>
          <div className="flex overflow-hidden rounded-lg border border-ink-200 dark:border-ink-700">
            <button onClick={() => setView('table')} className={cn('p-2 transition-fast', view === 'table' ? 'bg-brand-500 text-white' : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-200')} aria-label="Table view">
              <LayoutList className="size-4" />
            </button>
            <button onClick={() => setView('kanban')} className={cn('p-2 transition-fast', view === 'kanban' ? 'bg-brand-500 text-white' : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-200')} aria-label="Kanban view">
              <KanbanSquare className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* content */}
      {!apps.length ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-7" />}
            title="No applications yet"
            body="Add one manually, import your spreadsheet as CSV, or paste a job description for AI extraction."
            action={
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate('#/analyzer')}>
                  <Wand2 className="size-3.5" /> New with AI
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                  <Plus className="size-3.5" /> Manual
                </Button>
              </div>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<Search className="size-6 text-ink-300" />} title="No matches" body="Try clearing the search or filters." />
        </Card>
      ) : view === 'table' ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800 text-[10.5px] uppercase tracking-wider text-ink-400">
                <th className="py-2.5 pl-4 pr-2 font-bold">Applied</th>
                <th className="px-2 py-2.5 font-bold">Company / Role</th>
                <th className="px-2 py-2.5 font-bold">Status</th>
                <th className="px-2 py-2.5 font-bold">Source</th>
                <th className="px-2 py-2.5 font-bold">Match</th>
                <th className="px-2 py-2.5 font-bold">Follow-up</th>
                <th className="px-2 py-2.5 font-bold">Docs</th>
                <th className="py-2.5 pl-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setDetailId(a.id!)}
                  className="cursor-pointer border-b border-ink-50 dark:border-ink-800/60 last:border-0 hover:bg-brand-50/40 dark:hover:bg-ink-800/40 transition-fast"
                >
                  <td className="py-2.5 pl-4 pr-2 text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">{a.applied_on ? fmtDate(a.applied_on) : '—'}</td>
                  <td className="px-2 py-2.5">
                    <p className="text-[13px] font-bold text-ink-800 dark:text-ink-100 truncate max-w-52">{a.company}</p>
                    <p className="text-[11px] text-ink-400 truncate max-w-52">{a.title}</p>
                  </td>
                  <td className="px-2 py-2.5"><StatusBadge status={a.status} size="sm" /></td>
                  <td className="px-2 py-2.5 text-xs text-ink-500 dark:text-ink-400">{a.source || '—'}</td>
                  <td className="px-2 py-2.5">
                    {a.match_score !== undefined && a.match_score !== null ? (
                      <Badge tone={a.match_score >= 75 ? 'green' : a.match_score >= 50 ? 'amber' : 'rose'}>{a.match_score}</Badge>
                    ) : (
                      <span className="text-ink-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">{a.follow_up_on ? fmtDate(a.follow_up_on) : '—'}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex gap-1">
                      {a.resume_doc_id ? <Badge tone="blue">R</Badge> : null}
                      {a.cover_letter_doc_id ? <Badge tone="violet">CL</Badge> : null}
                    </div>
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-right">
                    <span className="text-[10.5px] font-semibold text-brand-600 dark:text-brand-400">open →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3 items-start">
            {STATUSES.map((s) => {
              const col = filtered.filter((a) => a.status === s)
              return (
                <div
                  key={s}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragging) {
                      void updateApplication(dragging, { status: s })
                      toast('success', 'Status updated', `${STATUS_LABEL[s]} history entry added.`)
                    }
                    setDragging(null)
                  }}
                  className={cn('w-64 shrink-0 rounded-2xl border border-ink-200/70 dark:border-ink-800 bg-ink-50/60 dark:bg-ink-900/40 p-2.5 transition-fast', dragging !== null && 'ring-2 ring-brand-300/50')}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <StatusBadge status={s} size="sm" />
                    <span className="text-[11px] font-bold text-ink-400">{col.length}</span>
                  </div>
                  <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto pr-0.5">
                    {col.map((a) => (
                      <button
                        key={a.id}
                        draggable
                        onDragStart={() => setDragging(a.id!)}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => setDetailId(a.id!)}
                        className={cn(
                          'cursor-grab rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 text-left shadow-sm transition-fast hover:border-brand-300 active:cursor-grabbing',
                          dragging === a.id && 'opacity-40',
                        )}
                      >
                        <p className="truncate text-xs font-bold text-ink-800 dark:text-ink-100">{a.company}</p>
                        <p className="mt-0.5 truncate text-[11px] text-ink-400">{a.title}</p>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className="text-[10px] text-ink-400">{a.applied_on ? fmtDate(a.applied_on) : 'not yet'}</span>
                          {a.match_score !== undefined && a.match_score !== null ? (
                            <span className={cn('text-[10px] font-bold', a.match_score >= 75 ? 'text-emerald-500' : a.match_score >= 50 ? 'text-amber-500' : 'text-rose-500')}>{a.match_score}</span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                    {!col.length && <p className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 p-3 text-center text-[10.5px] text-ink-300">Drop cards here</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {detailId && <ApplicationDetail appId={detailId} onClose={() => setDetailId(null)} />}
      <ManualAddModal open={addOpen} onClose={() => setAddOpen(false)} />
      <CsvPreviewModal preview={csvPreview} onClose={() => setCsvPreview(null)} onCommit={commitImport} />
    </div>
  )
}

/* ---------------- small pieces ---------------- */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-[11px] font-semibold transition-fast border',
        active
          ? 'bg-ink-800 text-white border-ink-800 dark:bg-white dark:text-ink-900 dark:border-white'
          : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-700 text-ink-500 hover:border-ink-400 dark:text-ink-300',
      )}
    >
      {children}
    </button>
  )
}

function CsvPreviewModal({ preview, onClose, onCommit }: { preview: { headers: string[]; rows: CsvRow[] } | null; onClose: () => void; onCommit: () => void }) {
  const mapped = useMemo(() => (preview ? rowsToApplications(preview.rows) : []), [preview])
  return (
    <Modal open={!!preview} onClose={onClose} title="Import preview — map columns" wide>
      <p className="mb-3 text-xs text-ink-500 dark:text-ink-300">
        {preview?.rows.length ?? 0} rows detected. Headers are matched automatically (company, title/position, status, date applied, source, notes…). Review the first rows below:
      </p>
      <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-ink-50 dark:bg-ink-800/60 text-[10px] uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-3 py-2 font-bold">Company</th>
              <th className="px-3 py-2 font-bold">Role</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">Applied</th>
              <th className="px-3 py-2 font-bold">Source</th>
              <th className="px-3 py-2 font-bold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {mapped.slice(0, 8).map(({ application: a }, i) => (
              <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                <td className="px-3 py-1.5 font-semibold text-ink-700 dark:text-ink-100">{a.company}</td>
                <td className="px-3 py-1.5 text-ink-600 dark:text-ink-300">{a.title}</td>
                <td className="px-3 py-1.5"><StatusBadge status={a.status} size="sm" /></td>
                <td className="px-3 py-1.5 text-ink-500">{a.applied_on}</td>
                <td className="px-3 py-1.5 text-ink-500">{a.source || '—'}</td>
                <td className="px-3 py-1.5 max-w-40 truncate text-ink-500">{a.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-400">Importing adds new rows; existing data is untouched.</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onCommit}>Import {preview?.rows.length ?? 0} rows</Button>
        </div>
      </div>
    </Modal>
  )
}

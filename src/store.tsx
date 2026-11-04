import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db, ensureDefaults, DEFAULT_SETTINGS, newRouting } from './lib/db'
import type { AppDoc, AppStatus, Application, Job, KVSettings, Profile, ProviderRow, StatusHistory, TaskKind, TaskRoute, DocType } from './lib/types'
import { uid, TODAY, downloadBlob } from './lib/utils'
import { parseCsvFile, rowsToApplications, applicationsToCsv, type CsvRow } from './lib/csv'
import { exportBackup, importBackup, clearAllData as wipeData } from './lib/backup'

/* ---------------- toasts ---------------- */

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  title: string
  message?: string
}

/* ---------------- enriched application ---------------- */

export type AppRow = Application & { job?: Job }

/* ---------------- context ---------------- */

interface Store {
  ready: boolean
  profile: Profile
  apps: AppRow[]
  jobs: Job[]
  history: StatusHistory[]
  documents: AppDoc[]
  providers: ProviderRow[]
  routing: Record<TaskKind, TaskRoute>
  settings: KVSettings
  toasts: Toast[]
  hasAi: boolean

  toast: (kind: Toast['kind'], title: string, message?: string) => void
  dismissToast: (id: string) => void

  saveProfile: (p: Profile) => Promise<void>
  addApplicationFromJob: (job: Job, app: Partial<Application>, report?: Application['match_report']) => Promise<number>
  addManualApplication: (input: Partial<Application>) => Promise<number>
  updateApplication: (id: number, patch: Partial<Application>) => Promise<void>
  deleteApplication: (id: number) => Promise<void>
  addDocument: (input: Omit<AppDoc, 'id' | 'version' | 'created_at'>, link?: boolean) => Promise<number>
  deleteDocument: (id: number) => Promise<void>

  saveProvider: (row: ProviderRow, isNew?: boolean) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  setDefaultProvider: (id: string | null) => Promise<void>
  saveTaskRoute: (task: TaskKind, route: TaskRoute) => Promise<void>
  setTheme: (t: KVSettings['theme']) => Promise<void>

  importCsvFile: (file: File) => Promise<{ inserted: number; preview: { headers: string[]; rows: CsvRow[] } }>
  commitCsvImport: (rows: CsvRow[]) => Promise<number>
  exportCsv: () => void
  exportBackup: () => Promise<void>
  importBackupFile: (file: File, mode: 'merge' | 'replace') => Promise<{ apps: number; jobs: number; docs: number }>
  clearAll: () => Promise<void>
  installDemo: () => Promise<void>

  resolveTask: (task: TaskKind, override?: { provider_id?: string | null; model?: string | null }) => ProviderRow | undefined
  providerById: (id?: string | null) => ProviderRow | undefined
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

/* ---------------- provider ---------------- */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [appsRaw, setAppsRaw] = useState<Application[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [documents, setDocuments] = useState<AppDoc[]>([])
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [routing, setRoutingState] = useState(newRouting())
  const [settings, setSettings] = useState<KVSettings>(DEFAULT_SETTINGS)
  const [toasts, setToasts] = useState<Toast[]>([])

  /* ---- initial load ---- */
  useEffect(() => {
    let alive = true
    ;(async () => {
      await ensureDefaults()
      const [p, a, j, h, d, pr, rt, kv] = await Promise.all([
        db.profile.get('me'),
        db.applications.orderBy('applied_on').reverse().toArray(),
        db.jobs.toArray(),
        db.history.orderBy('changed_at').reverse().toArray(),
        db.documents.toArray(),
        db.providers.toArray(),
        db.routing.toArray(),
        db.kv.get('settings'),
      ])
      if (!alive) return
      setProfile(p ?? null)
      setAppsRaw(a)
      setJobs(j)
      setHistory(h)
      setDocuments(d)
      setProviders(pr.length ? pr : [])
      const r = { ...newRouting() }
      for (const row of rt) {
        if (row.task in r) {
          r[row.task] = { provider_id: row.provider_id, model: row.model }
        }
      }
      setRoutingState(r)
      const s = (kv?.value as KVSettings) ?? DEFAULT_SETTINGS
      setSettings(s)
      document.documentElement.classList.toggle('dark', s.theme === 'dark')
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  /* ---- toasts ---- */
  const toast = (kind: Toast['kind'], title: string, message?: string) => {
    const id = uid()
    setToasts((t) => [...t.slice(-4), { id, kind, title, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 9000 : 4500)
  }
  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id))

  /* ---- derived (memoised: stable identities so consumers' useMemo deps don't thrash) ---- */
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const apps: AppRow[] = useMemo(() => appsRaw.map((a) => ({ ...a, job: jobMap.get(a.job_id as number) })), [appsRaw, jobMap])

  /* ---- profile ---- */
  const saveProfile = async (p: Profile) => {
    p.updated_at = Date.now()
    setProfile(p)
    await db.profile.put(p)
  }

  /* ---- applications ---- */
  const refreshApps = async () => {
    const [a, h] = await Promise.all([
      db.applications.toArray().then((l) => l.sort((x, y) => (y.updated_at ?? 0) - (x.updated_at ?? 0))),
      db.history.orderBy('changed_at').reverse().toArray(),
    ])
    setAppsRaw(a)
    setHistory(h)
  }

  const addApplicationFromJob = async (job: Job, appInput: Partial<Application>, report?: Application['match_report']) => {
    // upsert job if it already has an id
    let jobId = job.id
    if (jobId) await db.jobs.put(job)
    else {
      const { id: _omit, ...rest } = job
      void _omit
      jobId = await db.jobs.add(rest as Job)
      job.id = jobId
    }
    const now = Date.now()
    const application: Application = {
      job_id: jobId,
      company: appInput.company ?? job.company,
      title: appInput.title ?? job.title,
      url: job.url,
      applied_on: appInput.applied_on ?? (appInput.status === 'saved' ? undefined : TODAY()),
      source: appInput.source ?? '',
      status: appInput.status ?? 'saved',
      match_score: appInput.match_score ?? report?.score,
      match_report: report,
      notes: appInput.notes ?? '',
      tags: appInput.tags ?? [],
      follow_up_on: appInput.follow_up_on,
      created_at: now,
      updated_at: now,
    }
    const id = await db.applications.add(application)
    await db.history.bulkAdd([
      { application_id: id, to_status: 'saved' as AppStatus, changed_at: now },
      ...((application.status !== 'saved')
        ? [{ application_id: id, from_status: 'saved' as AppStatus, to_status: application.status as AppStatus, changed_at: now }]
        : []),
    ])
    await refreshJobs()
    await refreshApps()
    return id
  }

  const addManualApplication = async (input: Partial<Application>) => {
    const now = Date.now()
    const application: Application = {
      company: input.company ?? '',
      title: input.title ?? '',
      status: input.status ?? 'applied',
      applied_on: input.status === 'saved' ? input.applied_on : input.applied_on ?? TODAY(),
      source: input.source ?? '',
      notes: input.notes ?? '',
      tags: input.tags ?? [],
      match_score: input.match_score,
      follow_up_on: input.follow_up_on,
      created_at: now,
      updated_at: now,
    }
    const id = await db.applications.add(application)
    await db.history.bulkAdd([
      { application_id: id, to_status: application.status as AppStatus, changed_at: now },
    ])
    await refreshApps()
    return id
  }

  const updateApplication = async (id: number, patch: Partial<Application>) => {
    const cur = await db.applications.get(id)
    if (!cur) return
    const next: Application = { ...cur, ...patch, updated_at: Date.now() }
    await db.applications.put(next)
    if (patch.status && patch.status !== cur.status) {
      await db.history.add({ application_id: id, from_status: cur.status, to_status: patch.status, changed_at: next.updated_at })
    }
    await refreshApps()
  }

  const deleteApplication = async (id: number) => {
    await db.transaction('rw', db.applications, db.documents, db.history, db.jobs, async () => {
      await db.documents.where('application_id').equals(id).delete()
      await db.history.where('application_id').equals(id).delete()
      const app = await db.applications.get(id)
      await db.applications.delete(id)
      if (app?.job_id) await db.jobs.delete(app.job_id)
    })
    await refreshApps()
    await refreshJobs()
    await refreshDocs()
  }

  /* ---- documents ---- */
  const refreshDocs = async () => setDocuments(await db.documents.toArray())
  const refreshJobs = async () => setJobs(await db.jobs.toArray())

  const addDocument = async (input: Omit<AppDoc, 'id' | 'version' | 'created_at'>, link?: boolean) => {
    const siblings = await db.documents.where('application_id').equals(input.application_id).toArray()
    const maxVersion = siblings.filter((d) => d.type === input.type).reduce((m, d) => Math.max(m, d.version), 0)
    const doc: AppDoc = { ...input, version: maxVersion + 1, created_at: Date.now() }
    const id = await db.documents.add(doc)
    if (link) {
      const field: Partial<Record<DocType, keyof Application>> = { resume: 'resume_doc_id', cover_letter: 'cover_letter_doc_id' }
      if (field[input.type]) await updateApplication(input.application_id, { [field[input.type]!]: id } as Partial<Application>)
    }
    await refreshDocs()
    return id
  }

  const deleteDocument = async (id: number) => {
    await db.documents.delete(id)
    await refreshDocs()
  }

  /* ---- providers & routing ---- */
  const saveProvider = async (row: ProviderRow, isNew?: boolean) => {
    const finalRow = isNew ? { ...row, id: uid() } : row
    await db.providers.put(finalRow)
    setProviders(await db.providers.toArray())
  }

  const deleteProvider = async (id: string) => {
    await db.providers.delete(id)
    // clean references
    const rows = await db.routing.toArray()
    for (const r of rows) {
      if (r.provider_id === id) await db.routing.put({ ...r, provider_id: null })
    }
    const s = await db.kv.get('settings')
    const val = (s?.value as KVSettings) ?? DEFAULT_SETTINGS
    if (val.default_provider === id) await db.kv.put({ key: 'settings', value: { ...val, default_provider: null } })
    setProviders(await db.providers.toArray())
    setRoutingState(await reloadRouting())
    const kv = (await db.kv.get('settings'))?.value as KVSettings
    setSettings({ ...kv })
  }

  const setDefaultProvider = async (id: string | null) => {
    const next = { ...settings, default_provider: id }
    setSettings(next)
    await db.kv.put({ key: 'settings', value: next })
  }

  const saveTaskRoute = async (task: TaskKind, route: TaskRoute) => {
    await db.routing.put({ task, ...route })
    setRoutingState((r) => ({ ...r, [task]: route }))
  }

  const setTheme = async (t: KVSettings['theme']) => {
    const next = { ...settings, theme: t }
    setSettings(next)
    document.documentElement.classList.toggle('dark', t === 'dark')
    await db.kv.put({ key: 'settings', value: next })
  }

  /* ---- csv / backup / demo ---- */
  const importCsvFile = async (file: File) => {
    const parsed = await parseCsvFile(file)
    return { inserted: parsed.rows.length, preview: parsed }
  }
  const commitCsvImport = async (rows: CsvRow[]) => {
    const parsed = rowsToApplications(rows)
    // one bulk write instead of a round-trip per row
    await db.transaction('rw', db.applications, db.history, async () => {
      const ids = await db.applications.bulkAdd(parsed.map((p) => p.application as Application), { allKeys: true })
      const now = Date.now()
      await db.history.bulkAdd(
        ids.map((id, i) => ({ application_id: id as number, to_status: parsed[i].application.status as AppStatus, changed_at: now + i })),
      )
    })
    await refreshApps()
    return parsed.length
  }
  const exportCsv = async () => {
    downloadBlob(await applicationsToCsv(apps), `applications-${TODAY()}.csv`, 'text/csv')
  }
  const exportBackupFile = async () => {
    await exportBackup()
  }
  const importBackupFile = async (file: File, mode: 'merge' | 'replace') => {
    const text = await file.text()
    const res = await importBackup(text, mode)
    await reloadEverything()
    return res
  }
  const clearAll = async () => {
    await wipeData()
    await reloadEverything()
  }
  const installDemo = async () => {
    const { loadDemoData } = await import('./lib/seed')
    await loadDemoData()
    await reloadEverything()
  }

  /* ---- task resolution ---- */
  const providerById = (id?: string | null) => (id ? providers.find((p) => p.id === id) : undefined)

  const resolveTask = (task: TaskKind, override?: { provider_id?: string | null; model?: string | null }) => {
    const route = routing[task]
    const pid = override?.provider_id ?? route?.provider_id ?? settings.default_provider ?? providers.find((p) => p.enabled && (p.api_key || p.kind === 'ollama'))?.id
    const row = providerById(pid) ?? providers.find((p) => p.enabled && (p.api_key || p.kind === 'ollama'))
    if (!row) return undefined
    const model = override?.model ?? route?.model ?? row.model
    return { ...row, model }
  }

  const hasAi = providers.some((p) => p.enabled && (p.api_key || p.kind === 'ollama'))

  /* ---- reload helper ---- */
  async function reloadEverything() {
    const [a, j, h, d, pr, rt, kv, p] = await Promise.all([
      db.applications.orderBy('updated_at').reverse().toArray(),
      db.jobs.toArray(),
      db.history.orderBy('changed_at').reverse().toArray(),
      db.documents.toArray(),
      db.providers.toArray(),
      db.routing.toArray(),
      db.kv.get('settings'),
      db.profile.get('me'),
    ])
    setAppsRaw(a)
    setJobs(j)
    setHistory(h)
    setDocuments(d)
    setProviders(pr)
    const r = { ...newRouting() }
    for (const row of rt) if (row.task in r) r[row.task] = { provider_id: row.provider_id, model: row.model }
    setRoutingState(r)
    setSettings((kv?.value as KVSettings) ?? DEFAULT_SETTINGS)
    setProfile(p ?? null)
  }

  async function reloadRouting() {
    return await db.routing.toArray().then((rows) => {
      const r = { ...newRouting() }
      for (const row of rows) if (row.task in r) r[row.task] = { provider_id: row.provider_id, model: row.model }
      return r
    })
  }

  if (!ready || !profile) {
    return <Splash />
  }

  const value: Store = {
    ready, profile: profile!, apps, jobs, history, documents, providers, routing, settings, toasts, hasAi,
    toast, dismissToast,
    saveProfile, addApplicationFromJob, addManualApplication, updateApplication, deleteApplication,
    addDocument, deleteDocument,
    saveProvider, deleteProvider, setDefaultProvider, saveTaskRoute, setTheme,
    importCsvFile, commitCsvImport, exportCsv, exportBackup: exportBackupFile, importBackupFile, clearAll, installDemo,
    resolveTask, providerById,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------------- splash ---------------- */

function Splash() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 app-bg">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 animate-pulse" />
      <p className="text-sm text-ink-500 font-medium">Starting JobPilot…</p>
    </div>
  )
}

export type { Store }

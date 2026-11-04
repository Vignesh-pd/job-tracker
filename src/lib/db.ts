import Dexie, { type Table } from 'dexie'
import type { Application, AppDoc, Job, KVSettings, Profile, ProviderRow, StatusHistory, TaskKind, TaskRoute } from './types'
import { uid } from './utils'

export const DB_NAME = 'jobpilot'

class JobPilotDB extends Dexie {
  jobs!: Table<Job, number>
  applications!: Table<Application, number>
  history!: Table<StatusHistory, number>
  documents!: Table<AppDoc, number>
  profile!: Table<Profile, string>
  providers!: Table<ProviderRow, string>
  routing!: Table<{ task: TaskKind } & TaskRoute, string>
  kv!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super(DB_NAME)
    this.version(1).stores({
      jobs: '++id, company, title',
      applications: '++id, job_id, company, status, applied_on, follow_up_on',
      history: '++id, application_id, changed_at',
      documents: '++id, application_id, type',
      profile: 'id',
      providers: 'id',
      routing: 'task',
      kv: 'key',
    })
  }
}

export const db = new JobPilotDB()

/* --------- default rows created on first run --------- */

const GEMINI_MODELS = [
  'models/gemini-2.5-flash',
  'models/gemini-2.0-flash',
  'models/gemini-2.5-flash-lite',
  'models/gemini-2.5-pro',
]

export const DEFAULT_PROVIDERS: ProviderRow[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'gemini',
    base_url: 'https://generativelanguage.googleapis.com/v1beta',
    model: GEMINI_MODELS[0],
    api_key: '',
    enabled: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'anthropic',
    base_url: 'https://api.anthropic.com',
    model: 'claude-haiku-4-5',
    api_key: '',
    enabled: false,
  },
]

export const DEFAULT_SETTINGS: KVSettings = { default_provider: null, theme: 'light' }

export function newProfile(): Profile {
  return {
    id: 'me',
    full_name: '',
    email: '',
    phone: '',
    location: '',
    links: { linkedin: '', github: '', portfolio: '' },
    summary: '',
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
    skills: [],
    master_resume: '',
    updated_at: 0,
  }
}

export function newRouting(): Record<TaskKind, TaskRoute> {
  const keys: TaskKind[] = ['extraction', 'matching', 'resume', 'cover_letter', 'answers', 'insights']
  const out = {} as Record<TaskKind, TaskRoute>
  for (const k of keys) out[k] = { provider_id: null, model: null }
  return out
}

/** first-run bootstrap: seeds provider rows + profile + settings, keeps existing data */
export async function ensureDefaults() {
  const prov = await db.providers.toArray()
  if (!prov.length) await db.providers.bulkPut(DEFAULT_PROVIDERS)
  if (!(await db.profile.get('me'))) await db.profile.put(newProfile())
  if (!(await db.kv.get('settings'))) await db.kv.put({ key: 'settings', value: DEFAULT_SETTINGS })
  const r = await db.routing.toArray()
  if (!r.length) {
    const seed = Object.entries(newRouting()).map(([task, route]) => ({ task: task as TaskKind, ...route }))
    await db.routing.bulkPut(seed)
  }
}

export const routingModel = (r: TaskRoute | undefined) => r?.model ?? null

export function blankExperience(): Profile['experience'][number] {
  return { id: uid(), company: '', title: '', start: '', end: '', bullets: [], technologies: [] }
}
export function blankEducation(): Profile['education'][number] {
  return { id: uid(), degree: '', institution: '', start: '', end: '', details: '' }
}
export function blankCert(): Profile['certifications'][number] {
  return { id: uid(), name: '', issuer: '', date: '' }
}
export function blankProject(): Profile['projects'][number] {
  return { id: uid(), name: '', description: '', technologies: [], link: '' }
}

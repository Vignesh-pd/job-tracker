import type { ZodType } from 'zod'

/* ---------------- Statuses ---------------- */

export const STATUSES = ['saved', 'applied', 'pending', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'] as const
export type AppStatus = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<AppStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  pending: 'Awaiting reply',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

/* ---------------- Profile ---------------- */

export interface Experience {
  id: string
  company: string
  title: string
  start: string
  end: string
  bullets: string[]
  technologies: string[]
}

export interface Education {
  id: string
  degree: string
  institution: string
  start: string
  end: string
  details: string
}

export interface Certification {
  id: string
  name: string
  issuer: string
  date: string
}

export interface Project {
  id: string
  name: string
  description: string
  technologies: string[]
  link: string
}

export interface Skill {
  name: string
  category: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string
  location: string
  links: { linkedin: string; github: string; portfolio: string }
  summary: string
  experience: Experience[]
  education: Education[]
  certifications: Certification[]
  projects: Project[]
  languages: string[]
  skills: Skill[]
  master_resume: string
  updated_at: number
}

/* ---------------- Jobs & applications ---------------- */

export interface Job {
  id?: number
  url?: string
  title: string
  company: string
  location?: string
  employment_type?: string
  raw_description: string
  required_skills: string[]
  preferred_skills: string[]
  keywords: string[]
  responsibilities: string[]
  education?: string
  experience_years?: string
  analyzed_by?: string
  created_at: number
}

export interface MatchReport {
  score: number
  strong_matches: string[]
  missing_skills: string[]
  experience_alignment: string
  education_alignment: string
  summary?: string
  generated_by?: string
}

export interface Application {
  id?: number
  job_id?: number
  company: string
  title: string
  url?: string
  applied_on?: string
  source?: string
  status: AppStatus
  match_score?: number
  match_report?: MatchReport
  resume_doc_id?: number
  cover_letter_doc_id?: number
  follow_up_on?: string
  notes: string
  tags: string[]
  created_at: number
  updated_at: number
}

export interface StatusHistory {
  id?: number
  application_id: number
  from_status?: AppStatus
  to_status: AppStatus
  changed_at: number
}

export type DocType = 'resume' | 'cover_letter' | 'answers'

export interface AppDoc {
  id?: number
  application_id: number
  job_id?: number
  type: DocType
  version: number
  title: string
  content: string
  provider: string
  model: string
  created_at: number
}

/* ---------------- AI providers ---------------- */

/** task routing keys */
export const TASKS = ['extraction', 'matching', 'resume', 'cover_letter', 'answers', 'insights'] as const
export type TaskKind = (typeof TASKS)[number]

export const TASK_LABEL: Record<TaskKind, string> = {
  extraction: 'Job extraction',
  matching: 'Match explanation',
  resume: 'Resume tailoring',
  cover_letter: 'Cover letter',
  answers: 'Application answers',
  insights: 'Career insights',
}

export type ProviderKind = 'gemini' | 'openai_compatible' | 'anthropic' | 'ollama'

export const PROVIDER_KIND_LABEL: Record<ProviderKind, string> = {
  gemini: 'Google Gemini',
  openai_compatible: 'OpenAI-compatible',
  anthropic: 'Anthropic Claude',
  ollama: 'Ollama (local)',
}

/** presets when the user adds an OpenAI-compatible endpoint */
export const OPENAI_PRESETS: { id: string; name: string; base_url: string; models: string[] }[] = [
  { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'] },
  {
    id: 'openrouter',
    name: 'OpenRouter (free models)',
    base_url: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat'],
  },
  { id: 'groq', name: 'Groq', base_url: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'kimi', name: 'Kimi (Moonshot)', base_url: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'kimi-k2-0711-preview'] },
  { id: 'deepseek', name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'custom', name: 'Custom / other', base_url: '', models: [] },
]

export interface ProviderRow {
  id: string
  name: string
  kind: ProviderKind
  base_url: string
  model: string
  api_key: string
  enabled: boolean
}

export interface TaskRoute {
  provider_id: string | null // null = use default provider
  model: string | null // null = use provider's default model
}

export type RoutingMap = Record<TaskKind, TaskRoute>

export interface KVSettings {
  default_provider: string | null
  theme: 'light' | 'dark'
}

/* ---------------- AI chat primitives ---------------- */

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface LLMResult {
  text: string
  label: string // e.g. "Gemini 2.0 Flash"
  latency_ms: number
}

export interface AdapterOpts {
  json?: boolean
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface Adapter {
  call(cfg: ProviderRow, messages: ChatMessage[], opts: AdapterOpts): Promise<LLMResult>
}

/** anything thrown by the ai layer is this; message should be user readable */
export class AIError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

/** zod schemas live with their tasks */
export type SchemaOf<T> = ZodType<T>

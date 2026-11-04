import { useRef, useState } from 'react'
import type { ProviderRow, ProviderKind, TaskKind } from '../lib/types'
import { OPENAI_PRESETS, PROVIDER_KIND_LABEL, TASKS, TASK_LABEL } from '../lib/types'
import { useStore } from '../store'
import { Badge, Button, Card, Confirm, Field, Input, SectionHeader, Select, Switch } from '../components/ui'
import { testConnection } from '../lib/ai/client'
import { cn, uid } from '../lib/utils'
import { KeyRound, Plus, Trash2, Zap, ShieldAlert, DatabaseBackup, Wand2, CheckCircle2, XCircle, Eye, EyeOff, FileDown, RefreshCw } from 'lucide-react'

interface TestState {
  status: 'idle' | 'busy' | 'ok' | 'fail'
  latency?: number
  error?: string
}

export function SettingsPage() {
  const store = useStore()
  void store

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">Settings</h1>
        <p className="text-xs text-ink-400 mt-0.5">AI providers, task routing and your local data</p>
      </div>

      <ProvidersSection />
      <RoutingSection />
      <DataSection />
      <HelpSection />
    </div>
  )
}

/* ================= AI Providers ================= */

function ProvidersSection() {
  const { providers, settings, setDefaultProvider, saveProvider, deleteProvider } = useStore()
  const usable = providers.filter((p) => p.api_key || p.kind === 'ollama')

  return (
    <section>
      <SectionHeader
        title="AI providers"
        subtitle="Add your own API keys (free tiers available). Keys are stored in this browser only and never leave except to call the provider you chose."
        action={
          <div className="flex items-center gap-2">
            <Badge tone={usable.length ? 'green' : 'amber'}>
              {usable.length}/{providers.length} ready
            </Badge>
          </div>
        }
      />
      <Card className="p-4 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <Field label="Default provider (fallback for every task)" className="w-72">
            <Select value={settings.default_provider ?? ''} onChange={(e) => setDefaultProvider(e.target.value || null)}>
              <option value="">— none (first ready provider wins) —</option>
              {usable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="flex-1 min-w-56 text-[11px] text-ink-400 leading-relaxed">
            Default model override per task lives one section below. The chip on each AI screen lets you override the provider for a single run.
          </p>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {providers.map((p) => (
          <ProviderCard key={p.id} row={p} onSaved={(row) => saveProvider(row)} onDelete={() => deleteProvider(p.id)} />
        ))}
      </div>

      <AddProviderCard />
    </section>
  )
}

function ProviderCard({ row, onSaved, onDelete }: { row: ProviderRow; onSaved: (r: ProviderRow) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState<ProviderRow>(row)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [revealed, setRevealed] = useState(false)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(row)

  const masked = row.api_key ? `•••• ${row.api_key.slice(-4)}` : 'no key set'
  const kindInfo = KIND_HINTS[row.kind]

  const runTest = async () => {
    if (!draft.model) {
      setTest({ status: 'fail', error: 'Choose a model first.' })
      return
    }
    if (draft.kind !== 'ollama' && !draft.api_key) {
      setTest({ status: 'fail', error: 'Add your API key first.' })
      return
    }
    setTest({ status: 'busy' })
    const r = await testConnection(draft)
    setTest(r.ok ? { status: 'ok', latency: r.latency_ms } : { status: 'fail', error: r.error })
  }

  return (
    <Card className={cn('p-4 relative', row.enabled && 'border-brand-200/80 dark:border-brand-500/30')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-ink-800 dark:text-white">{row.name}</p>
          <p className="text-[11px] text-ink-400">
            {PROVIDER_KIND_LABEL[row.kind]}
            {row.model ? <> · <span className="font-mono">{row.model.replace(/^models\//, '')}</span></> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={row.enabled}
            onChange={(v) => onSaved({ ...row, enabled: v })}
            label={row.enabled ? 'Disable provider' : 'Enable provider'}
          />
          <Button variant="ghost" size="xs" className="text-ink-300 hover:text-rose-500" onClick={onDelete} aria-label="Remove provider">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Model" hint={kindInfo?.modelHint}>
          <Input
            list={`models-${row.id}`}
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            placeholder={kindInfo?.modelPlaceholder ?? 'model name'}
            className="font-mono text-xs"
          />
          <datalist id={`models-${row.id}`}>
            {(kindInfo?.suggestions ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        {(row.kind === 'openai_compatible' || row.kind === 'ollama') && (
          <Field label="Base URL" hint={kindInfo?.urlHint}>
            <Input value={draft.base_url} onChange={(e) => setDraft({ ...draft, base_url: e.target.value })} placeholder="https://api.openai.com/v1" className="font-mono text-xs" />
          </Field>
        )}
        {(row.kind === 'gemini' || row.kind === 'anthropic' || row.kind === 'openai_compatible') && (
          <Field label="API key" className="sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <Input
                type={revealed ? 'text' : 'password'}
                value={draft.api_key}
                onChange={(e) => setDraft({ ...draft, api_key: e.target.value.trim() })}
                placeholder={masked}
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <Button variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)} aria-label={revealed ? 'Hide key' : 'Show key'}>
                {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onSaved(draft)} className={cn(isDirty && 'ring-2 ring-brand-300/60')}>
                Save key
              </Button>
            </div>
          </Field>
        )}
        {row.kind === 'ollama' && (
          <p className="sm:col-span-2 text-[11px] text-ink-400 bg-ink-50 dark:bg-ink-800/50 rounded-xl p-2.5">
            Local models need no API key. Start Ollama with <code className="font-mono text-[10px]">OLLAMA_ORIGINS=*</code> so the browser may call it, then pull a model like <code className="font-mono text-[10px]">ollama pull llama3.1</code>.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="xs" variant="subtle" loading={test.status === 'busy'} onClick={runTest}>
          <Zap className="size-3" /> Test connection
        </Button>
        {test.status === 'ok' && (
          <Badge tone="green">
            <CheckCircle2 className="size-3" /> {test.latency} ms
          </Badge>
        )}
        {test.status === 'fail' && (
          <Badge tone="rose">
            <XCircle className="size-3" /> {test.error?.slice(0, 90)}
          </Badge>
        )}
        {isDirty && <span className="text-[10.5px] text-amber-600 dark:text-amber-400 font-semibold">unsaved changes — hit “Save key”</span>}
      </div>

      <p className="mt-2.5 text-[10.5px] leading-snug text-ink-400 flex gap-1.5">
        <ShieldAlert className="size-3.5 shrink-0 mt-px" />
        {kindInfo?.privacy} — your CV and job data are sent to this service when generating.
      </p>
    </Card>
  )
}

function AddProviderCard() {
  const { saveProvider } = useStore()
  const [presetId, setPresetId] = useState(OPENAI_PRESETS[1].id)
  const preset = OPENAI_PRESETS.find((p) => p.id === presetId)!
  return (
    <Card className="mt-3 p-4 border-dashed">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
          <Plus className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink-800 dark:text-white">Add an OpenAI-compatible endpoint</p>
          <p className="text-[11px] text-ink-400">OpenAI, OpenRouter, Groq, Kimi, DeepSeek or any custom gateway — all through one adapter.</p>
        </div>
        <Select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="w-52">
          {OPENAI_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Button
          size="sm"
          onClick={() =>
            saveProvider(
              {
                id: `create-${uid()}`,
                name: preset.name === 'Custom / other' ? 'Custom endpoint' : preset.name,
                kind: 'openai_compatible',
                base_url: preset.base_url,
                model: preset.models[0] ?? '',
                api_key: '',
                enabled: true,
              },
              true,
            )
          }
        >
          Add {preset.name === 'Custom / other' ? 'custom' : preset.name.split(' ')[0]}
        </Button>
      </div>
    </Card>
  )
}

/* ================= Task routing ================= */

function RoutingSection() {
  const { routing, providers, settings, saveTaskRoute, toast } = useStore()
  const usable = providers.filter((p) => p.enabled && (p.api_key || p.kind === 'ollama'))

  const preset = (kind: 'cheapest' | 'quality' | 'private') => {
    if (!usable.length) return
    if (kind === 'private') {
      const local = usable.find((p) => p.kind === 'ollama')
      if (!local) return toast('info', 'No local provider', 'Enable an Ollama provider first (or add one).')
      for (const t of TASKS) void saveTaskRoute(t, { provider_id: local.id, model: null })
      toast('success', 'Switched to local-only', 'Every task now runs on your Ollama machine.')
      return
    }
    toast('info', 'Presets are suggestions', 'Pick per-task below — “cheapest” is usually a Flash/Haiku-class model, “best quality” a Pro/Opus-class.')
  }

  return (
    <section>
      <SectionHeader
        title="Task routing"
        subtitle="Choose which provider and model handles each task (blank = provider's own default)"
        action={
          <div className="flex gap-1.5">
            <Button size="xs" variant="secondary" onClick={() => preset('cheapest')}>Cheapest</Button>
            <Button size="xs" variant="secondary" onClick={() => preset('quality')}>Best quality</Button>
            <Button size="xs" variant="secondary" onClick={() => preset('private')}>Local only</Button>
          </div>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 dark:border-ink-800 text-[10.5px] uppercase tracking-wider text-ink-400">
              <th className="py-2.5 pl-4 pr-2 font-bold">Task</th>
              <th className="px-2 py-2.5 font-bold">Provider</th>
              <th className="px-2 py-2.5 font-bold">Model override</th>
              <th className="px-2 py-2.5 pr-4 font-bold">Typical need</th>
            </tr>
          </thead>
          <tbody>
            {TASKS.map((t) => {
              const r = routing[t]
              return (
                <tr key={t} className="border-b border-ink-50 dark:border-ink-800/60 last:border-0">
                  <td className="py-2.5 pl-4 pr-2 font-semibold text-[12.5px] text-ink-700 dark:text-ink-100 whitespace-nowrap">{TASK_LABEL[t]}</td>
                  <td className="px-2 py-2">
                    <Select
                      className="h-8.5 w-48 text-xs rounded-lg"
                      value={r?.provider_id ?? ''}
                      onChange={(e) => saveTaskRoute(t, { provider_id: e.target.value || null, model: r?.model ?? null })}
                    >
                      <option value="">Default ({settings.default_provider ? providers.find((p) => p.id === settings.default_provider)?.name ?? 'unset' : 'auto'})</option>
                      {usable.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="h-8.5 w-40 rounded-lg font-mono text-xs"
                      list={`task-models-${t}`}
                      placeholder="provider default"
                      value={r?.model ?? ''}
                      onChange={(e) => saveTaskRoute(t, { provider_id: r?.provider_id ?? null, model: e.target.value || null })}
                    />
                    <datalist id={`task-models-${t}`}>
                      {[...new Set(providers.filter((p) => r?.provider_id ? p.id === r.provider_id : false).map((p) => p.model))].filter(Boolean).map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-2 py-2.5 pr-4 text-[11px] text-ink-400">{TASK_NEED[t]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </section>
  )
}

/* ================= Data ================= */

function DataSection() {
  const store = useStore()
  const { toast, exportBackup, importBackupFile, clearAll, installDemo, exportCsv, apps, jobs, documents } = store
  const [confirmClear, setConfirmClear] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')

  return (
    <section>
      <SectionHeader title="Your data" subtitle="Everything lives in this browser (IndexedDB). There is no server — so backups are your responsibility." />
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <StatChip label="applications" value={apps.length} />
            <StatChip label="jobs analyzed" value={jobs.length} />
            <StatChip label="documents" value={documents.length} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportBackup().then(() => toast('success', 'Backup downloaded'))}>
              <DatabaseBackup className="size-3.5" /> Export backup (JSON)
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <FileDown className="size-3.5" /> Export CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.currentTarget.value = ''
                if (!f) return
                try {
                  const res = await importBackupFile(f, importMode)
                  toast('success', `Backup restored (${importMode})`, `${res.apps} applications · ${res.jobs} jobs · ${res.docs} documents`)
                } catch (err) {
                  toast('error', 'Import failed', (err as Error).message)
                }
              }}
            />
            <Select value={importMode} onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')} className="w-32 h-9 text-xs rounded-lg">
              <option value="merge">Mode: merge</option>
              <option value="replace">Mode: replace</option>
            </Select>
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <RefreshCw className="size-3.5" /> Restore backup
            </Button>
            <Button variant="outline" size="sm" onClick={() => installDemo().then(() => toast('success', 'Demo data loaded', 'A fictional dataset — clear it anytime.'))}>
              <Wand2 className="size-3.5" /> Load demo data
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
              <Trash2 className="size-3.5" /> Clear all
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[10.5px] text-ink-400">
          Tip: download a backup before clearing your browser data — restoring with “merge” keeps current rows, “replace” wipes first.
        </p>
      </Card>
      <Confirm
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Delete all application data?"
        body="Applications, jobs, documents and history are wiped from this browser. Providers and keys are kept. Export a backup first!"
        confirmLabel="Delete everything"
        danger
        onConfirm={() => clearAll().then(() => toast('success', 'All data cleared'))}
      />
    </section>
  )
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-ink-100/70 dark:bg-ink-800/60 px-3 py-2 text-center min-w-24">
      <p className="text-lg font-extrabold text-ink-800 dark:text-white leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
    </div>
  )
}

/* ================= Help / free keys ================= */

function HelpSection() {
  return (
    <section>
      <SectionHeader title="Free API keys — where to get them" subtitle="All providers below have free tiers; none require a credit card for basic use" />
      <div className="grid gap-3 sm:grid-cols-2">
        {FREE_SOURCES.map((s) => (
          <Card key={s.name} className="p-4" hover>
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <KeyRound className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink-800 dark:text-white">{s.name}</p>
                <p className="text-[11px] text-ink-400">{s.note}</p>
              </div>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline">
                Get key ↗
              </a>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-3 border-amber-200/70 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5 p-4 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300 space-y-1">
        <p className="flex items-start gap-2 font-bold">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" /> Privacy & security notes
        </p>
        <p>• Your profile and job descriptions are sent only to the provider you select for each run (that's how generation works).</p>
        <p>• API keys are stored in this browser's local storage — never in a sync, never rendered in the application data. Downloading a backup does not include keys.</p>
        <p>• Some providers log prompts on free tiers; Google AI Studio states free-tier data may be used to train. Prefer “Ollama / local” if you want zero cloud.</p>
      </Card>
    </section>
  )
}

/* ================= static data ================= */

const KIND_HINTS: Record<ProviderKind, { modelHint?: string; modelPlaceholder?: string; urlHint?: string; privacy: string; suggestions: string[] }> = {
  gemini: {
    modelHint: 'models/…',
    modelPlaceholder: 'gemini-2.5-flash',
    privacy: 'Google AI Studio free tier may use inputs for training',
    suggestions: ['models/gemini-2.5-flash', 'models/gemini-2.0-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.5-pro'],
  },
  openai_compatible: {
    modelHint: 'exact model id',
    modelPlaceholder: 'gpt-4o-mini',
    urlHint: '…/v1 — check the service docs',
    privacy: 'Key stays in your browser; calls go direct to the endpoint',
    suggestions: ['gpt-4o-mini', 'llama-3.3-70b-versatile', 'meta-llama/llama-3.3-70b-instruct:free'],
  },
  anthropic: {
    modelHint: 'claude model id',
    modelPlaceholder: 'claude-haiku-4-5',
    privacy: 'Anthropic does not train on API inputs by default',
    suggestions: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-3-5-haiku-latest'],
  },
  ollama: {
    modelHint: 'installed model tag',
    modelPlaceholder: 'llama3.1',
    urlHint: 'default http://localhost:11434/v1',
    privacy: '100% local — nothing leaves your machine',
    suggestions: ['llama3.1', 'qwen2.5', 'mistral-nemo', 'gemma2'],
  },
}

const TASK_NEED: Record<TaskKind, string> = {
  extraction: 'Cheap, fast, reliable JSON',
  matching: 'Balanced quality',
  resume: 'Strong writing, high faithfulness',
  cover_letter: 'Strong writing',
  answers: 'Strong writing',
  insights: 'Mid-tier',
  resume_import: 'Medium, good at structure',
}

const FREE_SOURCES = [
  { name: 'Google AI Studio (Gemini)', url: 'https://aistudio.google.com/apikey', note: 'Generous free tier — great default' },
  { name: 'Groq', url: 'https://console.groq.com/keys', note: 'Very fast Llama models, free tier' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/keys', note: ':free models, one key for many vendors' },
  { name: 'Kimi (Moonshot)', url: 'https://platform.moonshot.cn/console/api-keys', note: 'OpenAI-compatible endpoint' },
]

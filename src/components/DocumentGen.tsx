import { useEffect, useState } from 'react'
import type { DocType, Profile } from '../lib/types'
import type { AppRow } from '../store'
import { useStore } from '../store'
import { Button, Card, Modal, Textarea } from './ui'
import { ModelChipSelect, type ModelOverride } from './ModelChip'
import { runAnswers, runCoverLetter, runResume } from '../lib/ai/tasks'
import { printDoc } from './DocumentPreview'
import { copyText, downloadBlob } from '../lib/utils'
import { AlertTriangle, Copy, Download, Printer, RefreshCw, Save } from 'lucide-react'

export const TYPE_LABEL: Record<DocType, string> = {
  resume: 'Tailored resume',
  cover_letter: 'Cover letter',
  answers: 'Application answers',
}

const taskOf = (type: DocType) => (type === 'resume' ? ('resume' as const) : type === 'cover_letter' ? ('cover_letter' as const) : ('answers' as const))

/**
 * Generates (or regenerates) an AI document for one application. Content is
 * editable before saving; only profile facts are sent/allowed.
 */
export function DocumentGenModal({ open, onClose, app, type }: { open: boolean; onClose: () => void; app: AppRow; type: DocType }) {
  const { profile, resolveTask, hasAi, toast, addDocument } = useStore()
  const task = taskOf(type)
  const [override, setOverride] = useState<ModelOverride | null>(null)
  const [busy, setBusy] = useState(false)
  const [content, setContent] = useState('')
  const [generatedBy, setGeneratedBy] = useState<string | null>(null)
  const [questions, setQuestions] = useState('Why this role?\nWhy are you a good fit?')
  const [instructions, setInstructions] = useState('')

  useEffect(() => {
    if (open) {
      setContent('')
      setGeneratedBy(null)
      setOverride(null)
      setInstructions('')
      setBusy(false)
    }
  }, [open])

  const cfg = resolveTask(task, override ?? undefined)

  const run = async () => {
    if (!profileHasFacts(profile)) {
      toast('error', 'Fill your profile first', 'Generation can only use facts from your Profile page — add skills and experience there first.')
      return
    }
    if (!cfg) {
      toast('info', 'No AI provider selected', hasAi ? 'Resolve a provider in Settings → Task routing.' : 'Add a free API key in Settings → AI Providers first.')
      return
    }
    setBusy(true)
    setContent('')
    setGeneratedBy(null)
    try {
      if (type === 'resume') {
        const { text, label } = await runResume(cfg, profile, app.job!, (partial) => setContent(partial))
        setContent(text)
        setGeneratedBy(label)
      } else if (type === 'cover_letter') {
        const { text, label } = await runCoverLetter(cfg, profile, app.job!, instructions || undefined, (partial) => setContent(partial))
        setContent(text)
        setGeneratedBy(label)
      } else {
        const qs = questions.split('\n').map((q) => q.trim()).filter(Boolean)
        if (!qs.length) throw new Error('Add at least one question (one per line).')
        const { data, label } = await runAnswers(cfg, profile, app.job!, qs)
        setContent(data.map((a, i) => `### Q${i + 1}: ${a.question}\n\n${a.answer}`).join('\n\n'))
        setGeneratedBy(label)
      }
    } catch (e) {
      toast('error', 'Generation failed', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!content.trim()) return
    const id = await addDocument(
      {
        application_id: app.id!,
        job_id: app.job_id,
        type,
        title: `${TYPE_LABEL[type]} — ${app.title}`,
        content,
        provider: cfg?.name ?? 'unknown',
        model: cfg?.model ?? 'unknown',
      },
      true,
    )
    void id
    toast('success', `${TYPE_LABEL[type]} saved`, 'Linked to this application and versioned.')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`${TYPE_LABEL[type]} — ${app.company}`} wide>
      <div className="space-y-4">
        <Card className="flex flex-wrap items-center gap-2 border-amber-200 bg-amber-50/60 p-3 text-[11px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          Facts-only generation: the model receives your profile and must not invent employers, dates or skills. Review every draft before applying.
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <ModelChipSelect task={task} value={override} onChange={setOverride} />
          {type === 'cover_letter' && (
            <input
              className="min-w-48 flex-1 h-9 px-3 text-sm rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
              placeholder="Extra instructions — tone, points to emphasise…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          )}
          <Button onClick={run} loading={busy} size="sm" className="ml-auto">
            {content ? (
              <>
                <RefreshCw className="size-3.5" /> Regenerate
              </>
            ) : (
              'Generate'
            )}
          </Button>
        </div>

        {type === 'answers' && !content && !busy && (
          <Textarea
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            placeholder="One application question per line"
            className="min-h-24"
          />
        )}

        {busy && !content && (
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2.5 rounded-full bg-brand-400" style={{ animation: `pulse 1s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
            <p className="text-sm text-ink-400">Writing your {TYPE_LABEL[type].toLowerCase()}{cfg ? ` with ${cfg.name}` : ''}…</p>
          </div>
        )}

        {content && (
          <div className="space-y-3">
            {busy && (
              <div className="flex items-center gap-2 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/60 dark:bg-brand-500/10 px-3 py-2 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                <RefreshCw className="size-3.5 animate-spin" /> Streaming live from {cfg?.name ?? 'the model'} — editable when finished
              </div>
            )}
            <div className="flex items-center justify-between rounded-t-2xl border border-b-0 border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50 px-4 py-2">
              <p className="text-[11px] font-semibold text-ink-500 dark:text-ink-300">
                {generatedBy ? (
                  <>
                    Generated by <span className="text-brand-600 dark:text-brand-400">{generatedBy}</span>
                  </>
                ) : (
                  'Draft (not saved yet)'
                )}
              </p>
              {!busy && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="xs" onClick={() => copyText(content).then(() => toast('success', 'Copied to clipboard'))}>
                    <Copy className="size-3.5" /> Copy
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => downloadBlob(content, docFileNameFor(app, type), 'text/markdown')}>
                    <Download className="size-3.5" /> .md
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => printDoc(content)}>
                    <Printer className="size-3.5" /> PDF
                  </Button>
                </div>
              )}
            </div>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-72 font-mono text-[12.5px]" spellCheck readOnly={busy} />
            {!busy && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-ink-400">Editable draft — edit freely, then save.</p>
                <Button size="sm" onClick={save}>
                  <Save className="size-3.5" /> Save to application
                </Button>
              </div>
            )}
          </div>
        )}

        {!busy && !content && !hasAi && (
          <div className="text-center text-xs text-ink-400">
            No AI provider configured. Tracking works without it — add a <b>free</b> Gemini / Groq / OpenRouter key in Settings to unlock documents.
          </div>
        )}
      </div>
    </Modal>
  )
}

function docFileNameFor(app: AppRow, type: DocType): string {
  return `${type === 'cover_letter' ? 'cover-letter' : type}-${app.company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.md'
}

function profileHasFacts(p: Profile): boolean {
  return Boolean(p?.skills?.length || p?.experience?.length || p?.master_resume?.trim())
}

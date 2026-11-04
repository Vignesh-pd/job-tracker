import { useRef, useState } from 'react'
import { CheckCircle2, FileText, Lock, Loader2, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { Button, Card, Modal, SectionHeader } from './ui'
import { readResumeText, type ResumeExtract } from '../lib/files'
import { extractResumeSafe, mergeExtractIntoProfile } from '../lib/ai/resumeImport'
import { cn } from '../lib/utils'
import type { Profile } from '../lib/types'

/**
 * Upload a resume (PDF / DOCX / TXT / MD / RTF) and extract personal details
 * into the master profile. Shows a review modal before anything is applied.
 * Without an AI key the fast local extractor runs (contacts + full text).
 */
export function ResumeImport({ draft, onApply }: { draft: Profile; onApply: (merged: Profile, added: string[]) => void }) {
  const { resolveTask, toast } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [stage, setStage] = useState<'idle' | 'reading' | 'extracting'>('idle')
  const [lastText, setLastText] = useState('')
  const [readMethod, setReadMethod] = useState('')
  const [result, setResult] = useState<{ data: ResumeExtract; label: string; usedAi: boolean; error?: string; fileName: string } | null>(null)

  const cfg = resolveTask('resume_import')

  const handleFile = async (file: File) => {
    if (stage !== 'idle') return
    if (file.size > 20 * 1024 * 1024) {
      toast('error', 'File too large', 'Resumes should be well under 20 MB.')
      return
    }
    try {
      setStage('reading')
      const read = await readResumeText(file)
      if (!read.text.trim()) {
        toast('error', 'No text found', read.method || 'Could not extract text from this file. Try saving it as a text-based PDF.')
        setStage('idle')
        return
      }
      setLastText(read.text)
      setReadMethod(read.method)
      setStage('extracting')
      const extraction = await extractResumeSafe(cfg, read.text)
      setResult({ ...extraction, fileName: file.name })
    } catch (e) {
      toast('error', 'Import failed', (e as Error).message)
    } finally {
      setStage('idle')
    }
  }

  const apply = () => {
    if (!result) return
    const { profile, added } = mergeExtractIntoProfile(draft, result.data, lastText)
    if (!added.length) {
      toast('info', 'Everything already present', 'Nothing new from this resume — your profile already has it all.')
    } else {
      onApply(profile, added)
      toast('success', 'Profile updated', `Imported: ${added.join(', ')}.`)
    }
    setResult(null)
  }

  const busy = stage !== 'idle'
  const hasProvider = Boolean(resolveTask('resume_import'))
  const providerName = cfg?.name

  return (
    <Card className="p-5">
      <SectionHeader
        title="Import from resume"
        subtitle="Drop a resume file and JobPilot fills the fields below — you review before anything is applied."
        action={
          hasProvider ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              <Sparkles className="size-3.5" /> {providerName ? `auto-parses with ${providerName}` : 'auto-parse ready'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
              <Lock className="size-3.5" /> local mode (contacts only)
            </span>
          )
        }
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) void handleFile(f)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-fast',
          dragOver ? 'border-brand-400 bg-brand-50/70 dark:bg-brand-500/10' : 'border-ink-200 dark:border-ink-700 hover:border-brand-300 hover:bg-brand-50/40 dark:hover:bg-brand-500/5',
          busy && 'pointer-events-none opacity-70',
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md,.rtf,application/pdf,application/msword"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.currentTarget.value = ''
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {stage === 'idle' && (
          <>
            <FileText className="size-7 text-brand-500" />
            <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Drop your resume here, or click to choose</p>
            <p className="text-[11px] text-ink-400">PDF · DOCX · TXT · MD · RTF — max 20 MB</p>
          </>
        )}
        {stage === 'reading' && (
          <>
            <Loader2 className="size-6 animate-spin text-brand-500" />
            <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Reading file…</p>
          </>
        )}
        {stage === 'extracting' && (
          <>
            <Loader2 className="size-6 animate-spin text-brand-500" />
            <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">{providerName ? `Parsing with ${providerName}…` : 'Extracting locally…'}</p>
          </>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        {hasProvider ? (
          <>
            The parser copies only what's written in the file — it can't invent details. The full text is also saved under
            {' '}<b>Master resume</b> (if that field is empty) so tailored documents stay faithful to your wording.
          </>
        ) : (
          <>
            Without an AI key, the local extractor picks up only obvious bits (email, phone, links). Add a free key in
            Settings → AI Providers to parse the whole resume automatically.
          </>
        )}
      </p>

      <Modal open={Boolean(result)} onClose={() => setResult(null)} title={`Review — ${result?.fileName ?? ''}`}>
        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-ink-100 dark:bg-ink-800 px-2.5 py-1 font-semibold text-ink-600 dark:text-ink-300">{readMethod}</span>
              <span className={cn('rounded-full px-2.5 py-1 font-semibold', result.usedAi ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300')}>
                {result.label}
              </span>
              {result.error && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">AI failed — local fallback</span>
              )}
            </div>

            {result.error && <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">{result.error}</p>}

            <p className="text-xs text-ink-500 dark:text-ink-400">Nothing is applied until you confirm. Existing fields are never overwritten — new details merge in.</p>

            <ul className="grid gap-1.5 text-[13px]">
              <Item ok={result.data.full_name} text={`Name — ${result.data.full_name}`} />
              <Item ok={result.data.email} text={`Email — ${result.data.email}`} />
              <Item ok={result.data.phone} text={`Phone — ${result.data.phone}`} />
              <Item ok={result.data.location} text={`Location — ${result.data.location}`} />
              <Item ok={result.data.links.linkedin} text={`LinkedIn — ${result.data.links.linkedin}`} />
              <Item ok={result.data.links.github} text={`GitHub — ${result.data.links.github}`} />
              <Item ok={result.data.links.portfolio} text={`Portfolio — ${result.data.links.portfolio}`} />
              <Item ok={result.data.summary} text={`Summary — ${result.data.summary.slice(0, 90)}…`} />
              <Item ok={result.data.skills.length} text={`${result.data.skills.length} skill${result.data.skills.length === 1 ? '' : 's'} — ${result.data.skills.slice(0, 6).map((s) => s.name).join(', ')}${result.data.skills.length > 6 ? '…' : ''}`} />
              <Item ok={result.data.experience.length} text={`${result.data.experience.length} role${result.data.experience.length === 1 ? '' : 's'} — ${result.data.experience.slice(0, 3).map((e) => `${e.title} @ ${e.company}`).join(' · ')}`} />
              <Item ok={result.data.education.length} text={`${result.data.education.length} degree${result.data.education.length === 1 ? '' : 's'}`} />
              <Item ok={result.data.certifications.length} text={`${result.data.certifications.length} certification${result.data.certifications.length === 1 ? '' : 's'}`} />
              <Item ok={result.data.projects.length} text={`${result.data.projects.length} project${result.data.projects.length === 1 ? '' : 's'}`} />
              <Item ok={result.data.languages.length} text={`Languages — ${result.data.languages.join(', ')}`} />
              {!draft.master_resume.trim() && <Item ok text="Full resume text → Master resume (used by the tailoring task)" />}
            </ul>

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                Discard
              </Button>
              <Button size="sm" onClick={apply}>
                <CheckCircle2 className="size-3.5" /> Apply to profile
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

function Item({ ok, text }: { ok: string | number | boolean; text: string }) {
  if (!ok) return null
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
      <span className="min-w-0 break-words text-ink-700 dark:text-ink-200">{text}</span>
    </li>
  )
}

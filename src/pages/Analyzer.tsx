import { useState } from 'react'
import type { Job, MatchReport } from '../lib/types'
import { useStore } from '../store'
import { Badge, Button, Card, Field, Input, Textarea, ScoreRing, Select, SkillChip, SectionHeader } from '../components/ui'
import { ModelChipSelect, type ModelOverride } from '../components/ModelChip'
import { runExtraction, runMatching } from '../lib/ai/tasks'
import { computeOverlap, overlapToReport } from '../lib/match'
import { TODAY, addDays } from '../lib/utils'
import { navigate } from '../lib/router'
import { ArrowLeft, BadgeCheck, Brain, ClipboardPaste, FileSearch, Save, Sparkles, Target } from 'lucide-react'

type Stage = 'input' | 'review' | 'saved'

interface Extracted {
  job: Job
  label: string | null
}

export function AnalyzerPage({ prefApp }: { prefApp?: number }) {
  const store = useStore()
  const { profile, resolveTask, hasAi, toast, addApplicationFromJob } = store
  const [stage, setStage] = useState<Stage>('input')
  const [jd, setJd] = useState('')
  const [url, setUrl] = useState('')
  const [override, setOverride] = useState<ModelOverride | null>(null)
  const [busy, setBusy] = useState<'' | 'extract' | 'match'>('')
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [keywords, setKeywords] = useState('')
  const [savedId, setSavedId] = useState<number | null>(null)
  const [statusChoice, setStatusChoice] = useState<'saved' | 'applied'>('saved')
  const [source, setSource] = useState('')
  const [report, setReport] = useState<MatchReport | null>(null)
  const [edit, setEdit] = useState({ title: '', company: '', location: '', employment_type: '' })

  // prefill from an existing application ("improve")
  void prefApp

  const extract = async () => {
    if (jd.trim().length < 60) {
      toast('info', 'A bit short', 'Paste the full job description for good extraction.')
      return
    }
    setBusy('extract')
    try {
      const cfg = resolveTask('extraction', override ?? undefined)
      let label: string | null
      let j: Job
      if (cfg && hasAi) {
        const r = await runExtraction(cfg, jd)
        label = r.label
        j = {
          url: url.trim(),
          raw_description: jd,
          analyzed_by: r.label,
          created_at: Date.now(),
          ...r.data,
        }
      } else {
        label = null
        j = {
          url: url.trim(),
          raw_description: jd,
          title: '',
          company: '',
          location: '',
          employment_type: '',
          required_skills: [],
          preferred_skills: [],
          keywords: [],
          responsibilities: [],
          created_at: Date.now(),
        }
        toast('info', 'AI not configured', 'Fill the fields manually — you can still save and track this job.')
      }
      setExtracted({ job: j, label })
      setEdit({
        title: j.title,
        company: j.company,
        location: j.location ?? '',
        employment_type: j.employment_type ?? '',
      })
      setKeywords(j.keywords.join(', '))
      if (label) toast('success', 'Job extracted', label)
      setStage('review')
    } catch (e) {
      toast('error', 'Extraction failed', (e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const match = async () => {
    if (!extracted) return null
    const overlap = computeOverlap(profile, extracted.job)
    const cfg = resolveTask('matching', override ?? undefined)
    if (cfg && hasAi) {
      setBusy('match')
      try {
        const { data } = await runMatching(cfg, profile, extracted.job, overlap)
        setReport(data)
        return data
      } catch (e) {
        toast('error', 'Match analysis failed', (e as Error).message + ' — showing the local estimate instead.')
        const local = overlapToReport(overlap, extracted.job, profile)
        setReport(local)
        return local
      } finally {
        setBusy('')
      }
    }
    const local = overlapToReport(overlap, extracted.job, profile)
    setReport(local)
    return local
  }

  const save = async () => {
    if (!extracted) return
    const finalReport = report ?? (await match())
    const finalJob = {
      ...extracted.job,
      title: edit.title || 'Untitled role',
      company: edit.company || 'Unknown company',
      location: edit.location,
      employment_type: edit.employment_type,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
    }
    const appInput = {
      company: finalJob.company,
      title: finalJob.title,
      status: statusChoice,
      applied_on: statusChoice === 'applied' ? TODAY() : undefined,
      source: source.trim(),
      follow_up_on: statusChoice === 'applied' ? addDays(TODAY(), 7) : undefined,
      match_score: finalReport?.score,
    }
    const id = await addApplicationFromJob(finalJob, appInput, finalReport ?? undefined)
    setSavedId(id)
    setStage('saved')
    toast('success', 'Application saved', 'Add documents from its detail view when ready.')
  }

  /* ---------------- rendered ---------------- */

  if (stage === 'saved' && savedId) {
    return (
      <div className="mx-auto max-w-lg py-16 anim-slide">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <BadgeCheck className="size-8" />
          </div>
          <h1 className="text-lg font-extrabold text-ink-900 dark:text-white">Saved & tracked!</h1>
          <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500 dark:text-ink-300">
            {extracted && edit.company ? `${edit.company}` : 'The application'} is now on your dashboard. Match report and job data are stored with it.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => {void savedId; navigate(`#/applications/${savedId}`)}}>Open application</Button>
            <Button variant="secondary" onClick={() => { setStage('input'); setExtracted(null); setReport(null); setJd(''); setUrl('') }}>
              Analyze another
            </Button>
            <Button variant="ghost" onClick={() => navigate('#/dashboard')}>Dashboard</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
            <Sparkles className="size-5 text-brand-500" /> New application
          </h1>
          <p className="text-xs text-ink-400 mt-0.5">Paste a job description — JobPilot extracts the fields, scores the match, and saves it as an application.</p>
        </div>
        <ModelChipSelect task="extraction" value={override} onChange={setOverride} />
      </div>

      {stage === 'input' ? (
        <Card className="p-5 space-y-4">
          <Field label="Job description (paste the full text from the posting)" hint="URL fetch is unreliable on protected portals, so paste-first is the robust choice.">
            <div className="relative">
              <ClipboardPaste className="pointer-events-none absolute right-3 top-2.5 size-4 text-ink-300" />
              <Textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder={'Paste here… e.g.\n\n"Data Engineer (m/f/d)\nWe are looking for an experienced data engineer to join our analytics team. You will build pipelines with Airflow and dbt, model data in Snowflake…"\n\n(min 60 characters)'}
                className="min-h-64 text-[13px] leading-relaxed"
              />
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Posting URL (optional)">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://careers.example.com/job/123" />
            </Field>
            <Field label="Where did you find it? (optional reference for later)">
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="LinkedIn / referral / careers page" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-ink-400">
              {hasAi ? 'Extraction + match will run on your configured AI provider.' : 'No AI key configured — you can still track manually, or add a free key in Settings.'}
            </p>
            <Button loading={busy === 'extract'} onClick={extract} size="md">
              <FileSearch className="size-4" /> Analyze job description
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* left: extracted job */}
          <Card className="p-5 space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <SectionHeader title="Extracted job" subtitle={extracted?.label ? `by ${extracted.label}` : 'manual mode'} />
              <Button variant="ghost" size="xs" onClick={() => { setStage('input'); setExtracted(null); setReport(null) }}>
                <ArrowLeft className="size-3" /> back
              </Button>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Role"><Input value={edit.title} onChange={(e) => setEdit((f) => ({ ...f, title: e.target.value }))} /></Field>
              <Field label="Company"><Input value={edit.company} onChange={(e) => setEdit((f) => ({ ...f, company: e.target.value }))} /></Field>
              <Field label="Location"><Input value={edit.location} onChange={(e) => setEdit((f) => ({ ...f, location: e.target.value }))} /></Field>
              <Field label="Type"><Input value={edit.employment_type} onChange={(e) => setEdit((f) => ({ ...f, employment_type: e.target.value }))} placeholder="Full-time" /></Field>
            </div>
            {extracted && (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-ink-500">Required skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extracted.job.required_skills?.length
                      ? extracted.job.required_skills.map((s, i) => <SkillChip key={i} skill={s} />)
                      : <span className="text-[11px] text-ink-400">none detected</span>}
                  </div>
                </div>
                {!!extracted.job.preferred_skills?.length && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold text-ink-500">Preferred</p>
                    <div className="flex flex-wrap gap-1.5">{extracted.job.preferred_skills.map((s, i) => <SkillChip key={i} skill={s} />)}</div>
                  </div>
                )}
                <Field label="Keywords (editable, comma separated)">
                  <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
                </Field>
                <Field label="Match on save">
                  <Select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value as 'saved' | 'applied')}>
                    <option value="saved">Save as “Saved” (not yet applied)</option>
                    <option value="applied">I applied today</option>
                  </Select>
                </Field>
                <Button loading={busy === 'match'} disabled={!extracted} onClick={() => { void match() }} variant={report ? 'outline' : 'primary'}>
                  <Brain className="size-4" /> {report ? 'Re-run match' : 'Score my match'}
                </Button>
              </>
            )}
          </Card>

          {/* right: match report */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-5">
              <SectionHeader title="Match report" subtitle="Skills coverage, experience and education alignment" />
              {!report && !busy ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-ink-400">
                  <Target className="size-7 text-ink-200 dark:text-ink-700" />
                  Run the scorer to see your fit score, strong overlaps and the gaps to close.
                </div>
              ) : report ? (
                <MatchPanel report={report} />
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-sm text-ink-400 animate-pulse">Assessing…</div>
              )}
            </Card>
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink-700 dark:text-ink-100">Ready to track it?</p>
                  <p className="text-[11px] text-ink-400">Creates the job record + application with the match report attached{statusChoice === 'applied' ? ' and a 7-day follow-up reminder' : ''}.</p>
                </div>
                <Button loading={busy === 'match'} onClick={save} disabled={!edit.title && !edit.company}>
                  <Save className="size-4" /> Save application
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function MatchPanel({ report }: { report: MatchReport }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={report.score} size={72} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-800 dark:text-ink-100">{report.score >= 75 ? 'Strong fit' : report.score >= 50 ? 'Decent fit' : 'Weak fit'}</p>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">{report.summary}</p>
          <Badge className="mt-1.5" tone="gray">{report.generated_by ?? 'local'}</Badge>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Strong matches</p>
          <ul className="space-y-1">
            {(report.strong_matches ?? []).map((m, i) => (
              <li key={i} className="flex gap-2 text-xs text-ink-600 dark:text-ink-300"><span className="text-emerald-500 shrink-0">✓</span>{m}</li>
            )) || <li className="text-xs text-ink-400">—</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-rose-500">Skill gaps</p>
          <div className="flex flex-wrap gap-1.5">
            {(report.missing_skills ?? []).length ? (report.missing_skills).map((s, i) => <SkillChip key={i} skill={s} tone="miss" />) : <span className="text-xs text-ink-400">No hard gaps 🎉</span>}
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-ink-500 dark:text-ink-300">
        {report.experience_alignment && <p><b className="text-ink-700 dark:text-ink-200">Experience:</b> {report.experience_alignment}</p>}
        {report.education_alignment && <p><b className="text-ink-700 dark:text-ink-200">Education:</b> {report.education_alignment}</p>}
      </div>
    </div>
  )
}

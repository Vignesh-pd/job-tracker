import { useMemo, useState } from 'react'
import type { AppDoc, AppStatus, Skill } from '../lib/types'
import { useStore } from '../store'
import { Badge, Button, Card, Confirm, Field, MatchReportBlock, Modal, SkillChip, StatusBadge, Textarea } from './ui'
import { STATUS_LABEL, STATUSES } from '../lib/types'
import { DocumentGenModal, TYPE_LABEL } from './DocumentGen'
import { DocumentPreviewModal } from './DocumentPreview'
import { fmtDate, addDays, TODAY, timeAgo, copyText, cn } from '../lib/utils'
import { computeOverlap, overlapToReport } from '../lib/match'
import { runMatching } from '../lib/ai/tasks'
import { FileText, ExternalLink, Trash2, Wand2, History, Bell, FilePlus2, RefreshCw } from 'lucide-react'

type TabId = 'overview' | 'jd' | 'timeline' | 'docs' | 'notes'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'jd', label: 'Job description' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'docs', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
]

export function ApplicationDetail({ appId, onClose }: { appId: number; onClose: () => void }) {
  const store = useStore()
  const { apps, history, documents, updateApplication, deleteApplication, deleteDocument, resolveTask, hasAi, toast } = store
  const app = apps.find((a) => a.id === appId)
  const [tab, setTab] = useState<TabId>('overview')
  const [genType, setGenType] = useState<'resume' | 'cover_letter' | 'answers' | null>(null)
  const [preview, setPreview] = useState<AppDoc | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [notes, setNotes] = useState(app?.notes ?? '')
  const [rematching, setRematching] = useState(false)

  const appHistory = useMemo(() => history.filter((h) => h.application_id === appId).sort((a, b) => b.changed_at - a.changed_at), [history, appId])
  const appDocs = useMemo(() => documents.filter((d) => d.application_id === appId), [documents, appId])

  if (!app) return null

  const reanalyzeMatch = async () => {
    if (!app.job) {
      toast('info', 'No job description', 'Manual entries without a pasted JD cannot be re-analyzed.')
      return
    }
    setRematching(true)
    try {
      const cfg = resolveTask('matching')
      if (cfg && hasAi) {
        const overlap = computeOverlap(store.profile, app.job)
        const { data } = await runMatching(cfg, store.profile, app.job, overlap)
        await updateApplication(app.id!, { match_report: data, match_score: data.score })
        toast('success', 'Match report updated', `Assessed by ${data.generated_by}`)
      } else {
        const overlap = computeOverlap(store.profile, app.job)
        await updateApplication(app.id!, { match_report: overlapToReport(overlap, app.job, store.profile), match_score: overlap.score })
        toast('info', 'Local match computed', 'Configure an AI provider for a recruiter-grade explanation.')
      }
    } catch (e) {
      toast('error', 'Match analysis failed', (e as Error).message)
    } finally {
      setRematching(false)
    }
  }

  const changeStatus = async (s: AppStatus) => {
    await updateApplication(app.id!, { status: s })
    if (s !== 'saved' && !app.applied_on) await updateApplication(app.id!, { applied_on: TODAY() })
    if ((s === 'applied' || s === 'pending') && !app.follow_up_on) {
      await updateApplication(app.id!, { follow_up_on: addDays(app.applied_on ?? TODAY(), 7) })
      toast('info', 'Follow-up scheduled', `${STATUS_LABEL[s]} — reminder set for ${fmtDate(addDays(app.applied_on ?? TODAY(), 7))}.`)
    }
  }

  const genButton = (type: 'resume' | 'cover_letter' | 'answers', label: string) => (
    <Button key={type} size="sm" variant={type === 'resume' ? 'primary' : 'subtle'} onClick={() => setGenType(type)}>
      <Wand2 className="size-3.5" /> {label}
    </Button>
  )

  return (
    <>
      <Modal open={true} onClose={onClose} wide title={
        <span>
          <span className="text-ink-900 dark:text-white">{app.title}</span>
          <span className="text-ink-400 font-medium"> @{app.company}</span>
        </span>
      }>
        <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={app.status} />
          {app.match_score !== undefined && app.match_score !== null && <Badge tone="brand">match {app.match_score}</Badge>}
          {app.source && <Badge>via {app.source}</Badge>}
          {app.applied_on && <Badge tone="gray">applied {fmtDate(app.applied_on)}</Badge>}
          {app.job?.url && (
            <a href={app.job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              Job posting <ExternalLink className="size-3" />
            </a>
          )}
            <span className="ml-auto flex items-center gap-1">
            <Select value={app.status} onChange={(s) => changeStatus(s)} />
            <Button variant="ghost" size="sm" className="text-rose-500" onClick={() => setConfirmDel(true)}>
              <Trash2 className="size-4" />
            </Button>
          </span>
        </div>

        {/* tabs */}
        <div className="mb-4 flex gap-1 border-b border-ink-100 dark:border-ink-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative px-3 py-2 text-xs font-bold transition-fast -mb-px border-b-2',
                tab === t.id ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-ink-400 hover:text-ink-600 dark:hover:text-ink-200',
              )}
            >
              {t.label}
              {t.id === 'docs' && appDocs.length > 0 && <span className="ml-1 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 px-1.5 py-0.5 text-[10px]">{appDocs.length}</span>}
              {t.id === 'notes' && app.notes && <span className="ml-1 size-1.5 rounded-full bg-brand-400 inline-block align-middle" />}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-2 text-xs font-bold text-ink-600 dark:text-ink-200">Match analysis</h3>
              <MatchReportBlock report={app.match_report} />
              {app.job && (
                <Button variant="outline" size="xs" className="mt-3" loading={rematching} onClick={reanalyzeMatch}>
                  <RefreshCw className="size-3" /> Re-analyze match
                </Button>
              )}
            </Card>
            <div className="space-y-3">
              {app.follow_up_on && (
                <Card className="flex items-center gap-3 p-3.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Bell className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink-700 dark:text-ink-100">Follow-up {followUpLabel(app.follow_up_on)}</p>
                    <p className="text-[11px] text-ink-400">{fmtDate(app.follow_up_on)}</p>
                  </div>
                  <Button size="xs" variant="secondary" onClick={() => updateApplication(app.id!, { follow_up_on: addDays(TODAY(), 7) })}>
                    +7d
                  </Button>
                  <Button size="xs" variant="ghost" className="text-ink-400" onClick={() => updateApplication(app.id!, { follow_up_on: undefined })}>
                    clear
                  </Button>
                </Card>
              )}
              {!app.follow_up_on && app.status !== 'saved' && (
                <Card className="flex items-center gap-3 p-3.5">
                  <Bell className="size-4 text-ink-300" />
                  <p className="flex-1 text-xs text-ink-500 dark:text-ink-300">No follow-up scheduled</p>
                  <Button size="xs" variant="secondary" onClick={() => updateApplication(app.id!, { follow_up_on: addDays(app.applied_on ?? TODAY(), 7) })}>
                    Schedule
                  </Button>
                </Card>
              )}
              <Card className="p-4">
                <h3 className="mb-2 text-xs font-bold text-ink-600 dark:text-ink-200">Documents</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {genButton('resume', 'Resume')}
                  {genButton('cover_letter', 'Cover letter')}
                  {genButton('answers', 'Answers')}
                </div>
                {appDocs.length === 0 ? (
                  <p className="text-[11px] text-ink-400">No documents yet — generate one above once your profile is filled.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {appDocs
                      .sort((a, b) => b.created_at - a.created_at)
                      .map((d) => (
                        <li key={d.id} className="flex items-center gap-2 text-xs">
                          <FileText className="size-3.5 text-ink-300 shrink-0" />
                          <button className="flex-1 min-w-0 text-left truncate hover:text-brand-600 dark:hover:text-brand-400 font-medium" onClick={() => setPreview(d)}>
                            {TYPE_LABEL[d.type]} · v{d.version}
                          </button>
                          <span className="shrink-0 text-[10px] text-ink-400">{d.provider}</span>
                          {((d.type === 'resume' && app.resume_doc_id === d.id) || (d.type === 'cover_letter' && app.cover_letter_doc_id === d.id)) && (
                            <Badge tone="green">active</Badge>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === 'jd' && (
          app.job ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="p-3.5">
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">Required skills {app.job.required_skills?.length ? `(${app.job.required_skills.length})` : ''}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(app.job.required_skills ?? []).length === 0 ? (
                      <span className="text-xs text-ink-400">none extracted</span>
                    ) : (
                      app.job.required_skills.map((s, i) => <SkillChip key={i} skill={s} tone={profileHasSkill(store.profile.skills, s) ? 'match' : undefined} />)
                    )}
                  </div>
                </Card>
                <Card className="p-3.5">
                  <p className="text-[11px] font-bold text-brand-600 dark:text-brand-400 mb-1.5">Preferred skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(app.job.preferred_skills ?? []).length === 0 ? (
                      <span className="text-xs text-ink-400">none extracted</span>
                    ) : (
                      app.job.preferred_skills.map((s, i) => <SkillChip key={i} skill={s} tone={profileHasSkill(store.profile.skills, s) ? 'match' : undefined} />)
                    )}
                  </div>
                </Card>
              </div>
              {(app.job.responsibilities ?? []).length > 0 && (
                <Card className="p-3.5">
                  <p className="text-[11px] font-bold text-ink-500 mb-1.5">Responsibilities</p>
                  <ul className="space-y-1 text-xs text-ink-600 dark:text-ink-300 list-disc pl-4">
                    {app.job.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </Card>
              )}
              <Card className="p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-ink-500">Original description</p>
                  <Button variant="ghost" size="xs" onClick={() => copyText(app.job!.raw_description).then(() => toast('success', 'Copied'))}>
                    <FilePlus2 className="size-3" /> copy
                  </Button>
                </div>
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-600 dark:text-ink-300">{app.job.raw_description}</div>
              </Card>
            </div>
          ) : (
            <p className="py-10 text-center text-xs text-ink-400">This application has no linked job description (added manually).</p>
          )
        )}

        {tab === 'timeline' && (
          <ol className="relative ml-3 space-y-4 border-l-2 border-ink-100 dark:border-ink-800 pl-5 pt-1">
            {appHistory.map((h, i) => (
              <li key={h.id ?? i} className="relative">
                <span className="absolute -left-[27px] top-0 grid size-4 place-items-center rounded-full border-2 border-white dark:border-ink-900 bg-brand-500" />
                <p className="text-xs font-bold text-ink-700 dark:text-ink-100">
                  {h.from_status ? `${STATUS_LABEL[h.from_status]} → ${STATUS_LABEL[h.to_status]}` : `${STATUS_LABEL[h.to_status]} (created)`}
                </p>
                <p className="text-[11px] text-ink-400">{timeAgo(h.changed_at)}</p>
              </li>
            ))}
            {appHistory.length === 0 && <p className="text-xs text-ink-400">No status changes recorded yet.</p>}
          </ol>
        )}

        {tab === 'docs' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">{genButton('resume', 'Resume')}{genButton('cover_letter', 'Cover letter')}{genButton('answers', 'Answers')}</div>
            {appDocs.length === 0 ? (
              <Card className="p-6 text-center text-xs text-ink-400">
                <History className="mx-auto mb-2 size-6 text-ink-300" />
                Generate documents with any provider you configured — versions are kept with the model label.
              </Card>
            ) : (
              appDocs.map((d) => (
                <Card key={d.id} className="p-3.5" hover>
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 text-brand-400 shrink-0" />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setPreview(d)}>
                      <p className="truncate text-xs font-bold text-ink-700 dark:text-ink-100">{TYPE_LABEL[d.type]} · v{d.version}</p>
                      <p className="truncate text-[10.5px] text-ink-400">{d.provider}{d.model ? ` · ${d.model.replace(/^models\//, '')}` : ''} · {fmtDate(d.created_at)}</p>
                    </button>
                    <Button variant="ghost" size="xs" className="text-rose-500" onClick={() => deleteDocument(d.id!)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-2">
            <Field label="Private notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Interview impressions, contact person, salary discussion…" className="min-h-40" />
            </Field>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { updateApplication(app.id!, { notes }); toast('success', 'Notes saved') }}>Save notes</Button>
            </div>
          </div>
        )}
      </Modal>

      <DocumentGenModal open={!!genType} onClose={() => setGenType(null)} app={app} type={genType ?? 'resume'} />
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Delete this application?"
        body="Its job description, documents and history are removed. Consider exporting a backup first."
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteApplication(app.id!).then(onClose)}
      />
    </>
  )
}

/* inline status select styled as chip */
function Select({ value, onChange }: { value: AppStatus; onChange: (s: AppStatus) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AppStatus)}
      className="h-8 cursor-pointer rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 pr-1.5 text-[11px] font-bold text-ink-700 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
      aria-label="Change status"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  )
}

function followUpLabel(d: string): string {
  const diff = Math.round((new Date(d + 'T00:00:00').getTime() - new Date(TODAY() + 'T00:00:00').getTime()) / 86400000)
  if (diff < -1) return `overdue by ${-diff} days`
  if (diff === -1) return 'overdue — yesterday'
  if (diff === 0) return 'due today'
  if (diff === 1) return 'due tomorrow'
  return `in ${diff} days`
}

function profileHasSkill(skills: Skill[], target: string): boolean {
  const t = target.toLowerCase().trim()
  return skills.some((s) => s.name.toLowerCase().includes(t) || t.includes(s.name.toLowerCase()))
}

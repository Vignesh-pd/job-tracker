import { useMemo, type ReactNode } from 'react'
import type { AppStatus } from '../lib/types'
import { STATUSES, STATUS_LABEL } from '../lib/types'
import { useStore } from '../store'
import { Badge, Button, Card, StatusBadge } from '../components/ui'
import { cn, greetingName, timeAgo, TODAY, daysBetween } from '../lib/utils'
import { navigate } from '../lib/router'
import { ArrowRight, CalendarClock, ClipboardList, Flame, PartyPopper, Sparkles, TrendingUp, Upload, Wand2, BellOff } from 'lucide-react'

const STAT_ACCENTS: Record<AppStatus, string> = {
  saved: 'from-slate-400 to-slate-500',
  applied: 'from-blue-400 to-blue-600',
  pending: 'from-amber-400 to-amber-500',
  assessment: 'from-violet-400 to-violet-600',
  interview: 'from-indigo-400 to-indigo-600',
  offer: 'from-emerald-400 to-emerald-600',
  rejected: 'from-rose-400 to-rose-600',
  withdrawn: 'from-stone-300 to-stone-400',
}

export function DashboardPage() {
  const { profile, apps, history, installDemo, toast, documents } = useStore()

  const stats = useMemo(() => {
    const count = (fn: (s: AppStatus) => boolean) => apps.filter((a) => fn(a.status)).length
    const inFlight = count((s) => ['applied', 'pending', 'assessment', 'interview'].includes(s))
    return {
      total: apps.length,
      inFlight,
      interviews: count((s) => s === 'interview' || s === 'assessment'),
      offers: count((s) => s === 'offer'),
      rejected: count((s) => s === 'rejected'),
    }
  }, [apps])

  const pipeline = useMemo(
    () =>
      STATUSES.map((s) => ({ status: s, n: apps.filter((a) => a.status === s).length })),
    [apps],
  )
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.n))

  const followUps = useMemo(
    () =>
      apps
        .filter((a) => a.follow_up_on && ['applied', 'pending', 'assessment'].includes(a.status))
        .sort((x, y) => (x.follow_up_on ?? '').localeCompare(y.follow_up_on ?? ''))
        .slice(0, 6),
    [apps],
  )

  const recent = useMemo(() => history.slice(0, 6), [history])
  const overdue = followUps.filter((f) => daysBetween(TODAY(), f.follow_up_on!) < 0)

  const empty = apps.length === 0

  const goTo = (_s?: AppStatus | 'all') => navigate('#/applications')

  return (
    <div className="space-y-5">
      {/* hero */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{TODAY_FULL}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">
            {greetingName(profile.full_name || '')} 👋
          </h1>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
            {empty
              ? 'Your job hunt starts here — paste your first job description and let JobPilot do the bookkeeping.'
              : stats.offers > 0
                ? `${stats.offers} offer${stats.offers > 1 ? 's' : ''} in play — keep the pipeline moving  🎯`
                : stats.inFlight
                  ? `${stats.inFlight} application${stats.inFlight > 1 ? 's' : ''} in flight · ${stats.interviews} in interview stages`
                  : 'Nothing in flight — time to send a few applications.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('#/analyzer')}>
            <Sparkles className="size-4" /> New with AI
          </Button>
        </div>
      </div>

      {overdue.length > 0 && (
        <Card className="border-amber-300/70 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10 p-3.5 flex items-center gap-3">
          <Flame className="size-5 text-amber-500 shrink-0" />
          <p className="flex-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {overdue.length} follow-up{overdue.length > 1 ? 's' : ''} overdue — {overdue.slice(0, 2).map((f) => f.company).join(', ')}{overdue.length > 2 ? '…' : ''}
          </p>
          <Button size="xs" variant="secondary" onClick={() => navigate('#/applications')}>
            Open
          </Button>
        </Card>
      )}

      {empty ? (
        <EmptyHero onDemo={() => installDemo().then(() => toast('success', 'Demo data loaded', 'Clear it anytime in Settings → Your data.'))} />
      ) : (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard icon={<ClipboardList className="size-4" />} label="Tracked" value={stats.total} accent="from-brand-500 to-brand-600" onClick={() => goTo('all')} />
            <StatCard icon={<TrendingUp className="size-4" />} label="In flight" value={stats.inFlight} accent="from-blue-500 to-blue-600" onClick={() => goTo('applied')} />
            <StatCard icon={<CalendarClock className="size-4" />} label="Interviews" value={stats.interviews} accent="from-violet-500 to-violet-600" onClick={() => goTo('interview')} />
            <StatCard icon={<PartyPopper className="size-4" />} label="Offers" value={stats.offers} accent="from-emerald-500 to-emerald-600" onClick={() => goTo('offer')} />
            <StatCard icon={<BellOffish />} label="Rejected" value={stats.rejected} accent="from-rose-500 to-rose-600" onClick={() => goTo('rejected')} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* pipeline */}
            <Card className="p-5">
              <SectionHead title="Pipeline" subtitle="Where things stand right now" />
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                {pipeline.filter((p) => p.n).map((p, i) => (
                  <div
                    key={p.status}
                    className={cn('bg-gradient-to-r transition-all', STAT_ACCENTS[p.status])}
                    style={{ width: `${(p.n / apps.length) * 100}%`, zIndex: pipeline.length - i }}
                    title={`${STATUS_LABEL[p.status]}: ${p.n}`}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {pipeline.filter((p) => p.n).map((p) => (
                  <div key={p.status} className="rounded-xl border border-ink-100 dark:border-ink-800 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2.5 rounded-full bg-gradient-to-br', STAT_ACCENTS[p.status])} />
                      <p className="truncate text-[11px] font-semibold text-ink-500 dark:text-ink-300">{STATUS_LABEL[p.status]}</p>
                    </div>
                    <p className="mt-1 text-lg font-extrabold text-ink-800 dark:text-white">{p.n}</p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <div className={cn('h-full bg-gradient-to-r', STAT_ACCENTS[p.status])} style={{ width: `${Math.round((p.n / pipelineMax) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {pipeline.every((p) => !p.n) && <p className="text-xs text-ink-400">No data yet.</p>}
              </div>
            </Card>

            {/* follow-ups */}
            <Card className="p-5">
              <SectionHead title="Follow-ups" subtitle="Suggested 7 days after applying" action={<Badge tone={overdue.length ? 'rose' : 'brand'}>{followUps.length} scheduled</Badge>} />
              <div className="space-y-2">
                {followUps.length === 0 && <p className="py-6 text-center text-xs text-ink-400">No follow-ups due — apply to a few more roles and they'll appear here.</p>}
                {followUps.map((f) => {
                  const d = daysBetween(TODAY(), f.follow_up_on!)
                  return (
                    <button
                      key={f.id}
                      onClick={() => navigate(`#/applications/${f.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 px-3 py-2.5 text-left transition-fast hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-500/30 dark:hover:bg-ink-800/40"
                    >
                      <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold', d < 0 ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : d <= 2 ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300')}>
                        {d < 0 ? `${-d}d late` : d === 0 ? 'today' : `${d}d`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-ink-800 dark:text-ink-100">{f.company}</p>
                        <p className="truncate text-[11px] text-ink-400">{f.title}</p>
                      </div>
                      <StatusBadge status={f.status} size="sm" />
                      <ArrowRight className="size-3.5 text-ink-300" />
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* recent activity + docs */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionHead title="Recent activity" subtitle="Status changes across the pipeline" />
              {recent.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-400">Nothing yet — changes will stream in here.</p>
              ) : (
                <ul className="space-y-2.5">
                  {recent.map((h, i) => {
                    const app = apps.find((a) => a.id === h.application_id)
                    return (
                      <li key={h.id ?? i} className="flex items-center gap-3 text-xs">
                        <span className={cn('size-2 rounded-full bg-gradient-to-br shrink-0', STAT_ACCENTS[h.to_status])} />
                        <button className="min-w-0 flex-1 text-left truncate font-semibold text-ink-700 dark:text-ink-100 hover:underline" onClick={() => app && navigate(`#/applications/${app.id}`)}>
                          {app?.company ?? 'Deleted app'} · {STATUS_LABEL[h.to_status]}
                        </button>
                        <span className="shrink-0 text-[10.5px] text-ink-400">{timeAgo(h.changed_at)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <SectionHead title="Documents generated" subtitle={`${documents.length} total, versioned with model labels`} action={<Button size="xs" variant="ghost" onClick={() => navigate('#/documents')}>View all →</Button>} />
              {documents.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-400">
                  No documents yet — open any application and hit “Tailored resume / Cover letter”.
                </p>
              ) : (
                <ul className="space-y-2">
                  {documents
                    .slice()
                    .sort((a, b) => b.created_at - a.created_at)
                    .slice(0, 5)
                    .map((d) => {
                      const app = apps.find((a) => a.id === d.application_id)
                      return (
                        <li key={d.id} className="flex items-center gap-2 text-xs">
                          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/10">{d.type === 'resume' ? '📄' : d.type === 'cover_letter' ? '✉️' : '💡'}</span>
                          <button className="min-w-0 flex-1 truncate text-left font-semibold text-ink-700 dark:text-ink-100 hover:underline" onClick={() => navigate(app ? `#/applications/${app.id}` : '#/documents')}>
                            {app?.company ?? '—'} · {d.type === 'resume' ? 'resume' : d.type === 'cover_letter' ? 'cover letter' : 'answers'} v{d.version}
                          </button>
                          <span className="shrink-0 text-[10px] text-ink-400">{d.provider}</span>
                        </li>
                      )
                    })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyHero({ onDemo }: { onDemo: () => void }) {
  return (
    <Card className="relative overflow-hidden p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-gradient-to-br from-brand-400/20 to-purple-400/10 blur-2xl" />
      <div className="relative">
        <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-purple-500 text-white shadow-lg shadow-brand-500/30">
          <Sparkles className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-ink-900 dark:text-white">From paste to tracked application in under 5 minutes</h2>
        <ol className="mt-3 space-y-2 text-xs text-ink-500 dark:text-ink-300">
          <li className="flex gap-2"><b className="text-brand-600 dark:text-brand-400">1.</b> Paste a job description (or add one manually / import CSV)</li>
          <li className="flex gap-2"><b className="text-brand-600 dark:text-brand-400">2.</b> AI extracts fields & scores your match against your profile</li>
          <li className="flex gap-2"><b className="text-brand-600 dark:text-brand-400">3.</b> Save it — then generate tailored docs with any free AI key</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => navigate('#/analyzer')}>
            <Sparkles className="size-4" /> Analyze first job
          </Button>
          <Button variant="secondary" onClick={() => navigate('#/applications')}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button variant="ghost" onClick={onDemo}>
            <Wand2 className="size-4" /> Explore with demo data
          </Button>
        </div>
        <p className="mt-4 text-[11px] text-ink-400">
          Free forever: data stays in your browser · AI keys optional (Gemini / Groq / OpenRouter free tiers)
        </p>
      </div>
    </Card>
  )
}

function SectionHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-bold text-ink-800 dark:text-ink-100">{title}</h2>
        {subtitle && <p className="text-[11px] text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function StatCard({ icon, label, value, accent, onClick }: { icon: ReactNode; label: string; value: number; accent: string; onClick?: () => void }) {
  return (
    <Card hover className="p-4 cursor-pointer" onClick={onClick}>
      <div className={cn('grid size-9 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm', accent)}>
        {icon}
      </div>
      <p className="mt-2.5 text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">{value}</p>
      <p className="text-[11px] font-semibold text-ink-400">{label}</p>
    </Card>
  )
}

/* ---- little shorthands ---- */
const TODAY_FULL = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const BellOffish = () => <BellOff className="size-4" />

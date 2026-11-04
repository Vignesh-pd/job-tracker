import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn, statusColor } from '../lib/utils'
import { STATUS_LABEL, type AppStatus, type AppDoc, type MatchReport, type Skill } from '../lib/types'
import { X, Loader2 } from 'lucide-react'
import { useStore } from '../store'

/* ---------------- Button ---------------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle'
type BtnSize = 'xs' | 'sm' | 'md' | 'lg'

const btnVariants: Record<BtnVariant, string> = {
  primary:
    'bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30 hover:shadow-md hover:shadow-brand-500/40 hover:brightness-110 active:brightness-95 disabled:from-ink-300 disabled:to-ink-300 disabled:shadow-none dark:disabled:from-ink-700 dark:disabled:to-ink-700',
  secondary:
    'bg-ink-100 text-ink-800 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700 border border-transparent',
  outline:
    'bg-transparent border border-ink-300 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800',
  ghost: 'bg-transparent text-ink-600 hover:bg-ink-200/60 dark:text-ink-300 dark:hover:bg-ink-800/70',
  subtle:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20 border border-brand-100 dark:border-brand-500/20',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/30 active:brightness-95',
}

const btnSizes: Record<BtnSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-fast select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-900',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        btnVariants[variant],
        btnSizes[size],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------------- Inputs ---------------- */

export function Field({ label, hint, children, className }: { label?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 block text-xs font-semibold text-ink-600 dark:text-ink-300">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full h-9.5 px-3 text-sm rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 ' +
  'placeholder:text-ink-400 transition-fast focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 ' +
  'disabled:opacity-50'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, className)} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, 'h-auto min-h-20 py-2 leading-relaxed', className)} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(inputCls, 'appearance-none bg-no-repeat pr-8 cursor-pointer', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.6rem center',
      }}
    >
      {children}
    </select>
  )
}

/* ---------------- Switch ---------------- */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={label}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60',
        checked ? 'bg-emerald-500' : 'bg-ink-300 dark:bg-ink-700',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

/* ---------------- Badge & status ---------------- */

export function Badge({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'brand' | 'gray' | 'green' | 'amber' | 'rose' | 'violet' | 'blue' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 ring-1 ring-brand-100 dark:ring-brand-500/25',
    gray: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', tone ? tones[tone] : tones.gray, className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status, size }: { status: AppStatus; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('inline-flex items-center rounded-full font-semibold whitespace-nowrap', statusColor(status), size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11.5px]')}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

/* ---------------- Card ---------------- */

export function Card({ children, className, hover, onClick }: { children: ReactNode; className?: string; hover?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-ink-200/80 dark:border-ink-800 bg-white/90 dark:bg-ink-900/70 backdrop-blur-sm',
        (hover || onClick) && 'transition-fast hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/5 dark:hover:border-brand-500/40',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold text-ink-800 dark:text-ink-100">{title}</h2>
        {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  children,
  title,
  wide,
  className,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  wide?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8 anim-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={cn(
          'relative w-full anim-pop rounded-2xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl shadow-black/20',
          wide ? 'max-w-4xl' : 'max-w-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-ink-100 dark:border-ink-800 px-5 py-3.5">
          <div className="min-w-0 text-[15px] font-bold text-ink-800 dark:text-white">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition-fast" aria-label="Close">
            <X className="size-4.5" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/* ---------------- Toasts ---------------- */

export function Toaster() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'anim-slide rounded-xl border px-4 py-3 shadow-lg flex items-start gap-3 text-sm bg-white dark:bg-ink-900',
            t.kind === 'success' && 'border-emerald-200 dark:border-emerald-500/30',
            t.kind === 'error' && 'border-rose-200 dark:border-rose-500/30',
            t.kind === 'info' && 'border-brand-200 dark:border-brand-500/30',
          )}
        >
          <span
            className={cn(
              'mt-0.5 size-2 rounded-full shrink-0',
              t.kind === 'success' && 'bg-emerald-500',
              t.kind === 'error' && 'bg-rose-500',
              t.kind === 'info' && 'bg-brand-500',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className={cn('font-semibold', t.kind === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-ink-800 dark:text-ink-100')}>{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400 break-words">{t.message}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Misc ---------------- */

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">{icon}</div>
      <div>
        <p className="text-sm font-bold text-ink-700 dark:text-ink-200">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-xs text-ink-400">{body}</p>}
      </div>
      {action}
    </div>
  )
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-ink-200 dark:stroke-ink-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={6}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-xs font-extrabold text-ink-700 dark:text-ink-100">{Math.round(score)}</span>
    </div>
  )
}

export function SkillChip({ skill, tone }: { skill: Skill | string; tone?: 'match' | 'miss' }) {
  const label = typeof skill === 'string' ? skill : skill.name
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-medium',
        tone === 'match' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
        tone === 'miss' && 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
        !tone && 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
      )}
    >
      {label}
    </span>
  )
}

export function MatchReportBlock({ report }: { report?: MatchReport }) {
  if (!report) return <p className="text-xs text-ink-400">No match analysis yet — open the application and re-analyze.</p>
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <ScoreRing score={report.score} />
        <div className="min-w-0">
          <p className="font-semibold text-ink-700 dark:text-ink-100 text-sm">{report.summary || 'Match summary'}</p>
          <p className="text-[11px] text-ink-400">{report.generated_by ? `Assessed by ${report.generated_by}` : 'Local estimate'}</p>
        </div>
      </div>
      {report.strong_matches?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">Strong matches</p>
          <ul className="space-y-1">
            {report.strong_matches.map((m, i) => (
              <li key={i} className="flex gap-2 text-xs text-ink-600 dark:text-ink-300">
                <span className="text-emerald-500">✓</span>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.missing_skills?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-rose-500">Missing skills</p>
          <div className="flex flex-wrap gap-1.5">
            {report.missing_skills.map((s, i) => (
              <SkillChip key={i} skill={s} tone="miss" />
            ))}
          </div>
        </div>
      )}
      {(report.experience_alignment || report.education_alignment) && (
        <div className="grid gap-2 text-xs text-ink-600 dark:text-ink-300 sm:grid-cols-2">
          {report.experience_alignment && <Card className="p-2.5">{report.experience_alignment}</Card>}
          {report.education_alignment && <Card className="p-2.5">{report.education_alignment}</Card>}
        </div>
      )}
    </div>
  )
}

/* confirm dialog */
export function Confirm({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-md">
      <p className="text-sm text-ink-500 dark:text-ink-300">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

/* simple doc exporter */
export function docFileName(doc: AppDoc): string {
  const ext = doc.type === 'resume' ? 'resume' : doc.type === 'cover_letter' ? 'cover-letter' : doc.type === 'answers' ? 'answers' : doc.type
  return `${ext}-v${doc.version}-${doc.created_at}.md`.toLowerCase().replace(/[^a-z0-9.\-]+/g, '-')
}

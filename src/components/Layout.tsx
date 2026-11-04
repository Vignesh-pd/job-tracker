import type { ReactNode } from 'react'
import { useState } from 'react'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import { navigate, useRoute } from '../lib/router'
import {
  LayoutDashboard, ClipboardList, Wand2, FileText, UserRound, Settings2, Sun, Moon,
} from 'lucide-react'

const NAV: { id: string; label: string; icon: ReactNode; hash: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4.5" />, hash: '#/dashboard' },
  { id: 'applications', label: 'Applications', icon: <ClipboardList className="size-4.5" />, hash: '#/applications' },
  { id: 'analyzer', label: 'New Application', icon: <Wand2 className="size-4.5" />, hash: '#/analyzer' },
  { id: 'documents', label: 'Documents', icon: <FileText className="size-4.5" />, hash: '#/documents' },
  { id: 'profile', label: 'Profile', icon: <UserRound className="size-4.5" />, hash: '#/profile' },
  { id: 'settings', label: 'Settings', icon: <Settings2 className="size-4.5" />, hash: '#/settings' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { profile, settings, setTheme } = useStore()
  const [route] = useRoute()
  const [mobileOpen, setMobileOpen] = useState(false)
  void profile

  const active = route.name === 'application' ? 'applications' : route.name

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            navigate(item.hash)
            setMobileOpen(false)
          }}
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-fast',
            active === item.id
              ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25'
              : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100',
          )}
        >
          <span className={cn('shrink-0', active !== item.id && 'text-ink-400 group-hover:text-brand-500 dark:group-hover:text-brand-400')}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="flex h-full app-bg">
      {/* ---- desktop sidebar ---- */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-ink-200/70 dark:border-ink-800 bg-white/70 dark:bg-ink-900/60 backdrop-blur-xl">
        <Logo />
        {nav}
        <div className="mt-auto p-4 space-y-3">
          <button
            onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800 transition-fast"
          >
            {settings.theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <AiFooter />
        </div>
      </aside>

      {/* ---- mobile: top bar ---- */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex h-14 items-center justify-between border-b border-ink-200/70 dark:border-ink-800 bg-white/80 dark:bg-ink-900/80 backdrop-blur-xl px-4">
        <Logo compact />
        <div className="flex items-center gap-1">
          <button onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')} className="rounded-lg p-2 text-ink-500 dark:text-ink-300">
            {settings.theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
          </button>
          <button onClick={() => setMobileOpen((v) => !v)} className="rounded-lg p-2 text-ink-500 dark:text-ink-300" aria-label="Menu">
            <MenuIcon />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-30 anim-fade" onClick={() => setMobileOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="mx-3 mt-3 rounded-2xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl">
            {nav}
          </div>
        </div>
      )}
      {/* ---- content ---- */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  )
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', compact ? 'py-0.5' : 'px-5 pt-5 pb-3')}>
      <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-purple-500 shadow-md shadow-brand-500/30">
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-white" strokeWidth={2} strokeLinecap="round">
          <path d="M6 8h12M6 12h12M6 16h6" />
          <circle cx="17" cy="17" r="2.6" className="fill-white stroke-transparent" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-extrabold tracking-tight text-ink-900 dark:text-white">
          Job<span className="text-brand-600 dark:text-brand-400">Pilot</span>
        </p>
        {!compact && <p className="text-[10px] font-medium text-ink-400">Personal job-search copilot</p>}
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

function AiFooter() {
  const { hasAi } = useStore()
  return (
    <div className="rounded-xl bg-ink-100/70 dark:bg-ink-800/60 px-3 py-2.5 text-[10.5px] leading-relaxed text-ink-400">
      <span className={cn('font-bold', hasAi ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-500 dark:text-ink-300')}>
        {hasAi ? '● AI ready' : '○ AI: not configured'}
      </span>
      <br />
      Data lives in this browser only — export backups from Settings.
    </div>
  )
}

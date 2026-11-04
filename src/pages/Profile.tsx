import { useEffect, useMemo, useRef, useState } from 'react'
import type { Profile } from '../lib/types'
import { useStore } from '../store'
import { Button, Card, Field, Input, Select, Textarea, SectionHeader } from '../components/ui'
import { blankCert, blankEducation, blankExperience, blankProject } from '../lib/db'
import { copyText, downloadBlob, debounce } from '../lib/utils'
import { profilePromptJson } from '../lib/ai/tasks'
import { BadgeCheck, Sparkles, Trash2, Download, Plus, Eye } from 'lucide-react'

const SKILL_CATEGORIES = ['Languages', 'Databases', 'Data Engineering', 'Data Science', 'AI & LLM', 'Cloud & DevOps', 'Visualisation', 'Business', 'Other']
const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const

export function ProfilePage() {
  const { profile, saveProfile, toast, hasAi } = useStore()
  const [draft, setDraft] = useState<Profile>(profile)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const afterInit = useRef(false)

  // keep draft in sync when store reloads (import/backup)
  useEffect(() => {
    if (profile.updated_at !== draft.updated_at) setDraft(profile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.updated_at])

  const push = useMemo(
    () =>
      debounce(async (p: Profile) => {
        await saveProfile(p)
        setSavedAt(new Date().toLocaleTimeString())
      }, 700),
    [saveProfile],
  )

  const set = (patch: Partial<Profile>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (afterInit.current) push(next)
  }
  useEffect(() => {
    afterInit.current = true
  }, [])

  const exportProfileJson = () => {
    downloadBlob(JSON.stringify(profilePromptJson(draft), null, 2), 'profile-ai-payload.json', 'application/json')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">Master profile</h1>
          <p className="text-xs text-ink-400 mt-0.5">
            The single source of truth for every generated document. Facts-free policy: the AI may only rephrase what's here.
            {savedAt && <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><BadgeCheck className="size-3.5" />Saved {savedAt}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { void copyText(JSON.stringify(profilePromptJson(draft), null, 2)); toast('success', 'Profile JSON copied', 'Paste it into any chat with an AI to tailor documents manually.') }}>
            <Eye className="size-3.5" /> Copy AI payload
          </Button>
          <Button variant="secondary" size="sm" onClick={exportProfileJson}>
            <Download className="size-3.5" /> .json
          </Button>
        </div>
      </div>

      {/* personal */}
      <Card className="p-5">
        <SectionHeader title="Personal" subtitle="Name block used on letters and resumes" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input value={draft.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder="Your name" /></Field>
          <Field label="Location"><Input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="Berlin, Germany" /></Field>
          <Field label="Email"><Input value={draft.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" /></Field>
          <Field label="Phone"><Input value={draft.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <Field label="LinkedIn"><Input value={draft.links.linkedin} onChange={(e) => set({ links: { ...draft.links, linkedin: e.target.value } })} placeholder="linkedin.com/in/…" /></Field>
          <Field label="GitHub"><Input value={draft.links.github} onChange={(e) => set({ links: { ...draft.links, github: e.target.value } })} placeholder="github.com/…" /></Field>
          <Field label="Portfolio"><Input value={draft.links.portfolio} onChange={(e) => set({ links: { ...draft.links, portfolio: e.target.value } })} placeholder="yoursite.dev" /></Field>
        </div>
        <Field label="Professional summary" className="mt-3" hint={`${draft.summary.length} chars`}>
          <Textarea value={draft.summary} onChange={(e) => set({ summary: e.target.value })} className="min-h-20" placeholder="What you do, years, specialisation, targets — the tone anchor for letters." />
        </Field>
      </Card>

      {/* skills */}
      <Card className="p-5">
        <SectionHeader title="Skills" subtitle="Weighted heavily by the local scorer and the AI matcher" action={
          <Button variant="subtle" size="xs" onClick={() => set({ skills: [...draft.skills, { name: '', category: SKILL_CATEGORIES[0], level: 'intermediate' }] })}>
            <Plus className="size-3" /> Add skill
          </Button>
        } />
        <div className="space-y-2">
          {draft.skills.map((s, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-5" value={s.name} placeholder="Skill, e.g. Python" onChange={(e) => set({ skills: draft.skills.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)) })} />
              <Select className="col-span-4" value={s.category} onChange={(e) => set({ skills: draft.skills.map((x, ix) => (ix === i ? { ...x, category: e.target.value } : x)) })}>
                {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select className="col-span-2" value={s.level} onChange={(e) => set({ skills: draft.skills.map((x, ix) => (ix === i ? { ...x, level: e.target.value as (typeof LEVELS)[number] } : x)) })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
              <button className="col-span-1 justify-self-center text-ink-300 hover:text-rose-500 transition-fast" onClick={() => set({ skills: draft.skills.filter((_, ix) => ix !== i) })} aria-label="Remove skill">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {!draft.skills.length && <p className="text-xs text-ink-400">No skills yet — add at least 10 for reliable matching.</p>}
        </div>
      </Card>

      {/* experience */}
      <Card className="p-5">
        <SectionHeader title="Experience" subtitle="Bullets one per line — numbers get the interviews" action={
          <Button variant="subtle" size="xs" onClick={() => set({ experience: [...draft.experience, blankExperience()] })}>
            <Plus className="size-3" /> Add role
          </Button>
        } />
        <div className="space-y-3">
          {draft.experience.map((e, i) => (
            <Card key={e.id} className="border-ink-100 dark:border-ink-800 p-4" hover>
              <div className="grid gap-2 sm:grid-cols-12">
                <Input className="sm:col-span-4" placeholder="Company" value={e.company} onChange={(ev) => set({ experience: draft.experience.map((x, ix) => (ix === i ? { ...x, company: ev.target.value } : x)) })} />
                <Input className="sm:col-span-4" placeholder="Job title" value={e.title} onChange={(ev) => set({ experience: draft.experience.map((x, ix) => (ix === i ? { ...x, title: ev.target.value } : x)) })} />
                <Input className="sm:col-span-2" placeholder="Start (2023-06)" value={e.start} onChange={(ev) => set({ experience: draft.experience.map((x, ix) => (ix === i ? { ...x, start: ev.target.value } : x)) })} />
                <Input className="sm:col-span-1" placeholder="End" value={e.end} onChange={(ev) => set({ experience: draft.experience.map((x, ix) => (ix === i ? { ...x, end: ev.target.value } : x)) })} />
                <button className="sm:col-span-1 justify-self-end text-ink-300 hover:text-rose-500" onClick={() => set({ experience: draft.experience.filter((_, ix) => ix !== i) })}>
                  <Trash2 className="size-4" />
                </button>
              </div>
              <Textarea className="mt-2 min-h-16" placeholder="Achievement bullets — one per line" value={e.bullets.join('\n')} onChange={(ev) => set({ experience: draft.experience.map((x, ix) => (ix === i ? { ...x, bullets: ev.target.value.split('\n') } : x)) })} />
              <Input className="mt-2" placeholder="Technologies (comma separated)" value={e.technologies.join(', ')} onChange={(ev) => set({ experience: draft.experience.map((x, ix) => (ix === i ? { ...x, technologies: ev.target.value.split(',').map((t) => t.trim()) } : x)) })} />
            </Card>
          ))}
          {!draft.experience.length && <p className="text-xs text-ink-400">Add your roles — resumes are built from these bullets.</p>}
        </div>
      </Card>

      {/* education */}
      <Card className="p-5">
        <SectionHeader title="Education" action={
          <Button variant="subtle" size="xs" onClick={() => set({ education: [...draft.education, blankEducation()] })}><Plus className="size-3" /> Add degree</Button>
        } />
        <div className="space-y-3">
          {draft.education.map((e, i) => (
            <div key={e.id} className="grid gap-2 sm:grid-cols-12 items-center">
              <Input className="sm:col-span-5" placeholder="Degree / programme" value={e.degree} onChange={(ev) => set({ education: draft.education.map((x, ix) => (ix === i ? { ...x, degree: ev.target.value } : x)) })} />
              <Input className="sm:col-span-3" placeholder="Institution" value={e.institution} onChange={(ev) => set({ education: draft.education.map((x, ix) => (ix === i ? { ...x, institution: ev.target.value } : x)) })} />
              <Input className="sm:col-span-2" placeholder="Start" value={e.start} onChange={(ev) => set({ education: draft.education.map((x, ix) => (ix === i ? { ...x, start: ev.target.value } : x)) })} />
              <Input className="sm:col-span-1" placeholder="End" value={e.end} onChange={(ev) => set({ education: draft.education.map((x, ix) => (ix === i ? { ...x, end: ev.target.value } : x)) })} />
              <button className="sm:col-span-1 justify-self-center text-ink-300 hover:text-rose-500" onClick={() => set({ education: draft.education.filter((_, ix) => ix !== i) })}><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      </Card>

      {/* certifications & projects & languages in one row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Certifications" action={<Button variant="subtle" size="xs" onClick={() => set({ certifications: [...draft.certifications, blankCert()] })}><Plus className="size-3" /> Add</Button>} />
          <div className="space-y-2">
            {draft.certifications.map((c, i) => (
              <div key={c.id} className="grid grid-cols-12 gap-2">
                <Input className="col-span-5" placeholder="Name" value={c.name} onChange={(ev) => set({ certifications: draft.certifications.map((x, ix) => (ix === i ? { ...x, name: ev.target.value } : x)) })} />
                <Input className="col-span-4" placeholder="Issuer" value={c.issuer} onChange={(ev) => set({ certifications: draft.certifications.map((x, ix) => (ix === i ? { ...x, issuer: ev.target.value } : x)) })} />
                <Input className="col-span-2" placeholder="Date" value={c.date} onChange={(ev) => set({ certifications: draft.certifications.map((x, ix) => (ix === i ? { ...x, date: ev.target.value } : x)) })} />
                <button className="col-span-1 justify-self-center text-ink-300 hover:text-rose-500" onClick={() => set({ certifications: draft.certifications.filter((_, ix) => ix !== i) })}><Trash2 className="size-4" /></button>
              </div>
            ))}
            {!draft.certifications.length && <p className="text-xs text-ink-400">None yet.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Projects" action={<Button variant="subtle" size="xs" onClick={() => set({ projects: [...draft.projects, blankProject()] })}><Plus className="size-3" /> Add</Button>} />
          <div className="space-y-3">
            {draft.projects.map((p, i) => (
              <div key={p.id}>
                <div className="grid grid-cols-12 gap-2">
                  <Input className="col-span-5" placeholder="Project name" value={p.name} onChange={(ev) => set({ projects: draft.projects.map((x, ix) => (ix === i ? { ...x, name: ev.target.value } : x)) })} />
                  <Input className="col-span-4" placeholder="Link (optional)" value={p.link} onChange={(ev) => set({ projects: draft.projects.map((x, ix) => (ix === i ? { ...x, link: ev.target.value } : x)) })} />
                  <button className="col-span-1 justify-self-center text-ink-300 hover:text-rose-500" onClick={() => set({ projects: draft.projects.filter((_, ix) => ix !== i) })}><Trash2 className="size-4" /></button>
                </div>
                <Textarea className="mt-2 min-h-12" placeholder="One line on what it is / impact" value={p.description} onChange={(ev) => set({ projects: draft.projects.map((x, ix) => (ix === i ? { ...x, description: ev.target.value } : x)) })} />
              </div>
            ))}
            {!draft.projects.length && <p className="text-xs text-ink-400">None yet.</p>}
          </div>
        </Card>
      </div>

      {/* languages */}
      <Card className="p-5">
        <SectionHeader title="Languages" subtitle="Comma separated — mention level in brackets" />
        <Input value={draft.languages.join(', ')} onChange={(e) => set({ languages: e.target.value ? e.target.value.split(/,\s*/) : [] })} placeholder="English (fluent), German (C1)" />
      </Card>

      {/* master resume */}
      <Card className="p-5">
        <SectionHeader title="Master resume (optional but powerful)" subtitle="Paste your full plain-text resume — the tailoring task uses it to stay faithful to original wording" />
        <Textarea value={draft.master_resume} onChange={(e) => set({ master_resume: e.target.value })} className="min-h-44 font-mono text-[12.5px]" />
      </Card>

      {!hasAi && (
        <Card className="border-brand-200/70 bg-brand-50/50 dark:border-brand-500/20 dark:bg-brand-500/5 p-4 text-xs text-brand-800 dark:text-brand-200 flex items-start gap-2">
          <Sparkles className="size-4 shrink-0 mt-0.5" />
          With at least one AI provider configured, this profile is sent (facts only) to tailor resumes, write cover letters and explain match scores — see Settings → AI Providers.
        </Card>
      )}
    </div>
  )
}

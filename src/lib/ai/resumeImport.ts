import { generateJson } from './client'
import { SKILL_LEVELS, type SkillLevel, AIError, type Profile, type ProviderRow } from '../types'
import type { ZodType } from 'zod'
import { heuristicExtract, type ResumeExtract } from '../files'
import { uid } from '../utils'

/* ---------------- AI extraction (uses the user's own provider, routed to `resume_import`) ---------------- */

const asLevel = (v: unknown): SkillLevel => (SKILL_LEVELS.includes(String(v ?? '').toLowerCase() as SkillLevel) ? (String(v ?? '').toLowerCase() as SkillLevel) : 'intermediate')

const CATEGORIES = ['Languages', 'Databases', 'Data Engineering', 'Data Science', 'AI & LLM', 'Cloud & DevOps', 'Visualisation', 'Business', 'Other']
const asCategory = (v: unknown): string => {
  const s = String(v ?? '').trim()
  return CATEGORIES.find((c) => c.toLowerCase() === s.toLowerCase()) ?? (s ? 'Other' : 'Other')
}

const RESUME_SYSTEM = `You parse a candidate's RESUME into a structured JSON profile. THEORY OF OPERATION: the text may be garbled by PDF extraction (broken columns, missing line breaks) — interpret sensibly, but NEVER invent content that is not in the resume. Copy facts verbatim where possible.

Return ONLY a JSON object with exactly these keys:
- full_name, email, phone, location (strings, "" when absent)
- links: object { linkedin, github, portfolio } (strings — include the full URL as written; portfolio = personal website/blog; "" when absent)
- summary (string): their own professional summary/profile section condensed to 1-3 sentences; "" when absent
- skills (array of {"name": string, "level": "beginner"|"intermediate"|"advanced"|"expert", "category": string}): one entry per distinct skill or technology. Use the stated proficiency level only if the resume states one ("expert", "native", "fluent"→ level when the skill is a language; default "intermediate"). Category must be exactly one of: "Languages", "Databases", "Data Engineering", "Data Science", "AI & LLM", "Cloud & DevOps", "Visualisation", "Business", "Other"
- experience (array of {"company", "title", "start", "end": strings, "bullets": string[], "technologies": string[]}): newest first when order is known. Dates as written ("2021-06", "Jun 2021"); "Present" stays "Present". bullets = achievement lines WITHOUT bullet characters. technologies = tools/stacks listed for that role.
- education (array of {"degree", "institution", "start", "end", "details": strings})
- certifications (array of {"name", "issuer", "date": strings})
- projects (array of {"name", "description", "technologies": string[], "link": strings})
- languages (string[]): spoken/human languages as written, e.g. "English (fluent)"`

export async function runResumeImport(cfg: ProviderRow, resumeText: string): Promise<{ data: ResumeExtract; label: string }> {
  const JobSchema = await import('zod')
  const z = JobSchema.z
  const Schema = z.object({
    full_name: z.string().catch(''),
    email: z.string().catch(''),
    phone: z.string().catch(''),
    location: z.string().catch(''),
    links: z.object({ linkedin: z.string().catch(''), github: z.string().catch(''), portfolio: z.string().catch('') }).catch({ linkedin: '', github: '', portfolio: '' }),
    summary: z.string().catch(''),
    skills: z.array(z.object({ name: z.string().catch(''), level: z.string().catch('intermediate'), category: z.string().catch('Other') })).catch([]),
    experience: z
      .array(
        z.object({
          company: z.string().catch(''),
          title: z.string().catch(''),
          start: z.string().catch(''),
          end: z.string().catch(''),
          bullets: z.array(z.string()).catch([]),
          technologies: z.array(z.string()).catch([]),
        }),
      )
      .catch([]),
    education: z.array(z.object({ degree: z.string().catch(''), institution: z.string().catch(''), start: z.string().catch(''), end: z.string().catch(''), details: z.string().catch('') })).catch([]),
    certifications: z.array(z.object({ name: z.string().catch(''), issuer: z.string().catch(''), date: z.string().catch('') })).catch([]),
    projects: z.array(z.object({ name: z.string().catch(''), description: z.string().catch(''), technologies: z.array(z.string()).catch([]), link: z.string().catch('') })).catch([]),
    languages: z.array(z.string()).catch([]),
  })
  const user = `Parse this resume text into the JSON profile:\n\n"""\n${resumeText.slice(0, 24000)}\n"""`
  const gen = await generateJson<ResumeExtract>(
    'resume_import',
    cfg,
    RESUME_SYSTEM,
    user,
    Schema as unknown as ZodType<ResumeExtract>, // levels/categories are normalised after parsing, so the raw string schema is fine
    { temperature: 0.1, maxTokens: 6000 },
  )
  // normalise (levels/categories, trimmed empties)
  const d = gen.data
  return {
    data: {
      ...d,
      skills: (d.skills ?? []).filter((s) => s?.name?.trim()).map((s) => ({ name: s.name.trim(), level: asLevel(s.level), category: asCategory(s.category) })),
      experience: (d.experience ?? []).filter((e) => e?.company?.trim() || e?.title?.trim()),
      education: (d.education ?? []).filter((e) => e?.degree?.trim() || e?.institution?.trim()),
      certifications: (d.certifications ?? []).filter((c) => c?.name?.trim()),
      projects: (d.projects ?? []).filter((p) => p?.name?.trim()),
      languages: (d.languages ?? []).filter(Boolean),
    },
    label: gen.label,
  }
}

/** AI first; on any failure, fall back to the local regex extractor */
export async function extractResumeSafe(
  cfg: ProviderRow | undefined,
  text: string,
): Promise<{ data: ResumeExtract; label: string; usedAi: boolean; error?: string }> {
  if (cfg) {
    try {
      const r = await runResumeImport(cfg, text)
      return { data: r.data, label: r.label, usedAi: true }
    } catch (e) {
      const msg = e instanceof AIError ? e.message : (e as Error).message
      return { data: heuristicExtract(text), label: 'Local extraction (no AI)', usedAi: false, error: msg }
    }
  }
  return { data: heuristicExtract(text), label: 'Local extraction (no AI)', usedAi: false }
}

/* ---------------- merge extracted data into the existing profile ---------------- */

const key = (s: string) => s.trim().toLowerCase()

export interface MergeResult {
  profile: Profile
  added: string[]
}

export function mergeExtractIntoProfile(draft: Profile, ex: ResumeExtract, resumeText: string): MergeResult {
  const added: string[] = []

  const firstName = !draft.full_name.trim() && ex.full_name.trim()
  if (firstName) added.push('name')
  const firstEmail = !draft.email.trim() && ex.email.trim()
  if (firstEmail) added.push('email')
  const firstPhone = !draft.phone.trim() && ex.phone.trim()
  if (firstPhone) added.push('phone')
  const firstLocation = !draft.location.trim() && ex.location.trim()
  if (firstLocation) added.push('location')
  const firstSummary = !draft.summary.trim() && ex.summary.trim()
  if (firstSummary) added.push('summary')

  const nextLinks = {
    linkedin: draft.links.linkedin.trim() || ex.links.linkedin.trim(),
    github: draft.links.github.trim() || ex.links.github.trim(),
    portfolio: draft.links.portfolio.trim() || ex.links.portfolio.trim(),
  }
  let linksAdded = 0
  for (const k of ['linkedin', 'github', 'portfolio'] as const) {
    if (!draft.links[k].trim() && nextLinks[k]) linksAdded++
  }
  if (linksAdded) added.push(linksAdded === 1 ? '1 link' : `${linksAdded} links`)

  // skills — de-duped by name
  const have = new Set(draft.skills.map((s) => key(s.name)))
  const newSkills = ex.skills.filter((s) => s.name.trim() && !have.has(key(s.name)))
  if (newSkills.length) added.push(`${newSkills.length} skill${newSkills.length === 1 ? '' : 's'}`)

  // experience — de-duped by company+title; bullets merged into existing entries
  let newRoles = 0
  let mergedBullets = 0
  const experience = draft.experience.map((e) => ({ ...e }))
  for (const e of ex.experience) {
    const match = experience.find((x) => key(x.company) === key(e.company) && key(x.title) === key(e.title))
    if (match) {
      const haveB = new Set(match.bullets.map(key))
      const addB = e.bullets.filter((b) => b.trim() && !haveB.has(key(b)))
      if (addB.length) {
        match.bullets = [...match.bullets, ...addB]
        mergedBullets += addB.length
      }
    } else if (e.company.trim() || e.title.trim()) {
      experience.push({ id: uid(), company: e.company.trim(), title: e.title.trim(), start: e.start.trim(), end: e.end.trim(), bullets: e.bullets.filter((b) => b.trim()), technologies: e.technologies.filter(Boolean) })
      newRoles++
    }
  }
  if (newRoles) added.push(`${newRoles} role${newRoles === 1 ? '' : 's'}`)
  if (mergedBullets) added.push(`${mergedBullets} bullet${mergedBullets === 1 ? '' : 's'}`)

  // education — de-duped by degree+institution
  const haveEdu = new Set(draft.education.map((e) => key(e.degree) + '|' + key(e.institution)))
  const newEdu = ex.education.filter((e) => (e.degree.trim() || e.institution.trim()) && !haveEdu.has(key(e.degree) + '|' + key(e.institution)))
  if (newEdu.length) added.push(`${newEdu.length} degree${newEdu.length === 1 ? '' : 's'}`)

  // certifications / projects / languages
  const haveCert = new Set(draft.certifications.map((c) => key(c.name)))
  const newCerts = ex.certifications.filter((c) => c.name.trim() && !haveCert.has(key(c.name)))
  if (newCerts.length) added.push(`${newCerts.length} cert${newCerts.length === 1 ? '' : 's'}`)

  const haveProj = new Set(draft.projects.map((p) => key(p.name)))
  const newProj = ex.projects.filter((p) => p.name.trim() && !haveProj.has(key(p.name)))
  if (newProj.length) added.push(`${newProj.length} project${newProj.length === 1 ? '' : 's'}`)

  const haveLang = new Set(draft.languages.map(key))
  const newLangs = ex.languages.filter((l) => l.trim() && !haveLang.has(key(l)))
  if (newLangs.length) added.push(`${newLangs.length} language${newLangs.length === 1 ? '' : 's'}`)

  // master resume text (never overwrite existing)
  const firstResume = !draft.master_resume.trim() && resumeText.trim()
  if (firstResume) added.push('master resume text')

  return {
    profile: {
      ...draft,
      full_name: firstName || draft.full_name,
      email: firstEmail || draft.email,
      phone: firstPhone || draft.phone,
      location: firstLocation || draft.location,
      links: nextLinks,
      summary: firstSummary || draft.summary,
      skills: [...draft.skills, ...newSkills],
      experience,
      education: [...draft.education, ...newEdu.map((e) => ({ id: uid(), degree: e.degree.trim(), institution: e.institution.trim(), start: e.start.trim(), end: e.end.trim(), details: e.details.trim() }))],
      certifications: [...draft.certifications, ...newCerts.map((c) => ({ id: uid(), name: c.name.trim(), issuer: c.issuer.trim(), date: c.date.trim() }))],
      projects: [...draft.projects, ...newProj.map((p) => ({ id: uid(), name: p.name.trim(), description: p.description.trim(), technologies: p.technologies.filter(Boolean), link: p.link.trim() }))],
      languages: [...draft.languages, ...newLangs.map((l) => l.trim())],
      master_resume: firstResume || draft.master_resume,
      updated_at: Date.now(),
    },
    added,
  }
}

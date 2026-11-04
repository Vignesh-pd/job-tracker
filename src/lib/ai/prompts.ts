import type { Job, Profile } from '../types'

/* ================= compact profile/job JSON for prompts (pure — no zod, no AI deps) ================= */

export function profilePromptJson(p: Profile, opts?: { includeResume?: boolean }) {
  return {
    personal: { full_name: p.full_name, location: p.location, email: p.email, phone: p.phone },
    links: p.links,
    summary: p.summary,
    skills: p.skills.map((s) => ({ name: s.name, category: s.category, level: s.level })),
    experience: p.experience.map((e) => ({
      company: e.company, title: e.title, start: e.start, end: e.end, technologies: e.technologies, bullets: e.bullets,
    })),
    education: p.education,
    certifications: p.certifications,
    projects: p.projects,
    languages: p.languages,
    ...(opts?.includeResume ? { master_resume: p.master_resume.slice(0, 12000) } : {}),
  }
}

export function jobPromptJson(j: Job) {
  return {
    title: j.title,
    company: j.company,
    location: j.location,
    employment_type: j.employment_type,
    required_skills: j.required_skills,
    preferred_skills: j.preferred_skills,
    keywords: j.keywords,
    responsibilities: j.responsibilities,
    education: j.education,
    experience_years: j.experience_years,
  }
}

import type { Job, MatchReport, Profile } from './types'

/**
 * Provider-independent skill-overlap scorer. Used as fallback when no AI is
 * configured and as the "pre-computed overlap" hint passed to the LLM matcher.
 */
function normSkill(s: string): string {
  return s.trim().toLowerCase().replace(/[+.#]/g, (c) => c) // keep c++/c#/f# intact, drop dots
}

function contains(profileSkills: string[], target: string): boolean {
  const t = normSkill(target)
  if (!t) return false
  return profileSkills.some((p) => {
    const n = normSkill(p)
    if (!n) return false
    return n === t || n.includes(t) || t.includes(n)
  })
}

export interface Overlap {
  matchedRequired: string[]
  matchedPreferred: string[]
  missingRequired: string[]
  missingPreferred: string[]
  score: number
  hasProfileSkills: boolean
}

export function computeOverlap(profile: Profile, job: Job): Overlap {
  const ps = profile.skills.map((s) => s.name)
  const master = profile.master_resume
  const hits = (list: string[]): [string[], string[]] => {
    const matched: string[] = []
    const missing: string[] = []
    for (const item of list) {
      if (contains(ps, item) || (master && normSkill(master).includes(normSkill(item)))) matched.push(item)
      else missing.push(item)
    }
    return [matched, missing]
  }
  const [matchedRequired, missingRequired] = hits(job.required_skills ?? [])
  const [matchedPreferred, missingPreferred] = hits(job.preferred_skills ?? [])
  const hasProfileSkills = ps.length > 0
  const reqCov = job.required_skills?.length ? matchedRequired.length / job.required_skills.length : matchedRequired.length ? 0.9 : 0.6
  const prefCov = job.preferred_skills?.length ? matchedPreferred.length / job.preferred_skills.length : matchedPreferred.length ? 0.9 : 0.7
  // graceful middle ground when the JD lists no skills at all
  const score = hasProfileSkills
    ? Math.round(100 * (0.7 * reqCov + 0.3 * prefCov))
    : 0
  return { matchedRequired, matchedPreferred, missingRequired, missingPreferred, score, hasProfileSkills }
}

export function overlapToReport(overlap: Overlap, job: Job, profile: Profile): MatchReport {
  return {
    score: overlap.score,
    strong_matches: [
      ...(overlap.matchedRequired.length
        ? [`Matched ${overlap.matchedRequired.length}/${job.required_skills?.length || 0} required skills: ${overlap.matchedRequired.join(', ')}`]
        : []),
      ...(overlap.matchedPreferred.length ? [`Preferred skills matched: ${overlap.matchedPreferred.join(', ')}`] : []),
      ...(profile.experience.length
        ? [`${profile.experience.length} role(s) on record: ${profile.experience.map((e) => e.title).filter(Boolean).slice(0, 3).join(', ')}`]
        : []),
    ],
    missing_skills: [...overlap.missingRequired, ...overlap.missingPreferred],
    experience_alignment: profile.experience.length
      ? 'Estimated from your profile roles (no AI configured — add one in Settings for a deeper explanation).'
      : 'Add your experience in the Profile page for better alignment checks.',
    education_alignment: profile.education.length
      ? `Profile lists ${profile.education.length} entry/entries. Job asks: ${job.education || 'not specified'}.`
      : `Job asks: ${job.education || 'not specified'}.`,
    summary: !overlap.hasProfileSkills
      ? 'Add skills to your profile to unlock reliable local scoring.'
      : `Local estimate — ${Math.round(overlap.score)}% skill coverage. Configure an AI provider for a recruiter-grade explanation.`,
    generated_by: 'Local scorer',
  }
}

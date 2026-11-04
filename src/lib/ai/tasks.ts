import { generateJson, generateText } from './client'
import { profilePromptJson, jobPromptJson } from './prompts'
import type { Job, MatchReport, Profile, ProviderRow } from '../types'

/* zod is loaded on demand so it stays out of the first-load bundle */
type Z = typeof import('zod').z
function loadZod(): Promise<{ z: Z }> {
  return import('zod')
}

/* ================= extracted shapes ================= */

export interface JobExtraction {
  title: string
  company: string
  location: string
  employment_type: string
  required_skills: string[]
  preferred_skills: string[]
  keywords: string[]
  responsibilities: string[]
  education: string
  experience_years: string
}

export interface MatchReportAI {
  score: number
  strong_matches: string[]
  missing_skills: string[]
  experience_alignment: string
  education_alignment: string
  summary: string
}

export interface Answers {
  answers: { question: string; answer: string }[]
}

/* ================= task prompts (provider-neutral) ================= */

const EXTRACTION_SYSTEM = `You are a precise recruitment-data extraction engine. You read raw job descriptions and return strictly structured data. Copy text units (skills, titles) verbatim from the description. If a field is not present in the text, return "" or []. Never invent values.

Return ONLY a JSON object with exactly these keys:
- title (string) job title
- company (string)
- location (string)
- employment_type (string) e.g. "Full-time", "Part-time", "Internship", "Contract"
- required_skills (string[]) must-have skills/technologies/tools, verbatim, lowercase-normalised only if casing differs
- preferred_skills (string[]) nice-to-have skills
- keywords (string[]) important concepts, buzzwords, domain terms worth matching a CV against
- responsibilities (string[]) key responsibilities, one sentence each, max 10
- education (string) education requirements in one line
- experience_years (string) experience requirement in one line, e.g. "2-4 years"`

export async function runExtraction(cfg: ProviderRow, jobDescription: string): Promise<{ data: JobExtraction; label: string }> {
  const { z } = await loadZod()
  const Schema = z.object({
    title: z.string().catch(''),
    company: z.string().catch(''),
    location: z.string().catch(''),
    employment_type: z.string().catch(''),
    required_skills: z.array(z.string()).catch([]),
    preferred_skills: z.array(z.string()).catch([]),
    keywords: z.array(z.string()).catch([]),
    responsibilities: z.array(z.string()).catch([]),
    education: z.string().catch(''),
    experience_years: z.string().catch(''),
  })
  const user = `Extract the structured data from this job description:\n\n"""\n${jobDescription.slice(0, 24000)}\n"""`
  return generateJson<JobExtraction>('extraction', cfg, EXTRACTION_SYSTEM, user, Schema, { temperature: 0.1, maxTokens: 4096 })
}

const MATCH_SYSTEM = `You are an expert technical recruiter scoring how well a candidate's profile matches one job. Judge honestly — a mismatch should score low. Base EVERY claim only on facts present in the provided profile and job data; never invent skills or experience.

Return ONLY a JSON object with exactly these keys:
- score (integer 0-100): weighted blend — skill coverage (60%), experience fit (25%), education/other fit (15%). Round.
- strong_matches (string[]): 3-8 bullet strings, each "overlap reason" like "Python — required, 'advanced' in profile" or "3 years data engineering mirrors the 2-4 years asked"
- missing_skills (string[]): required or preferred skills absent from the profile
- experience_alignment (string): one or two sentences comparing required experience with actual experience
- education_alignment: (string) one or two sentences
- summary (string): verdict in at most 3 sentences, objective, actionable`

export async function runMatching(
  cfg: ProviderRow,
  profile: Profile,
  job: Job,
  localOverlap: { matchedRequired: string[]; matchedPreferred: string[]; missingRequired: string[]; missingPreferred: string[]; score: number },
): Promise<{ data: MatchReport; label: string }> {
  const { z } = await loadZod()
  const Schema = z.object({
    score: z.number().min(0).max(100).catch(0),
    strong_matches: z.array(z.string()).catch([]),
    missing_skills: z.array(z.string()).catch([]),
    experience_alignment: z.string().catch(''),
    education_alignment: z.string().catch(''),
    summary: z.string().catch(''),
  })
  const user = `CANDIDATE PROFILE (JSON):\n${JSON.stringify(profilePromptJson(profile))}\n\nJOB (JSON):\n${JSON.stringify(jobPromptJson(job))}\n\nPRE-COMPUTED SKILL OVERLAP (help, not the whole answer): ${JSON.stringify(localOverlap)}`
  const gen = await generateJson<MatchReportAI>('matching', cfg, MATCH_SYSTEM, user, Schema, { temperature: 0.2, maxTokens: 2500 })
  return { data: { ...gen.data, generated_by: gen.label }, label: gen.label }
}

const RESUME_SYSTEM = `You rewrite candidates' resumes, tailored to one specific job. Absolute rules:
1. Use ONLY facts explicitly present in the candidate profile. NEVER invent employers, job titles, dates, degrees, certifications, technologies or numbers.
2. If a skill is not in the profile, do NOT claim it. You may rephrase and re-emphasise existing facts to target the job.
3. Keep it to ONE page equivalent of text (≈350-550 words), ATS-friendly: no tables, no multi-column, no images.
4. Structure: name and contact line, professional summary (3-4 lines tuned to the job), "Experience" with 2-4 bullet points per role targeted to the job's priorities (start with strong verbs, keep numbers from the profile), "Skills" grouped, "Education", "Certifications" and "Projects" if useful.
5. Output ONLY the resume text in plain text / light markdown (## for headings, • for bullets). No commentary.`

/** onDelta receives the running text as it streams (when the provider supports it) */
export async function runResume(
  cfg: ProviderRow,
  profile: Profile,
  job: Job,
  onDelta?: (partial: string) => void,
): Promise<{ text: string; label: string }> {
  const user = `MASTER PROFILE (JSON — your only source of facts):\n${JSON.stringify(profilePromptJson(profile, { includeResume: true }))}\n\nTARGET JOB (JSON):\n${JSON.stringify(jobPromptJson(job))}\n\nJD excerpt you should optimise for:\n"""\n${job.raw_description.slice(0, 6000)}\n"""\n\nWrite the tailored resume now.`
  const r = await generateText('resume', cfg, [
    { role: 'system', content: RESUME_SYSTEM },
    { role: 'user', content: user },
  ], { temperature: 0.4, maxTokens: 6000, onDelta })
  return { text: r.text.trim(), label: r.label }
}

const COVER_SYSTEM = `You write concise, credible cover letters that get interviews. Rules:
1. Use ONLY facts from the candidate profile — never invent employers, titles, degrees or numbers.
2. 250-330 words, max 5 short paragraphs, professional but warm, no clichés ("I am thrilled…"), no generic fluff.
3. Use the job's actual title and company name; briefly mirror its top requirements and map them to profile evidence.
4. Address gaps honestly in one clause at most, pivoting to a genuine related strength.
5. Output ONLY the letter text (with a "Dear Hiring Team," greeting, body, and a sign-off using the candidate's name). No commentary.`

export async function runCoverLetter(
  cfg: ProviderRow,
  profile: Profile,
  job: Job,
  extraInstructions?: string,
  onDelta?: (partial: string) => void,
): Promise<{ text: string; label: string }> {
  const user = `MASTER PROFILE (JSON):\n${JSON.stringify(profilePromptJson(profile))}\n\nTARGET JOB (JSON):\n${JSON.stringify(jobPromptJson(job))}\n\nCandidate's own summary for tone:\n${profile.summary || '(none)'}\n${extraInstructions ? `Extra instructions from the candidate: ${extraInstructions}\n` : ''}\nWrite the cover letter now.`
  const r = await generateText('cover_letter', cfg, [
    { role: 'system', content: COVER_SYSTEM },
    { role: 'user', content: user },
  ], { temperature: 0.6, maxTokens: 3000, onDelta })
  return { text: r.text.trim(), label: r.label }
}

/** questions: free text, one per line */
export async function runAnswers(cfg: ProviderRow, profile: Profile, job: Job, questions: string[]): Promise<{ data: Answers['answers']; label: string }> {
  const { z } = await loadZod()
  const Schema = z.object({
    answers: z.array(z.object({ question: z.string().catch(''), answer: z.string().catch('') })).catch([]),
  })
  const SYSTEM = `You write winning application-form answers to employer questions. Use ONLY facts from the candidate profile. Keep each answer 70-140 words unless the question says otherwise. Be specific (it is fine to span multiple sentences), confident, and map to what the job actually asks for.

Return ONLY a JSON object: {"answers": [{"question": "<the question>", "answer": "<the answer>"}]} — one entry per question, same order.`
  const user = `PROFILE (JSON):\n${JSON.stringify(profilePromptJson(profile))}\n\nJOB (JSON):\n${JSON.stringify(jobPromptJson(job))}\n\nQUESTIONS:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
  const gen = await generateJson<Answers>('answers', cfg, SYSTEM, user, Schema, { temperature: 0.5, maxTokens: 6000 })
  return { data: gen.data.answers, label: gen.label }
}

export async function runInsights(cfg: ProviderRow, stats: string): Promise<string[]> {
  const { z } = await loadZod()
  const Schema = z.object({ insights: z.array(z.string()).catch([]) })
  const SYSTEM = `You are a career strategy advisor. Given aggregate job-search statistics (JSON), write 3-6 concrete, data-grounded insights a candidate can act on this week. Refer to actual numbers in the stats. If a metric has tiny sample size (<8), say so. No greeting, no filler.
Return ONLY JSON: {"insights": ["...", "..."]}`
  try {
    const gen = await generateJson<{ insights: string[] }>('insights', cfg, SYSTEM, `STATISTICS:\n${stats}`, Schema, { temperature: 0.4, maxTokens: 2500 })
    return gen.data.insights
  } catch {
    return []
  }
}

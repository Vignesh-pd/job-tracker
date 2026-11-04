import { db } from './db'
import type { AppStatus, Application, AppDoc, Profile, StatusHistory } from './types'
import { uid, addDays, TODAY } from './utils'

/**
 * Rich demo dataset (fictional!) so the app can be explored instantly.
 * Matches the MSc student persona from the project plan.
 */
export function demoProfile(): Profile {
  return {
    id: 'me',
    full_name: 'Demo Student',
    email: 'demo.student@example.com',
    phone: '+49 170 000 0000',
    location: 'Berlin, Germany',
    links: { linkedin: 'linkedin.com/in/demo', github: 'github.com/demo', portfolio: 'demo.dev' },
    summary:
      'MSc Data Management & AI student with 2 years of industry experience in data engineering and analytics. I enjoy turning messy data into reliable pipelines and useful models. Looking for graduate data analyst / engineering roles in Berlin.',
    experience: [
      {
        id: uid(),
        company: 'DataFlow GmbH',
        title: 'Junior Data Engineer',
        start: '2023-06',
        end: '2024-08',
        bullets: [
          'Built 12+ scheduled Apache Airflow pipelines ingesting 3M rows/day from CRM and billing systems into Snowflake',
          'Cut warehouse spend 22% by rewriting 8 dbt models with incremental materialisation',
          'Automated QA checks with Great Expectations, catching 95% of schema drift before load',
        ],
        technologies: ['Python', 'SQL', 'Airflow', 'dbt', 'Snowflake', 'Docker', 'PostgreSQL'],
      },
      {
        id: uid(),
        company: 'GoodsGrid (internship)',
        title: 'Data Analyst Intern',
        start: '2022-09',
        end: '2023-02',
        bullets: [
          'Dashboarded logistics KPIs in Power BI for 3 departments, replacing a 40-hour monthly manual report',
          'Forecasted stock-outs 2 weeks ahead with Prophet, reducing emergency buys 18%',
        ],
        technologies: ['Power BI', 'Python', 'pandas', 'scikit-learn'],
      },
    ],
    education: [
      { id: uid(), degree: 'MSc Data Management & Artificial Intelligence', institution: 'TU Demo University', start: '2024-10', end: '2026-09', details: 'Focus: data engineering, ML systems, data governance. Thesis: efficient retrieval pipelines for unstructured text.' },
      { id: uid(), degree: 'BSc Computer Science', institution: 'University of Weimarburg', start: '2019-10', end: '2023-06', details: '' },
    ],
    certifications: [
      { id: uid(), name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', date: '2024-03' },
      { id: uid(), name: 'dbt Analytics Engineering', issuer: 'dbt Labs', date: '2023-11' },
    ],
    projects: [
      { id: uid(), name: 'JobPilot', description: 'AI-assisted job application tracker with provider-agnostic LLM layer, match scoring and document tailoring.', technologies: ['React', 'TypeScript', 'Python', 'FastAPI'], link: 'github.com/demo/jobpilot' },
      { id: uid(), name: 'Thesis: RAG for legal corpora', description: 'Benchmarked chunking + embedding strategies for retrieval quality on German legal text.', technologies: ['LangChain', 'pgvector', 'PostgreSQL', 'Python'], link: '' },
    ],
    languages: ['English (fluent)', 'German (C1)', 'Hindi (native)'],
    skills: [
      { name: 'Python', category: 'Languages', level: 'advanced' },
      { name: 'SQL', category: 'Languages', level: 'advanced' },
      { name: 'TypeScript', category: 'Languages', level: 'intermediate' },
      { name: 'PostgreSQL', category: 'Databases', level: 'advanced' },
      { name: 'MongoDB', category: 'Databases', level: 'beginner' },
      { name: 'Snowflake', category: 'Databases', level: 'intermediate' },
      { name: 'Airflow', category: 'Data Engineering', level: 'advanced' },
      { name: 'dbt', category: 'Data Engineering', level: 'advanced' },
      { name: 'Spark', category: 'Data Engineering', level: 'intermediate' },
      { name: 'Docker', category: 'Cloud & DevOps', level: 'intermediate' },
      { name: 'Kubernetes', category: 'Cloud & DevOps', level: 'beginner' },
      { name: 'AWS', category: 'Cloud & DevOps', level: 'intermediate' },
      { name: 'pandas', category: 'Data Science', level: 'advanced' },
      { name: 'scikit-learn', category: 'Data Science', level: 'intermediate' },
      { name: 'PyTorch', category: 'Data Science', level: 'beginner' },
      { name: 'LLM prompting', category: 'Data Science', level: 'intermediate' },
      { name: 'Power BI', category: 'Visualisation', level: 'advanced' },
      { name: 'Tableau', category: 'Visualisation', level: 'intermediate' },
    ],
    master_resume:
      '## Demo Student\nBerlin, Germany · demo.student@example.com · linkedin.com/in/demo\n\nMSc Data Management & AI student with 2 years of data engineering experience.\n\n## Experience\n- DataFlow GmbH — Junior Data Engineer (2023-06 → 2024-08): built Airflow pipelines (3M rows/day), cut warehouse spend 22%, automated QA with Great Expectations.\n- GoodsGrid — Data Analyst Intern (2022-09 → 2023-02): Power BI KPI dashboards, stock-out forecasting with Prophet.\n\n## Skills\nPython, SQL, TypeScript, PostgreSQL, Snowflake, Airflow, dbt, Spark, Docker, AWS, Power BI, pandas, scikit-learn\n\n## Education\n- MSc Data Management & AI — TU Demo University (2024 → 2026)\n- BSc Computer Science — University of Weimarburg (2019 → 2023)',
    updated_at: Date.now(),
  }
}

interface DemoJobSpec {
  title: string
  company: string
  location: string
  source: string
  status: AppStatus
  appliedOffset: number
  required: string[]
  preferred: string[]
  skills: string
  desc: string
  match?: number
}

const DEMO: DemoJobSpec[] = [
  {
    title: 'Graduate Data Engineer', company: 'Spotify', location: 'Stockholm (hybrid)', source: 'Spotify Careers', status: 'interview',
    appliedOffset: -21, required: ['SQL', 'Python', 'Airflow', 'dbt', 'Docker'], preferred: ['Snowflake', 'Spark', 'AWS', 'Kubernetes'], skills: 'SQL Python Airflow dbt Snowflake',
    desc: 'Join the Catalog Engineering team to build the pipelines feeding 600M+ playlists. You own ETL on Google Cloud, orchestrate with Airflow, craft dbt models and keep data SLAs honest. Requirements: 2-4 years experience with SQL and Python, production data pipelines (Airflow), containerised deployments with Docker. Nice to have: Snowflake, Spark, GCS security basics, a passion for music data.',
    match: 82,
  },
  {
    title: 'Data Analyst (Working Student)', company: 'Zalando', location: 'Berlin, Germany', source: 'LinkedIn', status: 'applied',
    appliedOffset: -6, required: ['SQL', 'Python', 'pandas', 'Power BI'], preferred: ['Tableau', 'A/B testing', 'scikit-learn'], skills: 'SQL pandas Power BI A/B testing',
    desc: 'Support the Clothing Analytics team: maintain dashboards, run A/B test readouts, write funnel analyses. 15h/week, must be enrolled student. Required: SQL, Python incl pandas, Power BI or Tableau. Nice: hypothesis testing, scikit-learn basics.',
    match: 88,
  },
  {
    title: 'Junior Machine Learning Engineer', company: 'DeepL', location: 'Cologne / Remote EU', source: 'Company site', status: 'assessment',
    appliedOffset: -12, required: ['Python', 'PyTorch', 'MLOps basics', 'Docker'], preferred: ['LLM evaluation', 'FastAPI', 'AWS'], skills: 'PyTorch LLM Docker AWS',
    desc: 'Ship ML features to millions of users: model training, evaluation harnesses, and serving. Requirements: strong Python, PyTorch, command of Linux, Docker; ml experiment tracking. Bonus: LLM fine-tuning experience, FastAPI services, AWS.',
    match: 64,
  },
  {
    title: 'Business Intelligence Analyst', company: 'Douglas Group', location: 'Hamburg', source: 'Indeed', status: 'offer',
    appliedOffset: -30, required: ['SQL', 'Power BI', 'Tableau', 'Data modelling'], preferred: ['dbt', 'Retail domain'], skills: 'SQL Power BI data modelling',
    desc: 'Own trading KPI dashboards for 1,800 stores. Build star schemas in SAP BW and Power BI, partner with merchandising team. Required: 2+ years SQL, BI tooling (Power BI), dimensional modelling.',
    match: 91,
  },
  {
    title: 'Data Engineer (Energy)', company: 'E.ON', location: 'Essen', source: 'Referral', status: 'rejected',
    appliedOffset: -40, required: ['Java', 'Kafka', 'PostgreSQL', 'Cloud (any)'], preferred: ['Python', 'Terraform'], skills: 'Kafka Java PostgreSQL Terraform',
    desc: 'Modernise the data platform for smart-meter telemetry. Kafka streaming at 50k msg/s, PostgreSQL, Java services, anything-cloud. Requirements: Java or Kotlin, distributed streaming, relational DB design.',
    match: 41,
  },
  {
    title: 'Analytics Engineer, Growth', company: 'GetYourGuide', location: 'Berlin (hybrid)', source: 'LinkedIn', status: 'applied',
    appliedOffset: -9, required: ['SQL', 'dbt', 'Analytics engineering', 'Python'], preferred: ['Airflow', 'Fivetran', 'Snowflake'], skills: 'SQL dbt Snowflake Airflow',
    desc: 'Work with growth PMs to define metric pipelines. Our stack: Snowflake, dbt, Fivetran, Airflow, Metabase. Requirements: 1-2 years analytics engineering or similar, advanced SQL, dbt confidence.',
    match: 85,
  },
  {
    title: 'Data Science Intern', company: 'Bosch', location: 'Stuttgart', source: 'StepStone', status: 'pending',
    appliedOffset: -4, required: ['Python', 'scikit-learn', 'SQL'], preferred: ['Time series', 'MLOps'], skills: 'Python scikit-learn SQL time series',
    desc: 'Predictive maintenance for manufacturing lines. Required: Python with scikit-learn, SQL, statistics fundamentals. Preferred: time-series forecasting, MLOps curiosity.',
    match: 72,
  },
  {
    title: 'AI Solutions Engineer (Graduate)', company: 'SAP', location: 'Walldorf / Remote DE', source: 'Careers page', status: 'saved',
    appliedOffset: 0, required: ['Python', 'LLM APIs', 'SQL', 'REST APIs'], preferred: ['FastAPI', 'Vector databases', 'TypeScript'], skills: 'LLM API REST Python vector databases',
    desc: 'Prototype GenAI solutions for enterprise customers. Requires: Python, experience integrating LLM APIs, SQL, REST. Preferred: FastAPI, vector DBs (pgvector), TypeScript for demo UIs.',
    match: 76,
  },
]

export async function loadDemoData(): Promise<void> {
  await clearJourney()
  const now = Date.now()
  const profile = demoProfile()
  await db.profile.put(profile)

  const historyToInsert: StatusHistory[] = []

  for (const spec of DEMO) {
    const jobId = await db.jobs.add({
      title: spec.title,
      company: spec.company,
      location: spec.location,
      employment_type: 'Full-time',
      raw_description: spec.desc,
      required_skills: spec.required,
      preferred_skills: spec.preferred,
      keywords: spec.skills.split(' '),
      responsibilities: [],
      education: 'Degree required',
      experience_years: '1-3 years',
      analyzed_by: 'Demo seed',
      created_at: now,
    })
    const applied = addDays(TODAY(), spec.appliedOffset)
    const app: Application = {
      job_id: jobId,
      company: spec.company,
      title: spec.title,
      applied_on: applied,
      source: spec.source,
      status: spec.status,
      match_score: spec.match,
      match_report: {
        score: spec.match ?? 0,
        strong_matches: [`Profile matches ${spec.match ?? 0}% of required skills`],
        missing_skills: [],
        experience_alignment: 'Demo data — open the application to regenerate a real match report.',
        education_alignment: 'Demo data.',
        summary: `${spec.company} — ${spec.title}. Demo match report.`,
        generated_by: 'Demo seed',
      },
      notes: '',
      tags: [],
      created_at: now,
      updated_at: now,
    }
    if (spec.status === 'applied' || spec.status === 'pending') app.follow_up_on = addDays(applied, 7)
    const appId = await db.applications.add(app)
    // status history: saved -> applied -> ... -> current
    const chain: AppStatus[] = ['saved']
    if (['applied', 'pending', 'assessment', 'interview', 'offer', 'rejected'].includes(spec.status)) chain.push('applied')
    if (['pending', 'assessment', 'interview', 'offer', 'rejected'].includes(spec.status)) chain.push('pending')
    if (['assessment', 'interview', 'offer'].includes(spec.status)) chain.push('assessment')
    if (['interview', 'offer'].includes(spec.status)) chain.push('interview')
    if (['offer'].includes(spec.status)) chain.push('offer')
    if (spec.status === 'rejected') chain.push('rejected')
    chain.forEach((to, i) => {
      historyToInsert.push({
        application_id: appId,
        from_status: i === 0 ? undefined : chain[i - 1],
        to_status: to,
        changed_at: now - (chain.length - 1 - i) * 86400000 * 3,
      })
    })
  }

  await db.history.bulkAdd(historyToInsert)
  // two sample documents for the first offer
  const firstApp = await db.applications.toArray()
  const offerApp = firstApp.find((a) => a.status === 'offer')
  if (offerApp) {
    const doc1: AppDoc = {
      application_id: offerApp.id!,
      job_id: offerApp.job_id,
      type: 'resume',
      version: 1,
      title: 'Tailored Resume — BI Analyst (v1)',
      content: '## Demo Student\nBerlin, Germany · demo.student@example.com\n\n**BI Analyst candidate: 2 years SQL + Power BI in retail & logistics.**\n\n## Experience\n• DataFlow GmbH — Junior Data Engineer: 12 Airflow pipelines, −22% warehouse cost\n• GoodsGrid — Data Analyst Intern: Power BI dashboards for 3 departments; forecast with Prophet (−18% emergency buys)\n\n## Skills\nSQL · Power BI · Tableau · Data modelling · Python · dbt\n\n## Education\nMSc Data Management & AI, TU Demo University (2026 expected)',
      provider: 'Demo seed',
      model: 'demo',
      created_at: now,
    }
    const doc2: AppDoc = {
      application_id: offerApp.id!,
      job_id: offerApp.job_id,
      type: 'cover_letter',
      version: 1,
      title: 'Cover Letter — BI Analyst (v1)',
      content: 'Dear Hiring Team,\n\nRetail runs on decisions made before the morning hill — and my work has been about giving those decisions better data. At GoodsGrid I replaced a 40-hour monthly report with Power BI dashboards three departments now open every day; at DataFlow I kept 12 mission-critical pipelines honest with automated QA.\n\nThe BI Analyst role at Douglas pairs exactly the two things I have practised: dimensional modelling for high-volume retail data, and dashboard craft people actually use. Your 1,800 stores produce signals — I have spent my last two roles turning such signals into forecast models that cut emergency buys 18%.\n\nI am finishing an MSc in Data Management & AI, so alongside BI fundamentals I bring an intuition for where a model helps and where a clean star schema is enough.\n\nThank you for your consideration.\n\nSincerely,\nDemo Student',
      provider: 'Demo seed',
      model: 'demo',
      created_at: now,
    }
    const id1 = await db.documents.add(doc1)
    const id2 = await db.documents.add(doc2)
    await db.applications.update(offerApp.id!, { resume_doc_id: id1, cover_letter_doc_id: id2 })
  }
}

async function clearJourney() {
  await db.jobs.clear()
  await db.applications.clear()
  await db.history.clear()
  await db.documents.clear()
}

export const DEMO_CSV = `company,title,status,date applied,source,notes
Northwind Analytics,Junior Data Engineer,applied,17/09/2026,LinkedIn,"Follow up after holidays"
HRFlow,BI Working Student,interview,22/09/2026,Referral,"Technical interview Thursday"
Pixelbank,Data Analyst,assessment,05/10/2026,StepStone,"SQL test due"
Acme Robotics,ML Engineer Intern,applied,01/10/2026,Indeed,
Frankfurtalytics,Analytics Engineer,rejected,12/09/2026,Careers page,"Asked for Java experience"`

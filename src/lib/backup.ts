import { db } from './db'
import { downloadBlob } from './utils'

export interface BackupFile {
  app: 'JobPilot'
  version: 1
  exported_at: string
  profile: unknown
  jobs: unknown[]
  applications: unknown[]
  history: unknown[]
  documents: unknown[]
}

export async function exportBackup(): Promise<void> {
  const file: BackupFile = {
    app: 'JobPilot',
    version: 1,
    exported_at: new Date().toISOString(),
    profile: (await db.profile.get('me')) ?? null,
    jobs: await db.jobs.toArray(),
    applications: await db.applications.toArray(),
    history: await db.history.toArray(),
    documents: await db.documents.toArray(),
  }
  downloadBlob(JSON.stringify(file, null, 2), `jobpilot-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
}

/** mode: 'merge' keeps existing, 'replace' wipes first. AI provider keys are NOT included. */
export async function importBackup(json: string, mode: 'merge' | 'replace'): Promise<{ apps: number; jobs: number; docs: number }> {
  const f = JSON.parse(json) as BackupFile
  if (f.app !== 'JobPilot') throw new Error('Not a JobPilot backup file.')
  if (mode === 'replace') {
    await db.applications.clear()
    await db.jobs.clear()
    await db.history.clear()
    await db.documents.clear()
    await db.profile.delete('me')
  }
  if (f.profile && typeof f.profile === 'object') await db.profile.put(f.profile as never)
  let jobs = 0, apps = 0, docs = 0
  if (Array.isArray(f.jobs)) {
    const arr = f.jobs as Record<string, unknown>[]
    await db.jobs.bulkPut(arr.map((j) => ({ ...j })) as never)
    jobs = arr.length
  }
  if (Array.isArray(f.applications)) {
    const arr = f.applications as Record<string, unknown>[]
    await db.applications.bulkPut(arr.map((a) => ({ ...a })) as never)
    apps = arr.length
  }
  if (Array.isArray(f.history)) await db.history.bulkPut(f.history as never)
  if (Array.isArray(f.documents)) {
    await db.documents.bulkPut(f.documents as never)
    docs = f.documents.length
  }
  return { apps, jobs, docs }
}

export async function clearAllData(): Promise<void> {
  await db.jobs.clear()
  await db.applications.clear()
  await db.history.clear()
  await db.documents.clear()
  await db.profile.put((await db.profile.get('me')) ?? ({ id: 'me' } as never))
}

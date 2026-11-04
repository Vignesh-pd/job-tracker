import { useMemo, useState } from 'react'
import type { AppDoc, DocType } from '../lib/types'
import { useStore } from '../store'
import { Button, Card, EmptyState, Select } from '../components/ui'
import { DocumentPreviewModal } from '../components/DocumentPreview'
import { DocumentGenModal, TYPE_LABEL } from '../components/DocumentGen'
import { timeAgo, cn } from '../lib/utils'
import { FileText, Mail, Lightbulb, Wand2 } from 'lucide-react'
import { navigate } from '../lib/router'

const TYPE_ICON: Record<DocType, React.ReactNode> = {
  resume: <FileText className="size-4" />,
  cover_letter: <Mail className="size-4" />,
  answers: <Lightbulb className="size-4" />,
}

export function DocumentsPage() {
  const { documents, apps } = useStore()
  const [filter, setFilter] = useState<DocType | 'all'>('all')
  const [preview, setPreview] = useState<AppDoc | null>(null)
  const [genApp, setGenApp] = useState<{ id: number; type: DocType } | null>(null)

  const list = useMemo(
    () =>
      documents
        .filter((d) => filter === 'all' || d.type === filter)
        .sort((a, b) => b.created_at - a.created_at),
    [documents, filter],
  )

  const genFor = genApp ? apps.find((a) => a.id === genApp.id) : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">Documents</h1>
          <p className="text-xs text-ink-400 mt-0.5">
            Every generated resume, letter and answer set — versioned, labeled with the model that wrote it.
          </p>
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as DocType | 'all')} className="w-44">
          <option value="all">All types ({documents.length})</option>
          <option value="resume">Resumes ({documents.filter((d) => d.type === 'resume').length})</option>
          <option value="cover_letter">Cover letters ({documents.filter((d) => d.type === 'cover_letter').length})</option>
          <option value="answers">Answer sets ({documents.filter((d) => d.type === 'answers').length})</option>
        </Select>
      </div>

      {!documents.length ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-7" />}
            title="No documents yet"
            body="Open an application and generate a tailored resume or cover letter. Facts come strictly from your profile."
            action={
              <Button size="sm" onClick={() => navigate('#/applications')}>
                <Wand2 className="size-3.5" /> Go to applications
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => {
            const app = apps.find((a) => a.id === d.application_id)
            return (
              <Card key={d.id} hover className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl',
                    d.type === 'resume' && 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-300',
                    d.type === 'cover_letter' && 'bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-300',
                    d.type === 'answers' && 'bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-300',
                  )}>
                    {TYPE_ICON[d.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink-800 dark:text-ink-100">{TYPE_LABEL[d.type]} · v{d.version}</p>
                    <p className="truncate text-[11px] text-ink-400">{app ? `${app.company} — ${app.title}` : 'Application removed'}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-300">{d.content.replace(/[#*•]/g, '').slice(0, 180)}…</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 dark:border-ink-800 pt-2.5">
                  <span className="min-w-0 truncate text-[10px] text-ink-400">
                    by <b className="text-ink-500 dark:text-ink-300">{d.provider}{d.model ? ` · ${d.model.replace(/^models\//, '')}` : ''}</b> · {timeAgo(d.created_at)}
                  </span>
                  <div className="flex gap-1">
                    <Button size="xs" variant="secondary" onClick={() => setPreview(d)}>Open</Button>
                    {app && (
                      <Button size="xs" variant="ghost" onClick={() => setGenApp({ id: app.id!, type: d.type })}>
                        Regenerate
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
      {genFor && genApp && <DocumentGenModal open onClose={() => setGenApp(null)} app={genFor} type={genApp.type} />}
    </div>
  )
}

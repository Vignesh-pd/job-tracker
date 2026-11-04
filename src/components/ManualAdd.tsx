import { useState } from 'react'
import type { AppStatus, Application } from '../lib/types'
import { STATUSES, STATUS_LABEL } from '../lib/types'
import { useStore } from '../store'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'
import { addDays, TODAY } from '../lib/utils'
import { Wand2 } from 'lucide-react'
import { navigate } from '../lib/router'

/** quick manual entry dialog for applications from the spreadsheet era */
export function ManualAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addManualApplication, toast } = useStore()
  const [form, setForm] = useState({
    company: '',
    title: '',
    status: 'applied' as AppStatus,
    applied_on: TODAY(),
    source: '',
    follow_up_on: addDays(TODAY(), 7),
    url: '',
    notes: '',
    tags: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.company.trim() && !form.title.trim()) {
      toast('error', 'Company or role required')
      return
    }
    const input: Partial<Application> = {
      company: form.company.trim() || 'Unknown company',
      title: form.title.trim() || 'Untitled role',
      status: form.status,
      applied_on: form.status === 'saved' ? undefined : form.applied_on || TODAY(),
      source: form.source.trim(),
      follow_up_on: form.status === 'saved' ? undefined : form.follow_up_on || undefined,
      url: form.url.trim(),
      notes: form.notes.trim(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    await addManualApplication(input)
    toast('success', 'Application added', `${input.company} — ${input.title}`)
    setForm((f) => ({ ...f, company: '', title: '', url: '', notes: '', tags: '' }))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add application manually">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company">
          <Input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Acme Corp" autoFocus />
        </Field>
        <Field label="Role / position">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Junior Data Analyst" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Applied on" hint={form.status === 'saved' ? 'Saved — not applied yet' : undefined}>
          <Input type="date" value={form.applied_on} onChange={(e) => set('applied_on', e.target.value)} disabled={form.status === 'saved'} />
        </Field>
        <Field label="Source" hint="Where you found it">
          <Input value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="LinkedIn, referral…" />
        </Field>
        <Field label="Follow-up on">
          <Input type="date" value={form.follow_up_on} onChange={(e) => set('follow_up_on', e.target.value)} disabled={form.status === 'saved'} />
        </Field>
        <Field label="Job posting URL" className="sm:col-span-2">
          <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Tags" className="sm:col-span-2" hint="Comma separated">
          <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="remote, junior, germany" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering…" />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => { onClose(); navigate('#/analyzer') }}>
          <Wand2 className="size-3.5" /> Prefer AI mode? Paste a JD instead
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Add application</Button>
        </div>
      </div>
    </Modal>
  )
}

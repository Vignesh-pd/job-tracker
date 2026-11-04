import type { TaskKind } from '../lib/types'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import { Sparkles } from 'lucide-react'

export interface ModelOverride {
  provider_id?: string | null
  model?: string | null
}

/**
 * The small model chip used on analyzer & generator screens for per-run override.
 * value === null means "use the task routing default".
 */
export function ModelChipSelect({ task, value, onChange, compact }: { task: TaskKind; value: ModelOverride | null; onChange: (v: ModelOverride | null) => void; compact?: boolean }) {
  const { providers, resolveTask, settings } = useStore()
  const usable = providers.filter((p) => p.enabled && (p.api_key || p.kind === 'ollama'))
  const resolved = resolveTask(task)
  const defLabel = resolved ? `${resolved.name.split(' ')[0]} · ${resolved.model.replace(/^models\//, '')}` : 'none'

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-xl border border-brand-200/70 dark:border-brand-500/25 bg-brand-50/60 dark:bg-brand-500/10 pl-2 pr-1')}>
      <Sparkles className={cn('text-brand-500', compact ? 'size-3.5' : 'size-4')} />
      <select
        value={value ? value.provider_id ?? '' : '__default'}
        onChange={(e) => {
          const v = e.target.value
          if (v === '__default') onChange(null)
          else onChange({ provider_id: v, model: null })
        }}
        className={cn('bg-transparent py-1.5 pr-0.5 text-xs font-semibold text-brand-800 dark:text-brand-200 focus:outline-none cursor-pointer', compact ? 'text-[11px]' : '')}
      >
        <option value="__default">Default · {defLabel}</option>
        {usable.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.model.replace(/^models\//, '') || 'choose model'}
          </option>
        ))}
        {!usable.length && <option value="nope">No usable provider (add a key in Settings)</option>}
      </select>
      {value && usable.find((p) => p.id === value.provider_id)?.model !== value.model && value.model && (
        <span className="text-[11px] text-brand-700 dark:text-brand-300 tabular-nums">{value.model}</span>
      )}
      {settings.default_provider === null && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">No default set</span>}
    </div>
  )
}

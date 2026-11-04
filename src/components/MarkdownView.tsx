import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

/** minimal, safe markdown-ish renderer for generated documents (headings, bullets, **bold**, links) */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // split on **bold** and [text](url)
  const regex = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\((?:https?:\/\/|mailto:)[^\)\s]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i++}`}>{token.slice(2, -2)}</strong>,
      )
    } else {
      const mm = token.match(/\[([^\]]+)\]\(([^\)\s]+)\)/)!
      nodes.push(
        <a key={`${keyPrefix}-a${i++}`} href={mm[2]} target="_blank" rel="noreferrer">
          {mm[1]}
        </a>,
      )
    }
    last = m.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function MarkdownView({ content, className }: { content: string; className?: string }) {
  const lines = (content ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {list.map((li, i) => (
            <li key={i}>{inline(li, `li-${blocks.length}-${i}`)}</li>
          ))}
        </ul>,
      )
      list = []
    }
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*(?:[-*•·]|\d+[.)])\s+(.*)$/)
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushList()
      const level = heading[1].length
      const Tag = (level <= 1 ? 'h1' : level === 2 ? 'h2' : 'h3') as 'h1'
      blocks.push(<Tag key={`h-${idx}`}>{inline(heading[2], `h-${idx}`)}</Tag>)
    } else if (bullet) {
      list.push(bullet[1])
    } else if (line.trim() === '') {
      flushList()
    } else {
      flushList()
      blocks.push(<p key={`p-${idx}`}>{inline(line, `p-${idx}`)}</p>)
    }
  })
  flushList()

  return <div className={cn('doc-content text-[13.5px] text-ink-700 dark:text-ink-200', className)}>{blocks}</div>
}

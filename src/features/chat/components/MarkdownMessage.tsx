import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'

function safeHref(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : '#'
  } catch {
    return '#'
  }
}

function inline(text: string): ReactNode[] {
  const pattern = /(\[[^\]]+\]\([^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g
  const parts = text.split(pattern).filter(Boolean)

  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/)
    if (link) {
      const href = safeHref(link[2])
      return <a key={index} href={href} target="_blank" rel="noreferrer noopener">{link[1]}</a>
    }
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="chat-code-block">
      <div className="chat-code-block__bar">
        <span>{language || 'text'}</span>
        <button type="button" onClick={() => void copy()}>{copied ? 'COPIED' : 'COPY'}</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function cells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }

    const fence = line.match(/^```([^`]*)$/)
    if (fence) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { code.push(lines[i]); i += 1 }
      if (i < lines.length) i += 1
      blocks.push(<CodeBlock key={`code-${i}`} language={fence[1].trim()} code={code.join('\n')} />)
      continue
    }

    if (i + 1 < lines.length && line.includes('|') && isTableDivider(lines[i + 1])) {
      const headers = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i += 1 }
      blocks.push(
        <div className="chat-markdown__table-wrap" key={`table-${i}`}>
          <table><thead><tr>{headers.map((cell, n) => <th key={n}>{inline(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{inline(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = Math.min(heading[1].length, 6)
      const Tag = `h${level}` as keyof JSX.IntrinsicElements
      blocks.push(<Tag key={`h-${i}`}>{inline(heading[2])}</Tag>)
      i += 1
      continue
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${i}`} />)
      i += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, '')); i += 1 }
      blocks.push(<blockquote key={`quote-${i}`}>{quote.map((item, n) => <p key={n}>{inline(item)}</p>)}</blockquote>)
      continue
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
    if (unordered) {
      const items: string[] = []
      while (i < lines.length) {
        const match = lines[i].match(/^\s*[-*+]\s+(.+)$/)
        if (!match) break
        items.push(match[1]); i += 1
      }
      blocks.push(<ul key={`ul-${i}`}>{items.map((item, n) => <li key={n}>{inline(item)}</li>)}</ul>)
      continue
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (ordered) {
      const items: string[] = []
      while (i < lines.length) {
        const match = lines[i].match(/^\s*\d+[.)]\s+(.+)$/)
        if (!match) break
        items.push(match[1]); i += 1
      }
      blocks.push(<ol key={`ol-${i}`}>{items.map((item, n) => <li key={n}>{inline(item)}</li>)}</ol>)
      continue
    }

    const paragraph: string[] = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^(#{1,6})\s+/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
      if (i + 1 < lines.length && lines[i].includes('|') && isTableDivider(lines[i + 1])) break
      paragraph.push(lines[i]); i += 1
    }
    blocks.push(<p key={`p-${i}`}>{inline(paragraph.join('\n'))}</p>)
  }

  return <div className="chat-markdown">{blocks}</div>
}

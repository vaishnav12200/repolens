import { useMemo, useState } from 'react'

type Node = {
  name: string
  path: string
  children: Map<string, Node>
}

function buildTree(paths: string[]) {
  const root: Node = { name: 'root', path: '', children: new Map() }

  paths.forEach((fullPath) => {
    const parts = fullPath.split('/').filter(Boolean)
    let current = root
    let builtPath = ''

    for (const part of parts) {
      builtPath = builtPath ? `${builtPath}/${part}` : part
      if (!current.children.has(part)) {
        current.children.set(part, { name: part, path: builtPath, children: new Map() })
      }
      current = current.children.get(part) as Node
    }
  })

  return root
}

type Props = {
  paths: string[]
}

export function TreeView({ paths }: Props) {
  const tree = useMemo(() => buildTree(paths.slice(0, 180)), [paths])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true })

  const renderNode = (node: Node, depth = 0) => {
    const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))
    const hasChildren = children.length > 0
    const key = node.path || 'root'
    const open = expanded[key] ?? depth < 2

    return (
      <div key={key}>
        {node.name !== 'root' && (
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-slate-200 hover:bg-slate-800/70"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => hasChildren && setExpanded((prev) => ({ ...prev, [key]: !open }))}
          >
            <span className="text-neon-500">{hasChildren ? (open ? '▾' : '▸') : '•'}</span>
            <span className="font-mono">{node.name}</span>
          </button>
        )}
        {hasChildren && open && <div>{children.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    )
  }

  return <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 py-2">{renderNode(tree)}</div>
}

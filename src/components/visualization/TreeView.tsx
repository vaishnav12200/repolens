import { useMemo, useRef, useState } from 'react'

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
  const tree = useMemo(() => buildTree(paths.slice(0, 700)), [paths])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true })
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1, rotateDeg: 0 })
  const dragRef = useRef<{ x: number; y: number; mode: 'pan' | 'rotate' } | null>(null)

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if ((event.target as HTMLElement).closest('button')) {
      return
    }

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      mode: event.shiftKey ? 'rotate' : 'pan',
    }
  }

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!dragRef.current) return

    const deltaX = event.clientX - dragRef.current.x
    const deltaY = event.clientY - dragRef.current.y
    dragRef.current.x = event.clientX
    dragRef.current.y = event.clientY

    setTransform((prev) => {
      if (dragRef.current?.mode === 'rotate') {
        return { ...prev, rotateDeg: prev.rotateDeg + deltaX * 0.25 }
      }
      return { ...prev, x: prev.x + deltaX, y: prev.y + deltaY }
    })
  }

  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    dragRef.current = null
  }

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    if (event.ctrlKey || event.shiftKey) {
      setTransform((prev) => ({ ...prev, rotateDeg: prev.rotateDeg + event.deltaY * 0.08 }))
      return
    }

    const next = Math.min(2.6, Math.max(0.55, transform.scale - event.deltaY * 0.0015))
    setTransform((prev) => ({ ...prev, scale: next }))
  }

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

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-cyan-300/80">Drag to move · Shift+drag to rotate · Wheel to zoom</p>
      <div
        className="max-h-[360px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <div
          className="min-h-[360px] py-2"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotateDeg}deg)`,
            transformOrigin: 'top left',
          }}
        >
          {renderNode(tree)}
        </div>
      </div>
    </div>
  )
}

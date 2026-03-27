type Props = {
  lines: Array<{ id: string; text: string }>
}

export function TerminalPanel({ lines }: Props) {
  return (
    <aside className="flex h-full min-h-[420px] flex-col rounded-xl border border-neon-700/50 bg-black/95 p-3 shadow-neon">
      <p className="mb-2 text-xs uppercase tracking-[0.24em] text-neon-500">Runtime Logs</p>
      <div className="h-full overflow-auto rounded-lg border border-slate-800 bg-terminal-bg p-3 font-mono text-xs text-terminal-text">
        {lines.map((line) => (
          <p key={line.id} className="leading-relaxed">
            {line.text}
          </p>
        ))}
      </div>
    </aside>
  )
}

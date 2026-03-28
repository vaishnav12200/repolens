type Line = {
  id: string
  text: string
}

type Props = {
  title?: string
  lines: Line[]
  className?: string
}

export function Terminal({ title = 'terminal', lines, className }: Props) {
  return (
    <section className={`terminal-shell ${className ?? ''}`.trim()}>
      <header className="terminal-head">
        <div className="terminal-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p>{title}</p>
      </header>
      <div className="terminal-body">
        {lines.map((line) => (
          <p key={line.id} className="terminal-line glow-text">
            {line.text}
          </p>
        ))}
      </div>
    </section>
  )
}

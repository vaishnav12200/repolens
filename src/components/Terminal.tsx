type Line = {
  id: string
  text: string
}

type Props = {
  title?: string
  lines: Line[]
  className?: string
}

function renderLineWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const segments = text.split(urlRegex)

  return segments.map((segment, index) => {
    if (/^https?:\/\//.test(segment)) {
      return (
        <a
          key={`${segment}-${index}`}
          href={segment}
          target="_blank"
          rel="noreferrer"
          className="terminal-link"
        >
          {segment}
        </a>
      )
    }

    return <span key={`${segment}-${index}`}>{segment}</span>
  })
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
            {renderLineWithLinks(line.text)}
          </p>
        ))}
      </div>
    </section>
  )
}

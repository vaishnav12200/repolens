import { useEffect, useRef } from 'react'

type Props = {
  value: string
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onHistoryUp?: () => void
  onHistoryDown?: () => void
  autoFocus?: boolean
}

export function CommandInput({
  value,
  placeholder,
  disabled,
  onChange,
  onSubmit,
  onHistoryUp,
  onHistoryDown,
  autoFocus,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!autoFocus) return
    inputRef.current?.focus()
  }, [autoFocus])

  return (
    <div className="terminal-input-wrap">
      <span className="terminal-prompt">repolens@node:~$</span>
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSubmit()
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onHistoryUp?.()
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            onHistoryDown?.()
          }
        }}
        placeholder={placeholder}
        className="terminal-input"
        spellCheck={false}
      />
      <span className="cursor-blink" aria-hidden>
        ▋
      </span>
    </div>
  )
}

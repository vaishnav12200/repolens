import { useEffect, useMemo, useState } from 'react'
import { codeToHtml } from 'shiki'

type ExplorerAppProps = {
  tree: string[]
  selectedPath: string | null
  selectedContent: string | null
  onOpenFile: (path: string) => Promise<void>
}

function inferLang(path: string) {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'ts',
    tsx: 'tsx',
    js: 'js',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    py: 'python',
    yml: 'yaml',
    yaml: 'yaml',
    html: 'html',
    css: 'css',
  }
  return map[ext] ?? 'text'
}

export function ExplorerApp({ tree, selectedPath, selectedContent, onOpenFile }: ExplorerAppProps) {
  const [renderedCode, setRenderedCode] = useState('')

  const files = useMemo(() => tree.filter((item) => !item.endsWith('/')), [tree])

  useEffect(() => {
    let cancelled = false

    async function render() {
      if (!selectedPath || !selectedContent) {
        setRenderedCode('')
        return
      }

      try {
        const html = await codeToHtml(selectedContent, {
          lang: inferLang(selectedPath),
          theme: 'github-dark',
        })
        if (!cancelled) {
          setRenderedCode(html)
        }
      } catch {
        if (!cancelled) {
          setRenderedCode(`<pre>${selectedContent.replaceAll('<', '&lt;')}</pre>`)
        }
      }
    }

    void render()

    return () => {
      cancelled = true
    }
  }, [selectedContent, selectedPath])

  return (
    <div className="explorer-grid">
      <aside className="explorer-tree">
        {files.length === 0 ? <p className="app-muted">Analyze a repository to load files.</p> : null}
        {files.map((file) => (
          <button
            key={file}
            className={`tree-node ${selectedPath === file ? 'active' : ''}`}
            onClick={() => void onOpenFile(file)}
          >
            {file}
          </button>
        ))}
      </aside>

      <section className="explorer-editor">
        {selectedPath ? <p className="editor-path">{selectedPath}</p> : <p className="app-muted">Select a file to preview.</p>}
        {renderedCode ? <div className="code-frame" dangerouslySetInnerHTML={{ __html: renderedCode }} /> : null}
      </section>
    </div>
  )
}

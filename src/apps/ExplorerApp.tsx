import { useEffect, useMemo, useState } from 'react'

type CodeToHtml = (code: string, options: { lang: string; theme: string }) => Promise<string>

let codeToHtmlLoader: CodeToHtml | null = null

async function getCodeToHtml() {
  if (codeToHtmlLoader) {
    return codeToHtmlLoader
  }

  const module = await import('shiki')
  codeToHtmlLoader = module.codeToHtml
  return codeToHtmlLoader
}

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
  const [isLoadingHighlighter, setIsLoadingHighlighter] = useState(false)

  const files = useMemo(() => tree.filter((item) => !item.endsWith('/')), [tree])

  useEffect(() => {
    let cancelled = false

    async function render() {
      if (!selectedPath || !selectedContent) {
        setRenderedCode('')
        return
      }

      try {
        setIsLoadingHighlighter(true)
        const codeToHtml = await getCodeToHtml()
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
      } finally {
        if (!cancelled) {
          setIsLoadingHighlighter(false)
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
        {isLoadingHighlighter ? <p className="app-muted">Loading syntax highlighter...</p> : null}
        {renderedCode ? <div className="code-frame" dangerouslySetInnerHTML={{ __html: renderedCode }} /> : null}
      </section>
    </div>
  )
}

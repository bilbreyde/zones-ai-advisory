import { useEffect, useRef, useState } from 'react'

export default function MermaidChart({ chart, title }) {
  const ref = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#162B52',
            primaryTextColor: '#F4F6FA',
            primaryBorderColor: '#4A9FE0',
            lineColor: '#4A9FE0',
            secondaryColor: '#0F2040',
            tertiaryColor: '#0A1628',
            background: '#0A1628',
            mainBkg: '#162B52',
            nodeBorder: '#4A9FE0',
            clusterBkg: '#0F2040',
            titleColor: '#F4F6FA',
            edgeLabelBackground: '#0F2040',
            fontFamily: 'DM Sans, system-ui, sans-serif',
          },
          flowchart: { curve: 'basis', padding: 20 },
          architecture: { padding: 20 },
        })
        const id = `mermaid-${Date.now()}`
        const { svg } = await mermaid.render(id, chart)
        if (!cancelled) setSvg(svg)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    render()
    return () => { cancelled = true }
  }, [chart])

  if (error) return (
    <div style={{ padding: '12px', color: 'var(--z-warn)', fontSize: '11px', fontFamily: 'monospace' }}>
      Diagram error: {error}
      <pre style={{ marginTop: 8, color: 'var(--z-muted)', fontSize: '10px', whiteSpace: 'pre-wrap' }}>{chart}</pre>
    </div>
  )

  if (!svg) return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--z-muted)', fontSize: '11px' }}>
      Rendering diagram...
    </div>
  )

  return (
    <div>
      {title && (
        <div style={{
          fontSize: '11px', fontWeight: 600, color: 'var(--z-white)',
          marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {title}
        </div>
      )}
      <div
        ref={ref}
        style={{ width: '100%', overflowX: 'auto' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

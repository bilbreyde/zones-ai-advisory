/**
 * Fix common Mermaid syntax errors produced by LLM-generated diagrams.
 * Applied after JSON parse in both data-intelligence.js and index.js.
 */
export function fixMermaidChart(chart) {
  if (!chart || typeof chart !== 'string') return chart

  let fixed = chart.trim()

  // Ensure starts with graph TD
  if (!fixed.startsWith('graph TD') && !fixed.startsWith('graph LR')) {
    fixed = 'graph TD\n' + fixed
  }

  // Force graph TD (never LR — causes layout issues)
  fixed = fixed.replace(/^graph LR/m, 'graph TD')

  // Fix subgraph labels with brackets: "subgraph ID [Label]" → "subgraph ID"
  // The bracket label syntax causes parse errors in this renderer
  fixed = fixed.replace(/^(\s*subgraph\s+\w+)\s+\[([^\]]+)\]/gm, '$1')

  // Fix subgraph IDs with spaces or special chars — keep only word chars
  fixed = fixed.replace(/^(\s*subgraph\s+)([^\n]+)/gm, (match, prefix, id) => {
    const cleanId = id.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
    return prefix + cleanId
  })

  // Remove style/classDef/class statements (cause parse errors in this renderer)
  fixed = fixed.replace(/^\s*style\s+.*$/gm, '')
  fixed = fixed.replace(/^\s*classDef\s+.*$/gm, '')
  fixed = fixed.replace(/^\s*class\s+.*$/gm, '')

  // Collapse triple+ blank lines left behind by removals
  fixed = fixed.replace(/\n{3,}/g, '\n\n')

  return fixed.trim()
}

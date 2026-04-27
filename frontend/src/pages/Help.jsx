import { useState, useEffect, useRef } from 'react'
import './Help.css'

const SECTIONS = [
  { id: 'intro',        label: 'Introduction' },
  { id: 'stages',       label: '6-Stage Engagement Model' },
  { id: 'prep',         label: 'Before Your Client Meeting' },
  { id: 'assessment',   label: 'Running the Assessment' },
  { id: 'review',       label: 'Assessment Review' },
  { id: 'ai-chat',      label: 'AI Advisory Assistant' },
  { id: 'results',      label: 'Results Page & Deliverables' },
  { id: 'agents',       label: 'Agent Design Studio' },
  { id: 'reference',    label: 'Quick Reference' },
  { id: 'troubleshoot', label: 'Troubleshooting' },
]

const PILLARS = [
  { id: 'governance',  label: 'Governance',        color: '#4A9FE0' },
  { id: 'risk',        label: 'Risk & Compliance',  color: '#E8A838' },
  { id: 'strategy',    label: 'AI Strategy',        color: '#8B5CF6' },
  { id: 'operations',  label: 'Operations',         color: '#3DBA7E' },
  { id: 'enablement',  label: 'Enablement',         color: '#EC4899' },
]

function PillarPill({ id, label, color }) {
  return (
    <span className="pillar-pill" style={{ background: color + '22', color, borderColor: color + '55' }}>
      {label}
    </span>
  )
}

function ScoreBadge({ score, label }) {
  const color = score >= 4 ? '#3DBA7E' : score >= 3 ? '#4A9FE0' : score >= 2 ? '#E8A838' : '#EF4444'
  return (
    <span className="score-badge" style={{ background: color + '22', color, borderColor: color + '55' }}>
      {score}/5 {label}
    </span>
  )
}

export default function Help() {
  const [activeId, setActiveId] = useState('intro')
  const [query, setQuery] = useState('')
  const sectionRefs = useRef({})
  const contentRef = useRef(null)

  // IntersectionObserver to track active section
  useEffect(() => {
    const observers = []
    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id]
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(id) },
        { root: contentRef.current, rootMargin: '-20% 0px -70% 0px', threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [query])

  const q = query.toLowerCase().trim()

  function isVisible(sectionId) {
    if (!q) return true
    const el = sectionRefs.current[sectionId]
    return el ? el.textContent.toLowerCase().includes(q) : true
  }

  function scrollTo(id) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="help-layout">
      {/* Left TOC */}
      <aside className="help-toc">
        <div className="toc-title">User Guide</div>
        <div className="toc-search-wrap">
          <input
            className="toc-search"
            placeholder="Search guide..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <nav>
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              className={`toc-item${activeId === id ? ' active' : ''}${!isVisible(id) ? ' hidden' : ''}`}
              onClick={() => scrollTo(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="help-content" ref={contentRef}>

        {/* ── Introduction ─────────────────────────────────────────── */}
        <section
          id="intro"
          className={`help-section${!isVisible('intro') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['intro'] = el}
        >
          <div className="section-header">
            <h2>Introduction</h2>
            <p>The Zones AI Advisory Framework is a structured sales and consulting tool that helps you assess a client's AI readiness across five pillars, generate executive-grade deliverables, and identify AI agent opportunities — all within a single session.</p>
            <p style={{ marginTop: 8 }}>The tool is infrastructure-aware — it understands whether clients are cloud-native, hybrid, on-premises, or air-gapped, and adjusts all agent recommendations accordingly. Compliance requirements like HIPAA, FedRAMP, and GDPR are factored into every agent blueprint.</p>
          </div>

          <div className="help-tip">
            <strong>Designed for:</strong> Zones sales engineers, account executives, and solution architects conducting AI Advisory engagements with enterprise clients.
          </div>

          <h3>The Five Pillars</h3>
          <p>Every client is assessed across five dimensions of AI readiness:</p>
          <div className="pillar-grid">
            {PILLARS.map(p => (
              <div key={p.id} className="pillar-card" style={{ borderLeftColor: p.color }}>
                <PillarPill id={p.id} label={p.label} color={p.color} />
                <p className="pillar-card-desc">
                  {p.id === 'governance' && 'Policies, oversight structures, AI ethics guidelines, and responsible AI frameworks.'}
                  {p.id === 'risk' && 'Data privacy, regulatory compliance, security controls, and risk management processes.'}
                  {p.id === 'strategy' && 'Executive alignment, AI roadmap, investment appetite, and competitive positioning.'}
                  {p.id === 'operations' && 'MLOps maturity, infrastructure readiness, data pipelines, and deployment capability.'}
                  {p.id === 'enablement' && 'Workforce upskilling, change management, AI literacy, and adoption culture.'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6-Stage Engagement Model ─────────────────────────────── */}
        <section
          id="stages"
          className={`help-section${!isVisible('stages') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['stages'] = el}
        >
          <div className="section-header">
            <h2>6-Stage Engagement Model</h2>
            <p>A complete engagement flows through six stages, typically completed in 60–90 minutes.</p>
          </div>

          <div className="step-list">
            {[
              { num: 1, title: 'Client Setup', desc: 'Create or select the client record. Set the industry, company size, and session context. All AI-generated content is scoped to this client.' },
              { num: 2, title: 'Pillar Assessment', desc: 'Score the client 1–5 on each question across all five pillars. Use the discovery questions as conversation guides, not strict scripts.' },
              { num: 3, title: 'AI Analysis', desc: 'The AI Advisory Assistant analyzes scores in real time. Ask it to surface gaps, generate executive summaries, or produce architecture visuals.' },
              { num: 4, title: 'Results & Roadmap', desc: 'The Results page shows the overall maturity score, pillar breakdown, prioritized recommendations, and a 4-phase next-step roadmap.' },
              { num: 5, title: 'Action Planning', desc: 'Click any recommendation card to generate an AI-driven action plan with Gantt chart, RACI matrix, risk heatmap, and narrative context blocks.' },
              { num: 6, title: 'Agent Design', desc: 'Use the Agent Design Studio to identify and blueprint AI agents that match the client\'s gaps, tools, deployment model, and transformation readiness.' },
            ].map((step, i, arr) => (
              <div key={step.num} className="step-row">
                <div className="step-left">
                  <div className="step-circle" style={{ borderColor: 'var(--z-blue)' }}>{step.num}</div>
                  {i < arr.length - 1 && <div className="step-vline" />}
                </div>
                <div className="step-body">
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Before Your Client Meeting ────────────────────────────── */}
        <section
          id="prep"
          className={`help-section${!isVisible('prep') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['prep'] = el}
        >
          <div className="section-header">
            <h2>Before Your Client Meeting</h2>
            <p>Preparation ensures the session flows naturally and the outputs look polished when shared.</p>
          </div>

          <h3>Create the Client Record</h3>
          <ol className="help-ol">
            <li>Navigate to <strong>Clients</strong> in the sidebar.</li>
            <li>Click <strong>+ New Client</strong> and enter the company name, industry, and size.</li>
            <li>Click <strong>Start Session</strong> — this sets the active client context used by all AI features.</li>
          </ol>

          <div className="help-tip">
            The active client appears in the bottom-left of the sidebar. Every AI-generated output, action plan, and agent blueprint is stored against this client record.
          </div>

          <h3>Know Your Pillar Focus</h3>
          <p>Review any LinkedIn, 10-K, or prior discovery notes to estimate where the client likely scores low. Pre-identify 1–2 pillars to probe more deeply — this shapes which AI visuals will be most compelling.</p>

          <h3>Technical Checklist</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Item</th><th>Why It Matters</th></tr>
              </thead>
              <tbody>
                <tr><td>Stable internet connection</td><td>All AI calls go to Azure OpenAI in real time</td></tr>
                <tr><td>Screen resolution ≥ 1280px wide</td><td>Three-column layout collapses below this width</td></tr>
                <tr><td>Chrome or Edge recommended</td><td>html2canvas PDF export is most reliable in Chromium</td></tr>
                <tr><td>Backend service running</td><td>Run <code>npm start</code> in <code>/backend</code> before the session</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Running the Assessment ────────────────────────────────── */}
        <section
          id="assessment"
          className={`help-section${!isVisible('assessment') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['assessment'] = el}
        >
          <div className="section-header">
            <h2>Running the Assessment</h2>
            <p>Navigate to any pillar from the sidebar. Each pillar contains 4–5 scored questions and a set of discovery conversation guides.</p>
          </div>

          <h3>Scoring Scale</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Score</th><th>Meaning</th><th>Typical Signal</th></tr>
              </thead>
              <tbody>
                <tr><td><ScoreBadge score={1} label="" /></td><td>Not started</td><td>No policies, no tooling, no ownership</td></tr>
                <tr><td><ScoreBadge score={2} label="" /></td><td>Early / Ad hoc</td><td>Some awareness, no formal process</td></tr>
                <tr><td><ScoreBadge score={3} label="" /></td><td>Developing</td><td>Defined process, inconsistently applied</td></tr>
                <tr><td><ScoreBadge score={4} label="" /></td><td>Managed</td><td>Repeatable, measured, cross-functional</td></tr>
                <tr><td><ScoreBadge score={5} label="" /></td><td>Optimizing</td><td>Continuous improvement, industry-leading</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Using Discovery Questions</h3>
          <p>Each question includes suggested discovery prompts. These are conversation starters, not a rigid script. Use them to guide the client toward self-assessment rather than telling them their score.</p>

          <div className="help-tip">
            <strong>Tip:</strong> If a client scores themselves 4 or 5 on a question, probe with: "Can you walk me through the last time that process was actually tested?" — this often reveals gaps that lower the score to a more accurate 3.
          </div>

          <h3>Saving Scores</h3>
          <p>Scores are saved automatically as you click the rating buttons. The radar chart on the Dashboard updates in real time. You do not need to click Save between pillars.</p>

          <h3>Pillar Navigation</h3>
          <p>Use the Framework Pillars section in the sidebar to jump between pillars in any order. You can return to update scores at any point during the session.</p>
        </section>

        {/* ── Assessment Review ─────────────────────────────────────── */}
        <section
          id="review"
          className={`help-section${!isVisible('review') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['review'] = el}
        >
          <div className="section-header">
            <h2>Assessment Review</h2>
            <p>The Assessment Review page (accessible via <strong>Assessment Review</strong> in the sidebar under Outputs) shows a complete overview of all answered questions across all 5 pillars. It is not a restart screen — it shows the client's current answers and lets you update any individual response without losing progress.</p>
          </div>

          <h3>How It Works</h3>
          <div className="step-list">
            {[
              { num: 1, title: 'See everything at once', desc: 'All 5 pillars are shown expanded with every question and its current answer. Unanswered questions are highlighted in amber so gaps are immediately visible.' },
              { num: 2, title: 'Update answers inline', desc: 'Click "Change" or "Answer" on any question to update it inline — the answer options appear without navigating away. No page reload needed.' },
              { num: 3, title: 'Enter full pillar flow if needed', desc: 'Click "Edit all" on any pillar header to enter the full question-by-question flow for that pillar only. You\'ll return to the Assessment Review when done.' },
              { num: 4, title: 'Scores update in real time', desc: 'Pillar scores and the overall completion progress bar update immediately after each answer change. A "Complete" badge appears when all questions in a pillar are answered.' },
            ].map((step, i, arr) => (
              <div key={step.num} className="step-row">
                <div className="step-left">
                  <div className="step-circle" style={{ borderColor: 'var(--z-blue)' }}>{step.num}</div>
                  {i < arr.length - 1 && <div className="step-vline" />}
                </div>
                <div className="step-body">
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="help-tip">
            <strong>Best practice:</strong> Use the Assessment Review at the start of each return session to review what was captured last time and update anything that has changed. It is the fastest way to bring a returning client record up to date.
          </div>

          <h3>Score Badge and Maturity Stage</h3>
          <p>The top-right of the page shows the client's current overall score and named maturity stage (e.g., "AI Aware", "AI Enabled"). This updates live as you change answers, making it easy to show the client how specific responses affect their overall readiness level.</p>
        </section>

        {/* ── AI Advisory Assistant ─────────────────────────────────── */}
        <section
          id="ai-chat"
          className={`help-section${!isVisible('ai-chat') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['ai-chat'] = el}
        >
          <div className="section-header">
            <h2>AI Advisory Assistant</h2>
            <p>The chat panel on the right side of every screen is your AI co-pilot. It is context-aware — it knows the active client, their scores, and the current page — and can generate visuals, analysis, and executive narratives on demand.</p>
          </div>

          <h3>What to Ask</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Prompt Type</th><th>Example</th><th>Output</th></tr>
              </thead>
              <tbody>
                <tr><td>Gap analysis</td><td>"What are their top 3 AI gaps?"</td><td>Narrative summary with pillar context</td></tr>
                <tr><td>Executive summary</td><td>"Write an exec summary for the CIO"</td><td>Formatted text with score context</td></tr>
                <tr><td>Architecture</td><td>"Show me a reference architecture for their AI platform"</td><td>Mermaid architecture diagram</td></tr>
                <tr><td>Vendor comparison</td><td>"Compare Azure AI vs AWS SageMaker for their needs"</td><td>Side-by-side comparison table</td></tr>
                <tr><td>Maturity journey</td><td>"Show the maturity journey from their current stage"</td><td>Milestone roadmap visual</td></tr>
                <tr><td>Agent Studio trigger</td><td>"What agents would benefit this client?"</td><td>Narrative + ⚡ Agent Studio button</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Visual Types</h3>
          <p>The AI can produce six types of rich visuals inline in the chat:</p>
          <ul className="help-ul">
            <li><strong>Reference Architecture</strong> — Mermaid diagram showing AI platform layers</li>
            <li><strong>Maturity Journey</strong> — Phase-by-phase progression milestones</li>
            <li><strong>RACI Matrix</strong> — Responsibility assignment for AI initiatives</li>
            <li><strong>Risk Heatmap</strong> — Severity × likelihood grid with mitigation notes</li>
            <li><strong>Process Flow</strong> — Mermaid flowchart of a specific AI workflow</li>
            <li><strong>Vendor Comparison</strong> — Feature grid comparing 2–4 platforms</li>
          </ul>

          <div className="help-tip">
            <strong>Agent Studio trigger:</strong> When you ask about AI agents or automation opportunities, the assistant surfaces a blue ⚡ button linking directly to the Agent Design Studio for the active client.
          </div>
        </section>

        {/* ── Results Page & Deliverables ───────────────────────────── */}
        <section
          id="results"
          className={`help-section${!isVisible('results') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['results'] = el}
        >
          <div className="section-header">
            <h2>Results Page &amp; Deliverables</h2>
            <p>The Results page aggregates all pillar scores into an executive-ready output with a maturity score, prioritized recommendations, and a next-step roadmap.</p>
          </div>

          <h3>Maturity Score</h3>
          <p>The overall score is the weighted average across all five pillars. It maps to a named stage:</p>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Score Range</th><th>Stage</th><th>Implication</th></tr>
              </thead>
              <tbody>
                <tr><td>1.0 – 1.9</td><td>AI Unaware</td><td>Foundational education and strategy needed first</td></tr>
                <tr><td>2.0 – 2.9</td><td>AI Aware</td><td>Proof-of-concept projects and governance basics</td></tr>
                <tr><td>3.0 – 3.9</td><td>AI Enabled</td><td>Scaling pilots, MLOps, cross-functional alignment</td></tr>
                <tr><td>4.0 – 4.9</td><td>AI Mature</td><td>Optimization, agentic AI, continuous improvement</td></tr>
                <tr><td>5.0</td><td>AI Leader</td><td>Industry benchmark, co-innovation opportunities</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Action Plans</h3>
          <p>Click any <strong>Recommendation card</strong> or <strong>Next Steps card</strong> to open the Action Plan panel. The AI generates a multi-visual plan anchored to the timeframe shown on the card (e.g., "30 Days", "Q2", "12 Months").</p>

          <ul className="help-ul">
            <li>The Gantt chart uses the card's timeframe as its total duration</li>
            <li>Narrative context blocks between visuals explain the "why" for each visual</li>
            <li>Use <strong>Download PDF</strong> to export a formatted, paginated deliverable</li>
          </ul>

          <div className="help-tip">
            <strong>PDF export tip:</strong> The PDF captures each section individually — narrative blocks, visuals, and charts — and paginates them correctly. Allow 5–10 seconds for complex plans with multiple diagrams.
          </div>

          <h3>Agent Studio CTA</h3>
          <p>At the bottom of the Results page, the <strong>"Design Agents for this Client"</strong> button launches the Agent Design Studio pre-loaded with the client's pillar gaps, keeping the context seamless.</p>
        </section>

        {/* ── Agent Design Studio ───────────────────────────────────── */}
        <section
          id="agents"
          className={`help-section${!isVisible('agents') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['agents'] = el}
        >
          <div className="section-header">
            <h2>Agent Design Studio</h2>
            <p>The Agent Design Studio generates tailored AI agent recommendations based on the client's full infrastructure profile — not just their cloud tools. The more context you provide, the more accurate and feasible the recommendations will be.</p>
          </div>

          <h3>How to Run an Agent Design Session</h3>
          <div className="step-list">
            {[
              { num: 1, title: 'Open Agent Studio and verify the client', desc: 'Navigate to Agent Studio in the sidebar. Confirm the active client shown in the top bar matches the client you are working with. The industry vertical is auto-populated from the client record.' },
              { num: 2, title: 'Set the industry vertical', desc: 'Select the client\'s primary industry from the dropdown. This scopes the agent catalog to industry-relevant workflows and surfaces vertical-specific tool categories in the tooling section.' },
              { num: 3, title: 'Set the deployment model', desc: 'Select how the client\'s infrastructure is primarily deployed. This is the most important configuration choice — it determines what agent architectures are feasible:\n• Cloud Native: all workloads in Azure, AWS, or GCP. Any cloud AI service can be used.\n• Hybrid: mix of cloud and on-premises. Agents are designed around Azure Arc and hybrid connectivity.\n• Primarily On-Premises: agents must run entirely in the client\'s data center. Cloud AI APIs are not the primary runtime.\n• Air-Gapped: fully isolated network. Only local model inference is possible. A warning banner appears to flag this constraint.' },
              { num: 4, title: 'Configure the full infrastructure stack', desc: 'Four sub-sections appear depending on the deployment model:\n\nCloud Tooling Stack — all cloud SaaS and PaaS tools, organized into categories: CRM, ERP, Cloud Platform, Data & Analytics, ITSM/PM, Collaboration, Security, HR/HCM, Finance, Supply Chain, Dev Tools, Document Management, and vertical-specific categories (EHR/Clinical for Healthcare, Retail/POS for Retail, Energy/OT for Energy). Each row has a "+ Add" button to add custom tools directly to that category.\n\nOn-Premises Infrastructure — appears for Hybrid, On-Premises, and Air-Gapped deployments. Categories: Compute, Data, Storage, Connectivity, Identity, AI/Inference.\n\nLegacy Systems — available for all deployment models. Covers Legacy ERP, Mainframe (IBM AS/400, COBOL), and Custom/Other legacy systems. Legacy systems are often the highest-value agent integration targets.\n\nCompliance & Data Residency — select applicable regulatory frameworks. Frameworks relevant to the selected vertical are highlighted. Selections constrain agent architecture: HIPAA prevents PHI from leaving the client\'s environment; FedRAMP/ITAR requires government cloud or on-prem; GDPR enforces EU data residency. Available frameworks: HIPAA, FedRAMP, ITAR, PCI-DSS, GDPR, SOC 2, ISO 27001, NIST AI RMF, CMMC, SOX.' },
              { num: 5, title: 'Choose focus areas', desc: 'Select which assessment pillars to prioritize for agent discovery. Pillars with lower scores are pre-highlighted as suggested focus areas. You can select all five or narrow to specific areas the client wants to address first.' },
              { num: 6, title: 'Generate agent recommendations', desc: 'Click "Generate Agent Recommendations". The AI returns a ranked list of agents grouped by implementation complexity: Quick Win, Strategic, and Complex. Each card shows a fit score, purpose, fit rationale, required tools, and — when relevant — a deployment note and compliance note specific to this client\'s configuration.' },
              { num: 7, title: 'Design a blueprint', desc: 'Click "Design →" on any agent card to generate a full implementation blueprint: agent spec table, architecture diagram (Mermaid), build-vs-buy analysis, and a phased implementation checklist — all with narrative context blocks for use in client presentations.' },
            ].map((step, i, arr) => (
              <div key={step.num} className="step-row">
                <div className="step-left">
                  <div className="step-circle" style={{ borderColor: 'var(--z-blue)' }}>{step.num}</div>
                  {i < arr.length - 1 && <div className="step-vline" />}
                </div>
                <div className="step-body">
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc" style={{ whiteSpace: 'pre-line' }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="help-tip" style={{ marginTop: 4 }}>
            <strong>Configuration is saved automatically.</strong> Everything you configure in the Agent Studio — deployment model, tooling stack, on-prem infrastructure, legacy systems, compliance frameworks — is saved to the client's profile in Cosmos DB. When you return to the studio for the same client, all selections are restored. The form collapses to a compact summary showing the key settings. Click "Edit configuration" to expand and make changes.
          </div>

          <h3>Agent Fit Score</h3>
          <p>The fit score (0–100) is calculated by the AI based on how closely the agent addresses the client's lowest-scoring pillars and how many of the required tools the client already has. Higher scores indicate both a critical gap and available tooling to implement.</p>

          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Score Range</th><th>Meaning</th></tr>
              </thead>
              <tbody>
                <tr><td>80–100</td><td>Critical gap + required tools already available — high priority recommendation</td></tr>
                <tr><td>60–79</td><td>Moderate gap or one missing tool — strong candidate with minor investment</td></tr>
                <tr><td>Below 60</td><td>Nice-to-have — relevant but not urgent given current gaps and tooling</td></tr>
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 12 }}>Each agent card also shows:</p>
          <ul className="help-ul">
            <li><strong>Deployment note</strong> — explains how the agent runs given the client's infrastructure model (e.g., "Deployable on-premises via Azure Arc; no cloud egress required")</li>
            <li><strong>Compliance note</strong> — flags any regulatory considerations specific to this client (e.g., "Must enforce HIPAA audit logging and PHI masking at inference layer")</li>
          </ul>
          <p>These notes are generated from the client's actual configuration — not generic templates.</p>

          <h3>Agent Backlog</h3>
          <p>Use the <strong>"Add to Backlog"</strong> button in any Design panel to save the agent to the client's backlog. The backlog appears in the right sidebar of the Discover view and persists in the client record in Cosmos DB. Use the status dropdown on each backlog item to track progress (Backlog → In Review → Approved → In Progress → Done).</p>

          <div className="help-tip">
            <strong>Presenting agents:</strong> Use the "Design →" panel in the meeting itself — the real-time generation creates a compelling live demo effect. Then export the PDF to leave behind as a formal blueprint.
          </div>
        </section>

        {/* ── Quick Reference ───────────────────────────────────────── */}
        <section
          id="reference"
          className={`help-section${!isVisible('reference') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['reference'] = el}
        >
          <div className="section-header">
            <h2>Quick Reference</h2>
            <p>Key shortcuts and data points to have ready during a client session.</p>
          </div>

          <h3>Navigation</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Destination</th><th>Sidebar Location</th></tr>
              </thead>
              <tbody>
                <tr><td>Overall scores &amp; radar</td><td>Overview → Dashboard</td></tr>
                <tr><td>Client records</td><td>Overview → Clients</td></tr>
                <tr><td>Individual pillar scoring</td><td>Framework Pillars → [Pillar name]</td></tr>
                <tr><td>Results &amp; action plans</td><td>Outputs → Results &amp; Roadmap</td></tr>
                <tr><td>All questions &amp; answers</td><td>Outputs → Assessment Review</td></tr>
                <tr><td>Agent blueprints</td><td>Outputs → Agent Studio</td></tr>
                <tr><td>This guide</td><td>Help &amp; Guide (bottom of sidebar)</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Common Actions</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Action</th><th>Where</th><th>Notes</th></tr>
              </thead>
              <tbody>
                <tr><td>Set deployment model</td><td>Agent Studio → Infrastructure &amp; Deployment Model</td><td>Determines feasible agent architectures</td></tr>
                <tr><td>Add on-prem infrastructure</td><td>Agent Studio → On-Premises Infrastructure section</td><td>Appears for Hybrid / On-Prem / Air-Gapped models</td></tr>
                <tr><td>Add legacy systems</td><td>Agent Studio → Legacy &amp; Custom Systems section</td><td>Flags high-value integration targets</td></tr>
                <tr><td>Set compliance requirements</td><td>Agent Studio → Compliance &amp; Data Residency</td><td>Constrains agent architecture to compliant designs</td></tr>
                <tr><td>Add custom tool to category</td><td>Agent Studio → any category row → + Add</td><td>Tool saved to that category, persists on return</td></tr>
                <tr><td>Review assessment answers</td><td>Assessment Review in sidebar</td><td>All 5 pillars with current answers, inline editing</td></tr>
                <tr><td>Update a single answer</td><td>Assessment Review → Change on any question</td><td>Saves immediately, scores update in real time</td></tr>
                <tr><td>Access user guide</td><td>Help &amp; Guide in sidebar</td><td>In-app documentation, always current</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Pillar Color Coding</h3>
          <div className="pillar-ref-grid">
            {PILLARS.map(p => (
              <div key={p.id} className="pillar-ref-item">
                <span className="pillar-ref-dot" style={{ background: p.color }} />
                <PillarPill id={p.id} label={p.label} color={p.color} />
              </div>
            ))}
          </div>

          <h3>Score Meanings at a Glance</h3>
          <div className="score-ref-row">
            {[1,2,3,4,5].map(s => <ScoreBadge key={s} score={s} label={['Not Started','Early','Developing','Managed','Optimizing'][s-1]} />)}
          </div>
        </section>

        {/* ── Troubleshooting ───────────────────────────────────────── */}
        <section
          id="troubleshoot"
          className={`help-section${!isVisible('troubleshoot') ? ' section-hidden' : ''}`}
          ref={el => sectionRefs.current['troubleshoot'] = el}
        >
          <div className="section-header">
            <h2>Troubleshooting</h2>
            <p>Common issues and how to resolve them.</p>
          </div>

          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Symptom</th><th>Likely Cause</th><th>Fix</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>AI chat returns no response</td>
                  <td>Backend not running or Azure OpenAI quota exceeded</td>
                  <td>Check backend terminal for errors; verify Azure OpenAI deployment is active</td>
                </tr>
                <tr>
                  <td>Visuals don't render in chat</td>
                  <td>JSON parsing error in AI response</td>
                  <td>Retry the same prompt — GPT-4o occasionally returns malformed JSON on the first attempt</td>
                </tr>
                <tr>
                  <td>Agent Studio shows no agents</td>
                  <td>No client selected or network error</td>
                  <td>Confirm a client is active (bottom-left of sidebar), then retry</td>
                </tr>
                <tr>
                  <td>PDF export is blank or cut off</td>
                  <td>html2canvas timed out on a large visual</td>
                  <td>Close any overlapping browser DevTools; try exporting in Chrome if using another browser</td>
                </tr>
                <tr>
                  <td>Action plan Gantt timeline is wrong</td>
                  <td>Stale panel state</td>
                  <td>Close the panel and re-click the recommendation card to re-trigger generation</td>
                </tr>
                <tr>
                  <td>Scores not saving between pillars</td>
                  <td>Cosmos DB connection issue</td>
                  <td>Check backend logs for Cosmos DB errors; confirm <code>COSMOS_CONNECTION_STRING</code> env var is set</td>
                </tr>
                <tr>
                  <td>Mermaid diagram shows "Syntax error"</td>
                  <td>AI generated invalid Mermaid syntax</td>
                  <td>Ask the assistant to regenerate: "Please redraw the architecture diagram"</td>
                </tr>
                <tr>
                  <td>Agent recommendations ignore on-prem tools</td>
                  <td>Deployment model set to Cloud Native</td>
                  <td>Set the deployment model to Hybrid or On-Premises before generating. Cloud Native mode only considers cloud tools.</td>
                </tr>
                <tr>
                  <td>Compliance frameworks not affecting recommendations</td>
                  <td>Compliance constraints apply to architecture notes, not ranking</td>
                  <td>Check the "compliance note" field on each agent card — compliance rules affect the agent design, not the fit score sort order.</td>
                </tr>
                <tr>
                  <td>Custom tool not persisting after return</td>
                  <td>Auto-save may have failed before navigating away</td>
                  <td>Custom tools added via "+ Add" are saved automatically. If lost, check your internet connection and re-add — the save toast will confirm when it commits.</td>
                </tr>
                <tr>
                  <td>Assessment Review shows all questions as unanswered</td>
                  <td>Client has not completed the assessment yet</td>
                  <td>Click "Answer" on any question to start inline, or use the Framework Pillars sidebar nav to run the full question flow for that pillar.</td>
                </tr>
                <tr>
                  <td>Air-gapped warning showing unexpectedly</td>
                  <td>Deployment model may be set to Air-Gapped in error</td>
                  <td>Click "Edit configuration" in Agent Studio and change the deployment model to the correct option. The warning disappears immediately.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="help-tip" style={{ marginTop: 24 }}>
            <strong>Still stuck?</strong> Check the browser console (F12 → Console) and backend terminal for error messages. Most issues surface a clear error code that points to the root cause.
          </div>
        </section>

      </div>
    </div>
  )
}

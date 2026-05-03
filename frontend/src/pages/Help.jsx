import { useState, useEffect, useRef } from 'react'
import './Help.css'

const SECTIONS = [
  { id: 'intro',             label: 'Introduction' },
  { id: 'env-profile',       label: 'Environment Profile' },
  { id: 'stages',            label: '6-Stage Engagement Model' },
  { id: 'prep',              label: 'Before Your Client Meeting' },
  { id: 'assessment',        label: 'Running the Assessment' },
  { id: 'review',            label: 'Assessment Review' },
  { id: 'ai-chat',           label: 'AI Advisory Assistant' },
  { id: 'results',           label: 'Results Page & Deliverables' },
  { id: 'agents',            label: 'Agent Design Studio' },
  { id: 'meeting-notes',     label: 'Meeting Notes' },
  { id: 'staleness',         label: 'Staleness Detection' },
  { id: 'data-intelligence', label: 'Data Intelligence' },
  { id: 'reference',         label: 'Quick Reference' },
  { id: 'troubleshoot',      label: 'Troubleshooting' },
]

const PILLARS = [
  { id: 'governance', label: 'Governance',       color: '#4A9FE0' },
  { id: 'risk',       label: 'Risk & Compliance', color: '#E8A838' },
  { id: 'strategy',   label: 'AI Strategy',       color: '#8B5CF6' },
  { id: 'operations', label: 'Operations',        color: '#3DBA7E' },
  { id: 'enablement', label: 'Enablement',        color: '#EC4899' },
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

      {/* ── Left TOC ─────────────────────────────────────────────── */}
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

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="help-content" ref={contentRef}>

        {/* ── Introduction ─────────────────────────────────────── */}
        <section
          id="intro"
          className={`help-section${!isVisible('intro') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['intro'] = el }}
        >
          <div className="section-header">
            <h2>Zones Compass</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 12, marginTop: 2, fontStyle: 'italic' }}>
              AI Advisory · Data Intelligence
            </p>
            <p>The Zones Compass platform helps advisors run structured client engagements, generate executive-quality deliverables, and design AI agents and data strategies — all from a single tool. It replaces ad-hoc discovery conversations with a repeatable, data-driven advisory process.</p>
            <p style={{ marginTop: 8 }}>The platform currently has two modules:</p>
            <ul className="help-ul" style={{ marginTop: 6 }}>
              <li><strong>AI Advisory</strong> — AI maturity assessments, agent design, and executive deliverables</li>
              <li><strong>Data Intelligence</strong> — data source inventory, consolidation strategy, and architecture blueprints</li>
            </ul>
            <p style={{ marginTop: 8 }}>Both modules share a unified client environment profile so information captured once is available everywhere.</p>
          </div>

          <div className="help-tip">
            <strong>Designed for:</strong> Zones sales engineers, account executives, and solution architects conducting AI Advisory and Data Intelligence engagements with enterprise clients.
          </div>

          <h3>The Five Pillars</h3>
          <p>Every client is assessed across five dimensions of AI readiness:</p>
          <div className="pillar-grid">
            {PILLARS.map(p => (
              <div key={p.id} className="pillar-card" style={{ borderLeftColor: p.color }}>
                <PillarPill id={p.id} label={p.label} color={p.color} />
                <p className="pillar-card-desc">
                  {p.id === 'governance'  && 'Policies, oversight structures, AI ethics guidelines, and responsible AI frameworks.'}
                  {p.id === 'risk'        && 'Data privacy, regulatory compliance, security controls, and risk management processes.'}
                  {p.id === 'strategy'    && 'Executive alignment, AI roadmap, investment appetite, and competitive positioning.'}
                  {p.id === 'operations'  && 'MLOps maturity, infrastructure readiness, data pipelines, and deployment capability.'}
                  {p.id === 'enablement'  && 'Workforce upskilling, change management, AI literacy, and adoption culture.'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Environment Profile ───────────────────────────────── */}
        <section
          id="env-profile"
          className={`help-section${!isVisible('env-profile') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['env-profile'] = el }}
        >
          <div className="section-header">
            <h2>⚙️ Environment Profile</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 10, marginTop: 0, fontStyle: 'italic' }}>Captured once, used everywhere</p>
            <p>The environment profile is the foundation of the entire platform. It captures the client's infrastructure reality and is shared between the AI Advisory assessment, Agent Studio, and Data Intelligence module. You complete it once — it never has to be re-entered.</p>
          </div>

          <h3>What It Captures</h3>
          <div className="step-list">
            {[
              {
                num: 1,
                title: 'Deployment Model',
                desc: 'How the client\'s infrastructure is primarily deployed:\n• Cloud Native — all workloads in Azure, AWS, or GCP\n• Hybrid — mix of cloud and on-premises\n• Primarily On-Premises — most workloads in their own data center\n• Air-Gapped — isolated network, no direct internet access',
              },
              {
                num: 2,
                title: 'Infrastructure & Tools',
                desc: 'The client\'s full cloud tooling stack across 14 categories: CRM, ERP, Cloud Platform, Data & Analytics, ITSM, Collaboration, Security, HR/HCM, Finance, Supply Chain, Dev Tools, Document Management, and vertical-specific categories like EHR/Clinical for Healthcare. Each category row has a "+ Add" button to add custom tools directly to that category.',
              },
              {
                num: 3,
                title: 'Compliance & Constraints',
                desc: 'Applicable regulatory frameworks: HIPAA, FedRAMP, ITAR, PCI-DSS, GDPR, SOC 2, ISO 27001, NIST AI RMF, CMMC, SOX.\n\nOperational constraints: data residency requirements, no external AI APIs, strict change control, vendor approval process.',
              },
              {
                num: 4,
                title: 'Legacy Systems',
                desc: 'Legacy ERP (SAP R/3, Oracle EBS, JD Edwards), Mainframe (IBM z/OS, AS/400, COBOL), and custom/other legacy systems. Legacy systems are flagged as high-value agent integration targets throughout the platform.',
              },
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

          <h3>Where to Access It</h3>
          <ul className="help-ul">
            <li>Automatically prompted before the first assessment question if not yet completed</li>
            <li><strong>"Edit Environment Profile"</strong> button in the Assessment Review header</li>
            <li><strong>"Edit profile"</strong> button in the Agent Studio banner</li>
            <li>Gear icon in the sidebar client widget</li>
          </ul>

          <h3>Why It Matters</h3>
          <p>The deployment model and compliance requirements directly constrain what the AI recommends. An air-gapped client gets only on-premises agent architectures. A HIPAA client gets recommendations that keep PHI within their environment. A client with AS/400 gets legacy integration patterns flagged in every agent blueprint.</p>

          <div className="help-tip">
            <strong>Update it when things change.</strong> If a client announces a cloud migration, new compliance obligation, or legacy system retirement — update the environment profile first. Every downstream recommendation adjusts immediately.
          </div>
        </section>

        {/* ── 6-Stage Engagement Model ──────────────────────────── */}
        <section
          id="stages"
          className={`help-section${!isVisible('stages') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['stages'] = el }}
        >
          <div className="section-header">
            <h2>6-Stage Engagement Model</h2>
            <p>A complete engagement flows through six stages, typically completed in 60–90 minutes.</p>
          </div>

          <div className="step-list">
            {[
              { num: 1, title: 'Client Setup',      desc: 'Create or select the client record. Set the industry, company size, and session context. All AI-generated content is scoped to this client.' },
              { num: 2, title: 'Pillar Assessment',  desc: 'Score the client 1–5 on each question across all five pillars. Use the discovery questions as conversation guides, not strict scripts.' },
              { num: 3, title: 'AI Analysis',        desc: 'The AI Advisory Assistant analyzes scores in real time. Ask it to surface gaps, generate executive summaries, or produce architecture visuals.' },
              { num: 4, title: 'Results & Roadmap',  desc: 'The Results page shows the overall maturity score, pillar breakdown, prioritized recommendations, and a 4-phase next-step roadmap.' },
              { num: 5, title: 'Action Planning',    desc: 'Click any recommendation card to generate an AI-driven action plan with Gantt chart, RACI matrix, risk heatmap, and narrative context blocks.' },
              { num: 6, title: 'Agent Design',       desc: 'Use the Agent Design Studio to identify and blueprint AI agents that match the client\'s gaps, tools, deployment model, and transformation readiness.' },
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

        {/* ── Before Your Client Meeting ────────────────────────── */}
        <section
          id="prep"
          className={`help-section${!isVisible('prep') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['prep'] = el }}
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

        {/* ── Running the Assessment ────────────────────────────── */}
        <section
          id="assessment"
          className={`help-section${!isVisible('assessment') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['assessment'] = el }}
        >
          <div className="section-header">
            <h2>📋 Running the Assessment</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 10, marginTop: 0, fontStyle: 'italic' }}>How to score a client across the 5 pillars</p>
          </div>

          <h3>Assessment Review Page</h3>
          <p>The Full Assessment page is now called <strong>Assessment Review</strong>. It shows a complete overview of all answered questions across all 5 pillars — it is not a restart screen.</p>
          <ul className="help-ul" style={{ marginTop: 8 }}>
            <li>All 5 pillars are shown expanded with every question and its current answer</li>
            <li>Unanswered questions are highlighted in amber</li>
            <li>Click <strong>"Change"</strong> or <strong>"Answer"</strong> on any question to update it inline — no page navigation needed</li>
            <li>Click <strong>"Edit all"</strong> on a pillar header to enter the full question-by-question flow for that specific pillar</li>
            <li>Pillar scores update immediately as answers change</li>
            <li>A <strong>"Complete"</strong> badge shows when all questions in a pillar are answered</li>
            <li>Answers sourced from meeting notes show a document icon — hover to see the source quote and date</li>
          </ul>

          <div className="help-tip">
            Use the Assessment Review at the start of each return session to review what was captured last time and update anything that has changed.
          </div>

          <h3>Environment-Aware Questions</h3>
          <p>If the client has an environment profile, additional questions are injected automatically based on their infrastructure:</p>
          <ul className="help-ul">
            <li><strong>Hybrid/On-Premises clients:</strong> additional Operations questions about on-prem AI deployment and data movement</li>
            <li><strong>Air-Gapped clients:</strong> questions about local model hosting and offline model update processes</li>
            <li><strong>Compliance-constrained clients:</strong> additional Risk questions about audit trails and data classification</li>
            <li><strong>Legacy system clients:</strong> Governance questions about AI policy coverage for legacy integrations</li>
          </ul>
          <p>An environment context banner appears at the top of the assessment showing the deployment model, compliance frameworks, and legacy system flags with an "Edit" link.</p>

          <h3>The Five Pillars</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Pillar</th><th>Questions</th><th>What It Measures</th></tr>
              </thead>
              <tbody>
                <tr><td><PillarPill id="governance" label="Governance" color="#4A9FE0" /></td><td>4–6</td><td>AI policies, ethics frameworks, oversight structures, responsible AI</td></tr>
                <tr><td><PillarPill id="risk" label="Risk & Compliance" color="#E8A838" /></td><td>4–6</td><td>Data privacy, regulatory compliance, security controls, risk management</td></tr>
                <tr><td><PillarPill id="strategy" label="AI Strategy" color="#8B5CF6" /></td><td>4–6</td><td>Executive alignment, AI roadmap, investment appetite, competitive positioning</td></tr>
                <tr><td><PillarPill id="operations" label="Operations" color="#3DBA7E" /></td><td>4–6</td><td>MLOps maturity, infrastructure readiness, data pipelines, deployment capability</td></tr>
                <tr><td><PillarPill id="enablement" label="Enablement" color="#EC4899" /></td><td>4–6</td><td>Workforce upskilling, change management, AI literacy, adoption culture</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Maturity Levels</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Answer</th><th>Meaning</th><th>Score</th></tr>
              </thead>
              <tbody>
                <tr><td>Not started</td><td>No policies, no tooling, no ownership</td><td>1</td></tr>
                <tr><td>In progress</td><td>Some awareness or early pilots underway</td><td>2–3</td></tr>
                <tr><td>Implemented</td><td>Formal process, consistently applied</td><td>4</td></tr>
                <tr><td>Optimized</td><td>Continuous improvement, measured, industry-leading</td><td>5</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Saving Scores</h3>
          <p>Scores are saved automatically as you click the rating buttons. The radar chart on the Dashboard updates in real time. You do not need to click Save between pillars.</p>
        </section>

        {/* ── Assessment Review ─────────────────────────────────── */}
        <section
          id="review"
          className={`help-section${!isVisible('review') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['review'] = el }}
        >
          <div className="section-header">
            <h2>Assessment Review</h2>
            <p>The Assessment Review page (accessible via <strong>Assessment Review</strong> in the sidebar under Outputs) shows a complete overview of all answered questions across all 5 pillars. It is not a restart screen — it shows the client's current answers and lets you update any individual response without losing progress.</p>
          </div>

          <div className="step-list">
            {[
              { num: 1, title: 'See everything at once',        desc: 'All 5 pillars are shown expanded with every question and its current answer. Unanswered questions are highlighted in amber so gaps are immediately visible.' },
              { num: 2, title: 'Update answers inline',          desc: 'Click "Change" or "Answer" on any question to update it inline — the answer options appear without navigating away. No page reload needed.' },
              { num: 3, title: 'Enter full pillar flow if needed', desc: 'Click "Edit all" on any pillar header to enter the full question-by-question flow for that pillar only. You\'ll return to Assessment Review when done.' },
              { num: 4, title: 'Scores update in real time',     desc: 'Pillar scores and the overall completion progress bar update immediately after each answer change. A "Complete" badge appears when all questions in a pillar are answered.' },
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
          <p>The top-right of the page shows the client's current overall score and named maturity stage (e.g., "AI Aware", "AI Enabled"). This updates live as you change answers.</p>
        </section>

        {/* ── AI Advisory Assistant ─────────────────────────────── */}
        <section
          id="ai-chat"
          className={`help-section${!isVisible('ai-chat') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['ai-chat'] = el }}
        >
          <div className="section-header">
            <h2>🤖 Using the AI Advisory Assistant</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 10, marginTop: 0, fontStyle: 'italic' }}>How to get the most out of the GPT-4o powered chat</p>
            <p>The AI assistant is fully environment-aware. It knows the client's deployment model, compliance requirements, legacy systems, and tooling stack — and uses all of it to give infrastructure-specific recommendations. An air-gapped client will never receive a recommendation that requires internet-connected AI APIs.</p>
          </div>

          <h3>No-Client Guard</h3>
          <p>When no client is selected, a banner appears in the chat panel: <em>"No client selected — responses are generic and not tailored to any client."</em> Select a client to get personalized recommendations.</p>

          <h3>Dynamic Starter Prompts</h3>
          <p>Starter prompts are generated from the client's actual profile — not a static list. The first prompt always targets the lowest-scoring pillar. Additional prompts reflect the deployment model and compliance requirements:</p>
          <ul className="help-ul">
            <li><strong>Air-gapped clients:</strong> "What AI agents can run fully on-premises with no internet dependency?"</li>
            <li><strong>HIPAA clients:</strong> "How do we ensure our AI initiatives are HIPAA compliant?"</li>
            <li><strong>Legacy systems:</strong> "How do we bridge our AS/400 to modern AI workflows?"</li>
            <li><strong>Hybrid clients:</strong> "How do we design AI agents that work across cloud and on-premises?"</li>
          </ul>

          <h3>Strategic Questions — Comprehensive Responses</h3>
          <p>When you ask a strategic question (plan, roadmap, architecture, detailed, step by step, improve), the assistant automatically generates a comprehensive multi-visual response with up to 8 sections:</p>
          <ol className="help-ol">
            <li>Problem diagnosis — specific to the client's environment and tools</li>
            <li>Multi-agent coordination model — Supervisor/Planner/Executor patterns</li>
            <li>Target architecture — all layers with their actual tool names</li>
            <li>Operating model RACI — who owns agents across the organization</li>
            <li>Enablement engine — training, patterns, marketplace, governance</li>
            <li>90-day execution plan — tied to their actual maturity scores</li>
            <li>Multi-cloud strategy — if they have multiple cloud platforms</li>
            <li>Financial model — investment, ROI, and payback period</li>
          </ol>

          <h3>Staleness-Aware Opening Message</h3>
          <p>When the advisor opens the chat for a client whose profile is more than 45 days old, the AI opening message includes a check-in question generated from the client's industry and profile — prompting the advisor to update before diving into recommendations.</p>

          <h3>Export Options</h3>
          <ul className="help-ul">
            <li><strong>"↓ Export PDF"</strong> — exports that specific response as a branded PDF</li>
            <li><strong>"⤢ Open full analysis"</strong> — opens the response in a full-width panel (appears when 3+ visuals)</li>
            <li><strong>"Download full conversation"</strong> button at the bottom exports the entire session</li>
          </ul>

          <h3>Prompt Reference</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>What You Want</th><th>What to Type</th><th>Visual Output</th></tr>
              </thead>
              <tbody>
                <tr><td>Gap analysis</td><td>"What are their top 3 AI gaps?"</td><td>Narrative summary with pillar context</td></tr>
                <tr><td>Executive summary</td><td>"Write an exec summary for the CIO"</td><td>Formatted text with score context</td></tr>
                <tr><td>Architecture diagram</td><td>"Show me a reference architecture for their AI platform"</td><td>Mermaid architecture diagram</td></tr>
                <tr><td>Vendor comparison</td><td>"Compare Azure AI vs AWS SageMaker for their needs"</td><td>Side-by-side comparison table</td></tr>
                <tr><td>Maturity journey</td><td>"Show the maturity journey from their current stage"</td><td>Milestone roadmap visual</td></tr>
                <tr><td>Full action plan</td><td>"Give me a complete 90-day plan to fix their risk gaps"</td><td>Multi-visual: Gantt, RACI, scorecard, checklist</td></tr>
                <tr><td>Agent opportunities</td><td>"What agents would benefit this client?"</td><td>Narrative + ⚡ Agent Studio button</td></tr>
              </tbody>
            </table>
          </div>

          <div className="help-tip">
            <strong>Agent Studio trigger:</strong> When you ask about AI agents or automation opportunities, the assistant surfaces a blue ⚡ button linking directly to the Agent Design Studio for the active client.
          </div>
        </section>

        {/* ── Results Page & Deliverables ───────────────────────── */}
        <section
          id="results"
          className={`help-section${!isVisible('results') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['results'] = el }}
        >
          <div className="section-header">
            <h2>Results Page &amp; Deliverables</h2>
            <p>The Results page aggregates all pillar scores into an executive-ready output with a maturity score, prioritized recommendations, and a next-step roadmap.</p>
          </div>

          <h3>Maturity Score</h3>
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
          <p>Click any <strong>Recommendation card</strong> or <strong>Next Steps card</strong> to open the Action Plan panel. The AI generates a multi-visual plan anchored to the timeframe shown on the card.</p>
          <ul className="help-ul">
            <li>The Gantt chart uses the card's timeframe as its total duration</li>
            <li>Narrative context blocks between visuals explain the "why" for each section</li>
            <li>Use <strong>Download PDF</strong> to export a formatted, paginated deliverable</li>
          </ul>

          <div className="help-tip">
            <strong>PDF export tip:</strong> The PDF captures each section individually and paginates them correctly. Allow 5–10 seconds for complex plans with multiple diagrams.
          </div>

          <h3>Agent Studio CTA</h3>
          <p>At the bottom of the Results page, the <strong>"Design Agents for this Client"</strong> button launches the Agent Design Studio pre-loaded with the client's pillar gaps.</p>
        </section>

        {/* ── Agent Design Studio ───────────────────────────────── */}
        <section
          id="agents"
          className={`help-section${!isVisible('agents') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['agents'] = el }}
        >
          <div className="section-header">
            <h2>⚡ Agent Design Studio</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 10, marginTop: 0, fontStyle: 'italic' }}>Helping clients identify and design AI agents</p>
          </div>

          <h3>How It Works</h3>
          <p>The Agent Studio reads from the client's environment profile. If an environment profile exists, the configuration panel shows a green banner: <em>"Environment profile loaded from client record"</em> with a summary of the deployment model, tool count, and compliance requirements. No re-entry is needed.</p>
          <p style={{ marginTop: 8 }}>If no environment profile exists, an amber banner prompts: <em>"No environment profile found — complete the environment profile in Assessment Review for more accurate recommendations."</em></p>

          <h3>Configuration</h3>
          <ol className="help-ol">
            <li><strong>Industry Vertical</strong> — filters agent recommendations to sector-specific workflows</li>
            <li><strong>Deployment Model</strong> — Cloud Native / Hybrid / On-Premises / Air-Gapped. The most important setting — it determines what agent architectures are feasible. Air-gapped clients see a warning banner and only receive on-premises agent designs.</li>
            <li><strong>Cloud Tooling Stack</strong> — 14 categories with per-row "+ Add" buttons for custom tools</li>
            <li><strong>On-Premises Infrastructure</strong> — appears for Hybrid, On-Premises, and Air-Gapped. Categories: Compute, Data, Storage, Connectivity, Identity, AI/Inference</li>
            <li><strong>Legacy Systems</strong> — Legacy ERP, Mainframe, Custom/Other</li>
            <li><strong>Compliance &amp; Constraints</strong> — same frameworks as the environment profile</li>
          </ol>

          <h3>Saved Results</h3>
          <p>Agent recommendations are saved to the client record. When you return to Agent Studio, the last recommendations load automatically. A <strong>"↻ Regenerate"</strong> button appears to explicitly replace results. Results older than 90 days show a staleness warning.</p>

          <h3>Agent Fit Score</h3>
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

          <h3>Agent Blueprint</h3>
          <ul className="help-ul">
            <li><strong>Agent specification:</strong> trigger, inputs, outputs, tools, integrations, human-in-the-loop gates, latency, data requirements</li>
            <li><strong>Recommended AI model</strong> with rationale and hardware requirements (e.g. "Llama 3.1 70B — requires 2x NVIDIA A100 GPUs" for on-prem clients)</li>
            <li><strong>Deployment timeline:</strong> week-by-week breakdown</li>
            <li><strong>Architecture diagram:</strong> Mermaid diagram using only tools available in the client's environment</li>
            <li><strong>Build vs Alternatives:</strong> specific named products compared with compliance fit scores</li>
          </ul>

          <h3>Agent Backlog</h3>
          <p>The backlog is loaded fresh from Cosmos DB on every visit. Status tracking: Backlog → In Progress → Deployed. The backlog persists between sessions and survives page refreshes.</p>

          <div className="help-tip">
            <strong>Presenting agents:</strong> Use the "Design →" panel in the meeting itself — the real-time generation creates a compelling live demo effect. Then export the PDF to leave behind as a formal blueprint.
          </div>
        </section>

        {/* ── Meeting Notes ─────────────────────────────────────── */}
        <section
          id="meeting-notes"
          className={`help-section${!isVisible('meeting-notes') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['meeting-notes'] = el }}
        >
          <div className="section-header">
            <h2>📝 Meeting Notes &amp; Dynamic Profile Updates</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 10, marginTop: 0, fontStyle: 'italic' }}>Keep the client profile current without re-doing the assessment</p>
            <p>Click <strong>"Add Meeting Notes"</strong> in the Dashboard top bar. Paste a meeting transcript or notes — the AI extracts structured profile changes and proposes them for advisor review before anything is applied.</p>
          </div>

          <h3>What Gets Extracted</h3>
          <ol className="help-ol">
            <li><strong>Profile changes:</strong> new tools mentioned, deployment model shifts, new compliance requirements, legacy system announcements</li>
            <li><strong>Assessment answer changes:</strong> statements that map to specific assessment questions (e.g. "we deployed a formal AI risk framework last quarter" → Risk &amp; Compliance Q3 moves to "Implemented")</li>
          </ol>

          <h3>Review Before Applying</h3>
          <p>All proposed changes are shown as a diff — nothing is applied without advisor confirmation:</p>
          <ul className="help-ul">
            <li><strong>Profile changes</strong> show: what changed, what it changed to, the exact quote from the notes, and a confidence level (high/medium/low)</li>
            <li><strong>Assessment changes</strong> show: the question text, current answer, proposed answer, the evidence quote, and the reason for the mapping</li>
          </ul>
          <p>Low-confidence suggestions are visually distinct — they prompt the advisor to probe rather than assume.</p>

          <h3>Conservative Rules</h3>
          <p>The AI never downgrades an answer — it only moves answers forward. <em>"We deployed"</em> maps to "Implemented." <em>"We've been improving for years"</em> maps to "Optimized." It never assigns Optimized without clear evidence of sustained excellence.</p>

          <h3>Session History</h3>
          <p>Every meeting note session is saved with: date, participants, raw notes, AI summary, and applied changes. The Session History panel on the Dashboard shows the last 5 sessions, creating a full audit trail of how the client profile evolved.</p>

          <h3>Answers Sourced from Meeting Notes</h3>
          <p>Assessment answers applied from meeting notes show a small document icon in the Assessment Review page. Hover to see the source quote and date applied.</p>

          <div className="help-tip">
            <strong>Best use:</strong> Run meeting notes after every client touchpoint. The 5-minute note processing keeps the profile current and creates a timestamped record that is invaluable when revisiting the engagement months later.
          </div>
        </section>

        {/* ── Staleness Detection ───────────────────────────────── */}
        <section
          id="staleness"
          className={`help-section${!isVisible('staleness') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['staleness'] = el }}
        >
          <div className="section-header">
            <h2>🕐 Staleness Detection</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 10, marginTop: 0, fontStyle: 'italic' }}>The platform tells you when client data needs a refresh</p>
            <p>The platform monitors how recently each part of the client profile was updated and surfaces contextual prompts — not nagging notifications.</p>
          </div>

          <h3>Thresholds</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Data Type</th><th>Staleness Threshold</th></tr>
              </thead>
              <tbody>
                <tr><td>Assessment answers</td><td>45 days</td></tr>
                <tr><td>Compliance requirements</td><td>60 days</td></tr>
                <tr><td>Tooling stack</td><td>90 days</td></tr>
                <tr><td>Overall profile</td><td>90 days</td></tr>
                <tr><td>Session notes</td><td>30 days</td></tr>
                <tr><td>Deployment model</td><td>120 days</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Where Staleness Appears</h3>
          <ul className="help-ul">
            <li><strong>Dashboard:</strong> A single calm banner when data is stale. Shows days since last update, a dynamically generated check-in question based on the client's industry and profile, and an "Update profile" button. Dismissible per session.</li>
            <li><strong>AI Chat:</strong> When the advisor opens the chat for a stale client, the AI's opening message includes a check-in question specific to the client — a healthcare client is asked about regulatory changes, a manufacturing client about OT/IT convergence, a hybrid client about cloud adoption progress.</li>
            <li><strong>Agent Studio:</strong> A warning banner before generating recommendations if the environment profile is stale. Options: "Update profile" or "Continue anyway."</li>
          </ul>

          <div className="help-tip">
            <strong>Resetting the clock:</strong> Opening the environment profile modal and clicking Save (even without changes) resets the staleness timestamp. If a client's environment is genuinely stable, this confirms the data is still accurate — it does not just suppress the warning.
          </div>
        </section>

        {/* ── Data Intelligence ─────────────────────────────────── */}
        <section
          id="data-intelligence"
          className={`help-section${!isVisible('data-intelligence') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['data-intelligence'] = el }}
        >
          <div className="section-header">
            <h2>🗄️ Data Intelligence</h2>
            <p style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 10, marginTop: 0, fontStyle: 'italic' }}>Zones Compass module for data consolidation strategy</p>
            <p>The Data Intelligence module helps advisors run structured data consolidation engagements — identifying what data sources need to be reconciled, classifying the type of data sprawl, and recommending the architecture pattern that best fits the client's environment and requirements.</p>
          </div>

          <h3>Entry Points</h3>
          <ol className="help-ol">
            <li><strong>Sidebar:</strong> "Data Intelligence" under "COMPASS MODULES" — works standalone or linked to a client</li>
            <li><strong>Dashboard prompt:</strong> appears automatically when the client's Operations score is below 3.0</li>
            <li><strong>Assessment Review:</strong> "Data Intelligence" button in the page header</li>
          </ol>

          <h3>Two Modes</h3>
          <ul className="help-ul">
            <li><strong>Linked mode:</strong> ties the session to the selected client, imports their environment profile, and feeds results back into the assessment scores.</li>
            <li><strong>Standalone mode:</strong> runs independently for reporting-only engagements or prospect discovery. No client record required.</li>
          </ul>

          <h3>Two Scales</h3>
          <ul className="help-ul">
            <li><strong>Focused (under 15 sources):</strong> card-based inventory, single-page view. Best for SMB and mid-market clients.</li>
            <li><strong>Enterprise (15+ sources):</strong> domain-tabbed inventory (Customer Data / Financial / Operational / HR / Supply Chain / Infrastructure / Other), bulk import option. Best for large or complex environments.</li>
          </ul>

          <h3>The 5-Stage Process</h3>
          <div className="step-list">
            {[
              {
                num: 1,
                title: 'Setup',
                desc: 'Select linked or standalone mode, select focused or enterprise scale.',
              },
              {
                num: 2,
                title: 'Data Source Inventory',
                desc: 'Map every system that contains data the client uses. For each source: name, category, data owner, volume, update frequency, API availability, primary consumers, known issues.\n\nIf the client has an environment profile, an "Import all" button pre-populates the inventory from their known tools — each imported source is flagged "Review needed" until the advisor fills in volume, frequency, and owner.',
              },
              {
                num: 3,
                title: 'Classification',
                desc: 'The AI analyzes the inventory and produces a 4-dimension Data Health Profile:\n• Duplication (1-5): same data in multiple systems with no master record\n• Fragmentation (1-5): related data split across systems that must be joined for analysis\n• Latency (1-5): data freshness vs consumer needs mismatch\n• Governance (1-5): lineage, classification, and access control gaps\n\nFindings are listed with severity (critical/warning/info), exact systems involved, and business impact.',
              },
              {
                num: 4,
                title: 'Requirements',
                desc: 'Primary goal, timeline pressure, budget range, team data capability, existing investments to preserve, and compliance requirements. All pre-populated from the environment profile where possible.',
              },
              {
                num: 5,
                title: 'Blueprint',
                desc: 'Three outputs generated simultaneously:\n1. Solution recommendation: primary pattern with rationale, what it solves, what it does not solve, specific named products (with "already have" badge if the client owns them), and complexity rating\n2. Architecture diagram: Mermaid diagram showing source → integration → consumption → governance layers\n3. Implementation roadmap: 3-phase Gantt with specific tasks, owners, durations, and outputs\n4. Investment summary: cost ranges, ROI estimates, and Year 1 total',
              },
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

          <h3>Solution Patterns</h3>
          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Pattern</th><th>Best For</th><th>Key Products</th></tr>
              </thead>
              <tbody>
                <tr><td>Data Fabric</td><td>Heterogeneous sources, compliance requirements, semantic layer needs</td><td>Microsoft Fabric, IBM Watson Knowledge Catalog, Informatica IDMC</td></tr>
                <tr><td>Data Lakehouse</td><td>Analytics-heavy, large volume, strong data engineering team</td><td>Databricks Unity Catalog, Snowflake, Microsoft Fabric</td></tr>
                <tr><td>Data Mesh</td><td>Large enterprises with domain teams who own data products</td><td>Atlan, Collibra + cloud platform</td></tr>
                <tr><td>Unified API Layer</td><td>Real-time operational intelligence and AI agent consumption</td><td>Azure API Management + Event Grid, MuleSoft, Kong</td></tr>
                <tr><td>MDM</td><td>Duplicate entity records (customer, product, employee)</td><td>Informatica MDM, SAP MDM, Microsoft Purview</td></tr>
                <tr><td>Event-Driven Integration</td><td>Real-time sync across operational systems</td><td>Azure Event Grid, Apache Kafka, Azure Service Bus</td></tr>
                <tr><td>Optimize Existing</td><td>Client already has the right platform — focus on configuration and adoption</td><td>Snowflake, Databricks, Microsoft Fabric (already owned)</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Optimize Existing Path</h3>
          <p>If the AI detects the client already has the right tools (Snowflake, Databricks, Microsoft Fabric), it recommends configuration and adoption rather than a new platform purchase. Quick wins are listed as specific configuration changes that deliver immediate value.</p>

          <h3>Saved Results</h3>
          <p>Results are saved automatically when the blueprint generates. Returning to the module loads the last session directly — the advisor lands on the blueprint, not the setup screen.</p>
          <ul className="help-ul">
            <li><strong>"Edit inventory &amp; re-run"</strong> — goes back to Stage 2 with existing sources pre-loaded</li>
            <li><strong>"Start new assessment"</strong> — clears and restarts with a confirmation step</li>
          </ul>

          <h3>Assessment Feedback</h3>
          <p>In linked mode, the module proposes assessment answer updates based on its findings (same confirmation flow as meeting notes — the advisor reviews before changes apply):</p>
          <ul className="help-ul">
            <li>High fragmentation → Operations: "Do you have standardized data pipelines?" flagged</li>
            <li>Low governance score → Risk: "Is there a data classification policy?" flagged</li>
            <li>No data strategy detected → Strategy: "Do you have a data strategy aligned to business goals?" flagged</li>
          </ul>

          <div className="help-tip">
            <strong>Start with Focused mode</strong> even for large clients — you can switch to Enterprise scale if the inventory grows beyond 15 sources. Focused mode produces cleaner, faster blueprints for most mid-market engagements.
          </div>
        </section>

        {/* ── Quick Reference ───────────────────────────────────── */}
        <section
          id="reference"
          className={`help-section${!isVisible('reference') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['reference'] = el }}
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
                <tr><td>Data Intelligence module</td><td>Compass Modules → Data Intelligence</td></tr>
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
                <tr><td>Complete environment profile</td><td>Before first assessment or via Edit button</td><td>Deployment model, tools, compliance, legacy systems saved to client record</td></tr>
                <tr><td>Edit environment profile</td><td>Assessment Review header → Edit Environment Profile</td><td>Modal pre-filled with current settings</td></tr>
                <tr><td>View Assessment Review</td><td>Assessment Review in sidebar</td><td>All 5 pillars with current answers, inline editing</td></tr>
                <tr><td>Update a single answer</td><td>Assessment Review → Change on any question</td><td>Saves immediately, scores update in real time</td></tr>
                <tr><td>Add meeting notes</td><td>Dashboard → Add Meeting Notes button</td><td>AI extracts profile and assessment changes for review</td></tr>
                <tr><td>Run Data Intelligence</td><td>Data Intelligence in sidebar (Compass Modules)</td><td>5-stage wizard, architecture blueprint, investment summary</td></tr>
                <tr><td>Access saved DI results</td><td>Data Intelligence → loads automatically</td><td>Last session restored, no re-assessment needed</td></tr>
                <tr><td>Set deployment model</td><td>Agent Studio → Infrastructure &amp; Deployment Model</td><td>Determines feasible agent architectures</td></tr>
                <tr><td>Add on-prem infrastructure</td><td>Agent Studio → On-Premises Infrastructure section</td><td>Appears for Hybrid / On-Prem / Air-Gapped models</td></tr>
                <tr><td>Add legacy systems</td><td>Agent Studio → Legacy &amp; Custom Systems section</td><td>Flags high-value integration targets</td></tr>
                <tr><td>Set compliance requirements</td><td>Agent Studio → Compliance &amp; Data Residency</td><td>Constrains agent architecture to compliant designs</td></tr>
                <tr><td>Add custom tool to category</td><td>Agent Studio → any category row → + Add</td><td>Tool saved to that category, persists on return</td></tr>
                <tr><td>Regenerate agent recommendations</td><td>Agent Studio → ↻ Regenerate button</td><td>Confirmation required — replaces saved results</td></tr>
                <tr><td>Regenerate DI blueprint</td><td>Data Intelligence → Edit inventory &amp; re-run</td><td>Goes to Stage 2, existing sources pre-loaded</td></tr>
                <tr><td>Export AI chat as PDF</td><td>Chat panel → ↓ Export PDF on any visual response</td><td>Branded PDF with narrative and visuals</td></tr>
                <tr><td>Export full conversation</td><td>Chat panel → Download full conversation button</td><td>All responses and visuals in one PDF</td></tr>
                <tr><td>Open full analysis</td><td>Chat panel → ⤢ Open full analysis (3+ visuals)</td><td>Full-width panel, easier to read and export</td></tr>
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
            {[1,2,3,4,5].map(s => (
              <ScoreBadge key={s} score={s} label={['Not Started','Early','Developing','Managed','Optimizing'][s-1]} />
            ))}
          </div>
        </section>

        {/* ── Troubleshooting ───────────────────────────────────── */}
        <section
          id="troubleshoot"
          className={`help-section${!isVisible('troubleshoot') ? ' section-hidden' : ''}`}
          ref={el => { sectionRefs.current['troubleshoot'] = el }}
        >
          <div className="section-header">
            <h2>Troubleshooting</h2>
            <p>Common issues and how to resolve them.</p>
          </div>

          <div className="help-table-wrap">
            <table className="help-table">
              <thead>
                <tr><th>Symptom</th><th>Fix</th></tr>
              </thead>
              <tbody>
                <tr><td>AI chat returns no response</td><td>Check backend terminal for errors; verify Azure OpenAI deployment is active and quota is not exceeded</td></tr>
                <tr><td>Visuals don't render in chat</td><td>Retry the same prompt — GPT-4o occasionally returns malformed JSON on the first attempt</td></tr>
                <tr><td>Agent Studio shows no agents</td><td>Confirm a client is active (bottom-left of sidebar), then retry</td></tr>
                <tr><td>PDF export is blank or cut off</td><td>Close any overlapping browser DevTools; try exporting in Chrome if using another browser</td></tr>
                <tr><td>Action plan Gantt timeline is wrong</td><td>Close the panel and re-click the recommendation card to re-trigger generation</td></tr>
                <tr><td>Scores not saving between pillars</td><td>Check backend logs for Cosmos DB errors; confirm <code>COSMOS_CONNECTION_STRING</code> env var is set</td></tr>
                <tr><td>Mermaid diagram shows "Syntax error"</td><td>Ask the assistant to regenerate: "Please redraw the architecture diagram." The backend auto-fixes most common Mermaid errors — a retry usually produces a clean diagram.</td></tr>
                <tr><td>Agent recommendations ignore on-prem tools</td><td>Set the deployment model to Hybrid or On-Premises before generating. Cloud Native mode only considers cloud tools.</td></tr>
                <tr><td>Compliance frameworks not affecting recommendations</td><td>Check the "compliance note" field on each agent card — compliance rules affect the agent design, not the fit score sort order.</td></tr>
                <tr><td>Custom tool not persisting after return</td><td>Custom tools added via "+ Add" are saved automatically. If lost, check your internet connection and re-add — the save toast will confirm when it commits.</td></tr>
                <tr><td>Assessment Review shows all questions as unanswered</td><td>Click "Answer" on any question to start inline, or use the Framework Pillars sidebar nav to run the full question flow for that pillar.</td></tr>
                <tr><td>Air-gapped warning showing unexpectedly</td><td>Click "Edit configuration" in Agent Studio and change the deployment model to the correct option. The warning disappears immediately.</td></tr>
                <tr><td>Environment profile not pre-filling Agent Studio</td><td>Complete the environment profile via Assessment Review first. Agent Studio reads from environmentProfile — if only studioConfig exists, click "Edit profile" to migrate.</td></tr>
                <tr><td>Data Intelligence diagram shows parse error</td><td>The backend auto-fixes most Mermaid syntax errors. If it persists, re-run the blueprint from Stage 4 — the AI will generate a simpler diagram.</td></tr>
                <tr><td>Meeting notes extracted wrong answers</td><td>Review all proposed changes carefully before applying. Dismiss any low-confidence suggestions and handle them manually in Assessment Review.</td></tr>
                <tr><td>Agent recommendations look generic</td><td>Check that the environment profile is complete — specifically deployment model and tooling stack. Regenerate after completing the profile.</td></tr>
                <tr><td>Data Intelligence results not loading</td><td>Results only persist for linked sessions (client selected). Standalone sessions are not saved between visits. Switch to linked mode and re-run to persist results.</td></tr>
                <tr><td>Staleness banner appears unexpectedly</td><td>If the client's environmentProfile.updatedAt is over 90 days old, the banner is correct. Click "Update profile" to open the modal and save — this resets the staleness clock even without changes.</td></tr>
                <tr><td>Assessment shows extra questions I don't recognize</td><td>These are environment-aware questions injected based on the client's deployment model and compliance requirements. If the client's environment has changed, update the environment profile to adjust which questions appear.</td></tr>
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

# Changelog

All notable changes to the Zones AI Advisory Framework are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [0.6.0] — 2026-04-26

### Added
- **Help & User Guide page** (`/help`) — In-app documentation accessible from the sidebar
  - 9 content sections covering the full engagement workflow
  - Sticky left TOC (220px) with IntersectionObserver-based active section tracking
  - Real-time search filtering TOC items and hiding non-matching sections
  - Step lists with connector lines, pillar cards, score badges, help tables, and tip callout boxes
  - `HelpCircle` icon nav item with divider separator in the sidebar

---

## [0.5.0] — 2026-04-26

### Added
- **Agent Design Studio** (`/agents`) — Three-state flow for discovering and blueprinting AI agents
  - **Configure state** — Industry selector, tool chips across 6 categories, focus-area checkboxes pre-sorted by lowest pillar scores
  - **Discover state** — AI-ranked agent cards grouped by complexity (Quick Win / Medium / Strategic) with fit scores (0–100), rationale, and required tool pills; filter bar; backlog sidebar
  - **Design state** — Slide-over blueprint panel with agent spec table, architecture diagram, implementation flow, and RACI matrix; narrative context blocks between each visual; PDF export; "Add to Backlog" button
- **Agent backlog** — Persisted to `agentBacklog[]` array on the client's Cosmos DB document
- **Agent Studio sidebar nav** — Zap icon under Outputs section in Layout
- **Results page Agent Studio CTA** — Gradient banner with "Design Agents for this Client →" button
- **AI chat Agent Studio trigger** — Blue ⚡ action button when the assistant detects agent/automation discussions (`showAgentStudio` flag)
- **`agent_spec` visual type** — Two-column spec table renderer in `ChatVisual.jsx` with header row, alternating row backgrounds
- **`POST /api/agents/discover`** — Backend endpoint: GPT-4o, max_tokens 3000, returns JSON array of ranked agents
- **`POST /api/agents/design`** — Backend endpoint: GPT-4o, max_tokens 8000, returns `{reply, visuals:[...]}` blueprint
- **`POST /api/clients/:id/agents`** — Backend route appending agents to the client's `agentBacklog[]`

### Fixed
- `extractVisualFromResponse` — Updated to use `parsed.reply ?? parsed.text ?? ""` so design endpoint visuals are correctly parsed when GPT-4o returns the `reply` key
- `max_tokens` raised to 8000 on the design endpoint to prevent mid-JSON truncation on full 4-visual blueprints

---

## [0.4.0] — 2026-04-26

### Added
- **Narrative context blocks** — Between each visual in the Action Plan panel: headline, context paragraph, and key-actions callout list; structured for standalone PDF readability

### Fixed
- **PDF export** — Replaced single full-panel `html2canvas` screenshot with section-by-section element capture:
  - Cover page rendered entirely via jsPDF text/rect calls (no screenshot dependency)
  - Each `.narrative-block` and `.chat-visual-wrapper` queried and captured individually
  - mm-unit overflow detection adds new page with header bar when content exceeds `PAGE_H - margin`
  - Correctly paginates plans with 4+ visuals and accompanying narrative blocks

---

## [0.3.0] — 2026-04-26

### Added
- **Action Plan Panel** — React portal slide-over triggered by clicking any recommendation or next-step card on the Results page
  - AI-generated multi-visual output: Gantt chart, RACI matrix, risk heatmap, architecture diagram
  - Narrative context blocks between visuals
  - Section-by-section PDF export with cover page, headers, and pagination
  - Retry button on generation error; plan summary block with icon and client context

### Fixed
- **Timeline anchor** — Gantt chart now inherits the exact timeframe from the clicked card (e.g., "30 Days", "Q2") via explicit time-unit constraint injected into the GPT prompt; previously generated its own arbitrary timeline

---

## [0.2.0] — 2026-04-25

### Added
- **Visual AI chat responses** — 6 rich visual types rendered inline in the chat panel:
  - `reference_architecture` — Mermaid architecture diagram
  - `maturity_journey` — Phase milestone roadmap (custom React)
  - `raci_matrix` — Responsibility assignment table
  - `risk_heatmap` — Severity × likelihood CSS grid
  - `process_flow` — Mermaid workflow flowchart
  - `vendor_comparison` — Feature comparison grid
- **Visual popout modal** — Click any inline visual to expand full-screen
- **Executive narrative dashboard** — KPI tiles (avg score, highest/lowest pillar, questions answered), session notes textarea, improved radar chart
- **Mermaid diagram rendering** — Architecture and flow diagrams via mermaid.js with error boundary

### Fixed
- Scorecard JSON parsing for multi-visual responses
- Robust JSON extraction with `extractVisualFromResponse` (handles 4 envelope cases)
- Improved Gantt chart visual rendering
- Explicit system prompt for consistent JSON output from GPT-4o

---

## [0.1.0] — 2026-04-25

### Added
- **Initial framework** — Full React + Vite SPA frontend, Node.js/Express backend
- **5-pillar assessment** — Governance, Risk & Compliance, AI Strategy, Operations, Enablement; 4–5 scored questions per pillar (1–5 scale); discovery conversation prompts
- **Azure Cosmos DB persistence** — Client records (`clients` container) and assessment scores (`assessments` container)
- **Client selection flow** — `ClientContext` provider, client list page, create/edit modals, demo seed script
- **Dashboard** — Recharts radar chart, pillar scores, KPI summary tiles
- **Results page** — Overall maturity score with stage name, prioritized recommendations, 4-phase next-step roadmap, PDF export
- **AI Advisory Assistant** — GPT-4o chat panel with full client score context; persistent across all pages
- **Layout** — Three-column grid (sidebar 210px / main / chat 320px); NavLink routing; pillar color system; client avatar widget
- **GitHub Actions CI/CD** — Azure CLI zip deploy to Azure App Service on push to `main`
- **Azure infrastructure** — Azure OpenAI GPT-4o deployment + Azure Cosmos DB NoSQL (serverless)

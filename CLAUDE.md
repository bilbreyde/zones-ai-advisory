# CLAUDE.md — Zones AI Advisory Framework

## Project Overview
Advisor-led AI maturity assessment platform for Zones clients.
React 18 + Vite frontend, Node.js 24 Express backend, Azure Cosmos DB, Azure OpenAI gpt-5.4.

## Stack
- Node.js 24+ (never 20 or 22)
- React 18.3, React Router 6, Recharts, Framer Motion, Lucide React
- Express 4, OpenAI npm SDK (Azure OpenAI), @azure/cosmos 4
- Vite dev server on :5173, Express API on :3001
- Azure Static Web Apps (frontend), Azure App Service (backend)
- Cosmos DB NoSQL serverless — containers: clients, assessments

## Repo Structure

```
zones-ai-advisory/
├── frontend/src/
│ ├── components/ # Layout, AIChat, ActionPlanPanel, ChatVisual, MermaidChart
│ │ # AssessmentReview, EnvironmentProfile, MeetingNotes
│ ├── pages/ # Dashboard, Assessment, Results, Clients, AgentStudio
│ │ # CloudModernization, DataIntelligence, Help
│ ├── lib/ # environmentConstants.js, staleness.js
│ ├── App.jsx # Routes
│ ├── ClientContext.jsx
│ └── main.jsx
├── backend/src/
│ ├── routes/ # assessments.js, clients.js, cloud-modernization.js
│ │ # data-intelligence.js, sessions.js
│ ├── utils/ # mermaid.js
│ ├── db.js # Cosmos DB client
│ ├── index.js # Express server, OpenAI proxy, route mounting
│ └── seed.js
└── infrastructure/
└── provision.ps1
```


## Coding Standards
- ESM modules throughout (type: module in both package.json files)
- No TypeScript — plain JS/JSX only
- CSS files co-located with components and pages (ComponentName.css)
- No Tailwind — use custom CSS with CSS variables
- Lucide React for all icons
- Framer Motion for animations
- Never use dashes in variable/function names — use camelCase
- Always handle Cosmos DB errors explicitly, never swallow them
- All gpt-5.4 calls go through backend routes — never call OpenAI from frontend
- Environment variables: backend reads from .env, frontend reads VITE_ prefixed vars
- Git commits use conventional format: feat:, fix:, chore:

## Azure Resources (Don's Azure — subscription 7d70637f)
- Resource Group: zones-ai-advisory (eastus2)
- OpenAI: zones-ai-openai (gpt-5.4 deployed)
- Backend: zones-ai-advisory-api (App Service, Node 24)
- Frontend: zones-ai-advisory-web (Static Web App)
- Cosmos DB: zones-ai-cosmos

## Cosmos DB Schema
### clients container (partitionKey: /id)
```json
{
  "id": "uuid",
  "name": "string",
  "industry": "string",
  "scores": { "governance": 0, "risk": 0, "strategy": 0, "operations": 0, "enablement": 0 },
  "agentBacklog": [],
  "auditReadiness": {},
  "createdAt": "ISO string"
}
```
### assessments container (partitionKey: /clientId)
```json
{
  "id": "uuid",
  "clientId": "string",
  "pillar": "string",
  "answers": [],
  "score": 0,
  "completedAt": "ISO string"
}
```
### audit_evidence container (partitionKey: /clientId)
One record per client per specialization. ID format: `${clientId}_${specialization}`
```json
{
  "id": "${clientId}_${specialization}",
  "clientId": "string",
  "specialization": "infra-db | avd | vmware | analytics | ai-apps | ai-platform",
  "moduleA": { "control_1_1": { "status": "not_started|in_progress|complete", "artifacts": [], "notes": "" } },
  "moduleB": { "control_1_1": { "status": "...", "artifacts": [], "notes": "" } },
  "customerProjects": [],
  "updatedAt": "ISO string"
}
```
### audit_projects container (partitionKey: /clientId)
Customer project records. controlsEvidenced uses compound control keys:
`"${specializationId}:${moduleKey}:${controlId}"` (e.g. `"infra-db:moduleB:control_1_1"`)
```json
{
  "id": "uuid",
  "clientId": "string",
  "projectName": "string",
  "customerName": "string",
  "goLiveDate": "YYYY-MM-DD",
  "specializations": ["infra-db"],
  "controlsEvidenced": ["infra-db:moduleA:control_1_1", "infra-db:moduleB:control_1_1"],
  "customerSignOff": false,
  "signOffDocument": "",
  "artifacts": [],
  "notes": "",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

## Feature Modules (Already Built)
- 5-pillar AI maturity assessment with scoring
- Azure OpenAI gpt-5.4 advisory chat with visual responses (6 visual types)
- Agent Design Studio (discover and blueprint AI agents)
- Action Plan Panel with PDF export
- Cloud Modernization page
- Data Intelligence page
- Environment Profile component
- Help page
- Specialization Audit Readiness (Phases 1-4): control tracking, customer project registry,
  AI generation, Word evidence export — see SPEC-audit-readiness.md

## Dev Commands
```powershell
# Backend
cd backend && npm run dev

# Frontend (separate terminal)
cd frontend && npm run dev

# Seed Cosmos DB
cd backend && npm run seed
```

## Important Patterns
### Adding a new backend route
1. Create backend/src/routes/your-route.js
2. Import and mount in backend/src/index.js
3. Follow existing route pattern — use db.js for Cosmos, openai client from backend/src/openai.js

### Adding a new frontend page
1. Create frontend/src/pages/YourPage.jsx and YourPage.css
2. Add route in App.jsx
3. Add nav item in Layout.jsx with Lucide icon

### gpt-5.4 response parsing
All AI responses follow the extractVisualFromResponse pattern in AIChat.jsx.
Responses return { reply, visuals: [] } — always handle both keys.

### Cosmos DB reads
Always use partition key in queries. clientId is the partition key for assessments.

### Optimistic concurrency
All audit writes require `_etag` in the request body. First saves omit `_etag`.
Backend returns 409 on conflict. Frontend retries once then shows error banner.

### OpenAI client
Import from backend/src/openai.js, not index.js.

### Control definitions
Two copies must stay identical — frontend/src/lib/controlDefinitions.js and
backend/src/lib/controlDefinitions.js. Fields required on every control:
customerCount, evidenceWindowMonths, id, module, name, notes, number,
requiredEvidence, skipIfNotDeployed, specializationId, taga

## What NOT to do
- Do not call OpenAI from the frontend
- Do not use TypeScript
- Do not use Tailwind
- Do not hardcode Azure credentials — always use process.env
- Do not create duplicate CSS — check existing variables in index.css first
- Do not use Node 20 or 22 features — target Node 24
- Do not modify provision.ps1 without explicit instruction
- Do not change the Cosmos DB container names or partition keys
- Do not import from backend/src/index.js in route files
- Do not use random UUIDs for audit_evidence record IDs
- Do not add audit write routes without _etag validation
- Do not use max_tokens in chat completion calls — gpt-5.4 rejects it; use max_completion_tokens
- Do not hardcode model names — every call reads process.env.AZURE_OPENAI_DEPLOYMENT

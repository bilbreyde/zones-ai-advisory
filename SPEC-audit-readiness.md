# SPEC: Specialization Audit Readiness Module

## Purpose
Add a Microsoft Azure Specialization audit readiness tracking and evidence packaging
system to the existing advisory platform. Advisors use this to track which controls
are satisfied for a client across target specializations, generate required evidence
artifacts, and produce an audit-ready evidence package.

## Target Specializations (Priority Order)
1. Infrastructure and DB Migration to Azure
2. Azure Virtual Desktop + Azure VMware Solution
3. Analytics on Microsoft Azure
4. AI Applications on Azure + AI Platform on Azure

## Architecture

### New Cosmos DB container: audit_evidence
Partition key: /clientId
```json
{
  "id": "uuid",
  "clientId": "string",
  "specialization": "infra-db | avd-vmware | analytics | ai-apps | ai-platform",
  "moduleA": {
    "control_1_1": { "status": "not_started|in_progress|complete", "artifacts": [], "notes": "" },
    "control_1_2": { "status": "...", "artifacts": [], "notes": "" },
    "control_2_1": { "status": "...", "artifacts": [], "notes": "" },
    "control_2_2": { "status": "...", "artifacts": [], "notes": "" },
    "control_3_1": { "status": "...", "artifacts": [], "notes": "" },
    "control_3_2": { "status": "...", "artifacts": [], "notes": "" },
    "control_3_3": { "status": "...", "artifacts": [], "notes": "" }
  },
  "moduleB": {
    "control_1_1": { "status": "...", "artifacts": [], "notes": "" }
  },
  "customerProjects": [],
  "updatedAt": "ISO string"
}
```

### New Cosmos DB container: audit_projects
Partition key: /clientId
```json
{
  "id": "uuid",
  "clientId": "string",
  "projectName": "string",
  "goLiveDate": "ISO string",
  "customerSignOff": false,
  "signOffDocument": "",
  "controlsEvidenced": ["moduleA.control_1_1"],
  "artifacts": [],
  "notes": ""
}
```

## New Backend Routes
All under /api/audit

### GET /api/audit/:clientId
Returns all audit_evidence records for the client across all specializations.

### GET /api/audit/:clientId/:specialization
Returns the control status map for one specialization.

### PUT /api/audit/:clientId/:specialization/control
Body: { module, control, status, notes }
Updates a single control status.

### POST /api/audit/:clientId/:specialization/artifact
Body: { module, control, artifactType, artifactData }
Appends an artifact to a control.

### GET /api/audit/:clientId/export/:specialization
Generates and returns a structured evidence package summary.

### POST /api/audit/:clientId/generate/skilling-plan
GPT-4o generates a formatted skilling plan document based on client
technology profile and deployed services.

### POST /api/audit/:clientId/generate/finops-checklist
GPT-4o generates a FinOps Review preparation checklist mapped to
the client's Azure environment from EnvironmentProfile data.

## New Frontend Pages

### AuditReadiness.jsx (/audit-readiness)
Main audit readiness dashboard for the selected client.

Layout: two-column
Left: Specialization selector cards (4 specializations, color coded)
     Click to drill into that specialization's control map
Right: Readiness summary — overall % complete per specialization,
       customer project count vs required, Module A waiver status indicator

### AuditReadiness detail view (same page, drill-in)
When a specialization is selected, shows:
- Module A control checklist (7 controls, shared across all specializations)
- Module B control checklist (specialization-specific)
- Each control card shows:
  - Control number and name
  - Status badge (Not Started / In Progress / Complete)
  - Required evidence summary (pulled from control definitions)
  - Artifact upload/link area
  - Notes field
  - Customer projects linked to this control
- Progress bar per module

### AuditProjects.jsx (/audit-projects)
Customer project registry — the evidence pool the auditor will evaluate.

Each project card shows:
- Project name
- Go-live date
- Customer sign-off status (boolean + document link)
- Which controls it satisfies
- Artifact list

Add project modal with fields:
- Project name, customer name, go-live date
- Specialization(s) it applies to
- Controls it evidences (multi-select from control list)
- Notes

### AuditExport.jsx (/audit-export)
Evidence package builder.

Specialization selector, then:
- Control-by-control readiness summary
- Gap list (controls not yet complete)
- Generate Skilling Plan button (calls GPT-4o endpoint)
- Generate FinOps Checklist button (calls GPT-4o endpoint)
- Export Evidence Package button — produces a structured Word document
  via the existing docx npm package, organized by Module A then Module B,
  one section per control, listing artifacts and notes

## Control Definitions (embed in frontend as controlDefinitions.js)

### Module A (all specializations)
1.1 Cloud & AI Adoption Business Strategy
  Required: FinOps Review output + CASE assessment for 2 unique customers (last 12 months)

1.2 Cloud & AI Adoption Plan
  Required: Cost management report + DevOps Capability Assessment for 2 unique customers (last 12 months)

2.1 Security & Governance Tooling
  Required: Defender for Cloud or 3rd party security baseline + Cloud Adoption Security Review for 2 customers (last 12 months)

2.2 Well-Architected Workloads
  Required: Well-Architected Review export for 2 unique customers (last 12 months)

3.1 Repeatable Deployment
  Required: ALZ deployment evidence (Bicep/Terraform/ARM) + ALZ Review for 2 unique customers

3.2 Plan for Skilling
  Required: Skilling plan for 2 unique customers (last 12 months)

3.3 Operations Management Tooling
  Required: Azure Monitor/Automation/Backup deployment + security compliance artifact for 2 customers (last 12 months)
  Note: Can be skipped for Analytics specialization if not deployed

### Module B — Infra and DB Migration
1.1 Assessment — migration readiness, source environment inventory, DMA reports (3 customers, 24 months)
1.2 Solution Design — migration architecture, schema strategy, ETL design (3 customers, 24 months)
1.3 Well-Architected Review — WAR export 2 pillars per project (3 customers, 24 months)
2.1 Production Deployment — go-live evidence including migration scenario (3 customers, 24 months)
2.2 Service Validation — testing docs with customer sign-off (3 customers, 24 months)
2.3 Post-deployment Documentation — runbooks or operational handoff docs (3 customers, 24 months)

### Module B — Analytics
1.1 Assessment — data landscape, ETL inventory, governance posture (3 customers, 24 months)
2.1 Solution Design — Fabric/Databricks/Synapse architecture, at least 1 migration project (3 customers, 24 months)
2.2 Well-Architected Review — 2 pillars per project, customer name visible (3 customers, 24 months)
2.3 PoC or Pilot — design validation with purpose, results, lessons learned (3 customers, 24 months)
3.1 Production Deployment — at least 1 migration scenario (3 customers, 24 months)
4.1 Validation and Performance Testing — benchmarks, data reconciliation, customer sign-off (3 customers, 24 months)

### Module B — AI Apps / AI Platform
1.1 Assessment — AI use case inventory, readiness, AI Readiness Advisor output (3 customers, 24 months)
2.1 Solution Design — AI architecture with model registry, monitoring, responsible AI docs (3 customers, 24 months)
2.2 Well-Architected Review — WAR export 2 pillars, AI workload focus (3 customers, 24 months)
3.1 Production Deployment — production AI models with monitoring dashboards (3 customers, 24 months)
4.1 Validation and Performance Testing — model performance, customer sign-off (3 customers, 24 months)
Note: TAGA report required for control 3.2 skilling plan (AI Apps and AI Platform only)

### Module B — AVD / VMware
(Add when AVD and VMware specialization checklists are uploaded)
Note: VMware requires third-party cert prerequisite — flag as manual prerequisite in UI

## UI Design Principles
Follow existing patterns:
- Navy #003087 primary, match existing CSS variable system in index.css
- Control status colors: not_started = gray, in_progress = amber, complete = green
- Use existing Lucide icons — Shield for audit, CheckSquare for controls,
  Package for export, FolderOpen for projects
- Progress indicators use the existing pillar color system where possible
- All new pages added to Layout.jsx sidebar under a new "Partner" section

## Build Sequence
Phase 1 — Data layer
  New Cosmos containers, backend routes, control definitions file

Phase 2 — Audit Readiness page
  Specialization selector, Module A checklist, Module B checklist

Phase 3 — Audit Projects page
  Customer project registry with control linkage

Phase 4 — Export and AI generation
  Skilling plan generator, FinOps checklist generator, evidence package Word doc

## Out of Scope for This Build
- Actual WAR export integration (requires Microsoft API access — manual artifact upload)
- FinOps Review API (no public API — generate checklist as prep document instead)
- ALZ Review API (manual artifact upload)
- Partner Center API integration
- Third-party certification verification

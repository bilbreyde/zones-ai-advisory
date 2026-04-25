# Zones AI Advisory Framework

An advisor-led AI maturity assessment platform for Zones clients â€” built on React, Node.js, and Azure OpenAI (GPT-4o).

## What it does

- Guides advisors through a structured 5-pillar AI maturity assessment (Governance, Risk, Strategy, Operations, Enablement)
- Scores clients in real time and generates prioritized gap analysis
- AI-powered advisory assistant (Azure OpenAI GPT-4o) for advisor support during sessions
- Produces executive-ready reports and roadmaps

---

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- An Azure OpenAI resource with GPT-4o deployed (see Azure Setup below)

### 1. Clone the repo
```powershell
cd c:\git
git clone https://github.com/bilbreyde/zones-ai-advisory.git
cd zones-ai-advisory
```

### 2. Configure the backend
```powershell
cd backend
copy .env.example .env
# Edit .env and fill in your Azure OpenAI credentials
```

Your `.env` should look like:
```
AZURE_OPENAI_ENDPOINT=https://zones-ai-openai.openai.azure.com
AZURE_OPENAI_KEY=<your-key-from-azure-portal>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
PORT=3001
```

### 3. Start the backend
```powershell
cd backend
npm install
npm run dev
# API running at http://localhost:3001
# Health check: http://localhost:3001/api/health
```

### 4. Start the frontend (new terminal)
```powershell
cd frontend
npm install
npm run dev
# App running at http://localhost:5173
```

---

## Azure Setup (First Time)

### 1. Provision all Azure resources
```powershell
cd infrastructure
.\provision.ps1
```

This script creates:
- Resource group `zones-ai-advisory` in East US 2
- Azure OpenAI resource with GPT-4o deployed
- Azure App Service (backend API)
- Azure Static Web App (frontend)

The script prints your `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_KEY` at the end â€” save these to `backend/.env`.

### 2. Set up GitHub Actions for CI/CD

In your GitHub repo â†’ Settings â†’ Secrets â†’ Actions, add:

| Secret | Where to get it |
|--------|----------------|
| `AZURE_BACKEND_PUBLISH_PROFILE` | Azure Portal â†’ App Service â†’ Get publish profile |
| `AZURE_STATIC_WEB_APPS_TOKEN` | Azure Portal â†’ Static Web App â†’ Manage token |

Every push to `main` will now auto-deploy.

---

## Project Structure

```
zones-ai-advisory/
â”œâ”€â”€ frontend/                  # React + Vite app
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”œâ”€â”€ Layout.jsx     # Sidebar + layout shell
â”‚   â”‚   â”‚   â””â”€â”€ AIChat.jsx     # Azure OpenAI chat panel
â”‚   â”‚   â””â”€â”€ pages/
â”‚   â”‚       â”œâ”€â”€ Dashboard.jsx  # Maturity overview + radar chart
â”‚   â”‚       â”œâ”€â”€ Assessment.jsx # Question-by-question assessment
â”‚   â”‚       â”œâ”€â”€ Results.jsx    # Gap analysis + roadmap
â”‚   â”‚       â””â”€â”€ Clients.jsx    # Client list
â”‚   â””â”€â”€ vite.config.js
â”œâ”€â”€ backend/                   # Node.js Express API
â”‚   â”œâ”€â”€ src/index.js           # Azure OpenAI proxy + chat endpoint
â”‚   â””â”€â”€ .env.example
â”œâ”€â”€ infrastructure/
â”‚   â””â”€â”€ provision.ps1          # Azure resource provisioning
â””â”€â”€ .github/workflows/
    â””â”€â”€ deploy.yml             # CI/CD to Azure
```

---

## Azure Resources (Subscription: Don''s Azure)

| Resource | Name | Type |
|----------|------|------|
| Resource Group | zones-ai-advisory | eastus2 |
| OpenAI | zones-ai-openai | Azure OpenAI (GPT-4o) |
| Backend | zones-ai-advisory-api | App Service (Node 20) |
| Frontend | zones-ai-advisory-web | Static Web App |

---

## Upgrading the AI Model

To switch from GPT-4o to o3 for deeper reasoning:
1. Deploy `o3` in Azure AI Foundry under the same resource
2. Update `AZURE_OPENAI_DEPLOYMENT=o3` in App Service config
3. Note: o3 does not support `temperature` â€” remove that param from `backend/src/index.js`

---

## Team Contacts

- Advisor Lead: Don Bilbrey
- Tenant: Zones Innovation Center


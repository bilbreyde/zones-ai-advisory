import 'dotenv/config'
import { CosmosClient } from '@azure/cosmos'

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
})

const DEMO_CLIENTS = [
  {
    id: 'demo-acme-corp',
    name: 'Acme Corp',
    industry: 'Manufacturing',
    advisor: 'Sarah Mitchell',
    size: '1,000–5,000 employees',
    status: 'In Progress',
    currentSession: 3,
    scores: { governance: 3.2, risk: 2.1, strategy: 4.0, operations: 2.8, enablement: 1.9 },
    overallScore: 2.8,
    createdAt: '2026-02-10T09:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-techglobal',
    name: 'TechGlobal Inc',
    industry: 'Technology',
    advisor: 'James Park',
    size: '500–1,000 employees',
    status: 'Completed',
    currentSession: 6,
    scores: { governance: 4.2, risk: 3.8, strategy: 4.5, operations: 4.0, enablement: 4.0 },
    overallScore: 4.1,
    createdAt: '2025-11-01T09:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-northfield',
    name: 'NorthField Energy',
    industry: 'Energy & Utilities',
    advisor: 'Sarah Mitchell',
    size: '2,000–10,000 employees',
    status: 'Kickoff',
    currentSession: 1,
    scores: { governance: null, risk: null, strategy: null, operations: null, enablement: null },
    overallScore: null,
    createdAt: '2026-04-20T09:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-metro-bank',
    name: 'Metro Bank',
    industry: 'Financial Services',
    advisor: 'Don Bilbrey',
    size: '500–2,000 employees',
    status: 'Assessment',
    currentSession: 2,
    scores: { governance: 2.0, risk: 1.8, strategy: 2.2, operations: 1.6, enablement: 1.9 },
    overallScore: 1.9,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
]

async function seed() {
  console.log('Connecting to Cosmos DB...')
  const { database } = await cosmosClient.databases.createIfNotExists({ id: 'zones-ai-advisory' })
  const { container } = await database.containers.createIfNotExists({ id: 'clients', partitionKey: '/id' })

  for (const client of DEMO_CLIENTS) {
    await container.items.upsert(client)
    console.log(`  ✓ ${client.name}`)
  }
  console.log('Seed complete.')
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1) })

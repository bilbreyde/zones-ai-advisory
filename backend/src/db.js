import { CosmosClient } from '@azure/cosmos'

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
})

const DB_NAME = 'zones-ai-advisory'

export const containers = {}

export async function initDb() {
  const { database } = await client.databases.createIfNotExists({ id: DB_NAME })

  const containerDefs = [
    { id: 'clients',     partitionKey: '/id' },
    { id: 'assessments', partitionKey: '/clientId' },
    { id: 'sessions',    partitionKey: '/clientId' },
  ]

  for (const def of containerDefs) {
    const { container } = await database.containers.createIfNotExists(def)
    containers[def.id] = container
  }

  console.log('Cosmos DB initialized')
}

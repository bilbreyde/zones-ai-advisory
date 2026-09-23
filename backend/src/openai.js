import "dotenv/config"
import { AzureOpenAI } from "openai"

// Shared Azure OpenAI client — import from here in index.js and routes
// (lives outside index.js so routes can import it without a circular dependency)
export const openai = new AzureOpenAI({
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiKey:     process.env.AZURE_OPENAI_KEY,
  apiVersion: "2024-08-01-preview",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
})

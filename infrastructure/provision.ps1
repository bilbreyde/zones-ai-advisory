# ============================================================
# Zones AI Advisory - Azure Provisioning Script
# Run once from c:\git\zones-ai-advisory\infrastructure\
# Subscription: Don''s Azure (7d70637f-bd34-4728-b41e-5a5c9f652d5d)
# ============================================================

$SUBSCRIPTION_ID = "7d70637f-bd34-4728-b41e-5a5c9f652d5d"
$RESOURCE_GROUP  = "zones-ai-advisory"
$LOCATION        = "eastus2"
$APP_NAME        = "zones-ai-advisory-api"
$OPENAI_NAME     = "zones-ai-openai"
$DEPLOYMENT_NAME = "gpt-4o"

Write-Host "Setting subscription..." -ForegroundColor Cyan
az account set --subscription $SUBSCRIPTION_ID

# 1. Resource Group
Write-Host "Creating resource group..." -ForegroundColor Cyan
az group create `
  --name $RESOURCE_GROUP `
  --location $LOCATION

# 2. Azure OpenAI Resource
Write-Host "Creating Azure OpenAI resource..." -ForegroundColor Cyan
az cognitiveservices account create `
  --name $OPENAI_NAME `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --kind OpenAI `
  --sku S0 `
  --yes

# 3. Deploy GPT-4o model
Write-Host "Deploying GPT-4o model..." -ForegroundColor Cyan
az cognitiveservices account deployment create `
  --name $OPENAI_NAME `
  --resource-group $RESOURCE_GROUP `
  --deployment-name $DEPLOYMENT_NAME `
  --model-name "gpt-4o" `
  --model-version "2024-08-06" `
  --model-format OpenAI `
  --sku-capacity 10 `
  --sku-name "Standard"

# 4. Get OpenAI keys + endpoint
Write-Host "Fetching OpenAI credentials..." -ForegroundColor Cyan
$OPENAI_KEY      = az cognitiveservices account keys list --name $OPENAI_NAME --resource-group $RESOURCE_GROUP --query "key1" -o tsv
$OPENAI_ENDPOINT = az cognitiveservices account show --name $OPENAI_NAME --resource-group $RESOURCE_GROUP --query "properties.endpoint" -o tsv

Write-Host "AZURE_OPENAI_ENDPOINT: $OPENAI_ENDPOINT" -ForegroundColor Green
Write-Host "AZURE_OPENAI_KEY: $OPENAI_KEY" -ForegroundColor Green

# 5. App Service Plan (Free tier for prototype)
Write-Host "Creating App Service Plan..." -ForegroundColor Cyan
az appservice plan create `
  --name "zones-ai-advisory-plan" `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku B1 `
  --is-linux

# 6. Node.js Web App (backend)
Write-Host "Creating backend Web App..." -ForegroundColor Cyan
az webapp create `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --plan "zones-ai-advisory-plan" `
  --runtime "NODE:20-lts"

# 7. Set app settings (env vars)
Write-Host "Configuring backend environment variables..." -ForegroundColor Cyan
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings `
    AZURE_OPENAI_ENDPOINT="$OPENAI_ENDPOINT" `
    AZURE_OPENAI_KEY="$OPENAI_KEY" `
    AZURE_OPENAI_DEPLOYMENT="$DEPLOYMENT_NAME" `
    NODE_ENV="production"

# 8. Static Web App (frontend)
Write-Host "Creating Static Web App for frontend..." -ForegroundColor Cyan
az staticwebapp create `
  --name "zones-ai-advisory-web" `
  --resource-group $RESOURCE_GROUP `
  --location "eastus2" `
  --sku Free

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Provisioning complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host " Backend URL : https://$APP_NAME.azurewebsites.net" -ForegroundColor Cyan
Write-Host " Next step   : Run deploy.ps1 to push your code" -ForegroundColor Cyan
Write-Host ""
Write-Host "Save these to backend\.env:" -ForegroundColor Yellow
Write-Host "AZURE_OPENAI_ENDPOINT=$OPENAI_ENDPOINT"
Write-Host "AZURE_OPENAI_KEY=$OPENAI_KEY"
Write-Host "AZURE_OPENAI_DEPLOYMENT=$DEPLOYMENT_NAME"


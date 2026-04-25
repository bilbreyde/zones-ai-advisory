# ============================================================
# Run this ONCE to initialize the repo and push to GitHub
# From: c:\git\zones-ai-advisory\
# ============================================================

# Initialize git
git init
git branch -M main

# Stage everything
git add .

# First commit
git commit -m "feat: initial Zones AI Advisory Framework scaffold

- React + Vite frontend with Dashboard, Assessment, Results, Clients pages
- 5-pillar assessment question bank (30 questions)
- Azure OpenAI GPT-4o advisory chat assistant
- Node.js/Express backend API
- Azure provisioning script (provision.ps1)
- GitHub Actions CI/CD for Azure App Service + Static Web Apps
- README with full setup instructions"

# Add your GitHub remote and push
git remote add origin https://github.com/bilbreyde/zones-ai-advisory.git
git push -u origin main

Write-Host ""
Write-Host "Repo pushed to GitHub!" -ForegroundColor Green
Write-Host "Next: Run infrastructure\provision.ps1 to set up Azure resources" -ForegroundColor Cyan


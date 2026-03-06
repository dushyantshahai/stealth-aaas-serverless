# Deploy API Gateway with routes
# This script ensures a clean deployment of the API Gateway with all routes

param(
    [string]$Stage = "dev"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying API Gateway for stage: $Stage" -ForegroundColor Green
Write-Host ""

# Navigate to CDK directory
Set-Location "$PSScriptRoot/cdk"

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "🔨 Building CDK app..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "🔍 Synthesizing CloudFormation templates..." -ForegroundColor Yellow
npx cdk synth --context stage=$Stage

Write-Host ""
Write-Host "🚀 Deploying stacks..." -ForegroundColor Yellow
npx cdk deploy --all --context stage=$Stage --require-approval never

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To test the API, run:" -ForegroundColor Cyan
Write-Host "  node ../test-content-apis.js" -ForegroundColor Cyan

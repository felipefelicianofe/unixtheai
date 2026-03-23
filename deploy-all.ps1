# deploy-all.ps1
# Script de automação total: Git (Vercel) + Supabase Edge Functions

param (
    [string]$commitMessage = "Refatoração AutoGerenciamento e UI"
)

Write-Host "`n🚀 Iniciando Deploy Global de Katon AI..." -ForegroundColor Cyan

# 1. Frontend & Vercel Sync 
Write-Host "`n📦 Aviso: Sincronização com Vercel (Git Push) deve ser feita manualmente para segurança de Produção." -ForegroundColor Gray

# 2. Supabase Edge Functions Deploy
Write-Host "`n🔥 Subindo Supabase Edge Functions (13 funções) da Katon AI..." -ForegroundColor Yellow

$functions = @(
    "analyze-asset", 
    "auto-refine", 
    "autotrade-engine", 
    "binance-proxy", 
    "check-admin", 
    "generate-ai-narrative", 
    "management-auto-refine", 
    "reprocess-history", 
    "run-auto-analyses", 
    "run-auto-management", 
    "trade-manager", 
    "verify-analyses-results", 
    "verify-management-results"
)

# Build a space-separated string of function names
$allFunctions = [string]::Join(" ", $functions)

# Execution command
# Using npx to ensure the local or latest Supabase CLI is used
$deployCmd = "npx -y supabase functions deploy $allFunctions --no-verify-jwt"

Write-Host "Executando: $deployCmd" -ForegroundColor Gray
Invoke-Expression $deployCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✨ Deploy de Katon AI concluído com Sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ Ocorreu um problema no deploy de algumas funções." -ForegroundColor Yellow
}

# deploy-all.ps1
# Script de automação total: Git (Vercel) + Supabase Edge Functions

param (
    [string]$commitMessage = "Refatoração e Atualização da Plataforma"
)

Write-Host "`n🚀 Iniciando Deploy Global de Katon AI..." -ForegroundColor Cyan

# 1. Frontend & Vercel Sync (GitHub)
Write-Host "`n📦 Iniciando Sincronização com Vercel (Git Push -> main)..." -ForegroundColor Yellow

# Verifica o status atual do git
$gitStatus = git status --porcelain
if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "ℹ️ Nenhuma alteração detectada no código base do Frontend/Storage local." -ForegroundColor Gray
} else {
    Write-Host "Adicionando arquivos alterados ao stage..." -ForegroundColor Gray
    git add .
    
    Write-Host "Realizando commit: '$commitMessage'" -ForegroundColor Gray
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Erro ao realizar o commit do Git." -ForegroundColor Red
    } else {
        # Detecta a branch atual para o push correto (master ou main)
        $currentBranch = git branch --show-current
        Write-Host "Enviando (Push) da branch '$currentBranch' para a Origem..." -ForegroundColor Gray
        
        # Tenta o push para 'main' se falhar 'master' ou vice-versa, ou apenas para a branch atual
        git push origin "$currentBranch"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Sincronização Frontend (Vercel) concluída com Sucesso!" -ForegroundColor Green
        } else {
            # Tenta forçar push local para a branch remota 'main' caso ela seja a padrão no repo
            Write-Host "⚠️ Erro no Push Direto. Tentando mapeamento branch $currentBranch -> main..." -ForegroundColor Yellow
            git push origin "${currentBranch}:main"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Sincronização Frontend (Mapeada para main) concluída com Sucesso!" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Erro crítico no Push do Git! Verifique a conexão com o GitHub e conflitos." -ForegroundColor Red
            }
        }
    }
}

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
    Write-Host "`n✨ Deploy Backend de Katon AI concluído com Sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ Ocorreu um problema no deploy de algumas funções no Supabase." -ForegroundColor Red
}

Write-Host "`n🎯 Processo de Deploy Global Finalizado!`n" -ForegroundColor Cyan

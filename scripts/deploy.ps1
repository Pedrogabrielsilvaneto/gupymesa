$ErrorActionPreference = "Stop"

# 1. Generate new version string (YYYYMMDD_HHmm)
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$newVersion = "v=$timestamp"
Write-Host "-> Iniciando Deploy Automatico - Versao: $newVersion" -ForegroundColor Cyan

# 2. Files to update
$files = @(
    "produtividade.html",
    "minha_area.html"
)

# 3. Update version strings in files
foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        # Regex to match v=YYYYMMDD_revX or v=YYYYMMDD_HHmm
        $newContent = $content -replace 'v=\d{8}_(?:rev\d+|\d{4})', $newVersion
        
        if ($content -ne $newContent) {
            Set-Content -Path $file -Value $newContent -Encoding UTF8
            Write-Host "-> Atualizado: $file" -ForegroundColor Green
        }
        else {
            Write-Host "-> Sem alteracoes de versao em: $file" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "-> Arquivo nao encontrado: $file" -ForegroundColor Red
    }
}

# 4. Git Operations
Write-Host "-> Git: Adicionando arquivos..." -ForegroundColor Cyan
git add .

$commitMsg = "Auto-deploy: $timestamp - Fixes and updates"
Write-Host "-> Git: Commitando '$commitMsg'..." -ForegroundColor Cyan
git commit -m "$commitMsg"

Write-Host "-> Git: Enviando para tidb-main (Producao)..." -ForegroundColor Cyan
git push origin tidb-main --force

Write-Host "-> Git: Enviando para main (Preview)..." -ForegroundColor Cyan
git push origin main --force

Write-Host "-> Deploy enviado com sucesso! Aguarde a build do Vercel." -ForegroundColor Green

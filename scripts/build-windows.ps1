# Rebebuca Windows Build Script
# This script builds the Windows version and prepares artifacts for R2 upload

$ErrorActionPreference = "Stop"

# Get project root
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $PROJECT_ROOT

# Read current version
$PACKAGE_JSON = Get-Content "package.json" | ConvertFrom-Json
$VERSION = $PACKAGE_JSON.version

Write-Host "========================================" -ForegroundColor Green
Write-Host "Rebebuca Windows Build" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Version: $VERSION" -ForegroundColor Yellow
Write-Host ""

# Check if we have signing keys
if (-not $env:TAURI_SIGNING_PRIVATE_KEY -or -not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
    Write-Host "Warning: No signing keys found. Build will be unsigned." -ForegroundColor Yellow
    Write-Host "Set TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD environment variables for signed builds."
    Write-Host ""
}

# Step 1: Install dependencies
Write-Host "[1/2] Installing dependencies..." -ForegroundColor Green
pnpm install
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 2: Build Tauri app
Write-Host "[2/2] Building Tauri app..." -ForegroundColor Green
# Use vendored-openssl feature for static linking in release builds
pnpm tauri build --features vendored-openssl
Write-Host "✓ Tauri build complete" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Artifacts location:"
Write-Host "  src-tauri\target\release\bundle\" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review the build artifacts"
Write-Host "  2. Upload to R2: C:\Users\...\monibuca\rb\v$VERSION\"
Write-Host ""

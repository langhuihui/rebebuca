# Rebebuca is now Node.js + Nuxt only. No Windows-specific build script.
# Use: npx rebebuca (after npm publish) or run node-server locally.

$ErrorActionPreference = "Stop"
Write-Host "This project no longer builds a Windows desktop app." -ForegroundColor Yellow
Write-Host "Run the app with: npx rebebuca" -ForegroundColor Cyan
Write-Host "Or build for npm: pnpm run build:server-app" -ForegroundColor Cyan
exit 1

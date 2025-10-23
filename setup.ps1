# GPS Stability & Corridor Intelligence - Setup Script
# This script automates the complete setup process

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "GPS Stability & Corridor Intelligence" -ForegroundColor Cyan
Write-Host "Automated Setup Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if running in PowerShell
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "ERROR: PowerShell 5.0 or higher required" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
Write-Host ""

# Install dev dependencies
Write-Host "Installing Prisma (dev)..." -ForegroundColor Gray
npm install --save-dev prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install Prisma" -ForegroundColor Red
    Write-Host "Try running: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned" -ForegroundColor Yellow
    exit 1
}

# Install main dependencies
Write-Host "Installing main dependencies..." -ForegroundColor Gray
npm install @prisma/client maplibre-gl h3-js @turf/turf @turf/distance @turf/bearing csv-parse dayjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Setting up database..." -ForegroundColor Yellow
Write-Host ""

# Generate Prisma Client
Write-Host "Generating Prisma Client..." -ForegroundColor Gray
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}

# Create database migration
Write-Host "Creating database migration..." -ForegroundColor Gray
npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create migration" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Database initialized" -ForegroundColor Green
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run dev" -ForegroundColor White
Write-Host "2. Open: http://localhost:3000" -ForegroundColor White
Write-Host "3. Click 'Start Replay' in the Simulator panel" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "- QUICKSTART.md - Quick start guide" -ForegroundColor White
Write-Host "- IMPLEMENTATION.md - Full system overview" -ForegroundColor White
Write-Host "- CHECKLIST.md - Verification checklist" -ForegroundColor White
Write-Host ""
Write-Host "Happy hacking! 🚀" -ForegroundColor Cyan

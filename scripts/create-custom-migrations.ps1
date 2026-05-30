# create-custom-migrations.ps1
#
# Run this script AFTER the initial schema migration has been applied to Supabase
# via `prisma migrate deploy`.
#
# It creates the three custom migration directories with timestamps that are
# guaranteed to sort after the initial_schema migration, then applies them
# via `prisma migrate deploy` (Supabase-compatible — no shadow database required).
#
# Usage (from project root):
#   .\scripts\create-custom-migrations.ps1
#
# Prerequisites:
#   - Initial schema migration must have been applied (prisma migrate deploy)
#   - DATABASE_URL (Supabase transaction pooler) must be set in .env
#   - DIRECT_URL (Supabase session pooler, port 5432) must be set in .env
#   - prisma/migration-scripts/*.sql files must be present

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $projectRoot "prisma\migrations"
$scriptsDir    = Join-Path $projectRoot "prisma\migration-scripts"

# Verify source SQL files exist
$required = @(
  "010_add_fts_triggers.sql",
  "011_add_partial_indexes.sql",
  "012_add_db_constraints.sql"
)
foreach ($file in $required) {
  $path = Join-Path $scriptsDir $file
  if (-not (Test-Path $path)) {
    Write-Error "Missing source file: $path"
    exit 1
  }
}

# Verify at least two migrations already exist (001 + initial schema must both be present)
$existingMigrations = Get-ChildItem -Path $migrationsDir -Directory | Sort-Object Name
if ($existingMigrations.Count -lt 2) {
  Write-Error "Expected at least 2 migrations (001_enable_extensions + initial_schema) in $migrationsDir. Run 'prisma migrate deploy' first."
  exit 1
}

$latestMigration = $existingMigrations | Select-Object -Last 1
Write-Host "Latest migration: $($latestMigration.Name)"

# Generate timestamps 1 second apart, guaranteed to be after now
# (and therefore after the initial_schema migration which ran before this script)
$base = Get-Date
$ts010 = $base.AddSeconds(1).ToString("yyyyMMddHHmmss")
$ts011 = $base.AddSeconds(2).ToString("yyyyMMddHHmmss")
$ts012 = $base.AddSeconds(3).ToString("yyyyMMddHHmmss")

$dir010 = Join-Path $migrationsDir "${ts010}_add_fts_triggers"
$dir011 = Join-Path $migrationsDir "${ts011}_add_partial_indexes"
$dir012 = Join-Path $migrationsDir "${ts012}_add_db_constraints"

Write-Host ""
Write-Host "Creating migration directories:"
Write-Host "  $dir010"
Write-Host "  $dir011"
Write-Host "  $dir012"
Write-Host ""

New-Item -ItemType Directory -Path $dir010 -Force | Out-Null
New-Item -ItemType Directory -Path $dir011 -Force | Out-Null
New-Item -ItemType Directory -Path $dir012 -Force | Out-Null

Copy-Item (Join-Path $scriptsDir "010_add_fts_triggers.sql")  (Join-Path $dir010 "migration.sql")
Copy-Item (Join-Path $scriptsDir "011_add_partial_indexes.sql") (Join-Path $dir011 "migration.sql")
Copy-Item (Join-Path $scriptsDir "012_add_db_constraints.sql") (Join-Path $dir012 "migration.sql")

Write-Host "Migration files created. Applying now..."
Write-Host ""

# Apply the three new migrations via deploy (Supabase-compatible — no shadow database)
Set-Location $projectRoot
npx prisma migrate deploy

Write-Host ""
Write-Host "Custom migrations applied successfully."
Write-Host "Run 'npm run db:seed' next."

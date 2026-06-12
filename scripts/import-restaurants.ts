/**
 * import-restaurants.ts
 *
 * Bulk-imports a verified restaurant dataset from an Excel (.xlsx / .xls) file
 * into the Chow Here database. All imported records are set to:
 *   verificationStatus = APPROVED
 *   confidenceScore    = 1.000  (maximum — pre-verified dataset)
 *   source             = 'internal_dataset'
 *
 * Existing restaurant submissions are untouched.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/import-restaurants.ts \
 *     --file path/to/restaurants.xlsx \
 *     [--sheet "Sheet1"]         (default: first sheet)
 *     [--dry-run]                (preview without writing to DB)
 *     [--skip-duplicates]        (default: true — skips rows with matching slug)
 *
 * ─── CONFIGURE COLUMN MAPPING ────────────────────────────────────────────────
 *
 * Edit COLUMN_MAP below to match your Excel headers exactly (case-insensitive).
 * Set a key to null to mark it as "not in this file" — the field will use its
 * default value (see DEFAULT_VALUES).
 */

import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as path from 'path'
import * as process from 'process'

const db = new PrismaClient()

// ─── Column mapping ───────────────────────────────────────────
// Keys are Chow Here field names. Values are your Excel column headers.
// These are case-insensitive and trimmed before matching.

const COLUMN_MAP = {
  name:         'Name',          // required
  address:      'Address',       // required
  city:         'City',          // required
  state:        'State',         // required
  area:         'Area',          // optional neighbourhood / LGA
  phone:        'Phone',         // required (use a placeholder if absent)
  email:        'Email',         // optional
  website:      'Website',       // optional
  latitude:     'Latitude',      // optional but strongly recommended
  longitude:    'Longitude',     // optional but strongly recommended
  cuisineTypes: 'Cuisine',       // optional — comma-separated list
  priceRange:   'Price Range',   // optional — BUDGET | MID | UPSCALE
  description:  'Description',   // optional
  thumbnailUrl: 'Photo URL',     // optional
} as const

// ─── Defaults for missing / blank columns ─────────────────────

const DEFAULT_VALUES = {
  state:        'Lagos',
  phone:        'N/A',
  priceRange:   'MID' as const,
  cuisineTypes: [] as string[],
}

// ─── Helpers ──────────────────────────────────────────────────

function generateSlug(name: string, existingSlugs: Set<string>): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '') || 'restaurant'

  let slug = base
  let n = 2
  while (existingSlugs.has(slug)) {
    slug = `${base}-${n++}`
  }
  existingSlugs.add(slug)
  return slug
}

function normalizePrice(raw: string | undefined): 'BUDGET' | 'MID' | 'UPSCALE' {
  if (!raw) return DEFAULT_VALUES.priceRange
  const v = raw.toString().trim().toUpperCase()
  if (v === 'BUDGET' || v === '₦' || v === 'LOW')    return 'BUDGET'
  if (v === 'UPSCALE' || v === '₦₦₦' || v === 'HIGH') return 'UPSCALE'
  return 'MID'
}

function parseCuisineTypes(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_VALUES.cuisineTypes
  return raw.toString().split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
}

function getCell(row: Record<string, unknown>, header: string): string | undefined {
  const key = Object.keys(row).find(
    (k) => k.trim().toLowerCase() === header.trim().toLowerCase(),
  )
  if (!key) return undefined
  const v = row[key]
  if (v === null || v === undefined) return undefined
  return String(v).trim() || undefined
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const fileIdx    = args.indexOf('--file')
  const sheetIdx   = args.indexOf('--sheet')
  const isDryRun   = args.includes('--dry-run')
  const skipDups   = !args.includes('--no-skip-duplicates')

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error('Usage: npx ts-node scripts/import-restaurants.ts --file path/to/file.xlsx')
    process.exit(1)
  }

  const filePath  = path.resolve(args[fileIdx + 1])
  const sheetName = sheetIdx !== -1 ? args[sheetIdx + 1] : undefined

  console.log(`\n📂 Reading: ${filePath}`)
  if (isDryRun) console.log('🔍 Dry-run mode — nothing will be written to the database\n')

  const workbook = XLSX.readFile(filePath)
  const sheet    = workbook.Sheets[sheetName ?? workbook.SheetNames[0]]
  if (!sheet) {
    console.error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`)
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  console.log(`📋 ${rows.length} rows found in sheet "${sheetName ?? workbook.SheetNames[0]}"`)

  // Load existing slugs to avoid collisions
  const existingRecords = await db.restaurant.findMany({ select: { slug: true, name: true } })
  const existingSlugs   = new Set(existingRecords.map((r) => r.slug))
  const existingNames   = new Set(existingRecords.map((r) => r.name.toLowerCase().trim()))

  let created = 0, skipped = 0, errors = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed, row 1 is header

    const name    = getCell(row, COLUMN_MAP.name)
    const address = getCell(row, COLUMN_MAP.address)
    const city    = getCell(row, COLUMN_MAP.city)

    if (!name || !address || !city) {
      console.warn(`  ⚠️  Row ${rowNum}: missing required field (name/address/city) — skipped`)
      skipped++
      continue
    }

    if (skipDups && existingNames.has(name.toLowerCase())) {
      console.log(`  ⏭  Row ${rowNum}: "${name}" already exists — skipped`)
      skipped++
      continue
    }

    const slug        = generateSlug(name, existingSlugs)
    const state       = getCell(row, COLUMN_MAP.state)       ?? DEFAULT_VALUES.state
    const phone       = getCell(row, COLUMN_MAP.phone)       ?? DEFAULT_VALUES.phone
    const email       = getCell(row, COLUMN_MAP.email)       ?? null
    const website     = getCell(row, COLUMN_MAP.website)     ?? null
    const description = getCell(row, COLUMN_MAP.description) ?? null
    const thumbnailUrl = getCell(row, COLUMN_MAP.thumbnailUrl) ?? null
    const area        = getCell(row, COLUMN_MAP.area)        ?? null
    const latRaw      = getCell(row, COLUMN_MAP.latitude)
    const lngRaw      = getCell(row, COLUMN_MAP.longitude)
    const latitude    = latRaw ? parseFloat(latRaw) : null
    const longitude   = lngRaw ? parseFloat(lngRaw) : null
    const priceRange  = normalizePrice(getCell(row, COLUMN_MAP.priceRange))
    const cuisineTypes = parseCuisineTypes(getCell(row, COLUMN_MAP.cuisineTypes))

    if (latitude !== null && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
      console.warn(`  ⚠️  Row ${rowNum}: invalid latitude "${latRaw}" — coordinate skipped`)
    }

    const data = {
      id:                 randomUUID(),
      name,
      slug,
      address,
      city,
      state,
      area,
      phone,
      email,
      website,
      description,
      thumbnailUrl,
      priceRange,
      cuisineTypes,
      latitude:           (latitude !== null && !isNaN(latitude)) ? latitude : null,
      longitude:          (longitude !== null && !isNaN(longitude)) ? longitude : null,
      geocodedAt:         (latitude !== null && !isNaN(latitude)) ? new Date() : null,
      geocodeConf:        (latitude !== null && !isNaN(latitude)) ? 'DATASET' : null,
      source:             'internal_dataset',
      verificationStatus: 'APPROVED' as const,
      confidenceScore:    1.0,
      submittedBy:        null,
    }

    if (isDryRun) {
      console.log(`  ✅ [DRY RUN] Would create: "${name}" (${city}) slug=${slug}`)
      created++
      existingNames.add(name.toLowerCase())
      continue
    }

    try {
      await db.restaurant.create({ data })
      console.log(`  ✅ Created: "${name}" (${city})`)
      created++
      existingNames.add(name.toLowerCase())
    } catch (err) {
      console.error(`  ❌ Row ${rowNum}: failed to create "${name}":`, err)
      errors++
    }
  }

  console.log(`
─────────────────────────────────
✅  Created:  ${created}
⏭   Skipped:  ${skipped}
❌  Errors:   ${errors}
─────────────────────────────────
`)

  if (isDryRun) {
    console.log('Dry-run complete. Run without --dry-run to write to the database.')
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

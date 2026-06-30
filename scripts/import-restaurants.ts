/**
 * import-restaurants.ts
 *
 * Imports the Abuja Restaurant Database (.xlsx) into Chow Here.
 * All records are set to:
 *   verificationStatus = APPROVED
 *   confidenceScore    = 1.000  (pre-verified dataset)
 *   source             = 'internal_dataset'
 *   city               = 'Abuja'   (all records are Abuja)
 *   state              = 'FCT'
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/import-restaurants.ts \
 *     --file Abuja_Restaurant_Database.xlsx \
 *     [--dry-run]
 */

import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as path from 'path'

const db = new PrismaClient()

// ─── Column mapping — exact Excel headers ─────────────────────
const COL = {
  name:               'Restaurant Name',
  category:           'Category',
  area:               'Area',
  address:            'Address',
  website:            'Website',
  email:              'Email',
  phone:              'Phone',
} as const

// ─── Helpers ──────────────────────────────────────────────────

function cell(row: Record<string, unknown>, col: string): string | null {
  const key = Object.keys(row).find(
    (k) => k.trim().toLowerCase() === col.trim().toLowerCase(),
  )
  if (!key) return null
  const v = String(row[key] ?? '').trim()
  return v || null
}

/** "Italian & Pan-Asian" → ["Italian", "Pan-Asian"] */
function parseCuisines(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[&,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function generateSlug(name: string, taken: Set<string>): string {
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
  while (taken.has(slug)) slug = `${base}-${n++}`
  taken.add(slug)
  return slug
}

async function main() {
  const args      = process.argv.slice(2)
  const fileIdx   = args.indexOf('--file')
  const isDryRun  = args.includes('--dry-run')

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error(
      'Usage: npx ts-node --project tsconfig.scripts.json scripts/import-restaurants.ts --file Abuja_Restaurant_Database.xlsx [--dry-run]',
    )
    process.exit(1)
  }

  const filePath = path.resolve(args[fileIdx + 1])
  console.log(`\n  File : ${filePath}`)
  if (isDryRun) console.log('  Mode : dry-run — nothing will be written\n')
  else          console.log('  Mode : LIVE — writing to database\n')

  const wb    = XLSX.readFile(filePath)
  const sheet = wb.Sheets['Database'] ?? wb.Sheets[wb.SheetNames[0]]
  const rows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  console.log(`  Rows : ${rows.length}\n`)

  const existing = await db.restaurant.findMany({ select: { slug: true, name: true } })
  const takenSlugs = new Set(existing.map((r) => r.slug))
  const takenNames = new Set(existing.map((r) => r.name.toLowerCase().trim()))

  let created = 0, skipped = 0, errors = 0

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i]
    const rowNum = i + 2  // row 1 is header

    const name    = cell(row, COL.name)
    const address = cell(row, COL.address)

    if (!name || !address) {
      console.warn(`  Row ${rowNum}: missing name or address — skipped`)
      skipped++
      continue
    }

    if (takenNames.has(name.toLowerCase())) {
      console.log(`  Row ${rowNum}: "${name}" already in database — skipped`)
      skipped++
      continue
    }

    const slug         = generateSlug(name, takenSlugs)
    const area         = cell(row, COL.area)
    const website      = cell(row, COL.website)
    const email        = cell(row, COL.email)
    const phone        = cell(row, COL.phone) ?? 'N/A'   // schema requires non-null
    const cuisineTypes = parseCuisines(cell(row, COL.category))

    const data = {
      id:                 randomUUID(),
      name,
      slug,
      address,
      city:               'Abuja',
      state:              'FCT',
      area,
      phone,
      email,
      website,
      description:        null,
      thumbnailUrl:       null,
      thumbnailBlurHash:  null,
      priceRange:         'MID' as const,
      cuisineTypes,
      latitude:           null,
      longitude:          null,
      geocodedAt:         null,
      geocodeConf:        null,
      source:             'internal_dataset',
      verificationStatus: 'APPROVED' as const,
      confidenceScore:    1.0,
      submittedBy:        null,
    }

    if (isDryRun) {
      console.log(
        `  [DRY] "${name}" | area: ${area ?? '—'} | cuisines: ${cuisineTypes.join(', ') || '—'} | slug: ${slug}`,
      )
      created++
      takenNames.add(name.toLowerCase())
      continue
    }

    try {
      await db.restaurant.create({ data })
      console.log(`  Created: "${name}" (${area ?? 'Abuja'})`)
      created++
      takenNames.add(name.toLowerCase())
    } catch (err) {
      console.error(`  Row ${rowNum}: "${name}" — ${(err as Error).message}`)
      errors++
    }
  }

  console.log(`
─────────────────────────────
Created : ${created}
Skipped : ${skipped}
Errors  : ${errors}
─────────────────────────────
`)

  if (isDryRun && errors === 0) {
    console.log('Dry-run passed. Run without --dry-run to import.')
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

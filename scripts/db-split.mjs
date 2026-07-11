// Split the master exercise CSV into one file per Home Category, for
// category-by-category fact-checking.
//
//   node scripts/db-split.mjs
//
// Reads data/professional_hypertrophy_db_v3.csv and writes one CSV per category
// into data/factcheck/ (01-chest.csv … 08-legs.csv), each with the FULL header
// plus that category's rows, unchanged. Also writes data/factcheck/_manifest.json.
//
// The master CSV is NOT modified — it stays the untouched baseline until we merge
// the fact-checked category files back at the end (scripts/db-merge.mjs, later).
//
// Losslessness is guaranteed: before writing, the script re-parses what it would
// write and asserts the row multiset is byte-identical to the original. If that
// check fails it aborts without touching disk.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_CSV = join(ROOT, 'data', 'professional_hypertrophy_db_v3.csv')
const OUT_DIR = join(ROOT, 'data', 'factcheck')

// Category display + file order — mirrors CATEGORY_ORDER in src/lib/exerciseBank.js.
const CATEGORY_ORDER = ['Chest', 'Back', 'Shoulders', 'Arms', 'Forearms', 'Traps', 'Core', 'Legs']

// ---- CSV parse (identical to scripts/lint-exercises.mjs) --------------------
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ---- CSV serialize (RFC-style: quote fields with comma/quote/newline) -------
function serializeCSV(rows, nl) {
  const cell = (f) => {
    const s = f == null ? '' : String(f)
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return rows.map((r) => r.map(cell).join(',')).join(nl) + nl
}

const rowKey = (r) => JSON.stringify(r)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function main() {
  const text = readFileSync(SRC_CSV, 'utf8')
  const nl = text.includes('\r\n') ? '\r\n' : '\n'

  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ''))
  const header = rows[0]
  const dataRows = rows.slice(1)

  const catIdx = header.findIndex((h) => /^(home )?category$/i.test(h.trim()))
  const nameIdx = header.findIndex((h) => /^exercise name$/i.test(h.trim()))
  if (catIdx === -1) throw new Error('Could not find the "Home Category" column.')
  if (nameIdx === -1) throw new Error('Could not find the "Exercise Name" column.')

  // Group rows by category, preserving original within-category order.
  const groups = new Map()
  for (const r of dataRows) {
    const cat = (r[catIdx] || '').trim()
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat).push(r)
  }

  // Ordered category list: known order first, any unexpected categories appended.
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ]
  const unexpected = ordered.filter((c) => !CATEGORY_ORDER.includes(c))
  if (unexpected.length) console.warn(`⚠ Unexpected categories (appended): ${unexpected.join(', ')}`)

  // Build the per-category file contents in memory.
  const files = ordered.map((cat, i) => {
    const num = String(i + 1).padStart(2, '0')
    const name = `${num}-${slug(cat) || 'uncategorized'}.csv`
    const rowsForCat = groups.get(cat)
    return { cat, name, rowsForCat, content: serializeCSV([header, ...rowsForCat], nl) }
  })

  // ---- Losslessness check BEFORE writing anything -------------------------
  // Re-parse every file we intend to write; the union of their data rows must be
  // a byte-identical multiset of the original data rows.
  const seen = new Map() // rowKey -> count, from re-parsed outputs
  for (const f of files) {
    const parsed = parseCSV(f.content).filter((r) => r.some((c) => c.trim() !== ''))
    const outHeader = parsed[0]
    if (rowKey(outHeader) !== rowKey(header)) throw new Error(`Header mismatch in ${f.name}.`)
    for (const r of parsed.slice(1)) seen.set(rowKey(r), (seen.get(rowKey(r)) || 0) + 1)
  }
  const want = new Map()
  for (const r of dataRows) want.set(rowKey(r), (want.get(rowKey(r)) || 0) + 1)
  // Compare the two multisets exactly.
  let outTotal = 0
  for (const v of seen.values()) outTotal += v
  if (outTotal !== dataRows.length) throw new Error(`Row count mismatch: split has ${outTotal}, original ${dataRows.length}.`)
  for (const [k, v] of want) {
    if (seen.get(k) !== v) throw new Error(`Row multiset mismatch (a row is missing/duplicated/altered): ${k.slice(0, 120)}…`)
  }
  if (seen.size !== want.size) throw new Error('Row multiset mismatch: extra rows present in split output.')

  // ---- Write ---------------------------------------------------------------
  mkdirSync(OUT_DIR, { recursive: true })
  const manifest = { generatedAt: new Date().toISOString().slice(0, 10), source: 'data/professional_hypertrophy_db_v3.csv', total: dataRows.length, columns: header.length, categories: [] }
  for (const f of files) {
    writeFileSync(join(OUT_DIR, f.name), f.content)
    manifest.categories.push({ file: f.name, category: f.cat, count: f.rowsForCat.length, exercises: f.rowsForCat.map((r) => (r[nameIdx] || '').trim()) })
  }
  writeFileSync(join(OUT_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  // ---- Report --------------------------------------------------------------
  console.log(`✓ Losslessness verified: ${dataRows.length} rows split across ${files.length} files, byte-identical multiset.`)
  console.log(`  → ${OUT_DIR}`)
  for (const c of manifest.categories) console.log(`    ${c.file.padEnd(16)} ${String(c.count).padStart(3)}  ${c.category}`)
}

main()

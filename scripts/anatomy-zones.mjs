// Regenerates the clickable label-zone geometry for the anatomy map
// (src/data/anatomyRegions.js) from the art itself, whenever Hani re-exports
// the labelled male/female images.
//
//   node scripts/anatomy-zones.mjs public/images/anatomy-male.webp male
//
// Method (matches how the original rects were produced):
//   1. Figure boxes: mask every non-background pixel, find the empty vertical
//      gutter between the two figures, take a tight bbox per side (front left,
//      back right).
//   2. Label rects: mask near-WHITE pixels (label text + leader lines; the gold
//      figure art fails the whiteness test), take connected components, drop
//      line-like components (long/thin = leader lines), cluster the remaining
//      glyphs into horizontal text lines, pad each line's bbox.
//   3. Assign slugs by vertical order per side — the expected order is declared
//      in LABELS below and the script REFUSES to print output if the detected
//      line count doesn't match, so a re-export with added/removed labels is
//      surfaced instead of silently mislabelled.
// Output is the ANATOMY_SOURCES entry + zone arrays, ready to paste into
// anatomyRegions.js (rects normalized 0..1 within each view's box).
import sharp from 'sharp'

// Expected labels per sex/view, top-to-bottom as drawn in the art.
const LABELS = {
  male: {
    front: [
      ['traps', 'Neck and Trapezius'],
      ['shoulders', 'Shoulders'],
      ['chest', 'Chest'],
      ['biceps', 'Biceps'],
      ['core', 'Core'],
      ['forearms', 'Forearms'],
      ['quads', 'Quadriceps'],
      ['adductors', 'Inner Thighs'],
      ['tibialis', 'Tibialis Anterior'],
    ],
    back: [
      ['traps', 'Neck and Trapezius'],
      ['shoulders', 'Shoulders'],
      ['triceps', 'Triceps'],
      ['lats', 'Lats'],
      ['spinal-erectors', 'Lower Back'],
      ['forearms', 'Forearms'],
      ['glutes', 'Glutes'],
      ['abductors', 'Outer Thighs'],
      ['hamstrings', 'Hamstrings'],
      ['calves', 'Calves'],
    ],
  },
  female: {
    front: [
      ['traps', 'Neck and Trapezius'],
      ['shoulders', 'Shoulders'],
      ['chest', 'Chest'],
      ['biceps', 'Biceps'],
      ['forearms', 'Forearms'],
      ['core', 'Core'],
      ['adductors', 'Inner Thighs'],
      ['quads', 'Quadriceps'],
    ],
    back: [
      ['traps', 'Neck and Trapezius'],
      ['shoulders', 'Shoulders'],
      ['triceps', 'Triceps'],
      ['lats', 'Lats'],
      ['spinal-erectors', 'Lower Back'],
      ['forearms', 'Forearms'],
      ['glutes', 'Glutes'],
      ['abductors', 'Outer Thighs'],
      ['hamstrings', 'Hamstrings'],
      ['calves', 'Calves'],
    ],
  },
}

const [, , file, sex] = process.argv
if (!file || !LABELS[sex]) {
  console.error('usage: node scripts/anatomy-zones.mjs <image> <male|female>')
  process.exit(1)
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const px = (x, y) => {
  const i = (y * W + x) * 4
  return [data[i], data[i + 1], data[i + 2]]
}

// ---- 1. figure boxes --------------------------------------------------------
// Content = anything meaningfully brighter than the near-black background.
const isContent = (x, y) => {
  const [r, g, b] = px(x, y)
  return r + g + b > 150
}
const colHas = new Array(W).fill(false)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (isContent(x, y)) colHas[x] = true
  }
}
// The gutter between the figures: an empty column run near the image's centre.
// NOT the widest run — the figures' arms can interleave, leaving several empty
// bands (e.g. between a hanging hand and the torso it belongs to), and picking
// the widest one splits an arm off its figure. The run closest to centre is the
// true seam.
let best = null
for (let x = Math.floor(W * 0.25), runStart = -1; x < Math.floor(W * 0.75) + 1; x++) {
  const empty = x < Math.floor(W * 0.75) && !colHas[x]
  if (empty && runStart === -1) runStart = x
  if (!empty && runStart !== -1) {
    const run = { x: runStart, w: x - runStart }
    if (run.w >= 4 && (!best || Math.abs(run.x + run.w / 2 - W / 2) < Math.abs(best.x + best.w / 2 - W / 2))) best = run
    runStart = -1
  }
}
if (!best) throw new Error('no gutter found between the two figures')
const gutterMid = best.x + best.w / 2

const bboxOfSide = (x0, x1) => {
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1
  for (let y = 0; y < H; y++) {
    for (let x = x0; x < x1; x++) {
      if (isContent(x, y)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}
// Pad each box a little into the surrounding empty background, so zone-rect
// padding around edge-hugging labels isn't clipped by the viewBox.
const PAD_BOX = 8
const pad = (b) => ({
  x: Math.max(0, b.x - PAD_BOX),
  y: Math.max(0, b.y - PAD_BOX),
  w: Math.min(W - 1, b.x + b.w - 1 + PAD_BOX) - Math.max(0, b.x - PAD_BOX) + 1,
  h: Math.min(H - 1, b.y + b.h - 1 + PAD_BOX) - Math.max(0, b.y - PAD_BOX) + 1,
})
const boxes = { front: pad(bboxOfSide(0, Math.floor(gutterMid))), back: pad(bboxOfSide(Math.ceil(gutterMid), W)) }

// ---- 2. label text ----------------------------------------------------------
// White-ish: bright AND unsaturated (the gold art is bright but saturated).
const isText = (x, y) => {
  const [r, g, b] = px(x, y)
  return Math.min(r, g, b) > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 55
}
// Connected components over the text mask (4-connectivity, iterative flood).
const seen = new Uint8Array(W * H)
const comps = []
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (seen[y * W + x] || !isText(x, y)) continue
    const stack = [[x, y]]
    seen[y * W + x] = 1
    let minX = x, maxX = x, minY = y, maxY = y, area = 0
    while (stack.length) {
      const [cx, cy] = stack.pop()
      area++
      if (cx < minX) minX = cx
      if (cx > maxX) maxX = cx
      if (cy < minY) minY = cy
      if (cy > maxY) maxY = cy
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !isText(nx, ny)) continue
        seen[ny * W + nx] = 1
        stack.push([nx, ny])
      }
    }
    comps.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area })
  }
}
// Glyphs are compact; leader lines are long and sparse — and the leader lines
// are DASHED, so each dash is its own small component. Dashes are 1–2px in one
// dimension while real glyphs are at least ~5px tall and ~3px wide, which is
// the cleanest separator.
const glyphs = comps.filter((c) => {
  if (c.area < 6) return false
  if (c.h < 5 || c.w < 3) return false // dash / anti-aliased line fragment
  const long = Math.max(c.w, c.h)
  const fill = c.area / (c.w * c.h)
  if (long > 45 && fill < 0.25) return false // leader line (possibly touching a glyph)
  if (c.h > 34 || c.w > 60) return false
  return true
})

// Cluster glyphs into text lines: same side, vertical overlap, small x gaps.
const lines = []
for (const g of glyphs.sort((a, b) => a.x - b.x)) {
  const line = lines.find(
    (l) =>
      (g.x < gutterMid) === (l.x < gutterMid) &&
      g.y < l.y + l.h && g.y + g.h > l.y &&
      g.x - (l.x + l.w) < 32 && g.x - (l.x + l.w) > -10
  )
  if (line) {
    const maxX = Math.max(line.x + line.w, g.x + g.w)
    const maxY = Math.max(line.y + line.h, g.y + g.h)
    line.x = Math.min(line.x, g.x)
    line.y = Math.min(line.y, g.y)
    line.w = maxX - line.x
    line.h = maxY - line.y
  } else {
    lines.push({ ...g })
  }
}

// ---- 3. assign + print ------------------------------------------------------
const PAD_X = 7, PAD_Y = 5
const round = (n) => Math.round(n * 1e4) / 1e4
for (const view of ['front', 'back']) {
  const expected = LABELS[sex][view]
  const box = boxes[view]
  const sideLines = lines
    .filter((l) => (l.x + l.w / 2 < gutterMid) === (view === 'front'))
    .sort((a, b) => a.y - b.y)
  if (sideLines.length !== expected.length) {
    console.error(`${view}: found ${sideLines.length} text lines, expected ${expected.length}:`)
    for (const l of sideLines) console.error(`  [${l.x}, ${l.y}, ${l.w}, ${l.h}]`)
    process.exit(1)
  }
  console.log(`  ${view}: { x: ${box.x}, y: ${box.y}, w: ${box.w}, h: ${box.h} },`)
  for (let i = 0; i < sideLines.length; i++) {
    const l = sideLines[i]
    const [slug, label] = expected[i]
    const rect = [
      round((l.x - PAD_X - box.x) / box.w),
      round((l.y - PAD_Y - box.y) / box.h),
      round((l.w + 2 * PAD_X) / box.w),
      round((l.h + 2 * PAD_Y) / box.h),
    ]
    console.log(`      { slug: '${slug}', label: '${label}', rect: [${rect.join(', ')}] },`)
  }
}
console.log(`image: ${W}x${H}`)

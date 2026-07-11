// A weighted muscle heatmap: front + back stylized body figures whose regions
// light up by how hard an exercise trains each muscle. Driven by the exercise's
// muscle map (atom name -> contribution weight, 1.0 primary … 0.125 stabilizer).
//
// Design:
//  - One warm "heat" hue at varying opacity over a theme-neutral body — reads
//    correctly in both light and dark without a second palette (the brand itself
//    is monochrome, so the accent can't carry intensity).
//  - Stylized/diagrammatic, not medically precise. ~24 regions cover 24 of our
//    33 atoms; deep muscles that can't render in 2D (Rotator Cuff, Transverse
//    Abdominis, Deep Finger Flexors) fold into their parent region.
//  - Region ids/atom lists are exported (MUSCLE_REGIONS) so the dashboard
//    Recovery card and the future 3D model can reuse the same mapping.

const HEAT = '#E4553C' // warm coral — visible on cream and near-black alike
const FX = 110 // front figure centre x
const BX = 310 // back figure centre x

const e = (cx, cy, rx, ry, rot = 0) => ({ cx, cy, rx, ry, rot })

// region id -> canonical muscle atoms it represents (deep muscles folded in).
export const MUSCLE_REGIONS = {
  'front-delts': ['Front Delts', 'Rotator Cuff'],
  'side-delts': ['Side Delts'],
  'upper-chest': ['Upper Chest'],
  'mid-chest': ['Middle Chest'],
  'lower-chest': ['Lower Chest'],
  biceps: ['Biceps', 'Brachialis'],
  'forearm-front': ['Brachioradialis', 'Wrist Flexors', 'Deep Finger Flexors'],
  abs: ['Rectus Abdominis', 'Transverse Abdominis'],
  obliques: ['Obliques'],
  'hip-flexors': ['Hip Flexors'],
  quads: ['Quadriceps'],
  adductors: ['Adductors'],
  'upper-traps': ['Upper Traps'],
  'mid-traps': ['Mid Traps', 'Lower Traps'],
  'rear-delts': ['Rear Delts'],
  'upper-back': ['Mid Back', 'Rhomboids', 'Teres Major'],
  lats: ['Lats'],
  erectors: ['Spinal Erectors'],
  triceps: ['Triceps'],
  'forearm-back': ['Wrist Extensors'],
  glutes: ['Glute Max'],
  abductors: ['Abductors'],
  hamstrings: ['Hamstrings'],
  calves: ['Gastrocnemius', 'Soleus'],
}

// Shapes for each region (front figure at FX, back figure at BX).
const SHAPES = {
  'front-delts': [e(FX - 40, 74, 13, 12), e(FX + 40, 74, 13, 12)],
  'side-delts': [e(FX - 49, 73, 8, 11), e(FX + 49, 73, 8, 11)],
  'upper-chest': [e(FX - 17, 88, 16, 7), e(FX + 17, 88, 16, 7)],
  'mid-chest': [e(FX - 17, 99, 17, 8), e(FX + 17, 99, 17, 8)],
  'lower-chest': [e(FX - 15, 110, 14, 7), e(FX + 15, 110, 14, 7)],
  biceps: [e(FX - 47, 112, 9, 20), e(FX + 47, 112, 9, 20)],
  'forearm-front': [e(FX - 53, 152, 8, 22), e(FX + 53, 152, 8, 22)],
  abs: [e(FX, 140, 15, 28)],
  obliques: [e(FX - 20, 148, 6, 18), e(FX + 20, 148, 6, 18)],
  'hip-flexors': [e(FX - 11, 182, 7, 8), e(FX + 11, 182, 7, 8)],
  quads: [e(FX - 20, 242, 15, 41), e(FX + 20, 242, 15, 41)],
  adductors: [e(FX - 8, 236, 7, 30), e(FX + 8, 236, 7, 30)],
  'upper-traps': [e(BX - 17, 66, 16, 9), e(BX + 17, 66, 16, 9)],
  'mid-traps': [e(BX, 96, 20, 22)],
  'rear-delts': [e(BX - 40, 74, 13, 12), e(BX + 40, 74, 13, 12)],
  'upper-back': [e(BX - 17, 90, 12, 13), e(BX + 17, 90, 12, 13)],
  lats: [e(BX - 25, 122, 15, 30, 12), e(BX + 25, 122, 15, 30, -12)],
  erectors: [e(BX, 148, 9, 34)],
  triceps: [e(BX - 47, 112, 9, 20), e(BX + 47, 112, 9, 20)],
  'forearm-back': [e(BX - 53, 152, 8, 22), e(BX + 53, 152, 8, 22)],
  glutes: [e(BX - 18, 192, 18, 18), e(BX + 18, 192, 18, 18)],
  abductors: [e(BX - 35, 188, 8, 14), e(BX + 35, 188, 8, 14)],
  hamstrings: [e(BX - 20, 252, 15, 40), e(BX + 20, 252, 15, 40)],
  calves: [e(BX - 18, 346, 11, 28), e(BX + 18, 346, 11, 28)],
}

// A faint humanoid silhouette behind the muscles, per figure centre.
function Silhouette({ cx }) {
  return (
    <g fill="currentColor" fillOpacity={0.07}>
      <circle cx={cx} cy={38} r={16} />
      <path d={`M ${cx - 34} 60 Q ${cx - 42} 112 ${cx - 22} 152 L ${cx - 27} 190 L ${cx + 27} 190 L ${cx + 22} 152 Q ${cx + 42} 112 ${cx + 34} 60 Z`} />
      <rect x={cx - 58} y={64} width={15} height={112} rx={7.5} />
      <rect x={cx + 43} y={64} width={15} height={112} rx={7.5} />
      <rect x={cx - 29} y={186} width={23} height={218} rx={11} />
      <rect x={cx + 6} y={186} width={23} height={218} rx={11} />
    </g>
  )
}

function weightOf(muscles, atoms) {
  let w = 0
  for (const a of atoms) if ((muscles[a] || 0) > w) w = muscles[a]
  return w
}

export default function MuscleMap({ muscles = {}, className = '' }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 420 470" className="w-full h-auto text-text-light" role="img" aria-label="Muscles worked, front and back">
        <Silhouette cx={FX} />
        <Silhouette cx={BX} />
        {Object.entries(SHAPES).map(([id, shapes]) => {
          const w = weightOf(muscles, MUSCLE_REGIONS[id])
          const worked = w > 0
          const fill = worked ? HEAT : 'currentColor'
          const op = worked ? 0.3 + 0.7 * Math.min(1, w) : 0.14
          return (
            <g key={id} fill={fill} fillOpacity={op} stroke="currentColor" strokeOpacity={0.22} strokeWidth={0.5}>
              {shapes.map((s, i) => (
                <ellipse
                  key={i}
                  cx={s.cx}
                  cy={s.cy}
                  rx={s.rx}
                  ry={s.ry}
                  transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined}
                />
              ))}
            </g>
          )
        })}
        <text x={FX} y={452} textAnchor="middle" className="fill-text-light" fontSize={13} fontFamily="var(--font-heading)">Front</text>
        <text x={BX} y={452} textAnchor="middle" className="fill-text-light" fontSize={13} fontFamily="var(--font-heading)">Back</text>
      </svg>

      {/* legend */}
      <div className="flex items-center justify-center gap-2 mt-1">
        <span className="text-[10px] text-text-light">Less</span>
        <div className="flex gap-0.5">
          {[0.35, 0.55, 0.75, 1].map((o) => (
            <span key={o} className="w-4 h-2 rounded-sm" style={{ backgroundColor: HEAT, opacity: o }} />
          ))}
        </div>
        <span className="text-[10px] text-text-light">More</span>
      </div>
    </div>
  )
}

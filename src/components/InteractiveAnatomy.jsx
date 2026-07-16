import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { asset } from '../lib/assets'
import { useAuth } from '../lib/auth'
import { hubPath } from '../data/muscleInfo'
import {
  ANATOMY_SOURCES,
  SEXES,
  readAnatomySexChoice,
  writeAnatomySex,
  zonesFor,
  rectAttrs,
} from '../data/anatomyRegions'

const DEBUG = import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('anatomy-debug')

// One cropped figure (front or back) with its label overlay. The image is
// oversized and offset so the figure's bounding box fills the container; the
// overlay's viewBox is that same box, so the zones line up at any width.
//
// Zones sit on the labels drawn into the art. With `values` they render as
// tinted chips (the tint is data — recovery/volume); otherwise they're links
// that only tint on hover/focus/press, leaving the artwork clean at rest.
// Labels are drawn into the art at a fixed size, so how legible they are is
// purely a function of how wide the figure renders. MIN_FIGURE_PX keeps them
// readable (~11px) on narrow screens by letting the figure overflow its column
// and scroll sideways, rather than shrinking into 6px noise. It never upscales
// past the art's native width, which would just blur it.
const MIN_FIGURE_PX = 360

function Figure({ src, view, zones, interactive, values, onActivate, onDebugClick }) {
  const box = src[view]
  const style = {
    width: `${(src.w / box.w) * 100}%`,
    height: `${(src.h / box.h) * 100}%`,
    left: `${(-box.x / box.w) * 100}%`,
    top: `${(-box.y / box.h) * 100}%`,
  }
  return (
    <div
      className="relative overflow-hidden rounded-lg mx-auto"
      style={{
        aspectRatio: `${box.w} / ${box.h}`,
        minWidth: `${MIN_FIGURE_PX}px`,
        maxWidth: `${box.w}px`,
      }}
    >
      <img
        src={asset(src.src)}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute max-w-none select-none pointer-events-none"
        style={style}
      />
      <svg
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        className="absolute inset-0 w-full h-full"
        role={interactive ? 'group' : 'presentation'}
        onClick={onDebugClick}
      >
        {zones.map((z) => {
          const r = rectAttrs(z.rect, box)
          if (values) {
            const v = values[z.slug]
            if (!v) return null
            return (
              <g key={z.slug} className="anatomy-zone-value">
                <title>{v.title || z.label}</title>
                <rect {...r} rx="4" style={{ fill: v.fill }} />
              </g>
            )
          }
          return (
            <a
              key={z.slug}
              href={hubPath(z.slug)}
              className="anatomy-zone"
              aria-label={z.label}
              onClick={(e) => {
                e.preventDefault()
                onActivate(z, 'click')
              }}
              onMouseEnter={() => onActivate(z, 'hover')}
              onMouseLeave={() => onActivate(null, 'hover')}
              onFocus={() => onActivate(z, 'focus')}
              onBlur={() => onActivate(null, 'focus')}
            >
              <title>{z.label}</title>
              <rect {...r} rx="4" />
            </a>
          )
        })}
        {DEBUG &&
          zones.map((z) => {
            const r = rectAttrs(z.rect, box)
            return (
              <rect
                key={`dbg-${z.slug}`}
                {...r}
                rx="4"
                fill="none"
                stroke="#facc15"
                strokeWidth="1"
                style={{ pointerEvents: 'none' }}
              />
            )
          })}
      </svg>
    </div>
  )
}

// The anatomy map. Props:
//   values       — { [slug]: { fill, title } }; renders static tinted chips
//                  instead of links (used by the dashboard body map)
//   views        — which figures to show (['front','back'] by default)
//   showSexToggle, compact, className
export default function InteractiveAnatomy({
  values = null,
  views = ['front', 'back'],
  showSexToggle = true,
  compact = false,
  className = '',
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [sex, setSex] = useState(() => readAnatomySexChoice() || 'female')
  const [active, setActive] = useState(null)
  const [failed, setFailed] = useState(false)
  const interactive = !values
  const src = ANATOMY_SOURCES[sex]

  // The profile arrives after first paint, so the saved sex can't be a useState
  // initializer. An explicit toggle choice always wins over it.
  useEffect(() => {
    const chosen = readAnatomySexChoice()
    if (!chosen && (profile?.sex === 'male' || profile?.sex === 'female')) setSex(profile.sex)
  }, [profile])

  const chooseSex = (id) => {
    setSex(id)
    writeAnatomySex(id)
  }

  const onActivate = useCallback(
    (zone, source) => {
      if (zone && source === 'click') {
        navigate(hubPath(zone.slug))
        return
      }
      setActive(zone)
    },
    [navigate]
  )

  // In debug mode, log click coords in the image's pixel space for tuning.
  const debugClick = DEBUG
    ? (e) => {
        const svg = e.currentTarget
        const pt = svg.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const p = pt.matrixTransform(svg.getScreenCTM().inverse())
        // eslint-disable-next-line no-console
        console.log(`anatomy-debug: [${Math.round(p.x)}, ${Math.round(p.y)}]`)
      }
    : undefined

  // A failed image still leaves the page usable — the category pills below the
  // hero (or the dashboard's own lists) remain the path to the same data.
  if (failed) return <div className={className} />

  return (
    <div className={className}>
      {/* preload probe: flips to the pills-only fallback if the art 404s */}
      <img src={asset(src.src)} alt="" className="hidden" onError={() => setFailed(true)} />

      <div className="rounded-2xl border border-[#2a2c34] bg-[#0d0e12] px-4 py-5 sm:px-6">
        {(showSexToggle || (interactive && !compact)) && (
          <div className="flex items-center justify-between gap-3 mb-3">
            {interactive && !compact ? (
              <p className="text-[12px] text-[#c7c6c0]">Tap a muscle label to see its exercises</p>
            ) : (
              <span />
            )}
            {showSexToggle && (
              <div className="inline-flex rounded-full border border-[#33353f] p-0.5 shrink-0">
                {SEXES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => chooseSex(s.id)}
                    aria-pressed={sex === s.id}
                    className={`text-[11px] px-3 py-1 rounded-full cursor-pointer border-none transition-colors ${
                      sex === s.id ? 'bg-[#efc65b] text-[#101116] font-medium' : 'bg-transparent text-[#c7c6c0]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Side by side only once each figure still gets a legible width; below
            that they stack, and each scrolls on its own if the screen is too
            narrow for the labels. */}
        <div className={`grid gap-3 ${views.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {views.map((view) => (
            <div key={view} className="overflow-x-auto">
              <Figure
                src={src}
                view={view}
                zones={zonesFor(sex, view)}
                interactive={interactive}
                values={values}
                onActivate={onActivate}
                onDebugClick={debugClick}
              />
            </div>
          ))}
        </div>

        {interactive && (
          <p className="text-[12px] text-[#efc65b] mt-3 min-h-[1.2em] text-center" aria-live="polite">
            {active ? active.label : ' '}
          </p>
        )}
      </div>
    </div>
  )
}

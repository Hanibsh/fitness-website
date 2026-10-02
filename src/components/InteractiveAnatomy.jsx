import { useEffect, useState, useCallback, useRef } from 'react'
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
// Extra tap margin round a label in selection mode, in the art's own pixels.
const HIT_PAD = 7

// The two figures are the same size in the art, but their boxes are not: the
// labels sit further from the front figure than the back one, so the front box
// is wider (female 577 vs 522). Sizing both to the same column width therefore
// renders them at different SCALES — the back figure came out ~10% bigger.
//
// So every width is a fraction of the widest box on show, which lands both on one
// scale in either layout: side by side the narrower figure takes ~90% of its equal
// column, stacked it takes ~90% of the single one. `min` has to be scaled the same
// way or the narrower figure hits its floor first and the scales split apart again.
function sizing(box, ref) {
  const share = box.w / ref
  return {
    width: `${share * 100}%`,
    maxWidth: `${box.w}px`,
    minWidth: `${MIN_FIGURE_PX * share}px`,
  }
}

function Figure({ src, view, zones, refWidth, interactive, values, selected, onSelect, onActivate, onDebugClick }) {
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
        ...sizing(box, refWidth),
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
          // Selection mode: a toggle, not a link — the pick stays ringed.
          if (onSelect) {
            const on = selected?.includes(z.slug)
            const pick = () => onSelect(z)
            return (
              <g
                key={z.slug}
                className={`anatomy-zone${on ? ' is-on' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={z.label}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pick()
                  }
                }}
                onMouseEnter={() => onActivate(z, 'hover')}
                onMouseLeave={() => onActivate(null, 'hover')}
              >
                <title>{z.label}</title>
                {/* The labels are small on a phone; an invisible margin round
                    each makes it a finger-sized target without changing what
                    the ring draws. */}
                <rect
                  x={r.x - HIT_PAD}
                  y={r.y - HIT_PAD}
                  width={r.width + 2 * HIT_PAD}
                  height={r.height + 2 * HIT_PAD}
                  style={{ fill: 'transparent', stroke: 'none', filter: 'none' }}
                />
                <rect {...r} rx="4" />
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
//   onSelect     — (zone) => void; turns the labels into toggles instead of
//                  links (FocusPicker). `selected` lists the zone slugs to ring.
//   views        — which figures to show (['front','back'] by default)
//   viewToggle   — show ONE figure at a time with a Front/Back switch, for
//                  places a two-figure map would be too tall (a form)
//   hint         — the line above the figures; children render under them
//   showSexToggle, compact, className
export default function InteractiveAnatomy({
  values = null,
  onSelect = null,
  selected = null,
  views: shownViews = ['front', 'back'],
  viewToggle = false,
  hint = 'Tap a muscle label to see its exercises',
  showSexToggle = true,
  compact = false,
  className = '',
  children = null,
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [sex, setSex] = useState(() => readAnatomySexChoice() || 'female')
  const [active, setActive] = useState(null)
  const [failed, setFailed] = useState(false)
  const [oneView, setOneView] = useState('front')
  // On a screen too narrow for the whole figure it scrolls sideways (see
  // MIN_FIGURE_PX). The art puts every front label left of the figure and every
  // back label right of it, so the one-figure view opens scrolled to the side
  // its labels are on — all of them in view without a swipe.
  const scroller = useRef(null)
  useEffect(() => {
    const el = scroller.current
    if (viewToggle && el) el.scrollLeft = oneView === 'back' ? el.scrollWidth : 0
  }, [viewToggle, oneView, sex])
  const views = viewToggle ? [oneView] : shownViews
  const interactive = !values
  const src = ANATOMY_SOURCES[sex]
  // Widest box on show — every figure is sized as a fraction of it, so they all
  // render at one scale (see `sizing`).
  // With the Front/Back switch, both views still size against the wider box, so
  // flipping between them doesn't rescale the figure.
  const refWidth = Math.max(...(viewToggle ? ['front', 'back'] : views).map((v) => src[v].w))

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
        {(showSexToggle || viewToggle || (interactive && !compact)) && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
            {interactive && !compact && hint ? (
              <p className="text-[12px] text-[#c7c6c0]">{hint}</p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2 ml-auto">
            {viewToggle && (
              <div className="inline-flex rounded-full border border-[#33353f] p-0.5 shrink-0">
                {[['front', 'Front'], ['back', 'Back']].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOneView(id)}
                    aria-pressed={oneView === id}
                    className={`text-[11px] px-3 py-1 rounded-full cursor-pointer border-none transition-colors ${
                      oneView === id ? 'bg-[#efc65b] text-[#101116] font-medium' : 'bg-transparent text-[#c7c6c0]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {showSexToggle && (
              <div className="inline-flex rounded-full border border-[#33353f] p-0.5 shrink-0">
                {SEXES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
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
          </div>
        )}

        {/* Side by side only once each figure still gets a legible width; below
            that they stack, and each scrolls on its own if the screen is too
            narrow for the labels. */}
        <div className={`grid gap-3 ${views.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {views.map((view) => (
            <div key={view} className="overflow-x-auto" ref={viewToggle ? scroller : undefined}>
              <Figure
                src={src}
                view={view}
                zones={zonesFor(sex, view)}
                refWidth={refWidth}
                interactive={interactive}
                values={values}
                selected={selected}
                onSelect={onSelect}
                onActivate={onActivate}
                onDebugClick={debugClick}
              />
            </div>
          ))}
        </div>

        {interactive && !onSelect && (
          <p className="text-[12px] text-[#efc65b] mt-3 min-h-[1.2em] text-center" aria-live="polite">
            {active ? active.label : ' '}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

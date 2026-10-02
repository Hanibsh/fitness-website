import { useState, useEffect, useMemo } from 'react'
import { Copy, Check, Share2, FileText, FileSpreadsheet } from 'lucide-react'
import Modal from './Modal'
import { useAuth } from '../lib/auth'
import { useInjuries } from '../lib/useInjuries'
import { openInjuries, injuryTitle } from '../lib/injuries'
import { getHistory, getUnit, getExerciseNote, getExportPrefs, saveExportPrefs } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'
import { buildExportModel, exportText, exportFileName, DEFAULT_EXPORT_PREFS, COACH_NOTES_HEADING } from '../lib/programExport'
import { copyText, canShareText, shareText, downloadText, downloadBlob } from '../lib/download'
import { workbookBlob } from '../lib/excelExport'
import { usePlanPerson } from '../lib/profilePrefill'

const NO_PROFILE = {}

// Export a split as text or Excel — the panel around lib/programExport.js.
//
// The preview IS the export: what's in the box is exactly what Copy, Share and
// Download hand over, so there's never a "what will this look like" guess. Each
// chip switches one thing in or out, and the choice is remembered on this
// device for next time.
//
// Two kinds of split come through here. Your own (no `client`): the profile is
// yours, notes are the shared per-movement ones, and the log supplies last-used
// weights. A client's (`client` = { name, profile, extra, injuries, notes }):
// everything comes from the client record and nothing from your account — no
// weights, no notes of yours, no injuries of yours.
export default function ExportModal({ program, client = null, onClose }) {
  const { user, profile, nickname } = useAuth()
  const { injuries } = useInjuries()
  const own = !client
  const [sessions, setSessions] = useState([])
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_EXPORT_PREFS, ...(getExportPrefs() || {}) }))
  const [copied, setCopied] = useState(false)
  const [excel, setExcel] = useState('idle') // idle | busy | failed
  // Whose bodyweight turns a cardio row's minutes into calories (and back):
  // the client's, or yours — your latest weigh-in when the profile has none.
  const person = usePlanPerson(own ? null : client.profile || NO_PROFILE)

  // Your log, for the weights you last used. Loaded the way every other
  // surface loads it: the account when signed in, this device otherwise.
  useEffect(() => {
    if (!own) return
    let cancelled = false
    async function load() {
      if (user) {
        try {
          const remote = await fetchRemoteHistory(user.id)
          if (!cancelled) return setSessions(remote)
        } catch {
          // fall through to this device's copy
        }
      }
      if (!cancelled) setSessions(getHistory())
    }
    load()
    return () => { cancelled = true }
  }, [own, user])

  const model = useMemo(
    () =>
      own
        ? buildExportModel({
            program,
            profile,
            forName: profile?.display_name || nickname || '',
            sessions,
            unit: profile?.unit || getUnit(),
            noteFor: (pe) => getExerciseNote(pe) || pe.note || '',
            injuries: openInjuries(injuries).map(injuryTitle).join(', '),
            weightKg: person.weightKg,
          })
        : buildExportModel({
            program,
            profile: client.profile,
            forName: client.name,
            sessions: [],
            unit: client.profile?.unit || 'kg',
            extra: client.extra,
            injuries: client.injuries,
            coachNotes: client.notes,
            weightKg: person.weightKg,
          }),
    [own, program, profile, nickname, sessions, injuries, client, person]
  )
  const text = useMemo(() => exportText(model, prefs), [model, prefs])

  function update(patch) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveExportPrefs(next)
      return next
    })
  }
  function toggleField(key) {
    const hidden = new Set(prefs.hidden || [])
    if (hidden.has(key)) hidden.delete(key)
    else hidden.add(key)
    update({ hidden: [...hidden] })
  }

  async function handleCopy() {
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // The workbook library loads on this first tap, not with the page.
  async function handleExcel() {
    setExcel('busy')
    try {
      downloadBlob(exportFileName(model, 'xlsx', prefs), await workbookBlob(model, prefs))
      setExcel('idle')
    } catch {
      setExcel('failed')
    }
  }

  // Only the chips that would change something: no "Last weights" on a split
  // nobody has logged, no "Notes" where there are none.
  const parts = model.days.flatMap((d) => d.rows.flatMap((r) => r.parts))
  const splitChips = [
    model.forName && { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date' },
    model.programLine && { key: 'program', label: 'Split shape' },
    parts.some((p) => p.rir) && { key: 'rir', label: 'RIR' },
    parts.some((p) => p.rest) && { key: 'rest', label: 'Rest times' },
    parts.some((p) => p.note) && { key: 'notes', label: 'Exercise notes' },
    parts.some((p) => p.weight) && { key: 'weights', label: 'Last weights' },
    model.weeklySets.length > 0 && { key: 'weeklySets', label: 'Weekly sets' },
    model.coachNotes && { key: 'coachNotes', label: COACH_NOTES_HEADING },
  ].filter(Boolean)
  const hidden = new Set(prefs.hidden || [])

  const chip = (on, onClick, label) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`px-2.5 py-1.5 text-[12px] font-medium border cursor-pointer leading-tight ${
        on ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
      }`}
    >
      {label}
    </button>
  )
  const labelCls = 'text-[11px] uppercase tracking-wider text-text-light block mb-2'
  const actionCls =
    'inline-flex items-center justify-center gap-1.5 text-[13px] font-medium py-2.5 px-2 border cursor-pointer transition-colors'

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-5 sm:p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-1 pr-8">Export</h3>
        <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
          Text laid out like a note on your phone — paste it into Notes or send it in a chat — or an Excel
          file. Tap a chip to leave something out.
        </p>

        {model.about.length > 0 && (
          <div className="mb-4">
            <span className={labelCls}>About {own ? 'you' : model.forName || 'them'}</span>
            <div className="flex flex-wrap gap-1.5">
              {model.about.map((f) => chip(!hidden.has(f.key), () => toggleField(f.key), f.label))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <span className={labelCls}>The split</span>
          <div className="flex flex-wrap gap-1.5">
            {splitChips.map((c) => chip(!!prefs[c.key], () => update({ [c.key]: !prefs[c.key] }), c.label))}
          </div>
        </div>

        <div className="mb-5">
          <span className={labelCls}>Excel only</span>
          <div className="flex flex-wrap gap-1.5">
            {chip(!!prefs.logColumns, () => update({ logColumns: !prefs.logColumns }), 'Week 1–8 log columns')}
          </div>
        </div>

        <pre
          className="whitespace-pre-wrap break-words bg-cream border border-border p-3 sm:p-4 text-[12px] leading-relaxed text-text-secondary max-h-[45vh] overflow-y-auto mb-5"
          style={{ fontFamily: 'inherit' }}
          aria-label="Export preview"
        >
          {text}
        </pre>

        {/* Two to a row on a phone — three across leaves "Copied" no room at
            320px. Without a share sheet there are three, so Copy takes the
            whole first row. */}
        <div className={`grid gap-2 grid-cols-2 ${canShareText() ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <button
            onClick={handleCopy}
            className={`${actionCls} ${canShareText() ? '' : 'col-span-2 sm:col-span-1'} bg-text-primary text-cream border-text-primary hover:bg-accent-hover`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {canShareText() && (
            <button
              onClick={() => shareText({ title: model.title, text })}
              className={`${actionCls} bg-white text-text-muted border-border hover:border-border-hover hover:text-text-primary`}
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          )}
          <button
            onClick={() => downloadText(exportFileName(model, 'txt', prefs), text)}
            className={`${actionCls} bg-white text-text-muted border-border hover:border-border-hover hover:text-text-primary`}
          >
            <FileText className="w-4 h-4" /> .txt
          </button>
          <button
            onClick={handleExcel}
            disabled={excel === 'busy'}
            className={`${actionCls} bg-white text-text-muted border-border hover:border-border-hover hover:text-text-primary disabled:opacity-60 disabled:cursor-wait`}
          >
            <FileSpreadsheet className="w-4 h-4" /> {excel === 'busy' ? 'Building…' : 'Excel'}
          </button>
        </div>
        {excel === 'failed' && (
          <p className="text-[12px] text-amber-600 mt-2">The Excel file couldn&apos;t be built — check your connection and try again.</p>
        )}
      </div>
    </Modal>
  )
}

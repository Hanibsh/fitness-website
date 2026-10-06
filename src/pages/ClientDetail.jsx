import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Sparkles, FileOutput, Trash2, X, FileInput, Send, MessageCircle, ChevronRight } from 'lucide-react'
import NumberField from '../components/NumberField'
import FocusPicker from '../components/FocusPicker'
import ConfirmModal from '../components/ConfirmModal'
import ExportModal from '../components/ExportModal'
import Modal from '../components/Modal'
import ImportReview from '../components/ImportReview'
import ClientLinkCard from '../components/ClientLinkCard'
import ClientTrainingSummary from '../components/ClientTrainingSummary'
import SendProgramModal from '../components/SendProgramModal'
import ClientTargetsCard from '../components/ClientTargetsCard'
import ClientCheckinsCard from '../components/ClientCheckinsCard'
import StatusChip from '../components/StatusChip'
import { useLinkedClient } from '../lib/useClientData'
import { InjuryScope } from '../lib/useInjuries'
import { blankClientProgram, withProgram, withoutProgram, withAccountProfile, sameProfile, CLIENT_NAME_MAX, CLIENT_STATUSES, clientStatus } from '../lib/clients'
import { GOALS, EXPERIENCE_LEVELS, EQUIPMENT_PRESETS, DIETS, HEIGHT_BOUNDS, WRIST_BOUNDS, cleanFocus } from '../lib/profileFields'
import { convertMassText, convertLengthText } from '../lib/units'
import { sendMessage, DEV_COACH_ID } from '../lib/messages'
import { splitCard } from '../lib/chatCards'
import { scheduleMode } from '../lib/program'

// One client: the programs written for them, and everything about them the
// generator and the export read. Every field is optional except the name, and
// everything saves as you type — a blank field is simply left out of the
// export, never printed empty.
export default function ClientDetail() {
  const { clientId } = useParams()
  const { user, clients, updateClient, deleteClient, links, invite, unlink, sent, send, unsend, unread = {} } = useOutletContext()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(null) // { kind: 'client' } | { kind: 'program', program }
  const [exporting, setExporting] = useState(null) // program | null
  const [sending, setSending] = useState(null) // program | null
  const [importing, setImporting] = useState(false)
  const client = clients.find((c) => c.id === clientId) || null
  // Linked to their real account: their training, and their own profile
  // answers, which fill in (and lock) the matching fields here.
  const { linked, link, data: linkedData, loading: linkedLoading, injuries } = useLinkedClient(clientId)
  const account = linked ? linkedData?.profile || null : null
  const { profile: synced, fromAccount } = useMemo(() => withAccountProfile(client?.profile, account), [client?.profile, account])
  useEffect(() => {
    if (client && account && !sameProfile(client.profile, synced)) {
      updateClient(client.id, (c) => ({ ...c, profile: synced }))
    }
  }, [client, account, synced, updateClient])

  if (!client) {
    return (
      <>
        <BackLink to="/coach" label="All clients" />
        <p className="text-[13px] text-text-muted">That client couldn’t be found — they may have been deleted.</p>
      </>
    )
  }

  const edit = (mutator) => updateClient(client.id, mutator)
  // Out on their account right now: sent, to the account this card is linked to.
  const isSent = (prog) => linked && sent[prog.id]?.client_id === link.client_id
  // Deleting a program (or the whole card) takes it off their account too.
  const stopSending = (ids) => ids.filter((id) => sent[id]).forEach((id) => unsend(id).catch(() => {}))
  const setField = (key, value) => edit((c) => ({ ...c, profile: { ...c.profile, [key]: value } }))
  const p = client.profile || {}
  const unit = p.unit === 'lbs' ? 'lbs' : 'kg'

  function newBlank() {
    const program = blankClientProgram(client)
    updateClient(client.id, (c) => withProgram(c, program), { now: true })
    navigate(`/coach/${client.id}/split/${program.id}`)
  }

  // A split sent back as text (or one someone already had): its days become a
  // program here, ticked profile fields fill theirs, and their own lines,
  // injuries and notes come along unless unticked. Notes already written stay —
  // the new ones go underneath.
  function importForClient({ program, profile, extra = [], injuries = '', coachNotes = '' }) {
    updateClient(
      client.id,
      (c) => {
        const seen = new Set(c.extra.map((x) => `${x.label}|${x.value}`))
        const notes = (c.notes || '').trim()
        let next = {
          ...c,
          profile: profile ? { ...c.profile, ...profile } : c.profile,
          extra: [...c.extra, ...extra.filter((x) => !seen.has(`${x.label}|${x.value}`))],
          injuries: injuries || c.injuries,
          notes: coachNotes && notes !== coachNotes.trim() ? (notes ? `${notes}\n\n${coachNotes}` : coachNotes) : c.notes,
        }
        if (program) next = withProgram(next, program)
        return next
      },
      { now: true }
    )
    setImporting(false)
    if (program) navigate(`/coach/${client.id}/split/${program.id}`)
  }

  // Same rule as the profile page: numbers are stored in the system the unit
  // implies, so switching unit CONVERTS them rather than relabelling them.
  function switchUnit(next) {
    if (next === unit) return
    const toImperial = next === 'lbs'
    const length = (v) => convertLengthText(v, toImperial)
    edit((c) => ({
      ...c,
      profile: {
        ...c.profile,
        unit: next,
        bodyweight: convertMassText(c.profile.bodyweight, toImperial),
        height: length(c.profile.height),
        wrist: length(c.profile.wrist),
        ankle: length(c.profile.ankle),
      },
    }))
  }

  const labelCls = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const fieldCls = 'bg-cream border border-border px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'
  const inputCls = `w-full ${fieldCls}`
  const cardCls = 'bg-white border border-border p-5 sm:p-7'
  const headCls = 'font-heading text-xl font-medium text-text-primary mb-1'
  // Tap a picked option again to clear it — the same convention as the profile.
  // A field their account filled in is theirs to change, not yours.
  const locked = (key) => fromAccount.has(key)
  const choices = (key, options) => (
    // Same grids as the profile page: three across only from sm up ("Intermediate"
    // doesn't fit a third of a phone), four across for the four goals.
    <div className={`grid gap-2 ${options.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : options.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
      {options.map((o) => {
        const on = p[key] === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setField(key, on ? '' : o.value)}
            aria-pressed={on}
            disabled={locked(key)}
            className={`px-2 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors text-center leading-tight disabled:cursor-not-allowed disabled:opacity-60 ${
              on ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
  const number = (key, label, opts = {}) => (
    <div>
      <label className={labelCls} htmlFor={`client-${key}`}>{label}</label>
      <NumberField
        id={`client-${key}`}
        decimal={opts.decimal !== false}
        value={p[key] ?? ''}
        onValueChange={(v) => setField(key, v)}
        placeholder={opts.placeholder}
        disabled={locked(key)}
        className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}
      />
    </div>
  )
  const lengthUnit = HEIGHT_BOUNDS[unit].label
  const fmt = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const shapeLabel = (prog) => {
    const train = prog.days.filter((d) => d.kind !== 'rest').length
    if (!prog.days.length) return 'Empty — add days'
    const days = `${train} training day${train !== 1 ? 's' : ''}`
    return scheduleMode(prog) === 'weekly' ? `Fixed week · ${days}` : `${prog.days.length}-day rotation · ${days}`
  }

  return (
    <>
      <BackLink to="/coach" label="All clients" />

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* ---- Who ----------------------------------------------------------- */}
        <div className={cardCls}>
          <label className={labelCls} htmlFor="client-name">Client</label>
          <input
            id="client-name"
            value={client.name}
            maxLength={CLIENT_NAME_MAX}
            onChange={(e) => edit((c) => ({ ...c, name: e.target.value }))}
            placeholder="Their name"
            className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[15px] font-heading font-medium outline-none focus:border-text-primary transition-colors"
          />
          <p className="text-[11px] text-text-light mt-2">Added {fmt(client.createdAt)} · their name heads every export.</p>

          {/* Your own bookkeeping: never exported, never shown to them. */}
          <div className="mt-6">
            <span className={labelCls}>Status</span>
            <div className="grid grid-cols-3 gap-2">
              {CLIENT_STATUSES.map((st) => {
                const on = clientStatus(client) === st.id
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => edit((c) => ({ ...c, status: st.id }))}
                    aria-pressed={on}
                    className={`px-2 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors ${
                      on ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
                    }`}
                  >
                    {st.label}
                  </button>
                )
              })}
            </div>
            {/* Stacked on a phone: a date field half of 320px clips its own text. */}
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={labelCls} htmlFor="client-start">Started</label>
                <input
                  id="client-start"
                  type="date"
                  value={client.startDate || ''}
                  onChange={(e) => edit((c) => ({ ...c, startDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="client-renewal">Renews</label>
                <input
                  id="client-renewal"
                  type="date"
                  value={client.renewalDate || ''}
                  onChange={(e) => edit((c) => ({ ...c, renewalDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-[11px] text-text-light mt-2">Only you see these.</p>
          </div>
        </div>

        {/* ---- Their account ------------------------------------------------- */}
        <ClientLinkCard client={client} links={links} invite={invite} unlink={unlink} />
        {linked && <MessagesRow clientId={client.id} unread={unread[link.client_id] || 0} />}
        {linked && <ClientTrainingSummary clientId={client.id} data={linkedData} loading={linkedLoading} />}
        {linked && <ClientCheckinsCard clientName={client.name} clientUserId={link.client_id} weekly={linkedData?.weekly || []} />}
        {linked && <ClientTargetsCard clientName={client.name} clientUserId={link.client_id} unit={unit} />}

        {/* ---- Programs ------------------------------------------------------ */}
        <section className={cardCls}>
          <h2 className={headCls}>Programs</h2>
          <p className="text-[12px] text-text-light mb-4">
            Built from {client.name ? `${client.name}'s` : 'their'} profile below — never your log, injuries or notes.
          </p>
          {client.programs.length > 0 && (
            <div className="border border-border divide-y divide-border mb-4">
              {client.programs.map((prog) => (
                <div key={prog.id} className="flex items-center gap-2 px-3 py-2.5">
                  <Link to={`/coach/${client.id}/split/${prog.id}`} className="flex-1 min-w-0 no-underline group">
                    <span className="block text-[13px] font-medium text-text-primary break-words group-hover:text-accent-hover transition-colors">{prog.name}</span>
                    <span className="block text-[11px] text-text-light mt-0.5 truncate">
                      {isSent(prog) && <span className="text-green-600 font-medium">Live · </span>}
                      {shapeLabel(prog)}
                    </span>
                  </Link>
                  {linked && (
                    <button
                      onClick={() => setSending(prog)}
                      disabled={!prog.days.some((d) => d.kind !== 'rest')}
                      aria-label={isSent(prog) ? `${prog.name} is on their account` : `Send ${prog.name} to their account`}
                      title={isSent(prog) ? 'On their account' : 'Send to their account'}
                      className={`shrink-0 bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed ${isSent(prog) ? 'text-green-600' : 'text-text-light hover:text-text-primary'}`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setExporting(prog)}
                    disabled={!prog.days.some((d) => d.kind !== 'rest')}
                    aria-label={`Export ${prog.name}`}
                    title="Export as text or Excel"
                    className="shrink-0 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <FileOutput className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirm({ kind: 'program', program: prog })}
                    aria-label={`Delete ${prog.name}`}
                    title="Delete"
                    className="shrink-0 text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/coach/${client.id}/generate`}
              className="inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2.5 no-underline text-[13px] hover:bg-accent-hover transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Generate a program
            </Link>
            <button
              onClick={newBlank}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-4 py-2.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" /> Blank program
            </button>
            <button
              onClick={() => setImporting(true)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-4 py-2.5 cursor-pointer transition-colors"
            >
              <FileInput className="w-4 h-4" /> Import from text
            </button>
          </div>
        </section>

        {/* ---- Profile ------------------------------------------------------- */}
        <section className={cardCls}>
          <h2 className={headCls}>Profile</h2>
          <p className="text-[12px] text-text-light mb-6">
            {account
              ? 'Greyed-out fields come from their account. Fill in the rest.'
              : 'All optional. What’s filled in seeds the generator and heads the export; what’s blank is left out.'}
          </p>
          <div className="space-y-6">
            <div>
              <span className={labelCls}>Units</span>
              <div className="grid grid-cols-2 gap-2">
                {[{ value: 'kg', label: 'kg · cm' }, { value: 'lbs', label: 'lbs · in' }].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => switchUnit(o.value)}
                    aria-pressed={unit === o.value}
                    disabled={!!account}
                    className={`px-2 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      unit === o.value ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={labelCls}>Sex</span>
              {choices('sex', [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }])}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {number('birth_year', 'Birth year', { decimal: false, placeholder: '1998' })}
              {number('training_start_year', 'Training since', { decimal: false, placeholder: '2021' })}
              {number('height', `Height (${lengthUnit})`)}
              {number('bodyweight', `Bodyweight (${unit})`)}
              {number('body_fat', 'Body fat (%)')}
              {number('daily_steps', 'Steps a day', { decimal: false })}
              {number('wrist', `Wrist (${WRIST_BOUNDS[unit].label})`)}
              {number('ankle', `Ankle (${WRIST_BOUNDS[unit].label})`)}
            </div>
            <div>
              <span className={labelCls}>Goal</span>
              {choices('goal', GOALS)}
            </div>
            <div>
              <span className={labelCls}>Training age</span>
              {choices('experience_level', EXPERIENCE_LEVELS)}
            </div>
            <div>
              <span className={labelCls}>Equipment</span>
              {choices('equipment', EQUIPMENT_PRESETS)}
            </div>
            <div>
              <span className={labelCls}>Diet</span>
              {choices('diet', DIETS)}
            </div>
            <div>
              <span className={labelCls}>Muscles to bring up</span>
              {locked('focus_muscles') ? (
                <p className="text-[13px] text-text-secondary">{cleanFocus(p.focus_muscles).join(', ')}</p>
              ) : (
                <FocusPicker value={cleanFocus(p.focus_muscles)} onChange={(next) => setField('focus_muscles', next)} />
              )}
            </div>
          </div>
        </section>

        {/* ---- For the export --------------------------------------------- */}
        <section className={cardCls}>
          <h2 className={headCls}>In the export</h2>
          <p className="text-[12px] text-text-light mb-6">
            Said in the text and Excel files, under their profile — anything the fields above don&apos;t cover.
          </p>
          <div className="space-y-6">
            <div>
              <label className={labelCls} htmlFor="client-injuries">Injuries / limitations</label>
              <input
                id="client-injuries"
                value={client.injuries}
                onChange={(e) => edit((c) => ({ ...c, injuries: e.target.value.slice(0, 200) }))}
                placeholder="Left knee — no deep knee flexion"
                className={inputCls}
              />
            </div>
            <div>
              <span className={labelCls}>Your own lines</span>
              <div className="space-y-2">
                {client.extra.map((x, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={x.label}
                      onChange={(e) => edit((c) => ({ ...c, extra: c.extra.map((y, j) => (j === i ? { ...y, label: e.target.value.slice(0, 40) } : y)) }))}
                      placeholder="Sleep"
                      aria-label="Line label"
                      className={`${fieldCls} w-[38%] min-w-0 shrink-0`}
                    />
                    <input
                      value={x.value}
                      onChange={(e) => edit((c) => ({ ...c, extra: c.extra.map((y, j) => (j === i ? { ...y, value: e.target.value.slice(0, 200) } : y)) }))}
                      placeholder="7 hours"
                      aria-label="Line value"
                      className={`${fieldCls} flex-1 min-w-0`}
                    />
                    <button
                      onClick={() => edit((c) => ({ ...c, extra: c.extra.filter((_, j) => j !== i) }))}
                      aria-label="Remove line"
                      className="shrink-0 text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => edit((c) => ({ ...c, extra: [...c.extra, { label: '', value: '' }] }))}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 mt-3 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add a line
              </button>
            </div>
            <div>
              <label className={labelCls} htmlFor="client-notes">Notes from Leon</label>
              <textarea
                id="client-notes"
                value={client.notes}
                onChange={(e) => edit((c) => ({ ...c, notes: e.target.value.slice(0, 2000) }))}
                rows={4}
                placeholder="Anything else they should know — how to progress, when to check in…"
                className={`${inputCls} resize-y`}
              />
            </div>
          </div>
        </section>

        <button
          onClick={() => setConfirm({ kind: 'client' })}
          className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete this client
        </button>
      </motion.div>

      {exporting && <ExportModal program={exporting} client={client} onClose={() => setExporting(null)} />}

      {sending && (
        <SendProgramModal
          program={sending}
          clientName={client.name}
          isSent={isSent(sending)}
          onSend={async (makeActive) => {
            await send(link.client_id, sending, makeActive)
            // Says so in the chat too; the split itself is already theirs.
            const coachId = user?.id || DEV_COACH_ID
            sendMessage({ coachId, clientId: link.client_id, senderId: coachId, card: splitCard(sending, { sent: true }) }).catch(() => {})
          }}
          onStop={() => unsend(sending.id)}
          onClose={() => setSending(null)}
        />
      )}

      {importing && (
        <Modal onClose={() => setImporting(false)} maxWidth="max-w-2xl">
          <div className="p-5 sm:p-7">
            <h3 className="font-heading text-xl font-medium text-text-primary mb-1 pr-8">Import for {client.name || 'this client'}</h3>
            <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
              Paste an exported split. Its days become one of their programs; tick which profile details to keep.
            </p>
            {/* Their picker, not yours: no injury badges of your own. */}
            <InjuryScope.Provider value={injuries}>
              <ImportReview currentProfile={client.profile} withExtras importLabel={`Import for ${client.name || 'this client'}`} onImport={importForClient} />
            </InjuryScope.Provider>
          </div>
        </Modal>
      )}

      {confirm?.kind === 'client' && (
        <ConfirmModal
          title={`Delete ${client.name || 'this client'}?`}
          message={`This removes their profile and every program written for them${linked ? ', and unlinks their account' : ''}. This can't be undone.`}
          onConfirm={() => {
            stopSending(client.programs.map((p) => p.id))
            if (linked) unlink(link.id).catch(() => {})
            deleteClient(client.id)
            navigate('/coach')
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'program' && (
        <ConfirmModal
          title={`Delete "${confirm.program.name}"?`}
          message="This removes all its days and exercises. This can't be undone."
          onConfirm={() => {
            stopSending([confirm.program.id])
            updateClient(client.id, (c) => withoutProgram(c, confirm.program.id), { now: true })
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}

// The way into the chat with a linked client, with how many are unread.
function MessagesRow({ clientId, unread }) {
  return (
    <Link
      to={`/coach/${clientId}/messages`}
      className="flex items-center gap-3 bg-white border border-border px-5 py-4 sm:px-7 no-underline hover:border-border-hover transition-colors"
    >
      <MessageCircle className="w-4 h-4 text-text-primary shrink-0" />
      <span className="flex-1 text-[14px] font-medium text-text-primary">Messages</span>
      {unread > 0 && <StatusChip tone="dark">{unread} new</StatusChip>}
      <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
    </Link>
  )
}

function BackLink({ to, label }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> {label}
    </Link>
  )
}

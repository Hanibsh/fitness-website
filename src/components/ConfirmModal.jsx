import Modal from './Modal'
import { useModalClose } from '../lib/modalClose'

// A destructive-action confirmation naming exactly what's being removed —
// deleting a routine used to fire on a single trash-icon click with no
// confirmation at all.
export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-2">{title}</h3>
        <p className="text-[13px] text-text-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="flex-1 bg-red-600 text-white font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
          <CancelButton />
        </div>
      </div>
    </Modal>
  )
}

// Inside the modal, so it can reach the modal's own close and fade out the
// way the ✕ does, rather than vanishing.
function CancelButton() {
  const close = useModalClose()
  return (
    <button
      onClick={close}
      className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
    >
      Cancel
    </button>
  )
}

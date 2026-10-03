import Modal from './Modal'

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
          <button
            onClick={onClose}
            className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

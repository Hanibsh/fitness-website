import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function Modal({ onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`relative bg-white border border-border w-full ${maxWidth} max-h-[85vh] overflow-y-auto`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </motion.div>
    </div>
  )
}

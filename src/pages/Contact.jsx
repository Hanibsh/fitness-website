import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

// Personal email + Instagram removed for now — a work email and work Instagram
// will be added later. WhatsApp handle only.
const contacts = [
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: '@luckybull',
    href: null, // TODO: set to https://wa.me/<number> once we have the number
  },
]

export default function Contact() {
  return (
    <div className="pt-24 pb-16 px-6 min-h-screen flex items-center">
      <div className="max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-4">Contact</p>
          <h1 className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-3 tracking-tight">
            Get in touch
          </h1>
          <p className="text-text-muted text-[15px]">
            Want coaching, have a question, or just want to say what's up? Message me.
          </p>
        </motion.div>

        <div className="space-y-3">
          {contacts.map((contact, i) => {
            const inner = (
              <>
                <contact.icon className="w-5 h-5 text-text-primary" />
                <div>
                  <p className="text-[11px] uppercase tracking-[2px] text-text-light mb-0.5">
                    {contact.label}
                  </p>
                  <p className="text-[14px] text-text-primary font-medium group-hover:text-accent-hover transition-colors">
                    {contact.value}
                  </p>
                </div>
              </>
            )
            const className =
              'flex items-center gap-4 bg-white border border-border rounded-xl p-5 no-underline transition-all group'

            return contact.href ? (
              <motion.a
                key={contact.label}
                href={contact.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`${className} hover:border-border-hover`}
              >
                {inner}
              </motion.a>
            ) : (
              <motion.div
                key={contact.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={className}
              >
                {inner}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

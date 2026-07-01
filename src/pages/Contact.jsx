import { motion } from 'framer-motion'
import { Mail, Camera, MessageCircle } from 'lucide-react'

const contacts = [
  {
    icon: Mail,
    label: 'Email',
    value: 'hani.bashirinya@gmail.com',
    href: 'mailto:hani.bashirinya@gmail.com',
  },
  {
    icon: Camera,
    label: 'Instagram',
    value: '@hanibsh',
    href: 'https://instagram.com/hanibsh',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: '@hanibsh',
    href: 'https://wa.me/hanibsh',
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
            Questions, feedback, or just want to say what's up.
          </p>
        </motion.div>

        <div className="space-y-3">
          {contacts.map((contact, i) => (
            <motion.a
              key={contact.label}
              href={contact.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4 bg-white border border-border rounded-xl p-5 no-underline hover:border-border-hover transition-all group"
            >
              <contact.icon className="w-5 h-5 text-text-primary" />
              <div>
                <p className="text-[11px] uppercase tracking-[2px] text-text-light mb-0.5">
                  {contact.label}
                </p>
                <p className="text-[14px] text-text-primary font-medium group-hover:text-accent-hover transition-colors">
                  {contact.value}
                </p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </div>
  )
}

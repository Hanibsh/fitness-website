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
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-white mb-4">
            Get in <span className="text-neon">Touch</span>
          </h1>
          <p className="text-grey-400 text-lg">
            Questions, feedback, or just want to say what's up — reach out.
          </p>
        </motion.div>

        <div className="space-y-4">
          {contacts.map((contact, i) => (
            <motion.a
              key={contact.label}
              href={contact.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-5 bg-dark-800 border border-dark-500/50 rounded-2xl p-6 no-underline hover:border-neon/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-neon-glow flex items-center justify-center group-hover:bg-neon-glow-strong transition-colors">
                <contact.icon className="w-6 h-6 text-neon" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-grey-400 mb-1">
                  {contact.label}
                </p>
                <p className="text-white font-medium group-hover:text-neon transition-colors">
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

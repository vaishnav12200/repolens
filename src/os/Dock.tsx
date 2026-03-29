import { motion } from 'framer-motion'
import type { WindowApp } from './types'

type DockProps = {
  onOpen: (app: WindowApp) => void
}

const items: Array<{ app: WindowApp; label: string; icon: string }> = [
  { app: 'terminal', label: 'Terminal', icon: '>_' },
  { app: 'analyzer', label: 'Analyzer', icon: '◉' },
  { app: 'chat', label: 'Chat', icon: '✦' },
  { app: 'settings', label: 'Settings', icon: '⚙' },
]

export function Dock({ onOpen }: DockProps) {
  return (
    <div className="os-dock-wrap">
      <div className="os-dock">
        {items.map((item) => (
          <motion.button
            key={item.app}
            whileHover={{ y: -6, scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            className="dock-item"
            onClick={() => onOpen(item.app)}
            title={item.label}
          >
            <span className="dock-icon">{item.icon}</span>
            <span className="dock-label">{item.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

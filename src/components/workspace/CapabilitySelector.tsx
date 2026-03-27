import { motion } from 'framer-motion'
import { CAPABILITIES, CAPABILITY_LABELS, type Capability } from '../../types/repolens'

type Props = {
  active: Capability
  onChange: (capability: Capability) => void
}

export function CapabilitySelector({ active, onChange }: Props) {
  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 backdrop-blur">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-neon-500">Capabilities</p>
      <div className="space-y-2">
        {CAPABILITIES.map((capability) => {
          const selected = active === capability
          return (
            <motion.button
              key={capability}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(capability)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                selected
                  ? 'border-neon-500 bg-neon-600/20 text-neon-500 shadow-neon'
                  : 'border-slate-800 bg-slate-900/70 text-slate-200 hover:border-neon-700/70'
              }`}
            >
              {CAPABILITY_LABELS[capability]}
            </motion.button>
          )
        })}
      </div>
    </aside>
  )
}

'use client'

import { motion } from 'framer-motion'

const CELLS = Array.from({ length: 9 }, (_, i) => ({
  id: i,
  row: Math.floor(i / 3),
  col: i % 3,
}))

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <motion.div
        className="grid grid-cols-3 gap-[5px]"
        initial="hidden"
        animate="visible"
      >
        {CELLS.map(({ id, row, col }) => (
          <motion.div
            key={id}
            className="h-[10px] w-[10px] rounded-[2px] bg-primary"
            variants={{
              hidden: { opacity: 0, scale: 0.4 },
              visible: {
                opacity: [0.15, 1, 0.15],
                scale:   [0.75, 1, 0.75],
              },
            }}
            transition={{
              duration: 1.6,
              repeat:   Infinity,
              delay:    (row + col) * 0.14,
              ease:     'easeInOut',
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

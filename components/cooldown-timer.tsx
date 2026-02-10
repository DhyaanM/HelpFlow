"use client"

import { motion } from "framer-motion"

interface CooldownTimerProps {
  remaining: number
  total: number
}

export function CooldownTimer({ remaining, total }: CooldownTimerProps) {
  const progress = remaining / total
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg
        className="w-28 h-28 -rotate-90"
        viewBox="0 0 120 120"
        aria-label={`Cooldown: ${remaining} seconds remaining`}
      >
        {/* Background ring */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="8"
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient
            id="cooldown-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#AD4225" />
            <stop offset="100%" stopColor="#F9B940" />
          </linearGradient>
        </defs>
        {/* Progress ring */}
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#cooldown-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={remaining}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-bold text-[#AD4225]"
        >
          {remaining}s
        </motion.span>
      </div>
    </div>
  )
}

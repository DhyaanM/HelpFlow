"use client"

import { motion } from "framer-motion"

export function AnimatedFooter() {
    return (
        <footer className="py-2 text-center text-[10px] sm:text-xs font-medium tracking-widest overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
            <motion.div
                className="inline-block relative"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <span className="bg-gradient-to-r from-muted-foreground/40 via-muted-foreground/80 to-muted-foreground/40 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shine_4s_linear_infinite]">
                    MADE BY DHYAAN MANGANAHALLI
                </span>
            </motion.div>
        </footer>
    )
}

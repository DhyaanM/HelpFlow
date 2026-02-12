"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useHelpFlow } from "@/lib/helpflow-context"
import {
  Hand,
  Clock,
  LogOut,
  Users,
  MessageCircle,
  CheckCircle2,
  BookOpen,
} from "lucide-react"
import { CooldownTimer } from "./cooldown-timer"

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

export function StudentDashboard() {
  const {
    currentUser,
    setCurrentUser,
    setScreen,
    lesson,
    joinLesson,
    requestHelp,
    getQueuePosition,
    getStudentRequestCount,
    cooldownRemaining,
    activeQueue,
    cancelRequest,
  } = useHelpFlow()

  const [joinCode, setJoinCode] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const position = getQueuePosition()
  const requestCount = getStudentRequestCount()
  const isInQueue = position > 0
  const isOnCooldown = cooldownRemaining > 0
  const canRequest = lesson?.active && !isInQueue && !isOnCooldown

  const estimatedWait = isInQueue ? position * 3 : 0

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode) return
    setIsJoining(true)
    setJoinError(null)
    const result = await joinLesson(joinCode)
    if (!result.success) {
      setJoinError(result.error || "Failed to join")
    }
    setIsJoining(false)
  }

  function handleLogout() {
    setCurrentUser(null)
    setScreen("login")
  }

  return (
    <div className="bg-gradient-to-b from-background via-background to-[#2D9389]/5">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border"
      >
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Brand (Left) */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D9389] to-[#115D7F] flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground tracking-tight">HelpFlow</span>
              </div>
            </div>
          </div>

          {/* Controls & Profile (Right) */}
          <div className="flex items-center gap-4">
            {/* Profile Pill */}
            <div className="flex items-center gap-3 pl-4 border-l border-border/50">
              <div className="text-right hidden sm:block">
                <p className="font-medium text-sm text-foreground">
                  {currentUser?.name}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Student</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2D9389] to-[#115D7F] flex items-center justify-center shadow-sm text-white text-sm font-bold">
                {currentUser?.name?.charAt(0) || "S"}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              aria-label="Log out"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Lesson status */}
        <AnimatePresence mode="wait">
          {!lesson?.active ? (
            <motion.div
              key="join-lesson"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={spring}
              className="max-w-sm mx-auto pt-12 text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2D9389]/10 to-[#115D7F]/10 mx-auto mb-6 flex items-center justify-center">
                <Users className="w-10 h-10 text-[#2D9389]" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Join a Lesson
              </h2>
              <p className="text-muted-foreground mb-8 text-sm">
                Enter the 6-character code from your teacher to join the help queue.
              </p>

              <form onSubmit={handleJoin} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE (e.g. B4X7K2)"
                    maxLength={10}
                    className="w-full px-4 py-4 rounded-xl bg-card border border-border text-center text-xl font-black font-mono tracking-widest focus:ring-2 focus:ring-[#2D9389] focus:outline-none transition-all"
                  />
                  {joinError && (
                    <p className="text-destructive text-xs mt-2 font-medium">{joinError}</p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={joinCode.length < 4 || isJoining}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#2D9389] to-[#115D7F] text-white font-bold shadow-lg shadow-[#2D9389]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isJoining ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Join Classroom"
                  )}
                </motion.button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="active-lesson"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6"
            >
              {/* Queue status badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.05 }}
                className="flex items-center justify-center"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2D9389]/10 border border-[#2D9389]/20">
                  <span className="w-2 h-2 rounded-full bg-[#2D9389] animate-pulse" />
                  <span className="text-sm font-medium text-[#2D9389]">
                    Lesson in progress
                  </span>
                </div>
              </motion.div>

              {/* Main help button area */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.1 }}
                className="bg-card rounded-2xl border border-border p-8 text-center shadow-lg shadow-foreground/[0.03]"
              >
                <AnimatePresence mode="wait">
                  {isInQueue ? (
                    <motion.div
                      key="in-queue"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={spring}
                    >
                      <motion.div
                        className="w-28 h-28 rounded-full bg-gradient-to-br from-[#2D9389]/10 to-[#115D7F]/10 mx-auto mb-6 flex items-center justify-center border-4 border-[#2D9389]/20"
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <span className="text-4xl font-bold bg-gradient-to-br from-[#2D9389] to-[#115D7F] bg-clip-text text-transparent">
                          #{position}
                        </span>
                      </motion.div>
                      <h2 className="text-2xl font-bold text-card-foreground mb-1">
                        {"You're in the queue"}
                      </h2>
                      <p className="text-muted-foreground mb-4 leading-relaxed">
                        Estimated wait: ~{estimatedWait} min
                      </p>
                      <div className="flex flex-col gap-3">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F9B940]/10 border border-[#F9B940]/20 mx-auto">
                          <Users className="w-4 h-4 text-[#F9B940]" />
                          <span className="text-sm font-medium text-[#F9B940]">
                            {activeQueue.length} student
                            {activeQueue.length !== 1 ? "s" : ""} waiting
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            const myReq = activeQueue.find(r => r.studentId === currentUser?.id)
                            if (myReq) cancelRequest(myReq.id)
                          }}
                          className="w-full py-3 rounded-xl border border-dashed border-muted-foreground/40 bg-card text-muted-foreground hover:text-red-500 hover:border-red-500/50 hover:bg-red-500/5 transition-all text-sm font-medium flex items-center justify-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                          Cancel Request
                        </button>
                      </div>
                    </motion.div>
                  ) : isOnCooldown ? (
                    <motion.div
                      key="cooldown"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={spring}
                    >
                      <CooldownTimer
                        remaining={cooldownRemaining}
                        total={60}
                      />
                      <h2 className="text-2xl font-bold text-card-foreground mb-1 mt-6">
                        Cooldown Active
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        You can request help again in {cooldownRemaining}s
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={spring}
                    >
                      <p className="text-muted-foreground mb-6 leading-relaxed">
                        Need help? Click the button below to join the queue.
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={requestHelp}
                        disabled={!canRequest}
                        className="w-40 h-40 rounded-full bg-gradient-to-br from-[#2D9389] to-[#115D7F] text-white shadow-2xl shadow-[#2D9389]/30 mx-auto flex flex-col items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        aria-label="Request help"
                      >
                        <Hand className="w-10 h-10" />
                        <span className="text-base font-semibold">
                          Request Help
                        </span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.2 }}
                className="grid grid-cols-3 gap-3"
              >
                <div className="bg-card rounded-2xl border border-border p-4 text-center">
                  <MessageCircle className="w-5 h-5 text-[#2D9389] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-card-foreground">
                    {requestCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requests Made
                  </p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 text-center">
                  <Users className="w-5 h-5 text-[#115D7F] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-card-foreground">
                    {activeQueue.length}
                  </p>
                  <p className="text-xs text-muted-foreground">In Queue</p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 text-center">
                  <CheckCircle2 className="w-5 h-5 text-[#F9B940] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-card-foreground">
                    {position > 0 ? `#${position}` : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your Position
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

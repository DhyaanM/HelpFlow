"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useHelpFlow } from "@/lib/helpflow-context"
import {
  Play,
  Square,
  CheckCircle2,
  Clock,
  Users,
  LogOut,
  BarChart3,
  Hand,
  Zap,
  BookOpen,
} from "lucide-react"

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

function formatWaitTime(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

function QueueCard({
  request,
  index,
  onComplete,
  requestCount,
}: {
  request: { id: string; studentName: string; timestamp: number; studentId: string }
  index: number
  onComplete: (id: string) => void
  requestCount: number
}) {
  const [waitTime, setWaitTime] = useState(formatWaitTime(request.timestamp))

  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime(formatWaitTime(request.timestamp))
    }, 1000)
    return () => clearInterval(interval)
  }, [request.timestamp])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ ...spring, delay: index * 0.05 }}
      className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center gap-4">
        {/* Position badge */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D9389] to-[#115D7F] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">#{index + 1}</span>
        </div>

        {/* Student info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-card-foreground truncate">
            {request.studentName}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {waitTime}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hand className="w-3 h-3" />
              {requestCount} request{requestCount !== 1 ? "s" : ""} today
            </span>
          </div>
        </div>

        {/* Complete button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => onComplete(request.id)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2D9389] to-[#115D7F] text-white text-sm font-medium shadow-md shadow-[#2D9389]/15 opacity-80 group-hover:opacity-100 transition-opacity"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Done
          </span>
        </motion.button>
      </div>
    </motion.div>
  )
}

export function TeacherDashboard() {
  const {
    currentUser,
    setCurrentUser,
    setScreen,
    lesson,
    startLesson,
    endLesson,
    completeRequest,
    activeQueue,
    completedRequests,
    getStudentRequestCount,
    studentRoster,
    everConnectedIds,
  } = useHelpFlow()

  const studentsEngaged = new Set(
    [...activeQueue, ...completedRequests].map((r) => r.studentId)
  ).size

  // Use connected students (or at least 1 if testing alone)
  const connectedCount = everConnectedIds.size > 0 ? everConnectedIds.size : studentRoster.length
  // Better: intersection
  const connectedRoster = studentRoster.filter(s => everConnectedIds.has(s.id))
  // If everConnectedIds is populated, use it. Else fallback (though everConnectedIds updates on sync)
  const totalStudents = connectedRoster.length > 0 ? connectedRoster.length : (everConnectedIds.size > 0 ? everConnectedIds.size : 0)

  // "Not Engaged" = Total Connected - Engaged
  // (Assuming all engaged are connected. If they left, they shouldn't count as "Not Engaged", but "Engaged" count stays.
  // We want "Connected students who have NOT requested help").
  const activeStudentIds = new Set(connectedRoster.map(s => s.id))
  // Engaged IDs (who asked)
  const engagedIds = new Set([...activeQueue, ...completedRequests].map(r => r.studentId))

  // Connected Students who are NOT in Engaged IDs
  const notEngagedCount = connectedRoster.filter(s => !engagedIds.has(s.id)).length

  // Fallback for display if roster empty
  const studentsNotEngaged = totalStudents > 0 ? notEngagedCount : 0

  function handleLogout() {
    setCurrentUser(null)
    setScreen("login")
  }

  async function handleEndLesson() {
    await endLesson()
    setScreen("report")
  }

  return (
    <div className="bg-gradient-to-b from-background via-background to-[#115D7F]/5">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border"
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Brand (Left) */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D9389] to-[#115D7F] flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground tracking-tight">HelpFlow</span>
                <span className="bg-amber-500/15 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/20">
                  Beta
                </span>
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Teacher</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F9B940] to-[#AD4225] flex items-center justify-center shadow-sm text-white text-sm font-bold">
                {currentUser?.name?.charAt(0) || "T"}
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Lesson controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="mb-8"
        >
          <AnimatePresence mode="wait">
            {!lesson?.active ? (
              <motion.div
                key="start-lesson"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={spring}
                className="bg-card rounded-2xl border border-border p-8 text-center shadow-lg shadow-foreground/[0.03]"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2D9389]/10 to-[#115D7F]/10 mx-auto mb-4 flex items-center justify-center">
                  <Play className="w-8 h-8 text-[#2D9389] ml-0.5" />
                </div>
                <h2 className="text-2xl font-bold text-card-foreground mb-2">
                  Start a Lesson
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
                  Begin a new lesson to open the help queue for your students.
                </p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startLesson}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#2D9389] to-[#115D7F] text-white font-semibold shadow-lg shadow-[#2D9389]/20 text-base"
                >
                  Start Lesson
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="active-lesson"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={spring}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-[#2D9389] animate-pulse" />
                    <h2 className="text-xl font-bold text-foreground">
                      Live Queue
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      ({activeQueue.length} waiting)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-2 py-1 rounded-lg bg-[#2D9389]/10 border border-[#2D9389]/20 w-fit">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#2D9389]/70">Code:</span>
                    <span className="text-xl font-black font-mono text-[#2D9389] tracking-[0.2em]">{lesson?.code}</span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleEndLesson}
                  className="px-5 py-2.5 rounded-xl bg-[#AD4225]/10 text-[#AD4225] font-medium text-sm border border-[#AD4225]/20 hover:bg-[#AD4225]/15 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Square className="w-4 h-4" />
                    End Lesson
                  </span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Stats */}
        {lesson?.active && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="grid grid-cols-4 gap-3 mb-8"
          >
            {[
              {
                label: "Total Requests",
                value: (activeQueue.length + completedRequests.length).toString(),
                icon: Hand,
                color: "#2D9389",
              },
              {
                label: "Helped",
                value: completedRequests.length.toString(),
                icon: CheckCircle2,
                color: "#F9B940",
              },
              {
                label: "Engaged",
                value: studentsEngaged.toString(),
                icon: Users,
                color: "#115D7F",
              },
              {
                label: "Not Engaged",
                value: studentsNotEngaged.toString(),
                icon: Users,
                color: "#AD4225",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.1 + i * 0.05 }}
                className="bg-card rounded-2xl border border-border p-4 text-center"
              >
                <stat.icon
                  className="w-5 h-5 mx-auto mb-2"
                  style={{ color: stat.color }}
                />
                <p className="text-2xl font-bold text-card-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Queue list */}
        {lesson?.active && (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {activeQueue.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card rounded-2xl border border-border p-12 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-[#2D9389]" />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-1">
                    Queue is empty
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    No students are waiting for help right now.
                  </p>
                </motion.div>
              ) : (
                activeQueue.map((request, index) => (
                  <QueueCard
                    key={request.id}
                    request={request}
                    index={index}
                    onComplete={completeRequest}
                    requestCount={getStudentRequestCount(request.studentId)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Report FAB */}
        {lesson?.active && (activeQueue.length > 0 || completedRequests.length > 0) && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleEndLesson}
            className="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F9B940] to-[#AD4225] text-white shadow-xl shadow-[#F9B940]/25 flex items-center justify-center"
            aria-label="End lesson and view report"
          >
            <BarChart3 className="w-6 h-6" />
          </motion.button>
        )}
      </main>
    </div>
  )
}

"use client"

import { HelpFlowProvider, useHelpFlow } from "@/lib/helpflow-context"
import { LoginScreen } from "@/components/login-screen"
import { StudentDashboard } from "@/components/student-dashboard"
import { TeacherDashboard } from "@/components/teacher-dashboard"
import { LessonReport } from "@/components/lesson-report"
import { AnimatePresence, motion } from "framer-motion"

const spring = { type: "spring", stiffness: 200, damping: 22 } as const

function AppRouter() {
  const { screen } = useHelpFlow()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={spring}
      >
        {screen === "login" && <LoginScreen />}
        {screen === "student" && <StudentDashboard />}
        {screen === "teacher" && <TeacherDashboard />}
        {screen === "report" && <LessonReport />}
      </motion.div>
    </AnimatePresence>
  )
}

export default function Page() {
  return (
    <HelpFlowProvider>
      <AppRouter />
    </HelpFlowProvider>
  )
}

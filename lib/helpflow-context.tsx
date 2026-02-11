"use client"

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Subscription } from "@supabase/supabase-js"

// --- Types ---
export type Role = "teacher" | "student"

export interface User {
  id: string
  name: string
  role: Role
  avatar?: string
  email?: string
}

export interface HelpRequest {
  id: string
  studentId: string
  studentName: string // In a real app, this might be joined, but we'll store it for simplicity or fetch it
  timestamp: number
  status: "waiting" | "completed"
  completedAt?: number
}

// Map DB 'created_at' to 'timestamp' for the frontend
interface DBHelpRequest {
  id: string
  lesson_id: string
  student_id: string
  status: string
  created_at: string
  completed_at?: string
  profiles?: {
    full_name: string
  }
}

export interface Lesson {
  id: string
  active: boolean
  startedAt: number
  endedAt?: number
  requests: HelpRequest[]
}

export interface LessonReport {
  lessonId: string
  startedAt: number
  endedAt: number
  totalRequests: number
  studentsHelped: string[]
  studentsNotEngaged: string[]
  averageWaitTime: number
  requestsByStudent: Record<string, number>
}

// --- Context ---
interface HelpFlowContextType {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void // Kept for optimistic updates or manual overrides if needed
  screen: "login" | "student" | "teacher" | "report"
  setScreen: (screen: "login" | "student" | "teacher" | "report") => void
  lesson: Lesson | null
  startLesson: () => Promise<void>
  endLesson: () => Promise<void>
  requestHelp: () => Promise<void>
  completeRequest: (requestId: string) => Promise<void>
  getQueuePosition: () => number
  getStudentRequestCount: (studentId?: string) => number
  cooldownRemaining: number
  activeQueue: HelpRequest[]
  completedRequests: HelpRequest[]
  lessonReport: LessonReport | null
  generateReport: () => LessonReport | null
  studentRoster: User[] // Kept for compatibility, though less relevant with real auth
  pastReports: LessonReport[]
  simulateStudentRequests: () => void // Kept for demo mode
  isLoading: boolean
}

const HelpFlowContext = createContext<HelpFlowContextType | null>(null)

export function useHelpFlow() {
  const ctx = useContext(HelpFlowContext)
  if (!ctx) throw new Error("useHelpFlow must be used within HelpFlowProvider")
  return ctx
}

export function HelpFlowProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [screen, setScreen] = useState<"login" | "student" | "teacher" | "report">("login")
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [pastReports, setPastReports] = useState<LessonReport[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Derived state
  const activeQueue = lesson?.requests.filter((r) => r.status === "waiting") ?? []
  const completedRequests = lesson?.requests.filter((r) => r.status === "completed") ?? []

  // --- Auth & Initial Data Fetching ---
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Fetch profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single()

          if (profile) {
            setCurrentUser({
              id: user.id,
              name: profile.full_name || user.email?.split("@")[0] || "User",
              role: profile.role as Role,
              email: user.email,
              avatar: profile.avatar_url,
            })
            setScreen(profile.role === "teacher" ? "teacher" : "student")
          } else {
            // No profile found, let's create a default one to unblock the user
            console.log("No profile found for logged-in user, creating default...")
            const defaultName = user.email?.split("@")[0] || "User"
            const { data: newProfile, error: insertError } = await supabase
              .from("profiles")
              .insert({
                id: user.id,
                full_name: defaultName,
                role: "student",
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${defaultName}`
              })
              .select()
              .single()

            if (!insertError && newProfile) {
              setCurrentUser({
                id: user.id,
                name: newProfile.full_name,
                role: newProfile.role as Role,
                email: user.email,
                avatar: newProfile.avatar_url,
              })
              setScreen("student")
            } else {
              console.error("Failed to create default profile:", insertError)
            }
          }
        }
      } catch (error) {
        console.error("Error checking user:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Re-fetch profile on sign-in
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (profile) {
          setCurrentUser({
            id: session.user.id,
            name: profile.full_name || session.user.email?.split("@")[0] || "User",
            role: profile.role as Role,
            email: session.user.email,
            avatar: profile.avatar_url,
          })
          setScreen(profile.role === "teacher" ? "teacher" : "student")
        } else {
          // Sign in event but no profile - create one
          const defaultName = session.user.email?.split("@")[0] || "User"
          const { data: newProfile } = await supabase
            .from("profiles")
            .insert({
              id: session.user.id,
              full_name: defaultName,
              role: "student",
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${defaultName}`
            })
            .select()
            .single()

          if (newProfile) {
            setCurrentUser({
              id: session.user.id,
              name: newProfile.full_name,
              role: newProfile.role as Role,
              email: session.user.email,
              avatar: newProfile.avatar_url,
            })
            setScreen("student")
          }
        }
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null)
        setScreen("login")
        setLesson(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [supabase])

  // --- Real-time Subscriptions (Active Lesson) ---
  useEffect(() => {
    if (!supabase) return

    // Fetch active lesson
    const fetchActiveLesson = async () => {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("*")
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)

      if (lessons && lessons.length > 0) {
        const activeLesson = lessons[0]
        // Fetch requests for this lesson
        const { data: requests } = await supabase
          .from("help_requests")
          .select("*, profiles(full_name)")
          .eq("lesson_id", activeLesson.id)
          .order("created_at", { ascending: true })

        const formattedRequests: HelpRequest[] = (requests || []).map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          studentName: r.profiles?.full_name || "Unknown",
          timestamp: new Date(r.created_at).getTime(),
          status: r.status,
          completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined
        }))

        setLesson({
          id: activeLesson.id,
          active: true,
          startedAt: new Date(activeLesson.started_at).getTime(),
          requests: formattedRequests
        })
      }
    }

    fetchActiveLesson()

    // Subscribe to lessons
    const lessonSub = supabase
      .channel("public:lessons")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lessons" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new.status === "active") {
            setLesson({
              id: payload.new.id,
              active: true,
              startedAt: new Date(payload.new.started_at).getTime(),
              requests: []
            })
            // Reset screen if needed?
          } else if (payload.eventType === "UPDATE" && payload.new.status === "completed") {
            setLesson(prev => prev && prev.id === payload.new.id ? { ...prev, active: false, endedAt: new Date().getTime() } : prev)
          }
        }
      )
      .subscribe()

    // Subscribe to requests
    const requestSub = supabase
      .channel("public:help_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // Need to fetch profile name
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", payload.new.student_id).single()

            setLesson((prev) => {
              if (!prev || prev.id !== payload.new.lesson_id) return prev
              const newReq: HelpRequest = {
                id: payload.new.id,
                studentId: payload.new.student_id,
                studentName: profile?.full_name || "Unknown",
                timestamp: new Date(payload.new.created_at).getTime(),
                status: payload.new.status as "waiting" | "completed",
                completedAt: payload.new.completed_at ? new Date(payload.new.completed_at).getTime() : undefined
              }
              // Avoid duplicates
              if (prev.requests.some(r => r.id === newReq.id)) return prev
              return { ...prev, requests: [...prev.requests, newReq] }
            })
          } else if (payload.eventType === "UPDATE") {
            setLesson((prev) => {
              if (!prev || prev.id !== payload.new.lesson_id) return prev
              return {
                ...prev,
                requests: prev.requests.map(r => r.id === payload.new.id ? {
                  ...r,
                  status: payload.new.status as "waiting" | "completed",
                  completedAt: payload.new.completed_at ? new Date(payload.new.completed_at).getTime() : undefined
                } : r)
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(lessonSub)
      supabase.removeChannel(requestSub)
    }

  }, [supabase])


  // --- Actions ---

  const startLesson = useCallback(async () => {
    if (!supabase) {
      // Fallback for demo
      setLesson({
        id: `lesson-${Date.now()}`,
        active: true,
        startedAt: Date.now(),
        requests: [],
      })
      return
    }

    if (!currentUser) return

    try {
      await supabase.from("lessons").insert({
        teacher_id: currentUser.id,
        status: "active",
        started_at: new Date().toISOString()
      })
    } catch (e) {
      console.error("Error starting lesson:", e)
    }
  }, [supabase, currentUser])

  const endLesson = useCallback(async () => {
    if (!supabase) {
      // Fallback
      setLesson((prev) => {
        if (!prev) return null
        return { ...prev, active: false, endedAt: Date.now() }
      })
      return
    }

    if (!lesson) return

    try {
      await supabase.from("lessons").update({
        status: "completed",
        ended_at: new Date().toISOString()
      }).eq("id", lesson.id)

      // Generate report locally for now immediately, though strictly we could wait for state update
      // But the useEffect watching 'lesson' state change will ideally trigger it.
    } catch (e) {
      console.error("Error ending lesson:", e)
    }
  }, [supabase, lesson])

  const requestHelp = useCallback(async () => {
    if (!currentUser || !lesson?.active || cooldownRemaining > 0) return

    if (!supabase) {
      // Fallback
      const existingWaiting = lesson.requests.find(
        (r) => r.studentId === currentUser.id && r.status === "waiting"
      )
      if (existingWaiting) return
      const newRequest: HelpRequest = {
        id: `req-${Date.now()}`,
        studentId: currentUser.id,
        studentName: currentUser.name,
        timestamp: Date.now(),
        status: "waiting",
      }
      setLesson((prev) => {
        if (!prev) return null
        return { ...prev, requests: [...prev.requests, newRequest] }
      })
      setCooldownRemaining(60) // COOLDOWN_SECONDS hardcoded for now
      return
    }

    // Check existing
    const existingWaiting = lesson.requests.find(
      (r) => r.studentId === currentUser.id && r.status === "waiting"
    )
    if (existingWaiting) return

    try {
      await supabase.from("help_requests").insert({
        lesson_id: lesson.id,
        student_id: currentUser.id,
        status: "waiting"
      })
      setCooldownRemaining(60)
    } catch (e) {
      console.error("Error requesting help:", e)
    }
  }, [supabase, currentUser, lesson, cooldownRemaining])

  const completeRequest = useCallback(async (requestId: string) => {
    if (!supabase) {
      // Fallback
      setLesson((prev) => {
        if (!prev) return null
        return {
          ...prev,
          requests: prev.requests.map((r) =>
            r.id === requestId ? { ...r, status: "completed" as const, completedAt: Date.now() } : r
          ),
        }
      })
      return
    }

    try {
      await supabase.from("help_requests").update({
        status: "completed",
        completed_at: new Date().toISOString()
      }).eq("id", requestId)
    } catch (e) {
      console.error("Error completing request:", e)
    }
  }, [supabase])

  const getQueuePosition = useCallback(() => {
    if (!currentUser || !lesson) return -1
    const waiting = lesson.requests.filter((r) => r.status === "waiting")
    const idx = waiting.findIndex((r) => r.studentId === currentUser.id)
    return idx === -1 ? -1 : idx + 1
  }, [currentUser, lesson])

  const getStudentRequestCount = useCallback(
    (studentId?: string) => {
      const id = studentId || currentUser?.id
      if (!id || !lesson) return 0
      return lesson.requests.filter((r) => r.studentId === id).length
    },
    [currentUser, lesson]
  )

  const generateReport = useCallback((): LessonReport | null => {
    if (!lesson) return null
    const endedAt = lesson.endedAt || Date.now()

    // Simplification: We don't have a full roster from DB easily available in this context without fetching all profiles.
    // For now, "studentsNotEngaged" might be empty or we only count active participants.
    const studentsWhoAsked = new Set(lesson.requests.map((r) => r.studentId))
    const studentsNotEngaged: string[] = [] // TODO: Fetch class roster to calc this real
    const studentsHelped = [...studentsWhoAsked].map(
      (id) => lesson.requests.find(r => r.studentId === id)?.studentName || "Unknown"
    )

    const requestsByStudent: Record<string, number> = {}
    for (const r of lesson.requests) {
      requestsByStudent[r.studentName] = (requestsByStudent[r.studentName] || 0) + 1
    }

    const completedReqs = lesson.requests.filter((r) => r.status === "completed" && r.completedAt)
    const avgWait =
      completedReqs.length > 0
        ? completedReqs.reduce((sum, r) => sum + ((r.completedAt || 0) - r.timestamp), 0) /
        completedReqs.length
        : 0

    const report: LessonReport = {
      lessonId: lesson.id,
      startedAt: lesson.startedAt,
      endedAt,
      totalRequests: lesson.requests.length,
      studentsHelped,
      studentsNotEngaged,
      averageWaitTime: avgWait,
      requestsByStudent,
    }

    setPastReports((prev) => {
      if (prev.some((r) => r.lessonId === report.lessonId)) return prev
      return [...prev, report]
    })

    return report
  }, [lesson])

  const [lessonReport, setLessonReport] = useState<LessonReport | null>(null)

  // Auto-generate report when lesson ends
  useEffect(() => {
    if (lesson && !lesson.active) {
      const report = generateReport()
      setLessonReport(report)
    } else {
      setLessonReport(null)
    }
  }, [lesson, generateReport])

  // Cooldown timer (same as before)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (cooldownRemaining > 0) {
      cooldownTimer.current = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            if (cooldownTimer.current) clearInterval(cooldownTimer.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    }
  }, [cooldownRemaining])


  return (
    <HelpFlowContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        screen,
        setScreen,
        lesson,
        startLesson,
        endLesson,
        requestHelp,
        completeRequest,
        getQueuePosition,
        getStudentRequestCount,
        cooldownRemaining,
        activeQueue,
        completedRequests,
        lessonReport,
        generateReport,
        studentRoster: [], // Deprecated in favor of DB
        pastReports,
        simulateStudentRequests: () => { }, // Deprecated
        isLoading
      }}
    >
      {children}
    </HelpFlowContext.Provider>
  )
}


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
  code: string
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
  joinLesson: (code: string) => Promise<{ success: boolean; error?: string }>
  requestHelp: () => Promise<void>
  completeRequest: (requestId: string) => Promise<void>
  cancelRequest: (requestId: string) => Promise<void>
  getQueuePosition: () => number
  getStudentRequestCount: (studentId?: string) => number
  cooldownRemaining: number
  activeQueue: HelpRequest[]
  completedRequests: HelpRequest[]
  lessonReport: LessonReport | null
  generateReport: () => LessonReport | null
  studentRoster: User[] // Kept for compatibility, though less relevant with real auth
  pastReports: LessonReport[]
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
  const [studentRoster, setStudentRoster] = useState<User[]>([])
  const [everConnectedIds, setEverConnectedIds] = useState<Set<string>>(new Set())

  // Fix stale closure in polling
  const lessonRef = useRef(lesson)
  useEffect(() => {
    lessonRef.current = lesson
  }, [lesson])

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
            if (profile.role === 'teacher') fetchRoster()
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

    // Fetch class roster if teacher
    const fetchRoster = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("role", "student")
      if (data) {
        setStudentRoster(data.map(p => ({
          id: p.id,
          name: p.full_name,
          role: "student",
          email: p.email,
          avatar: p.avatar_url
        })))
      }
    }


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
          if (profile.role === 'teacher') fetchRoster()
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
    const fetchActiveLesson = async (lessonCode?: string) => {
      if (!supabase) return

      // If we are a teacher, we care about OUR active lesson
      // If we are a student, we care about the lesson with the CODE we joined

      let query = supabase
        .from("lessons")
        .select(`
          *,
          help_requests (*)
        `)
        .eq("status", "active")

      if (currentUser?.role === "teacher") {
        query = query.eq("teacher_id", currentUser.id)
      } else if (lessonCode) {
        query = query.eq("code", lessonCode.toUpperCase())
      } else {
        // Student hasn't joined a lesson yet
        setLesson(null)
        setIsLoading(false)
        return

      }

      const { data: lessonData, error } = await query.maybeSingle()

      if (error) {
        console.error("Error fetching active lesson:", error)
        return
      }

      if (lessonData) {
        // Fetch student names for requests
        const studentIds = (lessonData.help_requests || []).map((r: any) => r.student_id)
        const studentNamesQuery = await supabase.from("profiles").select("id, full_name").in("id", studentIds)
        const profileMap = Object.fromEntries((studentNamesQuery.data || []).map(p => [p.id, p.full_name]))

        const formattedRequests: HelpRequest[] = (lessonData.help_requests || []).map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          studentName: profileMap[r.student_id] || "Unknown",
          timestamp: new Date(r.created_at).getTime(),
          status: r.status,
          completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined
        }))

        setLesson({
          id: lessonData.id,
          active: true,
          code: lessonData.code,
          startedAt: new Date(lessonData.started_at).getTime(),
          requests: formattedRequests
        })
      } else {
        // If we have ANY lesson in state (active or not), and query returns nothing, 
        // it applies it ended or was deleted.
        const currentRef = lessonRef.current
        if (currentRef) {
          if (!supabase) return

          const { data: specificLesson } = await supabase
            .from("lessons")
            .select("status, ended_at")
            .eq("id", currentRef.id)
            .maybeSingle()

          if (specificLesson && specificLesson.status === "completed") {
            const endedAt = specificLesson.ended_at
            // Only update if it was mistakenly considered active or if we just want to ensure it's marked inactive
            if (currentRef.active) {
              setLesson(prev => prev ? { ...prev, active: false, endedAt: new Date(endedAt).getTime() } : null)
            }
            // Keep the lesson in state (inactive)
          } else {
            setLesson(null)
          }
        } else {
          setLesson(null)
        }
      }
    }

    // Try to restore joined lesson from localStorage if student
    const savedCode = typeof window !== 'undefined' ? localStorage.getItem('joinedLessonCode') : null
    fetchActiveLesson(savedCode || undefined)

    // Subscribe to lessons
    const lessonSub = supabase
      .channel("public:lessons")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lessons" },
        (payload) => {
          console.log("Lesson change received:", payload)
          if (payload.eventType === "INSERT" && payload.new.status === "active") {
            // Only care if it matches OUR joined code (for student) or OUR ID (for teacher)
            const isOurLesson = currentUser?.role === "teacher"
              ? payload.new.teacher_id === currentUser.id
              : payload.new.code === (typeof window !== 'undefined' ? localStorage.getItem('joinedLessonCode') : null)

            if (isOurLesson) {
              setLesson({
                id: payload.new.id,
                active: true,
                code: payload.new.code,
                startedAt: new Date(payload.new.started_at).getTime(),
                requests: []
              })
            }
          } else if (payload.eventType === "UPDATE" && payload.new.status === "completed") {
            setLesson(prev => prev && prev.id === payload.new.id ? { ...prev, active: false, endedAt: new Date().getTime() } : prev)
          }
        }
      )
      .on(
        "presence",
        { event: "sync" },
        () => {
          const state = lessonSub.presenceState()
          const presentIds = new Set<string>()

          Object.values(state).forEach((presences: any) => {
            presences.forEach((p: any) => {
              if (p.user_id) presentIds.add(p.user_id)
            })
          })

          setEverConnectedIds(prev => {
            const next = new Set(prev)
            let changed = false
            presentIds.forEach(id => {
              if (!next.has(id)) {
                next.add(id)
                changed = true
              }
            })
            return changed ? next : prev
          })
        }
      )
      .subscribe(async (status) => {
        console.log("Lesson subscription status:", status)
        if (status === "SUBSCRIBED" && currentUser) {
          await lessonSub.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString()
          })
        }
      })

    // Subscribe to requests
    const requestSub = supabase
      .channel("public:help_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests" },
        async (payload) => {
          console.log("Request change received:", payload)
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

              // If status changed to completed, we should check if we need to set cooldown locally?
              // The completeRequest function handles it for the initiator, but what if another teacher completed it? 
              // Or if we are the student?
              // Logic for cooldown is: "When my request is completed"
              if (payload.new.status === "completed" && payload.new.student_id === currentUser?.id) {
                // We could set cooldown here, but let's rely on the explicit flow or polling to keep it simple,
                // or just set it:
                setCooldownRemaining(prev => prev > 0 ? prev : 60)
              }

              return {
                ...prev,
                requests: prev.requests.map(r => r.id === payload.new.id ? {
                  ...r,
                  status: payload.new.status as "waiting" | "completed",
                  completedAt: payload.new.completed_at ? new Date(payload.new.completed_at).getTime() : undefined
                } : r)
              }
            })
          } else if (payload.eventType === "DELETE") {
            setLesson((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                requests: prev.requests.filter(r => r.id !== payload.old.id)
              }
            })
          }
        }
      )
      .subscribe((status) => {
        console.log("Request subscription status:", status)
      })

    // Polling fallback every 5 seconds
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const joinedCode = typeof window !== 'undefined' ? localStorage.getItem('joinedLessonCode') : null
        fetchActiveLesson(joinedCode || undefined)
      }
    }, 5000)

    return () => {
      supabase.removeChannel(lessonSub)
      supabase.removeChannel(requestSub)
      clearInterval(intervalId)
    }

  }, [supabase, currentUser])


  // --- Actions ---

  const startLesson = useCallback(async () => {
    if (!supabase) {
      // Fallback for demo
      setLesson({
        id: `lesson-${Date.now()}`,
        active: true,
        code: "DEMO12",
        startedAt: Date.now(),
        requests: [],
      })
      return
    }

    if (!currentUser) return

    // Clear any previous lesson state first to avoid confusion
    setLesson(null)
    setEverConnectedIds(new Set())

    // Generate random 6 character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    try {
      const { data, error } = await supabase.from("lessons").insert({
        teacher_id: currentUser.id,
        status: "active",
        code: code,
        started_at: new Date().toISOString()
      }).select().single()

      if (error) throw error

      if (data) {
        // Optimistically set the lesson immediately
        const newLesson = {
          id: data.id,
          active: true,
          code: data.code,
          startedAt: new Date(data.started_at).getTime(),
          requests: []
        }
        setLesson(newLesson)
        console.log("Lesson started:", newLesson)
      }
    } catch (e) {
      console.error("Error starting lesson:", e)
    }
  }, [supabase, currentUser])

  const joinLesson = useCallback(async (code: string) => {
    if (!supabase) return { success: false, error: "Supabase not initialized" }

    const { data, error } = await supabase
      .from("lessons")
      .select(`
        *,
        help_requests (*)
      `)
      .eq("code", code.toUpperCase())
      .eq("status", "active")
      .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: "Lesson not found or already ended" }

    // Store in localStorage
    localStorage.setItem('joinedLessonCode', code.toUpperCase())

    // Format requests
    const studentIds = (data.help_requests || []).map((r: any) => r.student_id)
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))

    const formattedRequests: HelpRequest[] = (data.help_requests || []).map((r: any) => ({
      id: r.id,
      studentId: r.student_id,
      studentName: profileMap[r.student_id] || "Unknown",
      timestamp: new Date(r.created_at).getTime(),
      status: r.status,
      completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined
    }))

    setLesson({
      id: data.id,
      active: true,
      code: data.code,
      startedAt: new Date(data.started_at).getTime(),
      requests: formattedRequests
    })

    return { success: true }
  }, [supabase])

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
      // Don't start cooldown here - wait until request is completed
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
      // Cooldown starts when teacher marks as complete, not when requesting
    } catch (e) {
      console.error("Error requesting help:", e)
    }
  }, [supabase, currentUser, lesson, cooldownRemaining])

  const completeRequest = useCallback(async (requestId: string) => {
    // Optimistic Update
    setLesson((prev) => {
      if (!prev) return null
      return {
        ...prev,
        requests: prev.requests.map((r) =>
          r.id === requestId ? { ...r, status: "completed" as const, completedAt: Date.now() } : r
        ),
      }
    })

    if (!supabase) {
      // Fallback
      setLesson((prev) => {
        if (!prev) return null
        const request = prev.requests.find(r => r.id === requestId)
        // Start cooldown for this student
        if (request && request.studentId === currentUser?.id) {
          setCooldownRemaining(60)
        }
        return prev // Already updated optimistically
      })
      return
    }

    try {
      // First get the request to check student ID
      const { data: request } = await supabase.from("help_requests").select("student_id").eq("id", requestId).maybeSingle()

      const { error } = await supabase.from("help_requests").update({
        status: "completed",
        completed_at: new Date().toISOString()
      }).eq("id", requestId)

      if (error) throw error

      // Start cooldown for this student if they're the current user
      if (request && request.student_id === currentUser?.id) {
        setCooldownRemaining(60)
      }
    } catch (e) {
      console.error("Error completing request:", e)
      // Revert optimistic update if needed? For now, we rely on re-sync or polling to fix it.
      // But typically we should revert.
    }
  }, [supabase, currentUser])

  const cancelRequest = useCallback(async (requestId: string) => {
    if (!supabase) {
      // Fallback
      setLesson((prev) => {
        if (!prev) return null
        return {
          ...prev,
          requests: prev.requests.filter((r) => r.id !== requestId),
        }
      })
      // Cancel cooldown if active
      setCooldownRemaining(0)
      return
    }

    try {
      await supabase.from("help_requests").delete().eq("id", requestId)
      // Cancel cooldown if the student had one running
      setCooldownRemaining(0)
    } catch (e) {
      console.error("Error canceling request:", e)
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
    const allStudentNames = studentRoster.map(s => s.name)
    // Filter by everConnectedIds if available (and if not empty)
    // If empty (e.g. strict reload with no presence yet), maybe fall back to all? No, stick to connected.
    const connectedRoster = studentRoster.filter(s => everConnectedIds.has(s.id))

    // Fallback: If everConnectedIds is empty (e.g. feature just enabled or reload), 
    // maybe we should use allRoster? Or maybe just those who asked?
    // User requested: "only measure students who are connected". 
    // So if 0 connected, 0 not engaged.
    const rosterToUse = connectedRoster.length > 0 ? connectedRoster : []

    const studentsNotEngaged = rosterToUse
      .filter(s => !studentsWhoAsked.has(s.id))
      .map(s => s.name)
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
  }, [lesson, studentRoster, everConnectedIds])

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

  // Cooldown logic: Check if we have a recent completed request
  useEffect(() => {
    if (!lesson || !currentUser) return

    // Find the most recent completed request for this user
    const myCompletedRequests = lesson.requests
      .filter(r => r.studentId === currentUser.id && r.status === "completed" && r.completedAt)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)) // Newest first

    if (myCompletedRequests.length > 0) {
      const lastCompleted = myCompletedRequests[0]
      if (lastCompleted.completedAt) {
        const elapsed = Date.now() - lastCompleted.completedAt
        if (elapsed < 60000) {
          // We are in cooldown
          const remaining = Math.ceil((60000 - elapsed) / 1000)
          if (remaining > cooldownRemaining) {
            setCooldownRemaining(remaining)
          }
        }
      }
    }
  }, [lesson, currentUser]) // Remove cooldownRemaining from dependency to avoid loop

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
        joinLesson,
        requestHelp,
        completeRequest,
        cancelRequest,
        getQueuePosition,
        getStudentRequestCount,
        cooldownRemaining,
        activeQueue,
        completedRequests,
        lessonReport,
        generateReport,
        studentRoster,
        pastReports,
        isLoading
      }}
    >
      {children}
    </HelpFlowContext.Provider>
  )
}


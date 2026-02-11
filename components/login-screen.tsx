"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { type Role } from "@/lib/helpflow-context"
import { GraduationCap, BookOpen, ArrowRight, Mail, Lock, Loader2, AlertCircle } from "lucide-react"

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

export function LoginScreen() {
  const supabase = createClient()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step for signup: role -> details
  const [signupStep, setSignupStep] = useState<"role" | "details">("role")

  // Ref to prevent double-submission (click + enter, or double click)
  const isSubmittingRef = useRef(false)

  async function handleAuth() {
    if (!supabase) {
      setError("Supabase client not initialized (Demo Mode?)")
      return
    }

    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        })
        if (error) throw error
      } else {
        if (!role || !name) {
          setError("Please fill in all fields")
          setIsLoading(false)
          isSubmittingRef.current = false // Reset here too
          return
        }

        const { error: signUpError, data } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: name,
              role: role,
            },
          },
        })
        if (signUpError) throw signUpError

        // Also create profile entry if trigger doesn't exist (Plan showed trigger/manual insert needed? 
        // We'll rely on trigger or manual insert. Let's do manual insert to be safe if no trigger in SQL I gave user)
        if (data.user) {
          const { error: profileError } = await supabase.from("profiles").insert({
            id: data.user.id,
            full_name: name,
            role: role,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
          })
          if (profileError) {
            // Profile might exist if trigger ran? Ignore duplicate key error safely?
            console.warn("Profile creation warn:", profileError)
          }
        }
      }
    } catch (e: any) {
      if (e.message?.includes("rate limit") || e.message?.includes("Email rate limit exceeded")) {
        setError("Too many attempts. Please wait a moment before trying again.")
      } else if (e.message?.includes("Invalid login credentials")) {
        setError("Invalid credentials. Please check your password or confirm your email.")
      } else {
        setError(e.message)
      }
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false // Always reset
    }
  }

  const resetForm = () => {
    setError(null)
    setSignupStep("role")
    setName("")
    setEmail("")
    setPassword("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2D9389]/10 via-background to-[#115D7F]/10" />

      {/* Floating shapes */}
      <motion.div
        className="absolute top-20 left-20 w-64 h-64 rounded-full bg-gradient-to-br from-[#2D9389]/8 to-[#115D7F]/8 blur-3xl"
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-gradient-to-br from-[#F9B940]/8 to-[#AD4225]/8 blur-3xl"
        animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2D9389] to-[#115D7F] mb-4 shadow-lg shadow-[#2D9389]/20">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            HelpFlow
          </h1>
          <p className="text-muted-foreground mt-2 text-base leading-relaxed">
            Classroom help, simplified.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border p-8"
          layout
          transition={spring}
        >
          {/* Header Switcher */}
          <div className="flex gap-4 mb-6 border-b border-border pb-4">
            <button
              onClick={() => { setMode("login"); resetForm(); }}
              className={`flex-1 pb-2 text-sm font-semibold transition-colors relative ${mode === "login" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Log In
              {mode === "login" && <motion.div layoutId="tab" className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-[#2D9389]" />}
            </button>
            <button
              onClick={() => { setMode("signup"); resetForm(); }}
              className={`flex-1 pb-2 text-sm font-semibold transition-colors relative ${mode === "signup" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign Up
              {mode === "signup" && <motion.div layoutId="tab" className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-[#2D9389]" />}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "signup" && signupStep === "role" ? (
              <motion.div
                key="role-select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-card-foreground mb-1">Select your role</h2>
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setRole("student"); setSignupStep("details"); }}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-card text-card-foreground hover:border-[#2D9389] hover:bg-[#2D9389]/5 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2D9389] to-[#115D7F] flex items-center justify-center shrink-0">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold">Student</p>
                      <p className="text-sm text-muted-foreground">Request help during lessons</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#2D9389] transition-colors" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setRole("teacher"); setSignupStep("details"); }}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-card text-card-foreground hover:border-[#F9B940] hover:bg-[#F9B940]/5 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F9B940] to-[#AD4225] flex items-center justify-center shrink-0">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold">Teacher</p>
                      <p className="text-sm text-muted-foreground">Manage your classroom queue</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#F9B940] transition-colors" />
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {mode === "signup" && (
                  <button
                    onClick={() => setSignupStep("role")}
                    className="text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors flex items-center gap-1"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" /> Back to roles
                  </button>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {mode === "signup" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="e.g. Alex Chen"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border bg-background focus:border-[#2D9389] focus:ring-0 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="name@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border bg-background focus:border-[#2D9389] focus:ring-0 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border bg-background focus:border-[#2D9389] focus:ring-0 outline-none transition-all"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAuth}
                  disabled={isLoading || !email || !password || (mode === "signup" && !name)}
                  className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#2D9389] to-[#115D7F] text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#2D9389]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    mode === "login" ? "Sign In" : "Create Account"
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {!supabase && (
          <p className="text-center text-xs text-red-500 mt-6 bg-red-500/10 p-2 rounded-lg">
            Supabase not configured. Login will fail.
          </p>
        )}
      </motion.div>
    </div>
  )
}

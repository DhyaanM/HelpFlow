"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  if (!supabase) return redirect("/auth/sign-up?error=Database%20connection%20failed")

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const displayName = formData.get("displayName") as string
  const role = formData.get("role") as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard`,
      data: {
        display_name: displayName,
        role: role,
      },
    },
  })

  if (error) {
    return redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`)
  }

  return redirect("/auth/sign-up-success")
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  if (!supabase) return redirect("/auth/login?error=Database%20connection%20failed")

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  return redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  if (!supabase) return redirect("/auth/login")

  await supabase.auth.signOut()
  return redirect("/auth/login")
}

"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Mode = "sign-in" | "sign-up"

interface AuthFormProps {
  onSuccess?: () => void
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<Mode>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function signInWithEmail() {
    setIsBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      onSuccess?.()
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to sign in")
    } finally {
      setIsBusy(false)
    }
  }

  async function signUpWithEmail() {
    setIsBusy(true)
    setMessage(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || undefined,
          },
        },
      })
      if (error) throw error

      // Some Supabase projects require email confirmation.
      if (!data.session) {
        setMessage("Check your email to confirm your account, then sign in.")
        return
      }

      onSuccess?.()
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to create account")
    } finally {
      setIsBusy(false)
    }
  }

  async function signInWithGoogle() {
    setIsBusy(true)
    setMessage(null)
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })
      if (error) throw error
      // Redirect happens automatically
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to start Google sign-in")
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={signInWithGoogle} disabled={isBusy} className="w-full">
        <Image src="/google.svg" alt="" width={16} height={16} className="mr-2" />
        Continue with Google
      </Button>

      <div className="space-y-3">
        {mode === "sign-up" && (
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              disabled={isBusy}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={isBusy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            disabled={isBusy}
          />
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <Button
          type="button"
          className="w-full"
          onClick={mode === "sign-in" ? signInWithEmail : signUpWithEmail}
          disabled={isBusy || !email || !password || (mode === "sign-up" && !fullName)}
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setMessage(null)
            setMode(mode === "sign-in" ? "sign-up" : "sign-in")
          }}
          disabled={isBusy}
        >
          {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </Button>
      </div>
    </div>
  )
}

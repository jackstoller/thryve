"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogOut, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type MeResponse = {
  user: { id: string; email: string | null } | null
  profile: { id: string; email: string | null; full_name: string | null; avatar_url: string | null; updated_at: string | null } | null
}

const jsonFetcher = async (url: string) => {
  const res = await fetch(url)
  return (await res.json()) as MeResponse
}

export function UserMenu() {
  const supabase = useMemo(() => createClient(), [])
  const { data } = useSWR<MeResponse>("/api/me", jsonFetcher)

  const router = useRouter()
  const [accountOpen, setAccountOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const userEmail = data?.user?.email ?? null
  const displayName = data?.profile?.full_name || userEmail || "Account"

  useEffect(() => {
    setFullName(data?.profile?.full_name ?? "")
  }, [data?.profile?.full_name])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      mutate("/api/me")
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  async function signOut() {
    setSigningOut(true)
    setSignOutError(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      await mutate("/api/me")
      setAccountOpen(false)

      // Ensure navigation happens even if the router state is stale.
      router.replace("/login")
      router.refresh()
      window.location.assign("/login")
    } catch (e: any) {
      const message = e?.message ?? "Failed to sign out"
      setSignOutError(message)
      console.error("Sign out failed:", e)
    } finally {
      setSigningOut(false)
    }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update profile")
      }

      await mutate("/api/me")
      setAccountOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (!data?.user) {
    return (
      <Button asChild variant="ghost" size="icon" className="h-9 w-9 active:scale-95">
        <Link href="/login" aria-label="Sign in">
          <UserRound className="w-5 h-5" />
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 active:scale-95"
        onClick={() => setAccountOpen(true)}
        aria-label="Account"
      >
        <UserRound className="w-5 h-5" />
      </Button>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent
          className="top-0 left-0 translate-x-0 translate-y-0 h-[100dvh] w-screen max-w-none rounded-none"
        >
          <DialogHeader>
            <DialogTitle>{displayName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={userEmail ?? ""} disabled />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profileFullName">Full name</Label>
              <Input
                id="profileFullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={saving || signingOut}
              />
            </div>

            {signOutError && <p className="text-sm text-destructive break-words">{signOutError}</p>}

            <div className="flex gap-2">
              <Button onClick={saveProfile} disabled={saving || signingOut} className="flex-1">
                Save
              </Button>
              <Button type="button" variant="outline" onClick={signOut} disabled={saving || signingOut} className="flex-1">
                <LogOut className="w-4 h-4 mr-2" />
                {signingOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

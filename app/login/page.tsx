"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Card } from "@/components/ui/card"
import { AuthForm } from "@/components/auth-form"
import Image from "next/image"

const jsonFetcher = async (url: string) => {
  const res = await fetch(url)
  return res.json()
}

export default function LoginPage() {
  const router = useRouter()
  const { data: me, isLoading } = useSWR("/api/me", jsonFetcher)

  const [errorText, setErrorText] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawError = params.get("error")
    const rawErrorDescription = params.get("error_description")
    setErrorText(rawErrorDescription || rawError)
  }, [])

  useEffect(() => {
    if (!isLoading && me?.user) {
      router.replace("/")
    }
  }, [isLoading, me?.user, router])

  return (
    <div className="h-full w-full flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center justify-center text-center gap-2">
          <Image src="/logo-square-transparent.png" alt="Thryve" width={96} height={96} priority />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Thryve</h1>
            <p className="text-xs text-muted-foreground leading-none">Sign in to continue</p>
          </div>
        </div>

        {errorText && (
          <Card className="p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Sign-in failed</p>
              <p className="text-sm text-muted-foreground break-words">{errorText}</p>
              <p className="text-xs text-muted-foreground">
                If you&apos;re running locally over http, make sure auth cookies are not marked Secure.
              </p>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <AuthForm onSuccess={() => router.replace("/")} />
        </Card>
      </div>
    </div>
  )
}

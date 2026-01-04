import Image from "next/image"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo-square-transparent.png" alt="Thryve" width={128} height={128} priority />

          <div className="text-lg font-title tracking-tight">Thryve</div>
        </div>

        <div className="h-12" aria-hidden="true" />

        <div
          className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin"
          aria-label="Loading"
        />
      </div>
    </div>
  )
}

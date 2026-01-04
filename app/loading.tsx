import Image from "next/image"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden">
            <Image
              src="/logo-square-transparent.png"
              alt="Thryve"
              width={48}
              height={48}
              priority
            />
          </div>

          <div className="text-lg font-title tracking-tight">Thryve</div>
        </div>

        <div
          className="mt-10 h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin"
          aria-label="Loading"
        />
      </div>
    </div>
  )
}

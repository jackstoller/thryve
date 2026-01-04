import type React from "react"
import type { Metadata } from "next"
import { Inter, Geist_Mono, Young_Serif } from "next/font/google"
import "./globals.css"

const _inter = Inter({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _youngSerif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-title" })

export const metadata: Metadata = {
  title: "Thryve - Smart Plant Care",
  description: "Track and care for your plants with AI-powered identification and care schedules",
  generator: "v0.app",
  manifest: "/manifest.json",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#105B2B" },
    { media: "(prefers-color-scheme: dark)", color: "#51996A" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Thryve",
  },
  icons: {
    icon: [{ url: "/logo-favicon-120.png", type: "image/png" }],
    apple: "/logo-favicon-120.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={`font-sans antialiased ${_inter.className} ${_youngSerif.variable} touch-manipulation overscroll-none`}
      >
        <div className="fixed inset-0 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  )
}

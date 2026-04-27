import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
// import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { LanguageProvider } from "@/lib/i18n/context"
import { Toaster } from "@/components/ui/sonner"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const viewport = {
  width: 'device-width',
  maximumScale: 2,
  userScalable: true,
}

export const metadata: Metadata = {
  title: "LAYOUT - An AI-assisted thinking space for work",
  description:
    "A personal thinking space for work where you externalize your internal work-thinking structure as spatial objects",
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={`font-sans antialiased`}>
        <LanguageProvider>{children}</LanguageProvider>
        <Toaster position="top-center" richColors closeButton />
        {/* <Analytics /> */}
      </body>
    </html>
  )
}

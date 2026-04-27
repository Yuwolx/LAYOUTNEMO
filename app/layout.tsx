import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
// import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { LanguageProvider } from "@/lib/i18n/context"
import { Toaster } from "@/components/ui/sonner"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const viewport = {
  width: "device-width",
  maximumScale: 2,
  userScalable: true,
}

const TITLE = "LAYOUTNEMO — 캔버스 위 사고 공간"
const TITLE_EN = "LAYOUTNEMO — A canvas thinking space"

const DESC_KO =
  "캔버스 위에 펼쳐놓는 사고 공간. 블럭을 만들고, 결로 맥락을 나누고, 가까이 두면 자동으로 이어집니다."
const DESC_EN =
  "A canvas thinking space for work. Make blocks, separate them by facets, place them close to auto-connect."

const TWITTER_KO = "캔버스 위 사고 공간. 블럭 · 결 · 관계선."
const TWITTER_EN = "A canvas thinking space. Blocks, facets, connections."

export async function generateMetadata(): Promise<Metadata> {
  const acceptLang = (await headers()).get("accept-language") ?? ""
  const isKorean = acceptLang.toLowerCase().startsWith("ko")

  const title = isKorean ? TITLE : TITLE_EN
  const description = isKorean ? DESC_KO : DESC_EN
  const twitterDesc = isKorean ? TWITTER_KO : TWITTER_EN

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "https://layoutnemo.com",
      siteName: "LAYOUTNEMO",
      locale: isKorean ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: twitterDesc,
    },
    // icons 는 app/icon.svg + app/apple-icon.svg 가 Next.js 에서 자동 등록됨.
  }
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

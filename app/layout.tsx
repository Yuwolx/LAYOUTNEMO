import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
// import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { LanguageProvider } from "@/lib/i18n/context"
import { AuthProvider } from "@/lib/auth/context"
import { Toaster } from "@/components/ui/sonner"
import { RegisterSW } from "@/components/register-sw"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const viewport = {
  width: "device-width",
  maximumScale: 2,
  userScalable: true,
  themeColor: "#fafaf9",
  // iOS 홈 화면 앱(standalone)이 회전 시 상태 바 높이만큼 터치 좌표가 어긋나는
  // 버그 대응 — 웹뷰가 처음부터 화면 전체를 덮게 해 어긋날 여지를 없앤다.
  // 노치/홈 인디케이터 침범은 env(safe-area-inset-*) 패딩으로 각 컴포넌트에서 처리.
  viewportFit: "cover" as const,
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
      // 링크 카드 미리보기 — 커뮤니티(GeekNews/HN/X) 공유 시 유일한 비주얼.
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "LAYOUTNEMO canvas" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: twitterDesc,
      images: ["/og.png"],
    },
    // 주의: icons 필드를 명시하면 app/icon.svg 자동 등록이 "대체"된다 —
    // apple 만 적었다가 파비콘 링크가 통째로 사라진 적 있음. icon 도 반드시 함께 명시.
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    // iOS 홈 화면 설치(PWA) 시 standalone 실행 + 앱 이름.
    appleWebApp: {
      capable: true,
      title: "LAYOUTNEMO",
      statusBarStyle: "default",
    },
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
        <AuthProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </AuthProvider>
        <Toaster position="top-center" richColors closeButton />
        <RegisterSW />
        {/* <Analytics /> */}
      </body>
    </html>
  )
}

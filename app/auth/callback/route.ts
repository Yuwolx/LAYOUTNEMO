import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Google OAuth 콜백.
 *
 * 흐름:
 *   사용자: 로그인 버튼 클릭
 *   → 구글 인증 화면
 *   → 구글: <SUPABASE>/auth/v1/callback?code=...
 *   → Supabase: layoutnemo.com/auth/callback?code=...
 *   → (이 라우트) exchangeCodeForSession 으로 세션 쿠키 발급
 *   → ?next= 파라미터 또는 / 로 redirect
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const nextRaw = url.searchParams.get("next") ?? "/"
  // open-redirect 방어: 원본 문자열이 아니라 "해석된" URL 의 오리진을 비교한다.
  // (new URL 은 특수 스킴에서 백슬래시를 슬래시로 정규화하므로 "/\evil.com" 같은
  //  문자열-검사 우회가 가능하다. 실제 목적지가 같은 오리진일 때만 허용.)
  let nextParam = "/"
  try {
    const dest = new URL(nextRaw, url.origin)
    if (dest.origin === url.origin) nextParam = dest.pathname + dest.search
  } catch {
    nextParam = "/"
  }

  if (code) {
    const supabase = await createSupabaseServerClient()
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error("OAuth code exchange failed:", error.message)
        return NextResponse.redirect(new URL("/?auth_error=1", url.origin))
      }
    }
  }

  return NextResponse.redirect(new URL(nextParam, url.origin))
}

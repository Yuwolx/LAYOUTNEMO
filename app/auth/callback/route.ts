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
  const nextParam = url.searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createSupabaseServerClient()
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code)
    }
  }

  return NextResponse.redirect(new URL(nextParam, url.origin))
}

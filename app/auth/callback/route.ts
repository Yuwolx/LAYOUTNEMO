import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Google OAuth 콜백.
 *
 * Supabase 는 OAuth 흐름에서 ?code=<authorization_code> 와 함께 이 라우트로 redirect 한다.
 * 우리는 그 code 를 세션으로 교환해 쿠키에 심고, 사용자를 원래 페이지로 보낸다.
 *
 * 흐름:
 *   사용자: 로그인 클릭
 *   → 구글 인증 화면
 *   → 구글: <SUPABASE>/auth/v1/callback?code=...
 *   → Supabase: layoutnemo.com/auth/callback?code=...
 *   → (이 라우트) exchangeCodeForSession 으로 세션 쿠키 발급
 *   → / 또는 ?next= 파라미터로 리다이렉트
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

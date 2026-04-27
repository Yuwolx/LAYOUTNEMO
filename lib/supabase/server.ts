import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * 서버 사이드(Route Handler, Server Component) 에서 사용하는 Supabase 클라이언트.
 * 쿠키를 통해 세션을 인식 — OAuth 콜백 후 세션 유지에 필수.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Component 안에서는 쿠키 set 이 불가 — 무시. 미들웨어/Route Handler 에서는 OK.
        }
      },
    },
  })
}

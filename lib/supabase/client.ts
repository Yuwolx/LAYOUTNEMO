import { createBrowserClient } from "@supabase/ssr"

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 *
 * env 가 비어있으면 null 반환 — 호출 측에서 "로그인 비활성" 으로 처리.
 * 로그인 안 한 사용자는 로컬 모드 그대로 동작 (Phase 1 — 데이터 sync 는 Phase 2).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createBrowserClient(url, anonKey)
}

/** env 가 채워져 있는지 — UI 에서 로그인 버튼 노출 여부 결정. */
export const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

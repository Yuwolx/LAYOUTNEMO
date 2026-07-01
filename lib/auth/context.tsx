"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

/**
 * 클라이언트 인증 컨텍스트.
 *
 * - Supabase env 없으면 비활성: user/session 항상 null, signIn/signOut 무시
 * - env 있으면 세션 자동 복원 + onAuthStateChange 구독으로 멀티탭 동기화
 *
 * Phase 1 — 로그인 / 로그아웃만. 데이터 sync 는 Phase 2.
 */

type AuthContextValue = {
  user: User | null
  session: Session | null
  isLoading: boolean
  /** Supabase env 셋업 여부. UI 에서 로그인 버튼 표시 여부 결정. */
  isConfigured: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // 프로필 보장을 유저당 1회만 시도하도록 추적.
  const ensuredProfileRef = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }
    let mounted = true

    // 방어적 프로필 보장: 정상적으로는 handle_new_user 트리거가 만들지만,
    // 트리거가 실패했거나 구 계정이라 행이 없으면 이후 캔버스/블럭 저장이 RLS 로 조용히 막힌다.
    // 본인 행만 INSERT ... ON CONFLICT DO NOTHING (RLS: auth.uid() = id) 으로 존재만 보장.
    const ensureProfile = async (u: User) => {
      if (!supabase || ensuredProfileRef.current === u.id) return
      ensuredProfileRef.current = u.id
      const { error } = await supabase
        .from("user_profiles")
        .upsert({ id: u.id, email: u.email ?? null }, { onConflict: "id", ignoreDuplicates: true })
      if (error) {
        ensuredProfileRef.current = null // 실패 시 다음 이벤트에서 재시도
        console.error("ensureProfile failed:", error.message)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      const u = data.session?.user ?? null
      setUser(u)
      setIsLoading(false)
      if (u) void ensureProfile(u)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      const u = newSession?.user ?? null
      setUser(u)
      if (u) void ensureProfile(u)
      else ensuredProfileRef.current = null // 로그아웃 시 리셋
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isConfigured: Boolean(supabase),
    signInWithGoogle: async () => {
      if (!supabase) return
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        window.location.pathname,
      )}`
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })
    },
    signOut: async () => {
      if (!supabase) return
      // 로그아웃 시점 기록 — 재로그인 시 오프라인 변경 감지에 사용
      localStorage.setItem("layout_last_synced_at", Date.now().toString())
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}

"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
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

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      setUser(newSession?.user ?? null)
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

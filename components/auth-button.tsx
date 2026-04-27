"use client"

import { useState } from "react"
import { LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth/context"
import { useT } from "@/lib/i18n/context"

interface AuthButtonProps {
  isDarkMode: boolean
}

export function AuthButton({ isDarkMode }: AuthButtonProps) {
  const { user, isLoading, isConfigured, signInWithGoogle, signOut } = useAuth()
  const t = useT()
  const [busy, setBusy] = useState(false)

  // Supabase env 미설정 시 버튼 자체를 숨긴다.
  if (!isConfigured) return null

  if (isLoading) {
    return (
      <div
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
          isDarkMode ? "bg-zinc-800 text-zinc-500 border-zinc-700" : "bg-white text-gray-400 border-gray-200"
        }`}
      >
        ...
      </div>
    )
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          try {
            setBusy(true)
            await signInWithGoogle()
          } finally {
            setBusy(false)
          }
        }}
        className={`gap-2 text-sm ${isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-white hover:bg-gray-50"}`}
      >
        <GoogleGlyph />
        <span>{t("auth.signIn")}</span>
      </Button>
    )
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "User"
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const initial = (displayName[0] ?? "?").toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs transition-all border ${
            isDarkMode
              ? "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700"
              : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          }`}
          aria-label={displayName}
          title={displayName}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <span
              className={`w-6 h-6 rounded-full text-[11px] font-medium flex items-center justify-center ${
                isDarkMode ? "bg-zinc-700 text-zinc-100" : "bg-gray-200 text-gray-700"
              }`}
            >
              {initial}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {displayName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            try {
              setBusy(true)
              await signOut()
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GoogleGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956L3.964 7.288C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

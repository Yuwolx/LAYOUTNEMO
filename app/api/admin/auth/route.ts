import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAdminSessionToken } from "@/lib/admin/session"

const COOKIE = "admin_session"
const MAX_AGE = 60 * 60 * 8 // 8시간

// 브루트포스 완화용 인메모리 rate limit.
// 서버리스에서는 인스턴스별 상태라 완벽하진 않지만, 자동화 공격 속도를 의미있게 늦춘다.
const WINDOW_MS = 15 * 60 * 1000 // 15분
const MAX_FAILS = 8
const failures = new Map<string, { count: number; first: number }>()

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  return xff ? xff.split(",")[0].trim() : "unknown"
}

function isRateLimited(ip: string): boolean {
  const rec = failures.get(ip)
  if (!rec) return false
  if (Date.now() - rec.first > WINDOW_MS) {
    failures.delete(ip)
    return false
  }
  return rec.count >= MAX_FAILS
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const rec = failures.get(ip)
  if (!rec || now - rec.first > WINDOW_MS) failures.set(ip, { count: 1, first: now })
  else rec.count++
}

export async function POST(req: Request) {
  const ip = clientIp(req)
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 },
    )
  }

  const { id, password } = await req.json()

  if (
    id !== process.env.ADMIN_ID ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    recordFailure(ip)
    return NextResponse.json({ error: "인증 실패" }, { status: 401 })
  }

  failures.delete(ip) // 성공 시 카운터 리셋

  const cookieStore = await cookies()
  cookieStore.set(COOKIE, getAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  const valid = Boolean(token) && token === getAdminSessionToken()
  return NextResponse.json({ valid })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
  return NextResponse.json({ ok: true })
}

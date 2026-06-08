import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const COOKIE = "admin_session"
const MAX_AGE = 60 * 60 * 8 // 8시간

export async function POST(req: Request) {
  const { id, password } = await req.json()

  if (
    id !== process.env.ADMIN_ID ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE, process.env.ADMIN_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/admin",
  })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  const valid = token === process.env.ADMIN_PASSWORD
  return NextResponse.json({ valid })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
  return NextResponse.json({ ok: true })
}

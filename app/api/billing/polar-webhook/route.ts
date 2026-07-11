import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 15

/**
 * Polar(Merchant of Record) 구독 웹훅 — 유료화의 유일한 서버 접점.
 *
 * 하는 일은 단 하나: 구독 상태 이벤트를 받아 user_profiles.plan 을 'pro'/'free' 로 전환.
 * 쿼터(consume_ai_credit)는 이미 plan='pro' 를 무제한으로 처리하므로 이 플래그가 전부다.
 *
 * - 이벤트 매핑: subscription.active → pro / subscription.revoked → free.
 *   (subscription.canceled 는 "기간 끝까지 유지" 신호라 no-op — 만료 시점에 revoked 가 온다.)
 * - 유저 매칭: checkout 에 심어 보낼 external_id(= auth user id) 우선, 없으면 결제 이메일.
 * - 서명: Standard Webhooks 규격(webhook-id/-timestamp/-signature, HMAC-SHA256).
 *   POLAR_WEBHOOK_SECRET 미설정이면 503 — 기존 admin/AI 라우트와 같은 fail-closed 패턴.
 * - plan 변경은 service role 로만 (클라이언트 RLS 는 plan 변경 불가).
 */

const TIMESTAMP_TOLERANCE_SEC = 5 * 60

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Standard Webhooks 서명 검증. secret 은 대시보드가 주는 값(`whsec_` 접두 유무 모두 허용). */
function verifySignature(secret: string, id: string, timestamp: string, body: string, signatureHeader: string): boolean {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > TIMESTAMP_TOLERANCE_SEC) return false

  const secretBytes = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64")
  const expected = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest()

  // 헤더는 "v1,<base64> v1,<base64> ..." 형태로 복수 서명이 올 수 있다 — 하나라도 맞으면 유효.
  return signatureHeader.split(" ").some((part) => {
    const sig = part.startsWith("v1,") ? part.slice(3) : part
    let candidate: Buffer
    try {
      candidate = Buffer.from(sig, "base64")
    } catch {
      return false
    }
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  })
}

export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Billing webhook not configured" }, { status: 503 })
  }

  const body = await req.text()
  const id = req.headers.get("webhook-id")
  const timestamp = req.headers.get("webhook-timestamp")
  const signature = req.headers.get("webhook-signature")
  if (!id || !timestamp || !signature || !verifySignature(secret, id, timestamp, body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  let event: { type?: string; data?: { customer?: { email?: string; external_id?: string | null } } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const plan =
    event.type === "subscription.active" ? "pro" : event.type === "subscription.revoked" ? "free" : null
  if (!plan) {
    // 관심 없는 이벤트도 2xx 로 응답해야 Polar 가 재전송 폭주를 안 한다.
    return NextResponse.json({ received: true, ignored: event.type ?? "unknown" }, { status: 202 })
  }

  const service = createServiceClient()
  if (!service) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const externalId = event.data?.customer?.external_id ?? null
  const email = event.data?.customer?.email?.trim().toLowerCase() ?? null

  // external_id(= auth user id, checkout 에서 지정) 우선 — 이메일은 결제/가입 주소가 다를 수 있는 보조 수단.
  let matched = 0
  if (externalId) {
    const { data, error } = await service.from("user_profiles").update({ plan }).eq("id", externalId).select("id")
    if (error) {
      console.error("polar-webhook: plan update by external_id failed:", error.message)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }
    matched = data?.length ?? 0
  }
  if (matched === 0 && email) {
    const { data, error } = await service.from("user_profiles").update({ plan }).eq("email", email).select("id")
    if (error) {
      console.error("polar-webhook: plan update by email failed:", error.message)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }
    matched = data?.length ?? 0
  }

  if (matched === 0) {
    // 유저를 못 찾은 결제 — 수동 대조가 필요하니 로그에 충분한 단서를 남긴다(개인정보는 이메일만).
    console.error(`polar-webhook: no user matched (type=${event.type}, external_id=${externalId}, email=${email})`)
  }

  return NextResponse.json({ received: true, plan, matched })
}

import type { SupabaseClient } from "@supabase/supabase-js"

export type EventName =
  | "session_start"
  | "block_created"
  | "block_deleted"
  | "ai_create_used"
  | "ai_tidy_used"

export function captureEvent(
  supabase: SupabaseClient,
  userId: string,
  name: EventName,
  payload?: Record<string, unknown>,
) {
  // fire-and-forget — UI를 블로킹하지 않음
  supabase
    .from("events")
    .insert({ user_id: userId, name, payload: payload ?? {} })
    .then(({ error }) => {
      if (error) console.error("[event]", name, error.message)
    })
}

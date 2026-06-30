-- ──────────────────────────────────────────────────────────
-- AI 사용량 한도(쿼터) 적용
--
-- 기존 user_profiles 에는 ai_create_used / ai_create_reset_at 가 이미 있으나
-- 실제로 읽거나 증가시키는 코드가 없어 무제한이었다. 이 마이그레이션은:
--   1. tidy(정리하기) 전용 카운터 ai_tidy_used 추가 (create 와 별도 예산)
--   2. 월 리셋 + 한도검사 + 차감을 한 번에 처리하는 원자적 함수 consume_ai_credit
--   3. OpenAI 호출 실패 시 되돌리는 refund_ai_credit
--
-- 두 카운터는 ai_create_reset_at 하나를 월 경계로 공유한다.
-- ──────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists ai_tidy_used int not null default 0;

-- ──────────────────────────────────────────────────────────
-- consume_ai_credit(p_kind, p_limit)
--   p_kind : 'create' | 'tidy'
--   반환    : 남은 크레딧(>=0). 한도 초과면 -1.
--
-- security definer + auth.uid() 스코프 → 사용자는 자기 행만 변경 가능.
-- 단일 UPDATE 의 원자성으로 동시 요청에도 한도를 넘기지 않는다.
-- ──────────────────────────────────────────────────────────
create or replace function public.consume_ai_credit(p_kind text, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  if p_kind not in ('create', 'tidy') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  -- 1) 리셋 시점이 지났으면 lazy 리셋 (크론 불필요). 두 카운터 함께 초기화.
  update public.user_profiles
    set ai_create_used = 0,
        ai_tidy_used = 0,
        ai_create_reset_at = date_trunc('month', now()) + interval '1 month'
    where id = auth.uid()
      and now() >= ai_create_reset_at;

  -- 2) pro 는 무제한, free 는 한도 내에서만 +1 (원자적 check-and-increment).
  if p_kind = 'create' then
    update public.user_profiles
      set ai_create_used = ai_create_used + 1
      where id = auth.uid()
        and (plan = 'pro' or ai_create_used < p_limit)
      returning case when plan = 'pro' then 999999 else p_limit - ai_create_used end
      into remaining;
  else
    update public.user_profiles
      set ai_tidy_used = ai_tidy_used + 1
      where id = auth.uid()
        and (plan = 'pro' or ai_tidy_used < p_limit)
      returning case when plan = 'pro' then 999999 else p_limit - ai_tidy_used end
      into remaining;
  end if;

  -- 0 행 갱신 = 한도 초과
  return coalesce(remaining, -1);
end;
$$;

-- ──────────────────────────────────────────────────────────
-- refund_ai_credit(p_kind)
--   OpenAI 호출이 끝내 실패했을 때 예약한 1 크레딧을 돌려준다 (0 미만으로는 안 내려감).
-- ──────────────────────────────────────────────────────────
create or replace function public.refund_ai_credit(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'create' then
    update public.user_profiles
      set ai_create_used = greatest(ai_create_used - 1, 0)
      where id = auth.uid();
  elsif p_kind = 'tidy' then
    update public.user_profiles
      set ai_tidy_used = greatest(ai_tidy_used - 1, 0)
      where id = auth.uid();
  end if;
end;
$$;

-- 로그인 사용자(authenticated)만 호출 가능. anon 차단.
revoke all on function public.consume_ai_credit(text, int) from public, anon;
revoke all on function public.refund_ai_credit(text) from public, anon;
grant execute on function public.consume_ai_credit(text, int) to authenticated;
grant execute on function public.refund_ai_credit(text) to authenticated;

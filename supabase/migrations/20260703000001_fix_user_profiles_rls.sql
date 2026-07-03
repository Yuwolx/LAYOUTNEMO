-- ──────────────────────────────────────────────────────────
-- 보안 수정(H1): user_profiles RLS 권한 상승 차단
--
-- 문제:
--   기존 정책 `own profile` 이 `for all using (auth.uid() = id)` 였다.
--   FOR ALL 에 WITH CHECK 가 없으면 USING 을 그대로 물려받으므로,
--   로그인 유저가 브라우저에서 anon 키로 자기 행의 아무 컬럼이나 UPDATE 할 수 있었다:
--     - is_admin = true      → "admin read all *" 정책이 열려 전 테넌트 데이터 열람
--     - plan = 'pro'         → 무제한 OpenAI 사용
--     - ai_create_used = 0   → 쿼터 리셋
--
-- 수정:
--   FOR ALL 정책을 제거하고, 클라이언트가 실제로 필요한 두 가지만 허용한다.
--     - SELECT: 본인 프로필 조회 (플랜/쿼터 표시)
--     - INSERT: 본인 프로필 보장(ensureProfile upsert) — 단, 권한 컬럼은
--               기본값으로만 삽입 가능하게 WITH CHECK 로 고정
--   UPDATE/DELETE 클라이언트 정책은 두지 않는다. 쿼터 변경은 consume_ai_credit /
--   refund_ai_credit(둘 다 SECURITY DEFINER, RLS 우회)로만, is_admin/plan 변경은
--   서버(service role) 또는 SQL Editor 로만 이뤄진다.
-- ──────────────────────────────────────────────────────────

drop policy if exists "own profile" on public.user_profiles;

-- 본인 프로필 조회
create policy "read own profile" on public.user_profiles
  for select using (auth.uid() = id);

-- 본인 프로필 생성(보장) — 권한/쿼터 컬럼은 기본값(비권한)으로만 삽입 허용.
-- 정상 유저는 handle_new_user 트리거가 이미 행을 만들어 두므로 ensureProfile 의
-- upsert(ignoreDuplicates)는 ON CONFLICT DO NOTHING 으로 무시된다. 트리거가 실패한
-- 극단적 경우에만 이 경로로 행이 생기며, 이때도 is_admin/plan 을 올릴 수 없다.
create policy "insert own profile" on public.user_profiles
  for insert with check (
    auth.uid() = id
    and plan = 'free'
    and is_admin = false
    and ai_create_used = 0
    and ai_tidy_used = 0
  );

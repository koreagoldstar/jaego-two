-- 전체 로그인 세션 무효화 (모든 기기·브라우저에서 로그아웃)
-- Supabase SQL Editor에서 Run
-- 비밀번호 변경은 Authentication → Users → 해당 사용자 → Reset password (5160)
-- 또는: node scripts/reset-kiosk-auth.mjs (service_role 키 필요)

delete from auth.sessions;
delete from auth.refresh_tokens;

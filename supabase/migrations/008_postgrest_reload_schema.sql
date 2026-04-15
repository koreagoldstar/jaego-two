-- PostgREST(API)가 새 테이블을 아직 못 찾을 때 (schema cache)
-- 007 실행 직후 앱에 "테이블이 없습니다"가 뜨면 이 한 줄만 SQL Editor에서 실행하세요.
NOTIFY pgrst, 'reload schema';

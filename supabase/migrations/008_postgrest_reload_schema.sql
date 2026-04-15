-- PostgREST(API) 스키마 캐시만 갱신합니다. CREATE POLICY 등은 없습니다.
-- ⚠️ 다른 마이그레이션 파일과 한 번에 붙여 넣지 마세요. 아래 한 줄만 새 쿼리에 넣고 실행하세요.
NOTIFY pgrst, 'reload schema';

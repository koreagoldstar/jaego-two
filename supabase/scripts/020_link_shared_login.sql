-- 공유 로그인 연결: 새 이메일 계정이 기존 계정의 재고를 같이 쓰게 함
-- 먼저 Supabase → Authentication → Users → Add user 로 새 이메일 계정을 만든 뒤 실행하세요.
-- (supabase/migrations/020_account_members.sql 이 적용되어 있어야 합니다)

insert into public.account_members (member_user_id, owner_user_id)
select m.id, o.id
from auth.users m, auth.users o
where lower(m.email) = '47156@naver.com'              -- 새로 쓸 이메일
  and lower(o.email) = 'broadstock-kiosk@example.com'  -- 재고 데이터가 있는 기존 이메일
on conflict (member_user_id) do update set owner_user_id = excluded.owner_user_id;

-- 확인
select m.email as 로그인_이메일, o.email as 재고_주인
from public.account_members a
join auth.users m on m.id = a.member_user_id
join auth.users o on o.id = a.owner_user_id;

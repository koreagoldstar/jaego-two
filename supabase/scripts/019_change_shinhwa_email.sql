-- 신화유디텍 로그인 이메일을 47156@naver.com 으로 변경
-- 비밀번호·재고 데이터는 그대로 유지됩니다. (데이터는 user_id 로 연결되어 있어 이메일과 무관)
--
-- 사용법: Supabase → SQL Editor 에서 ① 먼저 실행해 대상 계정을 확인한 뒤 ② 를 실행하세요.

-- ① 확인: 계정별 품목 수 (품목이 가장 많은 계정이 신화유디텍 계정)
select u.id, u.email, u.last_sign_in_at, count(i.id) as item_count
from auth.users u
left join public.items i on i.user_id = u.id
group by u.id, u.email, u.last_sign_in_at
order by item_count desc;

-- ② 변경: 품목이 가장 많은 계정의 이메일을 교체
do $$
declare
  v_new_email text := '47156@naver.com';
  v_uid uuid;
begin
  if exists (select 1 from auth.users where lower(email) = v_new_email) then
    raise exception '이미 % 계정이 있습니다. 중복 계정을 먼저 정리하세요.', v_new_email;
  end if;

  select i.user_id into v_uid
  from public.items i
  group by i.user_id
  order by count(*) desc
  limit 1;

  if v_uid is null then
    raise exception '품목이 있는 계정을 찾지 못했습니다.';
  end if;

  update auth.users
  set email = v_new_email,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = v_uid;

  update auth.identities
  set identity_data = identity_data || jsonb_build_object('email', v_new_email),
      updated_at = now()
  where user_id = v_uid and provider = 'email';

  raise notice '완료: % → %', v_uid, v_new_email;
end $$;

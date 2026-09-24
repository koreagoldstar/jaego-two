"""supabase/migrations/001~ 를 합쳐 새 DB 초기 설치용 supabase/saas_fresh_setup.sql 을 만듭니다.

    python scripts/build-saas-setup.py
"""
import glob
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), '..')
files = [f for f in sorted(glob.glob(os.path.join(ROOT, 'supabase/migrations/0*.sql'))) if '000_prereq' not in f]

out = [
    '-- ============================================================',
    '-- 오늘의 재고 (판매용) — 새 Supabase 프로젝트 초기 설치 (빈 DB 전용)',
    '-- Supabase → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run 1회',
    '-- supabase/migrations/001~ 을 순서대로 합친 파일입니다. (000 은 예전 수동 테이블 보정용이라 제외)',
    '-- 한 번에 실행할 때 겹치는 apply_stock_move 옛 버전 권한 줄은 뺐습니다 (014·015 에서 최종 권한 부여).',
    '-- 재생성: python scripts/build-saas-setup.py',
    '-- ============================================================',
    '',
]
# 인자 목록 없는 revoke/grant 는 오버로드가 여럿일 때 "function name is not unique" 오류
ambiguous = re.compile(r'^\s*(revoke|grant)\b.*on function public\.apply_stock_move\s+(from|to)\b', re.I)

for f in files:
    out += ['', '-- ' + '-' * 60, '-- ' + os.path.basename(f), '-- ' + '-' * 60]
    for line in open(f, encoding='utf-8').read().splitlines():
        out.append('-- (합본에서 제외) ' + line if ambiguous.match(line) else line)

with open(os.path.join(ROOT, 'supabase/saas_fresh_setup.sql'), 'w', encoding='utf-8', newline='\n') as fp:
    fp.write('\n'.join(out) + '\n')
print('supabase/saas_fresh_setup.sql 생성 완료')

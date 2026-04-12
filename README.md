# jaego-two (BroadStock 재고관리)

Vercel **`jaego-two`** 배포용 폴더입니다. 예전 클라이언트 PIN(`1593`) 방식이 아니라 **이메일 + 비밀번호 → 서버 `POST /api/auth/login`** 으로 Supabase에 로그인합니다.

박스히어로(BoxHero)와 비슷한 흐름의 재고 앱입니다. **Next.js 14**, **Supabase**, 모바일 하단 탭·입출고·바코드 스캔·**시리얼 포함 바코드 생성**을 지원합니다.

## 기능

- 품목 등록 / 수정 (SKU, 바코드 값, 시리얼, 위치, 수량)
- **입고·출고** (휴대폰 UI, 빠른 수량 버튼)
- 카메라 **바코드 스캔** → 입출고 화면으로 이동
- **바코드 생성** (SKU + 시리얼 + 구분자, CODE128/CODE39, PNG 저장)
- 입출고 이력
- 로그인: Supabase Users 이메일·비밀번호 (기본 이메일 `broadstock-kiosk@example.com`, 초기 비밀번호 권장 `159311` — `NEXT_PUBLIC_KIOSK_EMAIL` 로 변경 가능)

## 로컬 실행

```powershell
cd jaego-two
npm install
copy .env.local.example .env.local
# .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 입력
npm run setup:check
npm run dev
```

Supabase SQL: `supabase/migrations/001_initial.sql` 실행 (자세한 절차는 [docs/처음-설정하기.md](./docs/처음-설정하기.md)).

## GitHub에 올리기

이 폴더는 이미 `git` 이 초기화되어 있습니다. (처음이 아니면 `git init` 은 하지 마세요.)

1. 브라우저에서 [GitHub → New repository](https://github.com/new) 열기  
2. Repository name: **`jaego`** (원하면 다른 이름)  
3. **Add a README** 는 **체크하지 않음** (빈 저장소) → **Create repository**  
4. PC에서 (PowerShell에서 `npm` 이 막히면 `git` 만 쓰거나 **CMD** 사용):

   ```powershell
   cd c:\Users\COM\jaego
   git remote add origin https://github.com/<GitHub아이디>/jaego.git
   git push -u origin main
   ```

   `<GitHub아이디>` 를 본인 계정으로 바꿉니다.  
   로그인 창이 뜨면 GitHub **Personal Access Token** (classic, `repo` 권한)으로 비밀번호 대신 붙여 넣는 방식이 일반적입니다.

## Vercel로 배포

1. [vercel.com](https://vercel.com) 에 GitHub으로 로그인  
2. **Add New… → Project** → 방금 만든 **`jaego`** 저장소 **Import**  
3. Framework: **Next.js** (자동), **Root Directory** 는 그대로 두고 **Deploy** 전에 아래로 이동  
4. **Environment Variables** 에 로컬 `.env.local` 과 **동일한** 이름으로 넣기:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (선택) `NEXT_PUBLIC_KIOSK_EMAIL` — Supabase 사용자 이메일을 바꿨을 때만  
5. **Deploy** 클릭  
6. 배포가 끝나면 주소 예: `https://jaego-xxx.vercel.app`  
7. Supabase 대시보드 → **Authentication → URL Configuration**  
   - **Site URL** 을 위 Vercel 주소로  
   - **Redirect URLs** 에 `https://본인-프로젝트.vercel.app/**` 추가 후 저장  
8. 환경 변수를 나중에 바꿨다면 Vercel에서 **Redeploy** (빌드 시 `NEXT_PUBLIC_*` 가 클라이언트에 들어감)

## Vercel에서 `middleware` / `public-env` 빌드 오류가 날 때

이 저장소 **`main` 최신본에는 루트 `middleware.ts` 파일이 없습니다.** 그런데도 같은 오류가 나오면 **Vercel이 이 GitHub 저장소를 빌드하지 않은 것**입니다.

1. Vercel → 해당 프로젝트 → **Settings → Git**  
   - **Connected Git Repository** 가 **`koreagoldstar/jaego-two`** 인지 확인 (다른 저장소·포크면 안 됨)  
   - **Production Branch** 가 **`main`** 인지 확인  
   - **Root Directory** 는 **비움** (한 글자도 넣지 않음)
2. **Deployments** 에서 맨 위 배포의 **커밋 SHA** 를 눌러 GitHub 커밋과 같은지 확인  
3. **Redeploy** 시 **Use existing Build Cache** 를 끄고(가능하면 “Clear cache and redeploy”) 다시 빌드

## 라이선스

Private / 사내용.

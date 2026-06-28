/**
 * 전체 로그인 세션 종료 + 키오스크 계정 비밀번호 변경
 *
 * Supabase Dashboard → Settings → API → service_role (secret) 필요
 *
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/reset-kiosk-auth.mjs
 *
 * .env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 있으면 자동 로드
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const email = (
  process.env.NEXT_PUBLIC_KIOSK_EMAIL ||
  process.env.KIOSK_EMAIL ||
  'broadstock-kiosk@example.com'
)
  .trim()
  .toLowerCase()
const newPassword = (process.env.NEW_KIOSK_PASSWORD || '5160').trim()

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  console.error('   Supabase → Settings → API → service_role (secret)')
  process.exit(1)
}

if (!newPassword || newPassword.length < 4) {
  console.error('❌ NEW_KIOSK_PASSWORD 는 4자 이상이어야 합니다.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function listAllUsers() {
  const users = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const batch = data?.users ?? []
    users.push(...batch)
    if (batch.length < 200) break
    page += 1
  }
  return users
}

async function main() {
  console.log(`Supabase: ${url}`)
  console.log(`키오스크 이메일: ${email}`)
  console.log(`새 비밀번호: ${newPassword.replace(/./g, '*')} (${newPassword.length}자)`)
  console.log('')

  const users = await listAllUsers()
  console.log(`사용자 ${users.length}명 — 전 세션 로그아웃 중…`)

  let signedOut = 0
  for (const u of users) {
    const { error } = await admin.auth.admin.signOut(u.id, 'global')
    if (error) {
      console.warn(`  ⚠ ${u.email ?? u.id}: ${error.message}`)
    } else {
      signedOut += 1
      console.log(`  ✓ 로그아웃: ${u.email ?? u.id}`)
    }
  }

  const target = users.find(u => (u.email ?? '').toLowerCase() === email)
  if (!target) {
    console.error(`\n❌ 이메일「${email}」사용자를 찾을 수 없습니다.`)
    console.error('   Supabase → Authentication → Users 에 계정이 있는지 확인하세요.')
    process.exit(1)
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(target.id, {
    password: newPassword,
  })
  if (pwError) {
    console.error(`\n❌ 비밀번호 변경 실패: ${pwError.message}`)
    process.exit(1)
  }

  console.log(`\n✅ 완료`)
  console.log(`   · ${signedOut}명 전체 기기에서 로그아웃`)
  console.log(`   · ${email} 비밀번호 변경됨`)
  console.log(`   · 새 PIN: ${newPassword}`)
}

main().catch(err => {
  console.error('❌', err.message ?? err)
  process.exit(1)
})

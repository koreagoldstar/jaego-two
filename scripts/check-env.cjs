const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.log("ℹ️  .env.local 이 없습니다. .env.local.example 을 복사해 Supabase 값을 넣으세요.\n");
  process.exit(0);
}

const raw = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of raw.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

let bad = false;
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!url || url.includes("your-project") || url.includes("xxxx")) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL 을 실제 Project URL 로 바꾸세요.");
  bad = true;
} else {
  console.log("✅ NEXT_PUBLIC_SUPABASE_URL");
}

if (!key || key.includes("your-anon") || key.length < 80) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 를 Settings → API 에서 anon public 키 전체로 넣으세요.");
  bad = true;
} else {
  console.log("✅ NEXT_PUBLIC_SUPABASE_ANON_KEY (길이 OK)");
}

const kioskEmail = env.NEXT_PUBLIC_KIOSK_EMAIL || "";
if (kioskEmail) {
  console.log("✅ NEXT_PUBLIC_KIOSK_EMAIL (기본 이메일 대신 사용)");
} else {
  console.log("ℹ️  NEXT_PUBLIC_KIOSK_EMAIL 없음 → 기본 broadstock-kiosk@example.com (비밀번호 159311)");
}

console.log("");
if (bad) {
  console.log("→ docs/처음-설정하기.md 참고\n");
  process.exit(1);
}
console.log("환경 변수 OK\n");

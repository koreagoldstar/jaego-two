export function formatAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다. (Supabase Users에 해당 이메일이 있고 비밀번호가 일치하는지 확인하세요.)'
  }
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return '이메일 인증이 필요합니다. Supabase → Authentication → Providers → Email → Confirm email 을 끄거나, 메일함에서 인증 링크를 눌러 주세요.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }
  return message
}

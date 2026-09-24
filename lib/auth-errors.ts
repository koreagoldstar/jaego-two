export function formatAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return '이메일 인증이 필요합니다. 가입할 때 받은 메일의 인증 링크를 눌러 주세요.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (m.includes('already registered') || m.includes('user already exists')) {
    return '이미 가입된 이메일입니다. 로그인해 주세요.'
  }
  if (m.includes('password should be at least') || m.includes('weak password')) {
    return '비밀번호는 6자 이상으로 입력해 주세요.'
  }
  if (m.includes('invalid') && m.includes('email')) {
    return '사용할 수 없는 이메일 주소입니다.'
  }
  return message
}

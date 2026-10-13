const SESSION_KEY = 'se327:demo-account-session'
const RESET_TOKEN_KEY = 'se327:demo-password-reset'

export function isEndpointUnavailable(error) {
  const code = error?.code || error?.payload?.code
  const status = error?.status
  return !status
    || [404, 502, 503].includes(status)
    || (status >= 500 && !code)
    || ['NOT_FOUND', 'ROUTE_NOT_FOUND', 'CORS_ORIGIN_NOT_ALLOWED'].includes(code)
}

export function getMockAccountSession() {
  try {
    const session = window.sessionStorage.getItem(SESSION_KEY)
    return session ? JSON.parse(session) : null
  } catch {
    return null
  }
}

export function startMockAccountSession(email) {
  const normalizedEmail = email.trim().toLowerCase()
  const session = {
    isMock: true,
    profile: {
      user_id: 'demo-user',
      name: 'Demo Customer',
      email: normalizedEmail,
      phone_number: '081-234-5678',
      date_of_birth: '1998-05-14',
      email_verified: false,
      created_at: '2024-06-01T00:00:00.000Z',
    },
  }
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function endMockAccountSession() {
  window.sessionStorage.removeItem(SESSION_KEY)
}

export function createMockPasswordResetToken(email) {
  const token = `demo-reset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  window.sessionStorage.setItem(RESET_TOKEN_KEY, JSON.stringify({ email: email.trim().toLowerCase(), token }))
  return token
}

export function consumeMockPasswordResetToken(token) {
  try {
    const reset = JSON.parse(window.sessionStorage.getItem(RESET_TOKEN_KEY) || 'null')
    if (!reset || reset.token !== token) return false
    window.sessionStorage.removeItem(RESET_TOKEN_KEY)
    return true
  } catch {
    return false
  }
}

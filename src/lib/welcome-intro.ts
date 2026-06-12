const INTRO_LAST_SEEN_KEY = 'chow-here-intro-last-seen-at'
const INTRO_LAST_LOGOUT_KEY = 'chow-here-intro-last-logout-at'

export const INTRO_LOGOUT_EXPIRY_MS = 60 * 1000

function getNumber(key: string): number | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(key)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getShouldShowWelcomeIntro() {
  if (typeof window === 'undefined') return false

  const lastSeen = getNumber(INTRO_LAST_SEEN_KEY)
  const lastLogout = getNumber(INTRO_LAST_LOGOUT_KEY)
  const now = Date.now()

  if (!lastSeen) return true
  if (lastLogout && now - lastLogout > INTRO_LOGOUT_EXPIRY_MS) return true

  return false
}

export function markWelcomeIntroSeen() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INTRO_LAST_SEEN_KEY, Date.now().toString())
}

export function markWelcomeIntroLogout() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INTRO_LAST_LOGOUT_KEY, Date.now().toString())
}

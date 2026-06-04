// DarkModeToggle — sidebar footer control for admin dark mode.
// design-system-v1.md §18 — admin dark mode only; consumer UI light-only.
// Toggles isDark in useAdminPrefsStore; the admin layout applies
// data-theme="dark" on <html> in response.
// Sun icon (light mode) / Moon icon (dark mode). §Appendix A

'use client'

import { Moon, Sun } from 'lucide-react'
import { useAdminPrefsStore } from '@/stores/admin-prefs.store'
import { cn } from '@/lib/utils'

export function DarkModeToggle() {
  const { isDark, toggleDark } = useAdminPrefsStore()

  return (
    <button
      type="button"
      onClick={toggleDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded',
        'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800',
        'transition-colors duration-[100ms] ease-out',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500',
      )}
    >
      {isDark ? (
        <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  )
}

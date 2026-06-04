// Admin login page — /login
//
// Reached via two paths:
//   1. Middleware redirect from /admin/* when session is absent → /login?callbackUrl=/admin/...
//   2. Direct navigation (e.g., after sign-out)
//
// After successful sign-in, redirects to callbackUrl (must start with /admin) or /admin/queue.
// callbackUrl is validated before use — only /admin/* paths are accepted.
//
// Design tokens: design-system-v1.md §10.1 (Button), §10.2 (Input), §11.2 (Admin card),
//                §17.2 (Inline field error), §10.5 (Wordmark)
// No design decisions in this file are invented — all are cited above.

'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Schema ──────────────────────────────────────────────────

const LoginSchema = z.object({
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
})

type LoginFormValues = z.infer<typeof LoginSchema>

// ─── Input styles — design-system-v1.md §10.2 ────────────────

const inputBase = cn(
  'w-full h-11 px-4 rounded',       // height 44px §10.2, radius-DEFAULT (8px) §5
  'text-base text-neutral-900',     // §10.2 font
  'bg-neutral-0 border',
  'placeholder:text-neutral-400',   // §10.2 placeholder
  'focus:outline-none focus:shadow-brand',  // shadow-brand focus ring §10.2
  'transition-colors duration-[100ms]',     // §7.4 100ms fast transition
)

const inputNormal  = 'border-neutral-200 focus:border-amber-500'         // §10.2 resting / focused
const inputError   = 'border-status-error bg-status-error-bg'             // §10.2 error state

// ─── Form ────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(LoginSchema) })

  async function onSubmit(data: LoginFormValues) {
    setServerError(null)

    const result = await signIn('credentials', {
      email:    data.email,
      password: data.password,
      redirect: false,
    })

    if (!result?.ok) {
      setServerError('Invalid email or password.')
      return
    }

    // Only redirect to /admin/* paths — never bounce to an external URL.
    const raw  = searchParams.get('callbackUrl') ?? ''
    const safe = raw.startsWith('/admin') ? raw : '/admin/queue'
    router.push(safe)
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Wordmark — §10.5 Consumer Top Nav spec (wordmark: Fraunces text-xl amber-500) */}
        <div className="mb-8 text-center">
          <span className="font-display text-xl font-semibold text-amber-500">
            Chow Here
          </span>
          <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wider">
            Admin Portal
          </p>
        </div>

        {/* Card — §11.2: neutral-0 surface, 1px solid neutral-200, radius-lg, no shadow */}
        <div className="bg-neutral-0 border border-neutral-200 rounded-lg p-8">
          <h1 className="text-base font-semibold text-neutral-900 mb-6">
            Sign in to your account
          </h1>

          {/* Server-level error — §17.2 error pattern */}
          {serverError && (
            <div
              role="alert"
              className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded bg-status-error-bg"
            >
              <AlertCircle size={14} className="shrink-0 text-status-error" aria-hidden="true" />
              <p className="text-sm text-status-error">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

            {/* Email — §10.2 */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                Email address
              </label>
              <input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={cn(inputBase, errors.email ? inputError : inputNormal)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="flex items-center gap-1.5 text-sm text-status-error">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password — §10.2 */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                Password
              </label>
              <input
                {...register('password')}
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className={cn(inputBase, errors.password ? inputError : inputNormal)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              {errors.password && (
                <p id="password-error" className="flex items-center gap-1.5 text-sm text-status-error">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit — Primary lg variant, full width — §10.1 */}
            <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
              Sign in
            </Button>

          </form>
        </div>

      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────
// Suspense boundary is required by Next.js 15 when a Client Component
// uses useSearchParams() — it prevents the page from opting out of
// static rendering at the route level.

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

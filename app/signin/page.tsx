// Public sign-in page — /signin
//
// Distinct from /login (admin-only, hardcoded to /admin/* callbackUrls).
// This page is the Track 5 public counterpart: any USER/ADMIN/SUPER session
// can sign in here and be redirected to a same-origin, non-/admin callbackUrl
// or the home page.
//
// Design tokens reused verbatim from app/login/page.tsx (design-system-v1.md
// §10.1 Button, §10.2 Input, §11.2 Card, §17.2 Inline field error, §10.5
// Wordmark) — no new visual decisions introduced, per track-05 §6.
//
// Governed by: track-05-user-accounts.md §4.1, §4.3

'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SignInSchema = z.object({
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
})

type SignInFormValues = z.infer<typeof SignInSchema>

const inputBase = cn(
  'w-full h-11 px-4 rounded',
  'text-base text-neutral-900',
  'bg-neutral-0 border',
  'placeholder:text-neutral-400',
  'focus:outline-none focus:shadow-brand',
  'transition-colors duration-[100ms]',
)

const inputNormal = 'border-neutral-200 focus:border-amber-500'
const inputError  = 'border-status-error bg-status-error-bg'

function SignInForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({ resolver: zodResolver(SignInSchema) })

  async function onSubmit(data: SignInFormValues) {
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

    // Only same-origin, non-/admin paths are honored — /admin/* sign-in
    // continues to go through /login only.
    const raw  = searchParams.get('callbackUrl') ?? ''
    const safe = raw.startsWith('/') && !raw.startsWith('/admin') ? raw : '/'
    router.push(safe)
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <span className="font-display text-xl font-semibold text-amber-500">
            Chow Here
          </span>
        </div>

        <div className="bg-neutral-0 border border-neutral-200 rounded-lg p-8">
          <h1 className="text-base font-semibold text-neutral-900 mb-6">
            Sign in to your account
          </h1>

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

            <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
              Sign in
            </Button>

          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            New to Chow Here?{' '}
            <Link href="/signup" className="font-medium text-amber-600 hover:text-amber-700">
              Create an account
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}

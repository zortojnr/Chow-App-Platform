// Public sign-up page — /signup
//
// Calls POST /api/v1/users/register, then signs the new user in immediately
// (no email verification gate in Phase 1 — track-05-user-accounts.md §8.2)
// and redirects home.
//
// Design tokens reused verbatim from app/login/page.tsx — no new visual
// decisions introduced, per track-05 §6.
//
// Governed by: track-05-user-accounts.md §4.2

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SignUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Please enter your name').max(100),
  email:       z.string().email('Please enter a valid email address'),
  password:    z.string().min(8, 'Password must be at least 8 characters').max(72),
})

type SignUpFormValues = z.infer<typeof SignUpSchema>

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

export default function SignUpPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({ resolver: zodResolver(SignUpSchema) })

  async function onSubmit(data: SignUpFormValues) {
    setServerError(null)

    const res = await fetch('/api/v1/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.status === 409) {
      setServerError('An account with this email already exists.')
      return
    }
    if (res.status === 429) {
      setServerError('Too many attempts — please try again later.')
      return
    }
    if (!res.ok) {
      setServerError('Something went wrong. Please try again.')
      return
    }

    const result = await signIn('credentials', {
      email:    data.email,
      password: data.password,
      redirect: false,
    })

    if (!result?.ok) {
      // Account was created but the immediate sign-in failed — send them to
      // sign in manually rather than leaving them stuck on this form.
      router.push('/signin')
      return
    }

    router.push('/')
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
            Create your account
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
              <label htmlFor="displayName" className="block text-sm font-medium text-neutral-700">
                Name
              </label>
              <input
                {...register('displayName')}
                id="displayName"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                className={cn(inputBase, errors.displayName ? inputError : inputNormal)}
                aria-invalid={!!errors.displayName}
                aria-describedby={errors.displayName ? 'displayName-error' : undefined}
              />
              {errors.displayName && (
                <p id="displayName-error" className="flex items-center gap-1.5 text-sm text-status-error">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.displayName.message}
                </p>
              )}
            </div>

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
                autoComplete="new-password"
                placeholder="At least 8 characters"
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
              Create account
            </Button>

          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link href="/signin" className="font-medium text-amber-600 hover:text-amber-700">
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}

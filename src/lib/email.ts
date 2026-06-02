// Email send abstraction — wraps Resend so no other module touches the SDK directly.
//
// Governed by: backend-standards.md §8.2, §8.3
// Consumed by: features/verification/services/notification.service.ts

import { Resend } from 'resend'

// From address for all transactional email.
// Update when the sending domain is verified in the Resend dashboard.
const FROM_ADDRESS = 'Chow Here <noreply@chowhere.com>'

const globalForResend = globalThis as unknown as { resend: Resend | undefined }

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  if (!globalForResend.resend) {
    globalForResend.resend = new Resend(apiKey)
  }
  return globalForResend.resend
}

/**
 * Sends a transactional email via Resend.
 * Throws on configuration errors (missing API key) or Resend API errors.
 * The caller (notification.service.ts) is responsible for catching and logging failures.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const client = getClient()
  await client.emails.send({ from: FROM_ADDRESS, to, subject, html })
}

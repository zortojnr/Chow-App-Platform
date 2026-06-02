// Notification Service
//
// Dispatches transactional emails at key verification workflow milestones.
// This is a pure dispatch layer — no DB access, no orchestration, no state changes.
//
// All sends are best-effort: errors are caught and logged; the caller's transaction
// is never affected by an email failure.
//
// Governed by: track-02-verification-intelligence.md §3.5, §5.3, §5.4, §5.5, §12 Step 4
// Security:    never logs recipient addresses; never logs tokens or response URLs.
//              backend-standards.md §8.2, §9.1, §9.2

import { render } from '@react-email/render'
import { sendEmail } from '@/lib/email'
import { TOKEN_EXPIRY_DAYS } from './response-token.service'
import { IntakeConfirmationEmail } from '../emails/IntakeConfirmationEmail'
import { NeedsInfoEmail } from '../emails/NeedsInfoEmail'
import { ApprovalEmail } from '../emails/ApprovalEmail'
import { RejectionEmail } from '../emails/RejectionEmail'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type SendIntakeConfirmationParams = {
  /** Recipient email — null/empty → skip silently */
  to: string | null
  restaurantName: string
  /** First 8 characters of the submission UUID shown as reference */
  submissionRef: string
  /** HMAC-signed edit link, 7-day TTL. Valid while status is DRAFT. */
  editLink: string
}

export type SendNeedsInfoParams = {
  to: string | null
  restaurantName: string
  /** Admin-authored feedback for the submitter (never internalNotes) */
  feedbackToSubmitter: string
  /** Raw JWT from response-token.service.ts — notification service constructs the URL */
  responseToken: string
}

export type SendApprovalParams = {
  to: string | null
  restaurantName: string
}

export type SendRejectionParams = {
  to: string | null
  restaurantName: string
  /** Sanitised feedback for the submitter (never internalNotes) */
  feedbackToSubmitter: string
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export const NotificationService = {
  /**
   * Sends the intake confirmation email after a restaurant submission is received.
   * Triggered by: intake.service.ts after DRAFT → PENDING_REVIEW transition.
   */
  async sendIntakeConfirmation(params: SendIntakeConfirmationParams): Promise<void> {
    if (!params.to) return

    try {
      const html = await render(
        IntakeConfirmationEmail({
          restaurantName: params.restaurantName,
          submissionRef: params.submissionRef,
          editLink: params.editLink,
        }),
      )
      await sendEmail(params.to, `Submission received: ${params.restaurantName}`, html)
      log('INFO', 'sendIntakeConfirmation', params.restaurantName)
    } catch (err) {
      log('ERROR', 'sendIntakeConfirmation', params.restaurantName, err)
    }
  },

  /**
   * Sends the needs-info email after an admin requests more information.
   * Triggered by: verification.service.ts after requestInfo() commits.
   * Constructs the response URL internally; the raw token is never logged.
   */
  async sendNeedsInfo(params: SendNeedsInfoParams): Promise<void> {
    if (!params.to) return

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const responseUrl = `${appUrl}/verify/respond?token=${params.responseToken}`
      const deadlineDate = formatDeadline(TOKEN_EXPIRY_DAYS)

      const html = await render(
        NeedsInfoEmail({
          restaurantName: params.restaurantName,
          feedbackToSubmitter: params.feedbackToSubmitter,
          responseUrl,
          deadlineDate,
        }),
      )
      await sendEmail(params.to, `Action required: more information needed for ${params.restaurantName}`, html)
      log('INFO', 'sendNeedsInfo', params.restaurantName)
    } catch (err) {
      log('ERROR', 'sendNeedsInfo', params.restaurantName, err)
    }
  },

  /**
   * Sends the approval email after an admin approves a submission.
   * Triggered by: verification.service.ts after approve() commits.
   */
  async sendApproval(params: SendApprovalParams): Promise<void> {
    if (!params.to) return

    try {
      const html = await render(
        ApprovalEmail({ restaurantName: params.restaurantName }),
      )
      await sendEmail(params.to, `${params.restaurantName} has been approved on Chow Here`, html)
      log('INFO', 'sendApproval', params.restaurantName)
    } catch (err) {
      log('ERROR', 'sendApproval', params.restaurantName, err)
    }
  },

  /**
   * Sends the rejection email after an admin rejects a submission.
   * Only feedbackToSubmitter is included — internalNotes must never be passed here.
   * Triggered by: verification.service.ts after reject() commits.
   */
  async sendRejection(params: SendRejectionParams): Promise<void> {
    if (!params.to) return

    try {
      const html = await render(
        RejectionEmail({
          restaurantName: params.restaurantName,
          feedbackToSubmitter: params.feedbackToSubmitter,
        }),
      )
      await sendEmail(params.to, `Update on your submission for ${params.restaurantName}`, html)
      log('INFO', 'sendRejection', params.restaurantName)
    } catch (err) {
      log('ERROR', 'sendRejection', params.restaurantName, err)
    }
  },
} as const

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Formats the token deadline as a human-readable date.
 * e.g. "15 July 2026"
 */
function formatDeadline(expiryDays: number): string {
  const deadline = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
  return deadline.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Structured log helper.
 * INFO: action + restaurantName only (no PII, no tokens).
 * ERROR: action + restaurantName + error message only (not full stack in production).
 * backend-standards.md §9.1, §9.2
 */
function log(level: 'INFO' | 'ERROR', action: string, restaurantName: string, err?: unknown): void {
  const entry = {
    service: 'NotificationService',
    action,
    restaurantName,
    timestamp: new Date().toISOString(),
  }
  if (level === 'INFO') {
    console.log(JSON.stringify(entry))
  } else {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ ...entry, error: message }))
  }
}

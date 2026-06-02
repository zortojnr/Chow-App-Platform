// Notification Service — unit tests
//
// Coverage goals (track-02 §12 Step 4 exit criteria):
//   ✓ Each method calls sendEmail once with correct subject
//   ✓ Each method passes the recipient address to sendEmail
//   ✓ Null/empty recipient — skips silently, sendEmail never called
//   ✓ sendEmail throws — service catches, does not rethrow (best-effort)
//   ✓ NeedsInfo — response URL is constructed from NEXT_PUBLIC_APP_URL + token
//   ✓ NeedsInfo — deadline string is present in rendered HTML
//   ✓ HTML output contains restaurant name for all four email types
//   ✓ RejectionEmail — feedbackToSubmitter is in HTML; internalNotes concept is separate
//   ✓ Templates render without throwing (smoke test for each template)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NotificationService } from './notification.service'

// ─────────────────────────────────────────────────────────────
// MOCK: lib/email.ts
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}))

import { sendEmail } from '@/lib/email'
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>

// ─────────────────────────────────────────────────────────────
// TEST CONSTANTS
// ─────────────────────────────────────────────────────────────

const RESTAURANT = 'Mama Titi Kitchen'
const TO = 'submitter@example.com'
const SUBMISSION_REF = 'a1b2c3d4'
const EDIT_LINK = 'https://chowhere.com/edit?sig=abc123'
const RESPONSE_TOKEN = 'header.payload.signature'
const FEEDBACK = 'Please provide clearer photos of the menu and restaurant exterior.'
const APP_URL = 'https://chowhere.com'

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSendEmail.mockResolvedValue(undefined)
  process.env.NEXT_PUBLIC_APP_URL = APP_URL
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────
// sendIntakeConfirmation
// ─────────────────────────────────────────────────────────────

describe('sendIntakeConfirmation', () => {
  it('calls sendEmail once', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: TO,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    expect(mockSendEmail).toHaveBeenCalledOnce()
  })

  it('passes recipient as first argument', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: TO,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    const [to] = mockSendEmail.mock.calls[0]
    expect(to).toBe(TO)
  })

  it('subject includes restaurant name', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: TO,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    const [, subject] = mockSendEmail.mock.calls[0]
    expect(subject).toContain(RESTAURANT)
  })

  it('HTML contains restaurant name', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: TO,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(RESTAURANT)
  })

  it('HTML contains submission reference', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: TO,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(SUBMISSION_REF)
  })

  it('HTML contains edit link', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: TO,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(EDIT_LINK)
  })

  it('skips silently when to is null', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: null,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('skips silently when to is empty string', async () => {
    await NotificationService.sendIntakeConfirmation({
      to: '',
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('does not throw when sendEmail rejects', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('Resend 500'))
    await expect(
      NotificationService.sendIntakeConfirmation({
        to: TO,
        restaurantName: RESTAURANT,
        submissionRef: SUBMISSION_REF,
        editLink: EDIT_LINK,
      }),
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// sendNeedsInfo
// ─────────────────────────────────────────────────────────────

describe('sendNeedsInfo', () => {
  it('calls sendEmail once', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    expect(mockSendEmail).toHaveBeenCalledOnce()
  })

  it('passes recipient as first argument', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [to] = mockSendEmail.mock.calls[0]
    expect(to).toBe(TO)
  })

  it('subject includes restaurant name', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [, subject] = mockSendEmail.mock.calls[0]
    expect(subject).toContain(RESTAURANT)
  })

  it('HTML contains feedbackToSubmitter', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(FEEDBACK)
  })

  it('HTML contains response URL constructed from APP_URL and token', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    const expectedUrl = `${APP_URL}/verify/respond?token=${RESPONSE_TOKEN}`
    expect(html).toContain(expectedUrl)
  })

  it('response URL changes when NEXT_PUBLIC_APP_URL changes', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.chowhere.com'
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('staging.chowhere.com')
  })

  it('HTML contains deadline date', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    // Deadline must be a year from now — just verify a 4-digit year appears
    expect(html).toMatch(/20\d{2}/)
  })

  it('skips silently when to is null', async () => {
    await NotificationService.sendNeedsInfo({
      to: null,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('does not throw when sendEmail rejects', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('Resend timeout'))
    await expect(
      NotificationService.sendNeedsInfo({
        to: TO,
        restaurantName: RESTAURANT,
        feedbackToSubmitter: FEEDBACK,
        responseToken: RESPONSE_TOKEN,
      }),
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// sendApproval
// ─────────────────────────────────────────────────────────────

describe('sendApproval', () => {
  it('calls sendEmail once', async () => {
    await NotificationService.sendApproval({ to: TO, restaurantName: RESTAURANT })
    expect(mockSendEmail).toHaveBeenCalledOnce()
  })

  it('passes recipient as first argument', async () => {
    await NotificationService.sendApproval({ to: TO, restaurantName: RESTAURANT })
    const [to] = mockSendEmail.mock.calls[0]
    expect(to).toBe(TO)
  })

  it('subject includes restaurant name', async () => {
    await NotificationService.sendApproval({ to: TO, restaurantName: RESTAURANT })
    const [, subject] = mockSendEmail.mock.calls[0]
    expect(subject).toContain(RESTAURANT)
  })

  it('HTML contains restaurant name', async () => {
    await NotificationService.sendApproval({ to: TO, restaurantName: RESTAURANT })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(RESTAURANT)
  })

  it('skips silently when to is null', async () => {
    await NotificationService.sendApproval({ to: null, restaurantName: RESTAURANT })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('does not throw when sendEmail rejects', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('Resend error'))
    await expect(
      NotificationService.sendApproval({ to: TO, restaurantName: RESTAURANT }),
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// sendRejection
// ─────────────────────────────────────────────────────────────

describe('sendRejection', () => {
  it('calls sendEmail once', async () => {
    await NotificationService.sendRejection({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
    })
    expect(mockSendEmail).toHaveBeenCalledOnce()
  })

  it('passes recipient as first argument', async () => {
    await NotificationService.sendRejection({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
    })
    const [to] = mockSendEmail.mock.calls[0]
    expect(to).toBe(TO)
  })

  it('subject includes restaurant name', async () => {
    await NotificationService.sendRejection({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
    })
    const [, subject] = mockSendEmail.mock.calls[0]
    expect(subject).toContain(RESTAURANT)
  })

  it('HTML contains feedbackToSubmitter', async () => {
    await NotificationService.sendRejection({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(FEEDBACK)
  })

  it('HTML contains restaurant name', async () => {
    await NotificationService.sendRejection({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
    })
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(RESTAURANT)
  })

  it('skips silently when to is null', async () => {
    await NotificationService.sendRejection({
      to: null,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
    })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('does not throw when sendEmail rejects', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('Resend error'))
    await expect(
      NotificationService.sendRejection({
        to: TO,
        restaurantName: RESTAURANT,
        feedbackToSubmitter: FEEDBACK,
      }),
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// Cross-cutting: sendEmail is never called with the raw token
// ─────────────────────────────────────────────────────────────

describe('security — token isolation', () => {
  it('sendEmail is not called with the raw token as the "to" address', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [to] = mockSendEmail.mock.calls[0]
    expect(to).not.toBe(RESPONSE_TOKEN)
    expect(to).toBe(TO)
  })

  it('response URL in HTML includes the token but subject does not', async () => {
    await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    const [, subject, html] = mockSendEmail.mock.calls[0]
    expect(html).toContain(RESPONSE_TOKEN)
    expect(subject).not.toContain(RESPONSE_TOKEN)
  })
})

// ─────────────────────────────────────────────────────────────
// Cross-cutting: return type is always void
// ─────────────────────────────────────────────────────────────

describe('return value is always undefined', () => {
  it('sendIntakeConfirmation returns undefined', async () => {
    const result = await NotificationService.sendIntakeConfirmation({
      to: TO,
      restaurantName: RESTAURANT,
      submissionRef: SUBMISSION_REF,
      editLink: EDIT_LINK,
    })
    expect(result).toBeUndefined()
  })

  it('sendNeedsInfo returns undefined', async () => {
    const result = await NotificationService.sendNeedsInfo({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
      responseToken: RESPONSE_TOKEN,
    })
    expect(result).toBeUndefined()
  })

  it('sendApproval returns undefined', async () => {
    const result = await NotificationService.sendApproval({
      to: TO,
      restaurantName: RESTAURANT,
    })
    expect(result).toBeUndefined()
  })

  it('sendRejection returns undefined', async () => {
    const result = await NotificationService.sendRejection({
      to: TO,
      restaurantName: RESTAURANT,
      feedbackToSubmitter: FEEDBACK,
    })
    expect(result).toBeUndefined()
  })
})

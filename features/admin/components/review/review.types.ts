// Shared TypeScript types for the Step 18 admin review screen.
// These represent the API-serialized shape of QueueService.getDetail() —
// Prisma Decimal fields arrive as strings after JSON serialization.

import type { VerificationStatusValue } from 'features/verification/components/VerificationStatusBadge'

// ─── Score breakdown shapes ────────────────────────────────────

export type StandardBreakdown = {
  overridden?: false
  S1_phoneValid:      number
  S2_verifiedPhoto:   number
  S3_threeDishes:     number
  S4_adminApproved:   number
  S5_description:     number
  S6_detailedAddress: number
  S7_contactChannel:  number
  total:              number
  calculatedAt:       string
  trigger:            string
}

export type OverrideBreakdown = {
  overridden:   true
  overriddenAt: string
  overriddenBy: string
  overrideScore:  number
  overrideReason: string
  lastComputedBreakdown: {
    S1_phoneValid:      number
    S2_verifiedPhoto:   number
    S3_threeDishes:     number
    S4_adminApproved:   number
    S5_description:     number
    S6_detailedAddress: number
    S7_contactChannel:  number
    total:              number
  }
}

export type ScoreBreakdown = StandardBreakdown | OverrideBreakdown

// ─── Entity shapes ─────────────────────────────────────────────

export type ReviewDish = {
  id:                 string
  nameAsServed:       string | null
  description:        string | null
  price:              string | null  // Prisma Decimal → string after JSON
  availabilityStatus: string
  verifiedAt:         string | null
  createdAt:          string
  dish: {
    canonicalName: string
    category:      string
  }
}

export type ReviewPhoto = {
  id:        string
  url:       string
  caption:   string | null
  isPrimary: boolean
  isVerified: boolean
  createdAt: string
}

export type ReviewEvent = {
  id:         string
  fromStatus: VerificationStatusValue | null
  toStatus:   VerificationStatusValue
  reason:     string | null
  actorId:    string
  actorRole:  string
  ipAddress:  string
  createdAt:  string
}

export type ReviewVerificationRecord = {
  id:                 string
  currentStatus:      VerificationStatusValue
  confidenceScore:    string   // Decimal → string
  scoreBreakdown:     ScoreBreakdown
  internalNotes:      string | null
  feedbackToSubmitter: string | null
  submitterEmail:     string | null
  assignedTo:         string | null
  events:             ReviewEvent[]
}

export type ReviewDetail = {
  id:                string
  name:              string
  slug:              string
  description:       string | null
  address:           string
  city:              string
  state:             string
  area:              string | null
  phone:             string
  email:             string | null
  website:           string | null
  priceRange:        'BUDGET' | 'MID' | 'UPSCALE'
  cuisineTypes:      string[]
  verificationStatus: VerificationStatusValue
  confidenceScore:   string
  createdAt:         string

  verification: ReviewVerificationRecord
  dishes:       ReviewDish[]
  photos:       ReviewPhoto[]
}

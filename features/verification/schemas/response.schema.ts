// Zod schema for the submitter response request body.
//
// Validates the body of:
//   POST /api/v1/verification/respond/[token]
//
// Constraints:
//   responseText       — min 1 (empty response is not a valid response)
//                        max 5000 (generous; allows detailed replies)
//   additionalPhotoIds — max 5 (matches intake photo ceiling); defaults to []
//                        each entry is a Cloudinary public ID string
//
// Governed by: track-02-verification-intelligence.md §9.2
//              backend-standards.md §4.2

import { z } from 'zod'

export const SubmitterResponseSchema = z.object({
  responseText: z
    .string()
    .trim()
    .min(1, 'Response text is required')
    .max(5000, 'Response text must not exceed 5000 characters'),

  additionalPhotoIds: z
    .array(z.string().min(1).max(500))
    .max(5, 'A maximum of 5 additional photos may be attached')
    .optional()
    .default([]),
})

export type SubmitterResponseInput = z.infer<typeof SubmitterResponseSchema>

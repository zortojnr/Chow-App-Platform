// POST /api/v1/intake/photos
//
// Accepts a single photo upload (JPEG or PNG, ≤ 5MB). Anonymous allowed.
// Validation chain: Content-Length → buffer size → magic bytes → EXIF strip → Cloudinary.
// Returns the Cloudinary publicId and thumbnail URL. The publicId is stored in the
// client's form state and submitted as part of the restaurant intake payload.
//
// Governed by: restaurant-intake-track.md §4, backend-standards.md §8.1
//              security-standards.md §5.1–5.5

import { type NextRequest } from 'next/server'
import sharp from 'sharp'
import { uploadPhoto } from '@/lib/cloudinary'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  successResponse,
  errorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const MAX_SIZE = 5 * 1024 * 1024  // 5 MB
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000  // 24 hours

// Magic bytes — security-standards.md §5.2
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])
const PNG_MAGIC  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function extractIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    '127.0.0.1'
  )
}

function detectMimeType(buf: Buffer): 'image/jpeg' | 'image/png' | null {
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_MAGIC)) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC))  return 'image/png'
  return null
}

function cloudinaryFolder(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `chowhere/intake/${now.getFullYear()}/${month}`
}

export async function POST(request: NextRequest) {
  try {
    const ip = extractIp(request)

    // 1. Rate limit — first, before reading the body
    const rl = await checkRateLimit(`photo_upload:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    // 2. Content-Length pre-flight — reject before reading if header says too large
    const contentLength = request.headers.get('content-length')
    if (contentLength !== null && Number(contentLength) > MAX_SIZE) {
      return errorResponse('FILE_TOO_LARGE', 'File must not exceed 5MB', 400)
    }

    // 3. Read form data and extract file
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return errorResponse('VALIDATION_ERROR', 'A file field named "file" is required', 400)
    }

    // 4. Buffer size enforcement (authoritative — Content-Length may be absent)
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > MAX_SIZE) {
      return errorResponse('FILE_TOO_LARGE', 'File must not exceed 5MB', 400)
    }

    // 5. Magic bytes check — do not trust the Content-Type header
    const mimeType = detectMimeType(buffer)
    if (!mimeType) {
      return errorResponse('UNSUPPORTED_FILE_TYPE', 'Only JPEG and PNG files are accepted', 400)
    }

    // 6. EXIF strip and normalise via sharp — security-standards.md §5.4
    let stripped: Buffer
    try {
      stripped = await sharp(buffer)
        .rotate()            // apply EXIF orientation before stripping
        .withMetadata({})    // strip all EXIF including GPS coordinates
        .jpeg({ quality: 85, progressive: true })
        .toBuffer()
    } catch {
      return errorResponse('INVALID_FILE', 'File could not be processed as an image', 400)
    }

    // 7. Upload to Cloudinary via lib abstraction — backend-standards.md §8.1
    const result = await uploadPhoto(stripped, cloudinaryFolder())

    return successResponse({
      publicId:     result.publicId,
      width:        result.width,
      height:       result.height,
      thumbnailUrl: result.thumbnailUrl,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

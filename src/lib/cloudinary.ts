// Cloudinary upload abstraction — backend-standards.md §8.1, security-standards.md §5.5
//
// Rules:
//   - All Cloudinary operations go through this module. No other file imports the SDK.
//   - Credentials are server-side only. Never returned to callers.
//   - uploadPhoto accepts a pre-processed buffer (EXIF already stripped by the route handler).
//   - buildCloudinaryUrl is used by intake.service.ts to convert publicIds to CDN URLs.
//
// Governed by: restaurant-intake-track.md §4.3, track-02 §7.5

import { v2 as cloudinary } from 'cloudinary'

export type CloudinaryUploadResult = {
  publicId: string
  width: number
  height: number
  thumbnailUrl: string
}

function configure(): void {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
  })
}

/**
 * Converts a Cloudinary public ID to a CDN delivery URL.
 * Does not require network access — pure string construction.
 */
export function buildCloudinaryUrl(publicId: string): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME is not configured')
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`
}

/**
 * Builds a thumbnail URL using Cloudinary's transformation API.
 */
function buildThumbnailUrl(publicId: string, cloudName: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,w_400,h_400/${publicId}`
}

/**
 * Uploads a pre-processed image buffer to Cloudinary.
 * The buffer must have EXIF metadata already stripped (security-standards.md §5.4).
 * Used by the photo upload route handler — not by intake.service.ts directly.
 *
 * @param buffer  EXIF-stripped image buffer
 * @param folder  Cloudinary folder path, e.g. "chowhere/intake/2026/06"
 */
export async function uploadPhoto(
  buffer: Buffer,
  folder: string,
): Promise<CloudinaryUploadResult> {
  configure()

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME is not configured')

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload returned no result'))
        resolve({
          publicId:     result.public_id,
          width:        result.width,
          height:       result.height,
          thumbnailUrl: buildThumbnailUrl(result.public_id, cloudName),
        })
      },
    )
    stream.end(buffer)
  })
}

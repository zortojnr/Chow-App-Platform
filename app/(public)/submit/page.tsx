import type { Metadata } from 'next'
import { SubmitPageClient } from './SubmitPageClient'

export const metadata: Metadata = {
  title:       'Submit a Restaurant — Chow Here',
  description: 'Know a great Nigerian restaurant in Abuja? Submit it and our team will verify and list it on Chow Here.',
  robots:      { index: true, follow: true },
}

export default function SubmitPage() {
  return <SubmitPageClient />
}

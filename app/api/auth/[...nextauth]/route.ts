// NextAuth catch-all handler — wires authOptions into the App Router.
// GET handles session checks and OAuth redirects.
// POST handles credential sign-in and sign-out.
// Governed by: security-standards.md §1.1, admin-platform-track.md §2.3

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

// NextAuth type augmentation — adds id and role to Session and JWT.
// Governed by: security-standards.md §1.3
import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface User {
    role: UserRole
  }

  interface Session {
    user: {
      id: string
      role: UserRole
      email: string
      name?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
  }
}

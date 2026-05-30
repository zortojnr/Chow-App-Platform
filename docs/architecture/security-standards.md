# Chow Here — Security Standards

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Document:** master-architecture.md

---

## 0. PURPOSE

This document defines the security architecture and enforcement standards for the Chow Here platform. Security is not a layer added after development — it is a property baked into every system, schema, and API from the start.

The trust guarantee of Chow Here depends on the integrity and security of the platform. A breach, data leak, or privilege escalation is not just a technical failure — it is a product failure.

**All engineers are responsible for security. It is not solely a DevOps or "later" concern.**

---

## 1. AUTHENTICATION ARCHITECTURE

### 1.1 Authentication Provider

Phase 1 uses **NextAuth.js v4** with:
- Email/password credentials provider (primary)
- JWT sessions stored as encrypted cookies

**Session strategy:** JWT (not database sessions). Sessions are short-lived and refreshed on activity.

```typescript
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' }
      },
      async authorize(credentials) {
        // Validate credentials, return user or null
        // See Section 2 for password handling
      }
    })
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },  // 24 hours
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as UserRole
      return session
    }
  }
}
```

### 1.2 Session Security

- Sessions expire after 24 hours of inactivity
- Session tokens are `httpOnly`, `secure`, `sameSite=strict` cookies
- Session secret (`NEXTAUTH_SECRET`) is a minimum 32-byte random value
- Session secret must never be committed to source control

### 1.3 What Is In The Session

The session token contains **only**:
- `id`: User UUID
- `role`: UserRole enum value
- `email`: User email (for display only)

**Never put sensitive data in the session token.** The JWT is readable by the client even if it cannot be tampered with.

---

## 2. PASSWORD SECURITY

### 2.1 Password Hashing

All passwords are hashed with **bcrypt** at a cost factor of **12**.

```typescript
// lib/auth.ts
import bcrypt from 'bcryptjs'

const BCRYPT_COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed)
}
```

**Never:**
- Store plaintext passwords
- Use MD5, SHA1, or SHA256 for password hashing
- Log passwords at any level
- Return password hashes in API responses

### 2.2 Password Requirements

Passwords are validated at registration:

```typescript
export const PasswordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .max(128, 'Maximum 128 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
```

Password validation happens at the API boundary using this schema. The same schema is shared between client (real-time feedback) and server (authoritative check).

### 2.3 Timing-Safe Comparison

Password comparison uses bcrypt's built-in timing-safe comparison. Never compare hashed passwords using `===` or string equality operators.

---

## 3. AUTHORIZATION AND RBAC

### 3.1 Role Definitions

```typescript
// types/index.ts
export enum UserRole {
  USER = 'USER',       // Regular authenticated user
  ADMIN = 'ADMIN',     // Internal team: verifies restaurants
  SUPER = 'SUPER',     // Platform owner: full system access
}
```

Phase 1 has three roles only. Do not add roles speculatively.

### 3.2 Route Authorization Matrix

| Route Pattern | Guest | USER | ADMIN | SUPER |
|---|---|---|---|---|
| `GET /api/v1/restaurants` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/restaurants/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/v1/restaurants` (intake) | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/search` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/v1/users/saved` | ❌ | ✅ | ✅ | ✅ |
| `GET /api/v1/users/history` | ❌ | ✅ | ✅ | ✅ |
| `GET /api/v1/admin/*` | ❌ | ❌ | ✅ | ✅ |
| `POST /api/v1/admin/*/approve` | ❌ | ❌ | ✅ | ✅ |
| `DELETE /api/v1/admin/*` | ❌ | ❌ | ❌ | ✅ |

Restaurant intake (submission) is intentionally public — no account required to submit a restaurant for review. A verified account is required to interact with saved dishes and food history.

### 3.3 Authorization Enforcement Rules

**Rule 1: Double-check in route handlers.**

Middleware guards routes at the path level. But route handlers must also check authorization. Defense in depth.

```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return errorResponse('UNAUTHORIZED', '...', 401)

  // Do not trust the role from the request body — trust only the session
  requireRole(session, UserRole.ADMIN)  // throws ForbiddenError if wrong role
  // ...
}
```

**Rule 2: Ownership checks are explicit.**

For any mutation on a user-owned resource (saved dishes, profile), the route handler must verify that `session.user.id === resource.userId`.

```typescript
const savedDish = await SavedDishService.findById(id)
if (!savedDish) throw new NotFoundError('Saved dish')
if (savedDish.userId !== session.user.id) throw new ForbiddenError()
```

**Rule 3: Never trust client-supplied user IDs.**

The user's ID for ownership operations always comes from `session.user.id`. Never from the request body, query string, or headers.

### 3.4 Admin Route Protection (Next.js Middleware)

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    const session = getSessionFromToken(request)
    if (!session || !['ADMIN', 'SUPER'].includes(session.role)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  // ...
}
```

Middleware is the first gate. Route handler authorization is the second gate. Both must be present for admin routes.

---

## 4. INPUT VALIDATION SECURITY

### 4.1 Validation is a Security Control

Input validation is not just about user experience — it is a security boundary. Malformed input that reaches the database or external services is an attack vector.

**Validation must happen at every boundary:**
- Client (UX feedback, not security)
- API route handler (authoritative security check using Zod)
- Service layer (type safety — input is already validated)
- Database (constraints as last-resort backstop)

### 4.2 Injection Prevention

Prisma parameterizes all queries automatically. Never use raw SQL (`$queryRaw`) with string interpolation:

```typescript
// FORBIDDEN
const results = await db.$queryRaw`SELECT * FROM restaurants WHERE name = '${name}'`

// CORRECT — Prisma handles parameterization
const results = await db.restaurant.findMany({ where: { name } })

// If raw SQL is required, use Prisma.sql template:
const results = await db.$queryRaw(
  Prisma.sql`SELECT * FROM restaurants WHERE name = ${name}`
)
```

### 4.3 String Sanitization Policy

- All string inputs are `.trim()`-ed in Zod schemas
- HTML is never rendered from user-supplied content without sanitization
- If rich text is needed in future phases, use DOMPurify server-side
- Restaurant names, dish names, and addresses are stored as plain text — no markdown, no HTML
- Never use `dangerouslySetInnerHTML` with user-supplied content

### 4.4 Path Traversal Prevention

File operations (if any) must never accept user-supplied paths. All file paths must be constructed from allowlisted patterns server-side.

---

## 5. FILE UPLOAD SECURITY

### 5.1 Upload Validation Chain

Every file upload goes through this validation chain before being sent to Cloudinary:

```
Client selects file
  → Client validates: size < 5MB, type is image/*  (UX, not security)
  → POST /api/v1/upload
  → Server: check Content-Length header ≤ 5MB
  → Server: read first 8 bytes, check magic bytes for JPEG/PNG/WebP
  → Server: strip EXIF metadata
  → Server: upload to Cloudinary (not stored locally)
  → Server: return CDN URL only
```

### 5.2 Accepted File Types

| Format | Magic Bytes |
|---|---|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| WebP | `52 49 46 46 ... 57 45 42 50` |

Any file that does not match these magic bytes is rejected, regardless of the MIME type in the Content-Type header.

### 5.3 File Size Limits

| Resource | Max Size |
|---|---|
| Restaurant thumbnail | 5MB |
| Dish photo | 5MB |
| Admin evidence uploads | 10MB |

Files exceeding these limits are rejected at the server before being forwarded to Cloudinary.

### 5.4 EXIF Stripping

All uploaded images must have EXIF metadata stripped before storage. EXIF data can contain GPS coordinates (user location) and device identifiers. Use the `sharp` library:

```typescript
import sharp from 'sharp'

async function stripExifAndOptimize(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()          // Auto-rotate based on EXIF orientation (before stripping)
    .withMetadata({})  // Strip all EXIF
    .jpeg({ quality: 85, progressive: true })
    .toBuffer()
}
```

### 5.5 Cloudinary Security

- Cloudinary API secrets are server-side only — never in client bundles
- Upload presets are restricted to specific folders per resource type
- Direct unsigned uploads from the client are forbidden — all uploads go through the server
- Cloudinary moderation API is used for obvious inappropriate content (Phase 1: basic check only)

---

## 6. API SECURITY

### 6.1 CORS Policy

Next.js API routes do not need explicit CORS headers for same-origin requests. If cross-origin API access is needed in future, it will be explicitly configured — no open CORS policy is permitted.

### 6.1a CSRF Defense Model

Chow Here does not use CSRF tokens. CSRF protection is provided by two complementary controls:

1. **`SameSite=Strict` cookies** — session cookies are configured as `sameSite: 'strict'` (defined in §1.2), which prevents cross-site requests from carrying session credentials in modern browsers.
2. **`Content-Type: application/json` requirement** — all mutation endpoints require a JSON body. Cross-origin HTML form submissions cannot set this header, blocking the most common CSRF vector.

These two controls together are sufficient for Phase 1. No additional CSRF token infrastructure is required.

### 6.2 Rate Limiting

See `backend-standards.md`, Section 7. Rate limiting is a security control, not just a cost control. Enforced via Next.js middleware.

### 6.3 Security Headers

The following security headers must be set on all responses via `next.config.ts`:

```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // Required for Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' res.cloudinary.com data:",
      "connect-src 'self'",
    ].join('; ')
  }
]
```

### 6.4 Request Size Limits

All API routes enforce a maximum request body size of 1MB for JSON payloads. File uploads have their own size limits (see Section 5).

---

## 7. DATA SECURITY

### 7.1 PII Definition

The following user data is treated as PII:
- Email address
- Phone number (if collected)
- IP address (for rate limiting — not stored persistently)
- Location data

### 7.2 PII Handling Rules

- PII is never logged in production (see `backend-standards.md`, Section 9.2)
- Email addresses are stored but never returned in public API responses
- User profiles returned from public-facing endpoints contain only: username, avatar, and join date
- PII is not included in error messages returned to clients

### 7.3 Data Minimization

Collect only the data required for the feature. The restaurant intake form does not collect the submitter's name unless a verification callback is needed. Always ask: "Do we actually need this field?"

### 7.4 Soft Deletes and Right to Erasure

User account deletion triggers:
1. Account marked `deletedAt = now()`
2. Email address anonymized: `deleted_[uuid]@chowhere.invalid`
3. Saved dishes and history anonymized (records kept for analytics, user reference removed)
4. Authentication sessions invalidated

Restaurant submissions and verification records are retained for audit purposes even if a user account is deleted.

---

## 8. ENVIRONMENT SECURITY

### 8.1 Secret Management Rules

| Rule | Requirement |
|---|---|
| No secrets in source control | Enforced by `.gitignore` and git hooks |
| No secrets in client bundles | All secrets must be server-only (no `NEXT_PUBLIC_` prefix for secrets) |
| Secrets rotation | All secrets must be rotatable without downtime |
| `.env.example` | Committed with key names, no values |
| Production secrets | Only in Vercel environment variables (encrypted at rest) |

### 8.2 Environment Variable Naming

Variables prefixed with `NEXT_PUBLIC_` are embedded in the browser JavaScript bundle. This prefix must **never** be used for:
- Database URLs
- API secrets
- Authentication secrets
- Service credentials

`NEXT_PUBLIC_` is only for:
- Public app URL
- Environment tier (`development`, `staging`, `production`)
- Public Cloudinary cloud name

### 8.3 Secret Validation on Startup

The application must fail to start if required secrets are missing:

```typescript
// lib/env.ts
const requiredEnv = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'CLOUDINARY_API_SECRET', 'RESEND_API_KEY']

export function validateEnv() {
  const missing = requiredEnv.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
```

This runs at application startup in `lib/env.ts`, imported in the root layout.

---

## 9. VERIFICATION SYSTEM SECURITY

The verification workflow is a security-sensitive system. Rules specific to it:

### 9.1 State Machine Integrity

The `verificationStatus` field on a restaurant record may only be changed by `VerificationService`. No other module may directly update this field via Prisma. Any attempt to update `verificationStatus` outside `VerificationService` is a security violation.

Enforcement: A Prisma middleware hook throws an error if `verificationStatus` is updated outside the verification module.

### 9.2 Admin Action Audit Trail

Every admin action on the verification workflow is logged to the `VerificationEvent` table:

```
VerificationEvent {
  id
  restaurantId
  adminUserId
  fromStatus
  toStatus
  reason
  ipAddress     // Admin's IP at time of action
  createdAt
}
```

This log is append-only. Deletion of verification events is forbidden.

### 9.3 Confidence Score Manipulation

Confidence scores are calculated by the system. They cannot be manually overridden by admins except through a SUPER-role override that creates an explicit audit trail.

---

## 10. SECURITY REVIEW REQUIREMENTS

Before any of the following is deployed to production, a security review must be completed by a second engineer:

- Any change to the authentication flow
- Any new admin endpoint
- Any change to the verification state machine
- Any new file upload handler
- Any change to role definitions or the authorization matrix
- Any raw SQL query addition

Security review means a second pair of eyes confirms:
1. Authentication is checked
2. Authorization is correct
3. Input is validated
4. No PII is leaked
5. No secrets are exposed

---

*Governed by master-architecture.md. All conflicts resolved by that document.*

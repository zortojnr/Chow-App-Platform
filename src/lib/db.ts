// Prisma client — two exports, both required.
//
// `db`                — use everywhere in the application.
//                       Has soft-delete filtering AND verificationStatus write guard.
//
// `dbForVerification` — use ONLY in features/verification/services/verification.service.ts
//                       Has soft-delete filtering. NO verificationStatus guard.
//                       Required because VerificationService is the one authorized writer.
//
// Governed by: backend-standards.md §3.1, security-standards.md §9.1, database-track.md §8.1

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

// ─────────────────────────────────────────────────────────────
// LAYER 1: Soft-delete filtering
//
// Automatically injects `deletedAt: null` into findMany and findFirst
// for Restaurant, RestaurantDish, and User.
//
// Limitation: findUnique is NOT intercepted — Prisma's extension API does not
// support intercepting findUnique with where-clause injection. Service functions
// must use findFirst (with soft-delete filter) instead of findUnique for these
// three models. See database-track.md §8.1 for the documented workaround.
// ─────────────────────────────────────────────────────────────
const withSoftDelete = basePrisma.$extends({
  query: {
    restaurant: {
      findMany({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      findFirst({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
    restaurantDish: {
      findMany({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      findFirst({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
    user: {
      findMany({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      findFirst({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────
// LAYER 2: verificationStatus write guard
//
// Blocks any direct update to Restaurant.verificationStatus.
// Only VerificationService (via dbForVerification) is authorized.
//
// Known gaps:
//   - upsert is not intercepted (not used for restaurants in this architecture)
//   - $executeRaw / $queryRaw bypass all extensions (require human review)
//   - Transaction clients inherit the parent's extensions: VerificationService
//     must use dbForVerification.$transaction(...), not db.$transaction(...)
// ─────────────────────────────────────────────────────────────
const VERIFICATION_STATUS_GUARD_ERROR =
  "[db] Direct update of verificationStatus is forbidden. " +
  "Only VerificationService may change this field. " +
  "Use dbForVerification, imported only in " +
  "features/verification/services/verification.service.ts";

export const db = withSoftDelete.$extends({
  query: {
    restaurant: {
      update({ args, query }) {
        if (args.data && "verificationStatus" in args.data) {
          throw new Error(VERIFICATION_STATUS_GUARD_ERROR);
        }
        return query(args);
      },
      updateMany({ args, query }) {
        if (args.data && "verificationStatus" in args.data) {
          throw new Error(VERIFICATION_STATUS_GUARD_ERROR);
        }
        return query(args);
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────
// VERIFICATION-ONLY CLIENT
//
// Has soft-delete filtering. Does NOT have the verificationStatus guard.
// IMPORT ONLY IN: features/verification/services/verification.service.ts
//
// All transactions that write verificationStatus must use:
//   dbForVerification.$transaction(async (tx) => { ... })
// ─────────────────────────────────────────────────────────────
export const dbForVerification = withSoftDelete;

export type ExtendedPrismaClient = typeof db;

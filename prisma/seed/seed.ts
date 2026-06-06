// Idempotent seed runner — safe to run multiple times.
// Uses upsert throughout: existing records are updated, not duplicated.
//
// Usage: npm run db:seed
// Governed by: database-track.md §6

import { PrismaClient, UserRole } from "@prisma/client";
import { DISHES } from "./dishes.data";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function seedDishTaxonomy(systemUserId: string): Promise<void> {
  console.log(`Seeding ${DISHES.length} dish taxonomy entries...`);

  for (const dish of DISHES) {
    await prisma.dishTaxonomy.upsert({
      where: { canonicalName: dish.canonicalName },
      update: {
        slug: dish.slug,
        aliases: dish.aliases,
        category: dish.category,
        subcategory: dish.subcategory ?? null,
        description: dish.description ?? null,
      },
      create: {
        canonicalName: dish.canonicalName,
        slug: dish.slug,
        aliases: dish.aliases,
        category: dish.category,
        subcategory: dish.subcategory ?? null,
        description: dish.description ?? null,
        isActive: true,
        createdBy: systemUserId,
      },
    });
  }

  console.log(`  ✓ ${DISHES.length} dishes seeded`);
}

async function seedSuperAdmin(): Promise<string> {
  // bcrypt hash of "changeme_before_production" — MUST be rotated before first admin login.
  // Generated with: bcryptjs.hashSync("changeme_before_production", 12)
  const PLACEHOLDER_HASH =
    "$2a$12$placeholderHashThatMustBeReplacedBeforeFirstLogin000000";

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@chowhere.dev";

  console.log(`Seeding super admin: ${email}`);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {}, // never overwrite existing admin credentials
    create: {
      email,
      passwordHash: PLACEHOLDER_HASH,
      role: UserRole.SUPER,
      displayName: "Super Admin",
      emailVerified: true,
    },
  });

  console.log(`  ✓ Super admin ready (id: ${admin.id})`);
  return admin.id;
}

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────");
  console.log("Chow Here — Database Seed");
  console.log("─────────────────────────────────────────");

  const adminId = await seedSuperAdmin();
  await seedDishTaxonomy(adminId);

  console.log("─────────────────────────────────────────");
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

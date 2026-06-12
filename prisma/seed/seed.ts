// Idempotent seed runner — safe to run multiple times.
// Uses upsert throughout: existing records are updated, not duplicated.
//
// Usage: npm run db:seed
// Governed by: database-track.md §6

import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  DishAvailabilityStatus,
} from "@prisma/client";
import { DISHES } from "./dishes.data";
import { RESTAURANTS, RestaurantSeedEntry } from "./restaurants.data";

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

function computeConfidenceScore(r: RestaurantSeedEntry): number {
  let score = 0.20; // address always present
  if (r.phone) score += 0.20;
  if (r.description) score += 0.15;
  if (r.cuisineTypes.length > 0) score += 0.10;
  if (r.dishes.length > 0) score += 0.10;
  score += 0.05; // internal dataset bonus
  return Math.round(score * 1000) / 1000;
}

function buildScoreBreakdown(r: RestaurantSeedEntry) {
  return {
    address: 0.20,
    phone: r.phone ? 0.20 : 0,
    description: r.description ? 0.15 : 0,
    cuisine: r.cuisineTypes.length > 0 ? 0.10 : 0,
    dishes: r.dishes.length > 0 ? 0.10 : 0,
    manual_import: 0.05,
  };
}

async function seedRestaurants(adminId: string): Promise<void> {
  console.log(`Seeding ${RESTAURANTS.length} restaurants...`);

  for (const r of RESTAURANTS) {
    const score = computeConfidenceScore(r);

    const restaurant = await prisma.restaurant.upsert({
      where: { slug: r.slug },
      update: {
        name: r.name,
        description: r.description ?? null,
        address: r.address,
        area: r.area ?? null,
        city: r.city,
        state: r.state,
        phone: r.phone ?? null,
        priceRange: r.priceRange,
        cuisineTypes: r.cuisineTypes,
        verificationStatus: VerificationStatus.APPROVED,
        confidenceScore: score,
        source: "internal_dataset",
      },
      create: {
        name: r.name,
        slug: r.slug,
        description: r.description ?? null,
        address: r.address,
        area: r.area ?? null,
        city: r.city,
        state: r.state,
        phone: r.phone ?? null,
        priceRange: r.priceRange,
        cuisineTypes: r.cuisineTypes,
        verificationStatus: VerificationStatus.APPROVED,
        confidenceScore: score,
        source: "internal_dataset",
      },
    });

    const record = await prisma.verificationRecord.upsert({
      where: { restaurantId: restaurant.id },
      update: {
        currentStatus: VerificationStatus.APPROVED,
        confidenceScore: score,
        scoreBreakdown: buildScoreBreakdown(r),
      },
      create: {
        restaurantId: restaurant.id,
        currentStatus: VerificationStatus.APPROVED,
        confidenceScore: score,
        scoreBreakdown: buildScoreBreakdown(r),
      },
    });

    const existingApproval = await prisma.verificationEvent.findFirst({
      where: { restaurantId: restaurant.id, toStatus: VerificationStatus.APPROVED },
    });
    if (!existingApproval) {
      await prisma.verificationEvent.create({
        data: {
          verificationRecordId: record.id,
          restaurantId: restaurant.id,
          toStatus: VerificationStatus.APPROVED,
          reason: "Approved via internal dataset seed",
          actorId: adminId,
          actorRole: UserRole.SUPER,
          ipAddress: "127.0.0.1",
        },
      });
    }

    for (const d of r.dishes) {
      const taxonomy = await prisma.dishTaxonomy.findFirst({
        where: { canonicalName: d.canonicalName },
      });
      if (!taxonomy) {
        console.warn(`    ⚠ Dish not in taxonomy: "${d.canonicalName}" — skipped`);
        continue;
      }
      await prisma.restaurantDish.upsert({
        where: {
          restaurantId_dishId: { restaurantId: restaurant.id, dishId: taxonomy.id },
        },
        update: {
          nameAsServed: d.nameAsServed ?? null,
          price: d.price ?? null,
          availabilityStatus: DishAvailabilityStatus.ALWAYS_AVAILABLE,
        },
        create: {
          restaurantId: restaurant.id,
          dishId: taxonomy.id,
          nameAsServed: d.nameAsServed ?? null,
          price: d.price ?? null,
          availabilityStatus: DishAvailabilityStatus.ALWAYS_AVAILABLE,
        },
      });
    }

    console.log(`  ✓ ${r.name}`);
  }

  console.log(`  ✓ ${RESTAURANTS.length} restaurants seeded`);
}

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────");
  console.log("Chow Here — Database Seed");
  console.log("─────────────────────────────────────────");

  const adminId = await seedSuperAdmin();
  await seedDishTaxonomy(adminId);
  await seedRestaurants(adminId);

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

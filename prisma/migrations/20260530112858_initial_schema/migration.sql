-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DishCategory" AS ENUM ('RICE_DISHES', 'SOUPS', 'SWALLOW', 'PROTEIN', 'STREET_FOOD', 'DRINKS', 'SNACKS', 'BREAKFAST', 'DESSERTS');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PriceRange" AS ENUM ('BUDGET', 'MID', 'UPSCALE');

-- CreateEnum
CREATE TYPE "DishAvailabilityStatus" AS ENUM ('ALWAYS_AVAILABLE', 'SEASONAL', 'WEEKEND_ONLY', 'ON_ORDER', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "displayName" VARCHAR(100),
    "avatarUrl" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishTaxonomy" (
    "id" TEXT NOT NULL,
    "canonicalName" VARCHAR(150) NOT NULL,
    "aliases" TEXT[],
    "category" "DishCategory" NOT NULL,
    "subcategory" VARCHAR(100),
    "description" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" tsvector,

    CONSTRAINT "DishTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "address" VARCHAR(300) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "area" VARCHAR(100),
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "website" VARCHAR(300),
    "priceRange" "PriceRange" NOT NULL,
    "cuisineTypes" TEXT[],
    "thumbnailUrl" TEXT,
    "thumbnailBlurHash" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "confidenceScore" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "submittedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" tsvector,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantDish" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "nameAsServed" VARCHAR(150),
    "description" VARCHAR(300),
    "price" DECIMAL(10,2),
    "availabilityStatus" "DishAvailabilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "verifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantDish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantPhoto" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" VARCHAR(200),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "currentStatus" "VerificationStatus" NOT NULL,
    "confidenceScore" DECIMAL(4,3) NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "submitterEmail" VARCHAR(150),
    "internalNotes" TEXT,
    "feedbackToSubmitter" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL,
    "verificationRecordId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "fromStatus" "VerificationStatus",
    "toStatus" "VerificationStatus" NOT NULL,
    "reason" VARCHAR(500),
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "ipAddress" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedDish" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantDishId" TEXT NOT NULL,
    "notes" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedDish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" VARCHAR(200) NOT NULL,
    "location" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "query" VARCHAR(200) NOT NULL,
    "location" VARCHAR(100),
    "resultCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedVerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DishTaxonomy_canonicalName_key" ON "DishTaxonomy"("canonicalName");

-- CreateIndex
CREATE INDEX "DishTaxonomy_isActive_idx" ON "DishTaxonomy"("isActive");

-- CreateIndex
CREATE INDEX "DishTaxonomy_category_idx" ON "DishTaxonomy"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Restaurant_verificationStatus_idx" ON "Restaurant"("verificationStatus");

-- CreateIndex
CREATE INDEX "Restaurant_city_idx" ON "Restaurant"("city");

-- CreateIndex
CREATE INDEX "Restaurant_deletedAt_idx" ON "Restaurant"("deletedAt");

-- CreateIndex
CREATE INDEX "Restaurant_confidenceScore_idx" ON "Restaurant"("confidenceScore");

-- CreateIndex
CREATE INDEX "RestaurantDish_restaurantId_idx" ON "RestaurantDish"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantDish_dishId_idx" ON "RestaurantDish"("dishId");

-- CreateIndex
CREATE INDEX "RestaurantDish_availabilityStatus_idx" ON "RestaurantDish"("availabilityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantDish_restaurantId_dishId_key" ON "RestaurantDish"("restaurantId", "dishId");

-- CreateIndex
CREATE INDEX "RestaurantPhoto_restaurantId_idx" ON "RestaurantPhoto"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRecord_restaurantId_key" ON "VerificationRecord"("restaurantId");

-- CreateIndex
CREATE INDEX "VerificationRecord_currentStatus_createdAt_idx" ON "VerificationRecord"("currentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationRecord_assignedTo_idx" ON "VerificationRecord"("assignedTo");

-- CreateIndex
CREATE INDEX "VerificationEvent_restaurantId_idx" ON "VerificationEvent"("restaurantId");

-- CreateIndex
CREATE INDEX "VerificationEvent_verificationRecordId_idx" ON "VerificationEvent"("verificationRecordId");

-- CreateIndex
CREATE INDEX "VerificationEvent_createdAt_idx" ON "VerificationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SavedDish_userId_idx" ON "SavedDish"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedDish_userId_restaurantDishId_key" ON "SavedDish"("userId", "restaurantDishId");

-- CreateIndex
CREATE INDEX "UserSearchHistory_userId_createdAt_idx" ON "UserSearchHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSearchHistory_createdAt_idx" ON "UserSearchHistory"("createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_query_idx" ON "SearchLog"("query");

-- CreateIndex
CREATE UNIQUE INDEX "UsedVerificationToken_tokenHash_key" ON "UsedVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UsedVerificationToken_usedAt_idx" ON "UsedVerificationToken"("usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- AddForeignKey
ALTER TABLE "RestaurantDish" ADD CONSTRAINT "RestaurantDish_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantDish" ADD CONSTRAINT "RestaurantDish_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "DishTaxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantPhoto" ADD CONSTRAINT "RestaurantPhoto_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRecord" ADD CONSTRAINT "VerificationRecord_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_verificationRecordId_fkey" FOREIGN KEY ("verificationRecordId") REFERENCES "VerificationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedDish" ADD CONSTRAINT "SavedDish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedDish" ADD CONSTRAINT "SavedDish_restaurantDishId_fkey" FOREIGN KEY ("restaurantDishId") REFERENCES "RestaurantDish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSearchHistory" ADD CONSTRAINT "UserSearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migration: make_restaurant_phone_optional
-- Phone is not publicly listed for all restaurants.
-- Governed by: database-track.md

ALTER TABLE "Restaurant" ALTER COLUMN "phone" DROP NOT NULL;

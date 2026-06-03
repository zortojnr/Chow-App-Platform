-- AlterTable: Add isActive flag for admin account management
-- Governed by: admin-platform-track.md §4.5 — deactivate, not delete
-- Required by: admin-user.service.ts setup-link flow (Step 8)
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

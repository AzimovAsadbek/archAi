-- CreateTable
CREATE TABLE "estimate_rules" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Exactly one active rule set. Partial indexes are not expressible in the Prisma
-- schema, so this statement is the source of truth for the constraint.
CREATE UNIQUE INDEX "estimate_rules_active_unique" ON "estimate_rules"("isActive") WHERE "isActive" = true;

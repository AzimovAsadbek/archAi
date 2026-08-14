-- CreateTable
CREATE TABLE "floor_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "floor_plans_projectId_key" ON "floor_plans"("projectId");

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

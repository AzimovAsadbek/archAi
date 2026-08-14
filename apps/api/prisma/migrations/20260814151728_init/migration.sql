-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'CONFIGURED', 'GENERATING', 'READY', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "HouseStyle" AS ENUM ('MODERN', 'MINIMALIST', 'CLASSIC', 'TRADITIONAL', 'EUROPEAN', 'NATIONAL');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('BEDROOM', 'LIVING_ROOM', 'KITCHEN', 'BATHROOM', 'DINING_ROOM', 'OFFICE', 'STORAGE', 'LAUNDRY', 'HALLWAY', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "landAreaM2" DOUBLE PRECISION,
    "landWidthM" DOUBLE PRECISION,
    "landLengthM" DOUBLE PRECISION,
    "houseWidthM" DOUBLE PRECISION,
    "houseLengthM" DOUBLE PRECISION,
    "floorCount" INTEGER,
    "style" "HouseStyle",
    "hasGarage" BOOLEAN NOT NULL DEFAULT false,
    "hasTerrace" BOOLEAN NOT NULL DEFAULT false,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "hasPool" BOOLEAN NOT NULL DEFAULT false,
    "hasGarden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "widthM" DOUBLE PRECISION,
    "lengthM" DOUBLE PRECISION,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "projects_ownerId_status_idx" ON "projects"("ownerId", "status");

-- CreateIndex
CREATE INDEX "projects_ownerId_updatedAt_idx" ON "projects"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "rooms_projectId_idx" ON "rooms"("projectId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

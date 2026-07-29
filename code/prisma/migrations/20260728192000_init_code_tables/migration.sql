-- Baseline DDL for code-owned tables in public.
-- Apply via `npm run db:migrate` / `db:push` from code/.
-- Table names are Code* so they never collide with app User / Activity / Chat*.

DO $$ BEGIN
    CREATE TYPE "CodeActivityStatus" AS ENUM ('settled', 'verified', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "CodeUser" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CodeUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CodeActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "walletAddress" TEXT,
    "modelSlug" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "costUsdc" DOUBLE PRECISION NOT NULL,
    "status" "CodeActivityStatus" NOT NULL,
    "txId" TEXT NOT NULL,
    "requestId" TEXT,
    "provider" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CodeUserModelUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelSlug" TEXT NOT NULL,
    "modelName" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CodeUserModelUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CodeTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'starter',
    "projectName" TEXT NOT NULL,
    "activePath" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "clonedCount" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CodeTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CodeTemplateClone" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "txId" TEXT NOT NULL,
    "costUsdc" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeTemplateClone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeUser_address_key" ON "CodeUser"("address");

CREATE INDEX IF NOT EXISTS "CodeActivity_createdAt_idx" ON "CodeActivity"("createdAt");
CREATE INDEX IF NOT EXISTS "CodeActivity_walletAddress_createdAt_idx" ON "CodeActivity"("walletAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "CodeActivity_userId_createdAt_idx" ON "CodeActivity"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CodeActivity_status_idx" ON "CodeActivity"("status");
CREATE INDEX IF NOT EXISTS "CodeActivity_type_idx" ON "CodeActivity"("type");

CREATE UNIQUE INDEX IF NOT EXISTS "CodeUserModelUsage_userId_modelSlug_key" ON "CodeUserModelUsage"("userId", "modelSlug");
CREATE INDEX IF NOT EXISTS "CodeUserModelUsage_userId_lastUsedAt_idx" ON "CodeUserModelUsage"("userId", "lastUsedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CodeTemplate_slug_key" ON "CodeTemplate"("slug");
CREATE INDEX IF NOT EXISTS "CodeTemplate_category_idx" ON "CodeTemplate"("category");
CREATE INDEX IF NOT EXISTS "CodeTemplate_clonedCount_idx" ON "CodeTemplate"("clonedCount");
CREATE INDEX IF NOT EXISTS "CodeTemplate_featured_clonedCount_idx" ON "CodeTemplate"("featured", "clonedCount");
CREATE INDEX IF NOT EXISTS "CodeTemplate_name_idx" ON "CodeTemplate"("name");

CREATE INDEX IF NOT EXISTS "CodeTemplateClone_templateId_createdAt_idx" ON "CodeTemplateClone"("templateId", "createdAt");
CREATE INDEX IF NOT EXISTS "CodeTemplateClone_walletAddress_createdAt_idx" ON "CodeTemplateClone"("walletAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "CodeTemplateClone_createdAt_idx" ON "CodeTemplateClone"("createdAt");

DO $$ BEGIN
    ALTER TABLE "CodeActivity" ADD CONSTRAINT "CodeActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CodeUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CodeUserModelUsage" ADD CONSTRAINT "CodeUserModelUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CodeUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CodeTemplateClone" ADD CONSTRAINT "CodeTemplateClone_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CodeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

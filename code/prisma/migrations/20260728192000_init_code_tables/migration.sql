-- Baseline DDL for code-owned tables in PostgreSQL schema "code".
-- Applied via `npm run db:push` from code/ (scoped to schemas=["code"]).
-- App tables remain in public and are never touched by this package.

CREATE SCHEMA IF NOT EXISTS "code";

DO $$ BEGIN
    CREATE TYPE "code"."CodeActivityStatus" AS ENUM ('settled', 'verified', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "code"."CodeUser" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CodeUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "code"."CodeActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "walletAddress" TEXT,
    "modelSlug" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "costUsdc" DOUBLE PRECISION NOT NULL,
    "status" "code"."CodeActivityStatus" NOT NULL,
    "txId" TEXT NOT NULL,
    "requestId" TEXT,
    "provider" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "code"."CodeUserModelUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelSlug" TEXT NOT NULL,
    "modelName" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CodeUserModelUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "code"."CodeTemplate" (
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

CREATE TABLE IF NOT EXISTS "code"."CodeTemplateClone" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "txId" TEXT NOT NULL,
    "costUsdc" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeTemplateClone_pkey" PRIMARY KEY ("id")
);

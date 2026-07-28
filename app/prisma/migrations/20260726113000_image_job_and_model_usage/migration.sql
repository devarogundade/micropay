-- CreateTable
CREATE TABLE "ImageJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "walletAddress" TEXT,
    "modelSlug" TEXT NOT NULL,
    "modelName" TEXT,
    "prompt" TEXT NOT NULL,
    "size" TEXT,
    "providerAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModelUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelSlug" TEXT NOT NULL,
    "modelName" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "useCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserModelUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageJob_userId_createdAt_idx" ON "ImageJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageJob_status_idx" ON "ImageJob"("status");

-- CreateIndex
CREATE INDEX "UserModelUsage_userId_lastUsedAt_idx" ON "UserModelUsage"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserModelUsage_userId_modelSlug_key" ON "UserModelUsage"("userId", "modelSlug");

-- AddForeignKey
ALTER TABLE "ImageJob" ADD CONSTRAINT "ImageJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModelUsage" ADD CONSTRAINT "UserModelUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

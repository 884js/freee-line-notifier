-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "activeCompanyId" TEXT NOT NULL,
    FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_activeCompanyId_key" ON "User"("activeCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_companyId_key" ON "Company"("companyId");

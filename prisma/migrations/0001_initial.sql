-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstNameNorm" TEXT NOT NULL,
    "lastNameNorm" TEXT NOT NULL,
    "department" TEXT,
    "registrationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "withdrawnAt" DATETIME,
    "eliminatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "reportedByPlayerId" TEXT,
    "winnerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "round" INTEGER,
    "gamesJson" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_reportedByPlayerId_fkey" FOREIGN KEY ("reportedByPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventName" TEXT NOT NULL,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "endDate" DATETIME
);

-- CreateIndex
CREATE INDEX "Player_registrationStatus_idx" ON "Player"("registrationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Player_firstNameNorm_lastNameNorm_key" ON "Player"("firstNameNorm", "lastNameNorm");

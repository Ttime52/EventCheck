-- F-01 owns User and Session persistence. Later feature migrations must not duplicate these tables.
CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "Role" AS ENUM ('PARTICIPANT', 'ORGANIZER');
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "loginIdentifier" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absoluteExpiry" TIMESTAMP(3) NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_loginIdentifier_key" ON "User"("loginIdentifier");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_absoluteExpiry_idx" ON "Session"("absoluteExpiry");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Registration_eventId_status_idx" ON "Registration"("eventId", "status");
CREATE INDEX "Registration_participantId_status_idx" ON "Registration"("participantId", "status");
CREATE INDEX "Registration_participantId_registeredAt_idx" ON "Registration"("participantId", "registeredAt");
CREATE UNIQUE INDEX "Registration_active_participant_event_key" ON "Registration"("participantId", "eventId") WHERE "status" = 'ACTIVE';

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

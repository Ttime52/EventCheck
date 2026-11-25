ALTER TABLE "Registration"
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_status_cancelledAt_check"
  CHECK (
    ("status" = 'ACTIVE' AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL)
  );

CREATE UNIQUE INDEX "Registration_id_eventId_participantId_key"
  ON "Registration"("id", "eventId", "participantId");

CREATE UNIQUE INDEX "Event_id_organizerId_key"
  ON "Event"("id", "organizerId");

CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "recordedByOrganizerId" TEXT NOT NULL,
  "checkedInAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Attendance_registrationId_key"
  ON "Attendance"("registrationId");

CREATE UNIQUE INDEX "Attendance_registrationId_eventId_participantId_key"
  ON "Attendance"("registrationId", "eventId", "participantId");

CREATE INDEX "Attendance_eventId_checkedInAt_idx"
  ON "Attendance"("eventId", "checkedInAt");

CREATE INDEX "Attendance_participantId_checkedInAt_idx"
  ON "Attendance"("participantId", "checkedInAt");

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_registrationId_eventId_participantId_fkey"
  FOREIGN KEY ("registrationId", "eventId", "participantId")
  REFERENCES "Registration"("id", "eventId", "participantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_eventId_recordedByOrganizerId_fkey"
  FOREIGN KEY ("eventId", "recordedByOrganizerId")
  REFERENCES "Event"("id", "organizerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_participantId_fkey"
  FOREIGN KEY ("participantId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_recordedByOrganizerId_fkey"
  FOREIGN KEY ("recordedByOrganizerId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

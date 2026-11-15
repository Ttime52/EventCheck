ALTER TABLE "Registration" DROP CONSTRAINT "Registration_eventId_fkey";
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_participantId_fkey";

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

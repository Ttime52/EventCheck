ALTER TABLE "Event" ADD COLUMN "registrationDeadline" TIMESTAMP(3);

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_registrationDeadline_check"
  CHECK ("registrationDeadline" IS NULL OR "registrationDeadline" <= "startAt");

-- F-02 owns Event persistence. Later feature migrations must reuse this table.
CREATE TYPE "PublicationState" AS ENUM ('PUBLISHED');

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "publicationState" "PublicationState" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Event_capacity_check" CHECK ("capacity" > 0),
    CONSTRAINT "Event_date_order_check" CHECK ("endAt" > "startAt"),
    CONSTRAINT "Event_required_text_check" CHECK (
        length(btrim("title")) > 0
        AND length(btrim("description")) > 0
        AND length(btrim("location")) > 0
    )
);

CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");
CREATE INDEX "Event_publicationState_startAt_idx" ON "Event"("publicationState", "startAt");
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

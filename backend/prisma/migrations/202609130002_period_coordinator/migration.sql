ALTER TABLE "InternshipPeriod" ADD COLUMN "coordinatorId" UUID;
ALTER TABLE "InternshipPeriod" ADD CONSTRAINT "InternshipPeriod_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "InternshipPeriod_coordinatorId_idx" ON "InternshipPeriod"("coordinatorId");

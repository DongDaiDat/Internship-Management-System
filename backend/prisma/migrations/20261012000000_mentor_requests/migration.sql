CREATE TYPE "MentorResponse" AS ENUM ('Pending', 'Accepted', 'Declined');
CREATE TABLE "MentorRequest" (
 "id" UUID NOT NULL, "applicationId" UUID NOT NULL, "facultyMentorId" UUID NOT NULL,
 "reason" VARCHAR(500) NOT NULL, "response" "MentorResponse" NOT NULL DEFAULT 'Pending',
 "responseNote" VARCHAR(500), "respondedById" UUID, "respondedAt" TIMESTAMP(3),
 "closedAt" TIMESTAMP(3), "closeReason" VARCHAR(40), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MentorRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MentorRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InternshipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MentorRequest_facultyMentorId_fkey" FOREIGN KEY ("facultyMentorId") REFERENCES "FacultyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MentorRequest_one_current" ON "MentorRequest"("applicationId") WHERE "closedAt" IS NULL;
CREATE INDEX "MentorRequest_facultyMentorId_response_createdAt_idx" ON "MentorRequest"("facultyMentorId", "response", "createdAt");
CREATE INDEX "MentorRequest_applicationId_createdAt_idx" ON "MentorRequest"("applicationId", "createdAt");

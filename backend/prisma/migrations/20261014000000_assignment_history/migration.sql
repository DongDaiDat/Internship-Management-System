CREATE TABLE "AssignmentHistory" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "internshipId" UUID NOT NULL,
 "kind" VARCHAR(16) NOT NULL CHECK ("kind" IN ('mentor','company','supervisor')),
 "targetId" UUID NOT NULL, "targetName" VARCHAR(160) NOT NULL, "companyId" UUID,
 "assignedById" UUID, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "endedAt" TIMESTAMP(3), "reason" VARCHAR(1000), "source" VARCHAR(30) NOT NULL, "snapshot" JSONB,
 CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AssignmentHistory_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt")
);
CREATE INDEX "AssignmentHistory_kind_targetId_endedAt_idx" ON "AssignmentHistory"("kind", "targetId", "endedAt");
CREATE INDEX "AssignmentHistory_internshipId_startedAt_idx" ON "AssignmentHistory"("internshipId", "startedAt");
CREATE UNIQUE INDEX "AssignmentHistory_active_target" ON "AssignmentHistory"("internshipId","kind","targetId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "AssignmentHistory_single_current" ON "AssignmentHistory"("internshipId","kind") WHERE "endedAt" IS NULL AND "kind" IN ('mentor','company');
INSERT INTO "AssignmentHistory" ("internshipId","kind","targetId","targetName","companyId","source")
 SELECT i.id,'mentor',f.id,f."fullName",i."companyId",'Migration' FROM "Internship" i JOIN "FacultyProfile" f ON f.id=i."facultyMentorId";
INSERT INTO "AssignmentHistory" ("internshipId","kind","targetId","targetName","companyId","source")
 SELECT i.id,'company',c.id,c.name,c.id,'Migration' FROM "Internship" i JOIN "CompanyProfile" c ON c.id=i."companyId";
INSERT INTO "AssignmentHistory" ("internshipId","kind","targetId","targetName","companyId","source")
 SELECT a."internshipId",'supervisor',s.id,u."fullName",s."companyId",'Migration' FROM "CompanySupervisorAssignment" a JOIN "CompanySupervisorProfile" s ON s.id=a."supervisorId" JOIN "User" u ON u.id=s."userId";

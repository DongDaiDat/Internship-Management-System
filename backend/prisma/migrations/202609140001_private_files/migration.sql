CREATE TABLE "FileDocument" (
 "id" UUID PRIMARY KEY, "internshipId" UUID NOT NULL REFERENCES "Internship"("id"),
 "kind" VARCHAR(16) NOT NULL, "weekNumber" INTEGER, "supervisorId" UUID, "companyId" UUID NOT NULL,
 "uploadedById" UUID NOT NULL REFERENCES "User"("id"), "originalName" VARCHAR(180) NOT NULL,
 "objectKey" VARCHAR(255) NOT NULL UNIQUE, "bucket" VARCHAR(100) NOT NULL,
 "size" INTEGER NOT NULL, "sha256" VARCHAR(64) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "FileDocument_internshipId_idx" ON "FileDocument"("internshipId");
ALTER TABLE "WeeklyReport" ADD COLUMN "fileId" UUID REFERENCES "FileDocument"("id");
ALTER TABLE "FinalReport" ADD COLUMN "fileId" UUID REFERENCES "FileDocument"("id");
ALTER TABLE "SupervisorEvaluation" ADD COLUMN "evidenceFileId" UUID REFERENCES "FileDocument"("id"), ADD COLUMN "enteredById" UUID, ADD COLUMN "enteredOnBehalf" BOOLEAN NOT NULL DEFAULT false;

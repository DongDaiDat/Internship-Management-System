-- Trường CNTT Phenikaa: hồ sơ, đợt thực tập, báo cáo và đánh giá.
CREATE TYPE "PeriodStatus" AS ENUM ('Draft', 'Published', 'Closed');
CREATE TYPE "ApplicationStatus" AS ENUM ('Draft', 'Submitted', 'NeedsRevision', 'Approved', 'Rejected', 'Cancelled');
CREATE TYPE "ExceptionStatus" AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE "WeeklyReportStatus" AS ENUM ('Submitted', 'NeedsRevision', 'Reviewed');
CREATE TYPE "ImportType" AS ENUM ('Students', 'Faculty', 'Companies');
CREATE TYPE "ImportStatus" AS ENUM ('Preview', 'Confirmed', 'Expired');

ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StudentProfile" (
  "id" UUID NOT NULL, "userId" UUID, "studentCode" VARCHAR(30) NOT NULL, "fullName" VARCHAR(120) NOT NULL, "email" VARCHAR(254) NOT NULL,
  "className" VARCHAR(80) NOT NULL, "cohort" VARCHAR(30) NOT NULL, "major" VARCHAR(120) NOT NULL DEFAULT 'Công nghệ thông tin',
  "programCredits" INTEGER NOT NULL, "completedCredits" INTEGER NOT NULL, "hasMandatoryCourseDebt" BOOLEAN NOT NULL DEFAULT false,
  "isVerified" BOOLEAN NOT NULL DEFAULT false, "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FacultyProfile" (
  "id" UUID NOT NULL, "userId" UUID, "facultyCode" VARCHAR(30) NOT NULL, "fullName" VARCHAR(120) NOT NULL, "email" VARCHAR(254) NOT NULL,
  "expertise" VARCHAR(160) NOT NULL, "maxStudents" INTEGER NOT NULL DEFAULT 10, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FacultyProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompanyProfile" (
  "id" UUID NOT NULL, "representativeUserId" UUID, "name" VARCHAR(160) NOT NULL, "taxCode" VARCHAR(30), "address" VARCHAR(255) NOT NULL,
  "website" VARCHAR(255), "contactName" VARCHAR(120) NOT NULL, "contactEmail" VARCHAR(254) NOT NULL, "contactPhone" VARCHAR(30) NOT NULL,
  "isVerified" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompanySupervisorProfile" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "companyId" UUID NOT NULL, "title" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CompanySupervisorProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InternshipPeriod" (
  "id" UUID NOT NULL, "name" VARCHAR(160) NOT NULL, "registrationStartsAt" TIMESTAMP(3) NOT NULL, "registrationEndsAt" TIMESTAMP(3) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "weeklyReportCount" INTEGER NOT NULL,
  "creditThresholdPercent" INTEGER NOT NULL DEFAULT 80, "status" "PeriodStatus" NOT NULL DEFAULT 'Draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "InternshipPeriod_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InternshipApplication" (
  "id" UUID NOT NULL, "periodId" UUID NOT NULL, "studentId" UUID NOT NULL, "companyId" UUID,
  "externalCompanyName" VARCHAR(160), "externalCompanyContact" VARCHAR(160), "externalCompanyEmail" VARCHAR(254), "positionTitle" VARCHAR(160) NOT NULL,
  "eligibilityPassed" BOOLEAN NOT NULL DEFAULT false, "eligibilityReason" VARCHAR(500), "status" "ApplicationStatus" NOT NULL DEFAULT 'Draft',
  "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "reviewNote" VARCHAR(500), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "InternshipApplication_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EligibilityExceptionRequest" (
  "id" UUID NOT NULL, "applicationId" UUID NOT NULL, "reason" VARCHAR(1000) NOT NULL, "status" "ExceptionStatus" NOT NULL DEFAULT 'Pending',
  "decisionNote" VARCHAR(500), "reviewedById" UUID, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EligibilityExceptionRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Internship" (
  "id" UUID NOT NULL, "applicationId" UUID NOT NULL, "periodId" UUID NOT NULL, "studentId" UUID NOT NULL, "companyId" UUID,
  "facultyMentorId" UUID NOT NULL, "eligibilitySnapshot" JSONB NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Internship_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompanySupervisorAssignment" (
  "internshipId" UUID NOT NULL, "supervisorId" UUID NOT NULL, "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanySupervisorAssignment_pkey" PRIMARY KEY ("internshipId", "supervisorId")
);
CREATE TABLE "WeeklyReport" (
  "id" UUID NOT NULL, "internshipId" UUID NOT NULL, "weekNumber" INTEGER NOT NULL, "content" VARCHAR(5000) NOT NULL,
  "status" "WeeklyReportStatus" NOT NULL DEFAULT 'Submitted', "mentorNote" VARCHAR(2000), "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3), CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupervisorEvaluation" (
  "id" UUID NOT NULL, "internshipId" UUID NOT NULL, "supervisorId" UUID, "discipline" DOUBLE PRECISION NOT NULL,
  "responsibility" DOUBLE PRECISION NOT NULL, "knowledge" DOUBLE PRECISION NOT NULL, "outcome" DOUBLE PRECISION NOT NULL, "total" DOUBLE PRECISION NOT NULL,
  "evidenceNote" VARCHAR(500), "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SupervisorEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FacultyEvaluation" (
  "id" UUID NOT NULL, "internshipId" UUID NOT NULL, "score" DOUBLE PRECISION NOT NULL, "note" VARCHAR(1000), "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacultyEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinalReport" (
  "id" UUID NOT NULL, "internshipId" UUID NOT NULL, "content" VARCHAR(10000) NOT NULL, "score" DOUBLE PRECISION,
  "mentorNote" VARCHAR(1000), "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "gradedAt" TIMESTAMP(3), CONSTRAINT "FinalReport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinalGrade" (
  "id" UUID NOT NULL, "internshipId" UUID NOT NULL, "companyScore" DOUBLE PRECISION NOT NULL, "facultyScore" DOUBLE PRECISION NOT NULL,
  "finalReportScore" DOUBLE PRECISION NOT NULL, "total" DOUBLE PRECISION NOT NULL, "letterGrade" VARCHAR(3) NOT NULL, "passed" BOOLEAN NOT NULL,
  "snapshot" JSONB NOT NULL, "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FinalGrade_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ImportBatch" (
  "id" UUID NOT NULL, "type" "ImportType" NOT NULL, "status" "ImportStatus" NOT NULL DEFAULT 'Preview', "rows" JSONB NOT NULL,
  "errors" JSONB NOT NULL, "createdById" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
CREATE UNIQUE INDEX "StudentProfile_studentCode_key" ON "StudentProfile"("studentCode");
CREATE UNIQUE INDEX "StudentProfile_email_key" ON "StudentProfile"("email");
CREATE INDEX "StudentProfile_isVerified_completedCredits_idx" ON "StudentProfile"("isVerified", "completedCredits");
CREATE UNIQUE INDEX "FacultyProfile_userId_key" ON "FacultyProfile"("userId");
CREATE UNIQUE INDEX "FacultyProfile_facultyCode_key" ON "FacultyProfile"("facultyCode");
CREATE UNIQUE INDEX "FacultyProfile_email_key" ON "FacultyProfile"("email");
CREATE UNIQUE INDEX "CompanyProfile_representativeUserId_key" ON "CompanyProfile"("representativeUserId");
CREATE UNIQUE INDEX "CompanyProfile_taxCode_key" ON "CompanyProfile"("taxCode");
CREATE UNIQUE INDEX "CompanyProfile_name_contactEmail_key" ON "CompanyProfile"("name", "contactEmail");
CREATE INDEX "CompanyProfile_isVerified_idx" ON "CompanyProfile"("isVerified");
CREATE UNIQUE INDEX "CompanySupervisorProfile_userId_key" ON "CompanySupervisorProfile"("userId");
CREATE INDEX "CompanySupervisorProfile_companyId_idx" ON "CompanySupervisorProfile"("companyId");
CREATE UNIQUE INDEX "InternshipPeriod_name_key" ON "InternshipPeriod"("name");
CREATE INDEX "InternshipPeriod_status_registrationStartsAt_registrationEndsAt_idx" ON "InternshipPeriod"("status", "registrationStartsAt", "registrationEndsAt");
CREATE UNIQUE INDEX "InternshipApplication_periodId_studentId_key" ON "InternshipApplication"("periodId", "studentId");
CREATE INDEX "InternshipApplication_status_periodId_idx" ON "InternshipApplication"("status", "periodId");
CREATE UNIQUE INDEX "EligibilityExceptionRequest_applicationId_key" ON "EligibilityExceptionRequest"("applicationId");
CREATE INDEX "EligibilityExceptionRequest_status_idx" ON "EligibilityExceptionRequest"("status");
CREATE UNIQUE INDEX "Internship_applicationId_key" ON "Internship"("applicationId");
CREATE INDEX "Internship_facultyMentorId_idx" ON "Internship"("facultyMentorId");
CREATE INDEX "Internship_studentId_idx" ON "Internship"("studentId");
CREATE UNIQUE INDEX "WeeklyReport_internshipId_weekNumber_key" ON "WeeklyReport"("internshipId", "weekNumber");
CREATE INDEX "WeeklyReport_status_idx" ON "WeeklyReport"("status");
CREATE UNIQUE INDEX "SupervisorEvaluation_internshipId_supervisorId_key" ON "SupervisorEvaluation"("internshipId", "supervisorId");
CREATE UNIQUE INDEX "FacultyEvaluation_internshipId_key" ON "FacultyEvaluation"("internshipId");
CREATE UNIQUE INDEX "FinalReport_internshipId_key" ON "FinalReport"("internshipId");
CREATE UNIQUE INDEX "FinalGrade_internshipId_key" ON "FinalGrade"("internshipId");
CREATE INDEX "ImportBatch_type_status_createdAt_idx" ON "ImportBatch"("type", "status", "createdAt");

ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FacultyProfile" ADD CONSTRAINT "FacultyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_representativeUserId_fkey" FOREIGN KEY ("representativeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanySupervisorProfile" ADD CONSTRAINT "CompanySupervisorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanySupervisorProfile" ADD CONSTRAINT "CompanySupervisorProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "InternshipPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilityExceptionRequest" ADD CONSTRAINT "EligibilityExceptionRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InternshipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InternshipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "InternshipPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_facultyMentorId_fkey" FOREIGN KEY ("facultyMentorId") REFERENCES "FacultyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanySupervisorAssignment" ADD CONSTRAINT "CompanySupervisorAssignment_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanySupervisorAssignment" ADD CONSTRAINT "CompanySupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "CompanySupervisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupervisorEvaluation" ADD CONSTRAINT "SupervisorEvaluation_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupervisorEvaluation" ADD CONSTRAINT "SupervisorEvaluation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "CompanySupervisorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FacultyEvaluation" ADD CONSTRAINT "FacultyEvaluation_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalReport" ADD CONSTRAINT "FinalReport_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "InternshipPeriod_name_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "departmentId" UUID;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "cohortId" UUID,
ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "importBatchId" UUID,
ADD COLUMN     "majorId" UUID,
ADD COLUMN     "programId" UUID;

-- AlterTable
ALTER TABLE "FacultyProfile" ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "importBatchId" UUID;

-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "importBatchId" UUID;

-- AlterTable
ALTER TABLE "InternshipPeriod" ADD COLUMN     "academicYear" VARCHAR(9),
ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "roundNumber" INTEGER,
ADD COLUMN     "semester" INTEGER;

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Major" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "majorId" UUID NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentProgram" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(1000) NOT NULL,

    CONSTRAINT "DepartmentProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "number" INTEGER NOT NULL,
    "admissionYear" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodAudience" (
    "id" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "majorId" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "programId" UUID,

    CONSTRAINT "PeriodAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Major_code_key" ON "Major"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgram_code_key" ON "TrainingProgram"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentProgram_departmentId_programId_key" ON "DepartmentProgram"("departmentId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_code_key" ON "Cohort"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_number_key" ON "Cohort"("number");

-- CreateIndex
CREATE INDEX "PeriodAudience_periodId_idx" ON "PeriodAudience"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipPeriod_departmentId_roundNumber_semester_academic_key" ON "InternshipPeriod"("departmentId", "roundNumber", "semester", "academicYear");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyProfile" ADD CONSTRAINT "FacultyProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipPeriod" ADD CONSTRAINT "InternshipPeriod_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentProgram" ADD CONSTRAINT "DepartmentProgram_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentProgram" ADD CONSTRAINT "DepartmentProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodAudience" ADD CONSTRAINT "PeriodAudience_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "InternshipPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodAudience" ADD CONSTRAINT "PeriodAudience_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodAudience" ADD CONSTRAINT "PeriodAudience_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodAudience" ADD CONSTRAINT "PeriodAudience_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

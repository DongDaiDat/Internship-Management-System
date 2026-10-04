-- Preserve legacy batches without guessing their original department.
ALTER TABLE "ImportBatch" ADD COLUMN "departmentId" UUID;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

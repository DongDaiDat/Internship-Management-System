ALTER TABLE "InternshipPeriod"
  ADD COLUMN "weeklyDeadlines" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
  ADD COLUMN "gradingDeadline" TIMESTAMP(3),
  ADD COLUMN "finalizationDeadline" TIMESTAMP(3);

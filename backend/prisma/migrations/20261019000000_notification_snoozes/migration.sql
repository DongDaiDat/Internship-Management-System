CREATE TABLE "NotificationSnooze" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "role" "Role" NOT NULL,
  "taskId" VARCHAR(255) NOT NULL,
  "hiddenUntil" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationSnooze_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationSnooze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationSnooze_userId_role_taskId_key" ON "NotificationSnooze"("userId", "role", "taskId");
CREATE INDEX "NotificationSnooze_userId_role_hiddenUntil_idx" ON "NotificationSnooze"("userId", "role", "hiddenUntil");

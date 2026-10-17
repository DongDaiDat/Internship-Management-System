import { Prisma } from "@prisma/client";

// Called inside the same locked transaction as the operational assignment.
export async function recordAssignment(
  tx: Prisma.TransactionClient,
  internshipId: string,
  kind: string,
  targetId: string,
  targetName: string,
  companyId: string | null,
  assignedById: string,
  source: string,
  reason?: string,
) {
  const existing = await tx.assignmentHistory.findFirst({
    where: { internshipId, kind, targetId, endedAt: null },
  });
  if (existing) return;
  await tx.assignmentHistory.create({
    data: {
      internshipId,
      kind,
      targetId,
      targetName,
      companyId,
      assignedById,
      source,
      reason,
    },
  });
}

export async function closeAssignments(
  tx: Prisma.TransactionClient,
  internshipId: string,
  kinds: string[],
  reason: string,
) {
  const current = await tx.internship.findUniqueOrThrow({
    where: { id: internshipId },
    include: {
      facultyEvaluation: true,
      finalReport: true,
      weeklyReports: true,
      supervisorEvaluations: true,
    },
  });
  const histories = await tx.assignmentHistory.findMany({
    where: { internshipId, kind: { in: kinds }, endedAt: null },
  });
  const endedAt = new Date();
  for (const h of histories) {
    const snapshot =
      h.kind === "mentor"
        ? {
            facultyEvaluation: current.facultyEvaluation,
            finalReport: current.finalReport && {
              score: current.finalReport.score,
              mentorNote: current.finalReport.mentorNote,
              gradedAt: current.finalReport.gradedAt,
            },
            weeklyReviews: current.weeklyReports
              .filter(
                (r) =>
                  r.reviewedAt &&
                  (h.source === "Migration" || r.reviewedAt >= h.startedAt),
              )
              .map((r) => ({
                weekNumber: r.weekNumber,
                mentorNote: r.mentorNote,
                reviewedAt: r.reviewedAt,
              })),
          }
        : {
            evaluations: current.supervisorEvaluations.filter(
              (e) => h.kind === "company" || e.supervisorId === h.targetId,
            ),
          };
    await tx.assignmentHistory.update({
      where: { id: h.id },
      data: {
        endedAt,
        reason,
        snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      },
    });
  }
}

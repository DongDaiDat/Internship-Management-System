// Demo/QA helper. Existing history is retained; passwords are never touched.
async function seedReportingHistory(db) {
  const items = await db.internship.findMany({
    include: {
      facultyMentor: true,
      finalGrade: true,
      company: true,
      companySupervisorAssignments: {
        include: {
          supervisor: { include: { user: { select: { fullName: true } } } },
        },
      },
    },
  });
  for (const i of items)
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Internship" WHERE "id" = ${i.id}::uuid FOR UPDATE`;
      const entries = [
        {
          kind: "mentor",
          targetId: i.facultyMentorId,
          targetName: i.facultyMentor.fullName,
        },
        ...(i.company
          ? [
              {
                kind: "company",
                targetId: i.company.id,
                targetName: i.company.name,
              },
            ]
          : []),
        ...i.companySupervisorAssignments.map((a) => ({
          kind: "supervisor",
          targetId: a.supervisorId,
          targetName: a.supervisor.user.fullName,
        })),
      ];
      for (const e of entries)
        if (
          !(await tx.assignmentHistory.findFirst({
            where: {
              internshipId: i.id,
              kind: e.kind,
              targetId: e.targetId,
              ...(i.finalGrade ? {} : { endedAt: null }),
            },
          }))
        )
          await tx.assignmentHistory.create({
            data: {
              internshipId: i.id,
              ...e,
              companyId: i.companyId,
              source: "Migration",
            },
          });
    });
}
module.exports = { seedReportingHistory };

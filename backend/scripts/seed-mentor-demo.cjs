// Additive local demo: never reset passwords, dates, responses or existing assignments.
const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production") throw Error("Local demo only");
  const fixture = JSON.parse(
    readFileSync(join(__dirname, "../.local/upgrade-demo.json"), "utf8"),
  );
  const email = (role) =>
    typeof fixture.accounts[role] === "string"
      ? fixture.accounts[role]
      : fixture.accounts[role].email;
  const student = await db.studentProfile.findFirst({
    where: { user: { email: email("Student") } },
    include: { user: true },
  });
  const mentor = await db.facultyProfile.findFirst({
    where: { user: { email: email("FacultyMentor") } },
  });
  const coordinator = await db.user.findUnique({
    where: { email: email("InternshipCoordinator") },
  });
  if (
    !student?.user ||
    !student.departmentId ||
    !student.majorId ||
    !student.cohortId ||
    !mentor ||
    !coordinator ||
    mentor.departmentId !== student.departmentId
  )
    throw Error("Complete academic demo profiles required");
  const company = await db.companyProfile.findFirst({
    where: { departmentId: student.departmentId, isVerified: true },
  });
  if (!company) throw Error("Verified demo company required");
  const day = 86400000,
    now = Date.now();
  const date = (n) => new Date(now + n * day);
  await db.$transaction(async (tx) => {
    for (const [i, response] of ["Pending", "Accepted", "Declined"].entries()) {
      const demoEmail = `mentor-request-${i + 1}@phenikaa-demo.local`;
      // Existing accounts and their credentials are immutable in this script.
      let user = await tx.user.findUnique({ where: { email: demoEmail } });
      if (!user)
        user = await tx.user.create({
          data: {
            email: demoEmail,
            fullName: ["Nguyễn Minh An", "Trần Ngọc Hà", "Lê Hoàng Phúc"][i],
            departmentId: student.departmentId,
            passwordHash: student.user.passwordHash,
            roles: { create: { role: "Student" } },
          },
        });
      let profile = await tx.studentProfile.findUnique({
        where: { userId: user.id },
      });
      if (!profile)
        profile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            fullName: user.fullName,
            email: demoEmail,
            studentCode: `DEMO-MENTOR-${i + 1}`,
            departmentId: student.departmentId,
            majorId: student.majorId,
            programId: student.programId,
            cohortId: student.cohortId,
            cohort: student.cohort,
            major: student.major,
            className: student.className,
            programCredits: student.programCredits,
            completedCredits: student.programCredits,
            isVerified: true,
          },
        });
      const roundNumber = i === 0 ? 98 : 99;
      let period = await tx.internshipPeriod.findFirst({
        where: {
          departmentId: student.departmentId,
          roundNumber,
          semester: 1,
          academicYear: "2026-2027",
        },
      });
      if (!period)
        period = await tx.internshipPeriod.create({
          data: {
            departmentId: student.departmentId,
            roundNumber,
            semester: 1,
            academicYear: "2026-2027",
            name: `${roundNumber}_HK1_2026-2027 · Demo đề xuất hướng dẫn`,
            coordinatorId: coordinator.id,
            status: "Published",
            registrationStartsAt: date(-7),
            registrationEndsAt: date(i === 0 ? 7 : -1),
            startsAt: date(8),
            endsAt: date(52),
            gradingDeadline: date(55),
            finalizationDeadline: date(60),
            weeklyReportCount: 6,
            weeklyDeadlines: [15, 22, 29, 36, 43, 50].map(date),
            audience: {
              create: {
                majorId: student.majorId,
                cohortId: student.cohortId,
                programId: student.programId,
              },
            },
          },
        });
      const existing = await tx.internshipApplication.findUnique({
        where: {
          periodId_studentId: { periodId: period.id, studentId: profile.id },
        },
      });
      if (existing) continue;
      await tx.internshipApplication.create({
        data: {
          periodId: period.id,
          studentId: profile.id,
          companyId: company.id,
          positionTitle: "Phát triển ứng dụng web",
          eligibilityPassed: true,
          status: "Submitted",
          submittedAt: new Date(),
          mentorRequests: {
            create: {
              facultyMentorId: mentor.id,
              reason: "Mong thầy hướng dẫn xây dựng hệ thống quản lý thực tập.",
              response,
              ...(response !== "Pending"
                ? {
                    respondedAt: new Date(),
                    respondedById: mentor.userId,
                    responseNote:
                      response === "Accepted"
                        ? "Phù hợp chuyên môn, chờ khoa phân công."
                        : "Chưa phù hợp định hướng hướng dẫn trong đợt này.",
                  }
                : {}),
            },
          },
        },
      });
    }
  });
  console.log(
    "Added mentor-request demo scenarios; existing credentials and assignments retained.",
  );
}
main()
  .then(() => require("./seed-reporting-history.cjs").seedReportingHistory(db))
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

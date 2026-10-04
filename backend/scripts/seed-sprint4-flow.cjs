// Fresh additive fixtures on the dedicated E2E database only. No reset or schedule edits.
const { randomUUID } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
if (process.env.QA_DATABASE_NAME !== "internship_sprint4_test")
  throw new Error("Dedicated Sprint 4 container required");
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "postgres" || url.pathname !== "/internship_management")
  throw new Error("Unexpected database configuration");
url.pathname = "/internship_sprint4_test";
process.env.DATABASE_URL = url.toString();
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../.test-build/auth/password");
const db = new PrismaClient();
async function main() {
  const fixture = JSON.parse(
    readFileSync(
      path.join(
        __dirname,
        `../.local/${process.env.QA_BASELINE_NAME === "qa-sprint5-built" ? "qa-sprint5-built" : "qa-sprint4"}.json`,
      ),
      "utf8",
    ),
  );
  const suffix = randomUUID().slice(0, 8),
    password = randomUUID() + randomUUID();
  const passwordHash = await hashPassword(password);
  const output = await db.$transaction(async (tx) => {
    const coordinator = await tx.user.findUniqueOrThrow({
      where: { email: fixture.accounts.InternshipCoordinator },
    });
    const representative = await tx.user.findUniqueOrThrow({
      where: { email: fixture.accounts.Company },
    });
    const company = await tx.companyProfile.findUniqueOrThrow({
      where: { representativeUserId: representative.id },
    });
    const alternativeCompany = await tx.companyProfile.create({
      data: {
        name: `Doanh nghiệp thay thế E2E ${suffix}`,
        address: "Hà Nội QA",
        contactName: "Đại diện QA",
        contactEmail: `alternative-${suffix}@example.test`,
        contactPhone: "0000000000",
        isVerified: true,
      },
    });
    const supervisorUser = await tx.user.findUniqueOrThrow({
      where: { email: fixture.accounts.CompanySupervisor },
    });
    const supervisor = await tx.companySupervisorProfile.findUniqueOrThrow({
      where: { userId: supervisorUser.id },
    });
    async function student(label, credits) {
      const user = await tx.user.create({
        data: {
          email: `${label.toLowerCase()}-${suffix}@example.test`,
          fullName: `${label} ${suffix}`,
          passwordHash,
          roles: { create: { role: "Student" } },
        },
      });
      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          studentCode: `${label}-${suffix}`,
          fullName: user.fullName,
          email: user.email,
          className: "CNTT E2E",
          cohort: "2026",
          programCredits: 150,
          completedCredits: credits,
          isVerified: true,
        },
      });
      return { email: user.email, id: profile.id, name: user.fullName };
    }
    const registration = await student("DangKy", 130);
    const exception = await student("NgoaiLe", 100);
    const mentorUser = await tx.user.create({
      data: {
        email: `mentor-${suffix}@example.test`,
        fullName: `Giảng viên E2E ${suffix}`,
        passwordHash,
        roles: { create: { role: "FacultyMentor" } },
      },
    });
    const mentor = await tx.facultyProfile.create({
      data: {
        userId: mentorUser.id,
        facultyCode: `GV-${suffix}`,
        fullName: mentorUser.fullName,
        email: mentorUser.email,
        expertise: "CNTT",
        maxStudents: 10,
      },
    });
    const day = 86400000,
      now = Date.now();
    async function period(open) {
      const start = now + (open ? 3 : -1) * day;
      return tx.internshipPeriod.create({
        data: {
          name: `E2E ${open ? "đăng ký" : "xét duyệt"} ${suffix}`,
          coordinatorId: coordinator.id,
          registrationStartsAt: new Date(now - 10 * day),
          registrationEndsAt: new Date(now + (open ? 2 : -2) * day),
          startsAt: new Date(start),
          endsAt: new Date(start + 42 * day),
          weeklyReportCount: 6,
          weeklyDeadlines: Array.from(
            { length: 6 },
            (_, i) => new Date(start + (6 + i * 7) * day),
          ),
          gradingDeadline: new Date(start + 49 * day),
          finalizationDeadline: new Date(start + 56 * day),
          status: "Published",
        },
      });
    }
    const open = await period(true),
      closed = await period(false);
    const application = await tx.internshipApplication.create({
      data: {
        periodId: closed.id,
        studentId: exception.id,
        companyId: company.id,
        positionTitle: "Kiểm thử ngoại lệ",
        status: "Submitted",
        eligibilityPassed: false,
        eligibilityReason: "Chưa đạt 80% số tín chỉ yêu cầu.",
      },
    });
    return {
      ...fixture,
      password,
      accounts: {
        ...fixture.accounts,
        Student: exception.email,
        FacultyMentor: mentorUser.email,
      },
      staffPassword: fixture.password,
      registration,
      exception,
      openPeriod: { id: open.id, name: open.name },
      periodName: closed.name,
      periodId: closed.id,
      applicationId: application.id,
      mentorId: mentor.id,
      companyId: company.id,
      supervisorId: supervisor.id,
      alternativeCompanyId: alternativeCompany.id,
    };
  });
  writeFileSync(
    path.join(__dirname, "../.local/qa-sprint4-flow.json"),
    JSON.stringify(output, null, 2),
    { mode: 0o600 },
  );
  console.log("Fresh Sprint 4 flow fixtures created; credentials not logged.");
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

// Isolated browser QA fixture. Never points at the application database.
const { randomUUID } = require("node:crypto");
const {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "postgres" || url.pathname !== "/internship_management")
  throw new Error("Expected local Compose database configuration.");
const qaDatabase = process.env.QA_DATABASE_NAME || "internship_management_test";
if (!/^internship_[a-z0-9_]+_test$/.test(qaDatabase))
  throw new Error("Dedicated internship QA test database required");
url.pathname = `/${qaDatabase}`;
process.env.DATABASE_URL = url.toString();
process.env.APP_ORIGINS =
  "http://localhost:3100,http://127.0.0.1:3100,http://localhost:3200,http://127.0.0.1:3200";
process.env.NODE_ENV = "test";
const migration = spawnSync(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
if (migration.status !== 0) process.exit(1);
const { PrismaClient } = require("@prisma/client");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../.test-build/app.module");
const { configureApp } = require("../.test-build/configure-app");
const { hashPassword } = require("../.test-build/auth/password");
const db = new PrismaClient();
async function main() {
  const fixtureName = process.env.QA_FIXTURE_NAME || "qa-accounts";
  if (!/^qa-[a-z0-9-]+$/.test(fixtureName))
    throw new Error("Invalid QA fixture name");
  const existingPath = join(__dirname, `../.local/${fixtureName}.json`);
  const { PDFDocument } = require("pdf-lib");
  const sample = await PDFDocument.create();
  sample
    .addPage()
    .drawText("Sprint 2 - synthetic PDF report", { x: 40, y: 700, size: 18 });
  mkdirSync(join(__dirname, "../.local"), { recursive: true });
  writeFileSync(
    join(__dirname, "../.local/qa-report.pdf"),
    await sample.save(),
  );
  if (existsSync(existingPath)) {
    const prior = JSON.parse(readFileSync(existingPath, "utf8"));
    if (await db.internship.findUnique({ where: { id: prior.internshipId } })) {
      await db.$disconnect();
      if (process.env.QA_SEED_ONLY === "true") {
        console.log("QA fixtures ready; no HTTP server started.");
        return;
      }
      const app = await NestFactory.create(AppModule, { logger: false });
      configureApp(app);
      await app.listen(3001, "0.0.0.0");
      console.log("QA ready; reusing existing test fixtures.");
      return;
    }
  }
  const suffix = randomUUID().slice(0, 8),
    password = randomUUID() + randomUUID();
  const passwordHash = await hashPassword(password);
  const users = {};
  for (const role of [
    "Admin",
    "InternshipCoordinator",
    "FacultyManager",
    "FacultyMentor",
    "Company",
    "CompanySupervisor",
    "Student",
  ]) {
    users[role] = await db.user.create({
      data: {
        email: `qa-${role.toLowerCase()}-${suffix}@example.test`,
        fullName: `QA ${role}`,
        passwordHash,
        roles: { create: { role } },
      },
    });
  }
  const student = await db.studentProfile.create({
    data: {
      studentCode: `QA-${suffix}`,
      fullName: "Sinh viên kiểm thử",
      email: users.Student.email,
      className: "CNTT QA",
      cohort: "2026",
      programCredits: 150,
      completedCredits: 130,
      isVerified: true,
      userId: users.Student.id,
    },
  });
  const mentor = await db.facultyProfile.create({
    data: {
      facultyCode: `QA-${suffix}`,
      fullName: "Giảng viên kiểm thử",
      email: users.FacultyMentor.email,
      expertise: "CNTT",
      userId: users.FacultyMentor.id,
    },
  });
  const company = await db.companyProfile.create({
    data: {
      name: `Doanh nghiệp QA ${suffix}`,
      address: "Dữ liệu kiểm thử",
      contactName: "Đại diện QA",
      contactEmail: users.Company.email,
      contactPhone: "0000000000",
      representativeUserId: users.Company.id,
      isVerified: true,
    },
  });
  const supervisor = await db.companySupervisorProfile.create({
    data: {
      companyId: company.id,
      userId: users.CompanySupervisor.id,
      title: "Người hướng dẫn QA",
    },
  });
  const now = Date.now(),
    day = 86400000;
  const period = await db.internshipPeriod.create({
    data: {
      name: `Đợt QA ${suffix}`,
      coordinatorId: users.InternshipCoordinator.id,
      registrationStartsAt: new Date(now - 10 * day),
      registrationEndsAt: new Date(now - 2 * day),
      startsAt: new Date(now - day),
      endsAt: new Date(now + 41 * day),
      weeklyReportCount: 6,
      weeklyDeadlines: Array.from(
        { length: 6 },
        (_, i) => new Date(now + (6 + i * 7) * day),
      ),
      gradingDeadline: new Date(now + 48 * day),
      finalizationDeadline: new Date(now + 55 * day),
      status: "Published",
    },
  });
  const application = await db.internshipApplication.create({
    data: {
      periodId: period.id,
      studentId: student.id,
      companyId: company.id,
      positionTitle: "Lập trình QA",
      status: "Approved",
      eligibilityPassed: true,
    },
  });
  const internship = await db.internship.create({
    data: {
      applicationId: application.id,
      studentId: student.id,
      companyId: company.id,
      facultyMentorId: mentor.id,
      periodId: period.id,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      eligibilitySnapshot: {},
      companySupervisorAssignments: { create: { supervisorId: supervisor.id } },
    },
  });
  const folder = join(__dirname, "../.local");
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    existingPath,
    JSON.stringify(
      {
        password,
        accounts: Object.fromEntries(
          Object.entries(users).map(([role, user]) => [role, user.email]),
        ),
        internshipId: internship.id,
        periodName: period.name,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await db.$disconnect();
  if (process.env.QA_SEED_ONLY === "true") {
    console.log("QA fixtures created; no HTTP server started.");
    return;
  }
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(3001, "0.0.0.0");
  console.log(
    `QA ready on isolated test database; credentials in .local/${fixtureName}.json (not logged).`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

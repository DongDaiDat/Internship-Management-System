// Explicitly requested, memorable local showcase accounts. Never run in production.
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../dist/auth/password");
const fs = require("node:fs");
const path = require("node:path");

if (
  process.env.NODE_ENV === "production" ||
  process.env.DEMO_SHOWCASE_CONFIRM !== "local-only"
)
  throw new Error(
    "Showcase seed is local-only. Set DEMO_SHOWCASE_CONFIRM=local-only explicitly.",
  );
const databaseUrl = new URL(process.env.DATABASE_URL);
if (databaseUrl.hostname !== "postgres")
  throw new Error(
    "Showcase seed requires the local Docker PostgreSQL service.",
  );

const db = new PrismaClient();
const password = process.env.DEMO_PASSWORD || "Phenikaa@2026";
if (password.length < 12 || password.length > 128)
  throw new Error("DEMO_PASSWORD must contain 12-128 characters.");

const accountDefinitions = [
  ["Admin", "admin.demo@interna.local", "Quản trị viên Demo"],
  ["FacultyManager", "truongkhoa.demo@interna.local", "Trưởng khoa Demo"],
  [
    "InternshipCoordinator",
    "dieuphoi.demo@interna.local",
    "Điều phối viên Demo",
  ],
  ["FacultyMentor", "giangvien.demo@interna.local", "Giảng viên Demo"],
  ["Company", "doanhnghiep.demo@interna.local", "Đại diện doanh nghiệp Demo"],
  [
    "CompanySupervisor",
    "huongdan.demo@interna.local",
    "Người hướng dẫn doanh nghiệp Demo",
  ],
  ["Student", "sinhvien.demo@interna.local", "Nguyễn Sinh Viên Demo"],
];

async function main() {
  const hashes = await Promise.all(
    accountDefinitions.map(() => hashPassword(password)),
  );
  const result = await db.$transaction(async (tx) => {
    const users = {};
    for (let index = 0; index < accountDefinitions.length; index += 1) {
      const [role, email, fullName] = accountDefinitions[index];
      const user = await tx.user.upsert({
        where: { email },
        create: {
          email,
          fullName,
          passwordHash: hashes[index],
          isActive: true,
          mustChangePassword: false,
          roles: { create: { role } },
        },
        update: {
          fullName,
          passwordHash: hashes[index],
          isActive: true,
          mustChangePassword: false,
        },
      });
      // These reserved *.demo@interna.local accounts intentionally map one-to-one to actors.
      await tx.userRole.deleteMany({
        where: { userId: user.id, role: { not: role } },
      });
      await tx.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        create: { userId: user.id, role },
        update: {},
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      users[role] = user;
    }

    const student = await tx.studentProfile.upsert({
      where: { studentCode: "DEMO-SV-001" },
      create: {
        studentCode: "DEMO-SV-001",
        fullName: users.Student.fullName,
        email: users.Student.email,
        className: "K16-CNTT-DEMO",
        cohort: "2026",
        major: "Công nghệ thông tin",
        programCredits: 150,
        completedCredits: 132,
        hasMandatoryCourseDebt: false,
        isVerified: true,
        verifiedAt: new Date(),
        userId: users.Student.id,
      },
      update: {
        fullName: users.Student.fullName,
        userId: users.Student.id,
        isVerified: true,
        hasMandatoryCourseDebt: false,
      },
    });
    const mentor = await tx.facultyProfile.upsert({
      where: { facultyCode: "DEMO-GV-001" },
      create: {
        facultyCode: "DEMO-GV-001",
        fullName: users.FacultyMentor.fullName,
        email: users.FacultyMentor.email,
        expertise: "Phát triển phần mềm và hệ thống thông tin",
        maxStudents: 10,
        isActive: true,
        userId: users.FacultyMentor.id,
      },
      update: {
        fullName: users.FacultyMentor.fullName,
        userId: users.FacultyMentor.id,
        isActive: true,
        maxStudents: 10,
      },
    });
    const company = await tx.companyProfile.upsert({
      where: { taxCode: "DEMO010001" },
      create: {
        name: "Công ty Công nghệ Phenikaa Demo",
        taxCode: "DEMO010001",
        address: "Hà Đông, Hà Nội",
        website: "https://example.com",
        contactName: users.Company.fullName,
        contactEmail: users.Company.email,
        contactPhone: "0900000001",
        isVerified: true,
        representativeUserId: users.Company.id,
      },
      update: {
        representativeUserId: users.Company.id,
        isVerified: true,
        contactName: users.Company.fullName,
        contactEmail: users.Company.email,
      },
    });
    const supervisor = await tx.companySupervisorProfile.upsert({
      where: { userId: users.CompanySupervisor.id },
      create: {
        userId: users.CompanySupervisor.id,
        companyId: company.id,
        title: "Kỹ sư hướng dẫn",
      },
      update: { companyId: company.id, title: "Kỹ sư hướng dẫn" },
    });

    let period = await tx.internshipPeriod.findUnique({
      where: { name: "DEMO - Đợt thực tập đang diễn ra" },
    });
    if (!period) {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      period = await tx.internshipPeriod.create({
        data: {
          name: "DEMO - Đợt thực tập đang diễn ra",
          coordinatorId: users.InternshipCoordinator.id,
          registrationStartsAt: new Date(now - 14 * day),
          registrationEndsAt: new Date(now - 2 * day),
          startsAt: new Date(now - day),
          endsAt: new Date(now + 55 * day),
          weeklyReportCount: 8,
          weeklyDeadlines: Array.from(
            { length: 8 },
            (_, week) => new Date(now + (6 + week * 7) * day),
          ),
          gradingDeadline: new Date(now + 62 * day),
          finalizationDeadline: new Date(now + 69 * day),
          creditThresholdPercent: 80,
          status: "Published",
        },
      });
    } else if (!period.coordinatorId) {
      // Assigning responsibility does not modify the immutable published schedule.
      period = await tx.internshipPeriod.update({
        where: { id: period.id },
        data: { coordinatorId: users.InternshipCoordinator.id },
      });
    }

    const application = await tx.internshipApplication.upsert({
      where: {
        periodId_studentId: { periodId: period.id, studentId: student.id },
      },
      create: {
        periodId: period.id,
        studentId: student.id,
        companyId: company.id,
        positionTitle: "Thực tập sinh phát triển phần mềm",
        eligibilityPassed: true,
        status: "Approved",
        submittedAt: period.registrationEndsAt,
        reviewedAt: period.startsAt,
        reviewNote: "Hồ sơ demo đã được phê duyệt.",
      },
      update: {},
    });
    const internship = await tx.internship.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        periodId: period.id,
        studentId: student.id,
        companyId: company.id,
        facultyMentorId: mentor.id,
        eligibilitySnapshot: {
          verified: true,
          accountActive: true,
          completedCredits: student.completedCredits,
          programCredits: student.programCredits,
          threshold: period.creditThresholdPercent,
          hasMandatoryCourseDebt: false,
          showcase: true,
        },
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      },
      update: {},
    });
    await tx.companySupervisorAssignment.upsert({
      where: {
        internshipId_supervisorId: {
          internshipId: internship.id,
          supervisorId: supervisor.id,
        },
      },
      create: { internshipId: internship.id, supervisorId: supervisor.id },
      update: {},
    });
    await tx.weeklyReport.upsert({
      where: {
        internshipId_weekNumber: { internshipId: internship.id, weekNumber: 1 },
      },
      create: {
        internshipId: internship.id,
        weekNumber: 1,
        content:
          "Tuần đầu: làm quen doanh nghiệp, môi trường phát triển và yêu cầu dự án.",
        status: "Submitted",
        submittedAt: new Date(),
      },
      update: {},
    });
    await tx.auditLog.create({
      data: {
        actorId: users.Admin.id,
        action: "demo.showcase_seed",
        targetId: internship.id,
        reason:
          "Tạo/cập nhật dữ liệu trải nghiệm local theo yêu cầu người dùng.",
      },
    });
    return { period, internship };
  });

  const outputDirectory = path.resolve(__dirname, "../.local");
  const outputPath = path.join(outputDirectory, "showcase-accounts.txt");
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    outputPath,
    [
      "TÀI KHOẢN TRẢI NGHIỆM LOCAL — KHÔNG DÙNG CHO PRODUCTION",
      `Mật khẩu chung: ${password}`,
      "",
      ...accountDefinitions.map(
        ([role, email, fullName]) => `${role}: ${email} — ${fullName}`,
      ),
      "",
      `Đợt: ${result.period.name}`,
      `Internship ID: ${result.internship.id}`,
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(
    "Created/updated 7 local showcase actors. Credentials saved to /app/.local/showcase-accounts.txt.",
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { hashPassword } = require("../dist/auth/password");
const { seedAcademic } = require("./seed-academic.cjs");
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production") throw Error("Local demonstration only");
  const path = join(__dirname, "../.local/upgrade-demo.json");
  if (existsSync(path)) { console.log("Existing local demo credentials retained."); return; }
  const departments = await seedAcademic(db), departmentId = departments.HTTT.id;
  const program = await db.trainingProgram.findUnique({ where: { code: "ICT1" } });
  const cohort = await db.cohort.findUnique({ where: { code: "K17" } });
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);
  const names = { Admin: "Quản trị Phenikaa", InternshipCoordinator: "Nguyễn Thu Hà", FacultyManager: "Trần Hoàng Nam", FacultyMentor: "Nguyễn Thanh Bình", Student: "Minh Anh", Company: "Đại diện Công ty Công nghệ", CompanySupervisor: "Lê Quang Huy" };
  const accounts = {};
  for (const [role, fullName] of Object.entries(names)) {
    const email = `${role.toLowerCase()}@phenikaa-demo.local`;
    accounts[role] = await db.user.create({ data: { fullName, email, departmentId: role === "Admin" ? null : departmentId, passwordHash, roles: { create: { role } } } });
  }
  const mentor = await db.facultyProfile.create({ data: { userId: accounts.FacultyMentor.id, departmentId, facultyCode: "DEMO-GV26", fullName: names.FacultyMentor, email: accounts.FacultyMentor.email, expertise: "Công nghệ phần mềm", maxStudents: 15 } });
  const company = await db.companyProfile.create({ data: { representativeUserId: accounts.Company.id, departmentId, name: "Công ty Công nghệ Phenikaa (minh họa)", address: "Hà Nội", contactName: names.Company, contactEmail: accounts.Company.email, contactPhone: "0901234567", isVerified: true } });
  const supervisor = await db.companySupervisorProfile.create({ data: { userId: accounts.CompanySupervisor.id, companyId: company.id, title: "Trưởng nhóm phát triển" } });
  const code = await db.studentProfile.findUnique({ where: { studentCode: "23010877" } }) ? "DEMO-23010877" : "23010877";
  const student = await db.studentProfile.create({ data: { userId: accounts.Student.id, studentCode: code, departmentId, majorId: program.majorId, programId: program.id, cohortId: cohort.id, major: "Công nghệ thông tin", cohort: "K17", className: "K17-CNTT1", fullName: names.Student, email: accounts.Student.email, programCredits: 150, completedCredits: 130, isVerified: true } });
  const day = 86400000, date = n => new Date(Date.now() + n * day);
  const period = await db.internshipPeriod.create({ data: { departmentId, roundNumber: 90, semester: 1, academicYear: "2026-2027", name: "90_HK1_2026-2027", coordinatorId: accounts.InternshipCoordinator.id, status: "Published", registrationStartsAt: date(-20), registrationEndsAt: date(-8), startsAt: date(-7), endsAt: date(42), weeklyReportCount: 6, weeklyDeadlines: [0, 7, 14, 21, 28, 35].map(date), gradingDeadline: date(49), finalizationDeadline: date(56), audience: { create: { majorId: program.majorId, cohortId: cohort.id } } } });
  const application = await db.internshipApplication.create({ data: { periodId: period.id, studentId: student.id, companyId: company.id, positionTitle: "Thực tập sinh Fullstack", eligibilityPassed: true, status: "Approved", submittedAt: date(-12), reviewedAt: date(-8) } });
  const internship = await db.internship.create({ data: { applicationId: application.id, periodId: period.id, studentId: student.id, companyId: company.id, facultyMentorId: mentor.id, startsAt: period.startsAt, endsAt: period.endsAt, eligibilitySnapshot: { department: departments.HTTT.name, major: "Công nghệ thông tin", program: "ICT1", cohort: "K17" } } });
  await db.companySupervisorAssignment.create({ data: { internshipId: internship.id, supervisorId: supervisor.id } });
  await db.weeklyReport.create({ data: { internshipId: internship.id, weekNumber: 1, content: "Tìm hiểu quy trình phát triển, thiết kế cơ sở dữ liệu và xây dựng giao diện quản lý tài khoản.", status: "Submitted" } });
  for (let i = 1; i <= 3; i++) await db.studentProfile.create({ data: { studentCode: `DEMO-PENDING-${i}`, departmentId, majorId: program.majorId, programId: program.id, cohortId: cohort.id, major: "Công nghệ thông tin", cohort: "K17", className: "K17-CNTT1", fullName: ["Nguyễn Ngọc Linh", "Trần Đức Anh", "Phạm Hải Yến"][i - 1], email: `pending${i}@phenikaa-demo.local`, programCredits: 150, completedCredits: 125, isVerified: true } });
  mkdirSync(join(__dirname, "../.local"), { recursive: true });
  writeFileSync(path, JSON.stringify({ password, accounts: Object.fromEntries(Object.entries(accounts).map(([role, a]) => [role, { id: a.id, email: a.email }])), periodId: period.id }, null, 2), { mode: 0o600 });
  console.log("Local demo ready. Credentials saved to backend/.local/upgrade-demo.json (not printed).");
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());

// Local-only demonstration accounts and reviewable scenarios; never production data.
const { PrismaClient } = require("@prisma/client");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { hashPassword } = require("../dist/auth/password");
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production") throw Error("Local demo only");
  const dir = join(__dirname, "../.local");
  const fixture = JSON.parse(readFileSync(join(dir, "upgrade-demo.json"), "utf8"));
  const passwordHash = await hashPassword(fixture.password);
  for (const account of Object.values(fixture.accounts)) {
    if (!account.email.endsWith("@phenikaa-demo.local")) throw Error("Unexpected demo email");
    await db.user.update({ where: { id: account.id, email: account.email }, data: { passwordHash, isActive: true, mustChangePassword: false } });
    await db.session.deleteMany({ where: { userId: account.id } });
  }
  const marker = join(dir, "demo-scenarios.json");
  let extra;
  if (existsSync(marker)) extra = JSON.parse(readFileSync(marker, "utf8"));
  else {
    extra = await db.$transaction(async tx => {
      const owner = await tx.user.findUniqueOrThrow({ where: { id: fixture.accounts.InternshipCoordinator.id } });
      const departmentId = owner.departmentId;
      const program = await tx.trainingProgram.findUniqueOrThrow({ where: { code: "ICT1" } });
      const cohort = await tx.cohort.findUniqueOrThrow({ where: { code: "K17" } });
      const mentor = await tx.facultyProfile.findUniqueOrThrow({ where: { userId: fixture.accounts.FacultyMentor.id } });
      const company = await tx.companyProfile.findUniqueOrThrow({ where: { representativeUserId: fixture.accounts.Company.id } });
      const supervisor = await tx.companySupervisorProfile.findUniqueOrThrow({ where: { userId: fixture.accounts.CompanySupervisor.id } });
      const date = n => new Date(Date.now() + n * 86400000);
      const year = `${new Date().getFullYear()}-${new Date().getFullYear()+1}`;
      async function period(round, open) {
        return tx.internshipPeriod.create({ data: { departmentId, coordinatorId: owner.id, roundNumber: round, semester: 1, academicYear: year, name: `${round}_HK1_${year}`, status: "Published", registrationStartsAt: date(-3), registrationEndsAt: date(open ? 7 : -1), startsAt: date(open ? 8 : 0), endsAt: date(50), weeklyReportCount: 6, weeklyDeadlines: [14,21,28,35,42,49].map(date), gradingDeadline: date(57), finalizationDeadline: date(64), audience: { create: { majorId: program.majorId, cohortId: cohort.id } } } });
      }
      const openPeriod = await period(91, true), reviewPeriod = await period(92, false);
      const entries = [];
      for (const [key, fullName, credits] of [["register", "Lê Khánh An · demo đăng ký", 130], ["approve", "Nguyễn Hoàng Anh · demo duyệt", 130], ["exception", "Trần Ngọc Mai · demo ngoại lệ", 100], ["grade", "Phạm Minh Đức · demo chốt điểm", 135]]) {
        const email = `${key}@phenikaa-demo.local`;
        const user = await tx.user.create({ data: { email, fullName, passwordHash, departmentId, roles: { create: { role: "Student" } } } });
        const student = await tx.studentProfile.create({ data: { userId: user.id, studentCode: `DEMO-${key.toUpperCase()}`, fullName, email, departmentId, majorId: program.majorId, programId: program.id, cohortId: cohort.id, major: "Công nghệ thông tin", cohort: "K17", className: "K17-CNTT1", programCredits: 150, completedCredits: credits, isVerified: true } });
        entries.push({ key, id: user.id, email });
        if (key === "register") continue;
        const application = await tx.internshipApplication.create({ data: { studentId: student.id, periodId: reviewPeriod.id, companyId: company.id, positionTitle: "Thực tập sinh lập trình", status: key === "grade" ? "Approved" : "Submitted", eligibilityPassed: credits >= 120, submittedAt: date(-2), ...(key === "exception" ? { eligibilityReason: "Chưa đủ 80% tín chỉ", exceptionRequest: { create: { reason: "Sinh viên đã hoàn thành học phần chuyên ngành và xin xét ngoại lệ thực tập (dữ liệu minh họa)." } } } : {}) } });
        if (key === "grade") {
          const internship = await tx.internship.create({ data: { applicationId: application.id, periodId: reviewPeriod.id, studentId: student.id, companyId: company.id, facultyMentorId: mentor.id, startsAt: reviewPeriod.startsAt, endsAt: reviewPeriod.endsAt, eligibilitySnapshot: { demonstration: true, departmentId, majorId: program.majorId, programId: program.id, cohortId: cohort.id } } });
          await tx.companySupervisorAssignment.create({ data: { internshipId: internship.id, supervisorId: supervisor.id } });
          await tx.supervisorEvaluation.create({ data: { internshipId: internship.id, supervisorId: supervisor.id, discipline: 2, responsibility: 2, knowledge: 2, outcome: 2, total: 8, enteredById: fixture.accounts.CompanySupervisor.id } });
          await tx.facultyEvaluation.create({ data: { internshipId: internship.id, score: 9, note: "Điểm minh họa để kiểm tra thao tác chốt điểm" } });
        }
      }
      return { entries, openPeriod: openPeriod.name, reviewPeriod: reviewPeriod.name };
    }, { timeout: 30000 });
    writeFileSync(marker, JSON.stringify(extra, null, 2));
  }
  const labels = { Admin: "Admin", FacultyManager: "Trưởng khoa", InternshipCoordinator: "Điều phối viên", FacultyMentor: "Giảng viên", Student: "Sinh viên", Company: "Đại diện doanh nghiệp", CompanySupervisor: "Người hướng dẫn doanh nghiệp" };
  const rows = Object.entries(labels).map(([role, label]) => `| ${label} | ${fixture.accounts[role].email} |`);
  const text = `# Tài khoản demo Phenikaa\n\nỨng dụng: http://localhost:3000\n\nMật khẩu chung của bảy actor: \`${fixture.password}\`\n\n| Vai trò | Email |\n|---|---|\n${rows.join("\n")}\n\nCác tài khoản demo đã sẵn sàng vào nghiệp vụ, không bắt đổi mật khẩu. Tài khoản cấp mới bằng ứng dụng vẫn bắt đổi lần đầu. Dùng cửa sổ ẩn danh/profile trình duyệt riêng khi kiểm thử nhiều vai trò đồng thời.\n\n## Kịch bản có sẵn\n\n- Admin: 3 hồ sơ chờ cấp; tạo thủ công, cấp hàng loạt, reset và đổi vai trò.\n- Điều phối: hồ sơ khoa HTTT, doanh nghiệp, đợt mở đăng ký ${extra.openPeriod}; tạo/import theo mẫu của ứng dụng.\n- Trưởng khoa: đợt ${extra.reviewPeriod} có một hồ sơ chờ duyệt, một ngoại lệ và một sinh viên đủ điểm để chốt (8 doanh nghiệp, 9 giảng viên → 8,5).\n- Sinh viên Minh Anh: có thực tập và báo cáo tuần; giảng viên nhận xét, người hướng dẫn doanh nghiệp chấm điểm.\n- Sinh viên bổ sung: ${extra.entries.map(e => `\`${e.email}\` (${e.key})`).join(", ")}. Mật khẩu cùng giá trị trên ở lần khởi tạo. Tài khoản register chưa có thực tập, dùng để thử đăng ký đợt ${extra.openPeriod}.\n\nDữ liệu minh họa độc lập, không phải hồ sơ thật. Các thao tác kiểm thử được lưu; script không đặt lại tiến độ đã thao tác khi chạy lại. File này nằm trong .local, bị loại khỏi Git.\n`;
  writeFileSync(join(dir, "DEMO_ACCOUNTS.md"), text, { mode: 0o600 });
  console.log("Seven actor accounts ready; four student scenarios and local handover document prepared. No passwords printed.");
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());

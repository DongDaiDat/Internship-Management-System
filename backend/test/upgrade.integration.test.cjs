const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../.test-build/app.module");
const { configureApp } = require("../.test-build/configure-app");
const {
  hashPassword,
  verifyPassword,
} = require("../.test-build/auth/password");
const {
  matchesAudience,
} = require("../.test-build/internships/academic.service");
const { seedAcademic } = require("../scripts/seed-academic.cjs");
const ExcelJS = require("exceljs");
if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
  throw Error("Dedicated test database required");
const db = new PrismaClient(),
  suffix = randomUUID(),
  pass = randomUUID() + "Aa1!";
let app,
  base,
  dep,
  other,
  program,
  cohort,
  users = {},
  cookies = {},
  createdStudent;
const day = 86400000;
async function call(
  path,
  role,
  body,
  expected = 200,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      ...(role ? { Cookie: cookies[role] } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${response.status} ${text.slice(0, 150)}`,
  );
  return text ? JSON.parse(text) : null;
}
async function login(email, password) {
  const r = await fetch(base + "/auth/login", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
function periodDto(round = 1) {
  const date = (n) => new Date(Date.now() + n * day).toISOString();
  return {
    departmentId: dep.id,
    roundNumber: round,
    semester: 1,
    academicYear: "2026-2027",
    audience: [{ majorId: program.majorId, cohortId: cohort.id }],
    registrationStartsAt: date(1),
    registrationEndsAt: date(2),
    startsAt: date(3),
    endsAt: date(50),
    weeklyReportCount: 6,
    weeklyDeadlines: [10, 17, 24, 31, 38, 45].map(date),
    gradingDeadline: date(55),
    finalizationDeadline: date(60),
    creditThresholdPercent: 80,
  };
}
before(async () => {
  await seedAcademic(db);
  dep = await db.department.create({
    data: { code: "T" + suffix.slice(0, 12), name: "Khoa kiểm thử" },
  });
  other = await db.department.create({
    data: { code: "O" + suffix.slice(0, 12), name: "Khoa khác" },
  });
  program = await db.trainingProgram.findUnique({ where: { code: "ICT1" } });
  cohort = await db.cohort.findUnique({ where: { code: "K17" } });
  for (const d of [dep, other])
    await db.departmentProgram.create({
      data: {
        departmentId: d.id,
        programId: program.id,
        confirmed: true,
        source: "https://example.test/catalog",
      },
    });
  const passwordHash = await hashPassword(pass);
  for (const role of [
    "Admin",
    "InternshipCoordinator",
    "FacultyManager",
    "FacultyMentor",
    "Student",
  ]) {
    users[role] = await db.user.create({
      data: {
        email: `${role.toLowerCase()}-${suffix}@example.test`,
        fullName: role,
        departmentId: dep.id,
        passwordHash,
        roles: { create: { role } },
      },
    });
  }
  users.other = await db.user.create({
    data: {
      email: `other-${suffix}@example.test`,
      fullName: "Trưởng khoa khác",
      departmentId: other.id,
      passwordHash,
      roles: { create: { role: "FacultyManager" } },
    },
  });
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api";
  for (const [r, user] of Object.entries(users))
    cookies[r] = await login(user.email, pass);
});
after(async () => {
  if (app) await app.close();
  await db.$disconnect();
});
test("temporary passwords: manual create, force change, reset revokes sessions, no plaintext persistence", async () => {
  const account = await call(
    "/users",
    "Admin",
    {
      email: `manual-${suffix}@example.test`,
      fullName: "Tài khoản mới",
      roles: ["Student"],
    },
    201,
  );
  assert.ok(account.temporaryPassword.length >= 20);
  assert.equal(account.mustChangePassword, true);
  const stored = await db.user.findUnique({ where: { id: account.id } });
  assert.ok(
    await verifyPassword(account.temporaryPassword, stored.passwordHash),
  );
  cookies.new = await login(account.email, account.temporaryPassword);
  await call("/academic", "new", undefined, 403);
  await call(
    "/auth/change-password",
    "new",
    { currentPassword: account.temporaryPassword, password: pass },
    204,
  );
  await call("/academic", "new");
  const reset = await call(
    `/users/${account.id}/reset-password`,
    "Admin",
    {},
    201,
  );
  assert.notEqual(reset.temporaryPassword, account.temporaryPassword);
  await call("/auth/me", "new", undefined, 401);
  const listing = await call("/users", "Admin");
  assert.ok(!JSON.stringify(listing).includes(reset.temporaryPassword));
  const audits = await db.auditLog.findMany({
    where: { targetId: account.id },
  });
  assert.ok(!JSON.stringify(audits).includes(reset.temporaryPassword));
});
test("role matrix and department scope are enforced by HTTP endpoints", async () => {
  await call("/internship-periods", "Admin", periodDto(1), 403);
  await call("/internship-periods", "FacultyManager", periodDto(1), 403);
  await call(
    "/users",
    "InternshipCoordinator",
    {
      email: `bad-${suffix}@example.test`,
      fullName: "Test",
      roles: ["Student"],
    },
    403,
  );
  await call("/profiles/students", "FacultyManager", { data: {} }, 403);
  await call(
    `/internship-applications/${randomUUID()}/approve`,
    "InternshipCoordinator",
    { facultyMentorId: randomUUID() },
    403,
  );
  await call(
    `/internships/${randomUUID()}/lock-grade`,
    "InternshipCoordinator",
    {},
    403,
  );
  const period = await call(
    "/internship-periods",
    "InternshipCoordinator",
    periodDto(1),
    201,
  );
  assert.equal(period.name, "1_HK1_2026-2027");
  await call("/internship-periods", "InternshipCoordinator", periodDto(1), 409);
  await call(
    `/internship-periods/${period.id}/coordinator`,
    "other",
    {
      coordinatorId: users.InternshipCoordinator.id,
      reason: "Không cùng khoa",
    },
    403,
  );
  await call(
    `/reports/progress?periodId=${period.id}`,
    "other",
    undefined,
    403,
  );
  const otherList = await call("/internship-periods", "other");
  assert.ok(!otherList.some((p) => p.id === period.id));
  await call(
    `/internship-periods/${period.id}/publish`,
    "InternshipCoordinator",
    {},
    201,
  );
  await call(
    `/internship-periods/${period.id}/update`,
    "InternshipCoordinator",
    periodDto(1),
    409,
  );
  await db.internshipPeriod.create({
    data: {
      ...periodDto(1),
      audience: { create: periodDto().audience },
      departmentId: other.id,
      name: period.name,
    },
  });
});
test("legacy academic completion preserves dates and becomes immutable", async () => {
  const dto = periodDto(92);
  const { audience, roundNumber, semester, academicYear, ...schedule } = dto;
  const legacy = await db.internshipPeriod.create({
    data: {
      ...schedule,
      name: "Legacy test",
      coordinatorId: users.InternshipCoordinator.id,
      status: "Published",
    },
  });
  const body = {
    departmentId: dep.id,
    audience,
    roundNumber,
    semester,
    academicYear,
  };
  await call(
    `/internship-periods/${legacy.id}/complete-academic`,
    "Admin",
    body,
    403,
  );
  await call(
    `/internship-periods/${legacy.id}/complete-academic`,
    "other",
    body,
    403,
  );
  const completed = await call(
    `/internship-periods/${legacy.id}/complete-academic`,
    "InternshipCoordinator",
    body,
    201,
  );
  assert.equal(completed.name, "92_HK1_2026-2027");
  assert.equal(completed.startsAt, legacy.startsAt.toISOString());
  assert.equal(completed.status, "Published");
  await call(
    `/internship-periods/${legacy.id}/complete-academic`,
    "InternshipCoordinator",
    body,
    409,
  );
});
test("import → verify → bulk provision is concurrent-safe and rejects duplicates", async () => {
  const template = await fetch(base + "/imports/template?type=Students", {
    headers: { Cookie: cookies.InternshipCoordinator },
  });
  // Use the exact current import headers, including programCode.
  if (!template.ok)
    throw Error("Template route not available: " + template.status);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await template.arrayBuffer()));
  const sheet = book.worksheets[0];
  const data = {
    studentCode: suffix.slice(0, 20),
    fullName: "Minh Anh kiểm thử",
    email: `import-${suffix}@example.test`,
    className: "K17-CNTT",
    cohort: "K17",
    major: "Công nghệ thông tin",
    programCode: "ICT1",
    programCredits: 150,
    completedCredits: 130,
    hasMandatoryCourseDebt: false,
  };
  const headers = sheet.getRow(1).values.slice(1);
  sheet.spliceRows(2, sheet.rowCount);
  sheet.addRow(headers.map((h) => data[h] ?? ""));
  const form = new FormData();
  form.append(
    "file",
    new Blob([await book.xlsx.writeBuffer()]),
    "students.xlsx",
  );
  const response = await fetch(base + "/imports/preview?type=Students", {
    method: "POST",
    headers: {
      Cookie: cookies.InternshipCoordinator,
      Origin: "http://localhost:3000",
    },
    body: form,
  });
  assert.equal(response.status, 201);
  const preview = await response.json();
  assert.deepEqual(preview.errors, []);
  await db.user.update({ where: { id: users.InternshipCoordinator.id }, data: { departmentId: other.id } });
  try {
    await call(`/imports/${preview.batchId}/confirm`, "InternshipCoordinator", {}, 403);
  } finally {
    await db.user.update({ where: { id: users.InternshipCoordinator.id }, data: { departmentId: dep.id } });
  }
  await call(
    `/imports/${preview.batchId}/confirm`,
    "InternshipCoordinator",
    {},
    201,
  );
  createdStudent = await db.studentProfile.findUnique({
    where: { studentCode: data.studentCode },
  });
  assert.equal(createdStudent.departmentId, dep.id);
  await call(
    `/students/${createdStudent.id}/verify`,
    "InternshipCoordinator",
    {},
    204,
  );
  const pending = await call(
    `/users/pending?importBatchId=${preview.batchId}`,
    "Admin",
  );
  assert.equal(pending.length, 1);
  assert.equal(pending[0].ready, true);
  const body = { items: [{ id: createdStudent.id, type: "student" }] };
  const outcomes = await Promise.all([
    call("/users/provision", "Admin", body, 201),
    call("/users/provision", "Admin", body, 201),
  ]);
  assert.equal(
    outcomes.reduce((n, r) => n + r.created, 0),
    1,
  );
  assert.equal(
    outcomes.reduce((n, r) => n + r.skipped, 0),
    1,
  );
  const credential = outcomes
    .flatMap((r) => r.results)
    .find((r) => r.temporaryPassword);
  cookies.imported = await login(
    credential.email,
    credential.temporaryPassword,
  );
  await call(
    "/auth/change-password",
    "imported",
    { currentPassword: credential.temporaryPassword, password: pass },
    204,
  );
  createdStudent = await db.studentProfile.findUnique({
    where: { id: createdStudent.id },
  });
  const clash = await db.studentProfile.create({
    data: {
      ...data,
      studentCode: suffix.slice(0, 19) + "X",
      email: users.Admin.email,
      departmentId: dep.id,
      majorId: program.majorId,
      programId: program.id,
      cohortId: cohort.id,
      isVerified: true,
      programCode: undefined,
    },
  });
  const failure = await call(
    "/users/provision",
    "Admin",
    { items: [{ id: clash.id, type: "student" }] },
    201,
  );
  assert.equal(failure.failed, 1);
});
test("audience groups are OR of complete tuples, never cross-product", () => {
  const p = {
    departmentId: "d",
    audience: [
      { majorId: "m1", cohortId: "k1" },
      { majorId: "m2", cohortId: "k2", programId: "p2" },
    ],
  };
  assert.equal(
    matchesAudience(
      { departmentId: "d", majorId: "m1", cohortId: "k2", programId: "p1" },
      p,
    ),
    false,
  );
  assert.equal(
    matchesAudience(
      { departmentId: "d", majorId: "m2", cohortId: "k2", programId: "p1" },
      p,
    ),
    false,
  );
  assert.equal(
    matchesAudience(
      { departmentId: "d", majorId: "m1", cohortId: "k1", programId: "p1" },
      p,
    ),
    true,
  );
  assert.equal(
    matchesAudience(
      { departmentId: "other", majorId: "m1", cohortId: "k1", programId: "p1" },
      p,
    ),
    false,
  );
});
test("register → approve with current audience; no out-of-department approvals or file access", async () => {
  assert.ok(createdStudent?.userId);
  const mentor = await db.facultyProfile.create({
    data: {
      userId: users.FacultyMentor.id,
      departmentId: dep.id,
      facultyCode: suffix.slice(0, 22),
      fullName: "Giảng viên",
      email: users.FacultyMentor.email,
      expertise: "CNTT",
    },
  });
  const company = await db.companyProfile.create({
    data: {
      departmentId: dep.id,
      name: suffix,
      address: "Hà Nội",
      contactName: "Đại diện",
      contactEmail: `company-${suffix}@example.test`,
      contactPhone: "0901234567",
      isVerified: true,
    },
  });
  const dto = periodDto(2);
  const period = await call(
    "/internship-periods",
    "InternshipCoordinator",
    dto,
    201,
  );
  await call(
    `/internship-periods/${period.id}/publish`,
    "InternshipCoordinator",
    {},
    201,
  );
  await db.internshipPeriod.update({
    where: { id: period.id },
    data: { registrationStartsAt: new Date(Date.now() - day) },
  });
  const application = await call(
    "/internship-applications",
    "imported",
    {
      periodId: period.id,
      companyId: company.id,
      positionTitle: "Lập trình viên",
    },
    201,
  );
  const foreignCompany = await db.companyProfile.create({
    data: {
      departmentId: other.id,
      name: `Foreign ${suffix}`,
      address: "Hà Nội",
      contactName: "Test",
      contactEmail: `foreign-${suffix}@example.test`,
      contactPhone: "0901234567",
      isVerified: true,
    },
  });
  await call(
    "/internship-applications",
    "imported",
    {
      periodId: period.id,
      companyId: foreignCompany.id,
      positionTitle: "Kiểm tra phạm vi",
    },
    400,
  );
  await call(
    `/internship-applications/${application.id}/approve`,
    "other",
    { facultyMentorId: mentor.id },
    403,
  );
  await db.internshipPeriod.update({
    where: { id: period.id },
    data: {
      registrationEndsAt: new Date(Date.now() - 1000),
      startsAt: new Date(Date.now() - 500),
    },
  });
  await db.studentProfile.update({
    where: { id: createdStudent.id },
    data: {
      cohortId: (await db.cohort.findUnique({ where: { code: "K18" } })).id,
    },
  });
  await call(
    `/internship-applications/${application.id}/approve`,
    "FacultyManager",
    { facultyMentorId: mentor.id },
    403,
  );
  await db.studentProfile.update({
    where: { id: createdStudent.id },
    data: { cohortId: cohort.id },
  });
  const internship = await call(
    `/internship-applications/${application.id}/approve`,
    "FacultyManager",
    { facultyMentorId: mentor.id },
    201,
  );
  assert.equal(internship.eligibilitySnapshot.cohort, "K17");
  await call(`/internships/${internship.id}/files`, "Admin", undefined, 403);
  await call(`/internships/${internship.id}/files`, "other", undefined, 403);
  await call(
    `/internships/${internship.id}/faculty-mentor`,
    "FacultyManager",
    { facultyMentorId: mentor.id, reason: "Không đúng vai trò" },
    403,
  );
  await call(
    `/internships/${internship.id}/weekly-reports`,
    "imported",
    {
      weekNumber: 1,
      content: "Hoàn thành công việc kiểm thử và báo cáo tiến độ.",
    },
    201,
  );
  await call(
    `/internships/${internship.id}/faculty-score`,
    "FacultyMentor",
    { score: 8, note: "Đạt yêu cầu" },
    201,
  );
  const supervisorAccount = await db.user.create({
    data: {
      email: `super-${suffix}@example.test`,
      fullName: "Supervisor",
      passwordHash: await hashPassword(pass),
      roles: { create: { role: "CompanySupervisor" } },
    },
  });
  const supervisor = await db.companySupervisorProfile.create({
    data: {
      userId: supervisorAccount.id,
      companyId: company.id,
      title: "Mentor",
    },
  });
  await db.companySupervisorAssignment.create({
    data: { internshipId: internship.id, supervisorId: supervisor.id },
  });
  cookies.supervisor = await login(supervisorAccount.email, pass);
  await call(
    `/internships/${internship.id}/company-score`,
    "supervisor",
    { discipline: 2, responsibility: 2, knowledge: 2, outcome: 2 },
    201,
  );
  await call(`/internships/${internship.id}/lock-grade`, "other", {}, 403);
  const grade = await call(
    `/internships/${internship.id}/lock-grade`,
    "FacultyManager",
    {},
    201,
  );
  assert.equal(grade.total, 8);
});

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const {
  InternshipsService,
} = require("../.test-build/internships/internships.service");
const { hashPassword } = require("../.test-build/auth/password");
if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
  throw new Error("Dedicated test database required.");
const fixture = require("./academic-fixture.cjs").academicFixture();
const db = fixture.db;
const {
  AcademicService,
} = require("../.test-build/internships/academic.service");
const service = new InternshipsService(db, new AcademicService(db));
const {
  FilesService,
  MAX_PDF_BYTES,
} = require("../.test-build/internships/files.service");
const files = new FilesService(db, service);
async function pdfFile() {
  const { PDFDocument } = require("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  return { originalname: "bao-cao.pdf", buffer: Buffer.from(await pdf.save()) };
}
const day = 86400000;
let passwordHash, manager, coordinator, company, representative;
async function account(role) {
  const value = await db.user.create({
    data: {
      email: `${randomUUID()}@test.example`,
      fullName: `Test ${role}`,
      passwordHash,
      roles: { create: { role } },
    },
  });
  return {
    ...value,
    roles: [role],
    permissions: [],
    mustChangePassword: false,
  };
}
async function faculty(maxStudents = 10) {
  const user = await account("FacultyMentor");
  const profile = await db.facultyProfile.create({
    data: {
      userId: user.id,
      facultyCode: randomUUID().slice(0, 25),
      fullName: user.fullName,
      email: user.email,
      expertise: "CNTT",
      maxStudents,
    },
  });
  return { user, profile };
}
async function student() {
  const user = await account("Student");
  const profile = await db.studentProfile.create({
    data: {
      userId: user.id,
      studentCode: randomUUID().slice(0, 25),
      fullName: user.fullName,
      email: user.email,
      className: "CNTT",
      cohort: "2026",
      programCredits: 150,
      completedCredits: 130,
      isVerified: true,
    },
  });
  return { user, profile };
}
async function application(existingStudent) {
  const owner = existingStudent || (await student());
  const period = await db.internshipPeriod.create({
    data: {
      name: `Test ${randomUUID()}`,
      coordinatorId: coordinator.id,
      registrationStartsAt: new Date(Date.now() - 20 * day),
      registrationEndsAt: new Date(Date.now() - 2 * day),
      startsAt: new Date(Date.now() - day),
      endsAt: new Date(Date.now() + 41 * day),
      weeklyReportCount: 6,
      weeklyDeadlines: Array.from(
        { length: 6 },
        (_, index) => new Date(Date.now() + (6 + index * 6) * day),
      ),
      gradingDeadline: new Date(Date.now() + 48 * day),
      finalizationDeadline: new Date(Date.now() + 55 * day),
      status: "Published",
    },
  });
  const value = await db.internshipApplication.create({
    data: {
      periodId: period.id,
      studentId: owner.profile.id,
      companyId: company.id,
      positionTitle: "Test internship",
      status: "Submitted",
      eligibilityPassed: true,
    },
  });
  return { value, owner, period };
}
async function approved() {
  const mentor = await faculty();
  const app = await application();
  const internship = await service.approveApplication(
    app.value.id,
    { facultyMentorId: mentor.profile.id },
    manager,
  );
  return { mentor, app, internship };
}
const status = (expected) => (error) => error.getStatus?.() === expected;
test("concurrent duplicate approval creates exactly one internship", async () => {
  const app = await application();
  const mentor = await faculty();
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      service.approveApplication(
        app.value.id,
        { facultyMentorId: mentor.profile.id },
        manager,
      ),
    ),
  );
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    await db.internship.count({ where: { applicationId: app.value.id } }),
    1,
  );
});
test("concurrent grading and mentor reassignment cannot preserve a stale mentor score", async () => {
  const { internship, mentor } = await approved();
  const replacement = await faculty();
  const results = await Promise.allSettled([
    service.scoreFaculty(
      internship.id,
      { score: 9, note: "Concurrent old mentor score" },
      mentor.user,
      false,
    ),
    service.changeMentor(
      internship.id,
      {
        facultyMentorId: replacement.profile.id,
        reason: "Concurrent reassignment QA",
      },
      coordinator,
    ),
  ]);
  assert.equal(results[1].status, "fulfilled");
  if (results[0].status === "rejected")
    assert.equal(results[0].reason.getStatus(), 403);
  const current = await db.internship.findUnique({
    where: { id: internship.id },
    include: { facultyEvaluation: true },
  });
  assert.equal(current.facultyMentorId, replacement.profile.id);
  assert.equal(current.facultyEvaluation, null);
  const audit = await db.auditLog.findFirst({
    where: { targetId: internship.id, action: "internship.mentor_change" },
  });
  assert.ok(audit);
  if (results[0].status === "fulfilled")
    assert.equal(audit.details.facultyEvaluation.score, 9);
});
test("dashboard detail totals match counters and reject other coordinator scope", async () => {
  const { app } = await approved();
  const metrics = [
    "students",
    "periods",
    "pendingApplications",
    "activeInternships",
    "verifiedCompanies",
    "pendingCompanies",
    "lateReports",
    "submittedLateReports",
    "pendingReviews",
    "revisionReports",
    "missingSchedules",
    "graded",
  ];
  for (const missingSchedule of [false, true]) {
    if (missingSchedule)
      await db.internshipPeriod.update({
        where: { id: app.period.id },
        data: { weeklyDeadlines: [] },
      });
    const dashboard = await service.dashboard(coordinator, app.period.id);
    for (const metric of metrics) {
      const result = await service.dashboardDetails(coordinator, {
        periodId: app.period.id,
        metric,
        page: 1,
      });
      assert.equal(result.total, dashboard[metric], metric);
      assert.equal(result.items.length, result.total);
    }
  }
  const other = await account("InternshipCoordinator");
  for (const user of [other, app.owner.user]) {
    await assert.rejects(
      service.dashboardDetails(user, {
        periodId: app.period.id,
        metric: "students",
        page: 1,
      }),
      status(403),
    );
    await assert.rejects(
      service.readinessReport(user, {
        periodId: app.period.id,
        kind: "quota",
        filter: "all",
        page: 1,
      }),
      status(403),
    );
    await assert.rejects(
      service.facultyWorkspace(user, {
        periodId: app.period.id,
        applicationPage: 1,
        internshipPage: 1,
      }),
      status(403),
    );
  }
});
test("readiness reflects credits, active internships and global mentor quota", async () => {
  const app = await application();
  const query = {
    periodId: app.period.id,
    kind: "eligibility",
    filter: "all",
    page: 1,
    search: app.owner.profile.studentCode,
  };
  let result = await service.readinessReport(coordinator, query);
  assert.equal(result.total, 1);
  assert.equal(result.summary.ready, 1);
  await db.studentProfile.update({
    where: { id: app.owner.profile.id },
    data: { completedCredits: 119 },
  });
  result = await service.readinessReport(coordinator, {
    ...query,
    filter: "blocked",
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].reason, "Chưa đủ tín chỉ");
  await db.studentProfile.update({
    where: { id: app.owner.profile.id },
    data: { completedCredits: 120 },
  });
  assert.equal(
    (await service.readinessReport(coordinator, query)).summary.ready,
    1,
  );
  const mentor = await faculty(1);
  await service.approveApplication(
    app.value.id,
    { facultyMentorId: mentor.profile.id },
    manager,
  );
  result = await service.readinessReport(coordinator, query);
  assert.equal(result.items[0].reason, "Đã có thực tập hiệu lực");
  result = await service.readinessReport(coordinator, {
    ...query,
    kind: "quota",
    search: mentor.profile.facultyCode,
  });
  assert.equal(result.total, 1);
  assert.equal(result.summary.blocked, 1);
  assert.equal(result.items[0].completed, 1);
  assert.equal(result.items[0].capacity, 1);
  await assert.rejects(
    service.readinessReport(coordinator, { ...query, periodId: undefined }),
    status(400),
  );
});
test("pending company drilldown counts proposals rather than unverified shared catalog", async () => {
  const app = await application();
  await db.internshipApplication.update({
    where: { id: app.value.id },
    data: { companyId: null, externalCompanyName: "Công ty QA chờ xác minh" },
  });
  assert.equal(
    (await service.dashboard(coordinator, app.period.id)).pendingCompanies,
    1,
  );
  const detail = await service.dashboardDetails(coordinator, {
    periodId: app.period.id,
    metric: "pendingCompanies",
    page: 1,
  });
  assert.equal(detail.total, 1);
  assert.match(detail.items[0].detail, /Công ty QA chờ xác minh/);
  await db.internshipApplication.update({
    where: { id: app.value.id },
    data: { status: "Rejected" },
  });
  assert.equal(
    (await service.dashboard(coordinator, app.period.id)).pendingCompanies,
    0,
  );
});
test("faculty application pagination is stable across more than one page", async () => {
  const app = await application();
  for (let index = 0; index < 20; index++) {
    const owner = await student();
    await db.internshipApplication.create({
      data: {
        periodId: app.period.id,
        studentId: owner.profile.id,
        companyId: company.id,
        positionTitle: "Pagination QA",
        status: "Submitted",
        eligibilityPassed: true,
      },
    });
  }
  const query = {
    periodId: app.period.id,
    applicationPage: 1,
    internshipPage: 1,
  };
  const first = await service.facultyWorkspace(coordinator, query);
  const second = await service.facultyWorkspace(coordinator, {
    ...query,
    applicationPage: 2,
  });
  assert.equal(first.applicationTotal, 21);
  assert.equal(first.applications.length, 20);
  assert.equal(second.applications.length, 1);
  assert.equal(
    new Set(
      [...first.applications, ...second.applications].map((item) => item.id),
    ).size,
    21,
  );
  const report = await service.applicationReport(coordinator, {
    periodId: app.period.id,
    page: 1,
    pageSize: 20,
  });
  assert.equal(report.total, first.applicationTotal);
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await service.exportReport(coordinator, "applications", {
      periodId: app.period.id,
      page: 2,
      pageSize: 20,
    }),
  );
  assert.equal(workbook.worksheets[0].rowCount, 22);
  const mentor = await faculty(25);
  for (const item of [...first.applications, ...second.applications]) {
    await service.approveApplication(
      item.id,
      { facultyMentorId: mentor.profile.id },
      manager,
    );
  }
  const firstInternships = await service.facultyWorkspace(coordinator, query);
  const secondInternships = await service.facultyWorkspace(coordinator, {
    ...query,
    internshipPage: 2,
  });
  assert.equal(firstInternships.internshipTotal, 21);
  assert.equal(firstInternships.internships.length, 20);
  assert.equal(secondInternships.internships.length, 1);
  assert.equal(
    new Set(
      [...firstInternships.internships, ...secondInternships.internships].map(
        (item) => item.id,
      ),
    ).size,
    21,
  );
  const progressQuery = {
    periodId: app.period.id,
    page: 1,
    pageSize: 20,
    filter: "missingCompany",
  };
  const progress = await service.progressReport(coordinator, progressQuery);
  assert.equal(progress.total, 21);
  assert.equal(progress.items.length, 20);
  const progressBook = new ExcelJS.Workbook();
  await progressBook.xlsx.load(
    await service.exportReport(coordinator, "progress", progressQuery),
  );
  assert.equal(progressBook.worksheets[0].rowCount, 22);
});
test("exports reject oversized datasets rather than silently truncating", async () => {
  const isolated = new InternshipsService(db);
  isolated.applicationReport = async () => ({ total: 10001, items: [] });
  isolated.progressReport = async () => ({ total: 10001, items: [] });
  await assert.rejects(
    isolated.exportReport(manager, "applications", {}),
    status(400),
  );
  await assert.rejects(
    isolated.exportReport(manager, "progress", {}),
    status(400),
  );
});
test("progress drilldowns, Excel and audit share the same period permissions", async () => {
  const { internship, app, mentor } = await approved();
  const query = {
    periodId: app.period.id,
    page: 1,
    pageSize: 1,
    filter: "all",
  };
  const before = await service.progressReport(coordinator, query);
  assert.equal(before.total, 1);
  assert.equal(before.summary.all, 1);
  assert.equal(before.summary.missingFaculty, 1);
  assert.equal(before.summary.missingCompany, 1);
  assert.equal(
    (
      await service.progressReport(coordinator, {
        ...query,
        filter: "missingCompany",
      })
    ).total,
    1,
  );
  assert.equal(before.items[0].companyScore, null);
  assert.equal(before.items[0].overdueWeeks, 0);
  assert.equal(
    (await service.progressReport(coordinator, { ...query, filter: "graded" }))
      .total,
    0,
  );
  await db.internshipPeriod.update({
    where: { id: app.period.id },
    data: { weeklyDeadlines: [] },
  });
  const missing = await service.progressReport(coordinator, query);
  assert.equal(missing.items[0].missingSchedule, true);
  assert.equal(missing.items[0].overdueWeeks, null);
  await db.internshipPeriod.update({
    where: { id: app.period.id },
    data: { weeklyDeadlines: app.period.weeklyDeadlines },
  });
  const supervisor = await account("CompanySupervisor");
  const profile = await db.companySupervisorProfile.create({
    data: { userId: supervisor.id, companyId: company.id, title: "Export QA" },
  });
  await service.assignSupervisor(
    internship.id,
    { supervisorId: profile.id },
    representative,
  );
  await service.scoreSupervisor(
    internship.id,
    { discipline: 2, responsibility: 2, knowledge: 2, outcome: 2 },
    supervisor,
  );
  await service.scoreFaculty(internship.id, { score: 9 }, mentor.user, false);
  await service.lockGrade(internship.id, manager);
  // Simulate a legacy incomplete schedule only after the normal grading flow.
  await db.internshipPeriod.update({
    where: { id: app.period.id },
    data: { weeklyDeadlines: [] },
  });
  const result = await service.progressReport(coordinator, {
    ...query,
    filter: "passed",
  });
  assert.equal(result.total, result.summary.passed);
  assert.equal(result.summary.graded, 1);
  assert.equal(result.summary.missingFaculty, 0);
  assert.equal(result.summary.missingCompany, 0);
  assert.equal(result.items[0].finalGrade.total, 8.5);
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await service.exportReport(coordinator, "progress", {
      ...query,
      page: 2,
      filter: "passed",
    }),
  );
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell("A2").value, result.items[0].student.studentCode);
  assert.equal(sheet.getCell("M2").value, 8);
  assert.equal(sheet.getCell("N2").value, 9);
  assert.equal(sheet.getCell("O2").value, 8.5);
  assert.equal(sheet.getCell("Q2").value, "Đạt");
  assert.equal(sheet.getCell("I2").value, null);
  assert.equal(sheet.getCell("J2").value, "Thiếu lịch");
  const submittedAt = new Date("2026-01-02T03:04:00Z");
  await db.internshipApplication.update({
    where: { id: app.value.id },
    data: { submittedAt },
  });
  const appQuery = {
    periodId: app.period.id,
    page: 2,
    pageSize: 1,
    status: "Approved",
  };
  await workbook.xlsx.load(
    await service.exportReport(coordinator, "applications", appQuery),
  );
  assert.equal(workbook.worksheets[0].rowCount, 2);
  assert.equal(
    workbook.worksheets[0].getCell("A2").value,
    result.items[0].student.studentCode,
  );
  assert.ok(workbook.worksheets[0].getCell("L2").value instanceof Date);
  assert.equal(
    workbook.worksheets[0].getCell("L2").value.toISOString(),
    submittedAt.toISOString(),
  );
  await db.auditLog.create({
    data: {
      actorId: manager.id,
      action: "internship.mentor_change",
      targetId: internship.id,
      reason: "Kiểm thử lịch sử",
      details: { secret: "must not leak" },
    },
  });
  const history = await service.internshipAudit(coordinator, internship.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].reason, "Kiểm thử lịch sử");
  assert.equal(history[0].details, undefined);
  const outsider = await account("InternshipCoordinator");
  for (const user of [outsider, app.owner.user, mentor.user]) {
    await assert.rejects(service.progressReport(user, query), status(403));
    await assert.rejects(
      service.exportReport(user, "progress", query),
      status(403),
    );
    await assert.rejects(
      service.exportReport(user, "applications", appQuery),
      status(403),
    );
    await assert.rejects(
      service.internshipAudit(user, internship.id),
      status(403),
    );
  }
});
test("dashboard period filter and paginated applications preserve coordinator boundaries", async () => {
  const a = await application();
  const other = await account("InternshipCoordinator");
  const query = {
    periodId: a.period.id,
    page: 1,
    pageSize: 1,
    status: "Submitted",
  };
  const list = await service.applicationReport(coordinator, query);
  assert.equal(list.total, 1);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, a.value.id);
  assert.equal(list.items[0].student.email, undefined);
  const summary = await service.dashboard(coordinator, a.period.id);
  assert.equal(summary.pendingApplications, list.total);
  assert.equal(summary.periods, 1);
  assert.equal(
    (await service.applicationReport(coordinator, { ...query, page: 2 })).items
      .length,
    0,
  );
  assert.equal(
    (
      await service.applicationReport(coordinator, {
        ...query,
        search: a.owner.profile.studentCode,
      })
    ).total,
    1,
  );
  assert.equal(
    (
      await service.applicationReport(coordinator, {
        ...query,
        search: "no-such-student-qa",
      })
    ).total,
    0,
  );
  assert.equal(
    (
      await service.applicationReport(coordinator, {
        ...query,
        status: "Rejected",
      })
    ).total,
    0,
  );
  await assert.rejects(service.applicationReport(other, query), status(403));
  await assert.rejects(service.dashboard(other, a.period.id), status(403));
  await assert.rejects(
    service.applicationReport(a.owner.user, query),
    status(403),
  );
  assert.equal((await service.applicationReport(manager, query)).total, 1);
});
test("HTTP multipart proxy grading validates evidence, persists provenance and freezes after finalization", async () => {
  const { NestFactory } = require("@nestjs/core");
  const { AppModule } = require("../.test-build/app.module");
  const { configureApp } = require("../.test-build/configure-app");
  const fixture = await approved();
  const reviewer = await account("InternshipCoordinator");
  await db.userRole.create({
    data: { userId: reviewer.id, role: "FacultyManager" },
  });
  await db.internshipPeriod.update({
    where: { id: fixture.app.period.id },
    data: { coordinatorId: reviewer.id },
  });
  const password = randomUUID() + randomUUID();
  await db.user.update({
    where: { id: reviewer.id },
    data: { passwordHash: await hashPassword(password) },
  });
  const supervisor = await account("CompanySupervisor");
  const profile = await db.companySupervisorProfile.create({
    data: { userId: supervisor.id, companyId: company.id, title: "HTTP QA" },
  });
  await service.assignSupervisor(
    fixture.internship.id,
    { supervisorId: profile.id },
    representative,
  );
  await service.scoreFaculty(
    fixture.internship.id,
    { score: 9 },
    fixture.mentor.user,
    false,
  );
  const server = await NestFactory.create(AppModule, { logger: false });
  configureApp(server);
  await server.listen(0, "127.0.0.1");
  const base = (await server.getUrl()) + "/api";
  const origin = "http://localhost:3000";
  try {
    const login = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: reviewer.email, password }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = {
      Origin: origin,
      Cookie: cookie,
      "X-Workspace-Role": "InternshipCoordinator",
    };
    const file = await pdfFile();
    const route = `${base}/internships/${fixture.internship.id}/company-scores/${profile.id}/evidence`;
    function body({
      reason = "Minh chứng kiểm thử HTTP",
      attach = true,
      outcome = "2",
    } = {}) {
      const value = new FormData();
      for (const key of ["discipline", "responsibility", "knowledge"])
        value.set(key, "2");
      value.set("outcome", outcome);
      value.set("reason", reason);
      if (attach)
        value.set(
          "file",
          new Blob([file.buffer], { type: "application/pdf" }),
          file.originalname,
        );
      return value;
    }
    for (const invalid of [
      { reason: " " },
      { attach: false },
      { outcome: "5" },
    ]) {
      assert.equal(
        (await fetch(route, { method: "POST", headers, body: body(invalid) }))
          .status,
        400,
      );
    }
    assert.equal(
      await db.supervisorEvaluation.count({
        where: { internshipId: fixture.internship.id },
      }),
      0,
    );
    const saved = await fetch(route, { method: "POST", headers, body: body() });
    assert.equal(saved.status, 201);
    const document = await saved.json();
    const download = await fetch(`${base}/files/${document.id}`, { headers });
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-disposition"), /attachment/);
    assert.equal(download.headers.get("content-type"), "application/pdf");
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), file.buffer);
    const locked = await fetch(
      `${base}/internships/${fixture.internship.id}/lock-grade`,
      {
        method: "POST",
        headers: { ...headers, "X-Workspace-Role": "FacultyManager" },
      },
    );
    assert.equal(locked.status, 201);
    const grade = await locked.json();
    assert.equal(grade.total, 8.5);
    assert.equal(grade.snapshot.formula, "50/50");
    assert.equal(
      grade.snapshot.companyEvaluations[0].evidenceFileId,
      document.id,
    );
    assert.equal(grade.snapshot.companyEvaluations[0].enteredById, reviewer.id);
    assert.equal(grade.snapshot.companyEvaluations[0].enteredOnBehalf, true);
    assert.equal(
      (await fetch(route, { method: "POST", headers, body: body() })).status,
      409,
    );
    assert.equal(
      await db.supervisorEvaluation.count({
        where: { internshipId: fixture.internship.id },
      }),
      1,
    );
  } finally {
    await server.close();
  }
});
test("private PDF storage rejects invalid files and enforces report ownership and locks", async () => {
  const { app, internship, mentor } = await approved();
  const file = await pdfFile();
  await assert.rejects(
    files.validate({
      originalname: "fake.pdf",
      buffer: Buffer.from("not pdf"),
    }),
    status(400),
  );
  await assert.rejects(
    files.validate({
      originalname: "fake.pdf",
      buffer: Buffer.from("%PDF-invalid"),
    }),
    status(400),
  );
  await assert.rejects(
    files.validate({
      originalname: "large.pdf",
      buffer: Buffer.alloc(MAX_PDF_BYTES + 1),
    }),
    status(400),
  );
  await assert.rejects(
    files.upload(internship.id, "weekly", file, mentor.user, 1),
    status(403),
  );
  await assert.rejects(
    files.upload(internship.id, "weekly", file, app.owner.user, 1),
    status(400),
  );
  const report = await service.submitWeekly(
    internship.id,
    { weekNumber: 1, content: "Báo cáo tuần có đính kèm PDF." },
    app.owner.user,
  );
  const saved = await files.upload(
    internship.id,
    "weekly",
    file,
    app.owner.user,
    1,
  );
  assert.equal(
    (await db.weeklyReport.findUnique({ where: { id: report.id } })).fileId,
    saved.id,
  );
  assert.equal((await files.list(internship.id, mentor.user)).length, 1);
  const download = await files.download(saved.id, mentor.user);
  const chunks = [];
  for await (const chunk of download.stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), file.buffer);
  await assert.rejects(
    files.download(saved.id, (await student()).user),
    status(403),
  );
  await service.reviewWeekly(
    report.id,
    { status: "Reviewed", note: "Đạt yêu cầu" },
    mentor.user,
  );
  await assert.rejects(
    files.upload(internship.id, "weekly", file, app.owner.user, 1),
    status(400),
  );
  assert.equal(
    await db.fileDocument.count({ where: { internshipId: internship.id } }),
    1,
  );
});
test("proxy company score requires evidence and snapshots the source without adding votes", async () => {
  const { app, internship, mentor } = await approved();
  const supervisor = await account("CompanySupervisor");
  const profile = await db.companySupervisorProfile.create({
    data: { userId: supervisor.id, companyId: company.id, title: "QA" },
  });
  await service.assignSupervisor(
    internship.id,
    { supervisorId: profile.id },
    representative,
  );
  const score = {
    discipline: 2,
    responsibility: 2,
    knowledge: 2,
    outcome: 2,
    reason: "Khoa nhận phiếu giấy doanh nghiệp",
  };
  await assert.rejects(
    files.upload(
      internship.id,
      "evidence",
      undefined,
      coordinator,
      undefined,
      profile.id,
      score,
    ),
    status(400),
  );
  const file = await pdfFile();
  await assert.rejects(
    files.upload(
      internship.id,
      "evidence",
      file,
      await account("InternshipCoordinator"),
      undefined,
      profile.id,
      score,
    ),
    status(403),
  );
  await service.scoreSupervisor(
    internship.id,
    { discipline: 1, responsibility: 1, knowledge: 1, outcome: 1 },
    supervisor,
  );
  const evidence = await files.upload(
    internship.id,
    "evidence",
    file,
    coordinator,
    undefined,
    profile.id,
    score,
  );
  assert.equal(
    await db.supervisorEvaluation.count({
      where: { internshipId: internship.id },
    }),
    1,
  );
  await service.submitFinalReport(
    internship.id,
    { content: "Nội dung báo cáo cuối. ".repeat(10) },
    app.owner.user,
  );
  const report = await files.upload(
    internship.id,
    "final",
    file,
    app.owner.user,
  );
  await service.scoreFaculty(internship.id, { score: 9 }, mentor.user, false);
  const grade = await service.lockGrade(internship.id, manager);
  assert.equal(grade.total, 8.5);
  assert.equal(
    grade.snapshot.companyEvaluations[0].evidenceFileId,
    evidence.id,
  );
  assert.equal(
    grade.snapshot.companyEvaluations[0].enteredById,
    coordinator.id,
  );
  assert.equal(grade.snapshot.companyEvaluations[0].enteredOnBehalf, true);
  assert.equal(grade.snapshot.finalReportFileId, report.id);
  await assert.rejects(
    files.upload(internship.id, "final", file, app.owner.user),
    status(409),
  );
  await assert.rejects(
    files.upload(
      internship.id,
      "evidence",
      file,
      coordinator,
      undefined,
      profile.id,
      score,
    ),
    status(409),
  );
  assert.ok((await files.download(evidence.id, manager)).stream.destroy());
});
test("manual profiles validate fields, prevent overwrite and keep login separate", async () => {
  const row = {
    studentCode: randomUUID(),
    fullName: "Sinh viên thủ công",
    email: `${randomUUID()}@test.example`,
    className: "CNTT",
    cohort: "K17",
    programCode: "ICT1",
    major: "CNTT",
    programCredits: 150,
    completedCredits: 130,
    hasMandatoryCourseDebt: false,
  };
  row.studentCode = row.studentCode.slice(0, 25);
  await assert.rejects(
    service.saveProfile(
      "students",
      null,
      { ...row, completedCredits: 999 },
      coordinator,
    ),
    status(400),
  );
  await assert.rejects(
    service.saveProfile(
      "students",
      null,
      { ...row, isVerified: true },
      coordinator,
    ),
    status(400),
  );
  const created = await service.saveProfile("students", null, row, coordinator);
  assert.equal(
    (await db.studentProfile.findUnique({ where: { id: created.id } })).userId,
    null,
  );
  await assert.rejects(
    service.saveProfile("students", null, row, coordinator),
    status(409),
  );
  const owner = await account("Student");
  await db.studentProfile.update({
    where: { id: created.id },
    data: { userId: owner.id, isVerified: true },
  });
  await assert.rejects(
    service.saveProfile("students", created.id, row, owner),
    status(403),
  );
  await service.saveProfile(
    "students",
    created.id,
    { ...row, completedCredits: 135 },
    coordinator,
  );
  assert.equal(
    (await db.studentProfile.findUnique({ where: { id: created.id } }))
      .isVerified,
    false,
  );
  await service.updateStudentContact(`${randomUUID()}@contact.example`, owner);
  assert.equal(
    (await db.user.findUnique({ where: { id: owner.id } })).email,
    owner.email,
  );
  assert.equal(
    (await db.studentProfile.findUnique({ where: { id: created.id } }))
      .completedCredits,
    135,
  );
  const mentor = await service.saveProfile(
    "faculty",
    null,
    {
      facultyCode: randomUUID().slice(0, 25),
      fullName: "GV",
      email: `${randomUUID()}@test.example`,
      expertise: "CNTT",
      maxStudents: 10,
    },
    coordinator,
  );
  assert.ok(mentor.id);
  const companyProfile = await service.saveProfile(
    "companies",
    null,
    {
      name: "Công ty thủ công",
      address: "Hà Nội",
      contactName: "QA",
      contactEmail: `${randomUUID()}@test.example`,
      contactPhone: "0900000000",
    },
    coordinator,
  );
  assert.ok(companyProfile.id);
  await service.saveProfile(
    "faculty",
    mentor.id,
    {
      facultyCode: randomUUID().slice(0, 25),
      fullName: "GV đã sửa",
      email: `${randomUUID()}@test.example`,
      expertise: "Phần mềm",
      maxStudents: 12,
    },
    coordinator,
  );
  assert.equal(
    (await db.facultyProfile.findUnique({ where: { id: mentor.id } }))
      .maxStudents,
    12,
  );
  await service.saveProfile(
    "companies",
    companyProfile.id,
    {
      name: "Công ty đã sửa",
      address: "Hà Nội",
      contactName: "QA",
      contactEmail: `${randomUUID()}@test.example`,
      contactPhone: "0911111111",
    },
    coordinator,
  );
  assert.equal(
    (await db.companyProfile.findUnique({ where: { id: companyProfile.id } }))
      .contactPhone,
    "0911111111",
  );
  assert.equal(
    await db.auditLog.count({
      where: { targetId: created.id, action: "profile.update" },
    }),
    1,
  );
});
test("manual quota edits cannot undercut current assignments", async () => {
  const first = await approved();
  const another = await application();
  await service.approveApplication(
    another.value.id,
    { facultyMentorId: first.mentor.profile.id },
    manager,
  );
  const profile = first.mentor.profile;
  await assert.rejects(
    service.saveProfile(
      "faculty",
      profile.id,
      {
        facultyCode: profile.facultyCode,
        fullName: profile.fullName,
        email: profile.email,
        expertise: profile.expertise,
        maxStudents: 1,
      },
      coordinator,
    ),
    status(409),
  );
  assert.equal(
    (await db.facultyProfile.findUnique({ where: { id: profile.id } }))
      .maxStudents,
    10,
  );
});
test("coordinator scope follows assignment and blocks other periods", async () => {
  const { app, internship } = await approved();
  const outsider = await account("InternshipCoordinator");
  assert.equal((await service.periods(outsider)).length, 0);
  assert.equal(
    (await service.facultyWorkspace(outsider)).internships.length,
    0,
  );
  assert.equal((await service.dashboard(outsider)).students, 0);
  assert.equal((await service.externalApplications(outsider)).length, 0);
  const target = await faculty();
  await assert.rejects(
    service.changeMentor(
      internship.id,
      { facultyMentorId: target.profile.id, reason: "Ngoài phạm vi" },
      outsider,
    ),
    status(403),
  );
  await assert.rejects(
    service.publishPeriod(app.period.id, outsider),
    status(403),
  );
  await assert.rejects(
    service.assignCoordinator(
      app.period.id,
      { coordinatorId: outsider.id, reason: "Không được tự nhận" },
      outsider,
    ),
    status(403),
  );
  await service.assignCoordinator(
    app.period.id,
    { coordinatorId: outsider.id, reason: "Bàn giao đợt" },
    manager,
  );
  assert.equal((await service.periods(outsider)).length, 1);
  assert.deepEqual(
    (await service.facultyWorkspace(outsider)).internships.map((i) => i.id),
    [internship.id],
  );
  assert.equal((await service.dashboard(outsider)).students, 1);
  await assert.rejects(
    service.changeMentor(
      internship.id,
      { facultyMentorId: target.profile.id, reason: "Đã bàn giao" },
      coordinator,
    ),
    status(403),
  );
  await service.changeMentor(
    internship.id,
    { facultyMentorId: target.profile.id, reason: "Phân công mới" },
    outsider,
  );
  assert.equal(
    await db.auditLog.count({
      where: { action: "period.coordinator_assign", targetId: app.period.id },
    }),
    1,
  );
});
test("company representative can become supervisor without another account", async () => {
  const person = await account("Company");
  const companyProfile = await db.companyProfile.create({
    data: {
      name: "Self supervisor test",
      contactEmail: person.email,
      contactName: "QA",
      contactPhone: "0900000000",
      address: "Hà Nội",
      representativeUserId: person.id,
      isVerified: true,
    },
  });
  const results = await Promise.all([
    service.enableOwnSupervisor(person),
    service.enableOwnSupervisor(person),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(results[0].userId, person.id);
  assert.equal(results[0].companyId, companyProfile.id);
  assert.equal(await db.user.count({ where: { email: person.email } }), 1);
  assert.ok(
    await db.userRole.findUnique({
      where: { userId_role: { userId: person.id, role: "CompanySupervisor" } },
    }),
  );
  assert.equal(
    await db.auditLog.count({
      where: { actorId: person.id, action: "company_supervisor.self_enable" },
    }),
    1,
  );
  await assert.rejects(
    service.enableOwnSupervisor(await account("Student")),
    status(403),
  );
});
test("dashboard separates missing late reports, late submissions and review queues", async () => {
  const { internship, app } = await approved();
  await assert.rejects(service.dashboard(app.owner.user), status(403));
  const baseline = await service.dashboard(manager);
  const deadlines = [
    new Date(Date.now() - 2 * day),
    new Date(Date.now() - day),
    ...app.period.weeklyDeadlines.slice(2),
  ];
  await db.internshipPeriod.update({
    where: { id: app.period.id },
    data: { weeklyDeadlines: deadlines },
  });
  await db.weeklyReport.create({
    data: {
      internshipId: internship.id,
      weekNumber: 2,
      content: "Late imported report",
      submittedAt: new Date(),
      status: "NeedsRevision",
    },
  });
  await db.weeklyReport.create({
    data: {
      internshipId: internship.id,
      weekNumber: 3,
      content: "Waiting for review",
      status: "Submitted",
    },
  });
  const result = await service.dashboard(manager);
  assert.equal(result.lateReports, baseline.lateReports + 1);
  assert.equal(result.submittedLateReports, baseline.submittedLateReports + 1);
  assert.equal(result.revisionReports, baseline.revisionReports + 1);
  assert.equal(result.pendingReviews, baseline.pendingReviews + 1);
  for (const metric of [
    "lateReports",
    "submittedLateReports",
    "revisionReports",
    "pendingReviews",
  ]) {
    const detail = await service.dashboardDetails(manager, {
      periodId: app.period.id,
      metric,
      page: 1,
    });
    assert.equal(detail.total, 1, metric);
    assert.equal(detail.items.length, 1);
  }
  await db.internship.update({
    where: { id: internship.id },
    data: { startsAt: new Date(Date.now() + day) },
  });
  assert.equal(
    (await service.dashboard(manager)).activeInternships,
    result.activeInternships - 1,
  );
  await db.internshipPeriod.update({
    where: { id: app.period.id },
    data: { weeklyDeadlines: [] },
  });
  const legacy = await service.dashboard(manager);
  assert.equal(legacy.missingSchedules, baseline.missingSchedules + 1);
  assert.equal(legacy.lateReports, baseline.lateReports);
});
test("company change archives scores, preserves reports and revokes old assignments", async () => {
  const { mentor, app, internship } = await approved();
  const target = await db.companyProfile.create({
    data: {
      name: "Replacement company",
      address: "Hà Nội",
      contactName: "QA",
      contactEmail: `${randomUUID()}@test.example`,
      contactPhone: "0900000000",
      isVerified: true,
    },
  });
  const dto = {
    companyId: target.id,
    reason: "Thay đổi nơi thực tập theo đề nghị",
  };
  await assert.rejects(
    service.changeCompany(internship.id, dto, app.owner.user),
    status(403),
  );
  await assert.rejects(
    service.changeCompany(
      internship.id,
      { ...dto, companyId: company.id },
      coordinator,
    ),
    status(409),
  );
  await db.companyProfile.update({
    where: { id: target.id },
    data: { isVerified: false },
  });
  await assert.rejects(
    service.changeCompany(internship.id, dto, coordinator),
    status(400),
  );
  await db.companyProfile.update({
    where: { id: target.id },
    data: { isVerified: true },
  });
  const supervisor = await account("CompanySupervisor");
  const profile = await db.companySupervisorProfile.create({
    data: { userId: supervisor.id, companyId: company.id, title: "QA" },
  });
  await service.assignSupervisor(
    internship.id,
    { supervisorId: profile.id },
    representative,
  );
  await service.scoreSupervisor(
    internship.id,
    { discipline: 2, responsibility: 2, knowledge: 2, outcome: 2 },
    supervisor,
  );
  const content = "Báo cáo cuối kỳ cần giữ nguyên. ".repeat(10);
  await service.submitFinalReport(internship.id, { content }, app.owner.user);
  await service.scoreFaculty(internship.id, { score: 9 }, mentor.user, false);
  await service.changeCompany(internship.id, dto, coordinator);
  const saved = await db.internship.findUnique({
    where: { id: internship.id },
    include: {
      companySupervisorAssignments: true,
      supervisorEvaluations: true,
      facultyEvaluation: true,
      finalReport: true,
    },
  });
  assert.equal(saved.companyId, target.id);
  assert.equal(saved.companySupervisorAssignments.length, 0);
  assert.equal(saved.supervisorEvaluations.length, 0);
  assert.equal(saved.facultyEvaluation, null);
  assert.equal(saved.finalReport.content, content);
  assert.equal(saved.finalReport.score, null);
  const audit = await db.auditLog.findFirst({
    where: { targetId: internship.id, action: "internship.company_change" },
  });
  assert.equal(audit.reason, dto.reason);
  assert.equal(audit.details.previousCompanyId, company.id);
  assert.equal(audit.details.supervisorEvaluations[0].total, 8);
  assert.equal(audit.details.facultyEvaluation.score, 9);
  await assert.rejects(
    service.scoreSupervisor(
      internship.id,
      { discipline: 2, responsibility: 2, knowledge: 2, outcome: 4 },
      supervisor,
    ),
    status(403),
  );
  await assert.rejects(service.lockGrade(internship.id, manager), status(400));
  await db.internship.update({
    where: { id: internship.id },
    data: { startsAt: new Date(Date.now() - 8 * day) },
  });
  await assert.rejects(
    service.changeCompany(
      internship.id,
      { ...dto, companyId: company.id },
      coordinator,
    ),
    status(400),
  );
});
test("Excel preview preserves physical row errors and concurrent confirm is atomic", async () => {
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await service.template("Students"));
  const sheet = workbook.worksheets[0];
  sheet.spliceRows(2, 1);
  sheet.getRow(5).values = [
    "QA",
    "",
    "bad-email",
    "CNTT",
    "K15",
    "CNTT",
    150,
    -1,
    "maybe",
  ];
  const invalid = await service.previewImport(
    "Students",
    { buffer: Buffer.from(await workbook.xlsx.writeBuffer()) },
    coordinator,
  );
  assert.equal(invalid.valid, 0);
  assert.ok(invalid.errors.length >= 3);
  assert.ok(invalid.errors.every((error) => error.row === 5));
  await assert.rejects(
    service.confirmImport(invalid.batchId, coordinator),
    status(400),
  );
  sheet.getCell("A1").value = "wrong-column";
  await assert.rejects(
    service.previewImport(
      "Students",
      { buffer: Buffer.from(await workbook.xlsx.writeBuffer()) },
      coordinator,
    ),
    status(400),
  );
  await assert.rejects(
    service.previewImport(
      "Students",
      { buffer: Buffer.from("not an xlsx") },
      coordinator,
    ),
    status(400),
  );
  await workbook.xlsx.load(await service.template("Faculty"));
  const key = randomUUID().slice(0, 18);
  workbook.worksheets[0].getCell("A2").value = key;
  workbook.worksheets[0].getCell("C2").value = `${key}@example.test`;
  const preview = await service.previewImport(
    "Faculty",
    { buffer: Buffer.from(await workbook.xlsx.writeBuffer()) },
    coordinator,
  );
  await assert.rejects(
    service.confirmImport(
      preview.batchId,
      await account("InternshipCoordinator"),
    ),
    status(403),
  );
  const results = await Promise.allSettled([
    service.confirmImport(preview.batchId, coordinator),
    service.confirmImport(preview.batchId, coordinator),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    await db.facultyProfile.count({ where: { facultyCode: key } }),
    1,
  );
  assert.equal(
    await db.auditLog.count({
      where: { targetId: preview.batchId, action: "import.confirm" },
    }),
    1,
  );
});
test("Excel templates preview and confirmation create profiles without accounts", async () => {
  const ExcelJS = require("exceljs");
  for (const type of ["Students", "Faculty", "Companies"]) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await service.template(type));
    const sheet = workbook.worksheets[0];
    const key = randomUUID().slice(0, 18),
      email = `${key}@example.test`;
    sheet.getCell("A2").value = key;
    sheet.getCell(type === "Companies" ? "F2" : "C2").value = email;
    if (type === "Companies") sheet.getCell("B2").value = key;
    const file = { buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    const preview = await service.previewImport(type, file, coordinator);
    assert.deepEqual(preview.errors, []);
    assert.equal(preview.valid, 1);
    assert.equal(await db.user.count({ where: { email } }), 0);
    await service.confirmImport(preview.batchId, coordinator);
    assert.equal(await db.user.count({ where: { email } }), 0);
    const duplicate = await service.previewImport(type, file, coordinator);
    assert.ok(duplicate.errors.some((error) => error.row === 2));
    await assert.rejects(
      service.confirmImport(duplicate.batchId, coordinator),
      status(400),
    );
  }
});
test("only the assigned coordinator can reopen a reviewed report in the first seven days and final report freezes after faculty grading", async () => {
  const { internship, app, mentor } = await approved();
  const report = await service.submitWeekly(
    internship.id,
    { weekNumber: 1, content: "Báo cáo cần kiểm tra lại." },
    app.owner.user,
  );
  await service.reviewWeekly(
    report.id,
    { status: "Reviewed", note: "Đã xem" },
    mentor.user,
  );
  await assert.rejects(
    service.unlockWeekly(report.id, { note: "Mở lại" }, mentor.user),
    status(403),
  );
  await service.unlockWeekly(
    report.id,
    { note: "Khoa cho bổ sung kết quả" },
    coordinator,
  );
  assert.equal(
    (await db.weeklyReport.findUnique({ where: { id: report.id } })).mentorNote,
    "Đã xem",
  );
  assert.equal(
    await db.auditLog.count({
      where: {
        targetId: report.id,
        action: "weekly_report.unlock",
        reason: "Khoa cho bổ sung kết quả",
      },
    }),
    1,
  );
  await service.submitWeekly(
    internship.id,
    { weekNumber: 1, content: "Nội dung bổ sung đã được khoa cho phép." },
    app.owner.user,
  );
  await service.reviewWeekly(
    report.id,
    { status: "Reviewed", note: "Đã đủ" },
    mentor.user,
  );
  await db.internship.update({
    where: { id: internship.id },
    data: { startsAt: new Date(Date.now() - 7 * day) },
  });
  await assert.rejects(
    service.unlockWeekly(report.id, { note: "Mở ngoài hạn" }, coordinator),
    status(400),
  );
  await service.submitFinalReport(
    internship.id,
    { content: "Báo cáo cuối ban đầu. ".repeat(10) },
    app.owner.user,
  );
  await service.scoreFaculty(internship.id, { score: 9 }, mentor.user, false);
  await assert.rejects(
    service.submitFinalReport(
      internship.id,
      { content: "Nội dung khác sau chấm. ".repeat(10) },
      app.owner.user,
    ),
    status(409),
  );
});
test("period windows reject incomplete schedules and enforce exact deadlines", () => {
  const {
    checkPeriodWindow,
    validateSchedule,
  } = require("../.test-build/internships/period-time");
  const start = new Date("2030-01-01T00:00:00Z");
  const schedule = {
    startsAt: start,
    endsAt: new Date(start.getTime() + 42 * day),
    weeklyReportCount: 6,
    weeklyDeadlines: Array.from(
      { length: 6 },
      (_, i) => new Date(start.getTime() + (i + 1) * 7 * day),
    ),
    gradingDeadline: new Date(start.getTime() + 49 * day),
    finalizationDeadline: new Date(start.getTime() + 56 * day),
  };
  validateSchedule(schedule);
  for (const [action, deadline, week] of [
    ["weekly", schedule.weeklyDeadlines[0], 1],
    ["report", schedule.endsAt],
    ["grade", schedule.gradingDeadline],
    ["finalize", schedule.finalizationDeadline],
  ]) {
    assert.doesNotThrow(() =>
      checkPeriodWindow(
        schedule,
        action,
        new Date(deadline.getTime() - 1),
        week,
      ),
    );
    assert.doesNotThrow(() =>
      checkPeriodWindow(schedule, action, deadline, week),
    );
    assert.throws(
      () =>
        checkPeriodWindow(
          schedule,
          action,
          new Date(deadline.getTime() + 1),
          week,
        ),
      status(400),
    );
    assert.throws(
      () =>
        checkPeriodWindow(
          schedule,
          action,
          new Date(start.getTime() - 1),
          week,
        ),
      status(400),
    );
  }
  assert.throws(
    () => validateSchedule({ ...schedule, weeklyDeadlines: [] }),
    status(400),
  );
  assert.throws(
    () =>
      validateSchedule({
        ...schedule,
        weeklyDeadlines: [...schedule.weeklyDeadlines].reverse(),
      }),
    status(400),
  );
  assert.throws(
    () => validateSchedule({ ...schedule, gradingDeadline: start }),
    status(400),
  );
});
test("published periods cannot be republished and expired report submissions preserve data", async () => {
  const { internship, app } = await approved();
  await assert.rejects(
    service.publishPeriod(app.period.id, coordinator),
    status(409),
  );
  await service.submitWeekly(
    internship.id,
    { weekNumber: 1, content: "Nội dung trước hạn nộp." },
    app.owner.user,
  );
  await db.internshipPeriod.update({
    where: { id: app.period.id },
    data: {
      weeklyDeadlines: [
        new Date(Date.now() - 1000),
        ...app.period.weeklyDeadlines.slice(1),
      ],
    },
  });
  await assert.rejects(
    service.submitWeekly(
      internship.id,
      { weekNumber: 1, content: "Nội dung nộp trễ không hợp lệ." },
      app.owner.user,
    ),
    status(400),
  );
  assert.equal(
    (
      await db.weeklyReport.findUnique({
        where: {
          internshipId_weekNumber: {
            internshipId: internship.id,
            weekNumber: 1,
          },
        },
      })
    ).content,
    "Nội dung trước hạn nộp.",
  );
});
test("external companies are linked without overwrite and final decisions require faculty manager", async () => {
  const app = await application();
  await db.internshipApplication.update({
    where: { id: app.value.id },
    data: { companyId: null, externalCompanyName: "Công ty tự tìm" },
  });
  const dto = {
    name: `External ${randomUUID()}`,
    address: "Hà Nội",
    contactName: "Người liên hệ",
    contactEmail: `${randomUUID()}@example.test`,
    contactPhone: "0123456789",
    note: "Đã kiểm tra thông tin",
  };
  await assert.rejects(
    service.externalApplications(app.owner.user),
    status(403),
  );
  const results = await Promise.allSettled([
    service.verifyExternalCompany(app.value.id, dto, coordinator),
    service.verifyExternalCompany(app.value.id, dto, coordinator),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.getStatus(),
    409,
  );
  const linked = results.find((r) => r.status === "fulfilled").value;
  assert.equal(
    (await db.companyProfile.findUnique({ where: { id: linked.companyId } }))
      .isVerified,
    true,
  );
  const another = await application();
  await db.internshipApplication.update({
    where: { id: another.value.id },
    data: { companyId: null, externalCompanyName: dto.name },
  });
  const reused = await service.verifyExternalCompany(
    another.value.id,
    { ...dto, address: "Không ghi đè" },
    coordinator,
  );
  assert.equal(reused.companyId, linked.companyId);
  assert.equal(
    (await db.companyProfile.findUnique({ where: { id: linked.companyId } }))
      .address,
    dto.address,
  );
  const admin = await account("Admin");
  await assert.rejects(
    service.rejectApplication(app.value.id, { note: "Không hợp lệ" }, admin),
    status(403),
  );
  const mentor = await faculty();
  await assert.rejects(
    service.approveApplication(
      app.value.id,
      { facultyMentorId: mentor.profile.id },
      admin,
    ),
    status(403),
  );
  await service.rejectApplication(
    app.value.id,
    { note: "Không phù hợp vị trí thực tập" },
    manager,
  );
  await assert.rejects(
    service.rejectApplication(app.value.id, { note: "Thử lại" }, manager),
    status(409),
  );
  assert.equal(
    (await service.mine(app.owner.user)).applications.find(
      (a) => a.id === app.value.id,
    ).reviewNote,
    "Không phù hợp vị trí thực tập",
  );
});
test("faculty workspace is restricted and exception decisions are atomic and final", async () => {
  const app = await application();
  const request = await db.eligibilityExceptionRequest.create({
    data: { applicationId: app.value.id, reason: "Xin xét ngoại lệ tín chỉ" },
  });
  await assert.rejects(service.facultyWorkspace(app.owner.user), status(403));
  assert.ok(
    (await service.facultyWorkspace(coordinator)).internships.every(
      (item) => item.id,
    ),
  );
  const workspace = await service.facultyWorkspace(manager, {
    periodId: app.period.id,
    applicationPage: 1,
    internshipPage: 1,
  });
  assert.ok(workspace.applications.some((a) => a.id === app.value.id));
  const results = await Promise.allSettled([
    service.reviewException(
      request.id,
      true,
      { note: "Chấp nhận hồ sơ" },
      manager,
    ),
    service.reviewException(
      request.id,
      false,
      { note: "Từ chối hồ sơ" },
      manager,
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.getStatus(),
    409,
  );
  assert.equal(await db.auditLog.count({ where: { targetId: request.id } }), 1);
  await assert.rejects(
    service.reviewException(
      request.id,
      true,
      { note: "Thay đổi quyết định" },
      manager,
    ),
    status(409),
  );
});
test("company workspace isolates companies and supervisors and provisions audited credentials", async () => {
  const { internship, app } = await approved();
  const email = `${randomUUID()}@test.example`;
  const created = await service.companySupervisor(
    { fullName: "Người hướng dẫn", email, title: "Kỹ sư" },
    representative,
  );
  const user = {
    id: created.profile.userId,
    roles: ["CompanySupervisor"],
    permissions: [],
    mustChangePassword: false,
  };
  assert.ok(created.temporaryPassword.length >= 18);
  assert.equal(
    (await db.user.findUnique({ where: { id: user.id } })).mustChangePassword,
    true,
  );
  assert.equal(
    await db.auditLog.count({
      where: {
        targetId: created.profile.id,
        action: "company_supervisor.create",
      },
    }),
    1,
  );
  assert.deepEqual((await service.companyWorkspace(user)).internships, []);
  await service.assignSupervisor(
    internship.id,
    { supervisorId: created.profile.id },
    representative,
  );
  const workspace = await service.companyWorkspace(user);
  assert.equal(workspace.canManage, false);
  assert.deepEqual(workspace.supervisors, []);
  assert.equal(workspace.internships.length, 1);
  assert.equal(workspace.internships[0].id, internship.id);
  assert.equal(workspace.internships[0].student.email, undefined);
  const repView = await service.companyWorkspace(representative);
  assert.equal(repView.canManage, true);
  assert.ok(repView.supervisors.some((p) => p.id === created.profile.id));
  assert.equal(
    repView.supervisors.find((p) => p.id === created.profile.id).user
      .passwordHash,
    undefined,
  );
  const outsider = await account("Company");
  assert.deepEqual((await service.companyWorkspace(outsider)).internships, []);
  await assert.rejects(
    service.assignSupervisor(
      internship.id,
      { supervisorId: created.profile.id },
      outsider,
    ),
    status(403),
  );
  await assert.rejects(service.companyWorkspace(app.owner.user), status(403));
  await assert.rejects(
    service.companySupervisor(
      { fullName: "Trùng email", email, title: "Kỹ sư" },
      representative,
    ),
    status(409),
  );
});
test("mentor workspace isolates assignments and reviewed reports cannot be overwritten", async () => {
  const { mentor, app, internship } = await approved();
  const other = await faculty();
  const report = await service.submitWeekly(
    internship.id,
    { weekNumber: 1, content: "Nội dung báo cáo tuần đầu tiên." },
    app.owner.user,
  );
  await service.submitFinalReport(
    internship.id,
    { content: "Báo cáo cuối kỳ. ".repeat(20) },
    app.owner.user,
  );
  await service.scoreFaculty(
    internship.id,
    { score: 8.5, note: "Đạt yêu cầu" },
    mentor.user,
    false,
  );
  const mine = await service.mine(mentor.user);
  assert.equal(mine.internships.length, 1);
  assert.equal(mine.internships[0].facultyEvaluation.score, 8.5);
  assert.ok(mine.internships[0].finalReport.content);
  assert.equal(mine.internships[0].period.weeklyReportCount, 6);
  assert.equal(mine.internships[0].student.email, undefined);
  assert.equal((await service.mine(other.user)).internships.length, 0);
  await assert.rejects(
    service.reviewWeekly(
      report.id,
      { status: "Reviewed", note: "Đạt" },
      other.user,
    ),
    status(403),
  );
  await assert.rejects(
    service.scoreFaculty(internship.id, { score: 0 }, other.user, false),
    status(403),
  );
  await service.reviewWeekly(
    report.id,
    { status: "NeedsRevision", note: "Bổ sung kết quả" },
    mentor.user,
  );
  await service.submitWeekly(
    internship.id,
    { weekNumber: 1, content: "Nội dung đã bổ sung kết quả." },
    app.owner.user,
  );
  await service.reviewWeekly(
    report.id,
    { status: "Reviewed", note: "Đã đầy đủ" },
    mentor.user,
  );
  await assert.rejects(
    service.submitWeekly(
      internship.id,
      { weekNumber: 1, content: "Không được ghi đè nội dung." },
      app.owner.user,
    ),
    status(409),
  );
  await assert.rejects(
    service.reviewWeekly(
      report.id,
      { status: "NeedsRevision", note: "Mở lại" },
      mentor.user,
    ),
    status(409),
  );
  const saved = await db.weeklyReport.findUnique({ where: { id: report.id } });
  assert.equal(saved.mentorNote, "Đã đầy đủ");
  assert.equal(saved.content, "Nội dung đã bổ sung kết quả.");
});
before(async () => {
  await fixture.setup();
  passwordHash = await hashPassword(randomUUID());
  manager = await account("FacultyManager");
  coordinator = await account("InternshipCoordinator");
  representative = await account("Company");
  company = await db.companyProfile.create({
    data: {
      name: "Test company",
      taxCode: randomUUID().slice(0, 20),
      address: "Test address",
      contactName: "Test contact",
      contactPhone: "0000000000",
      contactEmail: representative.email,
      representativeUserId: representative.id,
      isVerified: true,
    },
  });
});
after(async () => {
  await db.$disconnect();
});

test("concurrent approvals cannot exceed a faculty quota", async () => {
  const mentor = await faculty(1);
  const apps = await Promise.all([application(), application()]);
  const results = await Promise.allSettled(
    apps.map((app) =>
      service.approveApplication(
        app.value.id,
        { facultyMentorId: mentor.profile.id },
        manager,
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.getStatus(),
    409,
  );
  assert.equal(
    await db.internship.count({
      where: { facultyMentorId: mentor.profile.id },
    }),
    1,
  );
  const loser = apps[results.findIndex((r) => r.status === "rejected")];
  assert.equal(
    (
      await db.internshipApplication.findUnique({
        where: { id: loser.value.id },
      })
    ).status,
    "Submitted",
  );
});

test("concurrent approvals in different periods cannot give one student two active internships", async () => {
  const owner = await student();
  const apps = await Promise.all([application(owner), application(owner)]);
  const mentors = await Promise.all([faculty(), faculty()]);
  const results = await Promise.allSettled(
    apps.map((app, i) =>
      service.approveApplication(
        app.value.id,
        { facultyMentorId: mentors[i].profile.id },
        manager,
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.getStatus(),
    409,
  );
  assert.equal(
    await db.internship.count({ where: { studentId: owner.profile.id } }),
    1,
  );
});

test("approval rechecks academic eligibility rather than trusting an old passed flag", async () => {
  const app = await application();
  const mentor = await faculty();
  await db.studentProfile.update({
    where: { id: app.owner.profile.id },
    data: { completedCredits: 50 },
  });
  await assert.rejects(
    service.approveApplication(
      app.value.id,
      { facultyMentorId: mentor.profile.id },
      manager,
    ),
    status(400),
  );
  assert.equal(
    await db.internship.count({ where: { applicationId: app.value.id } }),
    0,
  );
});

test("mentor changes enforce quota, preserve long reasons and reject outside the first seven days", async () => {
  const first = await approved();
  const second = await approved();
  await db.facultyProfile.update({
    where: { id: first.mentor.profile.id },
    data: { maxStudents: 1 },
  });
  await assert.rejects(
    service.changeMentor(
      second.internship.id,
      { facultyMentorId: first.mentor.profile.id, reason: "Quota test" },
      coordinator,
    ),
    status(409),
  );
  const target = await faculty();
  const reason = "Lý do thay đổi giảng viên. ".repeat(12);
  await service.submitFinalReport(
    second.internship.id,
    { content: "Báo cáo cần giữ nguyên".repeat(10) },
    second.app.owner.user,
  );
  await service.scoreFaculty(
    second.internship.id,
    { score: 9 },
    second.mentor.user,
    false,
  );
  const admin = await account("Admin");
  await assert.rejects(
    service.changeMentor(
      second.internship.id,
      { facultyMentorId: target.profile.id, reason },
      admin,
    ),
    status(403),
  );
  await service.changeMentor(
    second.internship.id,
    { facultyMentorId: target.profile.id, reason },
    coordinator,
  );
  assert.equal(
    await db.facultyEvaluation.findUnique({
      where: { internshipId: second.internship.id },
    }),
    null,
  );
  assert.ok(
    (
      await db.finalReport.findUnique({
        where: { internshipId: second.internship.id },
      })
    ).content,
  );
  const history = await db.auditLog.findFirst({
    where: {
      targetId: second.internship.id,
      action: "internship.mentor_change",
    },
  });
  assert.equal(history.details.facultyEvaluation.score, 9);
  assert.equal(
    history.details.previousFacultyMentorId,
    second.mentor.profile.id,
  );
  await assert.rejects(
    service.scoreFaculty(
      second.internship.id,
      { score: 10 },
      second.mentor.user,
      false,
    ),
    status(403),
  );
  await service.scoreFaculty(
    second.internship.id,
    { score: 8 },
    target.user,
    false,
  );
  assert.equal(
    (
      await db.auditLog.findFirst({
        where: {
          action: "internship.mentor_change",
          targetId: second.internship.id,
        },
      })
    ).reason,
    reason,
  );
  for (const startsAt of [
    new Date(Date.now() + day),
    new Date(Date.now() - 7 * day),
  ]) {
    await db.internship.update({
      where: { id: second.internship.id },
      data: { startsAt },
    });
    await assert.rejects(
      service.changeMentor(
        second.internship.id,
        { facultyMentorId: target.profile.id, reason },
        coordinator,
      ),
      status(400),
    );
  }
});

test("finalization snapshots all company votes and blocks subsequent writes and duplicate locks", async () => {
  const { mentor, app, internship } = await approved();
  const supervisors = await Promise.all([
    account("CompanySupervisor"),
    account("CompanySupervisor"),
  ]);
  const profiles = [];
  for (const user of supervisors) {
    const profile = await db.companySupervisorProfile.create({
      data: {
        userId: user.id,
        companyId: company.id,
        title: "Test supervisor",
      },
    });
    profiles.push(profile);
    await service.assignSupervisor(
      internship.id,
      { supervisorId: profile.id },
      representative,
    );
  }
  const weekly = await service.submitWeekly(
    internship.id,
    { weekNumber: 1, content: "Báo cáo tuần thử nghiệm" },
    app.owner.user,
  );
  await service.submitFinalReport(
    internship.id,
    { content: "Báo cáo cuối thử nghiệm".repeat(10) },
    app.owner.user,
  );
  await service.scoreFaculty(internship.id, { score: 8 }, mentor.user, false);
  const score = { discipline: 2, responsibility: 2, knowledge: 2, outcome: 4 };
  await service.scoreSupervisor(internship.id, score, supervisors[0]);
  await assert.rejects(service.lockGrade(internship.id, manager), status(400));
  await service.scoreSupervisor(
    internship.id,
    { ...score, outcome: 2 },
    supervisors[1],
  );
  const results = await Promise.allSettled([
    service.lockGrade(internship.id, manager),
    service.lockGrade(internship.id, manager),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.getStatus(),
    409,
  );
  const grade = results.find((r) => r.status === "fulfilled").value;
  assert.equal(grade.companyScore, 9);
  assert.equal(grade.facultyScore, 8);
  assert.equal(grade.finalReportScore, 8);
  assert.equal(grade.total, 8.5);
  assert.equal(grade.letterGrade, "A");
  assert.equal(grade.passed, true);
  assert.equal(grade.snapshot.formula, "50/50");
  assert.deepEqual(grade.snapshot.weights, { company: 0.5, faculty: 0.5 });
  assert.equal(grade.snapshot.facultyScoreIncludesFinalReport, true);
  assert.equal(grade.snapshot.finalReportScore, null);
  assert.equal(grade.snapshot.companyEvaluations.length, 2);
  for (const operation of [
    () =>
      service.changeCompany(
        internship.id,
        { companyId: company.id, reason: "Không được thay đổi" },
        coordinator,
      ),
    () => service.scoreFaculty(internship.id, { score: 0 }, mentor.user, false),
    () => service.scoreFaculty(internship.id, { score: 0 }, mentor.user, true),
    () =>
      service.scoreSupervisor(
        internship.id,
        { ...score, outcome: 0 },
        supervisors[0],
      ),
    () =>
      service.submitFinalReport(
        internship.id,
        { content: "Changed" },
        app.owner.user,
      ),
    () =>
      service.submitWeekly(
        internship.id,
        { weekNumber: 1, content: "Changed" },
        app.owner.user,
      ),
    () =>
      service.reviewWeekly(
        weekly.id,
        { status: "NeedsRevision", note: "Changed" },
        mentor.user,
      ),
    () =>
      service.assignSupervisor(
        internship.id,
        { supervisorId: profiles[0].id },
        representative,
      ),
    () =>
      service.changeMentor(
        internship.id,
        { facultyMentorId: mentor.profile.id, reason: "Changed" },
        coordinator,
      ),
  ])
    await assert.rejects(operation(), status(409));
  assert.equal(
    (
      await db.facultyEvaluation.findUnique({
        where: { internshipId: internship.id },
      })
    ).score,
    8,
  );
  assert.equal(
    (
      await db.finalReport.findUnique({
        where: { internshipId: internship.id },
      })
    ).score,
    null,
  );
  assert.equal(
    await db.auditLog.count({
      where: { targetId: grade.id, action: "grade.lock" },
    }),
    1,
  );
});

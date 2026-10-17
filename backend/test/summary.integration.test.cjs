const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../.test-build/app.module");
const { configureApp } = require("../.test-build/configure-app");
const { hashPassword } = require("../.test-build/auth/password");
const {
  recordAssignment,
} = require("../.test-build/internships/assignment-history");
const {
  internshipStatus,
} = require("../.test-build/internships/summary.service");
if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
  throw Error("Dedicated test database required");
const db = new PrismaClient(),
  suffix = randomUUID(),
  pass = randomUUID() + "Aa1!",
  users = {},
  cookies = {};
let app,
  base,
  dep,
  period,
  student,
  mentor,
  newMentor,
  company,
  newCompany,
  supervisor,
  internship;
const day = 86400000;
async function request(path, actor, body, expected = 200) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookies[actor],
      Origin: "http://localhost:3000",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  assert.equal(res.status, expected, `${actor} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
before(async () => {
  dep = await db.department.create({
    data: { code: suffix.slice(0, 30), name: "Khoa thống kê thử nghiệm" },
  });
  const passwordHash = await hashPassword(pass);
  for (const [key, role] of Object.entries({
    Admin: "Admin",
    Manager: "FacultyManager",
    Coordinator: "InternshipCoordinator",
    Mentor: "FacultyMentor",
    NewMentor: "FacultyMentor",
    Student: "Student",
    OtherStudent: "Student",
    Company: "Company",
    NewCompany: "Company",
    Supervisor: "CompanySupervisor",
    OtherManager: "FacultyManager",
    OtherCoordinator: "InternshipCoordinator",
  })) {
    users[key] = await db.user.create({
      data: {
        fullName: key,
        email: `${key.toLowerCase()}-${suffix}@example.test`,
        passwordHash,
        departmentId: key === "OtherManager" ? null : dep.id,
        roles: { create: { role } },
      },
    });
  }
  const makeMentor = (key) =>
    db.facultyProfile.create({
      data: {
        departmentId: dep.id,
        userId: users[key].id,
        facultyCode: randomUUID().slice(0, 25),
        fullName: key,
        email: users[key].email,
        expertise: "CNTT",
      },
    });
  mentor = await makeMentor("Mentor");
  newMentor = await makeMentor("NewMentor");
  const makeCompany = (key) =>
    db.companyProfile.create({
      data: {
        departmentId: dep.id,
        representativeUserId: users[key].id,
        name: key,
        address: "Hà Nội",
        contactName: key,
        contactEmail: users[key].email,
        contactPhone: "0900000000",
        isVerified: true,
      },
    });
  company = await makeCompany("Company");
  newCompany = await makeCompany("NewCompany");
  supervisor = await db.companySupervisorProfile.create({
    data: {
      userId: users.Supervisor.id,
      companyId: company.id,
      title: "Hướng dẫn",
    },
  });
  student = await db.studentProfile.create({
    data: {
      departmentId: dep.id,
      userId: users.Student.id,
      studentCode: randomUUID().slice(0, 25),
      fullName: "Sinh viên tổng hợp",
      email: users.Student.email,
      className: "K17",
      cohort: "K17",
      programCredits: 150,
      completedCredits: 140,
      isVerified: true,
    },
  });
  period = await db.internshipPeriod.create({
    data: {
      departmentId: dep.id,
      coordinatorId: users.Coordinator.id,
      name: "1_HK1_2026-2027",
      academicYear: "2026-2027",
      semester: 1,
      roundNumber: 1,
      status: "Published",
      registrationStartsAt: new Date(Date.now() - 10 * day),
      registrationEndsAt: new Date(Date.now() - 3 * day),
      startsAt: new Date(Date.now() - day),
      endsAt: new Date(Date.now() + 20 * day),
      weeklyReportCount: 2,
      weeklyDeadlines: [
        new Date(Date.now() - 10000),
        new Date(Date.now() + 5 * day),
      ],
    },
  });
  const application = await db.internshipApplication.create({
    data: {
      periodId: period.id,
      studentId: student.id,
      companyId: company.id,
      status: "Approved",
      positionTitle: "Developer",
    },
  });
  internship = await db.internship.create({
    data: {
      applicationId: application.id,
      periodId: period.id,
      studentId: student.id,
      companyId: company.id,
      facultyMentorId: mentor.id,
      eligibilitySnapshot: {},
      startsAt: period.startsAt,
      endsAt: period.endsAt,
    },
  });
  await db.$transaction(async (tx) => {
    await recordAssignment(
      tx,
      internship.id,
      "mentor",
      mentor.id,
      mentor.fullName,
      company.id,
      users.Manager.id,
      "Approval",
    );
    await recordAssignment(
      tx,
      internship.id,
      "company",
      company.id,
      company.name,
      company.id,
      users.Manager.id,
      "Approval",
    );
  });
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api";
  for (const [key, u] of Object.entries(users)) {
    const r = await fetch(base + "/auth/login", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: u.email, password: pass }),
    });
    assert.equal(r.status, 200);
    cookies[key] = r.headers.get("set-cookie").split(";")[0];
  }
});
after(async () => {
  if (app) await app.close();
  await db.$disconnect();
});
test("reminders classify 72h, 24h and deadline boundaries without a fake overdue date", () => {
  const {
    taskPriority,
  } = require("../.test-build/internships/notifications.service");
  const now = new Date("2026-10-14T00:00:00Z");
  for (const [offset, expected] of [
    [72 * 3600000 + 1, "pending"],
    [72 * 3600000, "soon"],
    [24 * 3600000 + 1, "soon"],
    [24 * 3600000, "urgent"],
    [0, "urgent"],
    [-1, "overdue"],
  ])
    assert.equal(taskPriority(new Date(+now + offset), now), expected);
  assert.equal(taskPriority(null, now), "pending");
});

test("notification APIs scope seven roles, paginate, filter and do not leak former assignments", async () => {
  const studentTasks = await request("/notifications/tasks", "Student");
  assert.ok(
    studentTasks.items.some(
      (t) =>
        t.type === "weekly-submit" && t.priority === "overdue" && t.blocked,
    ),
  );
  assert.ok(
    studentTasks.items.every((t) => t.href.startsWith("/workspace/student/")),
  );
  assert.equal(
    (await request("/notifications/summary", "Student")).total,
    studentTasks.total,
  );
  const filtered = await request(
    "/notifications/tasks?priority=overdue&pageSize=1",
    "Student",
  );
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].priority, "overdue");
  assert.equal(
    (await request("/notifications/tasks", "OtherStudent")).total,
    0,
  );
  assert.equal((await request("/notifications/tasks", "NewMentor")).total, 0);
  assert.equal(
    (await request("/notifications/tasks", "OtherCoordinator")).total,
    0,
  );
  await request("/notifications/tasks", "OtherManager", undefined, 403);
  for (const actor of [
    "Admin",
    "Manager",
    "Coordinator",
    "Mentor",
    "Company",
    "Supervisor",
  ]) {
    const result = await request("/notifications/tasks", actor);
    assert.equal(
      new Set(result.items.map((t) => t.id)).size,
      result.items.length,
    );
    assert.equal(
      (await request("/notifications/summary", actor)).total,
      result.total,
    );
    if (actor === "Admin")
      assert.ok(
        result.items.every(
          (t) =>
            !t.period && !t.context && t.href.startsWith("/workspace/admin/"),
        ),
      );
  }
  await request(
    "/notifications/tasks?pageSize=1000",
    "Student",
    undefined,
    400,
  );
  await request(
    "/notifications/tasks?priority=wrong",
    "Student",
    undefined,
    400,
  );
  assert.equal(
    (
      await request(
        `/faculty-workspace?internshipId=${randomUUID()}`,
        "Manager",
      )
    ).internshipTotal,
    0,
  );
});

test("submitting and reviewing a report transfers reminders to its actual owner", async () => {
  const {
    NotificationsService,
  } = require("../.test-build/internships/notifications.service");
  const service = app.get(NotificationsService);
  const roleUser = (key, role, permission) => ({
    ...users[key],
    roles: [role],
    permissions: [permission],
  });
  const now = new Date();
  const original = {
    endsAt: period.endsAt,
    weeklyDeadlines: period.weeklyDeadlines,
    gradingDeadline: period.gradingDeadline,
    finalizationDeadline: period.finalizationDeadline,
  };
  await db.internshipPeriod.update({
    where: { id: period.id },
    data: {
      endsAt: new Date(+now + 2 * day),
      weeklyDeadlines: [new Date(+now + 12 * 3600000), new Date(+now + day)],
      gradingDeadline: new Date(+now + 2 * day),
      finalizationDeadline: new Date(+now + 3 * day),
    },
  });
  let report;
  try {
    let tasks = await service.tasks(
      roleUser("Student", "Student", "reports:student"),
      now,
    );
    assert.ok(
      tasks.some(
        (t) =>
          t.id === `weekly-submit:${internship.id}:1` &&
          t.priority === "urgent" &&
          !t.blocked,
      ),
    );
    report = await db.weeklyReport.create({
      data: {
        internshipId: internship.id,
        weekNumber: 1,
        content: "Notification test",
        status: "Submitted",
      },
    });
    tasks = await service.tasks(
      roleUser("Student", "Student", "reports:student"),
      now,
    );
    assert.ok(!tasks.some((t) => t.id === `weekly-submit:${internship.id}:1`));
    assert.ok(
      (
        await service.tasks(
          roleUser("Mentor", "FacultyMentor", "reports:mentor"),
          now,
        )
      ).some((t) => t.id === `weekly-review:${report.id}`),
    );
    await db.weeklyReport.update({
      where: { id: report.id },
      data: { status: "NeedsRevision" },
    });
    assert.ok(
      (
        await service.tasks(
          roleUser("Student", "Student", "reports:student"),
          now,
        )
      ).some((t) => t.id === `weekly-submit:${internship.id}:1`),
    );
    assert.ok(
      !(
        await service.tasks(
          roleUser("Mentor", "FacultyMentor", "reports:mentor"),
          now,
        )
      ).some((t) => t.id === `weekly-review:${report.id}`),
    );
    await db.weeklyReport.update({
      where: { id: report.id },
      data: { status: "Reviewed" },
    });
    assert.ok(
      !(
        await service.tasks(
          roleUser("Student", "Student", "reports:student"),
          now,
        )
      ).some((t) => t.id === `weekly-submit:${internship.id}:1`),
    );
  } finally {
    if (report) await db.weeklyReport.delete({ where: { id: report.id } });
    await db.internshipPeriod.update({
      where: { id: period.id },
      data: original,
    });
  }
});

test("supervisor reminders belong to each assigned person and vanish on cancellation", async () => {
  await db.companySupervisorAssignment.create({
    data: { internshipId: internship.id, supervisorId: supervisor.id },
  });
  try {
    assert.ok(
      (await request("/notifications/tasks", "Supervisor")).items.some(
        (t) => t.type === "supervisor-score",
      ),
    );
    const evaluation = await db.supervisorEvaluation.create({
      data: {
        internshipId: internship.id,
        supervisorId: supervisor.id,
        discipline: 2,
        responsibility: 2,
        knowledge: 2,
        outcome: 3,
        total: 9,
      },
    });
    assert.ok(
      !(await request("/notifications/tasks", "Supervisor")).items.some(
        (t) => t.type === "supervisor-score",
      ),
    );
    await db.supervisorEvaluation.delete({ where: { id: evaluation.id } });
    await db.internshipApplication.update({
      where: { id: internship.applicationId },
      data: { status: "Cancelled" },
    });
    assert.equal((await request("/notifications/tasks", "Student")).total, 0);
    assert.equal(
      (await request("/notifications/tasks", "Supervisor")).total,
      0,
    );
  } finally {
    await db.internshipApplication.update({
      where: { id: internship.applicationId },
      data: { status: "Approved" },
    });
    await db.companySupervisorAssignment.deleteMany({
      where: { internshipId: internship.id },
    });
  }
});

test("reminders exclude previous mentor and follow coordinator reassignment", async () => {
  try {
    await db.internship.update({
      where: { id: internship.id },
      data: { facultyMentorId: newMentor.id },
    });
    assert.equal((await request("/notifications/tasks", "Mentor")).total, 0);
    assert.ok((await request("/notifications/tasks", "NewMentor")).total > 0);
    await db.internshipPeriod.update({
      where: { id: period.id },
      data: { coordinatorId: users.OtherCoordinator.id },
    });
    const prior = await request("/notifications/tasks", "Coordinator");
    assert.ok(prior.items.every((t) => t.period?.id !== period.id));
    assert.ok(
      (await request("/notifications/tasks", "OtherCoordinator")).items.some(
        (t) => t.period?.id === period.id,
      ),
    );
  } finally {
    await db.internship.update({
      where: { id: internship.id },
      data: { facultyMentorId: mentor.id },
    });
    await db.internshipPeriod.update({
      where: { id: period.id },
      data: { coordinatorId: users.Coordinator.id },
    });
  }
});

test("status boundaries are deterministic", () => {
  const now = new Date();
  const i = {
    application: { status: "Approved" },
    finalGrade: null,
    startsAt: new Date(+now - day),
    endsAt: new Date(+now + day),
  };
  assert.equal(internshipStatus(i, now), "active");
  assert.equal(
    internshipStatus({ ...i, endsAt: new Date(+now - 1) }, now),
    "awaiting",
  );
  assert.equal(
    internshipStatus({ ...i, startsAt: new Date(+now + 1) }, now),
    "upcoming",
  );
  assert.equal(internshipStatus({ ...i, finalGrade: {} }, now), "completed");
  assert.equal(
    internshipStatus({ ...i, application: { status: "Cancelled" } }, now),
    "cancelled",
  );
});
test("all seven roles are scoped; exports and direct history reject unauthorized actors", async () => {
  for (const actor of [
    "Manager",
    "Coordinator",
    "Mentor",
    "Student",
    "Company",
  ]) {
    const list = await request("/reports/internships", actor);
    assert.equal(list.total, 1);
    assert.equal(list.items[0].id, internship.id);
  }
  for (const actor of ["OtherStudent", "OtherCoordinator", "Supervisor"]) {
    assert.equal((await request("/reports/internships", actor)).total, 0);
    await request(
      `/reports/internships/${internship.id}/history`,
      actor,
      undefined,
      404,
    );
  }
  await request("/reports/internships", "Admin", undefined, 403);
  await request("/reports/internships", "OtherManager", undefined, 403);
  const overview = await request("/reports/overview", "Admin");
  assert.equal(overview.metrics.length, 6);
  assert.equal(JSON.stringify(overview).includes(student.studentCode), false);
  for (const actor of ["Admin", "Mentor", "Student", "Company", "Supervisor"])
    await request("/reports/internships/export", actor, undefined, 403);
  for (const actor of ["Manager", "Coordinator"]) {
    const r = await fetch(
      base + "/reports/internships/export?academicYear=2026-2027",
      { headers: { Cookie: cookies[actor] } },
    );
    assert.equal(r.status, 200);
    assert.ok((await r.arrayBuffer()).byteLength > 1000);
  }
});
test("filters, overview and pagination agree", async () => {
  const q = `academicYear=2026-2027&semester=1&periodId=${period.id}&companyId=${company.id}&mentorId=${mentor.id}&status=active&attention=missingReports&pageSize=1`;
  const list = await request("/reports/internships?" + q, "Manager");
  assert.equal(list.total, 1);
  assert.equal(list.items[0].missingReports, 1);
  assert.equal(list.companies[0].active, 1);
  const overview = await request("/reports/overview?" + q, "Manager");
  assert.equal(
    overview.metrics.find((m) => m.key === "active").value,
    list.total,
  );
  assert.equal(
    (await request("/reports/internships?academicYear=2025-2026", "Manager"))
      .total,
    0,
  );
  assert.equal(
    (await request("/reports/internships?search=does-not-exist", "Manager"))
      .total,
    0,
  );
  assert.equal(
    (await request("/reports/internships?page=2&pageSize=1", "Manager")).items
      .length,
    0,
  );
  await request("/reports/internships?pageSize=999", "Manager", undefined, 400);
});
test("supervisor assignment is idempotent and preserves multiple supervisors", async () => {
  await Promise.all(
    [0, 1].map(() =>
      request(
        `/internships/${internship.id}/company-supervisors`,
        "Company",
        { supervisorId: supervisor.id },
        204,
      ),
    ),
  );
  assert.equal(
    await db.assignmentHistory.count({
      where: { internshipId: internship.id, kind: "supervisor", endedAt: null },
    }),
    1,
  );
  assert.equal((await request("/reports/internships", "Supervisor")).total, 1);
  const second = await db.companySupervisorProfile.create({
    data: {
      company: { connect: { id: company.id } },
      title: "Hướng dẫn thứ hai",
      user: {
        create: {
          fullName: "Người hướng dẫn thứ hai",
          email: `second-${suffix}@example.test`,
          passwordHash: await hashPassword(pass),
          roles: { create: { role: "CompanySupervisor" } },
        },
      },
    },
  });
  await request(
    `/internships/${internship.id}/company-supervisors`,
    "Company",
    { supervisorId: second.id },
    204,
  );
  assert.equal(
    await db.assignmentHistory.count({
      where: { internshipId: internship.id, kind: "supervisor", endedAt: null },
    }),
    2,
  );
});
test("changing mentor preserves own scores and removes operational access", async () => {
  await db.facultyEvaluation.create({
    data: {
      internshipId: internship.id,
      score: 8,
      note: "Nhận xét giảng viên cũ",
    },
  });
  assert.equal(
    (await request("/reports/internships", "Student")).items[0].facultyScore,
    null,
  );
  assert.ok(
    (
      await request(`/reports/internships/${internship.id}/history`, "Student")
    ).every((h) => h.snapshot === null),
  );
  await request(
    `/internships/${internship.id}/faculty-mentor`,
    "Coordinator",
    { facultyMentorId: newMentor.id, reason: "Điều chỉnh phân công hướng dẫn" },
    204,
  );
  const prior = await request(
    "/reports/internships?assignment=former",
    "Mentor",
  );
  assert.equal(prior.total, 1);
  assert.equal(prior.items[0].facultyScore, null);
  const history = await request(
    `/reports/internships/${internship.id}/history`,
    "Mentor",
  );
  assert.equal(history.length, 1);
  assert.ok(history[0].endedAt);
  assert.equal(history[0].snapshot.facultyEvaluation.score, 8);
  await request(
    `/internships/${internship.id}/faculty-score`,
    "Mentor",
    { score: 9, note: "Không còn phân công" },
    403,
  );
  assert.equal(
    (await request("/reports/internships", "NewMentor")).items[0].isCurrent,
    true,
  );
  assert.equal(
    (
      await request(
        `/reports/internships/${internship.id}/history`,
        "NewMentor",
      )
    ).some((h) => h.snapshot?.facultyEvaluation?.score === 8),
    false,
  );
});

test("multi-year history and database current-assignment uniqueness", async () => {
  const previous = await db.internshipPeriod.create({
    data: {
      departmentId: dep.id,
      coordinatorId: users.Coordinator.id,
      name: "1_HK2_2025-2026",
      academicYear: "2025-2026",
      semester: 2,
      roundNumber: 1,
      status: "Closed",
      registrationStartsAt: new Date(Date.now() - 400 * day),
      registrationEndsAt: new Date(Date.now() - 390 * day),
      startsAt: new Date(Date.now() - 380 * day),
      endsAt: new Date(Date.now() - 300 * day),
      weeklyReportCount: 1,
    },
  });
  const application = await db.internshipApplication.create({
    data: {
      periodId: previous.id,
      studentId: student.id,
      companyId: company.id,
      status: "Approved",
      positionTitle: "Thực tập trước",
    },
  });
  await db.internship.create({
    data: {
      applicationId: application.id,
      periodId: previous.id,
      studentId: student.id,
      companyId: company.id,
      facultyMentorId: mentor.id,
      eligibilitySnapshot: {},
      startsAt: previous.startsAt,
      endsAt: previous.endsAt,
    },
  });
  const result = await request(
    "/reports/internships?academicYear=2025-2026&semester=2",
    "Mentor",
  );
  assert.equal(result.total, 1);
  assert.equal(result.items[0].period.id, previous.id);
  const all = await request("/reports/internships", "Manager");
  assert.equal(all.total, 2);
  assert.equal(all.studentCount, 1);
  await assert.rejects(
    () =>
      db.assignmentHistory.create({
        data: {
          internshipId: internship.id,
          kind: "mentor",
          targetId: mentor.id,
          targetName: mentor.fullName,
          source: "Change",
        },
      }),
    (e) => e.code === "P2002",
  );
  assert.equal((await request("/reports/registrations", "Student")).total, 2);
  await request("/reports/registrations", "Mentor", undefined, 403);
});
test("changing company preserves company/supervisor evaluation snapshots", async () => {
  await db.supervisorEvaluation.create({
    data: {
      internshipId: internship.id,
      supervisorId: supervisor.id,
      discipline: 2,
      responsibility: 2,
      knowledge: 2,
      outcome: 3,
      total: 9,
      evidenceNote: "Nhận xét doanh nghiệp cũ",
    },
  });
  await request(
    `/internships/${internship.id}/company`,
    "Coordinator",
    { companyId: newCompany.id, reason: "Chuyển nơi thực tập phù hợp" },
    204,
  );
  for (const actor of ["Company", "Supervisor"]) {
    const list = await request("/reports/internships?assignment=former", actor);
    assert.equal(list.total, 1);
    assert.equal(list.items[0].company.id, company.id);
    assert.equal(list.items[0].companyScores.length, 0);
    const history = await request(
      `/reports/internships/${internship.id}/history`,
      actor,
    );
    assert.equal(history[0].snapshot.evaluations[0].score, 9);
  }
  const fresh = await request(
    `/reports/internships/${internship.id}/history`,
    "NewCompany",
  );
  assert.equal(fresh.length, 1);
  assert.deepEqual(fresh[0].snapshot.evaluations, []);
  assert.equal(
    await db.assignmentHistory.count({
      where: { internshipId: internship.id, kind: "mentor", endedAt: null },
    }),
    1,
  );
});

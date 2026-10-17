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

async function person(role, department = dep.id) {
  const key = randomUUID();
  const user = await db.user.create({
    data: {
      email: `${key}@example.test`,
      fullName: `QA ${role}`,
      passwordHash: await hashPassword(pass),
      departmentId: department,
      roles: { create: { role } },
    },
  });
  cookies[key] = await login(user.email, pass);
  return { user, key };
}
async function mentor(department = dep.id, maxStudents = 10) {
  const p = await person("FacultyMentor", department);
  const profile = await db.facultyProfile.create({
    data: {
      userId: p.user.id,
      departmentId: department,
      facultyCode: p.user.id.slice(0, 25),
      fullName: p.user.fullName,
      email: p.user.email,
      expertise: "CNTT",
      maxStudents,
    },
  });
  return { ...p, profile };
}
async function scenario() {
  const s = await person("Student");
  const profile = await db.studentProfile.create({
    data: {
      userId: s.user.id,
      departmentId: dep.id,
      majorId: program.majorId,
      programId: program.id,
      cohortId: cohort.id,
      studentCode: s.user.id.slice(0, 25),
      fullName: s.user.fullName,
      email: s.user.email,
      className: "K17-CNTT",
      cohort: "K17",
      programCredits: 150,
      completedCredits: 130,
      isVerified: true,
    },
  });
  const period = await db.internshipPeriod.create({
    data: {
      name: `Mentor QA ${randomUUID()}`,
      departmentId: dep.id,
      coordinatorId: users.InternshipCoordinator.id,
      status: "Published",
      registrationStartsAt: new Date(Date.now() - day),
      registrationEndsAt: new Date(Date.now() + day),
      startsAt: new Date(Date.now() + 2 * day),
      endsAt: new Date(Date.now() + 50 * day),
      weeklyReportCount: 6,
      audience: { create: { majorId: program.majorId, cohortId: cohort.id } },
    },
  });
  const company = await db.companyProfile.create({
    data: {
      name: "Mentor QA",
      departmentId: dep.id,
      address: "Hà Nội",
      contactName: "QA",
      contactEmail: `${randomUUID()}@example.test`,
      contactPhone: "0123456789",
      isVerified: true,
    },
  });
  const body = {
    periodId: period.id,
    companyId: company.id,
    positionTitle: "Lập trình viên",
  };
  return { ...s, profile, period, company, body };
}
async function register(s, m) {
  return call(
    "/internship-applications",
    s.key,
    {
      ...s.body,
      ...(m
        ? {
            proposedMentorId: m.profile.id,
            mentorReason: "Mong được hướng dẫn về lập trình web.",
          }
        : {}),
    },
    201,
  );
}
async function requests(s) {
  return (await call("/internships/mine", s.key)).applications[0]
    .mentorRequests;
}
async function endRegistration(s) {
  await db.internshipPeriod.update({
    where: { id: s.period.id },
    data: { registrationEndsAt: new Date(Date.now() - 1000) },
  });
}

test("proposal is optional; acceptance preserves quota; matching assignment closes history", async () => {
  const s = await scenario(),
    m = await mentor();
  const choices = await call(
    `/internship-periods/${s.period.id}/mentor-choices`,
    s.key,
  );
  assert.ok(choices.some((f) => f.id === m.profile.id && f.available));
  const a = await register(s, m),
    r = (await requests(s))[0];
  await call(
    `/mentor-requests/${r.id}/respond`,
    m.key,
    { response: "Accepted" },
    201,
  );
  const repeated = await call(
    `/mentor-requests/${r.id}/respond`,
    m.key,
    { response: "Accepted" },
    201,
  );
  assert.equal(repeated.id, r.id);
  assert.ok(!JSON.stringify(repeated).includes("passwordHash"));
  assert.ok(!("facultyMentor" in repeated));
  assert.equal(
    await db.internship.count({ where: { facultyMentorId: m.profile.id } }),
    0,
  );
  await endRegistration(s);
  await call(
    `/internship-applications/${a.id}/approve`,
    "FacultyManager",
    { facultyMentorId: m.profile.id },
    201,
  );
  assert.equal((await requests(s))[0].closeReason, "Assigned");
  await call(
    `/mentor-requests/${r.id}/respond`,
    m.key,
    { response: "Accepted" },
    409,
  );
  const legacy = await scenario(),
    old = await register(legacy);
  assert.equal((await requests(legacy)).length, 0);
  await endRegistration(legacy);
  await call(
    `/internship-applications/${old.id}/approve`,
    "FacultyManager",
    { facultyMentorId: m.profile.id },
    201,
  );
});

test("replacement, withdrawal, repeated submissions and stale responses preserve one active request", async () => {
  const s = await scenario(),
    m = await mentor(),
    n = await mentor();
  const a = await register(s, m),
    old = (await requests(s))[0];
  await call(
    `/mentor-requests/${old.id}/respond`,
    m.key,
    { response: "Accepted" },
    201,
  );
  const body = {
    facultyMentorId: n.profile.id,
    reason: "Thay đổi lĩnh vực thực tập sang hệ thống.",
  };
  await Promise.all([
    call(`/internship-applications/${a.id}/mentor-request`, s.key, body, 201),
    call(`/internship-applications/${a.id}/mentor-request`, s.key, body, 201),
  ]);
  let history = await requests(s);
  assert.equal(history.length, 2);
  assert.equal(history.filter((r) => !r.closedAt).length, 1);
  assert.equal(history.find((r) => r.id === old.id).response, "Accepted");
  await call(
    `/mentor-requests/${old.id}/respond`,
    m.key,
    { response: "Declined", note: "Không còn phù hợp với chuyên môn." },
    409,
  );
  await call(
    `/internship-applications/${a.id}/mentor-request/withdraw`,
    s.key,
    {},
    201,
  );
  await call(
    `/internship-applications/${a.id}/mentor-request/withdraw`,
    s.key,
    {},
    201,
  );
  assert.equal((await requests(s)).filter((r) => !r.closedAt).length, 0);
  await call("/internship-applications", s.key, s.body, 409);
});

test("declines and accepted preferences require explanations only for conflicting decisions", async () => {
  const s = await scenario(),
    m = await mentor(),
    n = await mentor();
  const a = await register(s, m),
    r = (await requests(s))[0];
  await call(
    `/mentor-requests/${r.id}/respond`,
    m.key,
    { response: "Declined", note: "ngắn" },
    400,
  );
  await call(
    `/mentor-requests/${r.id}/respond`,
    m.key,
    { response: "Declined", note: "Không phù hợp với chuyên môn hiện tại." },
    201,
  );
  await endRegistration(s);
  await call(
    `/internship-applications/${a.id}/approve`,
    "FacultyManager",
    { facultyMentorId: m.profile.id },
    400,
  );
  await call(
    `/internship-applications/${a.id}/approve`,
    "FacultyManager",
    { facultyMentorId: n.profile.id },
    201,
  );
  const t = await scenario(),
    b = await register(t, m),
    q = (await requests(t))[0];
  await call(
    `/mentor-requests/${q.id}/respond`,
    m.key,
    { response: "Accepted" },
    201,
  );
  await endRegistration(t);
  await call(
    `/internship-applications/${b.id}/approve`,
    "FacultyManager",
    { facultyMentorId: n.profile.id },
    400,
  );
  await call(
    `/internship-applications/${b.id}/approve`,
    "FacultyManager",
    {
      facultyMentorId: n.profile.id,
      note: "Cân đối tải hướng dẫn trong khoa.",
    },
    201,
  );
  assert.equal((await requests(t))[0].response, "Accepted");
  const pending = await scenario(),
    c = await register(pending, m);
  await endRegistration(pending);
  await call(
    `/internship-applications/${c.id}/approve`,
    "FacultyManager",
    { facultyMentorId: n.profile.id },
    201,
  );
});

test("role, department, ownership, deadline and inactive-account restrictions are enforced through HTTP", async () => {
  const s = await scenario(),
    m = await mentor(),
    n = await mentor(),
    foreign = await mentor(other.id);
  await call(
    `/internship-periods/${s.period.id}/mentor-choices`,
    "Admin",
    undefined,
    403,
  );
  const choices = await call(
    `/internship-periods/${s.period.id}/mentor-choices`,
    s.key,
  );
  assert.ok(!choices.some((f) => f.id === foreign.profile.id));
  await call(
    "/internship-applications",
    s.key,
    {
      ...s.body,
      proposedMentorId: foreign.profile.id,
      mentorReason: "Muốn học theo lĩnh vực phù hợp.",
    },
    400,
  );
  assert.equal(
    await db.internshipApplication.count({
      where: { studentId: s.profile.id },
    }),
    0,
  );
  const a = await register(s, m),
    r = (await requests(s))[0];
  for (const role of [
    "Admin",
    "FacultyManager",
    "InternshipCoordinator",
    s.key,
  ])
    await call(
      `/mentor-requests/${r.id}/respond`,
      role,
      { response: "Accepted" },
      403,
    );
  await call(
    `/mentor-requests/${r.id}/respond`,
    n.key,
    { response: "Accepted" },
    403,
  );
  await call(
    `/mentor-requests/${r.id}/respond`,
    foreign.key,
    { response: "Accepted" },
    403,
  );
  const list = await call("/mentor-requests", n.key);
  assert.ok(!list.items.some((i) => i.id === r.id));
  await call(
    `/internship-applications/${a.id}/mentor-request`,
    "Student",
    {
      facultyMentorId: m.profile.id,
      reason: "Không phải hồ sơ của tài khoản này.",
    },
    404,
  );
  await call(
    `/internship-applications/${a.id}/approve`,
    "other",
    { facultyMentorId: m.profile.id },
    403,
  );
  await db.user.update({ where: { id: m.user.id }, data: { isActive: false } });
  assert.ok(
    !(
      await call(`/internship-periods/${s.period.id}/mentor-choices`, s.key)
    ).some((f) => f.id === m.profile.id),
  );
  await endRegistration(s);
  await call(
    `/internship-applications/${a.id}/mentor-request/withdraw`,
    s.key,
    {},
    409,
  );
  await call(
    `/internship-applications/${a.id}/approve`,
    "FacultyManager",
    { facultyMentorId: m.profile.id },
    400,
  );
  await db.user.update({ where: { id: m.user.id }, data: { isActive: true } });
  await db.facultyProfile.update({
    where: { id: m.profile.id },
    data: { isActive: false },
  });
  await call(
    `/mentor-requests/${r.id}/respond`,
    m.key,
    { response: "Accepted" },
    403,
  );
});

test("two accepted requests racing for final place cannot exceed capacity; full mentor blocks new request", async () => {
  const s = await scenario(),
    t = await scenario(),
    m = await mentor(dep.id, 1);
  const a = await register(s, m),
    b = await register(t, m);
  for (const student of [s, t]) {
    const r = (await requests(student))[0];
    await call(
      `/mentor-requests/${r.id}/respond`,
      m.key,
      { response: "Accepted" },
      201,
    );
    await endRegistration(student);
  }
  const results = await Promise.all(
    [a, b].map((x) =>
      fetch(base + `/internship-applications/${x.id}/approve`, {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: cookies.FacultyManager,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ facultyMentorId: m.profile.id }),
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await db.internship.count({ where: { facultyMentorId: m.profile.id } }),
    1,
  );
  const u = await scenario();
  assert.equal(
    (
      await call(`/internship-periods/${u.period.id}/mentor-choices`, u.key)
    ).find((f) => f.id === m.profile.id).available,
    false,
  );
  await call(
    "/internship-applications",
    u.key,
    {
      ...u.body,
      proposedMentorId: m.profile.id,
      mentorReason: "Đề xuất hướng dẫn sau khi hết chỉ tiêu.",
    },
    409,
  );
});

test("cancellation and rejection close proposals; database rejects a second active proposal", async () => {
  const m = await mentor();
  for (const action of ["cancel", "reject"]) {
    const s = await scenario(),
      a = await register(s, m),
      r = (await requests(s))[0];
    await assert.rejects(
      db.mentorRequest.create({
        data: {
          applicationId: a.id,
          facultyMentorId: m.profile.id,
          reason: "Đề xuất trùng không hợp lệ.",
        },
      }),
      (e) => e.code === "P2002",
    );
    await call(
      `/internship-applications/${a.id}/${action}`,
      action === "cancel" ? s.key : "FacultyManager",
      action === "cancel" ? {} : { note: "Không đủ điều kiện phê duyệt." },
      action === "cancel" ? 204 : 201,
    );
    assert.ok((await requests(s))[0].closedAt);
    await call(
      `/mentor-requests/${r.id}/respond`,
      m.key,
      { response: "Accepted" },
      409,
    );
  }
});

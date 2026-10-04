const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const { NestFactory } = require("@nestjs/core");
const { PrismaClient } = require("@prisma/client");
const { AppModule } = require("../.test-build/app.module");
const { configureApp } = require("../.test-build/configure-app");
const { hashPassword } = require("../.test-build/auth/password");
if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
  throw new Error("Dedicated test database required.");
const fixture = require("./academic-fixture.cjs").academicFixture();
const db = fixture.db;
const prefix = randomUUID();
const password = `Test-only-${randomUUID()}`;
let app, base, admin, student, coordinator, adminCookie, studentCookie;
async function request(
  route,
  { method = "GET", body, cookie, origin = "http://localhost:3000" } = {},
) {
  return fetch(base + route, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login(email, candidate = password) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password: candidate },
  });
}
function cookieOf(response) {
  return response.headers.get("set-cookie").split(";")[0];
}
before(async () => {
  await fixture.setup();
  await db.loginThrottle.deleteMany({
    where: { key: createHash("sha256").update("ip:127.0.0.1").digest("hex") },
  });
  const passwordHash = await hashPassword(password);
  admin = await db.user.create({
    data: {
      email: `${prefix}-admin@example.com`,
      fullName: "Test Administrator",
      passwordHash,
      roles: { create: { role: "Admin" } },
    },
  });
  student = await db.user.create({
    data: {
      email: `${prefix}-student@example.com`,
      fullName: "Test Student",
      passwordHash,
      roles: { create: { role: "Student" } },
    },
  });
  coordinator = await db.user.create({
    data: {
      email: `${prefix}-coordinator@example.com`,
      fullName: "Test Coordinator",
      passwordHash,
      roles: { create: { role: "InternshipCoordinator" } },
    },
  });
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
});
after(async () => {
  if (app) await app.close();
  await db.$disconnect();
});
test("report HTTP queries validate filters and deny unauthorized exports and audit", async () => {
  const cookie = cookieOf(await login(coordinator.email));
  const studentSession = cookieOf(await login(student.email));
  for (const route of [
    "/reports/dashboard?metric=invalid",
    "/reports/dashboard?metric=students&page=0",
    "/reports/readiness?kind=invalid",
    "/reports/readiness?filter=invalid",
    "/faculty-workspace?applicationPage=0",
    "/faculty-workspace?internshipPage=0",
  ]) {
    assert.equal((await request(route, { cookie })).status, 400);
  }
  for (const route of [
    "/reports/progress",
    "/reports/applications",
    "/reports/readiness",
    "/reports/dashboard?metric=students",
    "/reports/progress/export",
    "/reports/applications/export",
    `/reports/internships/${randomUUID()}/audit`,
  ]) {
    assert.equal((await request(route)).status, 401);
    assert.equal(
      (await request(route, { cookie: studentSession })).status,
      403,
    );
  }
  for (const query of [
    "page=0",
    "pageSize=101",
    "filter=unknown",
    "periodId=invalid",
    "unexpected=true",
  ]) {
    assert.equal(
      (await request(`/reports/progress?${query}`, { cookie })).status,
      400,
    );
    assert.equal(
      (await request(`/reports/progress/export?${query}`, { cookie })).status,
      400,
    );
  }
  assert.equal(
    (await request(`/reports/internships/${randomUUID()}/audit`, { cookie }))
      .status,
    403,
  );
  assert.equal(
    (await request(`/reports/applications/export?status=unknown`, { cookie }))
      .status,
    400,
  );
});
test("anonymous requests cannot read or create users", async () => {
  assert.equal((await request("/health")).status, 200);
  assert.equal((await request("/auth/me")).status, 401);
  assert.equal((await request("/users")).status, 401);
  assert.equal(
    (await request("/users", { method: "POST", body: {} })).status,
    401,
  );
});
test("profile HTTP endpoints reject privilege fields and invalid contact updates", async () => {
  const profileAdmin = await db.user.create({
    data: {
      email: `${randomUUID()}-profile-admin@example.test`,
      fullName: "Profile admin test",
      passwordHash: admin.passwordHash,
      roles: { create: { role: "InternshipCoordinator" } },
    },
  });
  const profileStudent = await db.user.create({
    data: {
      email: `${randomUUID()}-profile-student@example.test`,
      fullName: "Profile student test",
      passwordHash: student.passwordHash,
      roles: { create: { role: "Student" } },
    },
  });
  const adminResponse = await login(profileAdmin.email);
  const currentAdminCookie = adminResponse.headers
    .get("set-cookie")
    .split(";")[0];
  const studentResponse = await login(profileStudent.email);
  const currentStudentCookie = studentResponse.headers
    .get("set-cookie")
    .split(";")[0];
  assert.equal(
    (
      await request("/profiles/students", {
        method: "POST",
        cookie: currentStudentCookie,
        body: { data: {} },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/profiles/students", {
        method: "POST",
        cookie: currentAdminCookie,
        body: { data: { isVerified: true } },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/profiles/students", {
        method: "POST",
        cookie: currentAdminCookie,
        body: { data: [], roles: ["Admin"] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/students/me/contact", {
        method: "POST",
        cookie: currentStudentCookie,
        body: { email: "invalid" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/students/me/contact", {
        method: "POST",
        cookie: currentStudentCookie,
        body: { email: "valid@example.test", completedCredits: 999 },
      })
    ).status,
    400,
  );
});
test("login rejects wrong password and unknown account with the same message", async () => {
  const wrong = await login(student.email, "Wrong synthetic password");
  const unknown = await login(`${prefix}-unknown@example.com`);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
});
test("file routes require a session and multipart size limits reject oversized uploads", async () => {
  const user = await db.user.create({
    data: {
      email: `${randomUUID()}@file-test.example`,
      fullName: "File HTTP test",
      passwordHash: student.passwordHash,
      roles: { create: { role: "Student" } },
    },
  });
  const cookie = cookieOf(await login(user.email));
  const id = randomUUID();
  assert.equal((await request(`/files/${id}`)).status, 401);
  assert.equal((await request(`/files/${id}`, { cookie })).status, 403);
  const body = new FormData();
  body.set(
    "file",
    new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: "application/pdf" }),
    "too-large.pdf",
  );
  const response = await fetch(`${base}/internships/${id}/final-report/file`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: "http://localhost:3000" },
    body,
  });
  assert.equal(response.status, 413);
  const invalid = new FormData();
  invalid.set("file", new Blob(["not a PDF"]), "fake.pdf");
  assert.equal(
    (
      await fetch(`${base}/internships/${id}/final-report/file`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: "http://localhost:3000" },
        body: invalid,
      })
    ).status,
    400,
  );
});
test("login validates DTO and rejects extra role fields", async () => {
  for (const body of [
    { email: "bad", password },
    { email: admin.email, password, roles: ["Admin"] },
    { email: admin.email, password: "x".repeat(129) },
  ])
    assert.equal(
      (await request("/auth/login", { method: "POST", body })).status,
      400,
    );
});
test("login creates an HttpOnly SameSite cookie; database stores only its hash", async () => {
  const response = await login(` ${admin.email.toUpperCase()} `);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.match(response.headers.get("set-cookie"), /Path=\//);
  adminCookie = cookieOf(response);
  const user = await response.json();
  assert.equal(user.id, admin.id);
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.token, undefined);
  const session = await db.session.findFirst({ where: { userId: admin.id } });
  const token = adminCookie.split("=")[1];
  assert.notEqual(session.tokenHash, token);
  assert.equal(
    session.tokenHash,
    createHash("sha256").update(token).digest("hex"),
  );
  studentCookie = cookieOf(await login(student.email));
});
test("me ignores supplied user ID and returns only the current identity", async () => {
  const response = await request(`/auth/me?id=${admin.id}`, {
    cookie: studentCookie,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.id, student.id);
  assert.deepEqual(result.permissions, ["internships:student"]);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("only a coordinator can create a valid locked internship period", async () => {
  const coordinatorCookie = cookieOf(await login(coordinator.email));
  const body = {
    name: `Period ${prefix}`,
    departmentId: fixture.state.department.id,
    roundNumber: 1,
    semester: 1,
    academicYear: "2030-2031",
    audience: [
      {
        majorId: fixture.state.program.majorId,
        cohortId: fixture.state.cohort.id,
      },
    ],
    registrationStartsAt: "2030-01-01T00:00:00.000Z",
    registrationEndsAt: "2030-01-10T00:00:00.000Z",
    startsAt: "2030-01-11T00:00:00.000Z",
    endsAt: "2030-03-01T00:00:00.000Z",
    weeklyReportCount: 6,
    weeklyDeadlines: [
      "2030-01-18",
      "2030-01-25",
      "2030-02-01",
      "2030-02-08",
      "2030-02-15",
      "2030-03-01",
    ].map((value) => `${value}T00:00:00.000Z`),
    gradingDeadline: "2030-03-08T00:00:00.000Z",
    finalizationDeadline: "2030-03-15T00:00:00.000Z",
    creditThresholdPercent: 80,
  };
  assert.equal(
    (
      await request("/internship-periods", {
        method: "POST",
        body,
        cookie: studentCookie,
      })
    ).status,
    403,
  );
  const response = await request("/internship-periods", {
    method: "POST",
    body,
    cookie: coordinatorCookie,
  });
  assert.equal(response.status, 201);
  const period = await response.json();
  assert.equal(period.status, "Draft");
  assert.equal(
    (
      await request(`/internship-periods/${period.id}/publish`, {
        method: "POST",
        cookie: coordinatorCookie,
      })
    ).status,
    201,
  );
});
test("student cannot list or create users even by supplying Admin roles", async () => {
  assert.equal(
    (await request("/users", { cookie: studentCookie })).status,
    403,
  );
  assert.equal(
    (
      await request("/users", {
        method: "POST",
        cookie: studentCookie,
        body: {
          email: `${prefix}-intruder@example.com`,
          fullName: "Intruder",
          password,
          roles: ["Admin"],
        },
      })
    ).status,
    403,
  );
});
test("cross-origin and originless mutations fail including login and logout", async () => {
  for (const origin of ["https://untrusted.example", "null", ""]) {
    assert.equal(
      (
        await request("/auth/login", {
          method: "POST",
          origin,
          body: { email: admin.email, password },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/auth/logout", {
          method: "POST",
          origin,
          cookie: adminCookie,
        })
      ).status,
      403,
    );
  }
});
test("admin creates user and audit atomically without exposing hashes", async () => {
  const body = {
    email: `${prefix}-new@example.com`,
    fullName: "Created Student",
    roles: ["Student"],
  };
  const response = await request("/users", {
    method: "POST",
    cookie: adminCookie,
    body,
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.passwordHash, undefined);
  assert.deepEqual(created.roles, ["Student"]);
  assert.equal(
    await db.auditLog.count({
      where: {
        actorId: admin.id,
        targetId: created.id,
        action: "users.create",
      },
    }),
    1,
  );
  assert.equal(
    (await login(body.email, created.temporaryPassword)).status,
    200,
  );
  assert.equal(
    (
      await request("/users", {
        method: "POST",
        cookie: adminCookie,
        body: { ...body, email: body.email.toUpperCase() },
      })
    ).status,
    409,
  );
});
test("invalid role short password and mass assignment are rejected", async () => {
  const valid = {
    email: `${prefix}-invalid@example.com`,
    fullName: "Invalid Student",
    roles: ["Student"],
  };
  for (const body of [
    { ...valid, roles: ["SuperAdmin"] },
    { ...valid, password: "short" },
    { ...valid, isActive: false },
    { ...valid, roles: [] },
    { ...valid, roles: ["Student", "Student"] },
  ])
    assert.equal(
      (await request("/users", { method: "POST", cookie: adminCookie, body }))
        .status,
      400,
    );
});
test("pagination and filtering work and never return hashes", async () => {
  const response = await request(`/users?page=1&pageSize=1&search=${prefix}`, {
    cookie: adminCookie,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.items.length, 1);
  assert.equal(result.total, 4);
  assert.equal(result.items[0].passwordHash, undefined);
  for (const query of [
    "page=0",
    "pageSize=999",
    "page=1.5",
    "page=not-a-number",
    "page=999999999999",
  ])
    assert.equal(
      (await request("/users?" + query, { cookie: adminCookie })).status,
      400,
    );
});
test("disabled accounts immediately lose access and cannot log in", async () => {
  await db.user.update({
    where: { id: student.id },
    data: { isActive: false },
  });
  assert.equal(
    (await request("/auth/me", { cookie: studentCookie })).status,
    401,
  );
  assert.equal((await login(student.email)).status, 401);
  await db.user.update({ where: { id: student.id }, data: { isActive: true } });
});
test("permission changes apply to an existing session immediately", async () => {
  await db.userRole.delete({
    where: { userId_role: { userId: admin.id, role: "Admin" } },
  });
  assert.equal((await request("/users", { cookie: adminCookie })).status, 403);
  await db.userRole.create({ data: { userId: admin.id, role: "Admin" } });
});
test("expired forged and duplicated session cookies fail closed", async () => {
  await db.session.updateMany({
    where: { userId: student.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  for (const cookie of [
    studentCookie,
    "interna_session=" + "f".repeat(64),
    adminCookie + "; " + adminCookie,
    "interna_session=bad",
  ])
    assert.equal((await request("/auth/me", { cookie })).status, 401);
});
test("logout invalidates the database session and prevents replay", async () => {
  const response = await request("/auth/logout", {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  assert.equal(
    (await request("/auth/me", { cookie: adminCookie })).status,
    401,
  );
  assert.equal(
    await db.auditLog.count({
      where: { actorId: admin.id, action: "auth.logout" },
    }),
    1,
  );
});
test("persistent login limiter rejects concurrent excess attempts", async () => {
  const email = `${prefix}-limited@example.com`;
  const responses = await Promise.all(
    Array.from({ length: 12 }, () => login(email)),
  );
  assert.equal(
    responses.filter((response) => response.status === 429).length,
    2,
  );
  assert.equal(
    responses.filter((response) => response.status === 401).length,
    10,
  );
});

test("provisioned account must change password before business access and revokes other sessions", async () => {
  const profile = await db.studentProfile.create({
    data: {
      studentCode: `T-${randomUUID().slice(0, 20)}`,
      fullName: "Temporary student",
      isVerified: true,
      email: `${prefix}-temporary@example.com`,
      className: "CNTT",
      cohort: "2026",
      programCredits: 150,
      completedCredits: 130,
    },
  });
  const managerCookie = cookieOf(await login(admin.email));
  const provision = await request("/users/provision", {
    method: "POST",
    cookie: managerCookie,
    body: { items: [{ type: "student", id: profile.id }] },
  });
  assert.equal(provision.status, 201);
  const issued = (await provision.json()).results[0];
  assert.equal(typeof issued.temporaryPassword, "string");
  const firstLogin = await login(profile.email, issued.temporaryPassword);
  assert.equal(firstLogin.status, 200);
  assert.equal((await firstLogin.json()).mustChangePassword, true);
  const firstCookie = cookieOf(firstLogin);
  const secondCookie = cookieOf(
    await login(profile.email, issued.temporaryPassword),
  );
  const logoutCookie = cookieOf(
    await login(profile.email, issued.temporaryPassword),
  );
  assert.equal(
    (await request("/auth/logout", { method: "POST", cookie: logoutCookie }))
      .status,
    204,
  );
  assert.equal(
    (await request("/auth/me", { cookie: firstCookie })).status,
    200,
  );
  for (const route of ["/internship-periods", "/companies", "/dashboard"]) {
    assert.equal((await request(route, { cookie: firstCookie })).status, 403);
  }
  assert.equal(
    (
      await request("/internship-applications", {
        method: "POST",
        cookie: firstCookie,
        body: {},
      })
    ).status,
    403,
  );

  const newPassword = `Changed-${randomUUID()}`;
  const change = (body, origin = "http://localhost:3000") =>
    request("/auth/change-password", {
      method: "POST",
      cookie: firstCookie,
      body,
      origin,
    });
  for (const body of [
    { password: newPassword },
    { currentPassword: "incorrect", password: newPassword },
    {
      currentPassword: issued.temporaryPassword,
      password: issued.temporaryPassword,
    },
    { currentPassword: issued.temporaryPassword, password: "short" },
  ])
    assert.equal((await change(body)).status, 400);
  const valid = {
    currentPassword: issued.temporaryPassword,
    password: newPassword,
  };
  assert.equal((await change(valid, "https://untrusted.example")).status, 403);
  const before = await db.user.findUnique({ where: { email: profile.email } });
  assert.equal(before.mustChangePassword, true);
  assert.equal((await change(valid)).status, 204);
  const current = await db.user.findUnique({ where: { id: before.id } });
  assert.equal(current.mustChangePassword, false);
  assert.notEqual(current.passwordHash, before.passwordHash);
  assert.equal(current.passwordHash.includes(newPassword), false);
  assert.equal(
    (await request("/auth/me", { cookie: secondCookie })).status,
    401,
  );
  const me = await request("/auth/me", { cookie: firstCookie });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).mustChangePassword, false);
  assert.equal(
    (await request("/internship-periods", { cookie: firstCookie })).status,
    200,
  );
  assert.equal((await request("/users", { cookie: firstCookie })).status, 403);
  assert.equal(
    (await login(profile.email, issued.temporaryPassword)).status,
    401,
  );
  assert.equal((await login(profile.email, newPassword)).status, 200);
  assert.equal(
    await db.auditLog.count({
      where: { actorId: current.id, action: "auth.password_change" },
    }),
    1,
  );
});

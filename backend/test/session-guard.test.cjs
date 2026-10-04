require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Reflector } = require("@nestjs/core");
const { SessionGuard } = require("../.test-build/auth/session.guard");
const { AuthController } = require("../.test-build/auth/auth.controller");

function fixture(role, pending = true, handler = () => {}) {
  const request = { headers: { cookie: "interna_session=" + "a".repeat(64) } };
  const context = {
    getHandler: () => handler,
    getClass: () => AuthController,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const guard = new SessionGuard(
    {
      session: {
        findUnique: async () => ({
          id: "session",
          expiresAt: new Date(Date.now() + 60000),
          user: {
            id: "user",
            email: "test@example.com",
            fullName: "Test",
            isActive: true,
            mustChangePassword: pending,
            roles: [{ role }],
          },
        }),
      },
    },
    new Reflector(),
  );
  return { guard, context, request };
}

for (const role of [
  "Admin",
  "FacultyManager",
  "InternshipCoordinator",
  "FacultyMentor",
  "Company",
  "CompanySupervisor",
  "Student",
]) {
  test(`temporary ${role} account cannot bypass password change through API`, async () => {
    const { guard, context } = fixture(role);
    await assert.rejects(
      guard.canActivate(context),
      (error) =>
        error.getStatus() === 403 &&
        error.getResponse().code === "PASSWORD_CHANGE_REQUIRED",
    );
  });
}

for (const action of ["me", "changePassword", "logout"]) {
  test(`pending account can access authenticated ${action}`, async () => {
    const { guard, context, request } = fixture(
      "Student",
      true,
      AuthController.prototype[action],
    );
    assert.equal(await guard.canActivate(context), true);
    assert.equal(request.authUser.mustChangePassword, true);
    assert.equal(request.sessionId, "session");
    request.headers.cookie = "";
    await assert.rejects(
      guard.canActivate(context),
      (error) => error.getStatus() === 401,
    );
  });
}

test("changing password does not bypass role permissions", async () => {
  const handler = () => {};
  Reflect.defineMetadata("permission", "users:create", handler);
  const { guard, context } = fixture("Student", false, handler);
  await assert.rejects(
    guard.canActivate(context),
    (error) => error.getStatus() === 403,
  );
  const admin = fixture("Admin", false, handler);
  assert.equal(await admin.guard.canActivate(admin.context), true);
});

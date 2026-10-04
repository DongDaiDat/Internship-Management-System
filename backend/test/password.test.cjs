const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  hashPassword,
  verifyPassword,
} = require("../.test-build/auth/password");
const { permissionsFor } = require("../.test-build/auth/auth.types");
test("salted scrypt hashes verify passwords without storing plaintext", async () => {
  const password = "Synthetic unit test password 2026";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password + "x", first), false);
});
test("malformed hashes fail closed", async () => {
  for (const hash of [
    "",
    "plain",
    "scrypt-v1$invalid$invalid",
    "scrypt-v2$a$b",
  ])
    assert.equal(await verifyPassword("password", hash), false);
});
test("roles receive only their planned workflow permissions", () => {
  assert.ok(permissionsFor(["Admin"]).includes("users:create"));
  assert.equal(
    permissionsFor(["Admin"]).includes("internships:approve"),
    false,
  );
  assert.ok(
    permissionsFor(["Admin", "FacultyManager"]).includes("internships:approve"),
  );
  assert.deepEqual(permissionsFor(["Student"]), ["internships:student"]);
  assert.deepEqual(permissionsFor(["FacultyMentor"]), ["internships:mentor"]);
  assert.deepEqual(permissionsFor(["CompanySupervisor"]), [
    "internships:company",
  ]);
  assert.deepEqual(permissionsFor(["InternshipCoordinator"]), [
    "periods:write",
    "profiles:write",
    "operations:write",
    "dashboard:read",
  ]);
  assert.equal(permissionsFor(["Admin"]).includes("periods:write"), false);
  assert.deepEqual(permissionsFor(["FacultyManager"]), [
    "internships:approve",
    "dashboard:read",
  ]);
});

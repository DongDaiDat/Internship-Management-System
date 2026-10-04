// Runs only on the isolated restore DB. Login writes session/audit there, never at source.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, "postgres");
assert.equal(process.env.VERIFY_DATABASE_NAME, "internship_restore_test");
url.pathname = "/internship_restore_test";
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = "test";
process.env.APP_ORIGINS = "http://localhost:3200";
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../.test-build/app.module");
const { configureApp } = require("../.test-build/configure-app");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "../.local/qa-sprint4-flow.json"), "utf8"),
);
async function main() {
  assert(fixture.accounts.Student.endsWith("@example.test"));
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    configureApp(app);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const owner = await db.studentProfile.findUniqueOrThrow({
      where: { email: fixture.accounts.Student },
    });
    const internship = await db.internship.findFirstOrThrow({
      where: { studentId: owner.id },
    });
    const file = await db.fileDocument.findFirstOrThrow({
      where: { internshipId: internship.id, kind: "final" },
    });
    assert.equal((await fetch(`${base}/api/files/${file.id}`)).status, 401);
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_ORIGINS,
      },
      body: JSON.stringify({
        email: fixture.accounts.Student,
        password: fixture.password,
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const result = await fetch(`${base}/api/files/${file.id}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(result.status, 200);
    assert.match(result.headers.get("content-type"), /application\/pdf/);
    assert.equal(
      createHash("sha256")
        .update(Buffer.from(await result.arrayBuffer()))
        .digest("hex"),
      file.sha256,
    );
    const other = await db.fileDocument.findFirstOrThrow({
      where: { internshipId: { not: internship.id } },
    });
    assert.equal(
      (
        await fetch(`${base}/api/files/${other.id}`, {
          headers: { Cookie: cookie },
        })
      ).status,
      403,
    );
    console.log(
      "PASS restored API: anonymous 401, owner PDF 200/hash match, unrelated internship 403.",
    );
  } finally {
    await app.close();
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

// Destructive migration commands are deliberately absent: isolated empty DB only.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const mode = process.argv[2] || "clean";
assert(["clean", "upgrade"].includes(mode));
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, "postgres");
assert.equal(process.env.VERIFY_DATABASE_NAME, "internship_restore_test");
url.pathname = "/internship_restore_test";
process.env.DATABASE_URL = url.toString();
const prisma = new PrismaClient();
function migrate(schema) {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      ...(schema ? ["--schema", schema] : []),
    ],
    { stdio: "inherit", env: process.env },
  );
  assert.equal(result.status, 0, "Migration deploy failed");
}
async function main() {
  const before =
    await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  assert.equal(
    before.length,
    0,
    "Requires a NEW empty restore project, never an existing database",
  );
  let historicalPeriod;
  if (mode === "upgrade") {
    const previous = fs.mkdtempSync(
      path.join(os.tmpdir(), "internship-migration-"),
    );
    fs.copyFileSync(
      "prisma/schema.prisma",
      path.join(previous, "schema.prisma"),
    );
    fs.mkdirSync(path.join(previous, "migrations"));
    fs.copyFileSync(
      "prisma/migrations/migration_lock.toml",
      path.join(previous, "migrations/migration_lock.toml"),
    );
    for (const name of fs
      .readdirSync("prisma/migrations")
      .filter((name) => /^202609(09|10|11)/.test(name))) {
      fs.cpSync(
        path.join("prisma/migrations", name),
        path.join(previous, "migrations", name),
        { recursive: true },
      );
    }
    migrate(path.join(previous, "schema.prisma"));
    await prisma.$executeRaw`INSERT INTO "InternshipPeriod" ("id", "name", "registrationStartsAt", "registrationEndsAt", "startsAt", "endsAt", "weeklyReportCount", "status", "updatedAt") VALUES ('00000000-0000-4000-8000-000000000005'::uuid, 'QA historical published period', '2025-01-01', '2025-01-07', '2025-01-08', '2025-02-19', 6, 'Published', '2025-01-01')`;
    historicalPeriod = (
      await prisma.$queryRaw`SELECT row_to_json(t) AS row FROM "InternshipPeriod" t`
    )[0].row;
  }
  migrate();
  if (historicalPeriod) {
    const upgraded = (
      await prisma.$queryRaw`SELECT row_to_json(t) AS row FROM "InternshipPeriod" t`
    )[0].row;
    for (const [key, value] of Object.entries(historicalPeriod))
      assert.deepEqual(
        upgraded[key],
        value,
        `Historical field changed: ${key}`,
      );
    assert.deepEqual(upgraded.weeklyDeadlines, []);
    assert.equal(upgraded.gradingDeadline, null);
    assert.equal(upgraded.finalizationDeadline, null);
    assert.equal(upgraded.coordinatorId, null);
  }
  const migrations =
    await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY migration_name`;
  assert(migrations.length > 0);
  assert(migrations.every((row) => row.finished_at && !row.rolled_back_at));
  migrate();
  assert.deepEqual(
    await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY migration_name`,
    migrations,
  );
  assert.equal(
    await prisma.user.count(),
    0,
    "Migrations must not seed user accounts",
  );
  console.log(
    `PASS ${mode} database: ${migrations.length} migrations; repeated deploy unchanged; no accounts seeded.${historicalPeriod ? " Published historical schedule preserved; missing deadlines remain unset." : ""}`,
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

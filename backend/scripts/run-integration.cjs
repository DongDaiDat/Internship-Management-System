const { spawnSync } = require("node:child_process");
const path = require("node:path");
let url = process.env.TEST_DATABASE_URL;
if (!url && process.env.DATABASE_URL) {
  const local = new URL(process.env.DATABASE_URL);
  if (
    local.hostname === "postgres" &&
    local.pathname === "/internship_management"
  ) {
    local.pathname = "/internship_management_test";
    url = local.toString();
  }
}
if (!url || !new URL(url).pathname.endsWith("_test")) {
  console.error(
    "Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test.",
  );
  process.exit(1);
}
const environment = {
  ...process.env,
  DATABASE_URL: url,
  NODE_ENV: "test",
  APP_ORIGINS: "http://localhost:3000",
};
for (const args of [
  [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
  [
    "--test",
    path.join(__dirname, "../test/auth.integration.test.cjs"),
    path.join(__dirname, "../test/internships.integration.test.cjs"),
  ],
]) {
  const result = spawnSync(process.execPath, args, {
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

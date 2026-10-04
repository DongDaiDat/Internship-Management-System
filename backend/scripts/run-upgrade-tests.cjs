const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("node:child_process");
async function main() {
  const original = process.env.DATABASE_URL;
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe('CREATE DATABASE "internship_upgrade_test"');
  } catch (e) {
    if (!String(e.message).includes("already exists")) throw e;
  } finally {
    await db.$disconnect();
  }
  const url = new URL(original);
  url.pathname = "/internship_upgrade_test";
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    NODE_ENV: "test",
    APP_ORIGINS: "http://localhost:3000",
  };
  for (const args of [
    [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
    ["--test", "test/upgrade.integration.test.cjs"],
  ]) {
    const child = spawnSync(process.execPath, args, { env, stdio: "inherit" });
    if (child.status) process.exit(child.status);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

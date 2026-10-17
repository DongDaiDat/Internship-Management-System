// Run from the host with Docker Desktop and Chrome installed.
// Additive QA fixtures only; never resets databases or application volumes.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
function run(command, args, environment = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...environment },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const compose = ["compose", "-f", "docker-compose.e2e.yml"];
const built = process.env.QA_BUILT === "true";
// Existing named module volumes do not refresh when an image is rebuilt.
run("docker", [...compose, "stop", "backend", "frontend"]);
run("docker", [...compose, "build"]);
run("docker", [
  ...compose,
  "run",
  "--rm",
  "--no-deps",
  "backend",
  "sh",
  "-c",
  "npm ci && npx prisma generate && npm run build:test",
]);
run("docker", [
  ...compose,
  "run",
  "--rm",
  "--no-deps",
  "frontend",
  "npm",
  "ci",
]);
function fixture(script, extra = []) {
  run("docker", [
    ...compose,
    "run",
    "--rm",
    "--no-deps",
    ...extra,
    "-e",
    `QA_BASELINE_NAME=${built ? "qa-sprint5-built" : "qa-sprint4"}`,
    "backend",
    "node",
    script,
  ]);
}
if (built) {
  run("docker", [...compose, "up", "-d", "--wait", "postgres", "minio"]);
  run("docker", [
    ...compose,
    "run",
    "--rm",
    "--no-deps",
    "-e",
    "QA_SEED_ONLY=true",
    "-e",
    "QA_FIXTURE_NAME=qa-sprint5-built",
    "backend",
    "sh",
    "-c",
    "npx prisma generate && npm run build:test && node scripts/serve-qa.cjs",
  ]);
}
run("docker", [
  ...compose,
  ...(built ? ["-f", "docker-compose.e2e-built.yml"] : []),
  "up",
  "-d",
  "--build",
  "--wait",
]);
fixture("scripts/serve-qa.cjs", [
  "-e",
  "QA_SEED_ONLY=true",
  "-e",
  "QA_FRESH=true",
  "-e",
  `QA_FIXTURE_NAME=${built ? "qa-sprint5-built" : "qa-sprint4"}`,
]);
fixture("scripts/prepare-sprint4-import.cjs");
run(process.execPath, ["frontend/tests/current-workflow.cjs"]);
run(process.execPath, ["frontend/tests/summary-browser.cjs"]);
run(process.execPath, ["frontend/tests/notifications-browser.cjs"]);
run(process.execPath, ["frontend/tests/upgrade-account-browser.cjs"], {
  UPGRADE_BASE_URL: "http://localhost:3200",
  UPGRADE_FIXTURE: path.join(
    root,
    `backend/.local/${built ? "qa-sprint5-built" : "qa-sprint4"}.json`,
  ),
});
console.log(
  `PASS ${built ? "built release" : "development"} seven-actor browser suite. QA data retained; stop with docker compose -f docker-compose.e2e.yml stop.`,
);

// Smoke only: explicit local release stack, credentials stay in process memory.
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");
const { mkdirSync } = require("node:fs");
const root = path.resolve(__dirname, "../..");
const credentialText = execFileSync(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.release.yml",
    "exec",
    "-T",
    "backend",
    "node",
    "-e",
    "process.stdout.write(require('node:fs').readFileSync('/app/.local/demo-accounts.txt','utf8'))",
  ],
  { cwd: root, encoding: "utf8" },
);
const accounts = [
  ...credentialText.matchAll(/Email: ([^\r\n]+)\r?\nMật khẩu: ([^\r\n]+)/g),
];
assert.equal(accounts.length, 2, "Run explicit local seed first");
assert(
  accounts.every((row) =>
    ["admin@interna.local", "student@interna.local"].includes(row[1]),
  ),
);
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [, email, password] of accounts) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 500)
          errors.push(
            `HTTP ${response.status()}: ${new URL(response.url()).pathname}`,
          );
      });
      await page.goto("http://localhost:3300");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "Đăng nhập", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Đăng xuất", exact: true })
        .waitFor();
      const me = await context.request.get("http://localhost:3300/api/auth/me");
      assert.equal(me.status(), 200);
      assert.equal((await me.json()).email, email);
      assert.equal(
        (
          await context.request.get("http://localhost:3300/api/dashboard")
        ).status(),
        email.startsWith("admin") ? 200 : 403,
      );
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        mkdirSync(path.join(root, "frontend/.local/sprint5"), {
          recursive: true,
        });
        await page.screenshot({
          path: path.join(
            root,
            `frontend/.local/sprint5/${email.split("@")[0]}-${width}.png`,
          ),
        });
      }
      await page
        .getByRole("button", { name: "Đăng xuất", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Đăng nhập", exact: true })
        .waitFor();
      assert.equal(
        (
          await context.request.get("http://localhost:3300/api/auth/me")
        ).status(),
        401,
      );
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(
      "PASS release smoke: Admin/Student login, role scope, logout, 390/768/1440; no page errors or HTTP 5xx.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

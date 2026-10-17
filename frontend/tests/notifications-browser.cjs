const { chromium } = require("playwright");
const { readFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const base = "http://localhost:3200";
const fixture = JSON.parse(
  readFileSync(
    join(
      __dirname,
      `../../backend/.local/${process.env.QA_BUILT === "true" ? "qa-sprint5-built" : "qa-sprint4"}.json`,
    ),
    "utf8",
  ),
);
const roles = {
  Admin: "admin",
  InternshipCoordinator: "coordinator",
  FacultyManager: "faculty",
  FacultyMentor: "mentor",
  Company: "company",
  CompanySupervisor: "supervisor",
  Student: "student",
};
const output = join(__dirname, "../.local/notifications-review");
mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [role, slug] of Object.entries(roles)) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const login = await context.request.post(base + "/api/auth/login", {
        headers: { Origin: base },
        data: { email: fixture.accounts[role], password: fixture.password },
      });
      assert.equal(login.status(), 200, `${role} login`);
      const page = await context.newPage();
      for (const width of [1440, 1024]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${base}/workspace/${slug}/overview`, {
          waitUntil: "networkidle",
        });
        const bell = page.getByRole("button", { name: /Việc cần làm/ });
        await bell.waitFor();
        await bell.click();
        await page.getByRole("region", { name: "Nhắc việc" }).waitFor();
        assert.deepEqual(
          (await page.locator('[role="alert"]').allTextContents()).filter(
            Boolean,
          ),
          [],
          `${role} popover error`,
        );
        await page.keyboard.press("Escape");
        assert.equal(await bell.getAttribute("aria-expanded"), "false");
        await page.goto(`${base}/workspace/${slug}/tasks`, {
          waitUntil: "networkidle",
        });
        await page
          .getByText(
            /việc phù hợp|Đang tải công việc|Không có công việc phù hợp/,
          )
          .first()
          .waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `${role}/${width} overflow`,
        );
        await page.screenshot({
          path: join(output, `${slug}-${width}.png`),
          fullPage: true,
        });
      }
      await context.close();
      console.log(`PASS ${role}: notification bell, keyboard and task page`);
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

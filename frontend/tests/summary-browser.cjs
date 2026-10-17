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
assert.ok(
  Object.values(fixture.accounts).every((e) => e.endsWith("@example.test")),
);
const output = join(__dirname, "../.local/summary-review");
mkdirSync(output, { recursive: true });
const slugs = {
  Admin: "admin",
  InternshipCoordinator: "coordinator",
  FacultyManager: "faculty",
  FacultyMentor: "mentor",
  Company: "company",
  CompanySupervisor: "supervisor",
  Student: "student",
};
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  try {
    for (const [role, slug] of Object.entries(slugs)) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const response = await context.request.post(base + "/api/auth/login", {
        headers: { Origin: base },
        data: { email: fixture.accounts[role], password: fixture.password },
      });
      assert.equal(response.status(), 200, role + " login");
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      const views =
        role === "Admin"
          ? ["overview"]
          : role === "Student"
            ? ["history"]
            : [
                "overview",
                "summary",
                ...(["FacultyMentor", "Company", "CompanySupervisor"].includes(
                  role,
                )
                  ? ["history"]
                  : []),
              ];
      for (const width of [1440, 1024])
        for (const view of views) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(`${base}/workspace/${slug}/${view}`, {
            waitUntil: "networkidle",
          });
          await page.locator(".workspace-heading h1").waitFor();
          const studentHistory = role === "Student" && view === "history";
          await page
            .locator(
              studentHistory
                ? 'nav[aria-label="Phân trang lịch sử thực tập"]'
                : view === "overview"
                  ? ".summary-metrics"
                  : 'nav[aria-label="Phân trang"]',
            )
            .waitFor();
          assert.deepEqual(
            (await page.locator('[role="alert"]').allTextContents()).filter(
              (t) => t.trim(),
            ),
            [],
            `${role}/${view}`,
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
            `${role}/${view} ${width} overflow`,
          );
          if (studentHistory) {
            assert.equal(await page.locator(".summary-search").count(), 0);
            assert.equal(
              await page.getByText("Các lần đăng ký thực tập").count(),
              0,
            );
            assert.equal(await page.getByText("Tìm sinh viên").count(), 0);
          } else if (view !== "overview") {
            assert.equal(
              await page
                .locator(".summary-search .button.primary")
                .evaluate(
                  (element) => getComputedStyle(element).backgroundColor,
                ),
              "rgb(18, 59, 112)",
              `${role}/${view}: primary button color`,
            );
            const canExport = [
              "FacultyManager",
              "InternshipCoordinator",
            ].includes(role);
            assert.equal(
              await page
                .getByRole("button", { name: "Xuất Excel theo bộ lọc" })
                .count(),
              canExport ? 1 : 0,
            );
            const period = page.getByLabel("Đợt thực tập", { exact: true });
            await period
              .locator("option")
              .nth(1)
              .waitFor({ state: "attached" });
            assert.ok(
              (await period.locator("option").count()) > 1,
              `${role}/${view}: populated period filter`,
            );
            if ((await period.locator("option").count()) > 1) {
              const value =
                view === "history" &&
                (await period
                  .locator(`option[value="${fixture.periodId}"]`)
                  .count())
                  ? fixture.periodId
                  : await period.locator("option").nth(1).getAttribute("value");
              const filteredResponse = page.waitForResponse(
                (response) =>
                  response.url().includes("/api/reports/internships?") &&
                  response.url().includes(value),
              );
              await period.selectOption(value);
              assert.equal((await filteredResponse).status(), 200);
              await page.waitForLoadState("networkidle");
              await page.reload({ waitUntil: "networkidle" });
              await page.locator('nav[aria-label="Phân trang"]').waitFor();
              assert.equal(
                await page
                  .getByLabel("Đợt thực tập", { exact: true })
                  .inputValue(),
                value,
              );
            }
            if (
              await page
                .getByRole("button", { name: "Lịch sử & đánh giá" })
                .count()
            ) {
              const historyResponse = page.waitForResponse((response) =>
                /\/api\/reports\/internships\/[^/]+\/history/.test(
                  response.url(),
                ),
              );
              await page
                .getByRole("button", { name: "Lịch sử & đánh giá" })
                .first()
                .click();
              assert.equal((await historyResponse).status(), 200);
              await page.waitForFunction(() => {
                const e = document.querySelector(".summary-history");
                return e && !e.textContent.includes("Đang tải");
              });
              assert.equal(
                await page.locator('.summary-history [role="alert"]').count(),
                0,
              );
            }
          }
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            document.querySelectorAll(".summary-table-scroll").forEach((e) => {
              e.scrollLeft = 0;
            });
          });
          await page.screenshot({
            path: join(output, `${slug}-${view}-${width}-final.png`),
            fullPage: true,
          });
        }
      if (role === "Student") {
        await page.goto(`${base}/workspace/student/summary`, {
          waitUntil: "networkidle",
        });
        await page.locator(".workspace-heading h1").waitFor();
        assert.equal(
          new URL(page.url()).pathname,
          "/workspace/student/overview",
        );
        assert.equal(
          await page.getByRole("link", { name: "Tổng hợp thực tập" }).count(),
          0,
        );
      }
      await context.close();
      console.log(
        `PASS ${role}: desktop routes, filters, permissions and screenshots`,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

// Read-only seven-actor UI baseline against the dedicated Sprint 4 stack.
const { chromium } = require("playwright");
const { readFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const fixture = JSON.parse(
  readFileSync(
    path.join(
      root,
      `backend/.local/${process.env.QA_BUILT === "true" ? "qa-sprint5-built" : "qa-sprint4"}.json`,
    ),
    "utf8",
  ),
);
const output = path.join(root, "frontend/.local/sprint4");
const roles = [
  "Admin",
  "FacultyManager",
  "InternshipCoordinator",
  "FacultyMentor",
  "Company",
  "CompanySupervisor",
  "Student",
];
assert.ok(
  roles.every((role) => fixture.accounts[role]?.endsWith("@example.test")),
);
mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const role of roles) {
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
      await page.goto("http://localhost:3200");
      await page
        .getByLabel("Email", { exact: true })
        .fill(fixture.accounts[role]);
      await page.getByLabel("Mật khẩu", { exact: true }).fill(fixture.password);
      await page
        .getByRole("button", { name: "Đăng nhập", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Đăng xuất", exact: true })
        .waitFor();
      await page.waitForFunction(
        () => !document.body.innerText.includes("Đang tải dữ liệu…"),
      );
      const me = await context.request.get("http://localhost:3200/api/auth/me");
      assert.equal(me.status(), 200);
      assert.deepEqual((await me.json()).roles, [role]);
      if (["Admin", "FacultyManager", "InternshipCoordinator"].includes(role)) {
        await page
          .getByRole("region", { name: "Tổng quan thực tập", exact: true })
          .waitFor();
      } else if (["Company", "CompanySupervisor"].includes(role)) {
        await page
          .getByRole("region", { name: "Không gian doanh nghiệp" })
          .getByRole("heading", { name: /^Doanh nghiệp QA/ })
          .waitFor();
      } else {
        await page
          .getByRole("heading", { name: "Sinh viên kiểm thử", exact: true })
          .first()
          .waitFor();
      }
      const dashboard = await context.request.get(
        "http://localhost:3200/api/dashboard",
      );
      assert.equal(
        dashboard.status(),
        ["Admin", "FacultyManager", "InternshipCoordinator"].includes(role)
          ? 200
          : 403,
      );
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${role}: overflow ${width}`,
        );
        await page.screenshot({
          path: path.join(output, `${role}-${width}.png`),
        });
      }
      const unnamed = await page
        .locator('input:not([type="hidden"]), select, textarea')
        .evaluateAll((elements) =>
          elements
            .filter(
              (element) =>
                element.getClientRects().length &&
                !element.getAttribute("aria-label") &&
                !element.getAttribute("aria-labelledby") &&
                !Array.from(element.labels || []).some((label) =>
                  label.textContent.trim(),
                ),
            )
            .map((element) => element.tagName),
        );
      assert.deepEqual(
        unnamed,
        [],
        `${role}: visible controls need accessible names`,
      );
      await page
        .getByRole("button", { name: "Đăng xuất", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Đăng nhập", exact: true })
        .waitFor();
      assert.equal(
        (
          await context.request.get("http://localhost:3200/api/auth/me")
        ).status(),
        401,
      );
      assert.deepEqual(errors, [], role);
      await context.close();
      console.log(
        `PASS ${role}: login, identity, dashboard permission, responsive layout, logout`,
      );
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

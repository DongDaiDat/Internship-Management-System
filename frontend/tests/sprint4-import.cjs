const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
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
const imported = JSON.parse(
  readFileSync(path.join(root, "backend/.local/sprint4-import.json"), "utf8"),
);
assert.ok(imported.email.endsWith("@example.test"));
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("http://localhost:3200");
    await page
      .getByLabel("Email", { exact: true })
      .fill(fixture.accounts.InternshipCoordinator);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(fixture.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const panel = page.locator("section.card.editor").filter({
      has: page.getByRole("heading", {
        name: "Import hồ sơ Excel",
        exact: true,
      }),
    });
    const profiles = page.locator("section.profile-panel");
    await panel.getByLabel("File .xlsx", { exact: true }).waitFor();
    const manual = profiles
      .locator("details")
      .filter({ has: page.getByText("Thêm hồ sơ thủ công", { exact: true }) });
    await manual.locator("summary").click();
    await manual
      .getByRole("button", { name: "Lưu hồ sơ", exact: true })
      .click();
    assert.equal(
      await manual.locator('[name="studentCode"]').getAttribute("aria-invalid"),
      "true",
    );
    assert.ok(
      await manual
        .locator('[name="studentCode"]')
        .evaluate((element) => element === document.activeElement),
    );
    for (const [key, value] of Object.entries({
      studentCode: "VALIDATION-QA",
      fullName: "Kiểm thử lỗi biểu mẫu",
      email: "validation@example.test",
      className: "CNTT",
      cohort: "2026",
      programCredits: "150",
      completedCredits: "999",
    }))
      await manual.locator(`[name="${key}"]`).fill(value);
    await manual
      .getByRole("button", { name: "Lưu hồ sơ", exact: true })
      .click();
    await manual
      .getByText("Không được vượt tổng tín chỉ chương trình.", { exact: true })
      .waitFor();
    assert.ok(
      await manual
        .locator('[name="completedCredits"]')
        .evaluate((element) => element === document.activeElement),
    );
    await manual.locator("summary").click();
    async function preview(kind) {
      await panel
        .getByLabel("File .xlsx", { exact: true })
        .setInputFiles(
          path.join(root, `backend/.local/sprint4-import-${kind}.xlsx`),
        );
      const waiting = page.waitForResponse(
        (r) =>
          r.url().includes("/api/imports/preview") &&
          r.request().method() === "POST",
      );
      await panel
        .getByRole("button", { name: "Kiểm tra file", exact: true })
        .click();
      return waiting;
    }
    const missing = await preview("missing-column");
    assert.equal(missing.status(), 400);
    assert.equal(
      await panel
        .getByRole("button", { name: "Xác nhận import", exact: true })
        .count(),
      0,
    );
    const invalid = await preview("invalid");
    assert.equal(invalid.status(), 201);
    await panel.getByText(/Dòng 3:/).waitFor();
    await panel.getByText(/Dòng 4:/).waitFor();
    assert.equal(
      await panel
        .getByRole("button", { name: "Xác nhận import", exact: true })
        .count(),
      0,
    );
    await profiles
      .getByLabel("Tìm hồ sơ", { exact: true })
      .fill(imported.studentCode);
    assert.equal(
      await profiles
        .getByRole("button", { name: "Cấp tài khoản", exact: true })
        .count(),
      0,
    );
    await preview("valid");
    await panel.getByText("1/1 dòng hợp lệ", { exact: true }).waitFor();
    const confirmation = page.waitForResponse((r) =>
      /\/api\/imports\/[^/]+\/confirm$/.test(r.url()),
    );
    await panel
      .getByRole("button", { name: "Xác nhận import", exact: true })
      .click();
    assert.ok((await confirmation).ok());
    // The profile catalogue must refresh after import without a page reload.
    await profiles
      .getByLabel("Tìm hồ sơ", { exact: true })
      .fill(imported.studentCode);
    const provision = profiles.getByRole("button", {
      name: "Cấp tài khoản",
      exact: true,
    });
    await provision.waitFor();
    await provision.click();
    await profiles
      .getByRole("button", { name: "Đã ghi nhận", exact: true })
      .waitFor();
    const temporaryPassword = await profiles
      .locator(".notice code")
      .textContent();
    assert.ok(temporaryPassword && temporaryPassword.length >= 12);
    await profiles
      .getByRole("button", { name: "Đã ghi nhận", exact: true })
      .click();
    assert.equal(await profiles.locator(".notice code").count(), 0);
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(imported.email);
    await page.getByLabel("Email", { exact: true }).press("Tab");
    assert.equal(
      await page
        .getByLabel("Mật khẩu", { exact: true })
        .evaluate((element) => document.activeElement === element),
      true,
    );
    await page.getByLabel("Mật khẩu", { exact: true }).fill(temporaryPassword);
    await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");
    await page
      .getByRole("heading", { name: "Đổi mật khẩu tạm", exact: true })
      .waitFor();
    const password = randomUUID() + randomUUID();
    await page
      .getByLabel("Mật khẩu tạm được cấp", { exact: true })
      .fill(temporaryPassword);
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill(password);
    await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Lưu mật khẩu mới", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Nguyễn Thị Ánh Dương Kiểm Thử Tên Dài",
        exact: true,
      })
      .waitFor();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS import UI: missing column, multi-row errors, explicit confirmation, provisioning, one-time password, keyboard login/change, long Vietnamese name layout",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

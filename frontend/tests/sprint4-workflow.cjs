const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const fixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../backend/.local/qa-sprint4-flow.json"),
    "utf8",
  ),
);
assert.ok(fixture.registration.email.endsWith("@example.test"));
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function login(email, password) {
    await page.context().clearCookies();
    await page.goto("http://localhost:3200");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    assert.equal((await response).status(), 200, "Workflow login");
    await page
      .getByRole("button", { name: "Đăng xuất", exact: true })
      .waitFor();
  }
  async function confirm() {
    await page
      .getByRole("region", { name: "Xác nhận thao tác", exact: true })
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
  }
  try {
    await login(fixture.registration.email, fixture.password);
    await page
      .getByLabel("Đợt thực tập", { exact: true })
      .selectOption(fixture.openPeriod.id);
    await page
      .getByLabel("Doanh nghiệp", { exact: true })
      .selectOption(fixture.companyId);
    await page
      .getByLabel("Vị trí thực tập", { exact: true })
      .fill("Lập trình viên kiểm thử E2E");
    await page
      .getByRole("button", { name: "Gửi đăng ký", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Hủy đăng ký", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Xác nhận hủy", exact: true })
      .click();
    await page.getByText("Đã hủy đăng ký.", { exact: true }).waitFor();
    await login(fixture.exception.email, fixture.password);
    await page.getByText("Gửi yêu cầu ngoại lệ", { exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Hủy đăng ký", exact: true })
        .count(),
      0,
    );
    const cancellation = await page
      .context()
      .request.post(
        `http://localhost:3200/api/internship-applications/${fixture.applicationId}/cancel`,
        { data: {}, headers: { Origin: "http://localhost:3200" } },
      );
    assert.equal(cancellation.status(), 400);
    await page
      .getByLabel("Lý do", { exact: true })
      .fill("Đề nghị xét ngoại lệ hồ sơ synthetic cho kịch bản kiểm thử.");
    await page
      .getByRole("button", { name: "Gửi yêu cầu", exact: true })
      .click();
    await page
      .getByText("Đã gửi yêu cầu ngoại lệ đến Trưởng khoa.", { exact: true })
      .waitFor();
    await login(fixture.accounts.FacultyManager, fixture.staffPassword);
    await page
      .getByLabel("Lọc báo cáo theo đợt")
      .selectOption(fixture.periodId);
    const application = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: `${fixture.exception.name} · ${fixture.exception.name.replace(" ", "-")}`,
        exact: true,
      }),
    });
    await application
      .locator("summary")
      .filter({ hasText: "Yêu cầu ngoại lệ" })
      .click();
    await application
      .getByLabel("Lý do", { exact: true })
      .fill("Chấp nhận ngoại lệ theo kịch bản E2E.");
    await application
      .getByRole("button", { name: "Xem lại quyết định", exact: true })
      .last()
      .click();
    await confirm();
    await application
      .getByLabel("Giảng viên hướng dẫn", { exact: true })
      .selectOption(fixture.mentorId);
    await application
      .getByRole("button", { name: "Xem lại và duyệt", exact: true })
      .click();
    await confirm();
    await page
      .getByText("Không có hồ sơ chờ duyệt.", { exact: true })
      .waitFor();
    const internshipCard = page
      .locator("article")
      .filter({ has: page.getByText(fixture.periodName, { exact: true }) });
    const changeCompany = internshipCard.locator("details").filter({
      has: page.getByText("Đổi doanh nghiệp thực tập", { exact: true }),
    });
    await changeCompany.locator("summary").click();
    for (const companyId of [fixture.alternativeCompanyId, fixture.companyId]) {
      await changeCompany
        .locator('select[name="companyId"]')
        .selectOption(companyId);
      await changeCompany
        .getByLabel("Lý do thay đổi", { exact: true })
        .fill("Kiểm thử đổi doanh nghiệp trong bảy ngày đầu.");
      await changeCompany
        .getByRole("button", { name: "Xem lại yêu cầu", exact: true })
        .click();
      const changed = page.waitForResponse(
        (r) => r.url().endsWith("/company") && r.request().method() === "POST",
      );
      await confirm();
      assert.ok((await changed).ok());
      await page
        .getByRole("region", { name: "Xác nhận thao tác", exact: true })
        .waitFor({ state: "detached" });
    }
    await login(fixture.accounts.Company, fixture.staffPassword);
    const companyCard = page
      .locator("section.card.editor")
      .filter({ has: page.getByText(fixture.periodName, { exact: true }) });
    await companyCard
      .getByLabel("Phân công thêm người hướng dẫn")
      .selectOption(fixture.supervisorId);
    await companyCard
      .getByRole("button", { name: "Phân công", exact: true })
      .click();
    await companyCard
      .getByText("QA CompanySupervisor", { exact: false })
      .waitFor();
    await login(fixture.accounts.CompanySupervisor, fixture.staffPassword);
    const scoreCard = page
      .locator("section.card.editor")
      .filter({ has: page.getByText(fixture.periodName, { exact: true }) });
    await scoreCard.getByText("Chấm điểm sinh viên", { exact: true }).click();
    for (const label of [
      "Kỷ luật (0–2)",
      "Trách nhiệm (0–2)",
      "Vận dụng chuyên môn (0–2)",
      "Kết quả công việc (0–4)",
    ])
      await scoreCard.getByLabel(label, { exact: true }).fill("2");
    await scoreCard
      .getByRole("button", { name: "Lưu phiếu đánh giá", exact: true })
      .click();
    await scoreCard
      .getByText("Điểm bạn đã chấm: 8/10", { exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS workflow: registration/cancel, closed deadline, exception request/decision, approval/mentor, company assignment and supervisor score",
    );
  } catch (error) {
    await page.screenshot({
      path: path.resolve(__dirname, "../.local/sprint4/workflow-failure.png"),
    });
    console.error(
      "Visible alerts:",
      await page.getByRole("alert").allTextContents(),
    );
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

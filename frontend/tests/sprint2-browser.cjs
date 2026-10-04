// Run against the isolated serve-qa.cjs fixture only. Never use real accounts.
const { chromium } = require("playwright");
const { readFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const fixtureName = process.env.QA_FIXTURE_NAME || "qa-sprint2-clean";
assert.match(fixtureName, /^qa-[a-z0-9-]+$/);
const fixture = JSON.parse(
  readFileSync(path.join(root, `backend/.local/${fixtureName}.json`), "utf8"),
);
assert.ok(
  Object.values(fixture.accounts).every((email) =>
    email.endsWith("@example.test"),
  ),
);
const output = path.join(
  root,
  fixture.staffPassword
    ? "frontend/.local/sprint4/files"
    : "frontend/.local/sprint2",
);
mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  async function login(role) {
    await page.context().clearCookies();
    await page.goto("http://localhost:3200");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(fixture.accounts[role]);
    await page
      .getByRole("textbox", { name: "Mật khẩu", exact: true })
      .fill(
        fixture.staffPassword && !["Student", "FacultyMentor"].includes(role)
          ? fixture.staffPassword
          : fixture.password,
      );
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page
      .getByRole("button", { name: "Đăng xuất", exact: true })
      .waitFor();
  }
  async function layout(name, section) {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await section.scrollIntoViewIfNeeded();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name}: horizontal overflow at ${width}`,
      );
      await page.screenshot({
        path: path.join(output, `${name}-${width}.png`),
      });
    }
  }
  try {
    await login("Student");
    await page.getByText("Tuần 1 · Chưa nộp", { exact: true }).click();
    await page
      .getByRole("textbox", {
        name: "Nội dung công việc và kết quả",
        exact: true,
      })
      .fill(
        "Báo cáo kiểm thử Sprint 2: triển khai chức năng, kiểm tra quyền truy cập và tệp riêng tư.",
      );
    await page
      .getByRole("button", { name: "Nộp báo cáo", exact: true })
      .click();
    await page.getByText("Tuần 1 · Chờ xét duyệt", { exact: true }).waitFor();
    await page.getByText("Nộp báo cáo cuối kỳ", { exact: true }).click();
    await page
      .getByRole("textbox", { name: "Nội dung báo cáo cuối", exact: true })
      .fill("Báo cáo cuối kỳ tổng hợp quá trình thực tập. ".repeat(5));
    await page
      .getByRole("button", { name: "Nộp báo cáo cuối", exact: true })
      .click();
    await page.getByText("Xem báo cáo cuối đã nộp", { exact: true }).waitFor();
    await page
      .locator("summary")
      .filter({ hasText: "Tệp báo cáo và minh chứng" })
      .click();
    const pdf = path.join(root, "backend/.local/qa-report.pdf");
    for (const label of ["Báo cáo tuần 1", "Báo cáo cuối"]) {
      await page.getByLabel("Báo cáo cần đính kèm").selectOption({ label });
      await page.getByLabel("Tệp PDF", { exact: true }).setInputFiles(pdf);
      await page
        .getByRole("button", { name: "Lưu tệp PDF", exact: true })
        .click();
      await page
        .getByRole("link", {
          name:
            label === "Báo cáo cuối"
              ? "Báo cáo cuối: qa-report.pdf"
              : "Tuần 1: qa-report.pdf",
          exact: true,
        })
        .waitFor();
    }
    await layout("student-files", page.getByLabel("Báo cáo cần đính kèm"));
    if (fixture.staffPassword) {
      await login("FacultyMentor");
      await page
        .locator("summary")
        .filter({ hasText: /^Tuần 1 / })
        .click();
      await page
        .getByLabel("Nhận xét", { exact: true })
        .fill("Báo cáo đủ nội dung; kiểm thử nhận xét và mở khóa đầu kỳ.");
      await page
        .getByRole("button", { name: "Lưu nhận xét", exact: true })
        .click();
      await page.getByText(/Nhận xét đã lưu:/).waitFor();
      await login("FacultyManager");
      await page
        .getByLabel("Lọc báo cáo theo đợt")
        .selectOption({ label: fixture.periodName });
      const entry = page
        .locator("article")
        .filter({ has: page.getByText(fixture.periodName, { exact: true }) });
      await entry.getByText("Mở khóa báo cáo tuần 1", { exact: true }).click();
      await entry
        .getByLabel("Lý do mở khóa", { exact: true })
        .fill("Cho phép bổ sung báo cáo trong cửa sổ đầu kỳ E2E.");
      const unlock = entry.locator("details").filter({
        has: page.getByText("Mở khóa báo cáo tuần 1", { exact: true }),
      });
      await unlock
        .getByRole("button", { name: "Xem lại yêu cầu", exact: true })
        .click();
      await page
        .getByRole("region", { name: "Xác nhận thao tác" })
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await entry
        .getByText("Mở khóa báo cáo tuần 1", { exact: true })
        .waitFor({ state: "detached" });
      const change = entry.locator("details").filter({
        has: page.getByText("Đổi giảng viên hướng dẫn", { exact: true }),
      });
      await change.locator("summary").click();
      const select = change.locator('select[name="facultyMentorId"]');
      const otherId = await select
        .locator("option")
        .evaluateAll(
          (options, current) =>
            options.map((o) => o.value).find((id) => id && id !== current),
          fixture.mentorId,
        );
      assert.ok(otherId);
      for (const id of [otherId, fixture.mentorId]) {
        await select.selectOption(id);
        await change
          .getByLabel("Lý do thay đổi", { exact: true })
          .fill("Kiểm thử bàn giao giảng viên trong bảy ngày đầu.");
        await change
          .getByRole("button", { name: "Xem lại yêu cầu", exact: true })
          .click();
        const completion = page.waitForResponse(
          (r) =>
            r.url().endsWith("/faculty-mentor") &&
            r.request().method() === "POST",
        );
        await page
          .getByRole("region", { name: "Xác nhận thao tác" })
          .getByRole("button", { name: "Xác nhận", exact: true })
          .click();
        assert.ok((await completion).ok());
        await page
          .getByRole("region", { name: "Xác nhận thao tác" })
          .waitFor({ state: "detached" });
      }
    }
    await login("FacultyMentor");
    await page
      .getByText("Điểm giảng viên · Chưa chấm", { exact: true })
      .click();
    await page.getByRole("spinbutton", { name: "Điểm (0–10)" }).fill("9");
    await page
      .getByRole("button", { name: "Lưu điểm giảng viên", exact: true })
      .click();
    await page.getByText("Điểm giảng viên · 9/10", { exact: true }).waitFor();
    await login("FacultyManager");
    if (fixture.staffPassword)
      await page
        .getByLabel("Lọc báo cáo theo đợt")
        .selectOption({ label: fixture.periodName });
    const card = page
      .locator("article")
      .filter({ has: page.getByText(fixture.periodName, { exact: true }) });
    await card.waitFor();
    await card
      .locator("summary")
      .filter({ hasText: "Tệp báo cáo và minh chứng" })
      .click();
    for (const label of [
      "Kỷ luật (0–2)",
      "Trách nhiệm (0–2)",
      "Vận dụng chuyên môn (0–2)",
      "Kết quả công việc (0–4)",
    ])
      await card.getByLabel(label, { exact: true }).fill("2");
    await card
      .getByLabel("Lý do nhập thay", { exact: true })
      .fill(
        "Phiếu tổng hợp kiểm thử, doanh nghiệp bàn giao trực tiếp cho khoa.",
      );
    await card.getByLabel("PDF minh chứng", { exact: true }).setInputFiles(pdf);
    await layout(
      "proxy-score",
      card.getByLabel("Lý do nhập thay", { exact: true }),
    );
    await card
      .getByRole("button", {
        name: "Xác nhận lưu phiếu có minh chứng",
        exact: true,
      })
      .click();
    await card
      .getByText("Đã lưu phiếu chấm thay có minh chứng.", { exact: true })
      .waitFor();
    await card.getByRole("button", { name: "Chốt điểm", exact: true }).click();
    await page
      .getByRole("region", { name: "Xác nhận thao tác" })
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await card.getByText(/Đã chốt: 8.5\/10/).waitFor();
    assert.equal(await card.locator('input[type="file"]').count(), 0);
    assert.equal(
      await card
        .getByRole("button", { name: "Chốt điểm", exact: true })
        .count(),
      0,
    );
    await login("Student");
    await page.getByText(/Kết quả: 8.5\/10/).waitFor();
    await page
      .locator("summary")
      .filter({ hasText: "Tệp báo cáo và minh chứng" })
      .click();
    assert.equal(await page.locator('input[type="file"]').count(), 0);
    assert.equal(
      await page
        .getByRole("button", {
          name: /Nộp báo cáo|Cập nhật báo cáo|Lưu tệp PDF/,
        })
        .count(),
      0,
    );
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Báo cáo cuối: qa-report.pdf", exact: true })
      .click();
    const download = await downloading;
    assert.equal(await download.failure(), null);
    await download.saveAs(path.join(output, "downloaded-report.pdf"));
    assert.deepEqual(
      readFileSync(path.join(output, "downloaded-report.pdf")),
      readFileSync(pdf),
    );
    await layout("locked-student", page.getByText(/Kết quả: 8.5\/10/));
    console.log(
      "PASS: weekly/final PDF, faculty 9, proxy 8 with evidence, lock 8.5, no editing after lock, byte-exact download, 390/768/1440 layouts.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

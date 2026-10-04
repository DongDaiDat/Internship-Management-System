// Read-only Sprint 3 smoke check using the isolated Sprint 2 QA fixture.
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
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    const fileRequests = [];
    page.on("request", (request) => {
      if (/\/internships\/[^/]+\/files(?:\?|$)/.test(request.url()))
        fileRequests.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:3200");
    await page
      .getByLabel("Email", { exact: true })
      .fill(fixture.accounts.InternshipCoordinator);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(fixture.staffPassword || fixture.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page
      .getByLabel("Lọc báo cáo theo đợt")
      .selectOption({ label: fixture.periodName });
    const report = page.getByRole("region", { name: "Báo cáo đăng ký" });
    await report.getByText("1 hồ sơ phù hợp", { exact: true }).waitFor();
    await report.getByLabel("Trạng thái đăng ký").selectOption("Rejected");
    await report.getByText("0 hồ sơ phù hợp", { exact: true }).waitFor();
    await report.getByLabel("Trạng thái đăng ký").selectOption("Approved");
    await report.getByText("1 hồ sơ phù hợp", { exact: true }).waitFor();
    await report
      .getByLabel("Tìm theo tên hoặc mã sinh viên")
      .fill("not-found-qa");
    await report.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
    await report
      .getByText("Không có hồ sơ khớp bộ lọc.", { exact: true })
      .waitFor();
    await report.getByLabel("Tìm theo tên hoặc mã sinh viên").fill("");
    await report.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
    await report.getByText("1 hồ sơ phù hợp", { exact: true }).waitFor();
    assert.equal(await report.getByRole("row").count(), 2);
    const folder = path.join(root, "frontend/.local/sprint3");
    mkdirSync(folder, { recursive: true });
    const progress = page.getByRole("region", { name: "Tiến độ và kết quả" });
    await page
      .getByRole("button", { name: "Xem chi tiết: Đã chốt điểm", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Chi tiết chỉ số" })
      .getByText("1 mục phù hợp", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Xem chi tiết: Chờ phê duyệt", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Chi tiết chỉ số" })
      .getByText("0 mục phù hợp", { exact: true })
      .waitFor();
    const readiness = page.getByRole("region", { name: "Điều kiện và quota" });
    await readiness.getByLabel("Nhóm thống kê").selectOption("quota");
    await readiness.getByText("Còn quota", { exact: true }).first().waitFor();
    await progress
      .getByRole("button", {
        name: "Thiếu phiếu doanh nghiệp (0)",
        exact: true,
      })
      .click();
    await progress
      .getByText("0 kỳ thực tập phù hợp", { exact: true })
      .waitFor();
    await progress
      .getByRole("button", { name: "Đạt (1)", exact: true })
      .click();
    await progress
      .getByText("1 kỳ thực tập phù hợp", { exact: true })
      .waitFor();
    await progress
      .getByRole("button", { name: "Không đạt (0)", exact: true })
      .click();
    await progress
      .getByText("0 kỳ thực tập phù hợp", { exact: true })
      .waitFor();
    await progress
      .getByRole("button", { name: "Đạt (1)", exact: true })
      .click();
    await progress
      .getByText("1 kỳ thực tập phù hợp", { exact: true })
      .waitFor();
    await progress.getByText("Lịch sử thay đổi", { exact: true }).click();
    await progress
      .getByText("Nhập điểm thay có minh chứng", { exact: true })
      .waitFor();
    assert.equal(
      fileRequests.length,
      0,
      "Files should only load when expanded",
    );
    await page
      .getByText("Tệp báo cáo và minh chứng", { exact: true })
      .first()
      .click();
    await page
      .getByRole("link", { name: /Báo cáo cuối:/ })
      .first()
      .waitFor();
    assert.ok(fileRequests.length > 0);
    for (const [section, filename] of [
      [report, "applications.xlsx"],
      [progress, "progress.xlsx"],
    ]) {
      const waiting = page.waitForEvent("download");
      await section
        .getByRole("button", { name: "Xuất Excel theo bộ lọc", exact: true })
        .click();
      const download = await waiting;
      assert.equal(await download.failure(), null);
      await download.saveAs(path.join(folder, filename));
      assert.equal(
        readFileSync(path.join(folder, filename)).subarray(0, 2).toString(),
        "PK",
      );
    }
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await report.scrollIntoViewIfNeeded();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: path.join(folder, `applications-${width}.png`),
      });
      await progress.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(folder, `progress-${width}.png`),
      });
      await readiness.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(folder, `readiness-${width}.png`),
      });
      await page
        .getByRole("region", { name: "Tổng quan thực tập", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(folder, `dashboard-${width}.png`),
      });
    }
    console.log(
      "PASS: filters, progress drilldown, audit, two Excel downloads, mobile/desktop overflow check.",
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

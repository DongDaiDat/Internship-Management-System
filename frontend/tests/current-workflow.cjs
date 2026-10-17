// Current role-separated UI against an isolated database; never uses local demo accounts.
const { chromium } = require("playwright");
const { readFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
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
assert.equal(fixture.version, 2);
assert.ok(
  Object.values(fixture.accounts).every((email) =>
    email.endsWith("@example.test"),
  ),
);
const output = join(__dirname, "../.local/current-workflow");
mkdirSync(output, { recursive: true });
const routes = {
  Admin: ["admin", "overview", "accounts", "pending", "catalog"],
  InternshipCoordinator: [
    "coordinator",
    "overview",
    "profiles",
    "import",
    "companies",
    "periods",
    "applications",
    "progress",
  ],
  FacultyManager: [
    "faculty",
    "overview",
    "approvals",
    "exceptions",
    "assignments",
    "grades",
    "results",
  ],
  FacultyMentor: ["mentor", "overview", "requests"],
  Company: ["company", "overview"],
  CompanySupervisor: ["supervisor", "overview"],
  Student: [
    "student",
    "overview",
    "profile",
    "registration",
    "applications",
    "reports",
    "documents",
    "results",
  ],
};
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const actors = {},
    errors = [];
  try {
    const probe = await browser.newContext();
    const deadline = Date.now() + 60000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        ready = (
          await probe.request.get(base + "/api/health", { timeout: 3000 })
        ).ok();
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await probe.close();
    assert.ok(ready, "QA frontend and backend must be healthy before login");
    for (const [role, [slug, ...views]] of Object.entries(routes)) {
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
      actors[role] = { context, page };
      for (const view of process.env.QA_WORKFLOW_ONLY === "true" ? [] : views) {
        await page.goto(`${base}/workspace/${slug}/${view}`, {
          waitUntil: "networkidle",
        });
        await page.locator(".workspace-heading h1").waitFor();
        assert.deepEqual(
          (await page.locator('[role="alert"]').allTextContents()).filter((v) =>
            v.trim(),
          ),
          [],
          `${role}/${view}`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `${role}/${view} overflow`,
        );
      }
    }
    console.log(
      process.env.QA_WORKFLOW_ONLY === "true"
        ? "PASS seven-actor authentication"
        : "PASS current routes for seven actors",
    );
    async function post(role, path, data, expected = 201) {
      const r = await actors[role].context.request.post(base + "/api" + path, {
        headers: { Origin: base },
        data,
      });
      assert.equal(r.status(), expected, `${role} ${path}: ${await r.text()}`);
      return expected === 204 ? null : r.json();
    }
    await post(
      "InternshipCoordinator",
      `/internships/${fixture.internshipId}/lock-grade`,
      {},
      403,
    );
    await post(
      "FacultyManager",
      "/users",
      {
        email: "forbidden@example.test",
        fullName: "Forbidden user",
        roles: ["Student"],
      },
      403,
    );
    // Import real Excel through UI and verify through coordinator UI.
    const {
      studentCode: suffix,
      fullName,
      email,
    } = JSON.parse(
      readFileSync(
        join(__dirname, "../../backend/.local/sprint4-import.json"),
        "utf8",
      ),
    );
    const coordinator = actors.InternshipCoordinator.page;
    const template = await actors.InternshipCoordinator.context.request.get(
      base + "/api/imports/template?type=Students",
    );
    assert.equal(template.status(), 200);
    await coordinator.goto(base + "/workspace/coordinator/import", {
      waitUntil: "networkidle",
    });
    await coordinator
      .getByLabel("File .xlsx", { exact: true })
      .setInputFiles(
        join(__dirname, "../../backend/.local/sprint4-import-valid.xlsx"),
      );
    await coordinator
      .getByRole("button", { name: "Kiểm tra file", exact: true })
      .click();
    await coordinator
      .getByRole("button", { name: "Xác nhận import", exact: true })
      .click();
    await coordinator.getByText(/Đã import/).waitFor();
    assert.equal(
      await coordinator.getByLabel("File .xlsx", { exact: true }).inputValue(),
      "",
      "Imported file selection is cleared",
    );
    assert.equal(
      await coordinator
        .getByRole("button", { name: "Kiểm tra file", exact: true })
        .isDisabled(),
      true,
      "Cannot preview a cleared file",
    );
    await coordinator.goto(base + "/workspace/coordinator/profiles", {
      waitUntil: "networkidle",
    });
    await coordinator.getByLabel("Tìm hồ sơ", { exact: true }).fill(suffix);
    await coordinator
      .getByRole("button", { name: "Xác minh", exact: true })
      .click();
    await coordinator
      .getByRole("button", { name: "Đã xác minh", exact: true })
      .waitFor();
    // Admin bulk provisioning, then mandatory password change through the browser.
    const admin = actors.Admin.page;
    await admin.goto(base + "/workspace/admin/pending", {
      waitUntil: "networkidle",
    });
    await admin
      .getByRole("row")
      .filter({ hasText: email })
      .getByRole("checkbox", { name: "Chọn " + fullName, exact: true })
      .check();
    await admin
      .getByRole("button", { name: "Cấp 1 tài khoản", exact: true })
      .click();
    await admin.locator(".credentials").waitFor();
    await admin
      .getByRole("button", { name: "Hiện mật khẩu", exact: true })
      .click();
    const temporaryPassword = await admin
      .locator(".credentials code")
      .innerText();
    const student = await browser.newContext();
    const onboard = await student.newPage();
    await onboard.goto(base);
    await onboard.getByLabel("Email", { exact: true }).fill(email);
    await onboard
      .getByLabel("Mật khẩu", { exact: true })
      .fill(temporaryPassword);
    await onboard
      .getByRole("button", { name: "Đăng nhập", exact: true })
      .click();
    await onboard.getByRole("heading", { name: "Đổi mật khẩu tạm" }).waitFor();
    await onboard
      .locator('input[type="password"]')
      .nth(0)
      .fill(temporaryPassword);
    const changed = "Changed-" + randomUUID();
    await onboard.locator('input[type="password"]').nth(1).fill(changed);
    await onboard.locator('input[type="password"]').nth(2).fill(changed);
    await onboard.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
    await onboard.locator(".workspace-heading").waitFor();
    assert.equal(
      (await (await student.request.get(base + "/api/auth/me")).json())
        .mustChangePassword,
      false,
    );
    console.log(
      "PASS import → verify → Admin provision → first password change",
    );
    // A future registration window arranged through the authorized API.
    const date = (n) => new Date(Date.now() + n * 86400000).toISOString();
    const periodBody = {
      departmentId: fixture.academic.departmentId,
      roundNumber: 2,
      semester: 1,
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      registrationStartsAt: new Date(Date.now() + 15000).toISOString(),
      registrationEndsAt: new Date(Date.now() + 75000).toISOString(),
      startsAt: date(2),
      endsAt: date(44),
      weeklyReportCount: 6,
      weeklyDeadlines: [9, 16, 23, 30, 37, 44].map(date),
      gradingDeadline: date(50),
      finalizationDeadline: date(57),
      audience: [
        {
          majorId: fixture.academic.majorId,
          cohortId: fixture.academic.cohortId,
        },
      ],
    };
    await post("Admin", "/internship-periods", periodBody, 403);
    const period = await post(
      "InternshipCoordinator",
      "/internship-periods",
      periodBody,
    );
    await post(
      "InternshipCoordinator",
      `/internship-periods/${period.id}/publish`,
      {},
      201,
    );
    await onboard.waitForTimeout(
      Math.max(
        0,
        Date.parse(periodBody.registrationStartsAt) - Date.now() + 100,
      ),
    );
    await onboard.goto(base + "/workspace/student/registration", {
      waitUntil: "networkidle",
    });
    await onboard.locator('select[name="periodId"]').selectOption(period.id);
    await onboard
      .getByLabel("Doanh nghiệp", { exact: true })
      .selectOption(fixture.companyId);
    await onboard
      .getByLabel("Vị trí thực tập", { exact: true })
      .fill("Thực tập kiểm thử");
    await onboard
      .getByLabel("Nguyện vọng hướng dẫn", { exact: true })
      .selectOption("propose");
    await onboard
      .getByLabel("Giảng viên mong muốn", { exact: true })
      .selectOption(fixture.mentorId);
    await onboard
      .getByLabel("Lý do đề xuất", { exact: true })
      .fill("Mong thầy hướng dẫn phát triển hệ thống web thực tế.");
    for (const width of [1440, 1024]) {
      await onboard.setViewportSize({ width, height: 1000 });
      assert.ok(
        await onboard.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await onboard.evaluate(() => window.scrollTo(0, 0));
      await onboard.screenshot({
        path: join(output, `student-proposal-${width}.png`),
        fullPage: true,
      });
    }
    await onboard
      .getByRole("button", { name: "Gửi đăng ký", exact: true })
      .click();
    await onboard.getByText(/Đã gửi hồ sơ đăng ký/).waitFor();
    const mentorRequests = actors.FacultyMentor.page;
    await mentorRequests.goto(base + "/workspace/mentor/requests", {
      waitUntil: "networkidle",
    });
    const requestCard = mentorRequests
      .locator("article")
      .filter({ hasText: fullName });
    await requestCard
      .getByText("Mong thầy hướng dẫn phát triển hệ thống web thực tế.", {
        exact: false,
      })
      .waitFor();
    for (const width of [1440, 1024]) {
      await mentorRequests.setViewportSize({ width, height: 1000 });
      assert.ok(
        await mentorRequests.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await mentorRequests.screenshot({
        path: join(output, `mentor-requests-${width}.png`),
        fullPage: true,
      });
    }
    await requestCard
      .getByRole("button", { name: "Gửi phản hồi", exact: true })
      .click();
    await mentorRequests.getByText(/Đã gửi phản hồi/).waitFor();
    await onboard.goto(base + "/workspace/student/applications", {
      waitUntil: "networkidle",
    });
    await onboard
      .locator(".mentor-request-summary > p")
      .filter({ hasText: "Giảng viên đồng ý" })
      .waitFor();
    const manager = actors.FacultyManager.page;
    await manager.goto(base + "/workspace/faculty/approvals", {
      waitUntil: "networkidle",
    });
    const application = manager
      .locator("article")
      .filter({ hasText: fullName });
    if (Date.now() < Date.parse(periodBody.registrationEndsAt)) {
      await application.getByText(/Chỉ duyệt sau khi đóng đăng ký/).waitFor();
      assert.equal(
        await application
          .getByRole("button", { name: "Xem lại và duyệt", exact: true })
          .count(),
        0,
      );
    }
    await manager.waitForTimeout(
      Math.max(0, Date.parse(periodBody.registrationEndsAt) - Date.now() + 100),
    );
    await manager.reload({ waitUntil: "networkidle" });
    assert.equal(
      await application
        .getByLabel("Giảng viên hướng dẫn", { exact: true })
        .inputValue(),
      fixture.mentorId,
    );
    for (const width of [1440, 1024]) {
      await manager.setViewportSize({ width, height: 1000 });
      assert.ok(
        await manager.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await manager.screenshot({
        path: join(output, `faculty-proposal-${width}.png`),
        fullPage: true,
      });
    }

    await application
      .getByRole("button", { name: "Xem lại và duyệt", exact: true })
      .click();
    await manager
      .getByRole("region", { name: "Xác nhận thao tác" })
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await application.waitFor({ state: "hidden" });
    console.log("PASS student registration → faculty approval");
    // Active fixture exercises reporting and grading without altering business dates.
    const active = actors.Student.page;
    await active.goto(base + "/workspace/student/reports", {
      waitUntil: "networkidle",
    });
    await active.getByRole("button", { name: /Tuần 01/ }).click();
    await active
      .getByLabel("Nội dung công việc và kết quả")
      .fill(
        "Báo cáo kiểm thử toàn luồng, hoàn thành công việc và kiểm tra kết quả.",
      );
    await active
      .getByRole("button", { name: "Nộp báo cáo", exact: true })
      .click();
    await active.getByText("Đã lưu báo cáo tuần 1.", { exact: true }).waitFor();
    await active.getByRole("button", { name: /Báo cáo cuối kỳ/ }).click();
    await active
      .getByLabel("Nội dung công việc và kết quả")
      .fill(
        "Báo cáo tổng kết thực tập: đã thực hiện khảo sát nghiệp vụ, xây dựng giao diện, phát triển API và kiểm thử chức năng. Kết quả đáp ứng yêu cầu và được bàn giao đầy đủ.",
      );
    await active
      .getByRole("button", { name: "Nộp báo cáo", exact: true })
      .click();
    await active
      .getByText("Đã lưu báo cáo cuối kỳ.", { exact: true })
      .waitFor();
    await active.goto(base + "/workspace/student/documents", {
      waitUntil: "networkidle",
    });
    await active
      .getByLabel("Báo cáo cần đính kèm")
      .selectOption({ label: "Báo cáo tuần 1" });
    await active
      .getByLabel("Tệp PDF", { exact: true })
      .setInputFiles(join(__dirname, "../../backend/.local/qa-report.pdf"));
    await active
      .getByRole("button", { name: "Lưu tệp PDF", exact: true })
      .click();
    await active
      .getByRole("link", { name: "Tuần 1: qa-report.pdf", exact: true })
      .waitFor();
    const mentor = actors.FacultyMentor.page;
    await mentor.goto(base + "/workspace/mentor/students", {
      waitUntil: "networkidle",
    });
    await mentor
      .getByLabel(/Hồ sơ đang xem/)
      .selectOption(fixture.internshipId);
    await mentor.getByText("Tuần 1 · Chờ nhận xét", { exact: true }).click();
    await mentor
      .getByLabel("Nhận xét", { exact: true })
      .fill("Đã kiểm tra kết quả và chấp nhận báo cáo.");
    await mentor
      .getByRole("button", { name: "Lưu nhận xét", exact: true })
      .click();
    await mentor.getByText("Tuần 1 · Đã nhận xét", { exact: true }).waitFor();
    await mentor
      .getByText("Điểm giảng viên · Chưa chấm", { exact: true })
      .click();
    await mentor.getByLabel("Điểm (0–10)", { exact: true }).fill("9");
    await mentor
      .getByRole("button", { name: "Lưu điểm giảng viên", exact: true })
      .click();
    await mentor.getByText("Điểm giảng viên · 9/10", { exact: true }).waitFor();
    const supervisor = actors.CompanySupervisor.page;
    await supervisor.goto(base + "/workspace/supervisor/students", {
      waitUntil: "networkidle",
    });
    await supervisor.getByText("Chấm điểm sinh viên", { exact: true }).click();
    for (const key of ["discipline", "responsibility", "knowledge", "outcome"])
      await supervisor.locator(`input[name="${key}"]`).fill("2");
    await supervisor
      .getByRole("button", { name: "Lưu phiếu đánh giá", exact: true })
      .click();
    await supervisor
      .getByText("Điểm bạn đã chấm: 8/10", { exact: true })
      .waitFor();
    await manager.goto(base + "/workspace/faculty/grades", {
      waitUntil: "networkidle",
    });
    const grade = manager
      .locator("article")
      .filter({ hasText: fixture.periodName });
    await grade.getByRole("button", { name: "Chốt điểm", exact: true }).click();
    await manager
      .getByRole("region", { name: "Xác nhận thao tác" })
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await grade.getByText(/Đã chốt: 8.5\/10/).waitFor();
    const historyResponse = await actors.FacultyManager.context.request.get(
      base + `/api/reports/internships/${fixture.internshipId}/history`,
    );
    assert.equal(historyResponse.status(), 200);
    const assignmentHistory = await historyResponse.json();
    assert.ok(assignmentHistory.length >= 3);
    assert.ok(assignmentHistory.every((entry) => entry.endedAt));
    const currentResponse = await actors.FacultyMentor.context.request.get(
      base +
        `/api/reports/internships?assignment=current&periodId=${fixture.periodId}`,
    );
    assert.equal(currentResponse.status(), 200);
    assert.ok(
      !(await currentResponse.json()).items.some(
        (item) => item.id === fixture.internshipId,
      ),
    );
    await active.goto(base + "/workspace/student/results", {
      waitUntil: "networkidle",
    });
    assert.match(
      await active.locator(".student-grade-result").innerText(),
      /8.5/,
    );
    await active.screenshot({
      path: join(output, "student-result.png"),
      fullPage: true,
    });
    await active.goto(base + "/workspace/student/reports", {
      waitUntil: "networkidle",
    });
    assert.equal(await active.locator("textarea").count(), 0);
    await post(
      "Student",
      `/internships/${fixture.internshipId}/weekly-reports`,
      { weekNumber: 1, content: "Attempt after grade locked" },
      409,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS weekly/final report → PDF → mentor review → company score → final grade 8.5 → locked writes",
    );
  } catch (error) {
    for (const [role, { page }] of Object.entries(actors))
      await page
        .screenshot({
          path: join(output, `failure-${role}.png`),
          fullPage: true,
        })
        .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

// API arranges a new synthetic profile; the browser tests first-login password change.
// Does not claim UI coverage of profile creation/provisioning.
const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const assert = require("node:assert/strict");
const origin = "http://localhost:3200";
const fixture = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      `../../backend/.local/${process.env.QA_BUILT === "true" ? "qa-sprint5-built" : "qa-sprint4"}.json`,
    ),
    "utf8",
  ),
);
assert.ok(fixture.accounts.Admin.endsWith("@example.test"));
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const admin = await browser.newContext();
    const post = (route, data) =>
      admin.request.post(`${origin}/api${route}`, {
        data,
        headers: { Origin: origin },
      });
    const login = await post("/auth/login", {
      email: fixture.accounts.Admin,
      password: fixture.password,
    });
    assert.equal(login.status(), 200, "QA Admin login");
    const suffix = randomUUID().slice(0, 12);
    const email = `onboarding-${suffix}@example.test`;
    const profileResponse = await post("/profiles/students", {
      data: {
        studentCode: `E2E-${suffix}`,
        fullName: "Sinh viên kiểm thử đổi mật khẩu",
        email,
        className: "CNTT E2E",
        cohort: "2026",
        programCredits: 150,
        completedCredits: 120,
        hasMandatoryCourseDebt: false,
      },
    });
    assert.equal(profileResponse.status(), 201, "QA profile creation");
    const profile = await profileResponse.json();
    const provision = await post(`/profiles/${profile.id}/provision`, {
      type: "student",
    });
    assert.equal(provision.status(), 201, "QA provision");
    const { temporaryPassword } = await provision.json();
    assert.equal(typeof temporaryPassword, "string");
    const student = await browser.newContext();
    const page = await student.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(temporaryPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page
      .getByRole("heading", { name: "Đổi mật khẩu tạm", exact: true })
      .waitFor();
    assert.equal(
      (await student.request.get(`${origin}/api/internship-periods`)).status(),
      403,
    );
    const password = randomUUID() + randomUUID();
    await page
      .getByLabel("Mật khẩu tạm được cấp", { exact: true })
      .fill(temporaryPassword);
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill(password);
    await page
      .getByLabel("Xác nhận mật khẩu", { exact: true })
      .fill(password + "x");
    await page
      .getByRole("button", { name: "Lưu mật khẩu mới", exact: true })
      .click();
    await page
      .getByText("Mật khẩu xác nhận chưa khớp.", { exact: true })
      .waitFor();
    assert.equal(
      (await student.request.get(`${origin}/api/auth/me`).then((r) => r.json()))
        .mustChangePassword,
      true,
    );
    await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Lưu mật khẩu mới", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Hồ sơ thực tập của tôi", exact: true })
      .waitFor();
    assert.equal(
      (await student.request.get(`${origin}/api/auth/me`).then((r) => r.json()))
        .mustChangePassword,
      false,
    );
    assert.equal(
      (await student.request.get(`${origin}/api/internship-periods`)).status(),
      200,
    );
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page
      .getByRole("button", { name: "Đăng nhập", exact: true })
      .waitFor();
    const oldLogin = await student.request.post(`${origin}/api/auth/login`, {
      data: { email, password: temporaryPassword },
      headers: { Origin: origin },
    });
    assert.equal(
      oldLogin.status(),
      401,
      "Old temporary password must be invalid",
    );
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page
      .getByRole("region", { name: "Hồ sơ thực tập của tôi", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS onboarding: API provisioning, mandatory password change, mismatch validation, old password rejected, new login",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

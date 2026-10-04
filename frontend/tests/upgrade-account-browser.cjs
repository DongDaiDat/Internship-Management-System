const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const base = "http://localhost:3000";
async function main() {
  const fixture = JSON.parse(readFileSync(join(__dirname, "../../backend/.local/upgrade-demo.json"), "utf8"));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const admin = await browser.newContext();
    assert.equal((await admin.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: fixture.accounts.Admin.email, password: fixture.password } })).status(), 200);
    const page = await admin.newPage();
    await page.goto(base + "/workspace/admin/accounts", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "＋ Tạo tài khoản", exact: true }).click();
    const email = `browser-${randomUUID()}@example.test`;
    await page.getByLabel("Họ tên", { exact: true }).fill("Kiểm thử giao diện");
    await page.getByLabel("Email đăng nhập", { exact: true }).fill(email);
    await page.getByLabel("Vai trò", { exact: true }).selectOption("Student");
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    await page.getByRole("button", { name: "Tạo và nhận mật khẩu" }).click();
    await page.locator(".credentials").waitFor();
    await page.getByRole("button", { name: "Hiện mật khẩu", exact: true }).click();
    const temporaryPassword = await page.locator(".credentials code").innerText();
    assert.ok(temporaryPassword.length >= 20);
    await page.getByRole("link", { name: "Chờ cấp tài khoản", exact: true }).click();
    await page.locator(".credentials").waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Tài khoản", exact: true }).click();
    await page.waitForURL("**/workspace/admin/accounts");
    assert.equal(await page.locator(".credentials").count(), 0);
    assert.equal(await page.evaluate(p => JSON.stringify(localStorage).includes(p), temporaryPassword), false);
    const student = await browser.newContext({ viewport: { width: 390, height: 844 } });
    assert.equal((await student.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email, password: temporaryPassword } })).status(), 200);
    const change = await student.newPage();
    await change.goto(base + "/workspace/student/overview", { waitUntil: "networkidle" });
    await change.getByRole("heading", { name: "Đổi mật khẩu tạm" }).waitFor();
    await change.locator('input[type="password"]').nth(0).fill(temporaryPassword);
    const password = "Changed-" + randomUUID();
    await change.locator('input[type="password"]').nth(1).fill(password);
    await change.locator('input[type="password"]').nth(2).fill(password);
    await change.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
    await change.getByRole("heading", { name: "Đổi mật khẩu tạm" }).waitFor({ state: "hidden" });
    const me = await student.request.get(base + "/api/auth/me");
    assert.equal((await me.json()).mustChangePassword, false);
    console.log("Browser account creation, one-time credential lifecycle and mandatory password change passed.");
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });

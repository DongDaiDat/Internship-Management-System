const { chromium } = require("playwright");
const { readFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const base = "http://localhost:3000";
const fixture = JSON.parse(readFileSync(join(__dirname, "../../backend/.local/upgrade-demo.json"), "utf8"));
const output = join(__dirname, "../../.local/final-ui");
async function main() {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const scenarios = JSON.parse(readFileSync(join(__dirname, "../../backend/.local/demo-scenarios.json"), "utf8"));
    const accounts = [...Object.values(fixture.accounts), ...scenarios.entries];
    for (const account of accounts) {
      const context = await browser.newContext();
      const response = await context.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: account.email, password: fixture.password } });
      assert.equal(response.status(), 200, account.email + ": demo login");
      assert.equal((await response.json()).mustChangePassword, false);
      await context.request.post(base + "/api/auth/logout", { headers: { Origin: base } });
      await context.close();
    }
    for (const [role, route, button] of [
      ["Admin", "admin/accounts", "＋ Tạo tài khoản"],
      ["InternshipCoordinator", "coordinator/periods", "＋ Tạo đợt thực tập"],
    ]) {
      const context = await browser.newContext();
      const login = await context.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: fixture.accounts[role].email, password: fixture.password } });
      assert.equal(login.status(), 200);
      const page = await context.newPage();
      for (const width of [1440,1024,390]) {
        await page.setViewportSize({width, height: 960});
        await page.goto(base + "/workspace/" + route, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: button, exact: true }).click();
        const input = page.locator("main form input").first();
        await input.focus();
        await page.mouse.move(1, 1);
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".button.primary")).backgroundColor === "rgb(18, 59, 112)");
        assert.equal(await input.evaluate(el => getComputedStyle(el).outlineColor), "rgb(245, 130, 32)");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.equal(await page.locator(".button.primary").first().evaluate(el => getComputedStyle(el).backgroundColor), "rgb(18, 59, 112)");
        assert.equal(await page.locator("main form label").first().evaluate(el => getComputedStyle(el).marginBottom), "0px");
        await page.screenshot({ path: join(output, `${role}-form-${width}.png`), fullPage: true });
      }
      await context.close();
    }
    const page = await browser.newPage();
    for (const width of [1440,1024,390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(base, { waitUntil: "networkidle" });
      assert.equal(await page.locator(".password-input button").evaluate(el => getComputedStyle(el).color), "rgb(18, 59, 112)");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: join(output, `login-${width}.png`), fullPage: true });
      await page.goto(base + "/demo", { waitUntil: "networkidle" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: join(output, `demo-${width}.png`), fullPage: true });
    }
    console.log("All 11 demo accounts authenticated. Expanded forms, palette, focus, label spacing, login and demo passed at all three widths.");
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.stack); process.exitCode=1; });

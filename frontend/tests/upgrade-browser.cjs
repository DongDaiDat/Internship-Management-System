const { chromium } = require("playwright");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const base = process.env.UPGRADE_BASE_URL || "http://localhost:3000";
const fixture = JSON.parse(readFileSync(join(__dirname, "../../backend/.local/upgrade-demo.json"), "utf8"));
const desktopOnly = process.env.UPGRADE_DESKTOP_ONLY === "1";
const output = join(__dirname, desktopOnly ? "../../.local/desktop-redesign" : "../../.local/upgrade-screenshots");
mkdirSync(output, { recursive: true });
const menus = { Admin: ["admin", ["overview", "accounts", "pending", "catalog"]], InternshipCoordinator: ["coordinator", ["overview", "profiles", "import", "companies", "periods", "applications", "progress"]], FacultyManager: ["faculty", ["overview", "approvals", "exceptions", "assignments", "grades", "results"]], Student: ["student", ["overview", "profile"]], FacultyMentor: ["mentor", ["overview"]], Company: ["company", ["overview"]], CompanySupervisor: ["supervisor", ["overview"]] };
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    for (const [role, [slug, views]] of Object.entries(menus)) {
      if (process.env.UPGRADE_ROLES && !process.env.UPGRADE_ROLES.split(',').includes(role)) continue;
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const response = await context.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: fixture.accounts[role].email, password: fixture.password } });
      assert.equal(response.status(), 200, `${role}: login`);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("response", response => { if (response.url().includes("/api/") && response.status() >= 400) console.error(`HTTP ${response.status()} ${new URL(response.url()).pathname}${new URL(response.url()).search}`); });
      for (const view of views) {
        await page.goto(`${base}/workspace/${slug}/${view}`, { waitUntil: "networkidle" });
        await page.locator(".workspace-heading h1").waitFor();
        const alerts = await page.locator('[role="alert"]').allTextContents();
        assert.deepEqual(alerts.filter(x => x.trim()), [], `${role}/${view}: alerts`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${role}/${view}: overflow`);
        if (role === "Admin") assert.equal(await page.getByRole("button", { name: /Tạo đợt/ }).count(), 0);
        if (role === "FacultyManager") assert.equal(await page.getByRole("button", { name: /Đổi giảng viên|Cấp tài khoản/ }).count(), 0);
        await page.screenshot({ path: join(output, `${slug}-${view}-1440.png`), fullPage: true });
        results.push(`${role}/${view}: pass`);
      }
      for (const width of desktopOnly ? [1920] : [1024, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/workspace/${slug}/overview`, { waitUntil: "networkidle" });
        if (width === 390) { await page.getByRole("button", { name: "Mở menu", exact: true }).click(); await page.locator(".workspace-sidebar.is-open").waitFor(); await page.getByRole("button", { name: "Đóng menu", exact: true }).click(); }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${role}/${width}: overflow`);
        if (width === 390) await page.waitForFunction(() => document.querySelector(".workspace-sidebar").getBoundingClientRect().right <= 1);
        await page.screenshot({ path: join(output, `${slug}-overview-${width}.png`), fullPage: true });
        for (const view of views.filter(v => v !== "overview")) {
          await page.goto(`${base}/workspace/${slug}/${view}`, { waitUntil: "networkidle" });
          await page.locator(".workspace-heading h1").waitFor();
          assert.deepEqual((await page.locator('[role="alert"]').allTextContents()).filter(x => x.trim()), [], `${role}/${view}/${width}: alerts`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${role}/${view}/${width}: overflow`);
          await page.screenshot({ path: join(output, `${slug}-${view}-${width}.png`), fullPage: true });
        }
      }
      if (["FacultyMentor", "Company", "CompanySupervisor"].includes(role)) {
        const details = page.locator(".assignment-detail");
        const picker = role === "FacultyMentor" ? page.getByLabel(/Hồ sơ đang xem/) : page.getByLabel(/Sinh viên ·/);
        if (await details.count()) {
          assert.equal(await details.count(), 1, `${role}: only one selected student`);
          const options = await picker.locator("option").evaluateAll(nodes => nodes.map(n => n.value));
          if (options.length > 1) {
            const before = await details.locator("h2").innerText();
            await picker.selectOption(options[1]);
            assert.notEqual(await details.locator("h2").innerText(), before, `${role}: student selection`);
          }
        }
      }
      assert.deepEqual(errors, [], `${role}: JS errors`);
      await context.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(base + "/", { waitUntil: "networkidle" }); await page.screenshot({ path: join(output, "login-1440.png"), fullPage: true });
    await page.goto(base + "/demo", { waitUntil: "networkidle" }); await page.screenshot({ path: join(output, "demo-1440.png"), fullPage: true });
    writeFileSync(join(output, "results.json"), JSON.stringify(results, null, 2));
    console.log(`${results.length} role pages passed; screenshots saved to ${output}.`);
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

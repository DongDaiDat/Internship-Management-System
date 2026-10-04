const { chromium } = require("playwright");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const base = process.env.UPGRADE_BASE_URL || "http://localhost:3000";
const fixture = JSON.parse(readFileSync(join(__dirname, "../../backend/.local/upgrade-demo.json"), "utf8"));
const output = join(__dirname, "../../.local/student-redesign");
const views = ["overview", "profile", "registration", "applications", "reports", "documents", "results"];
async function main() {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    const context = await browser.newContext();
    const login = await context.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: fixture.accounts.Student.email, password: fixture.password } });
    assert.equal(login.status(), 200, "Demo student login (credentials are never reset by this test)");
    const mineResponse = await context.request.get(base + "/api/internships/mine");
    assert.equal(mineResponse.status(), 200);
    const mine = await mineResponse.json();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [1440,1024,390]) {
      await page.setViewportSize({ width, height: 960 });
      for (const view of views) {
        await page.goto(base + "/workspace/student/" + view, { waitUntil: "networkidle" });
        await page.locator(".workspace-heading h1").waitFor();
        assert.deepEqual((await page.locator('[role="alert"]').allTextContents()).filter(Boolean), [], `${view}/${width}: alerts`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${view}/${width}: overflow`);
        if (view === "overview") { assert.equal(await page.locator("textarea").count(), 0); assert.equal(await page.getByRole("button", { name: "Gửi đăng ký", exact: true }).count(), 0); }
        if (view === "profile") assert.equal(await page.locator(".student-profile-fields > div").count(), 7);
        if (view === "reports") assert.ok(await page.locator("textarea").count() <= 1, "Only one report editor is mounted");
        await page.screenshot({ path: join(output, `${view}-${width}.png`), fullPage: true });
        results.push(`${view}/${width}: pass`);
      }
      if (width === 390) {
        await page.getByRole("button", { name: "Mở menu", exact: true }).click();
        await page.locator(".workspace-sidebar.is-open").waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".workspace-sidebar.is-open").count(), 0);
      }
    }
    await page.getByRole("searchbox", { name: "Tìm kiếm chức năng" }).fill("dang ky");
    assert.equal(await page.locator(".student-search-results a").count(), 2);
    await page.getByRole("searchbox", { name: "Tìm kiếm chức năng" }).fill("bao cao");
    await page.locator(".student-search-results").getByRole("link", { name: "Báo cáo thực tập →" }).click();
    await page.waitForURL("**/student/reports");
    await page.reload({waitUntil:"networkidle"});
    assert.equal(await page.locator(".workspace-heading h1").innerText(), "Báo cáo thực tập");
    assert.deepEqual(errors, []);

    // Deterministic browser-only scenarios: mutations stay in memory, never alter demo data.
    const state = structuredClone(mine);
    assert.ok(state.internships.length);
    const active = state.internships[0];
    active.finalGrade = null; active.facultyEvaluation = null; active.finalReport = null;
    active.period.startsAt = new Date(Date.now()-86400000).toISOString();
    active.period.endsAt = new Date(Date.now()+90*86400000).toISOString();
    active.period.weeklyReportCount = 12;
    active.period.weeklyDeadlines = Array.from({length:12},(_,i)=>new Date(Date.now()+(i+1)*86400000).toISOString());
    active.weeklyReports = [{id:"reviewed",weekNumber:1,status:"Reviewed",content:"Báo cáo tuần đã được duyệt.",mentorNote:"Đã hoàn thành tốt."}];
    await page.route("**/api/internships/mine", route=>route.fulfill({json:state}));
    let saved = null;
    await page.route(`**/api/internships/${active.id}/weekly-reports`, async route=> {
      saved = route.request().postDataJSON();
      active.weeklyReports.push({id:"saved",...saved,status:"Submitted",mentorNote:null});
      await route.fulfill({status:201,json:{}});
    });
    await page.goto(base+"/workspace/student/reports", {waitUntil:"networkidle"});
    assert.equal(await page.locator(".student-week-list button").count(),13);
    await page.locator("textarea").fill("Công việc tuần hai: thiết kế giao diện và kiểm tra tính dễ sử dụng.");
    page.once("dialog", dialog=>dialog.dismiss());
    await page.getByRole("button",{name:/Tuần 03/}).click();
    assert.equal(await page.locator(".student-report-editor h3").innerText(),"Báo cáo tuần 2");
    await page.getByRole("button",{name:"Nộp báo cáo",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Đã lưu báo cáo tuần 2"}).waitFor();
    assert.equal(saved.weekNumber,2);
    assert.ok(saved.content.includes("Công việc tuần hai"));
    await page.getByRole("button",{name:/Tuần 01/}).click();
    assert.equal(await page.locator("textarea").count(),0,"Reviewed reports are read-only");
    await page.getByRole("button",{name:/Báo cáo cuối kỳ/}).click();
    assert.equal(await page.locator("textarea").getAttribute("minlength"),"100");
    await page.screenshot({path:join(output,"reports-12-weeks-390.png"),fullPage:true});
    active.finalGrade={total:8.5,letterGrade:"B+",passed:true};
    await page.goto(base+"/workspace/student/results",{waitUntil:"networkidle"});
    assert.ok((await page.locator(".student-grade-result").innerText()).includes("8.5"));
    state.internships=[];
    await page.goto(base+"/workspace/student/reports",{waitUntil:"networkidle"});
    await page.getByRole("heading",{name:"Chưa có kỳ thực tập"}).waitFor();
    assert.deepEqual(errors,[]);
    writeFileSync(join(output,"results.json"),JSON.stringify({pages:results,interactions:"search, reload, mobile menu, 12-week selection, unsaved warning, report save, locks, final report, results, empty state passed"},null,2));
    console.log("21 live student page/viewport checks and deterministic report interactions passed; demo data unchanged.");
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});

const { chromium } = require('playwright');
const { readFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const base = 'http://localhost:3000';
const fixture = JSON.parse(readFileSync(join(__dirname, '../../backend/.local/upgrade-demo.json'), 'utf8'));
const output = join(__dirname, '../../.local/desktop-redesign');
async function main() {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [role, path, button, name] of [
      ['Admin', 'admin/accounts', /Tạo tài khoản/, 'create-account'],
      ['Admin', 'admin/catalog', /Thêm khoa/, 'create-catalog'],
      ['InternshipCoordinator', 'coordinator/periods', /Tạo đợt thực tập/, 'create-period'],
    ]) {
      const context = await browser.newContext({viewport:{width:1440,height:1000}});
      const response = await context.request.post(base + '/api/auth/login', {headers:{Origin:base},data:{email:fixture.accounts[role].email,password:fixture.password}});
      assert.equal(response.status(),200);
      const page = await context.newPage();
      await page.goto(base + '/workspace/' + path, {waitUntil:'networkidle'});
      await page.getByRole('button', {name:button}).first().click();
      await page.locator('form').first().waitFor();
      for (const width of [1440,1920]) {
        await page.setViewportSize({width,height:1000});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        await page.screenshot({path:join(output,`${name}-${width}.png`),fullPage:true});
      }
      assert.deepEqual((await page.locator('[role="alert"]').allTextContents()).filter(text=>text.trim()),[]);
      await context.close();
    }
    console.log('Three expanded forms passed at 1440 and 1920; no records submitted.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

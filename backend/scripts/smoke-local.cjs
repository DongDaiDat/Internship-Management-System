// Checks the actual Next.js proxy with local demo accounts without logging credentials.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const base = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000");
if (
  !["127.0.0.1", "localhost"].includes(base.hostname) ||
  base.protocol !== "http:"
)
  throw new Error("This smoke check only supports local development origins.");
const content = fs.readFileSync(
  path.resolve(__dirname, "../.local/demo-accounts.txt"),
  "utf8",
);
const accounts = Array.from(
  content.matchAll(
    /(Admin|Student)\r?\nEmail: ([^\r\n]+)\r?\nMật khẩu: ([^\r\n]+)/g,
  ),
).map((match) => ({ role: match[1], email: match[2], password: match[3] }));
async function request(
  route,
  { method = "GET", body, cookie, origin = base.origin } = {},
) {
  return fetch(new URL("/api" + route, base), {
    method,
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function main() {
  assert.equal(
    accounts.length,
    2,
    "Local account file must contain both roles.",
  );
  assert.equal((await request("/auth/me")).status, 401);
  for (const account of accounts) {
    let cookie;
    try {
      const response = await request("/auth/login", {
        method: "POST",
        body: { email: account.email, password: account.password },
      });
      assert.equal(response.status, 200, `${account.role} login failed`);
      const header = response.headers.get("set-cookie");
      assert.ok(
        header &&
          header.includes("HttpOnly") &&
          header.includes("SameSite=Strict"),
      );
      cookie = header.split(";")[0];
      const current = await request("/auth/me", { cookie });
      assert.equal(current.status, 200);
      const user = await current.json();
      assert.equal(user.email, account.email);
      assert.equal(user.passwordHash, undefined);
      assert.equal(
        (await request("/users", { cookie })).status,
        account.role === "Admin" ? 200 : 403,
      );
      assert.equal(
        (
          await request("/auth/logout", {
            method: "POST",
            cookie,
            origin: "https://untrusted.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (await request("/auth/logout", { method: "POST", cookie })).status,
        204,
      );
      assert.equal((await request("/auth/me", { cookie })).status, 401);
      console.log(
        `PASS ${account.role}: login, identity, permissions, origin protection and logout through Next.js.`,
      );
    } finally {
      if (cookie)
        await request("/auth/logout", { method: "POST", cookie }).catch(
          () => undefined,
        );
    }
  }
}
main().catch((error) => {
  console.error("Local smoke check failed:", error.message);
  process.exitCode = 1;
});

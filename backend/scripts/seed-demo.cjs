// Explicit local-only provisioning. Never resets existing passwords or logs credentials.
const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { hashPassword } = require("../dist/auth/password");
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo provisioning is disabled in production.");
  const outputDirectory = path.resolve(__dirname, "../.local");
  const outputPath = path.join(outputDirectory, "demo-accounts.txt");
  const existing = await prisma.user.count({
    where: { email: { in: ["admin@interna.local", "student@interna.local"] } },
  });
  if (existing) {
    console.log("Demo accounts already exist. No password was changed.");
    return;
  }
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  // Reserve the output file first; never overwrite an existing credentials file.
  const descriptor = fs.openSync(outputPath, "wx", 0o600);
  try {
    const accounts = [
      {
        email: "admin@interna.local",
        fullName: "Quản trị Interna",
        role: "Admin",
        password: randomBytes(18).toString("base64url"),
      },
      {
        email: "student@interna.local",
        fullName: "Nguyễn Minh Anh",
        role: "Student",
        password: randomBytes(18).toString("base64url"),
      },
    ];
    // Persist credentials before committing accounts to avoid orphaned passwords on a disk failure.
    fs.writeFileSync(
      descriptor,
      "TÀI KHOẢN PHÁT TRIỂN LOCAL — KHÔNG COMMIT HOẶC CHIA SẺ\n\n" +
        accounts
          .map(
            (account) =>
              `${account.role}\nEmail: ${account.email}\nMật khẩu: ${account.password}\n`,
          )
          .join("\n"),
      "utf8",
    );
    const hashes = await Promise.all(
      accounts.map((account) => hashPassword(account.password)),
    );
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const user = await tx.user.create({
          data: {
            email: account.email,
            fullName: account.fullName,
            passwordHash: hashes[i],
            roles: { create: { role: account.role } },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "users.bootstrap",
            targetId: user.id,
          },
        });
      }
    });
    console.log(
      "Created 2 local accounts. Credentials saved to backend/.local/demo-accounts.txt.",
    );
  } finally {
    fs.closeSync(descriptor);
  }
}
main()
  .catch(() => {
    console.error(
      "Local provisioning failed. Inspect database availability and the local credentials file; existing accounts were not overwritten.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

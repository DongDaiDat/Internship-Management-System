/* Read-only QA fingerprint: every public table and every private PDF. Never targets main. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const mode = process.argv[2];
const database = process.env.VERIFY_DATABASE_NAME;
assert(["capture", "compare"].includes(mode), "Expected capture or compare");
assert.equal(
  database,
  mode === "capture" ? "internship_sprint4_test" : "internship_restore_test",
);
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, "postgres");
url.pathname = `/${database}`;
process.env.DATABASE_URL = url.toString();
const prisma = new PrismaClient();
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "http://minio:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
  },
});
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const fingerprintName =
  process.env.VERIFY_FINGERPRINT || "restore-fingerprint.json";
assert(
  /^restore-[a-z0-9-]+\.json$/.test(fingerprintName),
  "Invalid fingerprint name",
);
const fingerprintPath = path.join(__dirname, "../.local", fingerprintName);
async function main() {
  const tables =
    await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const fingerprint = { tables: {}, files: [] };
  for (const { tablename } of tables) {
    // Identifier comes only from pg_catalog and is quoted, never user input.
    const identifier = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = await prisma.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM public.${identifier} t`,
    );
    const canonical = rows.map(({ row }) => row).sort();
    fingerprint.tables[tablename] = {
      count: rows.length,
      sha256: digest(JSON.stringify(canonical)),
    };
  }
  const files = await prisma.fileDocument.findMany({ orderBy: { id: "asc" } });
  assert(
    files.length > 0,
    "QA must contain uploaded PDFs to exercise storage restore",
  );
  for (const file of files) {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: file.bucket, Key: file.objectKey }),
    );
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    assert.equal(digest(bytes), file.sha256, `PDF mismatch: ${file.id}`);
    fingerprint.files.push({
      id: file.id,
      sha256: digest(bytes),
      bytes: bytes.length,
    });
  }
  if (mode === "capture") {
    fs.mkdirSync(path.dirname(fingerprintPath), { recursive: true });
    fs.writeFileSync(fingerprintPath, JSON.stringify(fingerprint, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
  } else {
    assert.deepEqual(
      fingerprint,
      JSON.parse(fs.readFileSync(fingerprintPath, "utf8")),
    );
  }
  console.log(
    `PASS ${mode}: ${tables.length} tables, ${files.length} private PDFs; hashes verified.`,
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    s3.destroy();
  });

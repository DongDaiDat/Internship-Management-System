// Synthetic Excel inputs for browser import tests, not application data.
const ExcelJS = require("exceljs");
const { randomUUID } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
async function main() {
  if (process.env.QA_DATABASE_NAME !== "internship_sprint4_test")
    throw new Error("Run inside the dedicated E2E stack");
  const folder = path.join(__dirname, "../.local");
  mkdirSync(folder, { recursive: true });
  const suffix = randomUUID().slice(0, 8);
  const studentCode = `IMPORT-${suffix}`,
    email = `import-${suffix}@example.test`;
  const columns = [
    "studentCode",
    "fullName",
    "email",
    "className",
    "cohort",
    "major",
    "programCredits",
    "completedCredits",
    "hasMandatoryCourseDebt",
  ];
  const row = [
    studentCode,
    "Nguyễn Thị Ánh Dương Kiểm Thử Tên Dài",
    email,
    "CNTT E2E",
    "2026",
    "Công nghệ thông tin",
    150,
    120,
    "false",
  ];
  for (const kind of ["valid", "invalid", "missing-column"]) {
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Students");
    sheet.addRow(kind === "missing-column" ? columns.slice(0, -1) : columns);
    sheet.addRow(kind === "missing-column" ? row.slice(0, -1) : row);
    if (kind === "invalid") {
      sheet.addRow([
        `${studentCode}-2`,
        "Email sai",
        "bad-email",
        "CNTT",
        "2026",
        "CNTT",
        150,
        120,
        "false",
      ]);
      sheet.addRow([
        `${studentCode}-3`,
        "Tín chỉ sai",
        `second-${email}`,
        "CNTT",
        "2026",
        "CNTT",
        150,
        999,
        "false",
      ]);
    }
    await book.xlsx.writeFile(path.join(folder, `sprint4-import-${kind}.xlsx`));
  }
  writeFileSync(
    path.join(folder, "sprint4-import.json"),
    JSON.stringify({ studentCode, email }),
    { mode: 0o600 },
  );
  console.log(
    "Generated synthetic import files: valid, invalid rows, missing column.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

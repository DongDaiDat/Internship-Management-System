const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const path = require("node:path");
const filename = path.resolve(__dirname, "../src/lib/weekly-report.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { emptyDraft, validateReport, parseDraft } = loaded.exports;
const valid = {
  week: 6,
  hours: "40",
  work: "Hoàn thành giao diện báo cáo tuần.",
  learning: "Học cách kiểm tra dữ liệu biểu mẫu.",
  nextPlan: "Tích hợp API cho báo cáo thực tập.",
};
test("valid complete report can be previewed", () =>
  assert.deepEqual(validateReport(valid), {}));
test("empty report identifies all required contents", () =>
  assert.equal(Object.keys(validateReport(emptyDraft)).length, 4));
test("hours reject zero negative excessive and nonnumeric values", () => {
  for (const hours of ["", " ", "0", "-1", "169", "Infinity", "abc"])
    assert.ok(validateReport({ ...valid, hours }).hours, hours);
  for (const hours of ["0.5", "40", "168"])
    assert.equal(validateReport({ ...valid, hours }).hours, undefined);
});
test("week must be an integer inside the demo period", () => {
  for (const week of [0, 13, 1.5, NaN])
    assert.ok(validateReport({ ...valid, week }).week);
});
test("whitespace and excessive content are rejected", () => {
  for (const work of ["          ", "ngắn", "a".repeat(3001)])
    assert.ok(validateReport({ ...valid, work }).work);
});
test("saved draft round-trips including Vietnamese and newlines", () =>
  assert.deepEqual(
    parseDraft(JSON.stringify({ ...valid, work: "Công việc\nDòng thứ hai" })),
    { ...valid, work: "Công việc\nDòng thứ hai" },
  ));
test("corrupted or incompatible storage fails safely", () => {
  for (const raw of [
    "broken",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...valid, week: 99 }),
    JSON.stringify({ ...valid, hours: 40 }),
    JSON.stringify({ ...valid, work: "a".repeat(3001) }),
  ])
    assert.equal(parseDraft(raw), null);
});
test("incomplete draft remains saveable for later work", () =>
  assert.deepEqual(parseDraft(JSON.stringify(emptyDraft)), emptyDraft));

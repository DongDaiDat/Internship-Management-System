const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  ts = require("typescript"),
  Module = require("node:module"),
  path = require("node:path");
const filename = path.resolve(__dirname, "../src/lib/profile-validation.ts");
const loaded = new Module(filename, module);
loaded._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  filename,
);
const { validateProfile } = loaded.exports;
const student = {
  studentCode: "SV1",
  fullName: "Nguyễn An",
  email: "qa@example.test",
  className: "CNTT",
  cohort: "2026",
  programCredits: "150",
  completedCredits: "120",
  hasMandatoryCourseDebt: "false",
};
test("profile validation accepts valid student and identifies required fields", () => {
  assert.deepEqual(validateProfile("students", student), {});
  assert.equal(Object.keys(validateProfile("students", {})).length, 8);
});
test("profile validation rejects credit overflow, fractional credits and invalid email", () => {
  assert.ok(
    validateProfile("students", { ...student, completedCredits: 151 })
      .completedCredits,
  );
  assert.ok(
    validateProfile("students", { ...student, programCredits: 1.5 })
      .programCredits,
  );
  assert.ok(
    validateProfile("students", { ...student, email: "invalid" }).email,
  );
});
test("profile validation enforces quota bounds and field length", () => {
  const faculty = {
    facultyCode: "GV1",
    fullName: "Giảng viên",
    email: "qa@example.test",
    expertise: "CNTT",
    maxStudents: 10,
  };
  assert.deepEqual(validateProfile("faculty", faculty), {});
  for (const maxStudents of [0, 101, 1.5, "abc"])
    assert.ok(
      validateProfile("faculty", { ...faculty, maxStudents }).maxStudents,
    );
  assert.ok(
    validateProfile("faculty", { ...faculty, fullName: "A".repeat(121) })
      .fullName,
  );
});

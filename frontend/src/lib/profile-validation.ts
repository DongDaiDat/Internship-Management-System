// Client-side feedback only; server validation remains authoritative.
const required: Record<string, string[]> = {
  students: [
    "studentCode",
    "fullName",
    "email",
    "className",
    "cohort",
    "programCredits",
    "completedCredits",
    "hasMandatoryCourseDebt",
  ],
  faculty: ["facultyCode", "fullName", "email", "expertise", "maxStudents"],
  companies: ["name", "address", "contactName", "contactEmail", "contactPhone"],
};
const limits: Record<string, number> = {
  studentCode: 30,
  facultyCode: 30,
  fullName: 120,
  email: 254,
  className: 80,
  cohort: 30,
  major: 120,
  expertise: 160,
  name: 160,
  taxCode: 30,
  address: 255,
  website: 255,
  contactName: 120,
  contactEmail: 254,
  contactPhone: 30,
};
export function validateProfile(type: string, data: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const value = (key: string) => String(data[key] ?? "").trim();
  for (const key of required[type] ?? [])
    if (!value(key)) errors[key] = "Vui lòng nhập thông tin này.";
  for (const [key, limit] of Object.entries(limits))
    if (value(key).length > limit) errors[key] = `Nhập tối đa ${limit} ký tự.`;
  for (const key of ["email", "contactEmail"])
    if (value(key) && !/^\S+@\S+\.\S+$/.test(value(key)))
      errors[key] = "Nhập địa chỉ email hợp lệ.";
  if (type === "students") {
    for (const key of ["programCredits", "completedCredits"]) {
      const number = Number(value(key));
      if (
        !Number.isInteger(number) ||
        number < (key === "programCredits" ? 1 : 0)
      )
        errors[key] = "Nhập số tín chỉ nguyên hợp lệ.";
    }
    if (Number(value("completedCredits")) > Number(value("programCredits")))
      errors.completedCredits = "Không được vượt tổng tín chỉ chương trình.";
    if (!["true", "false"].includes(value("hasMandatoryCourseDebt")))
      errors.hasMandatoryCourseDebt = "Chọn Có hoặc Không.";
  }
  if (type === "faculty") {
    const quota = Number(value("maxStudents"));
    if (!Number.isInteger(quota) || quota < 1 || quota > 100)
      errors.maxStudents = "Giới hạn hướng dẫn từ 1 đến 100 sinh viên.";
  }
  return errors;
}

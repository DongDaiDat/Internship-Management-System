/* Idempotent catalog seed. Never infers a student's department from their code. */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const source =
  "https://psc.phenikaa-uni.edu.vn/vi/page/doi-ngu-can-bo-giang-vien";
async function seedAcademic(client = db) {
  const departments = {};
  for (const [code, name] of [
    ["KHMT", "Khoa Khoa học máy tính"],
    ["HTTT", "Khoa Hệ thống thông tin"],
    ["AI-KHDL", "Khoa Trí tuệ nhân tạo và Khoa học dữ liệu"],
  ])
    departments[code] = await client.department.upsert({
      where: { code },
      create: { code, name },
      update: {},
    });
  const programs = [
    ["CNTT", "Công nghệ thông tin", "ICT1", "Công nghệ thông tin", "HTTT"],
    [
      "CNTT",
      "Công nghệ thông tin",
      "ICT-VJ",
      "Công nghệ thông tin Việt–Nhật",
      "HTTT",
    ],
    [
      "KTPM",
      "Kỹ thuật phần mềm",
      "ICT2",
      "Kỹ thuật phần mềm (một số học phần bằng tiếng Anh)",
      "HTTT",
    ],
    [
      "KHMT",
      "Khoa học máy tính",
      "ICT3",
      "Khoa học máy tính (Trí tuệ nhân tạo và Khoa học dữ liệu)",
      "AI-KHDL",
    ],
    [
      "KHMT",
      "Khoa học máy tính",
      "ICT-TN",
      "Tài năng Khoa học máy tính",
      "KHMT",
    ],
    [
      "ATTT",
      "An toàn thông tin",
      "ICT4",
      "An toàn thông tin (một số học phần bằng tiếng Anh)",
      "HTTT",
    ],
    ["TTNT", "Trí tuệ nhân tạo", "ICT5", "Trí tuệ nhân tạo", "AI-KHDL"],
    ["KHDL", "Khoa học dữ liệu", "ICT6", "Khoa học dữ liệu", null],
    ["HTTT", "Hệ thống thông tin", "ICT7", "Hệ thống thông tin", null],
    [
      "ANM",
      "An ninh mạng",
      "ICT8",
      "An ninh mạng (một số học phần bằng tiếng Anh)",
      null,
    ],
  ];
  for (const [majorCode, majorName, code, name, departmentCode] of programs) {
    const major = await client.major.upsert({
      where: { code: majorCode },
      create: { code: majorCode, name: majorName },
      update: {},
    });
    const program = await client.trainingProgram.upsert({
      where: { code },
      create: { code, name, majorId: major.id },
      update: {},
    });
    if (departmentCode) {
      const departmentId = departments[departmentCode].id;
      await client.departmentProgram.upsert({
        where: {
          departmentId_programId: { departmentId, programId: program.id },
        },
        create: {
          departmentId,
          programId: program.id,
          confirmed: true,
          source,
        },
        update: {},
      });
    }
  }
  for (let number = 15; number <= 20; number++)
    await client.cohort.upsert({
      where: { code: `K${number}` },
      create: {
        code: `K${number}`,
        name: `Khóa ${number}`,
        number,
        admissionYear: number + 2006,
      },
      update: {},
    });
  return departments;
}
module.exports = { seedAcademic };
if (require.main === module)
  seedAcademic()
    .then(() =>
      console.log(
        "Đã khởi tạo 3 khoa, 8 ngành, 10 chương trình và K15–K20. Các liên kết chưa đủ nguồn để Admin xác nhận.",
      ),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());

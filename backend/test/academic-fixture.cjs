const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const { seedAcademic } = require("../scripts/seed-academic.cjs");

// Legacy workflow tests use one isolated, explicitly linked academic scope.
function academicFixture() {
  const raw = new PrismaClient();
  const state = {};
  const db = raw.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (state.department) {
            const departmentId = state.department.id;
            if (
              [
                "User",
                "StudentProfile",
                "FacultyProfile",
                "CompanyProfile",
                "InternshipPeriod",
              ].includes(model)
            )
              args.data = { departmentId, ...args.data };
            if (model === "StudentProfile")
              args.data = {
                majorId: state.program.majorId,
                programId: state.program.id,
                cohortId: state.cohort.id,
                ...args.data,
              };
            if (model === "InternshipPeriod")
              args.data = {
                audience: {
                  create: [
                    {
                      majorId: state.program.majorId,
                      cohortId: state.cohort.id,
                    },
                  ],
                },
                ...args.data,
              };
          }
          return query(args);
        },
      },
    },
  });
  return {
    db,
    state,
    async setup() {
      await seedAcademic(raw);
      state.department = await raw.department.create({
        data: {
          code: `TEST-${randomUUID().slice(0, 15)}`,
          name: "Khoa kiểm thử độc lập",
        },
      });
      state.program = await raw.trainingProgram.findUniqueOrThrow({
        where: { code: "ICT1" },
      });
      state.cohort = await raw.cohort.findUniqueOrThrow({
        where: { code: "K17" },
      });
      await raw.departmentProgram.create({
        data: {
          departmentId: state.department.id,
          programId: state.program.id,
          confirmed: true,
          source: "Test fixture",
        },
      });
    },
  };
}
module.exports = { academicFixture };

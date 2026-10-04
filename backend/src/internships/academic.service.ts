import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth.types";

export const academicInclude = {
  department: true,
  academicMajor: true,
  program: true,
  academicCohort: true,
};
export const periodInclude = {
  department: true,
  audience: { include: { major: true, cohort: true, program: true } },
};
export type Audience = {
  majorId: string;
  cohortId: string;
  programId?: string | null;
};
export function matchesAudience(
  student: {
    departmentId: string | null;
    majorId: string | null;
    cohortId: string | null;
    programId: string | null;
  },
  period: { departmentId: string | null; audience: Audience[] },
) {
  return (
    !!student.departmentId &&
    !!student.majorId &&
    !!student.cohortId &&
    !!student.programId &&
    student.departmentId === period.departmentId &&
    period.audience.some(
      (g) =>
        g.majorId === student.majorId &&
        g.cohortId === student.cohortId &&
        (!g.programId || g.programId === student.programId),
    )
  );
}
export function staffDepartment(user: AuthUser) {
  if (!user.departmentId)
    throw new ForbiddenException(
      "Tài khoản cần được Admin gán khoa trước khi sử dụng nghiệp vụ.",
    );
  return user.departmentId;
}
@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService) {}
  async catalog() {
    const [departments, majors, programs, cohorts, links] = await Promise.all([
      this.prisma.department.findMany({ orderBy: { code: "asc" } }),
      this.prisma.major.findMany({ orderBy: { name: "asc" } }),
      this.prisma.trainingProgram.findMany({ orderBy: { code: "asc" } }),
      this.prisma.cohort.findMany({ orderBy: { number: "desc" } }),
      this.prisma.departmentProgram.findMany(),
    ]);
    return { departments, majors, programs, cohorts, links };
  }
  async save(kind: string, input: Record<string, unknown>, user: AuthUser) {
    if (!user.roles.includes(Role.Admin)) throw new ForbiddenException();
    const str = (key: string) => String(input[key] ?? "").trim();
    const id = str("id");
    const data = {
      code: str("code"),
      name: str("name"),
      isActive: input.isActive !== false,
    };
    if (
      kind !== "links" &&
      (!data.code ||
        data.code.length > 30 ||
        !data.name ||
        data.name.length > 160)
    )
      throw new BadRequestException("Mã và tên danh mục không hợp lệ.");
    const result = await this.prisma.$transaction(async (tx) => {
      let saved: { id: string };
      switch (kind) {
        case "departments":
          saved = id
            ? await tx.department.update({ where: { id }, data })
            : await tx.department.create({ data });
          break;
        case "majors":
          saved = id
            ? await tx.major.update({ where: { id }, data })
            : await tx.major.create({ data });
          break;
        case "programs": {
          const majorId = str("majorId");
          if (!(await tx.major.findUnique({ where: { id: majorId } })))
            throw new BadRequestException("Ngành không tồn tại.");
          if (
            id &&
            (await tx.studentProfile.count({
              where: { programId: id, majorId: { not: majorId } },
            }))
          )
            throw new BadRequestException(
              "Chương trình đã có sinh viên, không thể đổi ngành.",
            );
          if (
            id &&
            (await tx.periodAudience.count({
              where: { programId: id, majorId: { not: majorId } },
            }))
          )
            throw new BadRequestException(
              "Chương trình đã được sử dụng trong đợt thực tập.",
            );
          saved = id
            ? await tx.trainingProgram.update({
                where: { id },
                data: { ...data, majorId },
              })
            : await tx.trainingProgram.create({ data: { ...data, majorId } });
          break;
        }
        case "cohorts": {
          const number = Number(input.number),
            admissionYear = Number(input.admissionYear);
          if (
            !Number.isInteger(number) ||
            number < 1 ||
            !Number.isInteger(admissionYear) ||
            admissionYear < 2000 ||
            admissionYear > 2200
          )
            throw new BadRequestException(
              "Số khóa hoặc năm nhập học không hợp lệ.",
            );
          const cohort = { ...data, code: `K${number}`, number, admissionYear };
          saved = id
            ? await tx.cohort.update({ where: { id }, data: cohort })
            : await tx.cohort.create({ data: cohort });
          break;
        }
        case "links": {
          const source = str("source"),
            departmentId = str("departmentId"),
            programId = str("programId");
          if (!/^https:\/\//.test(source) || source.length > 1000)
            throw new BadRequestException("Cần đường dẫn nguồn xác nhận.");
          saved = await tx.departmentProgram.upsert({
            where: { departmentId_programId: { departmentId, programId } },
            create: {
              departmentId,
              programId,
              source,
              confirmed: input.confirmed === true,
            },
            update: { source, confirmed: input.confirmed === true },
          });
          break;
        }
        default:
          throw new BadRequestException("Danh mục không hợp lệ.");
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: `catalog.${kind}.save`,
          targetId: saved.id,
        },
      });
      return saved;
    });
    return result;
  }
  async studentFields(
    row: Record<string, unknown>,
    departmentId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const get = (key: string) => String(row[key] ?? "").trim();
    const program = await db.trainingProgram.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            id: get("programId") || undefined,
            code: get("programCode") || undefined,
          },
        ].filter((x) => x.id || x.code),
      },
    });
    const cohort = await db.cohort.findFirst({
      where: {
        isActive: true,
        ...(get("cohortId")
          ? { id: get("cohortId") }
          : { code: get("cohort").toUpperCase() }),
      },
    });
    if (!program || !cohort || (!get("programId") && !get("programCode")))
      throw new BadRequestException(
        "Chọn chương trình và khóa có trong danh mục.",
      );
    const link = await db.departmentProgram.findFirst({
      where: {
        departmentId,
        programId: program.id,
        confirmed: true,
        department: { isActive: true },
        program: { major: { isActive: true } },
      },
      include: { program: { include: { major: true } } },
    });
    if (!link || (get("majorId") && get("majorId") !== program.majorId))
      throw new BadRequestException(
        "Khoa–Ngành–Chương trình chưa được xác nhận hoặc không hợp lệ.",
      );
    return {
      departmentId,
      programId: program.id,
      majorId: program.majorId,
      cohortId: cohort.id,
      major: link.program.major.name,
      cohort: cohort.code,
    };
  }
  async validateAudience(departmentId: string, groups: Audience[]) {
    if (!groups.length || groups.length > 100)
      throw new BadRequestException("Chọn từ 1 đến 100 nhóm đối tượng.");
    const keys = new Set<string>();
    for (const g of groups) {
      const key = `${g.majorId}:${g.cohortId}:${g.programId || "*"}`;
      if (keys.has(key))
        throw new BadRequestException("Nhóm đối tượng bị trùng.");
      keys.add(key);
      const [cohort, program] = await Promise.all([
        this.prisma.cohort.findFirst({
          where: { id: g.cohortId, isActive: true },
        }),
        this.prisma.departmentProgram.findFirst({
          where: {
            departmentId,
            confirmed: true,
            department: { isActive: true },
            ...(g.programId ? { programId: g.programId } : {}),
            program: {
              majorId: g.majorId,
              isActive: true,
              major: { isActive: true },
            },
          },
        }),
      ]);
      if (!cohort || !program)
        throw new BadRequestException(
          "Nhóm đối tượng không thuộc chương trình được khoa quản lý.",
        );
    }
  }
}

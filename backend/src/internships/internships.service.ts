import {
  AcademicService,
  academicInclude,
  periodInclude,
  matchesAudience,
  staffDepartment,
} from "./academic.service";
import { temporaryPassword } from "../auth/temporary-password";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApplicationStatus,
  ExceptionStatus,
  ImportStatus,
  ImportType,
  PeriodStatus,
  Prisma,
  Role,
  WeeklyReportStatus,
} from "@prisma/client";
import * as ExcelJS from "exceljs";
import { hashPassword } from "../auth/password";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { checkPeriodWindow, validateSchedule } from "./period-time";
import {
  ApplicationListQueryDto,
  ProgressQueryDto,
  FacultyWorkspaceQueryDto,
  ReadinessQueryDto,
  DashboardDetailsQueryDto,
} from "./dashboard.dto";
import {
  ApproveApplicationDto,
  AssignMentorDto,
  AssignSupervisorDto,
  CreateApplicationDto,
  CreateCompanySupervisorDto,
  VerifyExternalCompanyDto,
  ChangeCompanyDto,
  AssignCoordinatorDto,
  CreateExceptionDto,
  CreatePeriodDto,
  PeriodAcademicDto,
  ReviewExceptionDto,
  ReviewWeeklyReportDto,
  ScoreDto,
  SubmitFinalReportDto,
  SubmitWeeklyReportDto,
  SupervisorScoreDto,
} from "./internships.dto";

type ImportRow = Record<string, string | number | boolean>;
const importColumns: Record<ImportType, string[]> = {
  Students: [
    "studentCode",
    "fullName",
    "email",
    "className",
    "cohort",
    "major",
    "programCode",
    "programCredits",
    "completedCredits",
    "hasMandatoryCourseDebt",
  ],
  Faculty: ["facultyCode", "fullName", "email", "expertise", "maxStudents"],
  Companies: [
    "name",
    "taxCode",
    "address",
    "website",
    "contactName",
    "contactEmail",
    "contactPhone",
  ],
};
const roleNames: Record<ImportType, string> = {
  Students: "sinh viên",
  Faculty: "giảng viên",
  Companies: "doanh nghiệp",
};

@Injectable()
export class InternshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academic: AcademicService,
  ) {}

  private require(user: AuthUser, ...roles: Role[]) {
    if (!roles.some((role) => user.roles.includes(role)))
      throw new ForbiddenException(
        "Bạn không có quyền thực hiện thao tác này.",
      );
  }
  private manage(user: AuthUser) {
    this.require(user, Role.InternshipCoordinator);
    staffDepartment(user);
  }
  private approve(user: AuthUser) {
    this.require(user, Role.FacultyManager);
  }
  private periodScope(user: AuthUser): Prisma.InternshipPeriodWhereInput {
    if (user.roles.includes(Role.FacultyManager))
      return { departmentId: staffDepartment(user) };
    if (user.roles.includes(Role.InternshipCoordinator))
      return { departmentId: staffDepartment(user), coordinatorId: user.id };
    return { id: "00000000-0000-0000-0000-000000000000" };
  }
  async requirePeriodScope(
    id: string,
    user: AuthUser,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "InternshipPeriod" WHERE "id" = ${id}::uuid FOR SHARE`;
    if (
      !(await tx.internshipPeriod.findFirst({
        where: { id, ...this.periodScope(user) },
      }))
    )
      throw new ForbiddenException("Bạn không phụ trách đợt thực tập này.");
  }
  async assignCoordinator(
    id: string,
    dto: AssignCoordinatorDto,
    user: AuthUser,
  ) {
    this.require(user, Role.FacultyManager);
    staffDepartment(user);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "InternshipPeriod" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const previous = await tx.internshipPeriod.findUnique({ where: { id } });
      if (!previous)
        throw new NotFoundException("Không tìm thấy đợt thực tập.");
      await this.requirePeriodScope(id, user, tx);
      const target = await tx.user.findFirst({
        where: {
          id: dto.coordinatorId,
          departmentId: staffDepartment(user),
          isActive: true,
          roles: { some: { role: Role.InternshipCoordinator } },
        },
      });
      if (!target)
        throw new BadRequestException("Điều phối viên không hợp lệ.");
      await tx.internshipPeriod.update({
        where: { id },
        data: { coordinatorId: target.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "period.coordinator_assign",
          targetId: id,
          reason: dto.reason,
          details: {
            previousCoordinatorId: previous.coordinatorId,
            coordinatorId: target.id,
          },
        },
      });
    });
  }
  async coordinators(user: AuthUser) {
    this.require(user, Role.FacultyManager);
    staffDepartment(user);
    return this.prisma.user.findMany({
      where: {
        departmentId: staffDepartment(user),
        isActive: true,
        roles: { some: { role: Role.InternshipCoordinator } },
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    });
  }
  private async audit(actorId: string, action: string, targetId: string) {
    await this.prisma.auditLog.create({ data: { actorId, action, targetId } });
  }

  async withUnlockedGrade<T>(
    internshipId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // All grade-related writes share this lock, including finalization.
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Internship" WHERE "id" = ${internshipId}::uuid FOR UPDATE`;
        if (!rows.length)
          throw new NotFoundException("Không tìm thấy hồ sơ thực tập.");
        if (await tx.finalGrade.findUnique({ where: { internshipId } }))
          throw new ConflictException(
            "Điểm đã chốt. Không thể thay đổi hồ sơ hoặc điểm thành phần.",
          );
        return work(tx);
      },
      { timeout: 30000 },
    );
  }

  async periods(user: AuthUser) {
    let where: Prisma.InternshipPeriodWhereInput = this.periodScope(user);
    if (
      user.roles.includes(Role.Student) &&
      !user.roles.some(
        (r) => r === Role.FacultyManager || r === Role.InternshipCoordinator,
      )
    ) {
      const student = await this.studentFor(user.id);
      where = {
        OR: [
          { applications: { some: { studentId: student.id } } },
          ...(student.departmentId &&
          student.majorId &&
          student.cohortId &&
          student.programId
            ? [
                {
                  status: PeriodStatus.Published,
                  departmentId: student.departmentId,
                  audience: {
                    some: {
                      majorId: student.majorId,
                      cohortId: student.cohortId,
                      OR: [
                        { programId: null },
                        { programId: student.programId },
                      ],
                    },
                  },
                },
              ]
            : []),
        ],
      };
    } else if (user.roles.includes(Role.FacultyMentor)) {
      where = { internships: { some: { facultyMentor: { userId: user.id } } } };
    } else if (
      user.roles.some((r) => r === Role.Company || r === Role.CompanySupervisor)
    ) {
      where = {
        internships: {
          some: {
            OR: [
              { company: { representativeUserId: user.id } },
              {
                companySupervisorAssignments: {
                  some: { supervisor: { userId: user.id } },
                },
              },
            ],
          },
        },
      };
    }
    return this.prisma.internshipPeriod.findMany({
      where,
      include: periodInclude,
      orderBy: { startsAt: "desc" },
    });
  }
  async companies(user: AuthUser) {
    return this.prisma.companyProfile.findMany({
      where: {
        isVerified: true,
        departmentId:
          user.departmentId ?? "00000000-0000-0000-0000-000000000000",
      },
      select: {
        id: true,
        name: true,
        address: true,
        website: true,
        contactName: true,
      },
      orderBy: { name: "asc" },
    });
  }
  private async requireProfileScope(type: string, id: string, user: AuthUser) {
    const departmentId = staffDepartment(user);
    const record =
      type === "students"
        ? await this.prisma.studentProfile.findFirst({
            where: { id, departmentId },
          })
        : type === "faculty"
          ? await this.prisma.facultyProfile.findFirst({
              where: { id, departmentId },
            })
          : type === "companies"
            ? await this.prisma.companyProfile.findFirst({
                where: { id, departmentId },
              })
            : null;
    if (!record)
      throw new ForbiddenException("Hồ sơ không thuộc khoa của bạn.");
  }
  async profiles(type: "students" | "faculty" | "companies", user: AuthUser) {
    this.manage(user);
    if (type === "students")
      return this.prisma.studentProfile.findMany({
        where: { departmentId: staffDepartment(user) },
        include: academicInclude,
        orderBy: { studentCode: "asc" },
      });
    if (type === "faculty")
      return this.prisma.facultyProfile.findMany({
        where: { departmentId: staffDepartment(user) },
        orderBy: { facultyCode: "asc" },
      });
    return this.prisma.companyProfile.findMany({
      where: { departmentId: staffDepartment(user) },
      orderBy: { name: "asc" },
    });
  }
  async createPeriod(dto: CreatePeriodDto, user: AuthUser) {
    return this.createPeriodInternal(dto, user);
  }
  async completePeriodAcademic(
    id: string,
    dto: PeriodAcademicDto,
    user: AuthUser,
  ) {
    this.manage(user);
    if (dto.departmentId !== staffDepartment(user))
      throw new ForbiddenException();
    const [first, last] = dto.academicYear.split("-").map(Number);
    if (last !== first + 1)
      throw new BadRequestException("Năm học phải gồm hai năm liên tiếp.");
    await this.academic.validateAudience(dto.departmentId, dto.audience);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "InternshipPeriod" WHERE "id" = ${id}::uuid FOR UPDATE`;
      await this.requirePeriodScope(id, user, tx);
      const current = await tx.internshipPeriod.findUniqueOrThrow({
        where: { id },
        include: {
          audience: true,
          applications: { include: { student: true } },
        },
      });
      if (
        current.roundNumber &&
        current.semester &&
        current.academicYear &&
        current.audience.length
      )
        throw new ConflictException(
          "Đợt đã có cấu hình học vụ; không thể thay đổi bằng thao tác hoàn thiện.",
        );
      if (current.audience.length)
        throw new ConflictException(
          "Đợt đã có đối tượng, cần đối soát dữ liệu trước khi hoàn thiện.",
        );
      if (current.applications.some((a) => !matchesAudience(a.student, dto)))
        throw new ConflictException(
          "Cần hoàn thiện hồ sơ sinh viên và chọn đối tượng bao gồm mọi đăng ký hiện có.",
        );
      const { audience, ...fields } = dto;
      const saved = await tx.internshipPeriod.update({
        where: { id },
        data: {
          ...fields,
          name: `${dto.roundNumber}_HK${dto.semester}_${dto.academicYear}`,
          audience: { create: audience },
        },
        include: periodInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "period.complete_academic",
          targetId: id,
          details: { previousName: current.name },
        },
      });
      return saved;
    });
  }
  async updatePeriod(id: string, dto: CreatePeriodDto, user: AuthUser) {
    this.manage(user);
    if (dto.departmentId !== staffDepartment(user))
      throw new ForbiddenException();
    const [first, last] = dto.academicYear.split("-").map(Number);
    if (last !== first + 1)
      throw new BadRequestException("Năm học phải gồm hai năm liên tiếp.");
    await this.academic.validateAudience(dto.departmentId, dto.audience);
    const { audience, ...fields } = dto;
    const schedule = {
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      weeklyReportCount: dto.weeklyReportCount,
      weeklyDeadlines: dto.weeklyDeadlines.map((d) => new Date(d)),
      gradingDeadline: new Date(dto.gradingDeadline),
      finalizationDeadline: new Date(dto.finalizationDeadline),
    };
    validateSchedule(schedule);
    if (!(
      new Date(dto.registrationStartsAt) < new Date(dto.registrationEndsAt) &&
      new Date(dto.registrationEndsAt) <= schedule.startsAt
    ))
      throw new BadRequestException("Lịch đăng ký không hợp lệ.");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "InternshipPeriod" WHERE "id" = ${id}::uuid FOR UPDATE`;
      await this.requirePeriodScope(id, user, tx);
      const current = await tx.internshipPeriod.findUniqueOrThrow({
        where: { id },
      });
      if (current.status !== PeriodStatus.Draft)
        throw new ConflictException("Chỉ sửa được đợt bản nháp.");
      await tx.periodAudience.deleteMany({ where: { periodId: id } });
      const saved = await tx.internshipPeriod.update({
        where: { id },
        data: {
          ...fields,
          ...schedule,
          name: `${dto.roundNumber}_HK${dto.semester}_${dto.academicYear}`,
          audience: { create: audience },
        },
        include: periodInclude,
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "period.update", targetId: id },
      });
      return saved;
    });
  }
  async saveProfile(
    type: string,
    id: string | null,
    row: ImportRow,
    user: AuthUser,
  ) {
    this.manage(user);
    if (id) await this.requireProfileScope(type, id, user);
    const kind =
      type === "students"
        ? ImportType.Students
        : type === "faculty"
          ? ImportType.Faculty
          : type === "companies"
            ? ImportType.Companies
            : null;
    if (
      !kind ||
      Object.keys(row).some(
        (key) =>
          ![
            ...importColumns[kind],
            ...(kind === ImportType.Students
              ? ["programId", "majorId", "cohortId"]
              : []),
          ].includes(key),
      ) ||
      Object.values(row).some(
        (value) => !["string", "number", "boolean"].includes(typeof value),
      )
    )
      throw new BadRequestException("Trường hồ sơ không hợp lệ.");
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );
    const errors = this.validateRows(kind, [normalized]);
    if (errors.length)
      throw new BadRequestException(errors.map((e) => e.message));
    const value = (key: string) => String(normalized[key] ?? "").trim();
    try {
      return await this.prisma.$transaction(async (tx) => {
        let saved: { id: string };
        if (kind === ImportType.Students) {
          const data = {
            ...(await this.academic.studentFields(
              normalized,
              staffDepartment(user),
              tx,
            )),
            studentCode: value("studentCode"),
            fullName: value("fullName"),
            email: value("email").toLowerCase(),
            className: value("className"),
            programCredits: Number(normalized.programCredits),
            completedCredits: Number(normalized.completedCredits),
            hasMandatoryCourseDebt:
              value("hasMandatoryCourseDebt").toLowerCase() === "true",
          };
          saved = id
            ? await tx.studentProfile.update({
                where: { id },
                data: { ...data, isVerified: false, verifiedAt: null },
              })
            : await tx.studentProfile.create({ data });
        } else if (kind === ImportType.Faculty) {
          const data = {
            departmentId: staffDepartment(user),
            facultyCode: value("facultyCode"),
            fullName: value("fullName"),
            email: value("email").toLowerCase(),
            expertise: value("expertise"),
            maxStudents: Number(normalized.maxStudents),
          };
          if (id) {
            await tx.$queryRaw`SELECT "id" FROM "FacultyProfile" WHERE "id" = ${id}::uuid FOR UPDATE`;
            if (
              (await tx.internship.count({
                where: { facultyMentorId: id, endsAt: { gte: new Date() } },
              })) > data.maxStudents
            )
              throw new ConflictException(
                "Quota mới thấp hơn số sinh viên đang hướng dẫn.",
              );
          }
          saved = id
            ? await tx.facultyProfile.update({ where: { id }, data })
            : await tx.facultyProfile.create({ data });
        } else {
          const data = {
            departmentId: staffDepartment(user),
            name: value("name"),
            taxCode: value("taxCode") || null,
            address: value("address"),
            website: value("website") || null,
            contactName: value("contactName"),
            contactEmail: value("contactEmail").toLowerCase(),
            contactPhone: value("contactPhone"),
          };
          saved = id
            ? await tx.companyProfile.update({ where: { id }, data })
            : await tx.companyProfile.create({ data });
        }
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: `profile.${id ? "update" : "create"}`,
            targetId: saved.id,
            details: { type },
          },
        });
        return saved;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Mã hoặc email đã tồn tại. Không ghi đè hồ sơ trùng.",
        );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      )
        throw new NotFoundException("Không tìm thấy hồ sơ.");
      throw error;
    }
  }
  async updateStudentContact(email: string, user: AuthUser) {
    this.require(user, Role.Student);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await tx.studentProfile.update({
          where: { userId: user.id },
          data: { email: email.trim().toLowerCase() },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "student.contact_update",
            targetId: profile.id,
          },
        });
        return { email: profile.email };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Email đã được sử dụng.");
      throw error;
    }
  }
  private async createPeriodInternal(dto: CreatePeriodDto, user: AuthUser) {
    this.manage(user);
    if (dto.departmentId !== staffDepartment(user))
      throw new ForbiddenException("Chỉ được tạo đợt trong khoa của mình.");
    const [firstYear, lastYear] = dto.academicYear.split("-").map(Number);
    if (lastYear !== firstYear + 1)
      throw new BadRequestException("Năm học phải gồm hai năm liên tiếp.");
    await this.academic.validateAudience(dto.departmentId, dto.audience);
    const { audience, ...periodData } = dto;
    const dates = [
      dto.registrationStartsAt,
      dto.registrationEndsAt,
      dto.startsAt,
      dto.endsAt,
    ].map((date) => new Date(date));
    if (
      dates.some((date) => Number.isNaN(date.getTime())) ||
      !(dates[0] < dates[1] && dates[1] <= dates[2] && dates[2] < dates[3])
    )
      throw new BadRequestException(
        "Các mốc thời gian của đợt thực tập không hợp lệ.",
      );
    const schedule = {
      startsAt: dates[2],
      endsAt: dates[3],
      weeklyReportCount: dto.weeklyReportCount,
      weeklyDeadlines: dto.weeklyDeadlines.map((value) => new Date(value)),
      gradingDeadline: new Date(dto.gradingDeadline),
      finalizationDeadline: new Date(dto.finalizationDeadline),
    };
    validateSchedule(schedule);
    const period = await this.prisma.internshipPeriod.create({
      data: {
        ...periodData,
        name: `${dto.roundNumber}_HK${dto.semester}_${dto.academicYear}`,
        audience: { create: audience },
        ...schedule,
        coordinatorId: user.roles.includes(Role.InternshipCoordinator)
          ? user.id
          : null,
        registrationStartsAt: dates[0],
        registrationEndsAt: dates[1],
        startsAt: dates[2],
        endsAt: dates[3],
      },
    });
    await this.audit(user.id, "period.create", period.id);
    return period;
  }
  async publishPeriod(id: string, user: AuthUser) {
    this.manage(user);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "InternshipPeriod" WHERE "id" = ${id}::uuid FOR UPDATE`;
      await this.requirePeriodScope(id, user, tx);
      const period = await tx.internshipPeriod.findUnique({
        where: { id },
        include: periodInclude,
      });
      if (!period || period.status !== PeriodStatus.Draft)
        throw new ConflictException("Chỉ được công bố đợt bản nháp một lần.");
      if (
        !period.coordinatorId ||
        !(await tx.user.findFirst({
          where: {
            id: period.coordinatorId,
            isActive: true,
            roles: { some: { role: Role.InternshipCoordinator } },
          },
        }))
      )
        throw new BadRequestException(
          "Cần phân công điều phối viên hoạt động trước khi công bố.",
        );
      if (
        !period.departmentId ||
        !period.roundNumber ||
        !period.semester ||
        !period.academicYear
      )
        throw new BadRequestException("Cần hoàn thiện thông tin đợt.");
      await this.academic.validateAudience(
        period.departmentId,
        period.audience,
      );
      validateSchedule(period);
      if (new Date() >= period.registrationStartsAt)
        throw new BadRequestException(
          "Phải công bố trước thời điểm mở đăng ký.",
        );
      const changed = await tx.internshipPeriod.updateMany({
        where: { id, status: PeriodStatus.Draft },
        data: { status: PeriodStatus.Published },
      });
      if (changed.count !== 1)
        throw new ConflictException("Đợt đã được công bố.");
      await tx.auditLog.create({
        data: { actorId: user.id, action: "period.publish", targetId: id },
      });
      return { ...period, status: PeriodStatus.Published };
    });
  }

  async checkDeadline(
    tx: Prisma.TransactionClient,
    internshipId: string,
    action: "weekly" | "report" | "grade" | "finalize",
    week?: number,
  ) {
    const internship = await tx.internship.findUniqueOrThrow({
      where: { id: internshipId },
      include: { period: true },
    });
    if (internship.period.status !== PeriodStatus.Published)
      throw new BadRequestException("Đợt thực tập không hoạt động.");
    checkPeriodWindow(internship.period, action, new Date(), week);
  }

  async template(type: ImportType): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Import ${roleNames[type]}`);
    sheet.columns = importColumns[type].map((key) => ({
      header: key,
      key,
      width: Math.max(18, key.length + 4),
    }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF123B70" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.addRow(
      type === ImportType.Students
        ? [
            "21000001",
            "Nguyễn Văn A",
            "sv@example.edu.vn",
            "K15-CNTT1",
            "K15",
            "Công nghệ thông tin",
            "ICT1",
            150,
            125,
            false,
          ]
        : type === ImportType.Faculty
          ? [
              "GV001",
              "Nguyễn Văn B",
              "gv@example.edu.vn",
              "Kỹ thuật phần mềm",
              10,
            ]
          : [
              "Công ty Công nghệ Mẫu",
              "0101234567",
              "Hà Nội",
              "https://example.com",
              "Trần Thị C",
              "contact@example.com",
              "0900000000",
            ],
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private normalizeCell(value: ExcelJS.CellValue): string | number | boolean {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      return value;
    if (value && typeof value === "object" && "text" in value)
      return String(value.text);
    return "";
  }
  private validateRows(type: ImportType, rows: ImportRow[]) {
    const errors: Array<{ row: number; message: string }> = [];
    const seen = new Set<string>();
    const seenEmails = new Set<string>();
    rows.forEach((row, index) => {
      const line = index + 2;
      const key =
        type === ImportType.Students
          ? String(row.studentCode || "")
          : type === ImportType.Faculty
            ? String(row.facultyCode || "")
            : String(row.taxCode || row.name || "");
      if (!key) errors.push({ row: line, message: "Thiếu mã định danh." });
      if (key && seen.has(key.toLowerCase()))
        errors.push({ row: line, message: "Trùng mã trong file import." });
      seen.add(key.toLowerCase());
      const email = String(
        type === ImportType.Companies ? row.contactEmail : row.email,
      )
        .trim()
        .toLowerCase();
      if (type !== ImportType.Companies && seenEmails.has(email))
        errors.push({ row: line, message: "Trùng email trong file import." });
      seenEmails.add(email);
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
      for (const [field, limit] of Object.entries(limits))
        if (row[field] !== undefined && String(row[field]).length > limit)
          errors.push({
            row: line,
            message: `${field} vượt quá ${limit} ký tự.`,
          });
      const required =
        type === ImportType.Students
          ? [
              "studentCode",
              "fullName",
              "email",
              "className",
              "cohort",
              "programCredits",
              "completedCredits",
              "hasMandatoryCourseDebt",
            ]
          : type === ImportType.Faculty
            ? ["facultyCode", "fullName", "email", "expertise", "maxStudents"]
            : [
                "name",
                "address",
                "contactName",
                "contactEmail",
                "contactPhone",
              ];
      if (
        required.some(
          (field) =>
            row[field] === undefined || String(row[field]).trim() === "",
        )
      )
        errors.push({ row: line, message: "Thiếu thông tin bắt buộc." });
      if (
        type === ImportType.Students &&
        !["true", "false"].includes(
          String(row.hasMandatoryCourseDebt).toLowerCase(),
        )
      )
        errors.push({
          row: line,
          message: "Nợ học phần bắt buộc phải là true hoặc false.",
        });
      if (
        type !== ImportType.Companies &&
        !/^\S+@\S+\.\S+$/.test(String(row.email || ""))
      )
        errors.push({ row: line, message: "Email không hợp lệ." });
      if (
        type === ImportType.Companies &&
        !/^\S+@\S+\.\S+$/.test(String(row.contactEmail || ""))
      )
        errors.push({ row: line, message: "Email liên hệ không hợp lệ." });
      if (
        type === ImportType.Students &&
        (!Number.isInteger(Number(row.programCredits)) ||
          !Number.isInteger(Number(row.completedCredits)) ||
          Number(row.completedCredits) > Number(row.programCredits) ||
          Number(row.completedCredits) < 0 ||
          Number(row.programCredits) < 1)
      )
        errors.push({ row: line, message: "Tín chỉ không hợp lệ." });
      if (
        type === ImportType.Faculty &&
        (!Number.isInteger(Number(row.maxStudents)) ||
          Number(row.maxStudents) < 1 ||
          Number(row.maxStudents) > 100)
      )
        errors.push({
          row: line,
          message: "Giới hạn hướng dẫn phải từ 1 đến 100.",
        });
    });
    return errors;
  }
  async previewImport(
    type: ImportType,
    file: { buffer: Buffer; originalname?: string } | undefined,
    user: AuthUser,
  ) {
    this.manage(user);
    if (!file?.buffer?.length || file.buffer.length > 1_000_000)
      throw new BadRequestException(
        "File Excel không hợp lệ hoặc vượt quá 1 MB.",
      );
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as never);
    } catch {
      throw new BadRequestException("Không đọc được file .xlsx.");
    }
    const sheet = workbook.worksheets[0];
    if (!sheet)
      throw new BadRequestException("File Excel chưa có trang dữ liệu.");
    const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
    const expected = importColumns[type];
    if (
      expected.some(
        (column, index) =>
          String(this.normalizeCell(headers[index + 1])).trim() !== column,
      )
    )
      throw new BadRequestException(
        `Mẫu import ${roleNames[type]} không đúng cột yêu cầu.`,
      );
    const rows: ImportRow[] = [];
    const lineNumbers: number[] = [];
    sheet.eachRow((row, number) => {
      if (number === 1 || row.cellCount === 0) return;
      const result: ImportRow = {};
      expected.forEach((key, index) => {
        const cell = this.normalizeCell(row.getCell(index + 1).value);
        result[key] = typeof cell === "string" ? cell.trim() : cell;
      });
      if (Object.values(result).some((value) => String(value).trim())) {
        rows.push(result);
        lineNumbers.push(number);
      }
    });
    if (!rows.length || rows.length > 500)
      throw new BadRequestException("File cần có từ 1 đến 500 dòng dữ liệu.");
    const errors = this.validateRows(type, rows);
    for (const [index, row] of rows.entries()) {
      if (type === ImportType.Students) {
        try {
          await this.academic.studentFields(row, staffDepartment(user));
        } catch (cause) {
          errors.push({
            row: index + 2,
            message:
              cause instanceof Error
                ? cause.message
                : "Thông tin học vụ không hợp lệ.",
          });
        }
      }
      const duplicate =
        type === ImportType.Students
          ? await this.prisma.studentProfile.findFirst({
              where: {
                OR: [
                  { studentCode: String(row.studentCode) },
                  { email: String(row.email).toLowerCase() },
                ],
              },
              select: { id: true },
            })
          : type === ImportType.Faculty
            ? await this.prisma.facultyProfile.findFirst({
                where: {
                  OR: [
                    { facultyCode: String(row.facultyCode) },
                    { email: String(row.email).toLowerCase() },
                  ],
                },
                select: { id: true },
              })
            : await this.prisma.companyProfile.findFirst({
                where: {
                  OR: [
                    ...(row.taxCode ? [{ taxCode: String(row.taxCode) }] : []),
                    {
                      name: String(row.name),
                      contactEmail: String(row.contactEmail).toLowerCase(),
                    },
                  ],
                },
                select: { id: true },
              });
      if (duplicate)
        errors.push({
          row: index + 2,
          message: "Mã hoặc email hồ sơ đã có trong hệ thống; không ghi đè.",
        });
    }
    for (const error of errors) error.row = lineNumbers[error.row - 2];
    const batch = await this.prisma.importBatch.create({
      data: {
        type,
        rows: rows as never,
        errors: errors as never,
        createdById: user.id,
        departmentId: staffDepartment(user),
      },
    });
    await this.audit(user.id, "import.preview", batch.id);
    return {
      batchId: batch.id,
      total: rows.length,
      valid: rows.length - new Set(errors.map((error) => error.row)).size,
      errors,
    };
  }
  async confirmImport(id: string, user: AuthUser) {
    this.manage(user);
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch || batch.status !== ImportStatus.Preview)
      throw new NotFoundException("Bản xem trước import không còn hiệu lực.");
    if (batch.createdById !== user.id)
      throw new ForbiddenException("Chỉ được xác nhận file do mình kiểm tra.");
    if (batch.departmentId !== staffDepartment(user))
      throw new ForbiddenException("Lô import không thuộc khoa hiện tại. Hãy tải lại tệp để kiểm tra trong đúng khoa.");
    const rows = batch.rows as unknown as ImportRow[];
    if (batch.type === ImportType.Students)
      for (const row of rows)
        await this.academic.studentFields(row, staffDepartment(user));
    const errors = batch.errors as unknown as Array<{ row: number }>;
    if (errors.length)
      throw new BadRequestException(
        "Hãy sửa các dòng lỗi trước khi xác nhận import.",
      );
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.importBatch.updateMany({
          where: { id, status: ImportStatus.Preview },
          data: { status: ImportStatus.Confirmed, confirmedAt: new Date() },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            "File đã được xác nhận bởi thao tác khác.",
          );
        for (const row of rows) {
          if (batch.type === ImportType.Students)
            await tx.studentProfile.create({
              data: {
                ...(await this.academic.studentFields(
                  row,
                  staffDepartment(user),
                  tx,
                )),
                importBatchId: id,
                studentCode: String(row.studentCode).trim(),
                fullName: String(row.fullName).trim(),
                email: String(row.email).trim().toLowerCase(),
                className: String(row.className).trim(),
                programCredits: Number(row.programCredits),
                completedCredits: Number(row.completedCredits),
                hasMandatoryCourseDebt:
                  String(row.hasMandatoryCourseDebt).toLowerCase() === "true",
              },
            });
          if (batch.type === ImportType.Faculty)
            await tx.facultyProfile.create({
              data: {
                departmentId: staffDepartment(user),
                importBatchId: id,
                facultyCode: String(row.facultyCode).trim(),
                fullName: String(row.fullName).trim(),
                email: String(row.email).trim().toLowerCase(),
                expertise: String(row.expertise).trim(),
                maxStudents: Number(row.maxStudents),
              },
            });
          if (batch.type === ImportType.Companies)
            await tx.companyProfile.create({
              data: {
                departmentId: staffDepartment(user),
                importBatchId: id,
                name: String(row.name).trim(),
                taxCode: String(row.taxCode).trim() || null,
                address: String(row.address).trim(),
                website: String(row.website).trim() || null,
                contactName: String(row.contactName).trim(),
                contactEmail: String(row.contactEmail).trim().toLowerCase(),
                contactPhone: String(row.contactPhone).trim(),
              },
            });
        }
        await tx.importBatch.update({
          where: { id },
          data: { status: ImportStatus.Confirmed, confirmedAt: new Date() },
        });
        await tx.auditLog.create({
          data: { actorId: user.id, action: "import.confirm", targetId: id },
        });
      });
    } catch (error) {
      if (String(error).includes("Unique constraint"))
        throw new ConflictException(
          "Dữ liệu trùng với hồ sơ đã có trong hệ thống.",
        );
      throw error;
    }
    return { imported: rows.length };
  }

  async verifyProfile(type: "student" | "company", id: string, user: AuthUser) {
    this.manage(user);
    await this.requireProfileScope(
      type === "student" ? "students" : "companies",
      id,
      user,
    );
    if (type === "student") {
      const profile = await this.prisma.studentProfile.findUniqueOrThrow({
        where: { id },
      });
      await this.academic.studentFields(profile, staffDepartment(user));
    }
    if (type === "student")
      await this.prisma.studentProfile.update({
        where: { id },
        data: { isVerified: true, verifiedAt: new Date() },
      });
    else
      await this.prisma.companyProfile.update({
        where: { id },
        data: { isVerified: true },
      });
    await this.audit(user.id, `profile.verify:${type}`, id);
  }

  private async studentFor(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!profile)
      throw new ForbiddenException("Tài khoản chưa gắn hồ sơ sinh viên.");
    return profile;
  }
  private eligibility(
    student: {
      isVerified: boolean;
      programCredits: number;
      completedCredits: number;
      hasMandatoryCourseDebt: boolean;
    },
    threshold: number,
  ) {
    if (!student.isVerified) return "Hồ sơ học vụ chưa được khoa xác minh.";
    if (student.hasMandatoryCourseDebt)
      return "Sinh viên còn nợ học phần bắt buộc.";
    if (student.completedCredits * 100 < student.programCredits * threshold)
      return `Chưa đạt ${threshold}% số tín chỉ yêu cầu.`;
    return null;
  }
  async createApplication(dto: CreateApplicationDto, user: AuthUser) {
    this.require(user, Role.Student);
    const student = await this.studentFor(user.id);
    const period = await this.prisma.internshipPeriod.findUnique({
      where: { id: dto.periodId },
      include: periodInclude,
    });
    if (!period || period.status !== PeriodStatus.Published)
      throw new BadRequestException("Đợt thực tập chưa mở.");
    if (!matchesAudience(student, period))
      throw new ForbiddenException(
        "Bạn không thuộc đối tượng của đợt thực tập này.",
      );
    const now = new Date();
    if (now < period.registrationStartsAt || now > period.registrationEndsAt)
      throw new BadRequestException("Đã ngoài thời gian đăng ký.");
    if (!dto.companyId && !dto.externalCompanyName)
      throw new BadRequestException("Hãy chọn hoặc khai báo công ty thực tập.");
    if (dto.companyId) {
      const company = await this.prisma.companyProfile.findUnique({
        where: { id: dto.companyId },
      });
      if (!company?.isVerified || company.departmentId !== period.departmentId)
        throw new BadRequestException("Công ty chưa được khoa xác minh.");
    }
    const active = await this.prisma.internship.findFirst({
      where: { studentId: student.id, endsAt: { gte: now } },
    });
    if (active)
      throw new ConflictException(
        "Sinh viên đã có một thực tập đang hiệu lực.",
      );
    const reason = this.eligibility(student, period.creditThresholdPercent);
    const application = await this.prisma.internshipApplication.create({
      data: {
        ...dto,
        studentId: student.id,
        eligibilityPassed: !reason,
        eligibilityReason: reason,
        status: ApplicationStatus.Submitted,
        submittedAt: now,
      },
    });
    await this.audit(user.id, "application.submit", application.id);
    return application;
  }
  async cancelApplication(id: string, user: AuthUser) {
    this.require(user, Role.Student);
    const student = await this.studentFor(user.id);
    const application = await this.prisma.internshipApplication.findFirst({
      where: { id, studentId: student.id },
      include: { period: true },
    });
    if (
      !application ||
      !(
        [
          ApplicationStatus.Draft,
          ApplicationStatus.Submitted,
          ApplicationStatus.NeedsRevision,
        ] as ApplicationStatus[]
      ).includes(application.status)
    )
      throw new BadRequestException("Không thể hủy hồ sơ này.");
    if (
      new Date() < application.period.registrationStartsAt ||
      new Date() > application.period.registrationEndsAt
    )
      throw new BadRequestException("Chỉ được hủy trong thời gian đăng ký.");
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.internshipApplication.updateMany({
        where: {
          id,
          studentId: student.id,
          status: {
            in: [
              ApplicationStatus.Draft,
              ApplicationStatus.Submitted,
              ApplicationStatus.NeedsRevision,
            ],
          },
        },
        data: { status: ApplicationStatus.Cancelled },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "Trạng thái hồ sơ đã thay đổi. Không thể hủy.",
        );
      await tx.auditLog.create({
        data: { actorId: user.id, action: "application.cancel", targetId: id },
      });
    });
  }
  async createException(id: string, dto: CreateExceptionDto, user: AuthUser) {
    this.require(user, Role.Student);
    const student = await this.studentFor(user.id);
    const application = await this.prisma.internshipApplication.findFirst({
      where: { id, studentId: student.id },
    });
    if (!application || application.eligibilityPassed)
      throw new BadRequestException("Hồ sơ này không cần yêu cầu ngoại lệ.");
    const result = await this.prisma.eligibilityExceptionRequest.create({
      data: { applicationId: id, reason: dto.reason },
    });
    await this.audit(user.id, "exception.create", result.id);
    return result;
  }
  async reviewException(
    id: string,
    approve: boolean,
    dto: ReviewExceptionDto,
    user: AuthUser,
  ) {
    this.approve(user);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.eligibilityExceptionRequest.updateMany({
        where: {
          id,
          status: ExceptionStatus.Pending,
          application: {
            status: ApplicationStatus.Submitted,
            period: this.periodScope(user),
          },
        },
        data: {
          status: approve ? ExceptionStatus.Approved : ExceptionStatus.Rejected,
          reviewedById: user.id,
          reviewedAt: new Date(),
          decisionNote: dto.note,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "Yêu cầu đã xử lý hoặc hồ sơ không còn chờ duyệt.",
        );
      const request = await tx.eligibilityExceptionRequest.findUniqueOrThrow({
        where: { id },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: approve ? "exception.approve" : "exception.reject",
          targetId: id,
          reason: dto.note,
        },
      });
      return request;
    });
  }
  async approveApplication(
    id: string,
    dto: ApproveApplicationDto,
    user: AuthUser,
  ) {
    this.approve(user);
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.internshipApplication.findUnique({
        where: { id },
        include: {
          student: { include: academicInclude },
          period: { include: periodInclude },
          exceptionRequest: true,
        },
      });
      if (!application || application.status !== ApplicationStatus.Submitted)
        throw new BadRequestException(
          "Hồ sơ không ở trạng thái chờ phê duyệt.",
        );
      await this.requirePeriodScope(application.periodId, user, tx);
      if (
        application.period.status !== PeriodStatus.Published ||
        new Date() <= application.period.registrationEndsAt ||
        new Date() >= application.period.endsAt
      )
        throw new BadRequestException(
          "Chỉ duyệt sau khi đóng đăng ký và trước khi kết thúc thực tập.",
        );
      if (!application.companyId)
        throw new BadRequestException(
          "Công ty tự tìm cần được xác minh trước khi phê duyệt.",
        );
      if (
        !application.eligibilityPassed &&
        application.exceptionRequest?.status !== ExceptionStatus.Approved
      )
        throw new BadRequestException(
          "Sinh viên chưa đủ điều kiện hoặc chưa được duyệt ngoại lệ.",
        );
      await tx.$queryRaw`SELECT "id" FROM "StudentProfile" WHERE "id" = ${application.studentId}::uuid FOR UPDATE`;
      const student = await tx.studentProfile.findUnique({
        where: { id: application.studentId },
        include: { user: true, ...academicInclude },
      });
      const company = await tx.companyProfile.findUnique({
        where: { id: application.companyId },
      });
      if (!student?.user?.isActive || !student.isVerified)
        throw new BadRequestException(
          "Hồ sơ phải được xác minh và tài khoản sinh viên phải hoạt động.",
        );
      if (!matchesAudience(student, application.period))
        throw new ForbiddenException(
          "Sinh viên không thuộc đối tượng của đợt.",
        );
      if (!company?.isVerified || company.departmentId !== application.period.departmentId)
        throw new BadRequestException("Doanh nghiệp chưa được xác minh.");
      const academicEligible =
        !student.hasMandatoryCourseDebt &&
        student.programCredits > 0 &&
        student.completedCredits >= 0 &&
        student.completedCredits * 100 >=
          student.programCredits * application.period.creditThresholdPercent;
      if (
        !academicEligible &&
        application.exceptionRequest?.status !== ExceptionStatus.Approved
      )
        throw new BadRequestException(
          "Điều kiện học tập đã thay đổi; cần được duyệt ngoại lệ.",
        );
      if (
        await tx.internship.findFirst({
          where: {
            studentId: application.studentId,
            endsAt: { gte: new Date() },
          },
        })
      )
        throw new ConflictException("Sinh viên đã có thực tập hiệu lực.");
      await tx.$queryRaw`SELECT "id" FROM "FacultyProfile" WHERE "id" = ${dto.facultyMentorId}::uuid FOR UPDATE`;
      const mentor = await tx.facultyProfile.findUnique({
        where: { id: dto.facultyMentorId },
      });
      if (!mentor?.isActive || mentor.departmentId !== staffDepartment(user))
        throw new BadRequestException("Giảng viên hướng dẫn không hợp lệ.");
      const count = await tx.internship.count({
        where: { facultyMentorId: mentor.id, endsAt: { gte: new Date() } },
      });
      if (count >= mentor.maxStudents)
        throw new ConflictException("Giảng viên đã đủ giới hạn hướng dẫn.");
      const snapshot = {
        departmentId: student.departmentId,
        majorId: student.majorId,
        programId: student.programId,
        cohortId: student.cohortId,
        department: student.department?.name,
        major: student.academicMajor?.name,
        program: student.program?.name,
        cohort: student.academicCohort?.code,
        audience: application.period.audience,
        verified: student.isVerified,
        accountActive: student.user.isActive,
        hasMandatoryCourseDebt: student.hasMandatoryCourseDebt,
        completedCredits: student.completedCredits,
        programCredits: student.programCredits,
        threshold: application.period.creditThresholdPercent,
        exceptionApproved:
          application.exceptionRequest?.status === ExceptionStatus.Approved,
      };
      const changed = await tx.internshipApplication.updateMany({
        where: { id, status: ApplicationStatus.Submitted },
        data: {
          status: ApplicationStatus.Approved,
          reviewedAt: new Date(),
          reviewNote: dto.note,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Trạng thái hồ sơ đã thay đổi.");
      const internship = await tx.internship.create({
        data: {
          applicationId: id,
          periodId: application.periodId,
          studentId: application.studentId,
          companyId: application.companyId,
          facultyMentorId: mentor.id,
          eligibilitySnapshot: snapshot,
          startsAt: application.period.startsAt,
          endsAt: application.period.endsAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "application.approve",
          targetId: internship.id,
        },
      });
      return internship;
    });
  }

  async companySupervisor(dto: CreateCompanySupervisorDto, user: AuthUser) {
    this.require(user, Role.Company);
    const company = await this.prisma.companyProfile.findUnique({
      where: { representativeUserId: user.id },
    });
    if (!company)
      throw new ForbiddenException("Tài khoản chưa là đại diện công ty.");
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const account = await tx.user.create({
          data: {
            fullName: dto.fullName,
            email: dto.email,
            passwordHash,
            mustChangePassword: true,
            roles: { create: { role: Role.CompanySupervisor } },
          },
        });
        const created = await tx.companySupervisorProfile.create({
          data: { userId: account.id, companyId: company.id, title: dto.title },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "company_supervisor.create",
            targetId: created.id,
          },
        });
        return created;
      });
      return { profile, temporaryPassword: password };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Email nhân viên đã được sử dụng.");
      throw error;
    }
  }
  async enableOwnSupervisor(user: AuthUser) {
    this.require(user, Role.Company);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      const company = await tx.companyProfile.findUnique({
        where: { representativeUserId: user.id },
      });
      if (!company)
        throw new ForbiddenException("Tài khoản chưa là đại diện công ty.");
      const existing = await tx.companySupervisorProfile.findUnique({
        where: { userId: user.id },
      });
      if (existing && existing.companyId !== company.id)
        throw new ConflictException("Tài khoản đã hướng dẫn tại công ty khác.");
      await tx.userRole.upsert({
        where: {
          userId_role: { userId: user.id, role: Role.CompanySupervisor },
        },
        create: { userId: user.id, role: Role.CompanySupervisor },
        update: {},
      });
      if (existing) return existing;
      const profile = await tx.companySupervisorProfile.create({
        data: {
          userId: user.id,
          companyId: company.id,
          title: "Đại diện kiêm người hướng dẫn",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "company_supervisor.self_enable",
          targetId: profile.id,
        },
      });
      return profile;
    });
  }
  private async withinChangeWindow(
    internshipId: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const internship = await client.internship.findUnique({
      where: { id: internshipId },
    });
    if (!internship)
      throw new NotFoundException("Không tìm thấy hồ sơ thực tập.");
    const now = Date.now();
    if (
      now < internship.startsAt.getTime() ||
      now >= internship.startsAt.getTime() + 7 * 24 * 60 * 60 * 1000
    )
      throw new BadRequestException(
        "Chỉ được thay đổi trong 7 ngày đầu thực tập.",
      );
    return internship;
  }
  async assignSupervisor(
    internshipId: string,
    dto: AssignSupervisorDto,
    user: AuthUser,
  ) {
    this.require(user, Role.Company);
    const internship = await this.withinChangeWindow(internshipId);
    const company = await this.prisma.companyProfile.findUnique({
      where: { representativeUserId: user.id },
    });
    const supervisor = await this.prisma.companySupervisorProfile.findUnique({
      where: { id: dto.supervisorId },
    });
    if (
      !company ||
      internship.companyId !== company.id ||
      supervisor?.companyId !== company.id
    )
      throw new ForbiddenException(
        "Không thể phân công ngoài công ty của bạn.",
      );
    await this.withUnlockedGrade(internshipId, async (tx) => {
      const current = await this.withinChangeWindow(internshipId, tx);
      if (current.companyId !== company.id)
        throw new ForbiddenException("Công ty của sinh viên đã thay đổi.");
      await tx.companySupervisorAssignment.upsert({
        where: {
          internshipId_supervisorId: {
            internshipId,
            supervisorId: dto.supervisorId,
          },
        },
        update: {},
        create: { internshipId, supervisorId: dto.supervisorId },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "company_supervisor.assign",
          targetId: internshipId,
        },
      });
    });
  }
  async changeCompany(
    internshipId: string,
    dto: ChangeCompanyDto,
    user: AuthUser,
  ) {
    this.require(user, Role.InternshipCoordinator);
    return this.withUnlockedGrade(internshipId, async (tx) => {
      const current = await this.withinChangeWindow(internshipId, tx);
      await this.requirePeriodScope(current.periodId, user, tx);
      if (current.companyId === dto.companyId)
        throw new ConflictException("Sinh viên đang thực tập tại công ty này.");
      const company = await tx.companyProfile.findUnique({
        where: { id: dto.companyId },
      });
      if (
        !company?.isVerified ||
        company.departmentId !== staffDepartment(user)
      )
        throw new BadRequestException("Công ty mới phải được xác minh.");
      const previous = await tx.internship.findUniqueOrThrow({
        where: { id: internshipId },
        include: {
          companySupervisorAssignments: true,
          supervisorEvaluations: true,
          facultyEvaluation: true,
          finalReport: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "internship.company_change",
          targetId: internshipId,
          reason: dto.reason,
          details: JSON.parse(
            JSON.stringify({
              previousCompanyId: current.companyId,
              companyId: dto.companyId,
              assignments: previous.companySupervisorAssignments,
              supervisorEvaluations: previous.supervisorEvaluations,
              facultyEvaluation: previous.facultyEvaluation,
              finalReportEvaluation: previous.finalReport
                ? {
                    score: previous.finalReport.score,
                    mentorNote: previous.finalReport.mentorNote,
                    gradedAt: previous.finalReport.gradedAt,
                  }
                : null,
            }),
          ),
        },
      });
      await tx.supervisorEvaluation.deleteMany({ where: { internshipId } });
      await tx.facultyEvaluation.deleteMany({ where: { internshipId } });
      await tx.companySupervisorAssignment.deleteMany({
        where: { internshipId },
      });
      await tx.finalReport.updateMany({
        where: { internshipId },
        data: { score: null, mentorNote: null, gradedAt: null },
      });
      await tx.internship.update({
        where: { id: internshipId },
        data: { companyId: dto.companyId },
      });
    });
  }
  async changeMentor(
    internshipId: string,
    dto: AssignMentorDto,
    user: AuthUser,
  ) {
    this.require(user, Role.InternshipCoordinator);
    await this.withinChangeWindow(internshipId);
    return this.withUnlockedGrade(internshipId, async (tx) => {
      const current = await this.withinChangeWindow(internshipId, tx);
      await this.requirePeriodScope(current.periodId, user, tx);
      if (current.facultyMentorId === dto.facultyMentorId)
        throw new ConflictException("Giảng viên này đang hướng dẫn sinh viên.");
      await tx.$queryRaw`SELECT "id" FROM "FacultyProfile" WHERE "id" = ${dto.facultyMentorId}::uuid FOR UPDATE`;
      const mentor = await tx.facultyProfile.findUnique({
        where: { id: dto.facultyMentorId },
      });
      if (!mentor?.isActive || mentor.departmentId !== staffDepartment(user))
        throw new BadRequestException("Giảng viên không hợp lệ.");
      const count = await tx.internship.count({
        where: {
          facultyMentorId: mentor.id,
          id: { not: internshipId },
          endsAt: { gte: new Date() },
        },
      });
      if (count >= mentor.maxStudents)
        throw new ConflictException("Giảng viên đã đủ giới hạn hướng dẫn.");
      const previous = await tx.internship.findUniqueOrThrow({
        where: { id: internshipId },
        include: { facultyEvaluation: true, finalReport: true },
      });
      await tx.internship.update({
        where: { id: internshipId },
        data: { facultyMentorId: mentor.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "internship.mentor_change",
          targetId: internshipId,
          reason: dto.reason,
          details: JSON.parse(
            JSON.stringify({
              previousFacultyMentorId: current.facultyMentorId,
              facultyMentorId: mentor.id,
              facultyEvaluation: previous.facultyEvaluation,
              finalReportEvaluation: previous.finalReport
                ? {
                    score: previous.finalReport.score,
                    mentorNote: previous.finalReport.mentorNote,
                    gradedAt: previous.finalReport.gradedAt,
                  }
                : null,
            }),
          ),
        },
      });
      await tx.facultyEvaluation.deleteMany({ where: { internshipId } });
      await tx.finalReport.updateMany({
        where: { internshipId },
        data: { score: null, mentorNote: null, gradedAt: null },
      });
    });
  }

  async submitWeekly(
    internshipId: string,
    dto: SubmitWeeklyReportDto,
    user: AuthUser,
  ) {
    this.require(user, Role.Student);
    const student = await this.studentFor(user.id);
    const internship = await this.prisma.internship.findFirst({
      where: { id: internshipId, studentId: student.id },
      include: { period: true },
    });
    if (!internship || dto.weekNumber > internship.period.weeklyReportCount)
      throw new BadRequestException("Tuần báo cáo không hợp lệ.");
    return this.withUnlockedGrade(internshipId, async (tx) => {
      const existing = await tx.weeklyReport.findUnique({
        where: {
          internshipId_weekNumber: { internshipId, weekNumber: dto.weekNumber },
        },
      });
      await this.checkDeadline(tx, internshipId, "weekly", dto.weekNumber);
      if (existing?.status === WeeklyReportStatus.Reviewed)
        throw new ConflictException(
          "Báo cáo đã được nhận xét. Không thể nộp lại.",
        );
      const report = await tx.weeklyReport.upsert({
        where: {
          internshipId_weekNumber: { internshipId, weekNumber: dto.weekNumber },
        },
        create: {
          internshipId,
          weekNumber: dto.weekNumber,
          content: dto.content,
        },
        update: {
          content: dto.content,
          status: WeeklyReportStatus.Submitted,
          mentorNote: null,
          submittedAt: new Date(),
          reviewedAt: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "weekly_report.submit",
          targetId: report.id,
        },
      });
      return report;
    });
  }
  async reviewWeekly(id: string, dto: ReviewWeeklyReportDto, user: AuthUser) {
    this.require(user, Role.FacultyMentor);
    const report = await this.prisma.weeklyReport.findUnique({
      where: { id },
      include: { internship: { include: { facultyMentor: true } } },
    });
    if (!report || report.internship.facultyMentor.userId !== user.id)
      throw new ForbiddenException("Bạn không được nhận xét báo cáo này.");
    return this.withUnlockedGrade(report.internshipId, async (tx) => {
      await this.checkDeadline(tx, report.internshipId, "grade");
      if (
        !(await tx.internship.findFirst({
          where: {
            id: report.internshipId,
            facultyMentor: { userId: user.id },
          },
        }))
      )
        throw new ForbiddenException("Phân công giảng viên đã thay đổi.");
      const current = await tx.weeklyReport.findUnique({ where: { id } });
      if (current?.status === WeeklyReportStatus.Reviewed)
        throw new ConflictException("Báo cáo đã được nhận xét và khóa.");
      const value = await tx.weeklyReport.update({
        where: { id },
        data: {
          status: dto.status,
          mentorNote: dto.note,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "weekly_report.review",
          targetId: id,
        },
      });
      return value;
    });
  }
  async unlockWeekly(id: string, dto: ReviewExceptionDto, user: AuthUser) {
    this.require(user, Role.InternshipCoordinator);
    const report = await this.prisma.weeklyReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Không tìm thấy báo cáo.");
    return this.withUnlockedGrade(report.internshipId, async (tx) => {
      const current = await this.withinChangeWindow(report.internshipId, tx);
      await this.requirePeriodScope(current.periodId, user, tx);
      await this.checkDeadline(
        tx,
        report.internshipId,
        "weekly",
        report.weekNumber,
      );
      const changed = await tx.weeklyReport.updateMany({
        where: { id, status: WeeklyReportStatus.Reviewed },
        data: { status: WeeklyReportStatus.NeedsRevision },
      });
      if (changed.count !== 1)
        throw new ConflictException("Chỉ mở khóa báo cáo đã được nhận xét.");
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "weekly_report.unlock",
          targetId: id,
          reason: dto.note,
        },
      });
      return { status: WeeklyReportStatus.NeedsRevision };
    });
  }
  async submitFinalReport(
    internshipId: string,
    dto: SubmitFinalReportDto,
    user: AuthUser,
  ) {
    this.require(user, Role.Student);
    const student = await this.studentFor(user.id);
    const internship = await this.prisma.internship.findFirst({
      where: { id: internshipId, studentId: student.id },
    });
    if (!internship)
      throw new ForbiddenException("Không tìm thấy thực tập của bạn.");
    return this.withUnlockedGrade(internshipId, async (tx) => {
      await this.checkDeadline(tx, internshipId, "report");
      if (await tx.facultyEvaluation.findUnique({ where: { internshipId } }))
        throw new ConflictException(
          "Giảng viên đã chấm điểm tổng hợp; không thể thay nội dung báo cáo cuối.",
        );
      const value = await tx.finalReport.upsert({
        where: { internshipId },
        create: { internshipId, content: dto.content },
        update: {
          content: dto.content,
          score: null,
          mentorNote: null,
          gradedAt: null,
          submittedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "final_report.submit",
          targetId: value.id,
        },
      });
      return value;
    });
  }
  async scoreFaculty(
    internshipId: string,
    dto: ScoreDto,
    user: AuthUser,
    report: boolean,
  ) {
    this.require(user, Role.FacultyMentor);
    const internship = await this.prisma.internship.findUnique({
      where: { id: internshipId },
      include: { facultyMentor: true },
    });
    if (!internship || internship.facultyMentor.userId !== user.id)
      throw new ForbiddenException("Bạn không được chấm thực tập này.");
    return this.withUnlockedGrade(internshipId, async (tx) => {
      if (
        !(await tx.internship.findFirst({
          where: { id: internshipId, facultyMentor: { userId: user.id } },
        }))
      )
        throw new ForbiddenException("Phân công giảng viên đã thay đổi.");
      if (
        report &&
        !(await tx.finalReport.findUnique({ where: { internshipId } }))
      )
        throw new BadRequestException("Sinh viên chưa nộp báo cáo cuối.");
      await this.checkDeadline(tx, internshipId, "grade");
      const value = report
        ? await tx.finalReport.update({
            where: { internshipId },
            data: {
              score: dto.score,
              mentorNote: dto.note,
              gradedAt: new Date(),
            },
          })
        : await tx.facultyEvaluation.upsert({
            where: { internshipId },
            create: { internshipId, score: dto.score, note: dto.note },
            update: {
              score: dto.score,
              note: dto.note,
              submittedAt: new Date(),
            },
          });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: report ? "final_report.score" : "faculty.score",
          targetId: value.id,
        },
      });
      return value;
    });
  }
  async scoreSupervisor(
    internshipId: string,
    dto: SupervisorScoreDto,
    user: AuthUser,
  ) {
    this.require(user, Role.CompanySupervisor);
    const supervisor = await this.prisma.companySupervisorProfile.findUnique({
      where: { userId: user.id },
    });
    if (
      !supervisor ||
      !(await this.prisma.companySupervisorAssignment.findUnique({
        where: {
          internshipId_supervisorId: {
            internshipId,
            supervisorId: supervisor.id,
          },
        },
      }))
    )
      throw new ForbiddenException("Bạn chưa được phân công sinh viên này.");
    const total =
      dto.discipline + dto.responsibility + dto.knowledge + dto.outcome;
    return this.withUnlockedGrade(internshipId, async (tx) => {
      await this.checkDeadline(tx, internshipId, "grade");
      if (
        !(await tx.companySupervisorAssignment.findUnique({
          where: {
            internshipId_supervisorId: {
              internshipId,
              supervisorId: supervisor.id,
            },
          },
        }))
      )
        throw new ForbiddenException("Phân công doanh nghiệp đã thay đổi.");
      const previous = await tx.supervisorEvaluation.findUnique({
        where: {
          internshipId_supervisorId: {
            internshipId,
            supervisorId: supervisor.id,
          },
        },
      });
      const value = await tx.supervisorEvaluation.upsert({
        where: {
          internshipId_supervisorId: {
            internshipId,
            supervisorId: supervisor.id,
          },
        },
        create: {
          internshipId,
          supervisorId: supervisor.id,
          ...dto,
          total,
          enteredById: user.id,
        },
        update: {
          ...dto,
          total,
          submittedAt: new Date(),
          enteredById: user.id,
          enteredOnBehalf: false,
          evidenceFileId: null,
          evidenceNote: dto.evidenceNote ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "company.score",
          targetId: value.id,
          details: previous
            ? JSON.parse(JSON.stringify({ previousEvaluation: previous }))
            : undefined,
        },
      });
      return value;
    });
  }
  private letter(total: number) {
    if (total >= 9.5) return "A+";
    if (total >= 8.5) return "A";
    if (total >= 8) return "B+";
    if (total >= 7) return "B";
    if (total >= 6.5) return "C+";
    if (total >= 5.5) return "C";
    if (total >= 5) return "D+";
    if (total >= 4) return "D";
    return "F";
  }
  async lockGrade(internshipId: string, user: AuthUser) {
    this.approve(user);
    return this.withUnlockedGrade(internshipId, async (tx) => {
      await this.checkDeadline(tx, internshipId, "finalize");
      const internship = await tx.internship.findUnique({
        where: { id: internshipId },
        include: {
          companySupervisorAssignments: true,
          supervisorEvaluations: true,
          facultyEvaluation: true,
          finalReport: true,
        },
      });
      if (internship)
        await this.requirePeriodScope(internship.periodId, user, tx);
      if (!internship?.facultyEvaluation)
        throw new BadRequestException("Chưa đủ điểm giảng viên.");
      if (
        !internship.companySupervisorAssignments.length ||
        internship.supervisorEvaluations.length !==
          internship.companySupervisorAssignments.length ||
        !internship.companySupervisorAssignments.every((assignment) =>
          internship.supervisorEvaluations.some(
            (evaluation) => evaluation.supervisorId === assignment.supervisorId,
          ),
        )
      )
        throw new BadRequestException("Chưa đủ phiếu điểm doanh nghiệp.");
      const companyScore =
        internship.supervisorEvaluations.reduce(
          (sum, item) => sum + item.total,
          0,
        ) / internship.supervisorEvaluations.length;
      const total = Number(
        (companyScore * 0.5 + internship.facultyEvaluation.score * 0.5).toFixed(
          2,
        ),
      );
      const grade = await tx.finalGrade.create({
        data: {
          internshipId,
          companyScore,
          facultyScore: internship.facultyEvaluation.score,
          finalReportScore:
            internship.finalReport?.score ?? internship.facultyEvaluation.score,
          total,
          letterGrade: this.letter(total),
          passed: total >= 5.5,
          snapshot: {
            companyScore,
            facultyScore: internship.facultyEvaluation.score,
            finalReportScore: internship.finalReport?.score ?? null,
            facultyScoreIncludesFinalReport: true,
            formula: "50/50",
            weights: { company: 0.5, faculty: 0.5 },
            companyRubric: {
              discipline: 2,
              responsibility: 2,
              knowledge: 2,
              outcome: 4,
            },
            passThreshold: 5.5,
            letterThresholds: {
              "A+": 9.5,
              A: 8.5,
              "B+": 8,
              B: 7,
              "C+": 6.5,
              C: 5.5,
              "D+": 5,
              D: 4,
              F: 0,
            },
            facultyMentorId: internship.facultyMentorId,
            finalReportFileId: internship.finalReport?.fileId ?? null,
            companyEvaluations: internship.supervisorEvaluations.map(
              (evaluation) => ({
                supervisorId: evaluation.supervisorId,
                discipline: evaluation.discipline,
                responsibility: evaluation.responsibility,
                knowledge: evaluation.knowledge,
                outcome: evaluation.outcome,
                total: evaluation.total,
                evidenceFileId: evaluation.evidenceFileId,
                enteredById: evaluation.enteredById,
                enteredOnBehalf: evaluation.enteredOnBehalf,
                evidenceNote: evaluation.evidenceNote,
              }),
            ),
          },
        },
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "grade.lock", targetId: grade.id },
      });
      return grade;
    });
  }
  async applicationReport(user: AuthUser, query: ApplicationListQueryDto) {
    this.require(user, Role.FacultyManager, Role.InternshipCoordinator);
    if (query.periodId)
      await this.requirePeriodScope(query.periodId, user, this.prisma);
    const where: Prisma.InternshipApplicationWhereInput = {
      period: {
        ...this.periodScope(user),
        ...(query.periodId ? { id: query.periodId } : {}),
      },
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            student: {
              OR: [
                {
                  studentCode: { contains: query.search, mode: "insensitive" },
                },
                { fullName: { contains: query.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction(
      [
        this.prisma.internshipApplication.count({ where }),
        this.prisma.internshipApplication.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
          select: {
            id: true,
            status: true,
            submittedAt: true,
            eligibilityPassed: true,
            student: {
              select: {
                studentCode: true,
                fullName: true,
                className: true,
                department: true,
                academicMajor: true,
                program: true,
                academicCohort: true,
              },
            },
            period: { select: { id: true, name: true, department: true } },
            company: { select: { name: true } },
            externalCompanyName: true,
          },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { total, items, page: query.page, pageSize: query.pageSize };
  }
  async dashboardDetails(user: AuthUser, query: DashboardDetailsQueryDto) {
    this.require(user, Role.FacultyManager, Role.InternshipCoordinator);
    return this.prisma.$transaction(
      async (tx) => {
        if (query.periodId)
          await this.requirePeriodScope(query.periodId, user, tx);
        const scope = {
          ...this.periodScope(user),
          ...(query.periodId ? { id: query.periodId } : {}),
        };
        const scoped = Object.keys(scope).length > 0;
        const now = new Date();
        let rows: { id: string; title: string; detail: string }[] = [];
        if (query.metric === "students") {
          const items = await tx.studentProfile.findMany({
            where: scoped ? { applications: { some: { period: scope } } } : {},
            select: { id: true, fullName: true, studentCode: true },
            orderBy: { studentCode: "asc" },
          });
          rows = items.map((i) => ({
            id: i.id,
            title: i.fullName,
            detail: i.studentCode,
          }));
        } else if (query.metric === "periods") {
          const items = await tx.internshipPeriod.findMany({
            where: scope,
            select: { id: true, name: true },
            orderBy: { id: "asc" },
          });
          rows = items.map((i) => ({
            id: i.id,
            title: i.name,
            detail: "Đợt trong phạm vi",
          }));
        } else if (query.metric === "verifiedCompanies") {
          const items = await tx.companyProfile.findMany({
            where: {
              isVerified: true,
              ...(scoped ? { applications: { some: { period: scope } } } : {}),
            },
            select: { id: true, name: true },
            orderBy: { id: "asc" },
          });
          rows = items.map((i) => ({
            id: i.id,
            title: i.name,
            detail: "Đã xác minh",
          }));
        } else if (
          ["pendingApplications", "pendingCompanies"].includes(query.metric)
        ) {
          const items = await tx.internshipApplication.findMany({
            where: {
              status: "Submitted",
              period: scope,
              ...(query.metric === "pendingCompanies"
                ? { companyId: null, externalCompanyName: { not: null } }
                : {}),
            },
            select: {
              id: true,
              externalCompanyName: true,
              student: { select: { fullName: true, studentCode: true } },
              period: { select: { name: true } },
            },
            orderBy: { id: "asc" },
          });
          rows = items.map((i) => ({
            id: i.id,
            title: i.student.fullName,
            detail: `${i.student.studentCode} · ${i.period.name}${query.metric === "pendingCompanies" ? ` · ${i.externalCompanyName}` : ""}`,
          }));
        } else if (
          ["pendingReviews", "revisionReports"].includes(query.metric)
        ) {
          const items = await tx.weeklyReport.findMany({
            where: {
              status:
                query.metric === "pendingReviews"
                  ? "Submitted"
                  : "NeedsRevision",
              internship: { period: scope },
            },
            select: {
              id: true,
              weekNumber: true,
              internship: {
                select: {
                  student: { select: { fullName: true, studentCode: true } },
                  period: { select: { name: true } },
                },
              },
            },
            orderBy: { id: "asc" },
          });
          rows = items.map((i) => ({
            id: i.id,
            title: i.internship.student.fullName,
            detail: `${i.internship.student.studentCode} · ${i.internship.period.name} · Tuần ${i.weekNumber}`,
          }));
        } else {
          const items = await tx.internship.findMany({
            where: {
              period: {
                ...scope,
                ...([
                  "lateReports",
                  "submittedLateReports",
                  "missingSchedules",
                ].includes(query.metric)
                  ? { status: "Published" as const }
                  : {}),
              },
              ...(query.metric === "activeInternships"
                ? {
                    startsAt: { lte: now },
                    endsAt: { gte: now },
                    finalGrade: null,
                  }
                : {}),
              ...(query.metric === "graded"
                ? { finalGrade: { isNot: null } }
                : {}),
            },
            select: {
              id: true,
              student: { select: { fullName: true, studentCode: true } },
              period: {
                select: {
                  name: true,
                  weeklyDeadlines: true,
                  weeklyReportCount: true,
                },
              },
              weeklyReports: {
                select: { weekNumber: true, submittedAt: true },
              },
              finalGrade: { select: { total: true, letterGrade: true } },
            },
            orderBy: { id: "asc" },
          });
          for (const i of items) {
            const title = i.student.fullName;
            const detail = `${i.student.studentCode} · ${i.period.name}`;
            const valid =
              i.period.weeklyDeadlines.length === i.period.weeklyReportCount;
            if (
              query.metric === "activeInternships" ||
              query.metric === "graded"
            )
              rows.push({
                id: i.id,
                title,
                detail: i.finalGrade
                  ? `${detail} · ${i.finalGrade.total}/10 · ${i.finalGrade.letterGrade}`
                  : detail,
              });
            else if (query.metric === "missingSchedules" && !valid)
              rows.push({ id: i.id, title, detail });
            else if (valid)
              i.period.weeklyDeadlines.forEach((deadline, index) => {
                const report = i.weeklyReports.find(
                  (r) => r.weekNumber === index + 1,
                );
                if (
                  (query.metric === "lateReports" &&
                    !report &&
                    deadline < now) ||
                  (query.metric === "submittedLateReports" &&
                    report &&
                    report.submittedAt > deadline)
                )
                  rows.push({
                    id: `${i.id}-${index + 1}`,
                    title,
                    detail: `${detail} · Tuần ${index + 1}`,
                  });
              });
          }
        }
        return {
          total: rows.length,
          items: rows.slice((query.page - 1) * 20, query.page * 20),
          page: query.page,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async readinessReport(user: AuthUser, query: ReadinessQueryDto) {
    this.require(user, Role.FacultyManager, Role.InternshipCoordinator);
    if (!query.periodId)
      throw new BadRequestException("Chọn một đợt để xem điều kiện và quota.");
    return this.prisma.$transaction(
      async (tx) => {
        await this.requirePeriodScope(query.periodId!, user, tx);
        const period = await tx.internshipPeriod.findUniqueOrThrow({
          where: { id: query.periodId },
        });
        const now = new Date();
        const catalogSource =
          query.kind === "eligibility"
            ? Prisma.sql`
        SELECT s.id, s."studentCode" AS code, s."fullName" AS name,
          CASE WHEN NOT s."isVerified" THEN 'Chưa xác minh hồ sơ'
          WHEN s."userId" IS NULL OR NOT COALESCE(u."isActive", false) THEN 'Chưa có tài khoản hoạt động'
          WHEN s."hasMandatoryCourseDebt" THEN 'Nợ học phần bắt buộc'
          WHEN s."completedCredits"::bigint * 100 < s."programCredits"::bigint * ${period.creditThresholdPercent} THEN 'Chưa đủ tín chỉ'
          WHEN EXISTS (SELECT 1 FROM "Internship" i WHERE i."studentId" = s.id AND i."endsAt" >= ${now}) THEN 'Đã có thực tập hiệu lực'
          ELSE 'Đủ điều kiện hồ sơ' END AS reason,
          s."completedCredits" AS completed, s."programCredits" AS capacity
        FROM "StudentProfile" s LEFT JOIN "User" u ON u.id = s."userId"
        WHERE s."departmentId" = ${staffDepartment(user)}::uuid
        AND s."programId" IS NOT NULL AND EXISTS (SELECT 1 FROM "PeriodAudience" a WHERE a."periodId" = ${period.id}::uuid AND a."majorId" = s."majorId" AND a."cohortId" = s."cohortId" AND (a."programId" IS NULL OR a."programId" = s."programId"))`
            : Prisma.sql`SELECT f.id, f."facultyCode" AS code, f."fullName" AS name,
          CASE WHEN (SELECT count(*) FROM "Internship" i WHERE i."facultyMentorId" = f.id AND i."endsAt" >= ${now}) >= f."maxStudents" THEN 'Đã hết quota' ELSE 'Còn quota' END AS reason,
          (SELECT count(*)::int FROM "Internship" i WHERE i."facultyMentorId" = f.id AND i."endsAt" >= ${now}) AS completed,
          f."maxStudents" AS capacity FROM "FacultyProfile" f WHERE f."isActive" = true AND f."departmentId" = ${staffDepartment(user)}::uuid`;
        const search = `%${(query.search ?? "").trim().replace(/[\\%_]/g, "\\$&")}%`;
        const source = Prisma.sql`SELECT * FROM (${catalogSource}) catalog WHERE code ILIKE ${search} OR name ILIKE ${search}`;
        const ready =
          query.kind === "eligibility" ? "Đủ điều kiện hồ sơ" : "Còn quota";
        const condition =
          query.filter === "all"
            ? Prisma.sql`true`
            : query.filter === "ready"
              ? Prisma.sql`reason = ${ready}`
              : Prisma.sql`reason <> ${ready}`;
        const summary = await tx.$queryRaw<
          { total: number; ready: number; blocked: number }[]
        >(
          Prisma.sql`WITH records AS (${source}) SELECT count(*)::int AS total, count(*) FILTER (WHERE reason = ${ready})::int AS ready, count(*) FILTER (WHERE reason <> ${ready})::int AS blocked FROM records`,
        );
        const items = await tx.$queryRaw<
          {
            id: string;
            code: string;
            name: string;
            reason: string;
            completed: number;
            capacity: number;
          }[]
        >(
          Prisma.sql`WITH records AS (${source}) SELECT * FROM records WHERE ${condition} ORDER BY code, id LIMIT 20 OFFSET ${(query.page - 1) * 20}`,
        );
        return {
          items,
          summary: summary[0],
          total:
            query.filter === "all"
              ? summary[0].total
              : summary[0][query.filter],
          page: query.page,
          threshold: period.creditThresholdPercent,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async progressReport(user: AuthUser, query: ProgressQueryDto) {
    this.require(user, Role.FacultyManager, Role.InternshipCoordinator);
    return this.prisma.$transaction(
      async (tx) => {
        if (query.periodId)
          await this.requirePeriodScope(query.periodId, user, tx);
        const base: Prisma.InternshipWhereInput = {
          period: {
            ...this.periodScope(user),
            ...(query.periodId ? { id: query.periodId } : {}),
          },
          ...(query.search?.trim()
            ? {
                student: {
                  OR: [
                    {
                      studentCode: {
                        contains: query.search.trim(),
                        mode: "insensitive",
                      },
                    },
                    {
                      fullName: {
                        contains: query.search.trim(),
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              }
            : {}),
        };
        const missingCompanyIds = await tx.$queryRaw<{ id: string }[]>`
      SELECT i.id FROM "Internship" i WHERE NOT EXISTS (SELECT 1 FROM "FinalGrade" g WHERE g."internshipId" = i.id)
      AND (NOT EXISTS (SELECT 1 FROM "CompanySupervisorAssignment" a WHERE a."internshipId" = i.id)
      OR EXISTS (SELECT 1 FROM "CompanySupervisorAssignment" a WHERE a."internshipId" = i.id AND NOT EXISTS
        (SELECT 1 FROM "SupervisorEvaluation" e WHERE e."internshipId" = i.id AND e."supervisorId" = a."supervisorId")))`;
        const filters: Record<string, Prisma.InternshipWhereInput> = {
          all: {},
          graded: { finalGrade: { isNot: null } },
          passed: { finalGrade: { is: { passed: true } } },
          failed: { finalGrade: { is: { passed: false } } },
          missingFaculty: { finalGrade: null, facultyEvaluation: null },
          missingCompany: {
            id: { in: missingCompanyIds.map((item) => item.id) },
            finalGrade: null,
          },
        };
        const where = { ...base, ...filters[query.filter] };
        const [
          total,
          items,
          all,
          graded,
          passed,
          failed,
          missingFaculty,
          missingCompany,
        ] = await Promise.all([
          tx.internship.count({ where }),
          tx.internship.findMany({
            where,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            select: {
              id: true,
              student: { select: { fullName: true, studentCode: true } },
              period: {
                select: {
                  name: true,
                  weeklyReportCount: true,
                  weeklyDeadlines: true,
                },
              },
              company: { select: { name: true } },
              facultyMentor: { select: { fullName: true } },
              weeklyReports: {
                select: { weekNumber: true, status: true, submittedAt: true },
              },
              facultyEvaluation: { select: { score: true } },
              companySupervisorAssignments: { select: { supervisorId: true } },
              supervisorEvaluations: {
                select: { supervisorId: true, total: true },
              },
              finalGrade: {
                select: {
                  total: true,
                  letterGrade: true,
                  passed: true,
                  companyScore: true,
                  facultyScore: true,
                },
              },
            },
          }),
          ...[
            "all",
            "graded",
            "passed",
            "failed",
            "missingFaculty",
            "missingCompany",
          ].map((filter) =>
            tx.internship.count({
              where: { ...base, ...filters[filter] },
            }),
          ),
        ]);
        const now = new Date();
        return {
          total,
          page: query.page,
          pageSize: query.pageSize,
          summary: {
            all,
            graded,
            passed,
            failed,
            missingFaculty,
            missingCompany,
          },
          items: items.map((item) => {
            const validSchedule =
              item.period.weeklyDeadlines.length ===
              item.period.weeklyReportCount;
            const votes = item.companySupervisorAssignments
              .map((a) =>
                item.supervisorEvaluations.find(
                  (v) => v.supervisorId === a.supervisorId,
                ),
              )
              .filter((v) => v !== undefined);
            return {
              id: item.id,
              student: item.student,
              periodName: item.period.name,
              companyName: item.company?.name ?? null,
              mentorName: item.facultyMentor.fullName,
              weeks: item.period.weeklyReportCount,
              submittedWeeks: item.weeklyReports.length,
              reviewedWeeks: item.weeklyReports.filter(
                (r) => r.status === "Reviewed",
              ).length,
              missingSchedule: !validSchedule,
              overdueWeeks: validSchedule
                ? item.period.weeklyDeadlines.filter(
                    (deadline, index) =>
                      deadline < now &&
                      !item.weeklyReports.some(
                        (r) => r.weekNumber === index + 1,
                      ),
                  ).length
                : null,
              companyVotes: votes.length,
              expectedVotes: item.companySupervisorAssignments.length,
              companyScore:
                item.finalGrade?.companyScore ??
                (votes.length > 0 &&
                votes.length === item.companySupervisorAssignments.length
                  ? votes.reduce((sum, vote) => sum + vote.total, 0) /
                    votes.length
                  : null),
              facultyScore:
                item.finalGrade?.facultyScore ??
                item.facultyEvaluation?.score ??
                null,
              finalGrade: item.finalGrade,
            };
          }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async internshipAudit(user: AuthUser, id: string) {
    this.require(user, Role.FacultyManager, Role.InternshipCoordinator);
    return this.prisma.$transaction(
      async (tx) => {
        const item = await tx.internship.findUnique({
          where: { id },
          select: { periodId: true, weeklyReports: { select: { id: true } } },
        });
        if (!item)
          throw new ForbiddenException("Không được xem lịch sử hồ sơ này.");
        await this.requirePeriodScope(item.periodId, user, tx);
        return tx.auditLog.findMany({
          where: {
            OR: [
              {
                targetId: id,
                action: {
                  in: [
                    "internship.company_change",
                    "internship.mentor_change",
                    "company.score_on_behalf",
                  ],
                },
              },
              {
                targetId: { in: item.weeklyReports.map((r) => r.id) },
                action: "weekly_report.unlock",
              },
            ],
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          select: {
            id: true,
            action: true,
            reason: true,
            createdAt: true,
            actor: { select: { fullName: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async exportReport(
    user: AuthUser,
    type: "applications" | "progress",
    query: ApplicationListQueryDto | ProgressQueryDto,
  ) {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet(
      type === "applications" ? "Dang ky" : "Tien do ket qua",
    );
    let rows: (string | number | Date | null)[][];
    let headers: string[];
    if (type === "applications") {
      const result = await this.applicationReport(user, {
        ...query,
        page: 1,
        pageSize: 10001,
      } as ApplicationListQueryDto);
      if (result.total > 10000)
        throw new BadRequestException(
          "Tối đa 10.000 hồ sơ mỗi lần xuất. Hãy thu hẹp bộ lọc.",
        );
      headers = [
        "Mã sinh viên",
        "Họ tên",
        "Lớp",
        "Khoa",
        "Ngành",
        "Chương trình",
        "Khóa",
        "Đợt",
        "Doanh nghiệp",
        "Điều kiện lúc đăng ký",
        "Trạng thái",
        "Ngày gửi",
      ];
      const labels: Record<string, string> = {
        Draft: "Bản nháp",
        Submitted: "Chờ phê duyệt",
        NeedsRevision: "Cần bổ sung",
        Approved: "Đã duyệt",
        Rejected: "Từ chối",
        Cancelled: "Đã hủy",
      };
      rows = result.items.map((item) => [
        item.student.studentCode,
        item.student.fullName,
        item.student.className,
        item.student.department?.name ?? "",
        item.student.academicMajor?.name ?? "",
        item.student.program?.name ?? "",
        item.student.academicCohort?.code ?? "",
        item.period.name,
        item.company?.name ?? item.externalCompanyName,
        item.eligibilityPassed ? "Đủ điều kiện" : "Chưa đủ điều kiện",
        labels[item.status],
        item.submittedAt,
      ]);
    } else {
      const result = await this.progressReport(user, {
        ...query,
        page: 1,
        pageSize: 10001,
      } as ProgressQueryDto);
      if (result.total > 10000)
        throw new BadRequestException(
          "Tối đa 10.000 hồ sơ mỗi lần xuất. Hãy thu hẹp bộ lọc.",
        );
      headers = [
        "Mã sinh viên",
        "Họ tên",
        "Đợt",
        "Doanh nghiệp",
        "Giảng viên",
        "Số tuần",
        "Đã nộp",
        "Đã nhận xét",
        "Quá hạn chưa nộp",
        "Lịch tuần",
        "Phiếu đã chấm",
        "Phiếu cần có",
        "Điểm doanh nghiệp",
        "Điểm giảng viên",
        "Tổng đã chốt",
        "Điểm chữ",
        "Kết quả",
      ];
      rows = result.items.map((item) => [
        item.student.studentCode,
        item.student.fullName,
        item.periodName,
        item.companyName,
        item.mentorName,
        item.weeks,
        item.submittedWeeks,
        item.reviewedWeeks,
        item.overdueWeeks,
        item.missingSchedule ? "Thiếu lịch" : "Đủ lịch",
        item.companyVotes,
        item.expectedVotes,
        item.companyScore,
        item.facultyScore,
        item.finalGrade?.total ?? null,
        item.finalGrade?.letterGrade ?? null,
        item.finalGrade
          ? item.finalGrade.passed
            ? "Đạt"
            : "Không đạt"
          : "Chưa chốt",
      ]);
    }
    sheet.columns = headers.map((header) => ({
      header,
      width: /Họ tên|Doanh nghiệp|Giảng viên|Đợt/.test(header) ? 30 : 22,
    }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334E68" },
    };
    sheet.getRow(1).height = 32;
    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: headers.length },
    };
    if (type === "applications") sheet.getColumn(8).numFmt = "dd/mm/yyyy hh:mm";
    else for (const col of [13, 14, 15]) sheet.getColumn(col).numFmt = "0.00";
    return book.xlsx.writeBuffer();
  }
  async dashboard(user: AuthUser, periodId?: string) {
    const now = new Date();
    if (periodId) await this.requirePeriodScope(periodId, user, this.prisma);
    const scope = {
      ...this.periodScope(user),
      ...(periodId ? { id: periodId } : {}),
    };
    const scoped = Object.keys(scope).length > 0;
    this.require(user, Role.FacultyManager, Role.InternshipCoordinator);
    const [
      students,
      periods,
      pendingApplications,
      activeInternships,
      verifiedCompanies,
      revisionReports,
      grades,
      reportSchedules,
      pendingReviews,
      pendingCompanies,
    ] = await this.prisma.$transaction(
      [
        this.prisma.studentProfile.count({
          where: scoped ? { applications: { some: { period: scope } } } : {},
        }),
        this.prisma.internshipPeriod.count({ where: scope }),
        this.prisma.internshipApplication.count({
          where: { status: ApplicationStatus.Submitted, period: scope },
        }),
        this.prisma.internship.count({
          where: {
            startsAt: { lte: now },
            endsAt: { gte: now },
            finalGrade: null,
            period: scope,
          },
        }),
        this.prisma.companyProfile.count({
          where: {
            isVerified: true,
            ...(scoped ? { applications: { some: { period: scope } } } : {}),
          },
        }),
        this.prisma.weeklyReport.count({
          where: {
            status: WeeklyReportStatus.NeedsRevision,
            internship: { period: scope },
          },
        }),
        this.prisma.finalGrade.aggregate({
          where: { internship: { period: scope } },
          _avg: { total: true },
          _count: true,
        }),
        this.prisma.internship.findMany({
          where: { period: { status: "Published", ...scope } },
          select: {
            period: {
              select: { weeklyDeadlines: true, weeklyReportCount: true },
            },
            weeklyReports: { select: { weekNumber: true, submittedAt: true } },
          },
        }),
        this.prisma.weeklyReport.count({
          where: {
            status: WeeklyReportStatus.Submitted,
            internship: { period: scope },
          },
        }),
        this.prisma.internshipApplication.count({
          where: {
            period: scope,
            status: "Submitted",
            companyId: null,
            externalCompanyName: { not: null },
          },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    let lateReports = 0;
    let submittedLateReports = 0;
    let missingSchedules = 0;
    for (const item of reportSchedules) {
      if (
        item.period.weeklyDeadlines.length !== item.period.weeklyReportCount
      ) {
        missingSchedules++;
        continue;
      }
      item.period.weeklyDeadlines.forEach((deadline, index) => {
        const report = item.weeklyReports.find(
          (r) => r.weekNumber === index + 1,
        );
        if (!report && deadline < now) lateReports++;
        if (report && report.submittedAt > deadline) submittedLateReports++;
      });
    }
    return {
      scope: periodId
        ? "Đợt thực tập đang chọn"
        : scoped
          ? "Các đợt được phân công phụ trách"
          : "Trường Công nghệ Thông tin Phenikaa",
      students,
      periods,
      pendingApplications,
      activeInternships,
      verifiedCompanies,
      lateReports,
      submittedLateReports,
      revisionReports,
      pendingReviews,
      missingSchedules,
      graded: grades._count,
      pendingCompanies,
      averageGrade: grades._avg.total,
    };
  }
  async externalApplications(user: AuthUser) {
    this.manage(user);
    return this.prisma.internshipApplication.findMany({
      where: {
        period: this.periodScope(user),
        status: ApplicationStatus.Submitted,
        companyId: null,
        externalCompanyName: { not: null },
      },
      select: {
        id: true,
        externalCompanyName: true,
        externalCompanyContact: true,
        externalCompanyEmail: true,
        student: { select: { fullName: true, studentCode: true } },
        period: { select: { name: true } },
      },
      orderBy: { submittedAt: "asc" },
    });
  }
  async verifyExternalCompany(
    id: string,
    dto: VerifyExternalCompanyDto,
    user: AuthUser,
  ) {
    this.manage(user);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "InternshipApplication" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const application = await tx.internshipApplication.findUnique({
          where: { id },
        });
        if (application)
          await this.requirePeriodScope(application.periodId, user, tx);
        if (
          !application ||
          application.status !== ApplicationStatus.Submitted ||
          application.companyId ||
          !application.externalCompanyName
        )
          throw new ConflictException(
            "Hồ sơ không còn chờ xác minh công ty tự tìm.",
          );
        const { note, ...details } = dto;
        const email = details.contactEmail.trim().toLowerCase();
        const existing = await tx.companyProfile.findUnique({
          where: {
            name_contactEmail: { name: details.name, contactEmail: email },
          },
        });
        if (existing && existing.departmentId !== staffDepartment(user))
          throw new ForbiddenException("Công ty thuộc phạm vi khoa khác.");
        if (existing && !existing.isVerified)
          throw new ConflictException(
            "Công ty đã có hồ sơ chưa xác minh. Hãy xác minh hồ sơ công ty trước rồi thử lại.",
          );
        const company =
          existing ??
          (await tx.companyProfile.create({
            data: {
              ...details,
              departmentId: staffDepartment(user),
              contactEmail: email,
              isVerified: true,
            },
          }));
        const updated = await tx.internshipApplication.update({
          where: { id },
          data: { companyId: company.id },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "application.verify_company",
            targetId: id,
            reason: note,
          },
        });
        return updated;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Công ty vừa được tạo từ hồ sơ khác. Vui lòng thử lại để liên kết.",
        );
      throw error;
    }
  }
  async rejectApplication(id: string, dto: ReviewExceptionDto, user: AuthUser) {
    this.approve(user);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.internshipApplication.updateMany({
        where: {
          id,
          status: ApplicationStatus.Submitted,
          period: this.periodScope(user),
        },
        data: {
          status: ApplicationStatus.Rejected,
          reviewNote: dto.note,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Hồ sơ không còn chờ phê duyệt.");
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "application.reject",
          targetId: id,
          reason: dto.note,
        },
      });
      return { status: ApplicationStatus.Rejected };
    });
  }
  async facultyWorkspace(
    user: AuthUser,
    query: FacultyWorkspaceQueryDto = new FacultyWorkspaceQueryDto(),
  ) {
    this.require(user, Role.FacultyManager, Role.InternshipCoordinator);
    if (query.periodId)
      await this.requirePeriodScope(query.periodId, user, this.prisma);
    const scope = {
      ...this.periodScope(user),
      ...(query.periodId ? { id: query.periodId } : {}),
    };
    const [
      applications,
      faculty,
      internships,
      applicationTotal,
      internshipTotal,
    ] = await this.prisma.$transaction(
      [
        this.prisma.internshipApplication.findMany({
          where: {
            status: ApplicationStatus.Submitted,
            period: scope,
            ...(query.view === "exceptions"
              ? { exceptionRequest: { status: ExceptionStatus.Pending } }
              : {}),
          },
          skip: (query.applicationPage - 1) * 20,
          take: 20,
          include: {
            student: {
              select: {
                fullName: true,
                studentCode: true,
                completedCredits: true,
                programCredits: true,
              },
            },
            company: { select: { name: true, isVerified: true } },
            period: { select: { name: true } },
            exceptionRequest: true,
          },
          orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        }),
        this.prisma.facultyProfile.findMany({
          where: { isActive: true, departmentId: staffDepartment(user) },
          select: {
            id: true,
            fullName: true,
            maxStudents: true,
            _count: {
              select: {
                supervisedInternships: {
                  where: { endsAt: { gte: new Date() } },
                },
              },
            },
          },
          orderBy: { fullName: "asc" },
        }),
        this.prisma.internship.findMany({
          where: { period: scope },
          skip: (query.internshipPage - 1) * 20,
          take: 20,
          select: {
            id: true,
            student: { select: { fullName: true, studentCode: true } },
            period: { select: { name: true } },
            facultyEvaluation: { select: { score: true } },
            startsAt: true,
            company: { select: { id: true, name: true } },
            weeklyReports: {
              select: { id: true, weekNumber: true, status: true },
            },
            companySupervisorAssignments: {
              select: {
                supervisorId: true,
                supervisor: {
                  select: { user: { select: { fullName: true } } },
                },
              },
            },
            supervisorEvaluations: {
              select: {
                supervisorId: true,
                total: true,
                enteredOnBehalf: true,
                evidenceFileId: true,
              },
            },
            finalGrade: { select: { total: true, letterGrade: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        }),
        this.prisma.internshipApplication.count({
          where: {
            status: ApplicationStatus.Submitted,
            period: scope,
            ...(query.view === "exceptions"
              ? { exceptionRequest: { status: ExceptionStatus.Pending } }
              : {}),
          },
        }),
        this.prisma.internship.count({ where: { period: scope } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      applications,
      applicationTotal,
      internshipTotal,
      faculty: faculty.map((item) => ({
        ...item,
        _count: { internships: item._count.supervisedInternships },
      })),
      internships,
    };
  }
  async companyWorkspace(user: AuthUser) {
    this.require(user, Role.Company, Role.CompanySupervisor);
    const company = user.roles.includes(Role.Company)
      ? await this.prisma.companyProfile.findUnique({
          where: { representativeUserId: user.id },
          select: { id: true, name: true },
        })
      : null;
    const own = user.roles.includes(Role.CompanySupervisor)
      ? await this.prisma.companySupervisorProfile.findUnique({
          where: { userId: user.id },
        })
      : null;
    const companyId = company?.id ?? own?.companyId;
    if (!companyId)
      return {
        company: null,
        supervisorId: null,
        canManage: false,
        supervisors: [],
        internships: [],
      };
    const supervisors = company
      ? await this.prisma.companySupervisorProfile.findMany({
          where: { companyId },
          select: {
            id: true,
            title: true,
            user: { select: { fullName: true, email: true } },
          },
        })
      : [];
    const internships = await this.prisma.internship.findMany({
      where: {
        companyId,
        ...(company
          ? {}
          : {
              companySupervisorAssignments: { some: { supervisorId: own!.id } },
            }),
      },
      select: {
        id: true,
        startsAt: true,
        student: { select: { fullName: true, studentCode: true } },
        period: { select: { name: true } },
        companySupervisorAssignments: { select: { supervisorId: true } },
        supervisorEvaluations: {
          where: company ? {} : { supervisorId: own!.id },
          select: {
            supervisorId: true,
            discipline: true,
            responsibility: true,
            knowledge: true,
            outcome: true,
            total: true,
          },
        },
        finalGrade: { select: { total: true, letterGrade: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      company:
        company ??
        (await this.prisma.companyProfile.findUnique({
          where: { id: companyId },
          select: { id: true, name: true },
        })),
      supervisorId: own?.id ?? null,
      canManage: !!company,
      supervisors,
      internships,
    };
  }
  async mine(user: AuthUser) {
    if (user.roles.includes(Role.Student)) {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: academicInclude,
      });
      if (!profile) return { profile: null, internships: [], applications: [] };
      const [internships, applications] = await this.prisma.$transaction([
        this.prisma.internship.findMany({
          where: { studentId: profile.id },
          include: {
            company: true,
            facultyMentor: true,
            period: true,
            finalGrade: true,
            weeklyReports: true,
            finalReport: true,
            facultyEvaluation: { select: { score: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.internshipApplication.findMany({
          where: { studentId: profile.id },
          include: { period: true, company: true, exceptionRequest: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return { profile, internships, applications };
    }
    if (user.roles.includes(Role.FacultyMentor)) {
      const profile = await this.prisma.facultyProfile.findUnique({
        where: { userId: user.id },
      });
      return {
        profile,
        internships: profile
          ? await this.prisma.internship.findMany({
              where: { facultyMentorId: profile.id },
              include: {
                student: {
                  select: {
                    studentCode: true,
                    fullName: true,
                    className: true,
                  },
                },
                company: { select: { name: true } },
                period: true,
                weeklyReports: { orderBy: { weekNumber: "asc" } },
                finalReport: true,
                facultyEvaluation: true,
                finalGrade: true,
              },
              orderBy: { createdAt: "desc" },
            })
          : [],
      };
    }
    return { internships: [] };
  }
}

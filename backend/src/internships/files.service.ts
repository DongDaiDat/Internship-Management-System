import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrivateStorage } from "./private-storage";
import { PDFDocument } from "pdf-lib";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { InternshipsService } from "./internships.service";
import { AuthUser } from "../auth/auth.types";
import { ProxyScoreDto } from "./files.dto";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
type Upload = { buffer: Buffer; originalname: string };
@Injectable()
export class FilesService {
  private client() {
    if (!process.env.MINIO_ROOT_USER || !process.env.MINIO_ROOT_PASSWORD)
      throw new ServiceUnavailableException("Chưa cấu hình kho tệp.");
    return new PrivateStorage({
      endPoint: process.env.MINIO_ENDPOINT || "minio",
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ROOT_USER,
      secretKey: process.env.MINIO_ROOT_PASSWORD,
    });
  }
  constructor(
    private readonly db: PrismaService,
    private readonly internships: InternshipsService,
  ) {}
  async validate(file?: Upload) {
    if (!file || file.buffer.length > MAX_PDF_BYTES || !file.buffer.length)
      throw new BadRequestException("Chọn tệp PDF tối đa 10 MB.");
    if (
      !/\.pdf$/i.test(file.originalname) ||
      file.buffer.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new BadRequestException("Tệp phải là PDF hợp lệ.");
    try {
      const pdf = await PDFDocument.load(file.buffer, {
        throwOnInvalidObject: true,
      });
      if (pdf.getPageCount() < 1) throw new Error("empty");
    } catch {
      throw new BadRequestException(
        "PDF bị lỗi hoặc có mật khẩu. Hãy chọn PDF đọc được.",
      );
    }
  }
  private async put(file: Upload) {
    const bucket = new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")
      ? "internship-files-test"
      : "internship-files";
    const objectKey = `${randomUUID()}.pdf`;
    const client = this.client();
    try {
      if (!(await client.bucketExists(bucket))) {
        try {
          await client.makeBucket(bucket);
        } catch (error) {
          if (!(await client.bucketExists(bucket))) throw error;
        }
      }
      // Fail closed if someone configured anonymous access on this bucket.
      const policy = await client
        .getBucketPolicy(bucket)
        .catch((error: { code?: string }) => {
          if (error.code === "NoSuchBucketPolicy") return "";
          throw error;
        });
      if (policy) throw new Error("Bucket must have no public policy");
      await client.putObject(
        bucket,
        objectKey,
        file.buffer,
        file.buffer.length,
        { "Content-Type": "application/pdf" },
      );
      return {
        bucket,
        objectKey,
        size: file.buffer.length,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
        originalName: file.originalname
          .replace(/[\x00-\x1f\x7f/\\]/g, "_")
          .slice(-180),
      };
    } catch {
      throw new ServiceUnavailableException(
        "Kho tệp chưa sẵn sàng hoặc không ở chế độ riêng tư.",
      );
    }
  }
  async upload(
    internshipId: string,
    kind: "weekly" | "final" | "evidence",
    file: Upload | undefined,
    user: AuthUser,
    weekNumber?: number,
    supervisorId?: string,
    score?: ProxyScoreDto,
  ) {
    await this.validate(file);
    let stored: { bucket: string; objectKey: string } | undefined;
    try {
      return await this.internships.withUnlockedGrade(
        internshipId,
        async (tx) => {
          const internship = await tx.internship.findUniqueOrThrow({
            where: { id: internshipId },
            include: { student: true, facultyEvaluation: true },
          });
          if (kind === "evidence") {
            if (!user.roles.some((r) => r === "InternshipCoordinator"))
              throw new ForbiddenException(
                "Chỉ khoa được nhập phiếu thay doanh nghiệp.",
              );
            await this.internships.requirePeriodScope(
              internship.periodId,
              user,
              tx,
            );
            if (
              !supervisorId ||
              !score ||
              !(await tx.companySupervisorAssignment.findUnique({
                where: {
                  internshipId_supervisorId: { internshipId, supervisorId },
                },
              }))
            )
              throw new BadRequestException(
                "Người hướng dẫn chưa được phân công.",
              );
            await this.internships.checkDeadline(tx, internshipId, "grade");
          } else {
            if (
              !user.roles.includes("Student") ||
              internship.student.userId !== user.id
            )
              throw new ForbiddenException(
                "Chỉ được nộp báo cáo của chính mình.",
              );
            await this.internships.checkDeadline(
              tx,
              internshipId,
              kind === "weekly" ? "weekly" : "report",
              weekNumber,
            );
            if (kind === "weekly") {
              if (!weekNumber || !Number.isInteger(weekNumber))
                throw new BadRequestException("Tuần không hợp lệ.");
              const report = await tx.weeklyReport.findUnique({
                where: {
                  internshipId_weekNumber: { internshipId, weekNumber },
                },
              });
              if (!report || report.status === "Reviewed")
                throw new BadRequestException(
                  "Lưu nội dung báo cáo trước; báo cáo đã nhận xét không được thay tệp.",
                );
            } else if (
              internship.facultyEvaluation ||
              !(await tx.finalReport.findUnique({ where: { internshipId } }))
            )
              throw new BadRequestException(
                "Lưu báo cáo cuối trước; báo cáo đã chấm không được thay tệp.",
              );
          }
          const metadata = await this.put(file!);
          stored = metadata;
          const document = await tx.fileDocument.create({
            data: {
              ...metadata,
              internshipId,
              companyId: internship.companyId!,
              uploadedById: user.id,
              kind,
              weekNumber,
              supervisorId,
            },
          });
          if (kind === "weekly")
            await tx.weeklyReport.update({
              where: {
                internshipId_weekNumber: {
                  internshipId,
                  weekNumber: weekNumber!,
                },
              },
              data: {
                fileId: document.id,
                submittedAt: new Date(),
                status: "Submitted",
                mentorNote: null,
                reviewedAt: null,
              },
            });
          if (kind === "final")
            await tx.finalReport.update({
              where: { internshipId },
              data: { fileId: document.id, submittedAt: new Date() },
            });
          let previous = null;
          if (kind === "evidence") {
            previous = await tx.supervisorEvaluation.findUnique({
              where: {
                internshipId_supervisorId: {
                  internshipId,
                  supervisorId: supervisorId!,
                },
              },
            });
            const { discipline, responsibility, knowledge, outcome, reason } =
              score!;
            const data = {
              discipline,
              responsibility,
              knowledge,
              outcome,
              total: discipline + responsibility + knowledge + outcome,
              evidenceNote: reason,
              evidenceFileId: document.id,
              enteredById: user.id,
              enteredOnBehalf: true,
              submittedAt: new Date(),
            };
            await tx.supervisorEvaluation.upsert({
              where: {
                internshipId_supervisorId: {
                  internshipId,
                  supervisorId: supervisorId!,
                },
              },
              create: { ...data, internshipId, supervisorId },
              update: data,
            });
          }
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action:
                kind === "evidence"
                  ? "company.score_on_behalf"
                  : "report.file_upload",
              targetId: internshipId,
              reason: score?.reason,
              details: JSON.parse(
                JSON.stringify({
                  fileId: document.id,
                  previousEvaluation: previous,
                }),
              ),
            },
          });
          return {
            id: document.id,
            originalName: document.originalName,
            size: document.size,
          };
        },
      );
    } catch (error) {
      if (stored)
        await this.client()
          .removeObject(stored.bucket, stored.objectKey)
          .catch(() => undefined);
      throw error;
    }
  }
  private async allowed(internshipId: string, user: AuthUser) {
    const item = await this.db.internship.findUnique({
      where: { id: internshipId },
      include: {
        student: true,
        facultyMentor: true,
        company: true,
        companySupervisorAssignments: { include: { supervisor: true } },
        period: true,
      },
    });
    if (!item) throw new ForbiddenException("Không được truy cập tệp này.");
    const school =
      !!user.departmentId &&
      user.departmentId === item.period.departmentId &&
      (user.roles.includes("FacultyManager") ||
        (user.roles.includes("InternshipCoordinator") &&
          item.period.coordinatorId === user.id));
    const owner =
      user.roles.includes("Student") && item.student.userId === user.id;
    const mentor =
      user.roles.includes("FacultyMentor") &&
      item.facultyMentor.userId === user.id;
    const company =
      user.roles.includes("Company") &&
      item.company?.representativeUserId === user.id;
    const supervisor = user.roles.includes("CompanySupervisor")
      ? item.companySupervisorAssignments.find(
          (a) => a.supervisor.userId === user.id,
        )?.supervisorId
      : undefined;
    if (!school && !owner && !mentor && !company && !supervisor)
      throw new ForbiddenException("Không được truy cập tệp này.");
    return { item, school: school || owner || mentor, company, supervisor };
  }
  async list(internshipId: string, user: AuthUser) {
    const access = await this.allowed(internshipId, user);
    return this.db.fileDocument.findMany({
      where: {
        internshipId,
        AND: [
          {
            OR: [
              { weeklyReports: { some: {} } },
              { finalReports: { some: {} } },
              { evaluations: { some: {} } },
            ],
          },
        ],
        ...(access.school
          ? {}
          : {
              companyId: access.item.companyId!,
              ...(access.company
                ? {}
                : {
                    OR: [
                      { kind: { in: ["weekly", "final"] } },
                      { supervisorId: access.supervisor },
                    ],
                  }),
            }),
      },
      select: {
        id: true,
        kind: true,
        weekNumber: true,
        supervisorId: true,
        originalName: true,
        size: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
  async download(id: string, user: AuthUser) {
    const file = await this.db.fileDocument.findUnique({ where: { id } });
    if (!file) throw new ForbiddenException("Không được truy cập tệp này.");
    const access = await this.allowed(file.internshipId, user);
    if (
      !access.school &&
      (file.companyId !== access.item.companyId ||
        (file.kind === "evidence" &&
          !access.company &&
          file.supervisorId !== access.supervisor))
    )
      throw new ForbiddenException("Không được truy cập tệp này.");
    try {
      return {
        stream: await this.client().getObject(file.bucket, file.objectKey),
        name: file.originalName,
      };
    } catch {
      throw new ServiceUnavailableException(
        "Chưa tải được tệp. Vui lòng thử lại.",
      );
    }
  }
}

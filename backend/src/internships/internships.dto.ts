import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  ValidateNested,
  Matches,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ImportType } from "@prisma/client";
export class SaveProfileDto {
  @IsObject() data!: Record<string, string | number | boolean>;
}
export class StudentContactDto {
  @IsEmail() @MaxLength(254) email!: string;
}

export class AudienceDto {
  @IsUUID() majorId!: string;
  @IsUUID() cohortId!: string;
  @IsOptional() @IsUUID() programId?: string;
}
export class PeriodAcademicDto {
  @IsUUID() departmentId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(99) roundNumber!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(3) semester!: number;
  @Matches(/^20\d{2}-20\d{2}$/) academicYear!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AudienceDto)
  audience!: AudienceDto[];
}
export class CreatePeriodDto extends PeriodAcademicDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsDateString() registrationStartsAt!: string;
  @IsDateString() registrationEndsAt!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @Type(() => Number) @IsInt() @Min(6) @Max(12) weeklyReportCount!: number;
  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(12)
  @IsDateString({}, { each: true })
  weeklyDeadlines!: string[];
  @IsDateString() gradingDeadline!: string;
  @IsDateString() finalizationDeadline!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) creditThresholdPercent = 80;
}

export class CreateApplicationDto {
  @IsUUID() periodId!: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsString() @MinLength(2) @MaxLength(160) positionTitle!: string;
  @IsOptional() @IsString() @MaxLength(160) externalCompanyName?: string;
  @IsOptional() @IsString() @MaxLength(160) externalCompanyContact?: string;
  @IsOptional() @IsEmail() @MaxLength(254) externalCompanyEmail?: string;
}

export class CreateExceptionDto {
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
}

export class ApproveApplicationDto {
  @IsUUID() facultyMentorId!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ReviewExceptionDto {
  @IsString() @MinLength(3) @MaxLength(500) note!: string;
}
export class VerifyExternalCompanyDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @MinLength(3) @MaxLength(255) address!: string;
  @IsString() @MinLength(2) @MaxLength(120) contactName!: string;
  @IsEmail() @MaxLength(254) contactEmail!: string;
  @IsString() @MinLength(5) @MaxLength(30) contactPhone!: string;
  @IsString() @MinLength(3) @MaxLength(500) note!: string;
}

export class CreateCompanySupervisorDto {
  @IsString() @MinLength(2) @MaxLength(120) fullName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
}

export class AssignSupervisorDto {
  @IsUUID() supervisorId!: string;
}
export class AssignMentorDto {
  @IsUUID() facultyMentorId!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class AssignCoordinatorDto {
  @IsUUID() coordinatorId!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ChangeCompanyDto {
  @IsUUID() companyId!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class SubmitWeeklyReportDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) weekNumber!: number;
  @IsString() @MinLength(20) @MaxLength(5000) content!: string;
}
export class ReviewWeeklyReportDto {
  @IsString() @MinLength(2) @MaxLength(2000) note!: string;
  @IsEnum(["Reviewed", "NeedsRevision"] as const) status!:
    "Reviewed" | "NeedsRevision";
}
export class ScoreDto {
  @Type(() => Number) @Min(0) @Max(10) score!: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class SupervisorScoreDto {
  @Type(() => Number) @Min(0) @Max(2) discipline!: number;
  @Type(() => Number) @Min(0) @Max(2) responsibility!: number;
  @Type(() => Number) @Min(0) @Max(2) knowledge!: number;
  @Type(() => Number) @Min(0) @Max(4) outcome!: number;
  @IsOptional() @IsString() @MaxLength(500) evidenceNote?: string;
}
export class SubmitFinalReportDto {
  @IsString() @MinLength(100) @MaxLength(10000) content!: string;
}

export class ImportQueryDto {
  @IsEnum(ImportType) type!: ImportType;
}

export class ProvisionProfileDto {
  @IsEnum(["student", "faculty", "company"] as const)
  type!: "student" | "faculty" | "company";
}

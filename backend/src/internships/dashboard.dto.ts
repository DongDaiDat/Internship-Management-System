import { Type, Transform } from "class-transformer";
import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
} from "class-validator";
import { ApplicationStatus } from "@prisma/client";

export class DashboardQueryDto {
  @IsOptional() @IsUUID() periodId?: string;
}
export class DashboardDetailsQueryDto extends DashboardQueryDto {
  @IsEnum([
    "students",
    "periods",
    "pendingApplications",
    "activeInternships",
    "verifiedCompanies",
    "pendingCompanies",
    "lateReports",
    "submittedLateReports",
    "pendingReviews",
    "revisionReports",
    "missingSchedules",
    "graded",
  ])
  metric!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
export class FacultyWorkspaceQueryDto extends DashboardQueryDto {
  @IsOptional()
  @IsEnum(["approvals", "exceptions", "grades", "operations"])
  view?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) applicationPage = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) internshipPage = 1;
}
export class ReadinessQueryDto extends DashboardQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsEnum(["eligibility", "quota"]) kind: "eligibility" | "quota" =
    "eligibility";
  @IsEnum(["all", "ready", "blocked"]) filter: "all" | "ready" | "blocked" =
    "all";
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
export class ProgressQueryDto extends DashboardQueryDto {
  @IsOptional()
  @IsEnum([
    "all",
    "graded",
    "passed",
    "failed",
    "missingFaculty",
    "missingCompany",
  ])
  filter:
    | "all"
    | "graded"
    | "passed"
    | "failed"
    | "missingFaculty"
    | "missingCompany" = "all";
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
export class ApplicationListQueryDto extends DashboardQueryDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;
}

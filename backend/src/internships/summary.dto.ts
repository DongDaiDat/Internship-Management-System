import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class SummaryQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{4}$/) academicYear?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3) semester?: number;
  @IsOptional() @IsUUID() periodId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsUUID() programId?: string;
  @IsOptional() @IsUUID() cohortId?: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() mentorId?: string;
  @IsOptional() @IsUUID() supervisorId?: string;
  @IsOptional()
  @IsIn(["upcoming", "active", "awaiting", "completed", "cancelled"])
  status?: string;
  @IsOptional()
  @IsIn([
    "missingReports",
    "pendingReviews",
    "missingFaculty",
    "missingCompany",
    "unassignedSupervisor",
    "passed",
    "failed",
  ])
  attention?: string;
  @IsIn(["all", "current", "former"]) assignment: string = "all";
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsIn(["newest", "oldest", "student"]) sort: string = "newest";
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

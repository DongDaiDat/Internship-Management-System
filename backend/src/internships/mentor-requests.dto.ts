import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class MentorRequestDto {
  @IsUUID() facultyMentorId!: string;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
export class MentorResponseDto {
  @IsIn(["Accepted", "Declined"]) response!: "Accepted" | "Declined";
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) note?: string;
}
export class MentorRequestQueryDto {
  @IsOptional() @IsUUID() requestId?: string;
  @IsOptional() @IsUUID() periodId?: string;
  @IsOptional()
  @IsIn(["Pending", "Accepted", "Declined", "Closed"])
  status?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}

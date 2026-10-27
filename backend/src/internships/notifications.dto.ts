import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
export class NotificationQueryDto {
  @IsOptional()
  @IsIn(["active", "hidden"])
  visibility: "active" | "hidden" = "active";
  @IsOptional()
  @IsIn(["overdue", "urgent", "soon", "pending"])
  priority?: string;
  @IsOptional() @IsString() @MaxLength(60) type?: string;
  @IsOptional() @IsUUID() periodId?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

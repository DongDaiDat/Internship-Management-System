import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Role } from "@prisma/client";

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional() @IsUUID() departmentId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}

export class AccessDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles!: Role[];
  @IsOptional() @IsUUID() departmentId?: string;
}
export class PendingQueryDto {
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() importBatchId?: string;
  @IsOptional() @IsEnum(["student", "faculty", "company"]) type?: string;
}
export class ProvisionItemDto {
  @IsUUID() id!: string;
  @IsEnum(["student", "faculty", "company"]) type!: string;
}
export class ProvisionBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProvisionItemDto)
  items!: ProvisionItemDto[];
}
export class LegacyAssignDto {
  @IsUUID() id!: string;
  @IsUUID() departmentId!: string;
  @IsEnum(["student", "faculty", "company", "period"]) type!: string;
}

export class ListUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

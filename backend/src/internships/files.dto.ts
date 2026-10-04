import { IsString, MaxLength, MinLength } from "class-validator";
import { SupervisorScoreDto } from "./internships.dto";
import { Transform } from "class-transformer";
export class ProxyScoreDto extends SupervisorScoreDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

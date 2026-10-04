import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { AcademicService } from "./academic.service";
import type { AuthRequest } from "../auth/auth.types";
import { IsObject } from "class-validator";
class CatalogDto {
  @IsObject() data!: Record<string, unknown>;
}
@Controller("academic")
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}
  @Get() catalog() {
    return this.academic.catalog();
  }
  @Post(":kind") save(
    @Param("kind") kind: string,
    @Body() dto: CatalogDto,
    @Req() req: AuthRequest,
  ) {
    return this.academic.save(kind, dto.data, req.authUser!);
  }
}

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.types";
import { SummaryQueryDto } from "./summary.dto";
import { SummaryService } from "./summary.service";

@Controller("reports")
export class SummaryController {
  constructor(private readonly service: SummaryService) {}
  @Get("registrations") registrations(
    @Req() req: AuthRequest,
    @Query() query: SummaryQueryDto,
  ) {
    return this.service.registrations(req.authUser!, query);
  }
  @Get("overview") overview(
    @Req() req: AuthRequest,
    @Query() query: SummaryQueryDto,
  ) {
    return this.service.overview(req.authUser!, query);
  }
  @Get("internships/export") async export(
    @Req() req: AuthRequest,
    @Query() query: SummaryQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.export(req.authUser!, query);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="tong-hop-thuc-tap.xlsx"',
    );
    res.send(buffer);
  }
  @Get("internships") list(
    @Req() req: AuthRequest,
    @Query() query: SummaryQueryDto,
  ) {
    return this.service.list(req.authUser!, query);
  }
  @Get("internships/:id/history") history(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.history(req.authUser!, id);
  }
}

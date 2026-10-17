import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { AuthRequest } from "../auth/auth.types";
import { MentorRequestsService } from "./mentor-requests.service";
import {
  MentorRequestDto,
  MentorRequestQueryDto,
  MentorResponseDto,
} from "./mentor-requests.dto";
@Controller()
export class MentorRequestsController {
  constructor(private readonly service: MentorRequestsService) {}
  @Get("internship-periods/:id/mentor-choices") choices(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.choices(id, req.authUser!);
  }
  @Post("internship-applications/:id/mentor-request") set(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MentorRequestDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.set(id, dto, req.authUser!);
  }
  @Post("internship-applications/:id/mentor-request/withdraw") withdraw(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.set(id, null, req.authUser!);
  }
  @Get("mentor-requests") list(
    @Query() query: MentorRequestQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.list(query, req.authUser!);
  }
  @Post("mentor-requests/:id/respond") respond(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MentorResponseDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.respond(id, dto, req.authUser!);
  }
}

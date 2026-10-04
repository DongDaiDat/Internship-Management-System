import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { RequirePermission } from "../auth/auth.decorators";
import type { AuthRequest } from "../auth/auth.types";
import {
  CreateUserDto,
  ListUsersDto,
  AccessDto,
  PendingQueryDto,
  ProvisionBatchDto,
  LegacyAssignDto,
} from "./users.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get("summary") @RequirePermission("users:read") summary() {
    return this.users.summary();
  }
  @Get("pending") @RequirePermission("users:read") pending(
    @Query() query: PendingQueryDto,
  ) {
    return this.users.pending(query);
  }
  @Get("unassigned") @RequirePermission("users:read") unassigned() {
    return this.users.unassigned();
  }
  @Post("assign-legacy") @RequirePermission("users:create") assignLegacy(
    @Body() dto: LegacyAssignDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.assignLegacy(
      dto.type,
      dto.id,
      dto.departmentId,
      req.authUser!.id,
    );
  }
  @Post("provision") @RequirePermission("users:create") provision(
    @Body() dto: ProvisionBatchDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.provision(dto.items, req.authUser!.id);
  }
  @Post(":id/reset-password") @RequirePermission("users:create") reset(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.users.resetPassword(id, req.authUser!.id);
  }
  @Post(":id/access") @RequirePermission("users:create") access(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AccessDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.updateAccess(id, dto, req.authUser!.id);
  }
  @Get()
  @RequirePermission("users:read")
  list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }
  @Post()
  @RequirePermission("users:create")
  create(@Body() dto: CreateUserDto, @Req() request: AuthRequest) {
    return this.users.create(dto, request.authUser!.id);
  }
}

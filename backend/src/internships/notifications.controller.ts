import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";
import { NotificationQueryDto } from "./notifications.dto";
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get("summary") summary(@Req() req: AuthRequest) {
    return this.service.summary(req.authUser!);
  }
  @Get("tasks") tasks(
    @Req() req: AuthRequest,
    @Query() q: NotificationQueryDto,
  ) {
    return this.service.list(req.authUser!, q);
  }
}

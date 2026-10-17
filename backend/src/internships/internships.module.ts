import { SummaryController } from "./summary.controller";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { SummaryService } from "./summary.service";
import { AcademicService } from "./academic.service";
import { AcademicController } from "./academic.controller";
import { MentorRequestsService } from "./mentor-requests.service";
import { MentorRequestsController } from "./mentor-requests.controller";
import { Module } from "@nestjs/common";
import { InternshipsController } from "./internships.controller";
import { InternshipsService } from "./internships.service";
import { FilesService } from "./files.service";
import { FilesController } from "./files.controller";

@Module({
  controllers: [
    NotificationsController,
    SummaryController,
    MentorRequestsController,
    AcademicController,
    InternshipsController,
    FilesController,
  ],
  providers: [
    NotificationsService,
    SummaryService,
    MentorRequestsService,
    AcademicService,
    InternshipsService,
    FilesService,
  ],
})
export class InternshipsModule {}

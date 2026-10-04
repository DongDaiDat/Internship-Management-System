import { AcademicService } from "./academic.service";
import { AcademicController } from "./academic.controller";
import { Module } from "@nestjs/common";
import { InternshipsController } from "./internships.controller";
import { InternshipsService } from "./internships.service";
import { FilesService } from "./files.service";
import { FilesController } from "./files.controller";

@Module({
  controllers: [AcademicController, InternshipsController, FilesController],
  providers: [AcademicService, InternshipsService, FilesService],
})
export class InternshipsModule {}

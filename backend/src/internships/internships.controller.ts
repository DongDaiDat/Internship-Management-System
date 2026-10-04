import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.types";
import { InternshipsService } from "./internships.service";
import {
  DashboardQueryDto,
  ApplicationListQueryDto,
  ProgressQueryDto,
  FacultyWorkspaceQueryDto,
  ReadinessQueryDto,
  DashboardDetailsQueryDto,
} from "./dashboard.dto";
import {
  ApproveApplicationDto,
  AssignMentorDto,
  AssignSupervisorDto,
  CreateApplicationDto,
  CreateCompanySupervisorDto,
  CreateExceptionDto,
  CreatePeriodDto,
  PeriodAcademicDto,
  ImportQueryDto,
  ReviewExceptionDto,
  ReviewWeeklyReportDto,
  ScoreDto,
  SubmitFinalReportDto,
  SubmitWeeklyReportDto,
  SupervisorScoreDto,
  VerifyExternalCompanyDto,
  ChangeCompanyDto,
  AssignCoordinatorDto,
  SaveProfileDto,
  StudentContactDto,
} from "./internships.dto";

@Controller()
export class InternshipsController {
  constructor(private readonly internships: InternshipsService) {}

  @Get("internship-periods") periods(@Req() request: AuthRequest) {
    return this.internships.periods(request.authUser!);
  }
  @Post("internship-periods/:id/coordinator") @HttpCode(204) assignCoordinator(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignCoordinatorDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.assignCoordinator(id, dto, request.authUser!);
  }
  @Get("companies") companies(@Req() req: AuthRequest) {
    return this.internships.companies(req.authUser!);
  }
  @Get("internship-coordinators") coordinators(@Req() request: AuthRequest) {
    return this.internships.coordinators(request.authUser!);
  }
  @Get("profiles/:type") profiles(
    @Param("type") type: "students" | "faculty" | "companies",
    @Req() request: AuthRequest,
  ) {
    return this.internships.profiles(type, request.authUser!);
  }
  @Post("profiles/:type") saveProfile(
    @Param("type") type: string,
    @Body() dto: SaveProfileDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.saveProfile(
      type,
      null,
      dto.data,
      request.authUser!,
    );
  }
  @Post("profiles/:type/:id/update") updateProfile(
    @Param("type") type: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveProfileDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.saveProfile(type, id, dto.data, request.authUser!);
  }
  @Post("students/me/contact") contact(
    @Body() dto: StudentContactDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.updateStudentContact(dto.email, request.authUser!);
  }
  @Post("internship-periods") createPeriod(
    @Body() dto: CreatePeriodDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.createPeriod(dto, request.authUser!);
  }
  @Post("internship-periods/:id/update") updatePeriod(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreatePeriodDto,
    @Req() req: AuthRequest,
  ) {
    return this.internships.updatePeriod(id, dto, req.authUser!);
  }
  @Post("internship-periods/:id/complete-academic") completeAcademic(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PeriodAcademicDto,
    @Req() req: AuthRequest,
  ) {
    return this.internships.completePeriodAcademic(id, dto, req.authUser!);
  }
  @Post("internship-periods/:id/publish") publishPeriod(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ) {
    return this.internships.publishPeriod(id, request.authUser!);
  }

  @Get("imports/template")
  async template(@Query() query: ImportQueryDto, @Res() response: Response) {
    const buffer = await this.internships.template(query.type);
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="mau-import-${query.type}.xlsx"`,
    );
    response.send(buffer);
  }
  @Post("imports/preview")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 1_000_000 } }))
  previewImport(
    @Query() query: ImportQueryDto,
    @UploadedFile() file: { buffer: Buffer; originalname?: string },
    @Req() request: AuthRequest,
  ) {
    return this.internships.previewImport(query.type, file, request.authUser!);
  }
  @Post("imports/:id/confirm") confirmImport(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ) {
    return this.internships.confirmImport(id, request.authUser!);
  }

  @Post("students/:id/verify") @HttpCode(204) async verifyStudent(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ) {
    await this.internships.verifyProfile("student", id, request.authUser!);
  }
  @Post("companies/:id/verify") @HttpCode(204) async verifyCompany(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ) {
    await this.internships.verifyProfile("company", id, request.authUser!);
  }

  @Post("internship-applications") application(
    @Body() dto: CreateApplicationDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.createApplication(dto, request.authUser!);
  }
  @Post("internship-applications/:id/cancel") @HttpCode(204) async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ) {
    await this.internships.cancelApplication(id, request.authUser!);
  }
  @Post("internship-applications/:id/exceptions") exception(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateExceptionDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.createException(id, dto, request.authUser!);
  }
  @Post("eligibility-exceptions/:id/approve") reviewException(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewExceptionDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.reviewException(id, true, dto, request.authUser!);
  }
  @Post("eligibility-exceptions/:id/reject") rejectException(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewExceptionDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.reviewException(id, false, dto, request.authUser!);
  }
  @Post("internship-applications/:id/approve") approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApproveApplicationDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.approveApplication(id, dto, request.authUser!);
  }

  @Post("company-supervisors") companySupervisor(
    @Body() dto: CreateCompanySupervisorDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.companySupervisor(dto, request.authUser!);
  }
  @Post("company-supervisors/self") enableOwnSupervisor(
    @Req() request: AuthRequest,
  ) {
    return this.internships.enableOwnSupervisor(request.authUser!);
  }
  @Post("internships/:id/company-supervisors")
  @HttpCode(204)
  async assignSupervisor(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignSupervisorDto,
    @Req() request: AuthRequest,
  ) {
    await this.internships.assignSupervisor(id, dto, request.authUser!);
  }
  @Post("internships/:id/faculty-mentor") @HttpCode(204) async changeMentor(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignMentorDto,
    @Req() request: AuthRequest,
  ) {
    await this.internships.changeMentor(id, dto, request.authUser!);
  }
  @Post("internships/:id/company") @HttpCode(204) async changeCompany(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeCompanyDto,
    @Req() request: AuthRequest,
  ) {
    await this.internships.changeCompany(id, dto, request.authUser!);
  }

  @Post("internships/:id/weekly-reports") weekly(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SubmitWeeklyReportDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.submitWeekly(id, dto, request.authUser!);
  }
  @Post("weekly-reports/:id/review") reviewWeekly(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewWeeklyReportDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.reviewWeekly(id, dto, request.authUser!);
  }
  @Post("weekly-reports/:id/unlock") unlockWeekly(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewExceptionDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.unlockWeekly(id, dto, request.authUser!);
  }
  @Post("internships/:id/final-report") finalReport(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SubmitFinalReportDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.submitFinalReport(id, dto, request.authUser!);
  }
  @Post("internships/:id/faculty-score") facultyScore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScoreDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.scoreFaculty(id, dto, request.authUser!, false);
  }
  @Post("internships/:id/final-report-score") finalReportScore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScoreDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.scoreFaculty(id, dto, request.authUser!, true);
  }
  @Post("internships/:id/company-score") companyScore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SupervisorScoreDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.scoreSupervisor(id, dto, request.authUser!);
  }
  @Post("internships/:id/lock-grade") lockGrade(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ) {
    return this.internships.lockGrade(id, request.authUser!);
  }
  @Get("reports/applications/export") async exportApplications(
    @Req() request: AuthRequest,
    @Query() query: ApplicationListQueryDto,
    @Res() response: Response,
  ) {
    const buffer = await this.internships.exportReport(
      request.authUser!,
      "applications",
      query,
    );
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="dang-ky.xlsx"',
    );
    response.send(buffer);
  }
  @Get("reports/progress/export") async exportProgress(
    @Req() request: AuthRequest,
    @Query() query: ProgressQueryDto,
    @Res() response: Response,
  ) {
    const buffer = await this.internships.exportReport(
      request.authUser!,
      "progress",
      query,
    );
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="tien-do-ket-qua.xlsx"',
    );
    response.send(buffer);
  }
  @Get("reports/internships/:id/audit") internshipAudit(
    @Req() request: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.internships.internshipAudit(request.authUser!, id);
  }
  @Get("reports/dashboard") dashboardDetails(
    @Req() request: AuthRequest,
    @Query() query: DashboardDetailsQueryDto,
  ) {
    return this.internships.dashboardDetails(request.authUser!, query);
  }
  @Get("reports/readiness") readiness(
    @Req() request: AuthRequest,
    @Query() query: ReadinessQueryDto,
  ) {
    return this.internships.readinessReport(request.authUser!, query);
  }
  @Get("reports/progress") progressReport(
    @Req() request: AuthRequest,
    @Query() query: ProgressQueryDto,
  ) {
    return this.internships.progressReport(request.authUser!, query);
  }
  @Get("dashboard") dashboard(
    @Req() request: AuthRequest,
    @Query() query: DashboardQueryDto,
  ) {
    return this.internships.dashboard(request.authUser!, query.periodId);
  }
  @Get("reports/applications") applicationReport(
    @Req() request: AuthRequest,
    @Query() query: ApplicationListQueryDto,
  ) {
    return this.internships.applicationReport(request.authUser!, query);
  }
  @Get("internships/mine") mine(@Req() request: AuthRequest) {
    return this.internships.mine(request.authUser!);
  }
  @Get("company-workspace") companyWorkspace(@Req() request: AuthRequest) {
    return this.internships.companyWorkspace(request.authUser!);
  }
  @Get("faculty-workspace") facultyWorkspace(
    @Req() request: AuthRequest,
    @Query() query: FacultyWorkspaceQueryDto,
  ) {
    return this.internships.facultyWorkspace(request.authUser!, query);
  }
  @Get("external-company-applications") externalApplications(
    @Req() request: AuthRequest,
  ) {
    return this.internships.externalApplications(request.authUser!);
  }
  @Post("internship-applications/:id/verify-company") verifyExternal(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VerifyExternalCompanyDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.verifyExternalCompany(id, dto, request.authUser!);
  }
  @Post("internship-applications/:id/reject") rejectApplication(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewExceptionDto,
    @Req() request: AuthRequest,
  ) {
    return this.internships.rejectApplication(id, dto, request.authUser!);
  }
}

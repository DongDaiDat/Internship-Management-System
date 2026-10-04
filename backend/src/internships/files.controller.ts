import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthRequest } from "../auth/auth.types";
import { FilesService, MAX_PDF_BYTES } from "./files.service";
import { ProxyScoreDto } from "./files.dto";
type Upload = { buffer: Buffer; originalname: string };
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}
  @Get("internships/:id/files") list(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.files.list(id, req.authUser!);
  }
  @Get("files/:id") async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    const file = await this.files.download(id, req.authUser!);
    return new StreamableFile(file.stream, {
      type: "application/pdf",
      disposition: `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
  }
  @Post("internships/:id/weekly-reports/:week/file")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_PDF_BYTES, files: 1 } }),
  )
  weekly(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("week", ParseIntPipe) week: number,
    @UploadedFile() file: Upload,
    @Req() req: AuthRequest,
  ) {
    return this.files.upload(id, "weekly", file, req.authUser!, week);
  }
  @Post("internships/:id/final-report/file")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_PDF_BYTES, files: 1 } }),
  )
  final(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload,
    @Req() req: AuthRequest,
  ) {
    return this.files.upload(id, "final", file, req.authUser!);
  }
  @Post("internships/:id/company-scores/:supervisorId/evidence")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_PDF_BYTES, files: 1 } }),
  )
  evidence(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("supervisorId", ParseUUIDPipe) supervisorId: string,
    @UploadedFile() file: Upload,
    @Body() dto: ProxyScoreDto,
    @Req() req: AuthRequest,
  ) {
    return this.files.upload(
      id,
      "evidence",
      file,
      req.authUser!,
      undefined,
      supervisorId,
      dto,
    );
  }
}

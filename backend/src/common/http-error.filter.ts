import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { Prisma } from "@prisma/client";

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "";
    const statusCode =
      error instanceof HttpException
        ? error.getStatus()
        : prismaCode === "P2002"
          ? 409
          : ["P2003", "P2025"].includes(prismaCode)
            ? 400
            : 500;
    const payload = error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object" && "message" in payload
          ? payload.message
          : prismaCode === "P2002"
            ? "Dữ liệu bị trùng. Kiểm tra mã hoặc tên đã có trong hệ thống."
            : ["P2003", "P2025"].includes(prismaCode)
              ? "Dữ liệu tham chiếu không hợp lệ hoặc không còn tồn tại."
              : "Hệ thống tạm thời gặp lỗi. Vui lòng thử lại.";
    if (statusCode >= 500)
      this.logger.error("Request failed due to an internal error.");
    response.status(statusCode).json({ statusCode, message });
  }
}

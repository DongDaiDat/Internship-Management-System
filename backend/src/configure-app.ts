import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { allowedOrigins } from "./auth/auth.config";
import { HttpErrorFilter } from "./common/http-error.filter";

export function configureApp(app: INestApplication) {
  const origins = allowedOrigins();
  app.setGlobalPrefix("api");
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      (!request.headers.origin || !origins.includes(request.headers.origin))
    ) {
      response
        .status(403)
        .json({ statusCode: 403, message: "Nguồn yêu cầu không được phép." });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
      exceptionFactory: () =>
        new BadRequestException(
          "Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.",
        ),
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
}

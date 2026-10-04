import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { AllowPasswordChangePending, Public } from "./auth.decorators";
import { ChangePasswordDto, LoginDto } from "./auth.dto";
import { cookieName, cookieOptions, SESSION_DURATION_MS } from "./auth.config";
import type { AuthRequest } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      request.ip || "unknown",
    );
    response.cookie(cookieName(), result.token, {
      ...cookieOptions(),
      maxAge: SESSION_DURATION_MS,
    });
    return result.user;
  }

  @Get("me")
  @AllowPasswordChangePending()
  me(@Req() request: AuthRequest) {
    return request.authUser;
  }

  @Post("change-password")
  @AllowPasswordChangePending()
  @HttpCode(204)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthRequest,
  ) {
    await this.auth.changePassword(
      request.authUser!.id,
      request.sessionId!,
      dto.currentPassword,
      dto.password,
    );
  }

  @Post("logout")
  @AllowPasswordChangePending()
  @HttpCode(204)
  async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.sessionId!, request.authUser!.id);
    response.clearCookie(cookieName(), cookieOptions());
  }
}

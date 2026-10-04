import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { SessionGuard } from "./auth/session.guard";
import { UsersModule } from "./users/users.module";
import { InternshipsModule } from "./internships/internships.module";

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, InternshipsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useExisting: SessionGuard }],
})
export class AppModule {}

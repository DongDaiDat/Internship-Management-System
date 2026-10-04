import { SetMetadata } from "@nestjs/common";
import type { Permission } from "./auth.types";

export const Public = () => SetMetadata("public", true);
export const AllowPasswordChangePending = () =>
  SetMetadata("allowPasswordChangePending", true);
export const RequirePermission = (permission: Permission) =>
  SetMetadata("permission", permission);

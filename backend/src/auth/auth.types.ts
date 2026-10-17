import { Role } from "@prisma/client";
import type { Request } from "express";

export type Permission =
  | "reports:department"
  | "reports:mentor"
  | "reports:company"
  | "reports:student"
  | "reports:platform"
  | "users:read"
  | "users:create"
  | "periods:write"
  | "profiles:write"
  | "operations:write"
  | "internships:approve"
  | "internships:mentor"
  | "internships:company"
  | "internships:student"
  | "dashboard:read";
export type AuthUser = {
  departmentId?: string | null;
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  permissions: Permission[];
  mustChangePassword: boolean;
};
export type AuthRequest = Request & { authUser?: AuthUser; sessionId?: string };
export function permissionsFor(roles: Role[]): Permission[] {
  const permissions: Permission[] = [];
  if (roles.includes(Role.Admin))
    permissions.push(
      "users:read",
      "users:create",
      "dashboard:read",
      "reports:platform",
    );
  if (roles.includes(Role.InternshipCoordinator))
    permissions.push(
      "periods:write",
      "reports:department",
      "profiles:write",
      "operations:write",
      "dashboard:read",
    );
  if (roles.includes(Role.FacultyManager))
    permissions.push(
      "internships:approve",
      "dashboard:read",
      "reports:department",
    );
  if (roles.includes(Role.FacultyMentor))
    permissions.push("internships:mentor", "reports:mentor");
  if (roles.includes(Role.Company) || roles.includes(Role.CompanySupervisor))
    permissions.push("internships:company", "reports:company");
  if (roles.includes(Role.Student))
    permissions.push("internships:student", "reports:student");
  return [...new Set(permissions)];
}

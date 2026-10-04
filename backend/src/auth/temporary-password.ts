import { randomBytes } from "node:crypto";
export function temporaryPassword(): string {
  return randomBytes(18).toString("base64url");
}

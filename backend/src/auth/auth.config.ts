export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export function cookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-interna_session"
    : "interna_session";
}
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
}
export function allowedOrigins(): string[] {
  const origins = (
    process.env.APP_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.APP_ORIGINS ||
      origins.some((value) => !value.startsWith("https://")))
  )
    throw new Error(
      "Production APP_ORIGINS must explicitly list HTTPS origins.",
    );
  return origins;
}

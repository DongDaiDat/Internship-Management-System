export type Role =
  | "Student"
  | "Company"
  | "CompanySupervisor"
  | "FacultyMentor"
  | "InternshipCoordinator"
  | "FacultyManager"
  | "Admin";
export type CurrentUser = {
  departmentId?: string | null;
  id: string;
  fullName: string;
  email: string;
  roles: Role[];
  permissions: string[];
  mustChangePassword: boolean;
};
export const roleLabels: Record<Role, string> = {
  Student: "Sinh viên",
  Company: "Doanh nghiệp",
  CompanySupervisor: "Hướng dẫn tại doanh nghiệp",
  FacultyMentor: "Giảng viên hướng dẫn",
  InternshipCoordinator: "Điều phối thực tập",
  FacultyManager: "Trưởng khoa",
  Admin: "Quản trị hệ thống",
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function workspaceHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const roles: Record<string, string> = { admin: "Admin", coordinator: "InternshipCoordinator", faculty: "FacultyManager", student: "Student", mentor: "FacultyMentor", company: "Company", supervisor: "CompanySupervisor" };
  const role = roles[window.location.pathname.split("/")[2]];
  return role ? { "X-Workspace-Role": role } : {};
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...options.headers,
        ...(typeof window !== "undefined" &&
        window.location.pathname.startsWith("/workspace/") &&
        !path.startsWith("/auth/")
          ? {
              "X-Workspace-Role":
                (
                  {
                    admin: "Admin",
                    coordinator: "InternshipCoordinator",
                    faculty: "FacultyManager",
                    student: "Student",
                    mentor: "FacultyMentor",
                    company: "Company",
                    supervisor: "CompanySupervisor",
                  } as Record<string, string>
                )[window.location.pathname.split("/")[2]] || "",
            }
          : {}),
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      "Không kết nối được hệ thống. Kiểm tra kết nối và thử lại.",
      0,
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      typeof body?.message === "string"
        ? body.message
        : "Không thực hiện được yêu cầu. Vui lòng thử lại.",
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export type ReportDraft = {
  week: number;
  hours: string;
  work: string;
  learning: string;
  nextPlan: string;
};
export const emptyDraft: ReportDraft = {
  week: 6,
  hours: "",
  work: "",
  learning: "",
  nextPlan: "",
};
export function validateReport(
  draft: ReportDraft,
): Partial<Record<keyof ReportDraft, string>> {
  const errors: Partial<Record<keyof ReportDraft, string>> = {};
  if (!Number.isInteger(draft.week) || draft.week < 1 || draft.week > 12)
    errors.week = "Chọn tuần từ 1 đến 12.";
  const hours = Number(draft.hours);
  if (
    !draft.hours.trim() ||
    !Number.isFinite(hours) ||
    hours <= 0 ||
    hours > 168
  )
    errors.hours = "Nhập số giờ lớn hơn 0 và không vượt quá 168.";
  for (const field of ["work", "learning", "nextPlan"] as const) {
    if (draft[field].trim().length < 10)
      errors[field] = "Viết ít nhất 10 ký tự để người hướng dẫn hiểu nội dung.";
    else if (draft[field].length > 3000)
      errors[field] = "Nội dung tối đa 3.000 ký tự.";
  }
  return errors;
}
export function parseDraft(raw: string): ReportDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      !Number.isInteger(item.week) ||
      Number(item.week) < 1 ||
      Number(item.week) > 12
    )
      return null;
    if (
      !["hours", "work", "learning", "nextPlan"].every(
        (key) =>
          typeof item[key] === "string" && String(item[key]).length <= 3000,
      )
    )
      return null;
    return item as ReportDraft;
  } catch {
    return null;
  }
}

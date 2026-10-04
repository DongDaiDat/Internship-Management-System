import { BadRequestException } from "@nestjs/common";

export type PeriodSchedule = {
  startsAt: Date;
  endsAt: Date;
  weeklyReportCount: number;
  weeklyDeadlines: Date[];
  gradingDeadline: Date | null;
  finalizationDeadline: Date | null;
};
export function validateSchedule(period: PeriodSchedule) {
  const {
    startsAt,
    endsAt,
    weeklyDeadlines,
    gradingDeadline,
    finalizationDeadline,
  } = period;
  if (
    weeklyDeadlines.length !== period.weeklyReportCount ||
    !gradingDeadline ||
    !finalizationDeadline
  )
    throw new BadRequestException(
      "Đợt chưa có đầy đủ hạn nộp từng tuần, hạn chấm và hạn tổng kết.",
    );
  let previous = startsAt.getTime();
  for (const deadline of weeklyDeadlines) {
    if (
      !Number.isFinite(deadline.getTime()) ||
      deadline.getTime() <= previous ||
      deadline > endsAt
    )
      throw new BadRequestException(
        "Hạn nộp tuần phải tăng dần, sau ngày bắt đầu và không sau ngày kết thúc thực tập.",
      );
    previous = deadline.getTime();
  }
  if (
    !Number.isFinite(gradingDeadline.getTime()) ||
    !Number.isFinite(finalizationDeadline.getTime()) ||
    gradingDeadline < endsAt ||
    finalizationDeadline < gradingDeadline
  )
    throw new BadRequestException(
      "Hạn chấm phải từ ngày kết thúc thực tập; hạn tổng kết không trước hạn chấm.",
    );
}
export function checkPeriodWindow(
  period: PeriodSchedule,
  action: "weekly" | "report" | "grade" | "finalize",
  now: Date,
  week?: number,
) {
  validateSchedule(period);
  const deadline =
    action === "weekly"
      ? period.weeklyDeadlines[(week ?? 0) - 1]
      : action === "report"
        ? period.endsAt
        : action === "grade"
          ? period.gradingDeadline
          : period.finalizationDeadline;
  if (!deadline || now < period.startsAt || now > deadline)
    throw new BadRequestException(
      "Thao tác nằm ngoài thời gian cho phép của đợt thực tập.",
    );
}

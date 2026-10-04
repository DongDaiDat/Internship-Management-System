"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { FilePanel } from "./file-panel";

type Workspace = {
  applicationTotal: number;
  internshipTotal: number;
  faculty: {
    id: string;
    fullName: string;
    maxStudents: number;
    _count: { internships: number };
  }[];
  applications: {
    id: string;
    student: {
      fullName: string;
      studentCode: string;
      completedCredits: number;
      programCredits: number;
    };
    period: { name: string };
    company: { name: string; isVerified: boolean } | null;
    externalCompanyName: string | null;
    eligibilityPassed: boolean;
    eligibilityReason: string | null;
    exceptionRequest: {
      id: string;
      status: string;
      reason: string;
      decisionNote: string | null;
    } | null;
  }[];
  internships: {
    id: string;
    student: { fullName: string; studentCode: string };
    period: { name: string };
    facultyEvaluation: { score: number } | null;
    startsAt: string;
    company: { id: string; name: string };
    weeklyReports: { id: string; weekNumber: number; status: string }[];
    companySupervisorAssignments: {
      supervisorId: string;
      supervisor: { user: { fullName: string } };
    }[];
    supervisorEvaluations: { supervisorId: string | null; total: number }[];
    finalGrade: { total: number; letterGrade: string } | null;
  }[];
};
export function FacultyPortal({
  canApprove = true,
  view = "approvals",
  periodId = "",
}: {
  canApprove?: boolean;
  view?: "approvals" | "exceptions" | "grades" | "operations";
  periodId?: string;
}) {
  const [applicationPage, setApplicationPage] = useState(1);
  const [internshipPage, setInternshipPage] = useState(1);
  const [data, setData] = useState<Workspace | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    path: string;
    body: object;
    label: string;
  } | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [workspace, choices] = await Promise.all([
        api<Workspace>(
          `/faculty-workspace?${new URLSearchParams({ view, applicationPage: String(applicationPage), internshipPage: String(internshipPage), ...(periodId ? { periodId } : {}) })}`,
          { signal },
        ),
        api<{ id: string; name: string }[]>("/companies", { signal }),
      ]);
      if (signal?.aborted) return;
      setData(workspace);
      setCompanies(choices);
    },
    [applicationPage, internshipPage, periodId, view],
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    void load(controller.signal).catch((cause: Error) => {
      if (!controller.signal.aborted) setError(cause.message);
    });
    return () => controller.abort();
  }, [load]);
  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(pending.path, {
        method: "POST",
        body: JSON.stringify(pending.body),
      });
      setPending(null);
      setNotice("Đã xử lý thành công.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xử lý.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="student-portal"
      aria-label="Phê duyệt và tổng kết của khoa"
    >
      {error && (
        <p className="login-error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void load()
                .then(() => setError(""))
                .catch((cause: Error) => setError(cause.message))
            }
          >
            Tải lại
          </button>
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {pending && (
        <div
          className="card notice"
          role="region"
          aria-label="Xác nhận thao tác"
        >
          <h3>{pending.label}</h3>
          <p>
            Thao tác được ghi nhật ký. Chốt điểm sẽ khóa các đánh giá và báo cáo
            của kỳ thực tập.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? "Đang xử lý…" : "Xác nhận"}
          </button>{" "}
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Quay lại
          </button>
        </div>
      )}
      {!data ? (
        <p className="empty-state">Đang tải hồ sơ của khoa…</p>
      ) : (
        <>
          {(view === "approvals" || view === "exceptions") &&
            (canApprove ? (
              <section className="card editor">
                <h2>
                  {view === "exceptions"
                    ? "Ngoại lệ học vụ chờ xử lý"
                    : "Hồ sơ chờ phê duyệt"}
                </h2>
                <p>{data.applicationTotal} hồ sơ cần xử lý</p>
                <div className="pagination">
                  <button
                    disabled={applicationPage === 1}
                    onClick={() => setApplicationPage(applicationPage - 1)}
                  >
                    Hồ sơ trước
                  </button>
                  <span>Trang {applicationPage}</span>
                  <button
                    disabled={applicationPage * 20 >= data.applicationTotal}
                    onClick={() => setApplicationPage(applicationPage + 1)}
                  >
                    Hồ sơ tiếp
                  </button>
                </div>
                {!data.applications.length && (
                  <p className="empty-state">Không có hồ sơ chờ duyệt.</p>
                )}
                {data.applications.map((a) => (
                  <article className="portal-entry" key={a.id}>
                    <h3>
                      {a.student.fullName} · {a.student.studentCode}
                    </h3>
                    <p>
                      {a.period.name} ·{" "}
                      {a.company?.name ||
                        a.externalCompanyName ||
                        "Chưa có công ty"}
                    </p>
                    <p>
                      Tín chỉ: {a.student.completedCredits}/
                      {a.student.programCredits}
                    </p>
                    {a.eligibilityReason && <p>{a.eligibilityReason}</p>}
                    {view === "approvals" && (
                      <details>
                        <summary>Từ chối hồ sơ</summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            setPending({
                              path: `/internship-applications/${a.id}/reject`,
                              body: Object.fromEntries(
                                new FormData(e.currentTarget),
                              ),
                              label: `Từ chối hồ sơ của ${a.student.fullName}`,
                            });
                          }}
                        >
                          <label>
                            Lý do từ chối
                            <textarea
                              name="note"
                              minLength={3}
                              maxLength={500}
                              required
                            />
                          </label>
                          <button
                            className="button secondary"
                            disabled={busy || !!pending}
                          >
                            Xem lại quyết định
                          </button>
                        </form>
                      </details>
                    )}
                    {view === "exceptions" && a.exceptionRequest && (
                      <details>
                        <summary>
                          Yêu cầu ngoại lệ ·{" "}
                          {a.exceptionRequest.status === "Pending"
                            ? "Chờ xử lý"
                            : a.exceptionRequest.status === "Approved"
                              ? "Đã duyệt"
                              : "Đã từ chối"}
                        </summary>
                        <p>{a.exceptionRequest.reason}</p>
                        {a.exceptionRequest.decisionNote && (
                          <p>Kết luận: {a.exceptionRequest.decisionNote}</p>
                        )}
                        {a.exceptionRequest.status === "Pending" && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = new FormData(e.currentTarget);
                              setPending({
                                path: `/eligibility-exceptions/${a.exceptionRequest!.id}/${form.get("decision")}`,
                                body: { note: form.get("note") },
                                label: `Xác nhận xử lý ngoại lệ của ${a.student.fullName}`,
                              });
                            }}
                          >
                            <label>
                              Kết luận
                              <select name="decision">
                                <option value="approve">
                                  Chấp nhận ngoại lệ
                                </option>
                                <option value="reject">Từ chối ngoại lệ</option>
                              </select>
                            </label>
                            <label>
                              Lý do
                              <textarea
                                name="note"
                                minLength={3}
                                maxLength={500}
                                required
                              />
                            </label>
                            <button
                              className="button secondary"
                              disabled={busy || !!pending}
                            >
                              Xem lại quyết định
                            </button>
                          </form>
                        )}
                      </details>
                    )}
                    {view === "approvals" &&
                      (a.company?.isVerified &&
                      (a.eligibilityPassed ||
                        a.exceptionRequest?.status === "Approved") ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            setPending({
                              path: `/internship-applications/${a.id}/approve`,
                              body: Object.fromEntries(
                                new FormData(e.currentTarget),
                              ),
                              label: `Duyệt thực tập cho ${a.student.fullName}`,
                            });
                          }}
                        >
                          <label>
                            Giảng viên hướng dẫn
                            <select
                              aria-label="Giảng viên hướng dẫn"
                              name="facultyMentorId"
                              required
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Chọn giảng viên còn quota
                              </option>
                              {data.faculty.map((f) => (
                                <option
                                  key={f.id}
                                  value={f.id}
                                  disabled={
                                    f._count.internships >= f.maxStudents
                                  }
                                >
                                  {f.fullName} · {f._count.internships}/
                                  {f.maxStudents}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Ghi chú
                            <input name="note" maxLength={500} />
                          </label>
                          <button
                            className="button primary"
                            disabled={busy || !!pending}
                          >
                            Xem lại và duyệt
                          </button>
                        </form>
                      ) : (
                        <p className="notice">
                          Cần xác minh doanh nghiệp và hoàn tất điều kiện hoặc
                          ngoại lệ trước khi duyệt.
                        </p>
                      ))}
                  </article>
                ))}
              </section>
            ) : (
              <section className="card">
                <h2>Hồ sơ chờ khoa duyệt</h2>
                <p>{data.applicationTotal} hồ sơ cần xử lý</p>
                <div className="pagination">
                  <button
                    disabled={applicationPage === 1}
                    onClick={() => setApplicationPage(applicationPage - 1)}
                  >
                    Hồ sơ trước
                  </button>
                  <span>Trang {applicationPage}</span>
                  <button
                    disabled={applicationPage * 20 >= data.applicationTotal}
                    onClick={() => setApplicationPage(applicationPage + 1)}
                  >
                    Hồ sơ tiếp
                  </button>
                </div>
                {data.applications.length ? (
                  data.applications.map((a) => (
                    <p key={a.id}>
                      {a.student.fullName} · {a.student.studentCode} ·{" "}
                      {a.period.name}
                    </p>
                  ))
                ) : (
                  <p>Không có hồ sơ chờ duyệt trong phạm vi phụ trách.</p>
                )}
              </section>
            ))}
          {(view === "grades" || view === "operations") && (
            <section className="card">
              <h2>
                {view === "operations"
                  ? "Điều hành thực tập"
                  : "Tổng kết điểm thực tập"}
              </h2>
              <p>
                50% doanh nghiệp + 50% giảng viên hướng dẫn (gồm báo cáo cuối).
              </p>
              {!data.internships.length && (
                <p className="empty-state">Chưa có kỳ thực tập chính thức.</p>
              )}
              <div className="pagination">
                <button
                  disabled={internshipPage === 1}
                  onClick={() => setInternshipPage(internshipPage - 1)}
                >
                  Thực tập trước
                </button>
                <span>
                  {data.internshipTotal} kỳ · Trang {internshipPage}
                </span>
                <button
                  disabled={internshipPage * 20 >= data.internshipTotal}
                  onClick={() => setInternshipPage(internshipPage + 1)}
                >
                  Thực tập tiếp
                </button>
              </div>
              {data.internships.map((item) => {
                const assignments = item.companySupervisorAssignments;
                const scores = item.supervisorEvaluations;
                const complete =
                  assignments.length > 0 &&
                  assignments.length === scores.length &&
                  assignments.every((a) =>
                    scores.some((s) => s.supervisorId === a.supervisorId),
                  );
                const average = complete
                  ? scores.reduce((sum, s) => sum + s.total, 0) / scores.length
                  : null;
                return (
                  <article className="portal-entry" key={item.id}>
                    <h3>
                      {item.student.fullName} · {item.student.studentCode}
                    </h3>
                    <p>{item.period.name}</p>
                    <FilePanel
                      internshipId={item.id}
                      onSaved={() => void load()}
                      supervisors={
                        item.finalGrade || canApprove
                          ? []
                          : item.companySupervisorAssignments.map((a) => ({
                              id: a.supervisorId,
                              name: a.supervisor.user.fullName,
                            }))
                      }
                    />
                    <p>Doanh nghiệp: {item.company.name}</p>
                    {!canApprove &&
                      !item.finalGrade &&
                      Date.now() >= Date.parse(item.startsAt) &&
                      Date.now() < Date.parse(item.startsAt) + 7 * 86400000 && (
                        <details>
                          <summary>Đổi giảng viên hướng dẫn</summary>
                          <p>
                            Điểm giảng viên cũ được lưu vào nhật ký để chấm lại.
                            Báo cáo tuần và điểm doanh nghiệp được giữ nguyên.
                          </p>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              setPending({
                                path: `/internships/${item.id}/faculty-mentor`,
                                body: Object.fromEntries(
                                  new FormData(e.currentTarget),
                                ),
                                label: `Đổi giảng viên và yêu cầu chấm lại cho ${item.student.fullName}`,
                              });
                            }}
                          >
                            <label>
                              Giảng viên mới
                              <select
                                name="facultyMentorId"
                                required
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Chọn giảng viên
                                </option>
                                {data.faculty.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.fullName} ({f._count.internships}/
                                    {f.maxStudents})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Lý do thay đổi
                              <textarea
                                name="reason"
                                required
                                minLength={3}
                                maxLength={500}
                              />
                            </label>
                            <button
                              className="button secondary"
                              disabled={busy || !!pending}
                            >
                              Xem lại yêu cầu
                            </button>
                          </form>
                        </details>
                      )}
                    {!canApprove &&
                      !item.finalGrade &&
                      Date.now() >= Date.parse(item.startsAt) &&
                      Date.now() < Date.parse(item.startsAt) + 7 * 86400000 && (
                        <details>
                          <summary>Đổi doanh nghiệp thực tập</summary>
                          <p>
                            Chỉ trong 7 ngày đầu. Phân công và điểm cũ được lưu
                            vào nhật ký, sau đó bỏ khỏi kết quả hiện tại để chấm
                            lại. Nội dung báo cáo vẫn được giữ.
                          </p>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              setPending({
                                path: `/internships/${item.id}/company`,
                                body: Object.fromEntries(
                                  new FormData(e.currentTarget),
                                ),
                                label: `Đổi doanh nghiệp và yêu cầu chấm lại cho ${item.student.fullName}`,
                              });
                            }}
                          >
                            <label>
                              Doanh nghiệp mới
                              <select name="companyId" required defaultValue="">
                                <option value="" disabled>
                                  Chọn doanh nghiệp đã xác minh
                                </option>
                                {companies
                                  .filter((c) => c.id !== item.company.id)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label>
                              Lý do thay đổi
                              <textarea
                                name="reason"
                                required
                                minLength={3}
                                maxLength={500}
                              />
                            </label>
                            <button
                              className="button secondary"
                              disabled={busy || !!pending}
                            >
                              Xem lại yêu cầu
                            </button>
                          </form>
                        </details>
                      )}
                    {!canApprove &&
                      !item.finalGrade &&
                      Date.now() >= Date.parse(item.startsAt) &&
                      Date.now() < Date.parse(item.startsAt) + 7 * 86400000 &&
                      item.weeklyReports
                        .filter((report) => report.status === "Reviewed")
                        .map((report) => (
                          <details key={report.id}>
                            <summary>
                              Mở khóa báo cáo tuần {report.weekNumber}
                            </summary>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                setPending({
                                  path: `/weekly-reports/${report.id}/unlock`,
                                  body: Object.fromEntries(
                                    new FormData(e.currentTarget),
                                  ),
                                  label: `Mở khóa báo cáo tuần ${report.weekNumber} của ${item.student.fullName}`,
                                });
                              }}
                            >
                              <label>
                                Lý do mở khóa
                                <textarea
                                  name="note"
                                  required
                                  minLength={3}
                                  maxLength={500}
                                />
                              </label>
                              <button
                                className="button secondary"
                                disabled={busy || !!pending}
                              >
                                Xem lại yêu cầu
                              </button>
                            </form>
                          </details>
                        ))}
                    {item.finalGrade ? (
                      <p className="notice">
                        Đã chốt: {item.finalGrade.total}/10 ·{" "}
                        {item.finalGrade.letterGrade} (theo công thức lưu khi
                        chốt)
                      </p>
                    ) : (
                      <>
                        <p>
                          Doanh nghiệp:{" "}
                          {average === null
                            ? `Chưa đủ phiếu (${scores.length}/${assignments.length})`
                            : `${average.toFixed(2)}/10`}{" "}
                          · Giảng viên:{" "}
                          {item.facultyEvaluation?.score ?? "Chưa chấm"}
                        </p>
                        {complete && item.facultyEvaluation && (
                          <p>
                            Điểm dự kiến:{" "}
                            {(
                              (average! + item.facultyEvaluation.score) /
                              2
                            ).toFixed(2)}
                            /10
                          </p>
                        )}
                        {canApprove && (
                          <button
                            className="button primary"
                            disabled={
                              busy ||
                              !!pending ||
                              !complete ||
                              !item.facultyEvaluation
                            }
                            onClick={() =>
                              setPending({
                                path: `/internships/${item.id}/lock-grade`,
                                body: {},
                                label: `Chốt điểm của ${item.student.fullName}`,
                              })
                            }
                          >
                            Chốt điểm
                          </button>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </section>
  );
}

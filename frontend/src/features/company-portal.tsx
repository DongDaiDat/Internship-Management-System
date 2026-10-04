"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { FilePanel } from "./file-panel";

type Evaluation = {
  supervisorId: string;
  discipline: number;
  responsibility: number;
  knowledge: number;
  outcome: number;
  total: number;
};
type Workspace = {
  company: { name: string } | null;
  supervisorId: string | null;
  canManage: boolean;
  supervisors: {
    id: string;
    title: string;
    user: { fullName: string; email: string };
  }[];
  internships: {
    id: string;
    startsAt: string;
    student: { fullName: string; studentCode: string };
    period: { name: string };
    companySupervisorAssignments: { supervisorId: string }[];
    supervisorEvaluations: Evaluation[];
    finalGrade: { total: number; letterGrade: string } | null;
  }[];
};
const criteria = [
  { name: "discipline", label: "Kỷ luật", max: 2 },
  { name: "responsibility", label: "Trách nhiệm", max: 2 },
  { name: "knowledge", label: "Vận dụng chuyên môn", max: 2 },
  { name: "outcome", label: "Kết quả công việc", max: 4 },
] as const;

export function CompanyPortal() {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [credential, setCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const load = useCallback(
    async () => setData(await api<Workspace>("/company-workspace")),
    [],
  );
  useEffect(() => {
    void load().catch((cause: Error) => setError(cause.message));
  }, [load]);
  async function save(path: string, body: object, create = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<
        | { profile: { user: { email: string } }; temporaryPassword: string }
        | undefined
      >(path, { method: "POST", body: JSON.stringify(body) });
      if (create && result)
        setCredential({
          email: result.profile.user.email,
          password: result.temporaryPassword,
        });
      setNotice("Đã lưu thành công.");
      setDirty(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="student-portal" aria-label="Không gian doanh nghiệp">
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
      {!data ? (
        <p className="empty-state">Đang tải doanh nghiệp…</p>
      ) : !data.company ? (
        <p className="card empty-state">
          Tài khoản chưa được liên kết với doanh nghiệp. Vui lòng liên hệ điều
          phối viên.
        </p>
      ) : (
        <>
          <section className="card">
            <p className="eyebrow">DOANH NGHIỆP THỰC TẬP</p>
            <h2>{data.company.name}</h2>
            {data.canManage && !data.supervisorId && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void save("/company-supervisors/self", {})}
              >
                Tôi cũng tham gia hướng dẫn sinh viên
              </button>
            )}
            <p>{data.internships.length} sinh viên trong phạm vi phụ trách</p>
          </section>
          {data.canManage && (
            <section className="card editor">
              <h2>Người hướng dẫn tại doanh nghiệp</h2>
              <p>
                Mỗi nhân viên có tài khoản riêng và chỉ chấm sinh viên được phân
                công.
              </p>
              {credential && (
                <div className="notice" role="status">
                  <p>
                    Thông tin bàn giao chỉ hiển thị tại đây. Người nhận phải đổi
                    mật khẩu khi đăng nhập lần đầu.
                  </p>
                  <p>
                    {credential.email} · <code>{credential.password}</code>
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => setCredential(null)}
                  >
                    Đã bàn giao — ẩn mật khẩu
                  </button>
                </div>
              )}
              {data.supervisors.map((person) => (
                <p key={person.id}>
                  <strong>{person.user.fullName}</strong> · {person.title} ·{" "}
                  {person.user.email}
                </p>
              ))}
              <details>
                <summary>Thêm người hướng dẫn</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(
                      "/company-supervisors",
                      Object.fromEntries(new FormData(e.currentTarget)),
                      true,
                    );
                  }}
                >
                  <fieldset disabled={busy || !!credential}>
                    <label>
                      Họ tên
                      <input
                        name="fullName"
                        minLength={2}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        maxLength={254}
                        required
                      />
                    </label>
                    <label>
                      Chức danh
                      <input
                        name="title"
                        minLength={2}
                        maxLength={120}
                        required
                      />
                    </label>
                    <button className="button primary">Tạo tài khoản</button>
                  </fieldset>
                </form>
              </details>
            </section>
          )}
          {!data.internships.length && (
            <p className="card empty-state">
              Chưa có sinh viên được phân công.
            </p>
          )}
          {!!data.internships.length && (
            <section className="card roster-picker">
              <h2>Hồ sơ sinh viên</h2>
              <p>
                Chọn một sinh viên để xem phân công, minh chứng và phiếu đánh
                giá.
              </p>
              <label>
                Sinh viên · {data.internships.length} hồ sơ
                <select
                  disabled={busy}
                  value={
                    data.internships.some((i) => i.id === selectedId)
                      ? selectedId
                      : data.internships[0]?.id
                  }
                  onChange={(e) => {
                    if (
                      dirty &&
                      !window.confirm(
                        "Nội dung chưa lưu. Bạn muốn chuyển sinh viên?",
                      )
                    )
                      return;
                    setDirty(false);
                    setSelectedId(e.target.value);
                    setNotice("");
                  }}
                >
                  {data.internships.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.student.fullName} · {item.student.studentCode} ·{" "}
                      {item.period.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}
          {data.internships
            .filter(
              (item) =>
                item.id ===
                (data.internships.find((i) => i.id === selectedId)?.id ||
                  data.internships[0]?.id),
            )
            .map((item) => {
              const assigned = item.companySupervisorAssignments.map(
                (a) => a.supervisorId,
              );
              const ownScore = item.supervisorEvaluations.find(
                (e) => e.supervisorId === data.supervisorId,
              );
              const canScore =
                !!data.supervisorId &&
                assigned.includes(data.supervisorId) &&
                !item.finalGrade;
              const elapsed = Date.now() - Date.parse(item.startsAt);
              const canAssign =
                data.canManage &&
                !item.finalGrade &&
                elapsed >= 0 &&
                elapsed < 7 * 86400000;
              const available = data.supervisors.filter(
                (s) => !assigned.includes(s.id),
              );
              return (
                <section
                  className="card editor assignment-detail"
                  key={item.id}
                  onInput={() => setDirty(true)}
                >
                  <p className="eyebrow">{item.period.name}</p>
                  <h2>{item.student.fullName}</h2>
                  <p>{item.student.studentCode}</p>
                  <FilePanel internshipId={item.id} />
                  {data.canManage && (
                    <>
                      <p>
                        Đã nhận {item.supervisorEvaluations.length}/
                        {assigned.length} phiếu chấm doanh nghiệp.
                      </p>
                      {assigned.map((id) => (
                        <p key={id}>
                          {data.supervisors.find((s) => s.id === id)?.user
                            .fullName || "Người hướng dẫn"}{" "}
                          ·{" "}
                          {item.supervisorEvaluations.some(
                            (e) => e.supervisorId === id,
                          )
                            ? "Đã chấm"
                            : "Chưa chấm"}
                        </p>
                      ))}
                      {canAssign && available.length > 0 ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void save(
                              `/internships/${item.id}/company-supervisors`,
                              Object.fromEntries(new FormData(e.currentTarget)),
                            );
                          }}
                        >
                          <label>
                            Phân công thêm người hướng dẫn
                            <select
                              name="supervisorId"
                              required
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Chọn nhân viên
                              </option>
                              {available.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.user.fullName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="button secondary" disabled={busy}>
                            Phân công
                          </button>
                        </form>
                      ) : (
                        <p>
                          Phân công được thực hiện trong 7 ngày đầu thực tập,
                          trước khi chốt điểm.
                        </p>
                      )}
                    </>
                  )}
                  {ownScore && (
                    <p className="notice">
                      Điểm bạn đã chấm: {ownScore.total}/10
                    </p>
                  )}
                  {canScore && (
                    <details className="portal-entry">
                      <summary>
                        {ownScore
                          ? "Cập nhật phiếu đánh giá"
                          : "Chấm điểm sinh viên"}
                      </summary>
                      <p>
                        Phiếu dùng thang 10. Điểm doanh nghiệp là trung bình các
                        phiếu được phân công và chiếm 50% điểm tổng kết.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = new FormData(e.currentTarget);
                          void save(
                            `/internships/${item.id}/company-score`,
                            Object.fromEntries(
                              criteria.map((c) => [
                                c.name,
                                Number(form.get(c.name)),
                              ]),
                            ),
                          );
                        }}
                      >
                        <fieldset disabled={busy}>
                          {criteria.map((c) => (
                            <label key={c.name}>
                              {c.label} (0–{c.max})
                              <input
                                name={c.name}
                                type="number"
                                min={0}
                                max={c.max}
                                step="0.01"
                                required
                                defaultValue={ownScore?.[c.name]}
                              />
                            </label>
                          ))}
                          <button className="button primary">
                            Lưu phiếu đánh giá
                          </button>
                        </fieldset>
                      </form>
                    </details>
                  )}
                  {item.finalGrade && (
                    <p className="notice">
                      Điểm đã chốt: {item.finalGrade.total}/10 ·{" "}
                      {item.finalGrade.letterGrade}. Phiếu đánh giá đã khóa.
                    </p>
                  )}
                </section>
              );
            })}
        </>
      )}
    </section>
  );
}

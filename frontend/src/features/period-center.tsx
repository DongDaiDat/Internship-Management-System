"use client";
import { useCallback, useEffect, useState } from "react";
import { api, CurrentUser } from "../lib/api";
import { AudienceFields, Group, useCatalog } from "./academic-fields";
import { CoordinatorAssignment } from "./internship-hub";
type Period = {
  id: string;
  name: string;
  departmentId: string;
  department: { name: string } | null;
  coordinatorId: string | null;
  status: "Draft" | "Published" | "Closed";
  roundNumber: number;
  semester: number;
  academicYear: string;
  weeklyReportCount: number;
  registrationStartsAt: string;
  registrationEndsAt: string;
  startsAt: string;
  endsAt: string;
  gradingDeadline: string;
  finalizationDeadline: string;
  creditThresholdPercent: number;
  weeklyDeadlines: string[];
  audience: (Group & {
    major: { name: string };
    cohort: { code: string };
    program: { name: string } | null;
  })[];
};
const dateKeys = [
  "registrationStartsAt",
  "registrationEndsAt",
  "startsAt",
  "endsAt",
  "gradingDeadline",
  "finalizationDeadline",
] as const;
const dateLabels = [
  "Mở đăng ký",
  "Đóng đăng ký",
  "Bắt đầu thực tập",
  "Kết thúc thực tập",
  "Hạn chấm điểm",
  "Hạn chốt điểm",
];
function localDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function PeriodCenter({
  user,
  assignment = false,
}: {
  user: CurrentUser;
  assignment?: boolean;
}) {
  const [periods, setPeriods] = useState<Period[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Period | "new" | null>(null),
    [groups, setGroups] = useState<Group[]>([{ majorId: "", cohortId: "" }]),
    [weeks, setWeeks] = useState(6);
  const { catalog } = useCatalog();
  const load = useCallback(async () => {
    try {
      setPeriods(await api<Period[]>("/internship-periods"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const initial = editing && editing !== "new" ? editing : null;
  function open(period: Period | "new") {
    setEditing(period);
    setWeeks(period === "new" ? 6 : period.weeklyReportCount);
    setGroups(
      period === "new"
        ? [{ majorId: "", cohortId: "" }]
        : period.audience.map((g) => ({
            majorId: g.majorId,
            cohortId: g.cohortId,
            ...(g.programId ? { programId: g.programId } : {}),
          })),
    );
  }
  return (
    <>
      <div className="section-title">
        <p>
          {assignment
            ? "Phân công và bàn giao người điều phối trong khoa."
            : "Tổ chức đợt thực tập theo khoa, học kỳ và nhóm sinh viên."}
        </p>
        {!assignment && (
          <button className="button primary" onClick={() => open("new")}>
            ＋ Tạo đợt thực tập
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="login-error">
          {error}
        </p>
      )}
      {editing && (
        <section className="card">
          <h2>{initial ? "Chỉnh sửa bản nháp" : "Tạo đợt thực tập"}</h2>
          <p>
            {catalog?.departments.find((d) => d.id === user.departmentId)
              ?.name || "Cần gán khoa trước khi tạo đợt"}
          </p>
          <form
            className="editor"
            key={initial?.id || "new"}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const fields = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                const payload: Record<string, unknown> = {
                  ...fields,
                  departmentId: user.departmentId,
                  audience: groups,
                  weeklyReportCount: weeks,
                };
                for (const key of dateKeys)
                  payload[key] = new Date(String(fields[key])).toISOString();
                payload.weeklyDeadlines = Array.from(
                  { length: weeks },
                  (_, i) => {
                    delete payload[`week${i}`];
                    return new Date(String(fields[`week${i}`])).toISOString();
                  },
                );
                await api(
                  initial
                    ? `/internship-periods/${initial.id}/update`
                    : "/internship-periods",
                  { method: "POST", body: JSON.stringify(payload) },
                );
                setEditing(null);
                await load();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Không lưu được đợt.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-row">
              <label>
                Số đợt
                <input
                  type="number"
                  name="roundNumber"
                  min={1}
                  max={99}
                  defaultValue={initial?.roundNumber || 1}
                  required
                />
              </label>
              <label>
                Học kỳ
                <select name="semester" defaultValue={initial?.semester || 1}>
                  <option value={1}>Học kỳ 1</option>
                  <option value={2}>Học kỳ 2</option>
                  <option value={3}>Học kỳ 3</option>
                </select>
              </label>
              <label>
                Năm học
                <input
                  name="academicYear"
                  pattern="20[0-9]{2}-20[0-9]{2}"
                  placeholder="2026-2027"
                  defaultValue={initial?.academicYear || "2026-2027"}
                  required
                />
              </label>
            </div>
            <p className="info-note">
              Mã đợt được tạo từ số đợt, học kỳ và năm học, ví dụ
              1_HK1_2026-2027.
            </p>
            <AudienceFields
              groups={groups.length ? groups : [{ majorId: "", cohortId: "" }]}
              onChange={setGroups}
            />
            <fieldset>
              <legend>Lịch thực tập</legend>
              <div className="form-row">
                {dateKeys.map((key, i) => (
                  <label key={key}>
                    {dateLabels[i]}
                    <input
                      name={key}
                      type="datetime-local"
                      defaultValue={localDate(initial?.[key])}
                      required
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-row">
              <label>
                Số tuần báo cáo
                <input
                  type="number"
                  min={6}
                  max={12}
                  value={weeks}
                  onChange={(e) =>
                    setWeeks(Math.min(12, Math.max(6, Number(e.target.value))))
                  }
                />
              </label>
              <label>
                Tín chỉ tối thiểu (%)
                <input
                  type="number"
                  name="creditThresholdPercent"
                  min={1}
                  max={100}
                  defaultValue={initial?.creditThresholdPercent || 80}
                  required
                />
              </label>
            </div>
            <fieldset>
              <legend>Hạn báo cáo từng tuần</legend>
              <div className="form-row">
                {Array.from({ length: weeks }, (_, i) => (
                  <label key={i}>
                    Tuần {i + 1}
                    <input
                      type="datetime-local"
                      name={`week${i}`}
                      required
                      defaultValue={localDate(initial?.weeklyDeadlines[i])}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="toolbar">
              <button
                className="button primary"
                disabled={busy || !user.departmentId}
              >
                {busy ? "Đang lưu…" : "Lưu bản nháp"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}
      {loading ? (
        <p role="status">Đang tải đợt thực tập…</p>
      ) : !periods.length ? (
        <section className="card empty-state">
          <h2>Chưa có đợt thực tập</h2>
          <p>Các đợt trong phạm vi phụ trách sẽ hiển thị tại đây.</p>
        </section>
      ) : (
        <div className="period-grid">
          {periods.map((p) => (
            <section className="card period-card" key={p.id}>
              <div className="section-title">
                <span className="period-symbol">HK{p.semester || "?"}</span>
                <span
                  className={`status ${p.status === "Draft" ? "draft" : ""}`}
                >
                  {p.status === "Draft"
                    ? "Bản nháp"
                    : p.status === "Published"
                      ? "Đã công bố"
                      : "Đã đóng"}
                </span>
              </div>
              <h2>{p.name}</h2>
              <p>{p.department?.name || "Chưa gán khoa"}</p>
              <div className="period-dates">
                <span>
                  Đăng ký
                  <strong>
                    {new Date(p.registrationStartsAt).toLocaleDateString(
                      "vi-VN",
                    )}{" "}
                    –{" "}
                    {new Date(p.registrationEndsAt).toLocaleDateString("vi-VN")}
                  </strong>
                </span>
                <span>
                  Thực tập
                  <strong>
                    {new Date(p.startsAt).toLocaleDateString("vi-VN")} –{" "}
                    {new Date(p.endsAt).toLocaleDateString("vi-VN")}
                  </strong>
                </span>
              </div>
              <div className="audience-tags">
                {p.audience.map((g, i) => (
                  <span key={i}>
                    {g.major.name} · {g.cohort.code}
                    {g.program ? ` · ${g.program.name}` : " · Mọi chương trình"}
                  </span>
                ))}
              </div>
              {!assignment && p.status !== "Draft" && !p.audience.length && (
                <LegacyAcademicForm period={p} onSaved={load} />
              )}
              {assignment ? (
                <CoordinatorAssignment period={p} onSaved={() => void load()} />
              ) : (
                p.status === "Draft" && (
                  <div className="toolbar">
                    <button
                      className="button secondary"
                      onClick={() => open(p)}
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(`/internship-periods/${p.id}/publish`, {
                            method: "POST",
                          });
                          await load();
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Không thể công bố.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Công bố đợt
                    </button>
                  </div>
                )
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function LegacyAcademicForm({
  period,
  onSaved,
}: {
  period: Period;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [groups, setGroups] = useState<Group[]>([
    { majorId: "", cohortId: "" },
  ]);
  if (!open)
    return (
      <button className="button secondary" onClick={() => setOpen(true)}>
        Hoàn thiện học vụ đợt cũ
      </button>
    );
  return (
    <form
      className="editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const fields = Object.fromEntries(new FormData(e.currentTarget));
        try {
          await api(`/internship-periods/${period.id}/complete-academic`, {
            method: "POST",
            body: JSON.stringify({
              ...fields,
              departmentId: period.departmentId,
              audience: groups,
            }),
          });
          await onSaved();
          setOpen(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Không thể hoàn thiện.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Giữ nguyên lịch và lịch sử thực tập. Đối tượng phải bao gồm mọi sinh
        viên đã đăng ký; cấu hình được khóa sau khi lưu.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        Số đợt
        <input
          name="roundNumber"
          type="number"
          min={1}
          max={99}
          defaultValue={period.roundNumber || 1}
          required
        />
      </label>
      <label>
        Học kỳ
        <select name="semester" defaultValue={period.semester || 1}>
          <option value={1}>HK1</option>
          <option value={2}>HK2</option>
          <option value={3}>HK3</option>
        </select>
      </label>
      <label>
        Năm học
        <input
          name="academicYear"
          pattern="20[0-9]{2}-20[0-9]{2}"
          placeholder="2026-2027"
          defaultValue={period.academicYear || ""}
          required
        />
      </label>
      <AudienceFields groups={groups} onChange={setGroups} />
      <button className="button primary" disabled={busy}>
        Lưu thông tin học vụ
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => setOpen(false)}
      >
        Hủy
      </button>
    </form>
  );
}

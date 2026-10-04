"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Catalog, Entry } from "./academic-fields";
export function CatalogCenter() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [kind, setKind] = useState("departments");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState<
    { id: string; type: string; fullName: string }[]
  >([]);
  function load() {
    void api<Catalog>("/academic")
      .then(setCatalog)
      .catch((e) => setError(e.message));
    void api<typeof legacy>("/users/unassigned")
      .then(setLegacy)
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);
  if (!catalog) return <p role="status">{error || "Đang tải danh mục…"}</p>;
  const labels: Record<string, string> = {
    departments: "Khoa",
    majors: "Ngành",
    programs: "Chương trình",
    cohorts: "Khóa",
    links: "Khoa quản lý chương trình",
  };
  const items = catalog[kind as keyof Catalog] as unknown as Record<
    string,
    unknown
  >[];
  const options = (entries: Entry[]) =>
    entries.map((e) => (
      <option key={e.id} value={e.id}>
        {e.name} · {e.code}
      </option>
    ));
  return (
    <>
      <section className="card">
        <div className="section-title">
          <div>
            <span className="eyebrow">CẤU TRÚC ĐÀO TẠO</span>
            <h2>Danh mục của trường</h2>
          </div>
          <button className="button primary" onClick={() => setEditing({})}>
            ＋ Thêm {labels[kind].toLowerCase()}
          </button>
        </div>
        <div className="segmented-tabs">
          {Object.entries(labels).map(([key, label]) => (
            <button
              key={key}
              className={kind === key ? "active" : ""}
              onClick={() => {
                setKind(key);
                setEditing(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        {editing && (
          <form
            className="editor catalog-form"
            key={kind + String(editing.id)}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const values = Object.fromEntries(new FormData(e.currentTarget));
              const data = {
                ...values,
                ...(editing.id ? { id: editing.id } : {}),
                isActive: values.isActive === "true",
                confirmed: values.confirmed === "true",
              };
              try {
                await api(`/academic/${kind}`, {
                  method: "POST",
                  body: JSON.stringify({ data }),
                });
                setEditing(null);
                load();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Không lưu được danh mục.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {kind !== "links" && (
              <div className="form-row">
                <label>
                  Mã
                  <input
                    name="code"
                    required
                    maxLength={30}
                    defaultValue={String(editing.code || "")}
                  />
                </label>
                <label>
                  Tên
                  <input
                    name="name"
                    required
                    maxLength={160}
                    defaultValue={String(editing.name || "")}
                  />
                </label>
                <label>
                  Trạng thái
                  <select
                    name="isActive"
                    defaultValue={String(editing.isActive ?? true)}
                  >
                    <option value="true">Đang sử dụng</option>
                    <option value="false">Ngừng sử dụng</option>
                  </select>
                </label>
              </div>
            )}
            {kind === "programs" && (
              <label>
                Ngành
                <select
                  name="majorId"
                  required
                  defaultValue={String(editing.majorId || "")}
                >
                  <option value="">Chọn ngành</option>
                  {options(catalog.majors)}
                </select>
              </label>
            )}
            {kind === "cohorts" && (
              <div className="form-row">
                <label>
                  Số khóa
                  <input
                    name="number"
                    type="number"
                    min={1}
                    required
                    defaultValue={Number(editing.number) || ""}
                  />
                </label>
                <label>
                  Năm nhập học
                  <input
                    name="admissionYear"
                    type="number"
                    min={2000}
                    max={2200}
                    required
                    defaultValue={Number(editing.admissionYear) || ""}
                  />
                </label>
              </div>
            )}
            {kind === "links" && (
              <>
                <div className="form-row">
                  <label>
                    Khoa
                    <select
                      name="departmentId"
                      required
                      defaultValue={String(editing.departmentId || "")}
                    >
                      <option value="">Chọn khoa</option>
                      {options(catalog.departments)}
                    </select>
                  </label>
                  <label>
                    Chương trình
                    <select
                      name="programId"
                      required
                      defaultValue={String(editing.programId || "")}
                    >
                      <option value="">Chọn chương trình</option>
                      {options(catalog.programs)}
                    </select>
                  </label>
                </div>
                <label>
                  Nguồn xác nhận
                  <input
                    name="source"
                    type="url"
                    required
                    defaultValue={String(editing.source || "")}
                  />
                </label>
                <label>
                  Trạng thái
                  <select
                    name="confirmed"
                    defaultValue={String(editing.confirmed ?? false)}
                  >
                    <option value="false">Chưa xác nhận</option>
                    <option value="true">Đã xác nhận</option>
                  </select>
                </label>
              </>
            )}
            <div className="toolbar">
              <button className="button primary" disabled={busy}>
                Lưu danh mục
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
            </div>
          </form>
        )}
        <div className="table-scroll">
          <table className="users-table">
            <thead>
              <tr>
                <th>Mã / Khoa</th>
                <th>Tên / Chương trình</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={String(item.id)}>
                  <td>
                    {String(
                      item.code ||
                        catalog.departments.find(
                          (d) => d.id === item.departmentId,
                        )?.name ||
                        "",
                    )}
                  </td>
                  <td>
                    {String(
                      item.name ||
                        catalog.programs.find((p) => p.id === item.programId)
                          ?.name ||
                        "",
                    )}
                    {typeof item.source === "string" && (
                      <small>
                        <a href={item.source} target="_blank" rel="noreferrer">
                          Nguồn tham khảo
                        </a>
                      </small>
                    )}
                  </td>
                  <td>
                    {kind === "links"
                      ? item.confirmed
                        ? "Đã xác nhận"
                        : "Cần xác nhận"
                      : item.isActive
                        ? "Đang sử dụng"
                        : "Ngừng sử dụng"}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setEditing(item)}
                    >
                      Chỉnh sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Dữ liệu cũ chưa được phân khoa</h2>
        <p>
          Phân về khoa để điều phối viên hoàn thiện hồ sơ. Thao tác này không
          thay đổi nội dung học vụ.
        </p>
        {legacy.length ? (
          legacy.map((item) => (
            <form
              key={item.type + item.id}
              className="legacy-row"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("/users/assign-legacy", {
                    method: "POST",
                    body: JSON.stringify({
                      id: item.id,
                      type: item.type,
                      departmentId: new FormData(e.currentTarget).get(
                        "departmentId",
                      ),
                    }),
                  });
                  load();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Không phân khoa được.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <strong>
                {item.fullName}
                <small>{item.type}</small>
              </strong>
              <select
                name="departmentId"
                aria-label={`Khoa của ${item.fullName}`}
                required
              >
                <option value="">Chọn khoa</option>
                {options(catalog.departments)}
              </select>
              <button className="button secondary" disabled={busy}>
                Phân khoa
              </button>
            </form>
          ))
        ) : (
          <p className="empty-state">Không có dữ liệu cần phân khoa.</p>
        )}
      </section>
    </>
  );
}

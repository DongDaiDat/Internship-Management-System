"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
export type Entry = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  majorId?: string;
  number?: number;
  admissionYear?: number;
};
export type Catalog = {
  departments: Entry[];
  majors: Entry[];
  programs: Entry[];
  cohorts: Entry[];
  links: {
    id: string;
    departmentId: string;
    programId: string;
    confirmed: boolean;
    source: string;
  }[];
};
export const DepartmentContext = createContext("");
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Catalog>("/academic", { signal: controller.signal })
      .then(setCatalog)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  return { catalog, error };
}
export function Choice({
  name,
  label,
  value,
  onChange,
  items,
  required = true,
}: {
  name?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: Entry[];
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        name={name}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {required ? "Chọn " + label.toLowerCase() : label.toLowerCase().includes("chương trình") ? "Tất cả chương trình" : "Chưa chọn " + label.toLowerCase()}
        </option>
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name} · {x.code}
          </option>
        ))}
      </select>
    </label>
  );
}
export function StudentAcademicFields({
  initial,
}: {
  initial?: Record<string, unknown>;
}) {
  const departmentId = useContext(DepartmentContext);
  const { catalog, error } = useCatalog();
  const [majorId, setMajor] = useState(String(initial?.majorId || ""));
  const [programId, setProgram] = useState(String(initial?.programId || ""));
  const [cohortId, setCohort] = useState(String(initial?.cohortId || ""));
  if (!catalog)
    return <p role="status">{error || "Đang tải danh mục đào tạo…"}</p>;
  const programs = catalog.programs.filter(
    (p) =>
      p.isActive &&
      catalog.links.some(
        (l) =>
          l.confirmed &&
          l.programId === p.id &&
          l.departmentId === departmentId,
      ),
  );
  return (
    <fieldset className="academic-fields">
      <legend>Thông tin đào tạo</legend>
      <p>
        {catalog.departments.find((d) => d.id === departmentId)?.name ||
          "Tài khoản chưa được gán khoa"}
      </p>
      <div className="form-row">
        <Choice
          name="majorId"
          label="Ngành"
          value={majorId}
          onChange={(v) => {
            setMajor(v);
            setProgram("");
          }}
          items={catalog.majors.filter(
            (m) => m.isActive && programs.some((p) => p.majorId === m.id),
          )}
        />
        <Choice
          name="programId"
          label="Chương trình"
          value={programId}
          onChange={setProgram}
          items={programs.filter((p) => p.majorId === majorId)}
        />
        <Choice
          name="cohortId"
          label="Khóa"
          value={cohortId}
          onChange={setCohort}
          items={catalog.cohorts.filter((c) => c.isActive)}
        />
      </div>
      <input
        type="hidden"
        name="cohort"
        value={catalog.cohorts.find((c) => c.id === cohortId)?.code || ""}
      />
      <input
        type="hidden"
        name="major"
        value={catalog.majors.find((m) => m.id === majorId)?.name || ""}
      />
    </fieldset>
  );
}
export type Group = { majorId: string; cohortId: string; programId?: string };
export function AudienceFields({
  groups,
  onChange,
}: {
  groups: Group[];
  onChange: (groups: Group[]) => void;
}) {
  const departmentId = useContext(DepartmentContext);
  const { catalog, error } = useCatalog();
  if (!catalog) return <p>{error || "Đang tải đối tượng…"}</p>;
  const programs = catalog.programs.filter(
    (p) =>
      p.isActive &&
      catalog.links.some(
        (l) =>
          l.confirmed &&
          l.departmentId === departmentId &&
          l.programId === p.id,
      ),
  );
  return (
    <fieldset className="academic-fields">
      <legend>Đối tượng được đăng ký</legend>
      <p>
        Sinh viên chỉ cần thuộc một nhóm dưới đây. Các điều kiện trong cùng nhóm
        phải đồng thời phù hợp.
      </p>
      {groups.map((g, i) => (
        <div className="audience-row" key={i}>
          <Choice
            label="Ngành"
            value={g.majorId}
            items={catalog.majors.filter(
              (m) => m.isActive && programs.some((p) => p.majorId === m.id),
            )}
            onChange={(v) =>
              onChange(
                groups.map((x, j) =>
                  j === i ? { ...x, majorId: v, programId: undefined } : x,
                ),
              )
            }
          />
          <Choice
            label="Khóa"
            value={g.cohortId}
            items={catalog.cohorts.filter((c) => c.isActive)}
            onChange={(v) =>
              onChange(
                groups.map((x, j) => (j === i ? { ...x, cohortId: v } : x)),
              )
            }
          />
          <Choice
            label="Chương trình"
            required={false}
            value={g.programId || ""}
            items={programs.filter((p) => p.majorId === g.majorId)}
            onChange={(v) =>
              onChange(
                groups.map((x, j) =>
                  j === i ? { ...x, programId: v || undefined } : x,
                ),
              )
            }
          />
          <button
            type="button"
            className="text-button"
            disabled={groups.length === 1}
            onClick={() => onChange(groups.filter((_, j) => i !== j))}
          >
            Bỏ nhóm
          </button>
        </div>
      ))}
      <button
        className="button secondary"
        type="button"
        onClick={() => onChange([...groups, { majorId: "", cohortId: "" }])}
      >
        ＋ Thêm nhóm
      </button>
    </fieldset>
  );
}

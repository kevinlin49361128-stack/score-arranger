/**
 * StudentsDialog — 0.1.39 「我的學生」CRUD 面板
 *
 * 設計範圍 (MVP):
 * - 列表 + 加 / 編 / 刪
 * - 必填: 名字 + 樂器 + 程度 (1-5)
 * - 選填: 自由筆記 (餵 LLM 用)
 * - 全本地, 不雲端
 *
 * 與其他面板整合:
 * - DifficultyBoostDialog 之後加「為 X 學生」下拉, 選後自動填難度 +
 *   把 student.notes 餵給 LLM context
 */

import { useState } from "react";
import {
  addStudent,
  deleteStudent,
  type Student,
  updateStudent,
  useStudents,
} from "../stores/studentStore";
import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
}

const INSTRUMENTS = [
  "violin", "viola", "cello", "double_bass",
  "guitar", "lute", "harp",
  "piano", "harpsichord",
  "flute", "clarinet", "oboe", "bassoon",
  "trumpet", "horn", "trombone", "tuba",
  "voice",
];

export function StudentsDialog({ onClose }: Props) {
  useLocale();
  const students = useStudents();
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 110, display: "flex", alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640, maxHeight: "85vh",
          background: "var(--bg-panel)",
          borderRadius: 8, border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <header style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <strong style={{ flex: 1, fontSize: 14 }}>
            👥 {t("students.title")}
          </strong>
          <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            {t("students.count", { n: students.length })}
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "4px 12px", fontSize: 12,
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)", borderRadius: 4,
              color: "var(--fg-primary)", cursor: "pointer",
            }}
          >
            {t("students.close")}
          </button>
        </header>
        <StudentsPanel />
      </div>
    </div>
  );
}

/**
 * StudentsPanel — 學生 CRUD 內容 (0.1.44 抽出成可重用 panel).
 * TeacherHub 直接嵌, StudentsDialog 包成獨立 modal.
 */
export function StudentsPanel() {
  useLocale();
  const students = useStudents();
  const [editing, setEditing] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div style={{
      padding: 14, overflow: "auto", flex: 1,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <p style={{
        fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.6,
        margin: 0,
      }}>
        {t("students.intro")}
      </p>

      {students.length === 0 && !adding && (
        <div style={{
          padding: 24, textAlign: "center",
          color: "var(--fg-tertiary)", fontSize: 13,
        }}>
          {t("students.empty")}
        </div>
      )}

      {students.map((s) => (
        editing?.id === s.id ? (
          <StudentEditor
            key={s.id}
            initial={s}
            onSave={(patch) => {
              updateStudent(s.id, patch);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onDelete={() => {
              if (window.confirm(t("students.confirmDelete", { name: s.name }))) {
                deleteStudent(s.id);
                setEditing(null);
              }
            }}
          />
        ) : (
          <StudentRow
            key={s.id}
            student={s}
            onEdit={() => setEditing(s)}
          />
        )
      ))}

      {adding && (
        <StudentEditor
          initial={null}
          onSave={(input) => {
            addStudent(input);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: "10px 16px", marginTop: 6,
            background: "var(--accent)", color: "var(--bg-panel)",
            border: "none", borderRadius: 6, cursor: "pointer",
            fontSize: 13, fontWeight: 600,
          }}
        >
          + {t("students.add")}
        </button>
      )}
    </div>
  );
}

function StudentRow({
  student, onEdit,
}: { student: Student; onEdit: () => void }) {
  useLocale();
  return (
    <div
      onClick={onEdit}
      style={{
        padding: "10px 12px", border: "1px solid var(--border-light)",
        borderRadius: 6, cursor: "pointer",
        background: "var(--bg-secondary)",
        display: "flex", alignItems: "center", gap: 10,
      }}
      title={t("students.clickToEdit")}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "var(--accent)", color: "var(--bg-panel)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>
        {student.name.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{student.name}</div>
        <div style={{
          fontSize: 11, color: "var(--fg-muted)", marginTop: 2,
        }}>
          {student.instrument} · {t("students.gradeLabel", {
            grade: student.skill_level,
          })}
          {student.notes && (
            <span style={{ marginLeft: 6, opacity: 0.85 }}>
              · {student.notes.length > 40
                ? student.notes.slice(0, 40) + "…"
                : student.notes}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface EditorProps {
  initial: Student | null;
  onSave: (input: Omit<Student, "id" | "updated_at">) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function StudentEditor({ initial, onSave, onCancel, onDelete }: EditorProps) {
  useLocale();
  const [name, setName] = useState(initial?.name ?? "");
  const [instrument, setInstrument] = useState(initial?.instrument ?? "violin");
  const [skill, setSkill] = useState<Student["skill_level"]>(
    initial?.skill_level ?? 3,
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const canSave = name.trim().length > 0;
  return (
    <div style={{
      padding: 12, border: "1px solid var(--accent)", borderRadius: 6,
      background: "var(--bg-secondary)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("students.namePlaceholder")}
          style={inputStyle}
        />
        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          style={inputStyle}
        >
          {INSTRUMENTS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select
          value={skill}
          onChange={(e) =>
            setSkill(Number(e.target.value) as Student["skill_level"])}
          style={inputStyle}
          title={t("students.gradeTip")}
        >
          {[1, 2, 3, 4, 5].map((g) => (
            <option key={g} value={g}>
              {t("students.gradeLabel", { grade: g })}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("students.notesPlaceholder")}
        rows={2}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => canSave && onSave({
            name: name.trim(), instrument, skill_level: skill,
            notes: notes.trim(),
          })}
          disabled={!canSave}
          style={{
            flex: 1, padding: "6px 12px",
            background: "var(--accent)", color: "var(--bg-panel)",
            border: "none", borderRadius: 4, cursor: canSave ? "pointer" : "default",
            fontSize: 12, fontWeight: 600,
            opacity: canSave ? 1 : 0.5,
          }}
        >
          {t("students.save")}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 12px", fontSize: 12,
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)", borderRadius: 4,
            color: "var(--fg-primary)", cursor: "pointer",
          }}
        >
          {t("students.cancel")}
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              padding: "6px 12px", fontSize: 12,
              background: "transparent",
              border: "1px solid var(--error-fg)", borderRadius: 4,
              color: "var(--error-fg)", cursor: "pointer",
            }}
          >
            {t("students.delete")}
          </button>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 60,
  padding: "5px 8px", fontSize: 12,
  background: "var(--bg-panel)", color: "var(--fg-primary)",
  border: "1px solid var(--border)", borderRadius: 4,
};

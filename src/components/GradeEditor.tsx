"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Grade, ScoreInput } from "@/types/domain";
import { calculateFinal, PAP_WEIGHTS } from "@/lib/utils/grade-calculator";
import { postJson } from "@/lib/utils/request";
import { Tag, Empty } from "@/components/UI";

const fields: { key: keyof ScoreInput; label: string }[] = [
  { key: "attendance", label: "Hadir" },
  { key: "uts", label: "UTS" },
  { key: "uas", label: "UAS" },
  { key: "daily_task", label: "Harian" },
  { key: "group_task", label: "Kelompok" },
  { key: "major_project", label: "Besar" },
];

const scoreOf = (g: Grade | undefined, autoAttendance = 0): ScoreInput => ({
  attendance: g ? g.score_attendance : autoAttendance,
  uts: g?.score_uts ?? 0,
  uas: g?.score_uas ?? 0,
  daily_task: g?.score_daily_task ?? 0,
  group_task: g?.score_group_task ?? 0,
  major_project: g?.score_major_project ?? 0,
});

export function GradeEditor({
  classId,
  students,
  grades,
  target,
  attendanceRates = {},
}: {
  classId: string;
  students: Profile[];
  grades: Grade[];
  target: number;
  attendanceRates?: Record<string, number>;
}) {
  const [working, setWorking] = useState<Record<string, ScoreInput>>({});
  const [pending, setPending] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const router = useRouter();
  const gradesByStudent = new Map(grades.map((g) => [g.student_id, g]));

  const currentFor = (id: string) =>
    working[id] ?? scoreOf(gradesByStudent.get(id), attendanceRates[id] ?? 0);

  const change = (id: string, key: keyof ScoreInput, text: string) =>
    setWorking((v) => ({
      ...v,
      [id]: {
        ...currentFor(id),
        [key]: Math.max(0, Math.min(100, Number(text) || 0)),
      },
    }));

  const save = async (id: string) => {
    setPending(id);
    setMessages((m) => ({ ...m, [id]: "" }));
    try {
      await postJson("/api/grades", {
        classId,
        studentId: id,
        scores: currentFor(id),
      });
      setMessages((m) => ({ ...m, [id]: "Nilai tersimpan" }));
      router.refresh();
    } catch (e) {
      setMessages((m) => ({
        ...m,
        [id]: e instanceof Error ? e.message : "Gagal menyimpan",
      }));
    } finally {
      setPending("");
    }
  };

  if (!students.length) {
    return (
      <Empty
        icon="people"
        title="Belum ada peserta KRS"
        message="Daftarkan mahasiswa di menu Peserta KRS agar komponen penilaian dapat diisi."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Mahasiswa</th>
            {fields.map((f) => (
              <th key={f.key}>
                {f.label}
                <div style={{ fontWeight: 500 }}>{PAP_WEIGHTS[f.key]}%</div>
              </th>
            ))}
            <th>Nilai Akhir</th>
            <th>Mutu</th>
            <th>Tindakan</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const grade = gradesByStudent.get(student.id);
            const autoAtt = attendanceRates[student.id];
            const scores = currentFor(student.id);
            const hasGrade = Boolean(grade || working[student.id]);
            const final = calculateFinal(scores);
            return (
              <tr key={student.id}>
                <td>
                  <strong>{student.full_name}</strong>
                  <div className="tiny subtle">
                    {student.identity_number}
                    {typeof autoAtt === "number" ? ` · Hadir riil ${autoAtt}%` : ""}
                  </div>
                </td>
                {fields.map((f) => (
                  <td key={f.key}>
                    <input
                      aria-label={`${f.label} ${student.full_name}`}
                      className="grade-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={scores[f.key]}
                      onChange={(e) => change(student.id, f.key, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <strong>{hasGrade ? final.numeric.toFixed(2) : "—"}</strong>
                </td>
                <td>
                  {hasGrade ? (
                    <Tag kind={final.quality >= target ? "good" : "bad"}>
                      {final.letter}
                    </Tag>
                  ) : (
                    <Tag>Belum</Tag>
                  )}
                </td>
                <td>
                  <div className="chip-row">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => save(student.id)}
                      disabled={pending === student.id}
                    >
                      {pending === student.id ? "Menyimpan..." : "Simpan"}
                    </button>
                    {typeof autoAtt === "number" && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="Isi nilai Hadir sesuai persentase presensi riil"
                        onClick={() => change(student.id, "attendance", String(autoAtt))}
                      >
                        Sync Hadir
                      </button>
                    )}
                  </div>
                  {messages[student.id] && (
                    <div className="tiny" style={{ marginTop: 5 }}>
                      {messages[student.id]}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

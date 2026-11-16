"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Meeting } from "@/types/domain";
import { postJson } from "@/lib/utils/request";
import { compressBapImage } from "@/lib/utils/image-compressor";

const WIB_DAY_MAP: Record<string, string> = {
  Sunday: "Minggu",
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
  Saturday: "Sabtu",
};

function isInWibWindow(scheduleDay?: string, startTime?: string, endTime?: string): boolean {
  if (!scheduleDay || !startTime || !endTime) return true;
  const now = new Date();
  const dayEn = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
  }).format(now);
  const wibDay = WIB_DAY_MAP[dayEn] ?? "";
  if (wibDay !== scheduleDay) return false;
  const wibTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return wibTime >= startTime.slice(0, 8) && wibTime <= endTime.slice(0, 8);
}

export function StartMeeting({
  classId,
  enabled,
  scheduleDay,
  startTime,
  endTime,
}: {
  classId: string;
  enabled: boolean;
  scheduleDay?: string;
  startTime?: string;
  endTime?: string;
}) {
  const outsideRegularWindow = !isInWibWindow(scheduleDay, startTime, endTime);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [type, setType] = useState(outsideRegularWindow ? "PENGGANTI" : "KULIAH");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.set("classId", classId);
      form.set("type", type);
      form.set("summary", summary);
      if (photo) {
        const image = await compressBapImage(photo);
        form.set("photo", image);
      }
      const response = await fetch("/api/meetings/start", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Gagal membuka sesi.");
      setOpen(false);
      setSummary("");
      setPhoto(null);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload gagal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-primary"
        disabled={!enabled}
        title={
          !enabled
            ? "Menunggu Validasi Kaprodi & Dekan / Periode PBM nonaktif / Sesi masih LIVE"
            : "Buka pertemuan baru"
        }
        onClick={() => setOpen(true)}
      >
        <i className="bi bi-broadcast" /> Mulai Pertemuan
      </button>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="meeting-heading">
          <div className="modal">
            <div className="modal-header">
              <div>
                <span className="kicker">SESI LIVE</span>
                <h2 id="meeting-heading">Mulai Pertemuan</h2>
              </div>
              <button className="close" aria-label="Tutup" onClick={() => setOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={submit}>
              {outsideRegularWindow && (
                <div className="notice" style={{ marginBottom: 14 }}>
                  <i className="bi bi-clock-history" />
                  <div>
                    <strong>Di luar jadwal reguler</strong>
                    <p>
                      Jenis pertemuan otomatis dipilih <strong>PENGGANTI</strong> agar sesi LIVE
                      dapat dibuka sekarang juga.
                    </p>
                  </div>
                </div>
              )}
              <div className="field">
                <label htmlFor="meeting-type">Jenis pertemuan</label>
                <select
                  id="meeting-type"
                  className="select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {["KULIAH", "PRAKTIKUM", "PENGGANTI", "UTS", "UAS"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="summary">Ringkasan materi</label>
                <textarea
                  id="summary"
                  className="textarea"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="Tuliskan pokok bahasan dan kegiatan pembelajaran..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="photo">Foto kelas / tangkapan layar (opsional)</label>
                <input
                  className="input"
                  type="file"
                  id="photo"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
                <span className="field-hint">
                  Opsional. Jika diisi, gambar otomatis dikonversi ke WebP (maks. 500 KB).
                </span>
              </div>
              {msg && <div className="feedback error">{msg}</div>}
              <div className="form-actions">
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "Menyimpan sesi..." : "Mulai dan kirim notifikasi"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function CheckIn({ meeting, already }: { meeting: Meeting; already: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(already);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const live = meeting.status === "LIVE" && new Date(meeting.ends_at).getTime() > Date.now();
  const click = async () => {
    setBusy(true);
    setMsg("");
    try {
      await postJson("/api/meetings/check-in", { meetingId: meeting.id });
      setDone(true);
      setMsg("Presensi berhasil dicatat.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Presensi gagal.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 12 }}>
      <button
        className={`btn btn-sm ${done ? "btn-green" : "btn-primary"}`}
        disabled={!live || done || busy}
        onClick={click}
      >
        <i className={`bi bi-${done ? "check-circle-fill" : "person-check-fill"}`} />
        {done ? "Sudah hadir" : busy ? "Memproses..." : live ? "Absen Sekarang" : "Presensi ditutup"}
      </button>
      {msg && (
        <p className="tiny" role="status" style={{ margin: "6px 0", color: done ? "#167346" : "#a32430" }}>
          {msg}
        </p>
      )}
    </div>
  );
}

export function EditMeetingSummary({ meeting }: { meeting: Meeting }) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(meeting.summary);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const editable =
    (meeting.status === "LIVE" && new Date(meeting.ends_at).getTime() > Date.now()) ||
    (meeting.override_expires_at !== null &&
      new Date(meeting.override_expires_at).getTime() > Date.now());
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/meetings/summary", { meetingId: meeting.id, summary });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {editable && (
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
          <i className="bi bi-pencil" />
          Edit BAP
        </button>
      )}
      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-bap">
          <div className="modal">
            <div className="modal-header">
              <h2 id="edit-bap">Perbaiki ringkasan BAP</h2>
              <button className="close" aria-label="Tutup" onClick={() => setEditing(false)}>
                ×
              </button>
            </div>
            <textarea
              className="textarea"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            {message && <div className="feedback error">{message}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan BAP"}
              </button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { readClasses } from "@/lib/data";
import { SectionHead, Tag } from "@/components/UI";
import { ActionButton } from "@/components/ActionButton";

export default async function ReviewPage() {
  const { db } = await requireRole("admin", "super_admin");
  const classes = await readClasses(db);

  return (
    <>
      <SectionHead
        eyebrow="OTORISASI KURIKULUM & PBM"
        title="Validasi RPS & Kontrol Kelas"
        subtitle="Persetujuan Kaprodi dan Dekan serta kontrol periode PBM membuka atau mengunci sesi perkuliahan."
      />
      <div className="panel tight">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Mata Kuliah</th>
                <th>Dosen &amp; Kelas</th>
                <th>RPS</th>
                <th>Kaprodi</th>
                <th>Dekan</th>
                <th>Periode PBM</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const nextPbm = c.pbm_period === "on" ? "off" : "on";
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="crumb-link" href={`/kelas/${c.id}/rps`}>
                        <strong>{c.courses.name_id}</strong>
                      </Link>
                      <div className="tiny subtle">{c.courses.course_code} · {c.courses.sks_total} SKS</div>
                    </td>
                    <td>
                      {c.lecturer_directory.full_name}
                      <div className="tiny subtle">{c.class_code} · {c.schedule_day}</div>
                    </td>
                    <td>
                      <Tag kind={c.rps_submitted ? "blue" : "warn"}>
                        {c.rps_submitted ? "Diajukan" : "Draft"}
                      </Tag>
                    </td>
                    <td>
                      <Tag kind={c.rps_validated_kaprodi ? "good" : "warn"}>
                        {c.rps_validated_kaprodi ? "Disetujui" : "Belum"}
                      </Tag>
                    </td>
                    <td>
                      <Tag kind={c.rps_validated_dekan ? "good" : "warn"}>
                        {c.rps_validated_dekan ? "Disetujui" : "Belum"}
                      </Tag>
                    </td>
                    <td>
                      <Tag kind={c.pbm_period === "on" ? "good" : "bad"}>
                        PBM {c.pbm_period.toUpperCase()}
                      </Tag>
                    </td>
                    <td>
                      <div className="form-actions" style={{ margin: 0 }}>
                        {c.rps_submitted && !c.rps_validated_kaprodi && (
                          <ActionButton
                            url="/api/rps/validate"
                            payload={{ classId: c.id, authority: "kaprodi" }}
                            label="Setujui Kaprodi"
                            icon="check-circle"
                            kind="green"
                          />
                        )}
                        {c.rps_submitted && !c.rps_validated_dekan && (
                          <ActionButton
                            url="/api/rps/validate"
                            payload={{ classId: c.id, authority: "dekan" }}
                            label="Setujui Dekan"
                            icon="check-circle"
                            kind="green"
                          />
                        )}
                        <ActionButton
                          url="/api/pbm"
                          payload={{ classId: c.id, state: nextPbm }}
                          label={nextPbm === "off" ? "Nonaktifkan PBM" : "Aktifkan PBM"}
                          icon={nextPbm === "off" ? "pause-circle" : "play-circle"}
                          kind="secondary"
                          confirm={`Ubah status PBM kelas ${c.courses.name_id} (${c.class_code}) menjadi ${nextPbm.toUpperCase()}?`}
                        />
                        <Link href={`/kelas/${c.id}/rps`} className="btn btn-secondary btn-sm">
                          Detail RPS
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

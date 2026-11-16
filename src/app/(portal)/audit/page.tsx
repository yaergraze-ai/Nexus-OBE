import { requireRole } from "@/lib/auth";
import { SectionHead, Tag, Empty } from "@/components/UI";

function formatMetadata(meta: unknown): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "—";
  const entries = Object.entries(meta as Record<string, unknown>);
  if (!entries.length) return "—";
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

export default async function AuditPage() {
  const { db } = await requireRole("super_admin");
  const [{ data, error }, { data: profiles }] = await Promise.all([
    db
      .from("audit_logs")
      .select("id,actor_id,action,target_table,target_id,ip_address,created_at,metadata")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("profiles").select("id,full_name,identity_number,role"),
  ]);
  if (error) throw new Error(error.message);

  const actors = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      `${p.full_name} (${p.identity_number})`,
    ])
  );

  return (
    <>
      <SectionHead
        eyebrow="KEAMANAN & TATA KELOLA"
        title="Audit Sistem"
        subtitle="Catatan aktivitas penting · Append-only di database PostgreSQL (200 entri terkini)"
      />
      {data?.length ? (
        <div className="panel tight">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu WIB</th>
                  <th>Pelaku</th>
                  <th>Aktivitas</th>
                  <th>Entitas &amp; Detail</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {new Date(a.created_at).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                      })}
                    </td>
                    <td>
                      <strong>{(a.actor_id && actors.get(a.actor_id)) || "Sistem / Anonim"}</strong>
                    </td>
                    <td>
                      <Tag kind={a.action.includes("FAIL") ? "bad" : "blue"}>
                        {a.action}
                      </Tag>
                    </td>
                    <td className="tiny">
                      <div>{a.target_table}</div>
                      <div className="subtle">{formatMetadata(a.metadata)}</div>
                    </td>
                    <td className="tiny">{a.ip_address || "Internal"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon="shield-check"
            title="Belum ada log atau akses menunggu migrasi 008"
            message="Aksi validasi, jadwal, nilai, presensi dan status pengguna akan terekam di sini setelah migrasi 008 dijalankan."
          />
        </div>
      )}
    </>
  );
}

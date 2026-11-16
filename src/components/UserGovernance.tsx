"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Role } from "@/types/domain";
import { ROLE_LABEL } from "@/types/domain";
import { postJson } from "@/lib/utils/request";
import { Tag } from "@/components/UI";

export function UserGovernance({
  users,
  currentId,
}: {
  users: Profile[];
  currentId: string;
}) {
  const [pending, setPending] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [identity, setIdentity] = useState("");
  const [newRole, setNewRole] = useState<Role>("dosen");
  const [pwMode, setPwMode] = useState<"invite" | "identity">("identity");
  const [inviteMessage, setInviteMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const router = useRouter();

  const change = async (id: string, role: Role) => {
    if (!window.confirm(`Ubah role menjadi ${ROLE_LABEL[role]}?`)) return;
    setPending(id);
    try {
      await postJson("/api/users/role", { userId: id, role });
      setMessages((m) => ({ ...m, [id]: "Role diperbarui" }));
      router.refresh();
    } catch (e) {
      setMessages((m) => ({
        ...m,
        [id]: e instanceof Error ? e.message : "Gagal",
      }));
    } finally {
      setPending("");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending("create");
    setCreateError("");
    try {
      const res = await postJson<{ invited?: boolean }>("/api/users/create", {
        email,
        fullName,
        identityNumber: identity,
        role: newRole,
        initialPasswordMode: pwMode,
      });
      setInviteMessage(
        res.invited
          ? "Undangan aman dikirim ke email pengguna. Pengguna membuat sandinya sendiri."
          : "Akun diaktifkan dengan kata sandi awal sama dengan NIM/NIDN dan wajib diganti saat login."
      );
      setShowNew(false);
      setFullName("");
      setEmail("");
      setIdentity("");
      router.refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Pembuatan akun gagal");
    } finally {
      setPending("");
    }
  };

  return (
    <>
      <div
        className="form-actions"
        style={{ justifyContent: "flex-end", margin: "0 0 18px" }}
      >
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <i className="bi bi-person-plus" /> Tambah Pengguna
        </button>
      </div>
      {inviteMessage && (
        <div className="notice" style={{ marginBottom: 18 }} role="status">
          {inviteMessage}
        </div>
      )}
      <div className="panel tight">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Nomor Induk</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Pengaturan Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.full_name}</strong>
                    <div className="tiny subtle">{u.email}</div>
                  </td>
                  <td>{u.identity_number}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>
                    <Tag kind={u.is_active ? "good" : "bad"}>
                      {u.is_active ? "Aktif" : "Nonaktif"}
                    </Tag>
                  </td>
                  <td>
                    {u.id !== currentId ? (
                      <select
                        className="select"
                        disabled={pending === u.id}
                        aria-label={`Peran ${u.full_name}`}
                        value={u.role}
                        onChange={(e) => change(u.id, e.target.value as Role)}
                      >
                        {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                          <option value={role} key={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="subtle tiny">Akun Anda</span>
                    )}
                    {messages[u.id] && <div className="tiny">{messages[u.id]}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="newuser"
        >
          <div className="modal">
            <div className="modal-header">
              <h2 id="newuser">Buat Akun Institusi</h2>
              <button
                className="close"
                aria-label="Tutup"
                onClick={() => setShowNew(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={create}>
              <div className="field">
                <label>Nama lengkap</label>
                <input
                  required
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>Email</label>
                <input
                  required
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>NIM / NIDN</label>
                <input
                  required
                  className="input"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>Peran</label>
                <select
                  className="select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                    <option value={role} key={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>Aktivasi sandi awal</label>
                <select
                  className="select"
                  value={pwMode}
                  onChange={(e) =>
                    setPwMode(e.target.value as "invite" | "identity")
                  }
                >
                  <option value="identity">
                    Sandi awal = NIM / NIDN (wajib ganti di portal)
                  </option>
                  <option value="invite">
                    Kirim undangan email (buat sandi via tautan)
                  </option>
                </select>
              </div>
              {createError && <div className="feedback error">{createError}</div>}
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  disabled={pending === "create"}
                >
                  {pending === "create"
                    ? "Memproses..."
                    : pwMode === "invite"
                      ? "Kirim Undangan"
                      : "Buat Akun"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setShowNew(false)}
                >
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

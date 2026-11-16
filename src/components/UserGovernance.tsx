"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Role } from "@/types/domain";
import { ROLE_LABEL } from "@/types/domain";
import { postJson } from "@/lib/utils/request";
import { Empty, Tag } from "@/components/UI";

export function UserGovernance({
  users,
  currentId,
}: {
  users: Profile[];
  currentId: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
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

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
      mahasiswa: users.filter((u) => u.role === "mahasiswa").length,
      dosen: users.filter((u) => u.role === "dosen").length,
      managers: users.filter((u) => u.role === "admin" || u.role === "super_admin").length,
    }),
    [users]
  );

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [u.full_name, u.email, u.identity_number, ROLE_LABEL[u.role]]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }),
    [users, query, roleFilter]
  );

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

  const toggleStatus = async (u: Profile) => {
    const next = !u.is_active;
    if (
      !window.confirm(
        next
          ? `Aktifkan kembali akun ${u.full_name}?`
          : `Nonaktifkan akun ${u.full_name}? Pengguna tidak akan bisa masuk.`
      )
    ) {
      return;
    }
    setPending(`status:${u.id}`);
    try {
      await postJson("/api/users/status", { userId: u.id, isActive: next });
      setMessages((m) => ({
        ...m,
        [u.id]: next ? "Akun diaktifkan" : "Akun dinonaktifkan",
      }));
      router.refresh();
    } catch (e) {
      setMessages((m) => ({
        ...m,
        [u.id]: e instanceof Error ? e.message : "Gagal mengubah status",
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
      <div className="chip-row" style={{ marginBottom: 16 }}>
        <Tag kind="blue">Total: {stats.total}</Tag>
        <Tag kind="good">Aktif: {stats.active}</Tag>
        <Tag kind="bad">Nonaktif: {stats.inactive}</Tag>
        <Tag kind="neutral">Mahasiswa: {stats.mahasiswa}</Tag>
        <Tag kind="neutral">Dosen: {stats.dosen}</Tag>
        <Tag kind="neutral">Pengelola: {stats.managers}</Tag>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <label className="search">
          <i className="bi bi-search" />
          <input
            aria-label="Cari pengguna"
            placeholder="Cari nama, NIM/NIDN, atau email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter peran"
          className="select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "ALL" | Role)}
        >
          <option value="ALL">Semua Peran ({users.length})</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <i className="bi bi-person-plus" /> Tambah Pengguna
        </button>
      </div>

      {inviteMessage && (
        <div className="notice" style={{ marginBottom: 18 }} role="status">
          {inviteMessage}
        </div>
      )}

      {users.length === 0 ? (
        <div className="panel">
          <Empty
            icon="shield-exclamation"
            title="Daftar pengguna menunggu migrasi SQL 008"
            message="Jalankan supabase/migrations/008_usable_portal_fixes.sql di Supabase SQL Editor agar Super Admin & Admin dapat mengelola data tanpa wajib mengaktifkan 2FA terlebih dahulu."
          />
        </div>
      ) : (
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
                  <th>Aksi Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
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
                          disabled={pending !== ""}
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
                    <td>
                      {u.id !== currentId ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={pending !== ""}
                          onClick={() => toggleStatus(u)}
                        >
                          <i className={`bi bi-${u.is_active ? "person-x" : "person-check"}`} />{" "}
                          {pending === `status:${u.id}`
                            ? "Memproses..."
                            : u.is_active
                              ? "Nonaktifkan"
                              : "Aktifkan"}
                        </button>
                      ) : (
                        <span className="subtle tiny">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

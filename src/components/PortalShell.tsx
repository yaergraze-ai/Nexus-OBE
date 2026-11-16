"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import type { Profile, Role } from "@/types/domain";
import { browserClient } from "@/lib/supabase/browser";
import { ROLE_LABEL } from "@/types/domain";

const menus: { label: string; path: string; icon: string; roles?: Role[] }[] = [
  { label: "Dashboard", path: "/dashboard", icon: "house-door-fill" },
  { label: "Kelas Kuliah", path: "/kelas", icon: "journal-bookmark-fill" },
  { label: "Jadwal Akademik", path: "/jadwal", icon: "calendar3" },
  { label: "Tugas & Pengumpulan", path: "/tugas", icon: "clipboard2-check" },
  { label: "Pengumuman", path: "/pengumuman", icon: "megaphone" },
  { label: "Peserta KRS", path: "/krs", icon: "people", roles: ["admin", "super_admin"] },
  { label: "Input Nilai", path: "/nilai", icon: "clipboard2-data", roles: ["dosen", "admin", "super_admin"] },
  { label: "Validasi RPS", path: "/rps-review", icon: "patch-check-fill", roles: ["admin", "super_admin"] },
  { label: "Pengguna", path: "/pengguna", icon: "people-fill", roles: ["super_admin"] },
  { label: "Audit Sistem", path: "/audit", icon: "shield-lock-fill", roles: ["super_admin"] },
  { label: "Notifikasi", path: "/notifikasi", icon: "bell-fill" },
  { label: "Pengaturan", path: "/pengaturan", icon: "gear-fill" },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0])
    .join("")
    .toUpperCase();
}

export function PortalShell({
  profile,
  children,
  preview = false,
  activeTab,
  onDemoNavigate,
  onDemoRole,
  initialUnread = 0,
  avatarUrl = null,
}: {
  profile: Profile;
  children: React.ReactNode;
  preview?: boolean;
  initialUnread?: number;
  avatarUrl?: string | null;
  activeTab?: string;
  onDemoNavigate?: (path: string) => void;
  onDemoRole?: (role: Role) => void;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [clock, setClock] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [toast, setToast] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date()) + " WIB"
      );
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (preview) return;
    const db = browserClient();
    let active = true;
    const refresh = async () => {
      const { count } = await db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false);
      if (active && count !== null) setUnread(count);
    };
    const channel = db
      .channel(`global-bell-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          void refresh();
          if (payload.eventType === "INSERT") {
            setToast(
              String((payload.new as { title?: string })?.title || "Notifikasi akademik baru")
            );
          }
        }
      )
      .subscribe();
    return () => {
      active = false;
      void db.removeChannel(channel);
    };
  }, [profile.id, preview]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const accessible = menus.filter((m) => !m.roles || m.roles.includes(profile.role));
  const active = (path: string) =>
    preview
      ? activeTab === path
      : pathname === path ||
        pathname.startsWith(path + "/") ||
        (path === "/dashboard" && pathname.startsWith("/dashboard"));
  const activate = (path: string) => {
    if (preview) {
      onDemoNavigate?.(path);
      setOpen(false);
    }
  };
  const nav = (item: (typeof menus)[number]) =>
    preview ? (
      <button
        key={item.path}
        className={`nav-link ${active(item.path) ? "active" : ""}`}
        onClick={() => activate(item.path)}
      >
        <i className={`bi bi-${item.icon}`} />
        <span>{item.label}</span>
      </button>
    ) : (
      <Link
        key={item.path}
        href={item.path}
        className={`nav-link ${active(item.path) ? "active" : ""}`}
      >
        <i className={`bi bi-${item.icon}`} />
        <span>{item.label}</span>
      </Link>
    );

  const bottomItems = ["/dashboard", "/tugas", "/pengumuman", "/notifikasi"].map(
    (p) => menus.find((m) => m.path === p)!
  );
  const bottom = (item: (typeof menus)[number]) =>
    preview ? (
      <button
        key={item.path}
        onClick={() => activate(item.path)}
        className={active(item.path) ? "active" : ""}
      >
        <i className={`bi bi-${item.icon}`} />
        {item.label.split(" ")[0]}
      </button>
    ) : (
      <Link
        key={item.path}
        href={item.path}
        className={active(item.path) ? "active" : ""}
      >
        <i className={`bi bi-${item.icon}`} />
        {item.label.split(" ")[0]}
      </Link>
    );

  const logout = async () => {
    if (preview) {
      onDemoNavigate?.("/dashboard");
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="portal">
        <aside className="sidebar">
          <Link href={preview ? "/demo" : "/dashboard"} className="brand">
            <div className="brand-mark">N</div>
            <div className="brand-words">
              NEXUS<span style={{ color: "var(--wine)" }}> OBE</span>
              <small>ACADEMIC PORTAL</small>
            </div>
          </Link>
          <div className="side-title">Menu Utama</div>
          <nav aria-label="Navigasi utama" className="nav-links">
            {accessible.map(nav)}
          </nav>
          <div className="side-bottom">
            <div className="side-profile">
              <div className="avatar">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={profile.full_name} width={39} height={39} unoptimized className="avatar-img" />
                ) : (
                  initials(profile.full_name)
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{profile.full_name}</strong>
                <span>{ROLE_LABEL[profile.role]}</span>
              </div>
              <button className="side-logout" aria-label="Keluar" onClick={logout}>
                <i className="bi bi-box-arrow-right" />
              </button>
            </div>
          </div>
        </aside>

        <div className="mainwrap">
          {preview && (
            <div className="demo-ribbon">
              PRATINJAU INTERAKTIF · Data contoh, tindakan tidak tersimpan ke Supabase
            </div>
          )}
          <header className="topbar">
            <div className="topbar-left">
              <span className="mobile-menu">
                <span className="brand-mark">N</span>NEXUS OBE
              </span>
              <div className="breadcrumbs">
                Portal Akademik{" "}
                <i className="bi bi-chevron-right" style={{ margin: "0 8px", fontSize: 9 }} />
                <strong>{menus.find((x) => active(x.path))?.label || "Dashboard"}</strong>
              </div>
            </div>
            <div className="topbar-right" ref={menuRef}>
              {preview && onDemoRole && (
                <select
                  className="select tiny"
                  aria-label="Simulasi peran"
                  value={profile.role}
                  onChange={(e) => onDemoRole(e.target.value as Role)}
                >
                  <option value="mahasiswa">Mahasiswa</option>
                  <option value="dosen">Dosen</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              )}
              <div className="top-pill">
                <i className="bi bi-calendar3" />
                2026/2027 Ganjil
              </div>
              <div className="top-pill clock">
                <i className="bi bi-clock" />
                {clock || "WIB"}
              </div>
              {preview ? (
                <button
                  className="icon-button"
                  aria-label="Notifikasi"
                  onClick={() => activate("/notifikasi")}
                >
                  <i className="bi bi-bell" />
                  {unread > 0 && <em />}
                </button>
              ) : (
                <Link href="/notifikasi" className="icon-button" aria-label="Notifikasi">
                  <i className="bi bi-bell" />
                  {unread > 0 && <em />}
                </Link>
              )}
              <button
                className="icon-button"
                aria-label="Profil"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={profile.full_name} width={41} height={41} unoptimized className="topbar-avatar-img" />
                ) : (
                  <i className="bi bi-person-circle" />
                )}
              </button>

              <AnimatePresence>
                {open && (
                  <m.div
                    className="profile-popover"
                    role="dialog"
                    aria-label="Menu profil"
                    initial={reduced ? false : { opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduced ? undefined : { opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div className="avatar">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt={profile.full_name} width={39} height={39} unoptimized className="avatar-img" />
                        ) : (
                          initials(profile.full_name)
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {profile.full_name}
                        </strong>
                        <div className="subtle tiny">{profile.identity_number}</div>
                      </div>
                    </div>
                    <div className="subtle tiny" style={{ overflowWrap: "anywhere" }}>{profile.email}</div>
                    {!preview && (
                      <Link
                        href="/pengaturan"
                        className="btn btn-quiet btn-full"
                        style={{ marginTop: 12 }}
                        onClick={() => setOpen(false)}
                      >
                        <i className="bi bi-person-gear" /> Profil &amp; Ganti PP
                      </Link>
                    )}
                    <button
                      className="btn btn-secondary btn-full"
                      style={{ marginTop: 8 }}
                      onClick={logout}
                    >
                      <i className="bi bi-box-arrow-right" />
                      Keluar
                    </button>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </header>

          <main id="main-content" className="content">
            {children}
          </main>

          <AnimatePresence>
            {!preview && toast && !pathname.startsWith("/notifikasi") && (
              <m.div
                className="toast"
                role="status"
                initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0, y: 12, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <i className="bi bi-bell" /> {toast}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="bottomnav" aria-label="Navigasi seluler">
          {bottomItems.map(bottom)}
        </nav>
      </div>
    </LazyMotion>
  );
}

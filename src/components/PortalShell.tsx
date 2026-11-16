"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  {
    label: "Mahasiswa Diampu",
    path: "/mahasiswa",
    icon: "mortarboard-fill",
    roles: ["dosen", "admin", "super_admin"],
  },
  { label: "Jadwal Akademik", path: "/jadwal", icon: "calendar3" },
  { label: "Tugas & Pengumpulan", path: "/tugas", icon: "clipboard2-check" },
  { label: "Nilai & IPS", path: "/nilai", icon: "clipboard2-data" },
  { label: "Pengumuman", path: "/pengumuman", icon: "megaphone" },
  { label: "Peserta KRS", path: "/krs", icon: "people", roles: ["admin", "super_admin"] },
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
  const router = useRouter();
  const reduced = useReducedMotion();
  const [clock, setClock] = useState("");
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [toast, setToast] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNavLoading(false);
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navLoading) return;
    const t = setTimeout(() => setNavLoading(false), 6000);
    return () => clearTimeout(t);
  }, [navLoading]);

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
    setDrawerOpen(false);
    if (preview) {
      onDemoNavigate?.(path);
      setOpen(false);
      return;
    }
    if (!active(path)) setNavLoading(true);
  };

  const triggerRefresh = () => {
    if (preview) return;
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 900);
  };

  const menuLabel = (item: (typeof menus)[number]) => {
    if (item.path === "/mahasiswa") {
      return profile.role === "dosen" ? "Mahasiswa Diampu" : "Data Mahasiswa";
    }
    if (item.path !== "/nilai") return item.label;
    if (profile.role === "dosen") return "Input Nilai";
    if (profile.role === "admin" || profile.role === "super_admin") {
      return "Rekap Nilai";
    }
    return item.label;
  };

  const nav = (item: (typeof menus)[number]) => {
    const label = menuLabel(item);
    return preview ? (
      <button
        key={item.path}
        title={label}
        className={`nav-link ${active(item.path) ? "active" : ""}`}
        onClick={() => activate(item.path)}
      >
        <i className={`bi bi-${item.icon}`} />
        <span>{label}</span>
      </button>
    ) : (
      <Link
        key={item.path}
        title={label}
        href={item.path}
        className={`nav-link ${active(item.path) ? "active" : ""}`}
        onClick={() => activate(item.path)}
      >
        <i className={`bi bi-${item.icon}`} />
        <span>{label}</span>
      </Link>
    );
  };

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
              <button
                type="button"
                className="mobile-menu"
                aria-label="Buka menu navigasi"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                <i className="bi bi-list" style={{ fontSize: 22 }} aria-hidden="true" />
                <span className="mobile-brand-only">
                  <span className="brand-mark">N</span>
                  <span>NEXUS OBE</span>
                </span>
              </button>
              <div className="breadcrumbs">
                Portal Akademik{" "}
                <i className="bi bi-chevron-right" style={{ margin: "0 8px", fontSize: 9 }} />
                <strong>
                  {(() => {
                    const matched = menus.find((x) => active(x.path));
                    return matched ? menuLabel(matched) : "Dashboard";
                  })()}
                </strong>
              </div>
            </div>
            <div className="topbar-right" ref={menuRef}>
              {(navLoading || refreshing) && (
                <div className="route-spinner-pill" role="status">
                  <span className="spinner-ring sm" aria-hidden="true" />
                  <span>Memuat...</span>
                </div>
              )}
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
              {!preview && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Muat ulang data halaman"
                  title="Muat ulang data"
                  onClick={triggerRefresh}
                >
                  <i className={`bi bi-arrow-clockwise ${refreshing ? "spin-icon" : ""}`} />
                </button>
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
                <Link href="/notifikasi" className="icon-button" aria-label="Notifikasi" onClick={() => activate("/notifikasi")}>
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

        <AnimatePresence>
          {drawerOpen && (
            <m.div
              className="mobile-drawer-backdrop"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            >
              <m.aside
                className="mobile-drawer"
                aria-label="Menu portal seluler"
                initial={reduced ? false : { x: -280 }}
                animate={{ x: 0 }}
                exit={reduced ? undefined : { x: -280 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="brand" style={{ justifyContent: "space-between", height: 70, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="brand-mark" style={{ width: 34, height: 34, fontSize: 18 }}>N</div>
                    <div className="brand-words" style={{ fontSize: 17 }}>
                      NEXUS OBE<small>{ROLE_LABEL[profile.role]}</small>
                    </div>
                  </div>
                  <button type="button" className="close" aria-label="Tutup menu" onClick={() => setDrawerOpen(false)}>
                    ×
                  </button>
                </div>
                <div className="side-title">Menu {ROLE_LABEL[profile.role]}</div>
                <nav className="nav-links" style={{ flex: 1 }}>
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{profile.full_name}</strong>
                      <span>{profile.identity_number}</span>
                    </div>
                    <button className="side-logout" title="Keluar" aria-label="Keluar" onClick={logout}>
                      <i className="bi bi-box-arrow-right" />
                    </button>
                  </div>
                </div>
              </m.aside>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}

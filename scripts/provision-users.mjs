// Jalankan hanya dari terminal operator (bukan browser).
// Mode 1 (otomatis 4 peran untuk uji coba): node scripts/provision-users.mjs --init-roles
// Mode 2 (custom JSON): USERS_JSON='[{"email":"...","identity_number":"0421117105","full_name":"DIAN NOVIANTI","role":"dosen","use_identity_password":true}]' node scripts/provision-users.mjs
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const initRoles = process.argv.includes("--init-roles");

if (!url || !key || (!initRoles && !process.env.USERS_JSON)) {
  throw new Error(
    "Isi NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY (atau .env.local), lalu jalankan dengan --init-roles atau USERS_JSON."
  );
}

const allowed = new Set(["mahasiswa", "dosen", "admin", "super_admin"]);
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertAccount(u) {
  const email = String(u.email).trim().toLowerCase();
  const identityNumber = String(u.identity_number).trim();
  const initialPassword = u.use_identity_password
    ? identityNumber
    : String(u.password ?? "");

  if (!email || initialPassword.length < 8 || !identityNumber || !u.full_name || !allowed.has(u.role)) {
    throw new Error(`Atribut akun ${identityNumber || email} tidak lengkap atau sandi < 8 karakter.`);
  }

  const [byId, byEmail] = await Promise.all([
    supabase.from("profiles").select("id,email,identity_number").eq("identity_number", identityNumber).limit(1),
    supabase.from("profiles").select("id,email,identity_number").eq("email", email).limit(1),
  ]);
  if (byId.error || byEmail.error) throw byId.error || byEmail.error;
  const existing = byId.data?.[0] || byEmail.data?.[0];
  if (existing) {
    stdout.write(`Sudah terdaftar (dilewati): ${existing.identity_number} · ${existing.email}\n`);
    return existing.id;
  }

  const mustChangePassword = Boolean(
    u.must_change_password ?? (u.use_identity_password || initialPassword === identityNumber)
  );

  await supabase.from("account_allowlist").upsert({ email }, { onConflict: "email" });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
  });
  if (error || !data.user) throw error || new Error(`Gagal membuat user ${email}`);

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    identity_number: identityNumber,
    full_name: u.full_name,
    role: u.role,
    must_change_password: mustChangePassword,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }
  stdout.write(`Akun dibuat: ${identityNumber} (${u.role}) -> ${email}\n`);
  return data.user.id;
}

async function promptText(rl, label, fallback = "") {
  const answer = (await rl.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  return answer || fallback;
}

async function promptEmail(rl, label, fallback, usedEmails) {
  while (true) {
    const val = (await promptText(rl, `${label} (tekan Enter untuk default)`, fallback)).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      stdout.write(`  ! "${val}" bukan email. Masukkan email valid (harus ada '@', contoh: nama@gmail.com) atau tekan Enter.\n`);
      continue;
    }
    if (usedEmails.has(val)) {
      stdout.write(`  ! Email ${val} sudah dipakai akun lain. Gunakan email berbeda atau tekan Enter untuk default.\n`);
      continue;
    }
    usedEmails.add(val);
    return val;
  }
}

async function promptPassword(rl, label) {
  while (true) {
    const val = await promptText(rl, label);
    if (val.length < 8) {
      stdout.write("  ! Kata sandi minimal 8 karakter.\n");
      continue;
    }
    return val;
  }
}

if (initRoles) {
  const rl = stdin.isTTY ? createInterface({ input: stdin, output: stdout }) : null;
  try {
    const usedEmails = new Set();
    const kanaEmail =
      process.env.KANA_EMAIL?.trim().toLowerCase() ||
      (rl ? await promptEmail(rl, "Email Kana Nurhana (NIM 240511088, sandi=240511088)", "kana.240511088@kampus.local", usedEmails) : "kana.240511088@kampus.local");
    usedEmails.add(kanaEmail);
    const adminEmail =
      process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
      (rl ? await promptEmail(rl, "Email Admin Akademik (ADMIN-001)", "admin@kampus.local", usedEmails) : "admin@kampus.local");
    usedEmails.add(adminEmail);
    const adminPassword =
      process.env.ADMIN_INITIAL_PASSWORD ||
      (rl ? await promptPassword(rl, "Password awal Admin (min. 8 karakter)") : "");
    const superEmail =
      process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
      (rl ? await promptEmail(rl, "Email Super Admin (SYS-001)", "superadmin@kampus.local", usedEmails) : "superadmin@kampus.local");
    usedEmails.add(superEmail);
    const superPassword =
      process.env.SUPER_ADMIN_INITIAL_PASSWORD ||
      (rl ? await promptPassword(rl, "Password awal Super Admin (min. 8 karakter)") : "");

    if (adminPassword.length < 8 || superPassword.length < 8) {
      throw new Error(
        "Isi password Admin & Super Admin minimal 8 karakter (via prompt atau ADMIN_INITIAL_PASSWORD / SUPER_ADMIN_INITIAL_PASSWORD)."
      );
    }

    // 1. Mahasiswa Kana Nurhana (NIM 240511088, sandi = NIM)
    const kanaId = await upsertAccount({
      email: kanaEmail,
      identity_number: "240511088",
      full_name: "KANA NURHANA",
      role: "mahasiswa",
      use_identity_password: true,
      must_change_password: false,
    });

    // 2. Daftarkan Kana pada kelas non-bentrok agar dashboard & presensi langsung terisi
    const { data: classes } = await supabase
      .from("classes")
      .select("id,class_code")
      .order("class_code", { ascending: true });
    let enrolledCount = 0;
    for (const klass of classes ?? []) {
      const { error: enrollErr } = await supabase
        .from("class_enrollments")
        .upsert({ class_id: klass.id, student_id: kanaId }, { onConflict: "class_id,student_id" });
      if (!enrollErr) enrolledCount += 1;
    }
    stdout.write(`KRS Kana Nurhana terhubung ke ${enrolledCount} kelas aktif.\n`);

    // 3. Semua dosen dari lecturer_directory (sandi awal = NIDN, wajib ganti di dashboard dosen)
    const { data: lecturers } = await supabase
      .from("lecturer_directory")
      .select("identity_number,full_name")
      .order("full_name");
    for (const d of lecturers ?? []) {
      await upsertAccount({
        email: `dosen.${d.identity_number}@kampus.local`,
        identity_number: d.identity_number,
        full_name: d.full_name,
        role: "dosen",
        use_identity_password: true,
        must_change_password: true,
      });
    }

    // 4. Admin & Super Admin
    await upsertAccount({
      email: adminEmail,
      identity_number: "ADMIN-001",
      full_name: "ADMIN AKADEMIK",
      role: "admin",
      password: adminPassword,
      must_change_password: false,
    });
    await upsertAccount({
      email: superEmail,
      identity_number: "SYS-001",
      full_name: "SUPER ADMIN",
      role: "super_admin",
      password: superPassword,
      must_change_password: false,
    });
  } finally {
    rl?.close();
  }
} else {
  const users = JSON.parse(process.env.USERS_JSON);
  if (!Array.isArray(users) || users.length > 100) {
    throw new Error("USERS_JSON harus array dengan maksimal 100 akun");
  }
  for (const u of users) {
    await upsertAccount(u);
  }
}

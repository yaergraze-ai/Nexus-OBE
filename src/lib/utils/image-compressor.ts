/** Konversi ke WebP maksimal 500 KB, batasi dimensi, tanpa mengirim ke server sebelum validasi. */
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

async function encodeCanvasWebp(canvas: HTMLCanvasElement, maxBytes: number, fileName: string) {
  const encode = (q: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Gagal mengompresi foto."))),
        "image/webp",
        q
      )
    );
  let blob = await encode(0.84);
  for (const quality of [0.72, 0.58, 0.44, 0.3]) {
    if (blob.size <= maxBytes) break;
    blob = await encode(quality);
  }
  if (blob.size > maxBytes) {
    throw new Error("Foto terlalu besar. Gunakan gambar beresolusi lebih kecil.");
  }
  return new File([blob], fileName, { type: "image/webp" });
}

export async function compressBapImage(file: File, maxBytes = 500_000): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_SOURCE_BYTES) {
    throw new Error("Pilih JPG/PNG/WebP maksimal 15 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    if (width === 0 || height === 0 || width * height > 40_000_000) {
      throw new Error("Dimensi foto tidak valid.");
    }
    const factor = Math.min(1, 1600 / Math.max(width, height));
    width = Math.max(1, Math.round(width * factor));
    height = Math.max(1, Math.round(height * factor));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await encodeCanvasWebp(canvas, maxBytes, "bap.webp");
  } finally {
    bitmap.close();
  }
}

export async function compressAvatarImage(file: File, maxBytes = 500_000): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_SOURCE_BYTES) {
    throw new Error("Pilih foto profil JPG, PNG, atau WebP maksimal 15 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    if (width === 0 || height === 0 || width * height > 40_000_000) {
      throw new Error("Dimensi foto tidak valid.");
    }
    const side = Math.min(width, height);
    const sx = Math.floor((width - side) / 2);
    const sy = Math.floor((height - side) / 2);
    const target = Math.min(512, side);

    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target);
    return await encodeCanvasWebp(canvas, maxBytes, "avatar.webp");
  } finally {
    bitmap.close();
  }
}

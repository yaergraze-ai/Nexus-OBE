// Run before accessing storage. The server never trusts browser-provided MIME.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_REFERENCE_FILE_BYTES = 50 * 1024 * 1024;
export const ATTACHMENT_BUCKET = "assignment-private";
export const MEETING_REF_BUCKET = "meeting-references";

export type AttachmentCheck = { mime: string; extension: string } | { error: string };

const ASSIGNMENT_FORMATS: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};

export const REFERENCE_FORMATS: Record<string, string> = {
  ...ASSIGNMENT_FORMATS,
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  bib: "application/x-bibtex",
  ris: "application/x-research-info-systems",
};

const magic = (bytes: Uint8Array, prefix: number[]) =>
  bytes.byteLength >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);

function inspectByFormats(
  filename: string,
  bytes: Uint8Array,
  formats: Record<string, string>,
  maxBytes: number,
  reportedSize = bytes.byteLength
): AttachmentCheck {
  if (reportedSize < 1 || reportedSize > maxBytes || bytes.byteLength < 1) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { error: `File wajib berukuran 1 byte hingga ${mb} MB.` };
  }
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const mime = formats[ext];
  if (!mime) {
    return {
      error:
        "Format file tidak didukung. Gunakan PDF, Word (.doc/.docx), ZIP/RAR/7z, Office, gambar, atau catatan teks/BibTeX.",
    };
  }
  if (ext === "pdf" && !magic(bytes, [37, 80, 68, 70, 45])) return { error: "Isi PDF tidak cocok dengan ekstensi." };
  if (ext === "png" && !magic(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return { error: "Isi PNG tidak cocok." };
  if (["jpg", "jpeg"].includes(ext) && !magic(bytes, [255, 216, 255])) return { error: "Isi JPEG tidak cocok." };
  if (ext === "webp" && !(magic(bytes, [82, 73, 70, 70]) && magic(bytes.slice(8), [87, 69, 66, 80]))) {
    return { error: "Isi WebP tidak cocok." };
  }
  if (["zip", "docx", "xlsx", "pptx"].includes(ext) && !magic(bytes, [80, 75, 3, 4])) {
    return { error: "Arsip ZIP/Office tidak cocok." };
  }
  if (["doc", "xls", "ppt"].includes(ext) && !magic(bytes, [208, 207, 17, 224, 161, 177, 26, 225])) {
    return { error: "Dokumen Microsoft Office tidak cocok." };
  }
  if (ext === "rar" && !magic(bytes, [82, 97, 114, 33, 26, 7])) {
    return { error: "Arsip RAR tidak cocok." };
  }
  if (ext === "7z" && !magic(bytes, [55, 122, 188, 175, 39, 28])) {
    return { error: "Arsip 7z tidak cocok." };
  }
  if (["txt", "md", "csv", "bib", "ris"].includes(ext)) {
    const sample = bytes.byteLength >= 1024 ? bytes.slice(0, bytes.byteLength - 4) : bytes;
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(sample);
      if (text.includes("\u0000")) return { error: "File teks tidak valid." };
    } catch {
      return { error: "File teks harus menggunakan UTF-8." };
    }
  }
  return { mime, extension: ext };
}

export function inspectAttachment(filename: string, bytes: Uint8Array): AttachmentCheck {
  return inspectByFormats(filename, bytes, ASSIGNMENT_FORMATS, MAX_ATTACHMENT_BYTES);
}

export function inspectReferenceFile(
  filename: string,
  headerBytes: Uint8Array,
  totalSize = headerBytes.byteLength
): AttachmentCheck {
  return inspectByFormats(
    filename,
    headerBytes,
    REFERENCE_FORMATS,
    MAX_REFERENCE_FILE_BYTES,
    totalSize
  );
}

export function safeFileName(name: string) {
  return name.replace(/[\x00-\x1F\x7F/\\]/g, "_").trim().slice(0, 160) || "lampiran";
}

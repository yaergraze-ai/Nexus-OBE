import test from "node:test";
import assert from "node:assert/strict";
import { detectScheduleConflicts, type WeeklyCandidate } from "../src/lib/utils/schedule-conflicts";
import { inspectAttachment, inspectReferenceFile, safeFileName } from "../src/lib/assignments/attachments";
import { safeExternalUrl } from "../src/lib/assignments/links";
import { wibInput, wibToIso } from "../src/lib/utils/wib";
const first: WeeklyCandidate = { id: "one", academic_year: "2026/2027 Ganjil", class_code: "TI24D", lecturer_identity_number: "L1", schedule_day: "Senin", start_time: "10:00:00", end_time: "12:00:00", room_name: "R 101", uts_schedule: null, uas_schedule: null };
const second: WeeklyCandidate = { ...first, id: "two", class_code: "TI25D", lecturer_identity_number: "L2", room_name: "R 102" };
test("weekly overlaps detect room, lecturer, and cohort independently", () => {
    const overlaps = { ...second, start_time: "11:00:00", end_time: "13:00:00" };
    assert.deepEqual(detectScheduleConflicts(first, [{ ...overlaps, room_name: " r 101 " }]).map(c => c.kind), ["ROOM"]);
    assert.deepEqual(detectScheduleConflicts(first, [{ ...overlaps, lecturer_identity_number: "L1" }]).map(c => c.kind), ["LECTURER"]);
    assert.deepEqual(detectScheduleConflicts(first, [{ ...overlaps, class_code: "TI24D" }]).map(c => c.kind), ["COHORT"]);
});
test("half-open intervals and different academic year do not conflict", () => {
    assert.deepEqual(detectScheduleConflicts(first, [{ ...second, start_time: "12:00", room_name: "R 101" }]), []);
    assert.deepEqual(detectScheduleConflicts(first, [{ ...second, academic_year: "2025/2026 Ganjil", room_name: "R 101" }]), []);
});
test("UTS/UAS collision checks class/lecturer with 120-minute interval", () => {
    const candidate = { ...first, uts_schedule: "2026-12-12T01:00:00Z" };
    assert.deepEqual(detectScheduleConflicts(candidate, [{ ...second, schedule_day: "Selasa", uas_schedule: "2026-12-12T02:59:00Z", class_code: "TI24D" }]).map(x => x.kind), ["EXAM"]);
    assert.deepEqual(detectScheduleConflicts(candidate, [{ ...second, schedule_day: "Selasa", uas_schedule: "2026-12-12T03:00:00Z", class_code: "TI24D" }]), []);
});
test("external links permit GitHub/Drive but reject unsafe schemes and private endpoints", () => {
    for (const url of ["https://github.com/org/project", "https://drive.google.com/file/d/1/view", "https://www.figma.com/file/abc"]) { assert.equal(safeExternalUrl(url), true, url); }
    for (const url of ["javascript:alert(1)", "http://github.com/org/repo", "https://localhost/path", "https://127.0.0.1/x", "https://[::1]/", "https://user:pass@example.com/"]) { assert.equal(safeExternalUrl(url), false, url); }
});
test("file magic bytes reject spoofed extensions", () => {
    assert.deepEqual(inspectAttachment("paper.pdf", new Uint8Array([37, 80, 68, 70, 45, 49])), { mime: "application/pdf", extension: "pdf" });
    assert.ok("error" in inspectAttachment("paper.pdf", new Uint8Array([80, 75, 3, 4, 0])));
    assert.deepEqual(inspectAttachment("project.zip", new Uint8Array([80, 75, 3, 4, 0])), { mime: "application/zip", extension: "zip" });
    assert.ok("error" in inspectAttachment("virus.exe", new Uint8Array([77, 90])));
    assert.equal(safeFileName("../foo\\a.pdf"), ".._foo_a.pdf");
});
test("input date remains Jakarta WIB regardless of server timezone", () => {
    assert.equal(wibToIso("2026-11-16T13:00"), "2026-11-16T06:00:00.000Z");
    assert.equal(wibInput("2026-11-16T06:00:00.000Z"), "2026-11-16T13:00");
    assert.throws(() => wibToIso("2026-02-30T10:00"));
});

test("cross-cohort student enrollment overlap and exam room collision", () => {
    const candidate = { ...first, uts_schedule: "2026-12-12T01:00:00Z" };
    const another = { ...second, schedule_day: "Senin" as const, start_time: "11:00", end_time: "13:00", uas_schedule: "2026-12-12T01:30:00Z" };
    assert.deepEqual(detectScheduleConflicts(candidate, [another], ["one:two"]).map(x => x.kind), ["ENROLLMENT", "EXAM"]);
    assert.deepEqual(detectScheduleConflicts(candidate, [{ ...another, schedule_day: "Selasa" as const, room_name: "R 101" }]).map(x => x.kind), ["EXAM"]);
});

test("meeting reference inspection supports doc, rar, 7z, bib, zip, pdf and blocks spoofing", () => {
    assert.deepEqual(inspectReferenceFile("jurnal.doc", new Uint8Array([208, 207, 17, 224, 161, 177, 26, 225])), { mime: "application/msword", extension: "doc" });
    assert.deepEqual(inspectReferenceFile("bundle.rar", new Uint8Array([82, 97, 114, 33, 26, 7])), { mime: "application/vnd.rar", extension: "rar" });
    assert.deepEqual(inspectReferenceFile("arsip.7z", new Uint8Array([55, 122, 188, 175, 39, 28])), { mime: "application/x-7z-compressed", extension: "7z" });
    assert.deepEqual(inspectReferenceFile("refs.bib", new TextEncoder().encode("@article{key,title={OBE}}")), { mime: "application/x-bibtex", extension: "bib" });
    assert.ok("error" in inspectReferenceFile("fake.doc", new Uint8Array([80, 75, 3, 4])));
});

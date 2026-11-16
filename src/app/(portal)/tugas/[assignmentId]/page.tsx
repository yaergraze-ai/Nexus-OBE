import Link from "next/link";
import { notFound } from "next/navigation";
import { sessionContext } from "@/lib/auth";
import { readAssignmentById } from "@/lib/data";
import type { Submission, WorkFile } from "@/types/coursework";
import { COMPONENT_LABEL } from "@/types/coursework";
import { ATTACHMENT_BUCKET } from "@/lib/assignments/attachments";
import { adminClient } from "@/lib/supabase/admin";
import { dateTimeWib } from "@/lib/utils/wib";
import { SectionHead, Tag, Empty } from "@/components/UI";
import { FileList, UploadAttachments, SubmissionEditor, GradeSubmissionForm } from "@/components/SubmissionEditor";
import { DeleteAssignmentButton } from "@/components/MeetingTasks";

async function signedFiles(rows: WorkFile[]): Promise<WorkFile[]> {
    if (rows.length === 0) return [];
    const admin = adminClient();
    // Only RLS-visible metadata is passed in; never sign a path supplied by a client.
    return Promise.all(rows.map(async f => {
        const { data } = await admin.storage.from(ATTACHMENT_BUCKET).createSignedUrl(f.storage_path, 180);
        return { ...f, signedUrl: data?.signedUrl ?? null };
    }));
}
export default async function AssignmentDetail({ params }: { params: Promise<{ assignmentId: string }> }) {
    const { assignmentId } = await params; const { db, profile } = await sessionContext();
    const task = await readAssignmentById(db, assignmentId);
    if (!task) notFound();
    const manage = ["admin", "super_admin"].includes(profile.role) || (profile.role === "dosen" && profile.identity_number === task.classes.lecturer_identity_number);
    const student = profile.role === "mahasiswa";
    const canDelete = manage || (student && task.author_id === profile.id);
    const editable = student && (new Date(task.due_at) > new Date() || task.accept_late);
    const [{ data: materials, error: materialError }, { data: records, error: subError }] = await Promise.all([
        db.from("assignment_files").select("id,storage_path,file_name,content_type,byte_size").eq("assignment_id", task.id).order("created_at"),
        db.from("assignment_submissions").select("*,profiles:student_id(full_name,identity_number)").eq("assignment_id", task.id).order("updated_at", { ascending: false })
    ]);
    if (materialError || subError) throw new Error(materialError?.message || subError?.message);
    const submissions = (records ?? []) as unknown as Submission[];
    const mySubmission = student ? submissions.find(s => s.student_id === profile.id) ?? null : null;
    const allIds = submissions.map(s => s.id);
    const { data: fileRows, error: fileError } = allIds.length ? await db.from("submission_files").select("id,submission_id,storage_path,file_name,content_type,byte_size").in("submission_id", allIds).order("created_at") : { data: [], error: null };
    if (fileError) throw new Error(fileError.message);
    const [taskFiles, submissionFiles] = await Promise.all([signedFiles((materials ?? []) as WorkFile[]), signedFiles((fileRows ?? []) as WorkFile[])]);
    const typedFiles = (fileRows ?? []) as (WorkFile & { submission_id: string })[];
    return <>
        <div className="subtle tiny" style={{ marginBottom: 16 }}><Link className="crumb-link" href="/tugas">Tugas</Link> / <Link className="crumb-link" href={`/kelas/${task.class_id}`}>{task.classes.courses.name_id}</Link>{task.meetings ? <> / <Link className="crumb-link" href={`/kelas/${task.class_id}#pertemuan-${task.meetings.meeting_number}`}>Pertemuan #{task.meetings.meeting_number}</Link></> : null}</div>
        <SectionHead eyebrow={`${task.classes.class_code}${task.meetings ? ` · Pertemuan #${task.meetings.meeting_number}` : ""} · ${COMPONENT_LABEL[task.component]}`} title={task.title} subtitle={`Tenggat ${dateTimeWib(task.due_at)} · ${task.accept_late ? "Terima keterlambatan" : "Ditutup setelah tenggat"}`} />
        <div className="details-grid"><div className="stack"><section className="panel"><div className="panelhead"><h2>Instruksi & materi</h2><Tag kind={new Date(task.due_at) > new Date() || task.accept_late ? "good" : "bad"}>{new Date(task.due_at) > new Date() ? "Terbuka" : task.accept_late ? "Terlambat diizinkan" : "Ditutup"}</Tag></div><p className="preline">{task.description}</p>
            {task.resource_links?.length > 0 && <div className="link-collection"><h3>Tautan referensi</h3>{task.resource_links.map((url, index) => <a key={index} href={url} rel="noopener noreferrer nofollow" target="_blank" className="resource-link"><i className="bi bi-link-45deg" />{url}</a>)}</div>}
            <h3 style={{ marginTop: 18 }}>Lampiran materi dosen</h3><FileList files={taskFiles} canRemove={manage} kind="material" />{!taskFiles.length && <p className="subtle tiny">Belum ada materi yang dilampirkan.</p>}{manage && <UploadAttachments targetId={task.id} kind="material" enabled />}
        </section>
            {student && <SubmissionEditor assignmentId={task.id} existing={mySubmission} files={submissionFiles.filter((_, index) => typedFiles[index].submission_id === mySubmission?.id)} editable={editable} deadline={dateTimeWib(task.due_at)} />}
            {manage && <section className="panel"><div className="panelhead"><h2>Pengumpulan mahasiswa</h2><Tag kind="blue">{submissions.filter(s => s.status === "SUBMITTED").length} terkumpul</Tag></div>
                {submissions.map(s => <article key={s.id} className="submission-review"><div className="chip-row"><strong>{s.profiles?.full_name || "Mahasiswa"} <span className="subtle tiny">{s.profiles?.identity_number}</span></strong><Tag kind={s.status === "SUBMITTED" ? "good" : "warn"}>{s.status === "SUBMITTED" ? "Dikumpulkan" : "Draf"}</Tag><Tag kind="neutral">v{s.revision}</Tag></div>
                    <p className="preline">{s.content || "Tidak ada catatan."}</p>
                    {s.links?.map((url, index) => <a key={index} className="resource-link" href={url} target="_blank" rel="noopener noreferrer nofollow">{url}</a>)}
                    <FileList files={submissionFiles.filter((_, index) => typedFiles[index].submission_id === s.id)} />
                    {s.status === "SUBMITTED" && <GradeSubmissionForm submission={s} />}</article>)}
                {!submissions.length && <Empty title="Belum ada pengumpulan" message="Mahasiswa yang sudah mengumpulkan tugas akan muncul di daftar ini." icon="inbox" />}
            </section>}
        </div><aside className="stack"><section className="panel"><h2>Informasi Tugas</h2><div className="stat-line"><span>Mata kuliah</span><Link href={`/kelas/${task.class_id}`} className="crumb-link"><strong>{task.classes.courses.name_id}</strong></Link></div><div className="stat-line"><span>Kelas</span><strong>{task.classes.class_code}</strong></div>{task.meetings && <div className="stat-line"><span>Pertemuan</span><Link href={`/kelas/${task.class_id}#pertemuan-${task.meetings.meeting_number}`} className="crumb-link"><strong>Pertemuan #{task.meetings.meeting_number}</strong></Link></div>}{task.profiles && <div className="stat-line"><span>Dibuat oleh</span><strong>{task.profiles.full_name} ({task.profiles.role === "mahasiswa" ? "Mahasiswa" : "Dosen"})</strong></div>}<div className="stat-line"><span>Kategori nilai</span><strong>{COMPONENT_LABEL[task.component]}</strong></div><div className="stat-line"><span>Tenggat</span><strong>{dateTimeWib(task.due_at)}</strong></div><div className="stat-line"><span>Lampiran materi</span><strong>{taskFiles.length}</strong></div>{canDelete && <div className="form-actions"><DeleteAssignmentButton assignmentId={task.id} redirectTo={`/kelas/${task.class_id}`} /></div>}</section>
                <section className="panel"><h2>Ketentuan pengumpulan</h2><p className="subtle tiny">Anda dapat langsung memilih berkas (PDF, Word, Excel, PPT, ZIP/RAR/7z, gambar) berkali-kali tanpa batas jumlah tetap pada formulir. Maksimal 50 MB per file. Tautan eksternal hanya HTTPS, dan akses Google Drive harus diatur oleh pemilik. Perubahan nilai tugas oleh dosen memperbarui rerata komponen PAP yang sesuai.</p></section>
            </aside></div>
    </>;
}

export type Role = "mahasiswa" | "dosen" | "admin" | "super_admin";
export type Day = "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu" | "Minggu";
export type MeetingType = "KULIAH" | "PRAKTIKUM" | "PENGGANTI" | "UTS" | "UAS";
export interface Profile { id: string; full_name: string; identity_number: string; email: string; role: Role; faculty: string | null; study_program: string | null; avatar_url?: string | null; is_active: boolean; must_change_password?: boolean; }
export interface Course { id: string; course_code: string; name_id: string; name_en: string | null; sks_total: number; passing_grade_target: number; }
export interface Lecturer { identity_number: string; full_name: string; }
export interface AcademicClass {
    id: string; academic_year: string; course_id: string; class_code: string; lecturer_identity_number: string;
    schedule_day: Day; start_time: string; end_time: string; room_name: string;
    uts_schedule: string | null; uas_schedule: string | null; pbm_period: "on" | "off";
    rps_submitted: boolean; rps_validated_kaprodi: boolean; rps_validated_dekan: boolean;
    rps_target_meetings: number; initial_meeting_count: number; initial_student_count: number;
    weight_attendance: number; weight_uts: number; weight_uas: number;
    weight_daily_task: number; weight_group_task: number; weight_major_project: number;
    courses: Course; lecturer_directory: Lecturer;
}
export interface Meeting { id: string; class_id: string; meeting_number: number; meeting_date: string; type: MeetingType; summary: string; documentation_photo_path: string | null; status: "LIVE" | "COMPLETED_LOCKED"; starts_at: string; ends_at: string; override_expires_at: string | null; }
export interface MeetingReferenceFile { id: string; reference_id: string; meeting_id: string; class_id: string; storage_path: string; file_name: string; content_type: string; byte_size: number; created_at: string; signedUrl?: string; }
export interface MeetingReference { id: string; meeting_id: string; class_id: string; created_by: string; title: string; citation: string; reference_url: string | null; notes: string; created_at: string; updated_at: string; files: MeetingReferenceFile[]; }
export interface Notification { id: string; user_id: string; title: string; message: string; category: string; action_url: string | null; is_read: boolean; created_at: string; }
export interface ScoreInput { attendance: number; uts: number; uas: number; daily_task: number; group_task: number; major_project: number; }
export type AssessmentKey = "uts" | "uas" | "a" | "b" | "c";
export interface RpsCpl { id: string; course_id: string; code: string; description: string; weight: number; }
export interface RpsCpmk { id: string; course_id: string; cpl_id: string; code: string; description: string; weight: number; }
export interface RpsSub { id: string; course_id: string; cpmk_id: string; code: string; description: string; weight: number; weight_uts: number; weight_uas: number; weight_a: number; weight_b: number; weight_c: number; }
export interface Grade { id: string; class_id: string; student_id: string; score_attendance: number; score_uts: number; score_uas: number; score_daily_task: number; score_group_task: number; score_major_project: number; }
export const ROLE_LABEL: Record<Role, string> = { mahasiswa: "Mahasiswa", dosen: "Dosen", admin: "Admin Akademik", super_admin: "Super Admin" };
export const DAY_ORDER: Day[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

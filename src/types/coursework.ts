export type TaskComponent="daily_task"|"group_task"|"major_project";
export interface ClassSummary {id:string;class_code:string;lecturer_identity_number:string;courses:{name_id:string};}
export interface Announcement {id:string;class_id:string|null;author_id:string;audience:string;title:string;body:string;pinned:boolean;expires_at:string|null;created_at:string;classes:ClassSummary|null;}
export interface Assignment {id:string;class_id:string;author_id:string;title:string;description:string;component:TaskComponent;resource_links:string[];due_at:string;accept_late:boolean;published:boolean;created_at:string;updated_at:string;classes:ClassSummary;}
export interface Submission {id:string;assignment_id:string;student_id:string;content:string;links:string[];status:"DRAFT"|"SUBMITTED";revision:number;submitted_at:string|null;score:number|null;feedback:string|null;graded_at:string|null;profiles?:{full_name:string;identity_number:string};}
export interface WorkFile {id:string;storage_path:string;file_name:string;content_type:string;byte_size:number;signedUrl?:string|null;}
export const COMPONENT_LABEL:Record<TaskComponent,string>={daily_task:"Tugas Harian",group_task:"Tugas Kelompok",major_project:"Tugas Besar"};

import {z} from "zod";

import {safeExternalUrl} from "@/lib/assignments/links";
export const externalLink=z.string().trim().max(2048).refine(safeExternalUrl,"Tautan wajib HTTPS ke domain publik, misalnya GitHub atau Google Drive.");
export const announcementInput=z.object({
 classId:z.uuid().nullable(),audience:z.enum(["all","mahasiswa","dosen","admin","super_admin"]),
 title:z.string().trim().min(5).max(150),body:z.string().trim().min(10).max(4000),
 pinned:z.boolean(),expiresAt:z.iso.datetime({offset:true}).nullable()
}).strict();
export const assignmentInput=z.object({
 id:z.uuid().nullable(),classId:z.uuid(),meetingId:z.uuid().nullable().optional(),title:z.string().trim().min(5).max(150),
 description:z.string().trim().min(10).max(6000),component:z.enum(["daily_task","group_task","major_project"]),
 links:z.array(externalLink).max(100),dueAt:z.iso.datetime({offset:true}),acceptLate:z.boolean()
}).strict();
export const deleteAssignmentInput=z.object({assignmentId:z.uuid()}).strict();
export const submissionInput=z.object({
 assignmentId:z.uuid(),content:z.string().max(10000),links:z.array(externalLink).max(200),submit:z.boolean()
}).strict();
export const gradeInput=z.object({submissionId:z.uuid(),score:z.number().min(0).max(100),feedback:z.string().trim().max(2500)}).strict();
export const removeFileInput=z.object({fileId:z.uuid(),kind:z.enum(["submission","material"])}).strict();
export const uploadFileInput=z.object({targetId:z.uuid(),kind:z.enum(["submission","material"])}).strict();

import {NextResponse} from "next/server";
import {z} from "zod";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {apiError} from "@/lib/api";
const schema=z.object({classId:z.uuid(),studentId:z.uuid()});
export async function POST(req:Request){try{
 const {db}=await apiSession(["admin","super_admin"]);const {classId,studentId}=schema.parse(await boundedJson(req));
 const {data:student,error:studentError}=await db.from("profiles").select("role,is_active").eq("id",studentId).single();
 if(studentError||student?.role!=="mahasiswa"||!student.is_active)throw new Error("Akun mahasiswa tidak valid.");
 const {error}=await db.from("class_enrollments").upsert({class_id:classId,student_id:studentId},{onConflict:"class_id,student_id",ignoreDuplicates:true});
 if(error)throw new Error(error.message);
 return NextResponse.json({ok:true});
}catch(e){return apiError(e);}}

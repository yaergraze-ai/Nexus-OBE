import {NextResponse} from "next/server";
import {z} from "zod";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {apiError} from "@/lib/api";
const schema=z.object({full_name:z.string().trim().min(3).max(150)}).strict();
export async function PATCH(req:Request){try{
 const {db,user}=await apiSession();const payload=schema.parse(await boundedJson(req,2048));
 const {error}=await db.from("profiles").update({full_name:payload.full_name,updated_at:new Date().toISOString()}).eq("id",user.id);
 if(error)throw error;return NextResponse.json({ok:true});
}catch(e){return apiError(e);}}

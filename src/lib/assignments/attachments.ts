// Run before accessing storage. The server never trusts browser-provided MIME.
export const MAX_ATTACHMENT_BYTES=10*1024*1024;
export const ATTACHMENT_BUCKET="assignment-private";
export type AttachmentCheck={mime:string;extension:string}|{error:string};
const magic=(bytes:Uint8Array,prefix:number[])=>prefix.every((byte,index)=>bytes[index]===byte);
export function inspectAttachment(filename:string,bytes:Uint8Array):AttachmentCheck{
 if(bytes.byteLength===0||bytes.byteLength>MAX_ATTACHMENT_BYTES)return {error:"File wajib berukuran 1 byte hingga 10 MB."};
 const ext=filename.toLowerCase().split(".").pop()??"";
 const formats:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",zip:"application/zip",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",txt:"text/plain",md:"text/markdown",csv:"text/csv"};
 const mime=formats[ext];if(!mime)return {error:"Jenis file tidak didukung. Gunakan PDF, gambar, ZIP, Office, TXT, MD, atau CSV."};
 if(ext==="pdf"&&!magic(bytes,[37,80,68,70,45]))return {error:"Isi PDF tidak cocok dengan ekstensi."};
 if(ext==="png"&&!magic(bytes,[137,80,78,71,13,10,26,10]))return {error:"Isi PNG tidak cocok."};
 if(["jpg","jpeg"].includes(ext)&&!magic(bytes,[255,216,255]))return {error:"Isi JPEG tidak cocok."};
 if(ext==="webp"&&!(magic(bytes,[82,73,70,70])&&magic(bytes.slice(8),[87,69,66,80])))return {error:"Isi WebP tidak cocok."};
 if(["zip","docx","xlsx","pptx"].includes(ext)&&!magic(bytes,[80,75,3,4]))return {error:"Arsip ZIP/Office tidak cocok."};
 if(["txt","md","csv"].includes(ext)){
  try{const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);if(text.includes("\u0000"))return {error:"File teks tidak valid."};}
  catch{return {error:"File teks harus menggunakan UTF-8."};}
 }
 return {mime,extension:ext};
}
export function safeFileName(name:string){return name.replace(/[\x00-\x1F\x7F/\\]/g,"_").trim().slice(0,160)||"lampiran";}

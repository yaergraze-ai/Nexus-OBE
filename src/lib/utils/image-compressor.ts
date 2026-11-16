/** Konversi ke WebP maksimal 500 KB, batasi dimensi, tanpa mengirim ke server sebelum validasi. */
export async function compressBapImage(file:File,maxBytes=500_000):Promise<File>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5_000_000) throw new Error("Pilih JPG/PNG/WebP maksimal 5 MB.");
 const bitmap=await createImageBitmap(file);
 try {
   let width=bitmap.width,height=bitmap.height;
   if(width===0||height===0||width*height>40_000_000)throw new Error("Dimensi foto tidak valid.");
   const factor=Math.min(1,1600/Math.max(width,height));width=Math.max(1,Math.round(width*factor));height=Math.max(1,Math.round(height*factor));
   const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas tidak tersedia.");ctx.drawImage(bitmap,0,0,width,height);
   const encode=(q:number)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Gagal mengompresi foto.")),"image/webp",q));
   let blob=await encode(.82);
   for(const quality of [.7,.56,.42,.3]){if(blob.size<=maxBytes)break;blob=await encode(quality);}
   if(blob.size>maxBytes)throw new Error("Foto terlalu besar. Gunakan resolusi lebih rendah.");
   return new File([blob],"bap.webp",{type:"image/webp"});
 }finally{bitmap.close();}
}

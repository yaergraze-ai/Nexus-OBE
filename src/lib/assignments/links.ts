export function safeExternalUrl(raw:string):boolean {
 try {
  const link=new URL(raw);
  if(link.protocol!=="https:" || link.username || link.password || (link.port && link.port!=="443"))return false;
  const host=link.hostname.toLowerCase().replace(/\.$/,"");
  if(!host.includes(".") || host==="localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test"))return false;
  if(/^\[|^[\d.]+$/.test(host))return false; // no IP literals or local LAN pointers
  return raw.length<=2048;
 }catch{return false;}
}

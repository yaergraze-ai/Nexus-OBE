self.addEventListener('push',(event)=>{
  let payload={title:'NEXUS OBE',body:'Ada pembaruan akademik.',url:'/notifikasi'};
  try{if(event.data)payload={...payload,...event.data.json()};}catch{/* gunakan pesan baku */}
  const path=typeof payload.url==='string'&&payload.url.startsWith('/')&&!payload.url.startsWith('//')?payload.url:'/notifikasi';
  event.waitUntil(self.registration.showNotification(String(payload.title).slice(0,120),{body:String(payload.body).slice(0,300),icon:'/icon.svg',badge:'/icon.svg',data:{url:path}}));
});
self.addEventListener('notificationclick',(event)=>{event.notification.close();const url=new URL(event.notification.data?.url||'/notifikasi',self.location.origin);if(url.origin!==self.location.origin)return;event.waitUntil(clients.openWindow(url.pathname));});

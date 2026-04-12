// App bootstrap and progressive-web-app hooks.

function boot(){
      getDB();
      renderAvatars();
    }

    boot();
  
    // PWA: minimal Service Worker registration for "web + mobile" (installable web app).
    window.addEventListener('load', () => {
      if(!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });

  

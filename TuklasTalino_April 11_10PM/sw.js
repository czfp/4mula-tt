const CACHE_NAME = 'tuklas-talino-v1';
const APP_SHELL = [
  './',
  './index.html',
  './assets/css/style.css',
  './gamification/gamification.css',
  './data/students.js',
  './assets/js/core.js',
  './gamification/gamification.js',
  './adaptive-ui/grade-ui.js',
  './assets/js/student.js',
  './assets/js/teacher.js',
  './assets/js/admin.js',
  './assets/js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});

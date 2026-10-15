// Nexus — service worker: red primero (siempre la versión nueva), caché como respaldo sin conexión.
var CACHE = 'nexus-v1';
var SHELL = ['./index.html', './app.js', './styles.css', './theme.css', './locale-es-co.js', './logoNexusApp.png', './icon-192.png'];
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELL); }).then(function() { return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.indexOf('supabase.co') !== -1) return;   // los datos siempre van a la red
  e.respondWith(fetch(req).then(function(res) {
    if (res && res.ok && url.origin === location.origin) { var copy = res.clone(); caches.open(CACHE).then(function(c) { c.put(req, copy); }); }
    return res;
  }).catch(function() { return caches.match(req).then(function(r) { return r || caches.match('./index.html'); }); }));
});

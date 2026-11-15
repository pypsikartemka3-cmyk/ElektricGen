/* Service worker: online -> fetch the newest version; offline -> run the saved one. */
const CACHE = 'dyspetcher-cache-v1';

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(['./', './index.html']); }).catch(function(){}));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

function withTimeout(p, ms){
  return new Promise(function(resolve, reject){
    var t = setTimeout(function(){ reject(new Error('timeout')); }, ms);
    p.then(function(v){ clearTimeout(t); resolve(v); }, function(err){ clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  var fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if(url.origin !== self.location.origin && !fonts) return;

  var nav = req.mode === 'navigate';
  var net = nav ? fetch(req.url, {cache:'no-cache'}) : fetch(req);

  e.respondWith(
    withTimeout(net, nav ? 4000 : 8000).then(function(res){
      if(res && (res.ok || res.type === 'opaque')){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(nav ? './index.html' : req, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(nav ? './index.html' : req).then(function(hit){
        return hit || (nav ? caches.match('./') : Response.error());
      });
    })
  );
});

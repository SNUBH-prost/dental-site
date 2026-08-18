// 오프라인 대비 — 앱 셸과 참고자료 시드를 캐시해 네트워크가 끊겨도 조회가 되도록 한다.
// 정책: HTML/JS/CSS 는 network-first(최신 우선) + 실패 시 캐시 폴백.
const CACHE = 'dental-v49';
const BASE = '/dental-site/';

// 설치 시 미리 담아 두는 것 — 이것만 있으면 SOAP·임상검사·용어를 오프라인에서 볼 수 있다
const PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'icons/icon.svg',
  BASE + 'css/style.css',
  BASE + 'js/app.js',
  BASE + 'js/soap-seed.js',
  BASE + 'js/exam-seed.js',
  BASE + 'js/term-seed.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 개별 실패가 전체 설치를 막지 않도록 하나씩 담는다
      .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(err => console.warn('[sw precache]', u, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 쿼리스트링(?v=)이 달라도 같은 파일로 취급해 캐시 히트가 되도록
function cacheKey(request) {
  const url = new URL(request.url);
  url.search = '';
  return url.toString();
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // 데이터·외부 API 는 캐시하지 않는다 (항상 네트워크)
  if (
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('ncbi.nlm.nih.gov') ||
    url.hostname.includes('mymemory.translated.net')
  ) return;

  const isShell =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (isShell) {
    // network-first: 최신을 우선하되, 실패하면 캐시로 버틴다
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(cacheKey(e.request), copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(cacheKey(e.request))
            .then(hit => hit || (e.request.mode === 'navigate'
              ? caches.match(BASE + 'index.html')
              : undefined))
        )
    );
    return;
  }

  // 그 외(아이콘 등) 는 cache-first
  e.respondWith(
    caches.match(cacheKey(e.request)).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(cacheKey(e.request), copy)).catch(() => {});
        return res;
      })
    )
  );
});

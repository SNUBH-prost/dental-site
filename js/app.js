// ── Firebase 초기화 ───────────────────────────────────────────
// 오프라인이거나 CDN이 막히면 firebase 가 없다. 여기서 예외가 나면 아래의
// 모든 최상위 선언이 초기화되지 않아 화면 전체가 죽으므로, 실패해도 앱이
// 계속 뜨도록 안전한 더미로 대체한다. (로컬 시드만으로 참고자료는 동작)
let db;
let _dbReady = false;
try {
  if (typeof firebase === 'undefined' || !firebase.initializeApp) throw new Error('firebase SDK 미로드');
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  _dbReady = true;
} catch (e) {
  console.warn('[firebase] 초기화 실패 — 오프라인 모드로 동작합니다', e);
  const offline = () => Promise.reject(new Error('offline'));
  const stubDoc = { get: offline, set: offline, delete: offline, update: offline };
  const stubColl = {
    get: offline, doc: () => stubDoc,
    orderBy() { return this; }, where() { return this; }, limit() { return this; },
    onSnapshot() { return () => {}; },
  };
  db = {
    collection: () => stubColl,
    batch: () => ({ set() {}, delete() {}, commit: offline }),
  };
  // auth 도 없으면 관리자 판정 코드가 죽으므로 최소 형태를 세워 둔다
  if (typeof window !== 'undefined' && typeof firebase === 'undefined') {
    window.firebase = {
      auth: () => ({ onAuthStateChanged: cb => setTimeout(() => cb(null), 0), currentUser: null, signOut() {} }),
      firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => null } }),
    };
  }
}

// ── Cloudinary URL 최적화 ─────────────────────────────────────
function _cld(url, t) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/${t}/`);
}
const _cldGallery = u => u;                                            // 갤러리 원본 유지
const _cldThumb   = u => _cld(u, 'w_160,h_120,c_fill,q_auto,f_auto'); // 썸네일만 최적화
const _cldCard    = u => _cld(u, 'w_480,h_280,c_fill,q_auto,f_auto'); // 카드

// ── KaTeX 수식 렌더링 ─────────────────────────────────────────
function _renderMath(el) {
  if (!el || typeof renderMathInElement === 'undefined') return;
  renderMathInElement(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true  },
      { left: '$',  right: '$',  display: false },
    ],
    throwOnError: false,
    output: 'html',
  });
}

// ── 인용구 위첨자 변환 ────────────────────────────────────────
function _renderWithCitations(text, refs) {
  if (!text) return '';
  if (!refs || !refs.length) return marked.parse(text);

  // Normalize "Author et al.(year, Journal)" → "(Author year, Journal)"
  text = text.replace(
    /(?<!\()([A-Za-zÄÖÜäöüéèêàâčšžćđ']+(?:\s+et\s+al\.?)?(?:\s+&\s+[A-Za-z']+)?)\s*\(\s*((?:19|20)\d{2})\s*[,;]\s*([^)(]*(?:\([^)]*\))*[^)(]*)\)/g,
    '($1 $2, $3)'
  );

  // Handles: (Author year, Journal), (Author, year, Journal), O'Brien-style names, 29(1):116-135 volumes
  const citeRe = /\(([A-Za-zÄÖÜäöüéèêàâčšžćđ']+(?:\s+et\s+al\.?)?(?:\s+&\s+[A-Za-z']+)?)[,;\s]+(\d{4})[,;\s]+([^)(]*(?:\([^)]*\))*[^)(]*)\)/g;

  // 첫 등장 순서대로 번호 부여
  const keyToIdx = {};
  let nextIdx = 0;
  let m;
  while ((m = citeRe.exec(text)) !== null) {
    const key = m[1].trim() + '_' + m[2].trim();
    if (!(key in keyToIdx)) keyToIdx[key] = nextIdx++;
  }

  citeRe.lastIndex = 0;
  const processed = text.replace(citeRe, (match, author, year) => {
    const key = author.trim() + '_' + year.trim();
    const n = keyToIdx[key];
    if (n === undefined || n >= refs.length) return match;

    const ref = refs[n];
    const parts = [
      ref.authors || author,
      ref.year ? `(${ref.year}).` : `(${year}).`,
      ref.title ? ref.title + '.' : '',
      ref.journal && ref.journal !== '교과서'
        ? ref.journal + (ref.volume ? ' ' + ref.volume : '') + (ref.pages ? ':' + ref.pages : '') + '.'
        : (ref.title ? '' : (ref.journal || '')),
      ref.doi ? `DOI: ${ref.doi}` : '',
    ].filter(Boolean);

    const tip = parts.join(' ').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isTextbook = ref.journal === '교과서';
    const href = ref.doi
      ? `https://doi.org/${ref.doi}`
      : ref.pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`
        : (!isTextbook && ref.title)
          ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(ref.title)}`
          : '';
    const sup = `<sup class="cite-sup" data-n="${n + 1}" data-tip="${tip}">[${n + 1}]</sup>`;
    return href
      ? `<a class="cite-link" href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${sup}</a>`
      : sup;
  });

  return marked.parse(processed);
}

// ── marked 미로드 대비 폴백 ──────────────────────────────────
// CDN(jsdelivr) 차단·지연 시 marked 가 없으면 아래 setupMarked 가 예외를 던지고,
// 그 뒤의 모든 최상위 선언(_currentPage 등)이 초기화되지 않아 화면 전체가 죽는다.
// → 최소 파서를 세워 두어 콘텐츠가 평문으로라도 보이게 한다.
if (typeof marked === 'undefined' || typeof marked.Renderer !== 'function') {
  console.warn('[marked] CDN 로드 실패 — 폴백 파서 사용');
  const esc = s => String(s);
  window.marked = {
    setOptions() {},
    Renderer: function () {},
    parse(src) {
      const lines = esc(src).split('\n');
      let html = '', inList = false;
      const inline = t => t
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      for (const line of lines) {
        const li = line.match(/^\s*[-*]\s+(.*)$/);
        if (li) {
          if (!inList) { html += '<ul>'; inList = true; }
          html += '<li>' + inline(li[1]) + '</li>';
          continue;
        }
        if (inList) { html += '</ul>'; inList = false; }
        if (!line.trim()) continue;
        // 블록 HTML 은 그대로 통과
        html += /^\s*</.test(line) ? line : '<p>' + inline(line) + '</p>';
      }
      if (inList) html += '</ul>';
      return html;
    }
  };
}

// ── marked 커스텀 렌더러 (이미지 크기 + Fig 자동 번호) ───────
let _figNum = 0; // marked.parse 호출마다 리셋 (아래 래퍼)
(function setupMarked() {
 try {
  const renderer = new marked.Renderer();
  const sizeMap  = { sm: '30%', md: '50%', lg: '75%' };
  // marked v5+ 는 객체 인수, v4 이하는 (href, title, text) 개별 인수
  renderer.image = function(hrefOrToken, title, text) {
    let href, alt;
    if (hrefOrToken && typeof hrefOrToken === 'object') {
      href = hrefOrToken.href; alt = hrefOrToken.text;
    } else {
      href = hrefOrToken; alt = text;
    }
    // alt 형식 (모두 지원):
    //   "md|치아 협면 사진" → size=md, 캡션=치아 협면 사진
    //   "치아 협면 사진"     → size 없음(100%), 캡션=치아 협면 사진  ← 대괄호에 바로 적은 경우
    //   "sm"                → size=sm, 캡션 없음
    const raw = (alt || '').trim();
    const pipeIdx = raw.indexOf('|');
    let sizeKey, caption;
    if (pipeIdx > -1) {
      sizeKey = raw.slice(0, pipeIdx).trim();
      caption = raw.slice(pipeIdx + 1).trim();
    } else if (sizeMap[raw]) {
      // 크기 키워드(sm/md/lg)만 적은 경우 → 캡션 없음
      sizeKey = raw; caption = '';
    } else {
      // 일반 텍스트만 적은 경우 → 통째로 캡션 처리
      sizeKey = ''; caption = raw;
    }
    const w = sizeMap[sizeKey] || '100%';
    const imgTag = `<img src="${href}" alt="${_esc(caption || sizeKey)}" loading="lazy" onerror="this.style.opacity='0.3'" style="width:${w};display:block;border-radius:8px;margin:0 auto;border:1px solid #e2e8f0;max-width:100%">`;
    if (caption) {
      // 이미 Fig/그림/사진 라벨을 직접 붙였으면 그대로, 아니면 "Fig. N." 자동 부여
      const hasLabel = /^\s*(fig\.?|figure|그림|사진)\s*\.?\s*\d/i.test(caption);
      let capHtml;
      if (hasLabel) {
        capHtml = _esc(caption);
      } else {
        _figNum++;
        capHtml = `<b>Fig. ${_figNum}.</b> ${_esc(caption)}`;
      }
      return `<figure style="margin:0.75rem auto;text-align:center;max-width:100%">${imgTag}` +
        `<figcaption style="margin-top:0.4rem;font-size:0.82rem;color:var(--text-muted,#64748b);line-height:1.5;word-break:keep-all">${capHtml}</figcaption></figure>`;
    }
    return `<img src="${href}" alt="${_esc(sizeKey)}" loading="lazy" onerror="this.style.opacity='0.3'" style="width:${w};display:block;border-radius:8px;margin:0.75rem 0;border:1px solid #e2e8f0;max-width:100%">`;
  };
  marked.setOptions({ renderer, breaks: true });

  // marked.parse 호출 시작마다 Fig 카운터 리셋 (문서별 1번부터)
  const _origParse = marked.parse.bind(marked);
  marked.parse = function() {
    _figNum = 0;
    return _origParse.apply(this, arguments);
  };
 } catch (e) { console.warn('[marked] 렌더러 설정 실패 — 기본 파서로 동작', e); }
})();

const DEPARTMENTS = [
  { id: "fixed",     name: "고정성",   icon: "🦷" },
  { id: "implant",   name: "임플란트", iconImg: "/dental-site/icons/icon-implant.svg" },
  { id: "rpd",       name: "RPD",      iconImg: "/dental-site/icons/icon-rpd.svg" },
  { id: "cd",        name: "CD",       iconImg: "/dental-site/icons/icon-cd.svg" },
  { id: "materials", name: "재료",     icon: "🧪" },
  { id: "qna",       name: "Q&A",      icon: "💬" }
];

// Runtime departments — overwritten by Firestore data after load
let _departments = [...DEPARTMENTS];
// O(1) id→dept 조회 맵 (_initDeptDOM에서 갱신). hot path의 .find() 대체
let _deptById = Object.fromEntries(_departments.map(d => [d.id, d]));

let allCases = [];
let allContents = [];
let currentPhotos = [];
let _photoPreloadCache = []; // GC 방지 + decode() 선디코딩
let currentPhotoIndex = 0;
let _currentModalItem = null;
let isAdmin = false;
let _bookmarks = new Set(JSON.parse(localStorage.getItem('dental-bm') || '[]'));
let _showBmOnly = false;
let _showOngoing = false;       // 진행중 케이스만 필터
let _deptBmFilter = new Set(); // 북마크 필터가 켜진 부문 id 집합
let _deptEditingId = null;     // 부문 관리에서 현재 편집 중인 부문 id
let _gz = { s: 1, ox: 50, oy: 50, tx: 0, ty: 0 }; // gallery zoom state
let _searchIndex  = null; // cached combined search array, nulled on data change
let _tagCloudHTML = null; // cached tag cloud HTML, nulled on data change
let _viewMode = localStorage.getItem('dental-view') || 'grid';
let _currentPage = 'home';
let _isPopState = false;
let _modalPushed = false;

// ── 데이터 로드 ───────────────────────────────────────────────
const _CACHE_KEY_CASES    = 'dental_cache_cases';
const _CACHE_KEY_CONTENTS = 'dental_cache_contents';
const _CACHE_KEY_DEPTS    = 'dental_cache_depts';

// 간단한 debounce 유틸
function _debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function _renderAll() {
  renderHome();
  renderCases();
  renderDeptPages();
  _injectAdminControls();
  _injectPageBottomBtns();
  // 로그인/로그아웃 직후 관리 버튼이 바로 반영되도록 (이미 로드된 경우에만)
  if (_soapItems.length) renderSOAP();
  if (_examItems.length) renderExam();
  if (_termItems.length) renderTerm();
  if (_labItems.length) renderLab();
  if (_tipItems.length) renderTip();
}

function _createdAtMs(item) {
  const c = item.createdAt;
  if (!c) return new Date(item.date || 0).getTime();
  if (typeof c.toDate === 'function') return c.toDate().getTime();
  if (typeof c === 'object' && c.seconds) return c.seconds * 1000 + Math.floor((c.nanoseconds || 0) / 1e6);
  if (typeof c === 'string') return new Date(c).getTime();
  return new Date(item.date || 0).getTime();
}

function _sortContents(arr) {
  return [...arr].sort((a, b) => {
    const diff = _createdAtMs(b) - _createdAtMs(a);
    if (diff !== 0) return diff;
    return (b.date || '').localeCompare(a.date || '');
  });
}

async function loadData() {
  let fromCache = false;

  // 캐시가 있으면 즉시 표시 (빠른 초기 렌더)
  try {
    const cc = localStorage.getItem(_CACHE_KEY_CASES);
    const ct = localStorage.getItem(_CACHE_KEY_CONTENTS);
    const cd = localStorage.getItem(_CACHE_KEY_DEPTS);
    if (cc && ct) {
      allCases    = JSON.parse(cc);
      allContents = _sortContents(JSON.parse(ct));
      if (cd) _initDeptDOM(JSON.parse(cd));
      _renderAll();
      fromCache = true;
    }
  } catch(e) {}

  // 항상 Firestore에서 최신 데이터를 가져와 갱신
  const [casesSnap, contentsSnap, deptsSnap] = await Promise.all([
    db.collection("cases").orderBy("date", "desc").get(),
    db.collection("departmentContents").orderBy("createdAt", "desc").get(),
    db.collection("departments").orderBy("order", "asc").get().catch(() => null)
  ]);

  const freshCases    = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const freshContents = _sortContents(contentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  const freshDepts    = deptsSnap?.docs.length
    ? deptsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    : null;

  // 캐시와 내용이 달라졌을 때만 다시 렌더링
  const casesChanged    = JSON.stringify(freshCases)    !== JSON.stringify(allCases);
  const contentsChanged = JSON.stringify(freshContents) !== JSON.stringify(allContents);
  const deptsChanged    = freshDepts
    ? JSON.stringify(freshDepts) !== JSON.stringify(_departments)
    : false;

  allCases    = freshCases;
  allContents = freshContents;

  if (freshDepts && deptsChanged) {
    _initDeptDOM(freshDepts);
  }

  if (!fromCache || casesChanged || contentsChanged || deptsChanged) {
    _renderAll();
  }

  try {
    localStorage.setItem(_CACHE_KEY_CASES,    JSON.stringify(allCases));
    localStorage.setItem(_CACHE_KEY_CONTENTS, JSON.stringify(allContents));
    if (freshDepts) localStorage.setItem(_CACHE_KEY_DEPTS, JSON.stringify(freshDepts));
  } catch(e) {}
  _searchIndex = null;
  _tagCloudHTML = null;
}

// ── Navigation ────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  const navLink = document.querySelector(`nav a[data-page="${pageId}"]`);
  if (navLink) navLink.classList.add('active');
  // 모바일 드로어에서 넘어오면 body 가 아직 overflow:hidden 이라 이 호출이
  // 무시되고, 잠금이 풀리면서 이전 스크롤 위치로 되돌아간다 → 다음 프레임에 재확인.
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  _currentPage = pageId;
  if (pageId === 'calendar') renderCalendar();
  if (pageId === 'inventory') { _setInvCat(_invCat); if (_invCat === 'diamond' && !_burItems.length) _loadInventory(); }
  if (pageId === 'soap') { if (!_soapItems.length) _loadSOAP(); else renderSOAP(); }
  if (pageId === 'exam') { if (!_examItems.length) _loadExam(); else renderExam(); }
  if (pageId === 'term') { if (!_termItems.length) _loadTerm(); else renderTerm(); }
  if (pageId === 'lab') { if (!_labItems.length) _loadLab(); else renderLab(); }
  if (pageId === 'tip') { if (!_tipItems.length) _loadTip(); else renderTip(); }
  if (pageId === 'stats') renderStats();
  if (!_isPopState) {
    history.pushState({ page: pageId }, '');
  }
}

// ── Home ──────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('dept-grid-home');
  // 부문별 자료 수를 1패스로 집계 (부문마다 filter 돌리는 O(부문×자료) 회피)
  const counts = {};
  allContents.forEach(c => { counts[c.department] = (counts[c.department] || 0) + 1; });
  grid.innerHTML = _departments.map(d => {
    const count = counts[d.id] || 0;
    const iconHtml = d.iconImg
      ? `<img src="${d.iconImg}" alt="${d.name}" style="width:2.8rem;height:2.8rem;object-fit:contain;">`
      : d.icon;
    return `
      <div class="dept-card" onclick="showPage('dept-${d.id}')">
        <div class="icon">${iconHtml}</div>
        <div class="name">${d.name}</div>
        <div class="count">자료 ${count}건</div>
      </div>`;
  }).join('');

  const recent = allCases.slice(0, 3);
  document.getElementById('recent-cases').innerHTML =
    recent.length ? recent.map(c => cardHTML(c, 'case')).join('') :
    '<div class="empty">등록된 케이스가 없습니다.</div>';

  renderHomeCalendar();
}

// ── Clinical Cases ─────────────────────────────────────────────
function renderCases(filter = '', deptFilter = '') {
  const list = allCases.filter(c => {
    const q = filter.trim();
    const matchText    = !q || c.title.includes(q) || (c.summary||'').includes(q) || (c.tags||[]).some(t => t.includes(q));
    const matchDept    = !deptFilter || c.department === deptFilter;
    const matchBm      = !_showBmOnly || _bookmarks.has(c.id);
    const matchOngoing = !_showOngoing || c.status === 'ongoing';
    return matchText && matchDept && matchBm && matchOngoing;
  });
  const el = document.getElementById('cases-grid');
  el.className = _viewMode === 'list' ? 'card-grid list-view' : 'card-grid';
  el.innerHTML = list.length ? list.map(c => cardHTML(c, 'case')).join('') :
    '<div class="empty">검색 결과가 없습니다.</div>';
}

// ── Department pages ───────────────────────────────────────────
function renderDeptPages() {
  _departments.forEach(d => renderDeptContent(d.id));
}

// 한 부문의 카드 그리드를 렌더 (검색어 + 북마크 필터 반영)
function renderDeptContent(deptId, filter = '') {
  const container = document.getElementById(`dept-content-${deptId}`);
  if (!container) return;
  const q = filter.trim();
  const items = allContents.filter(c => {
    if (c.department !== deptId) return false;
    if (q && !c.title.includes(q) && !(c.summary||'').includes(q)) return false;
    if (_deptBmFilter.has(deptId) && !_bookmarks.has(c.id)) return false;
    return true;
  });
  container.className = _viewMode === 'list' ? 'card-grid list-view' : 'card-grid';
  const emptyMsg = (q || _deptBmFilter.has(deptId)) ? '검색 결과가 없습니다.' : '등록된 자료가 없습니다.';
  container.innerHTML = items.length ? items.map(c => cardHTML(c, 'content')).join('') :
    `<div class="empty">${emptyMsg}</div>`;
}

// 하위 호환 별칭
function filterDept(deptId, filter = '') { renderDeptContent(deptId, filter); }
const _filterDeptDebounced  = _debounce(filterDept,  200);
const _renderCasesDebounced = _debounce(renderCases, 200);

// ── Dynamic department DOM init ────────────────────────────────
const _VT_BTNS = `
  <div class="view-toggle-group">
    <button data-mode="grid" class="view-toggle-btn" onclick="setViewMode('grid')" title="카드 보기"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></button>
    <button data-mode="list" class="view-toggle-btn" onclick="setViewMode('list')" title="목록 보기"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="1" y="12" width="14" height="2" rx="1"/></svg></button>
  </div>`;

function _deptIconHtml(d) {
  if (d.iconImg) return `<img src="${_esc(d.iconImg)}" style="width:1.2em;height:1.2em;vertical-align:middle;margin-right:0.3em">`;
  return d.icon ? `${d.icon} ` : '📁 ';
}

function _initDeptDOM(depts) {
  _departments = depts;
  _deptById = Object.fromEntries(depts.map(d => [d.id, d]));

  // Generate dept page divs
  const pagesContainer = document.getElementById('dept-pages-container');
  if (pagesContainer) {
    const activeDeptId = _currentPage && _currentPage.startsWith('dept-') ? _currentPage : null;
    pagesContainer.innerHTML = depts.map(d => `
      <div id="page-dept-${d.id}" class="page${activeDeptId === 'dept-' + d.id ? ' active' : ''}">
        <div class="section-header"><div class="section-title">${_deptIconHtml(d)}${_esc(d.name)}</div></div>
        <div class="toolbar">
          <input class="search-input" type="text" placeholder="자료 검색..." oninput="_filterDeptDebounced('${d.id}',this.value)">
          <button class="bm-filter-btn" data-dept-bm="${d.id}" onclick="toggleDeptBookmarkFilter('${d.id}')">★ 북마크</button>
          ${_VT_BTNS}
        </div>
        <div class="card-grid" id="dept-content-${d.id}"></div>
      </div>`).join('');
  }

  // Nav dropdown links
  const navLinks = document.getElementById('nav-dept-links');
  if (navLinks) {
    navLinks.innerHTML = depts.map(d => {
      const icon = d.iconImg
        ? `<img src="${_esc(d.iconImg)}" class="nav-dept-icon"> `
        : (d.icon ? `${d.icon} ` : '');
      return `<a href="javascript:void(0)" data-page="dept-${d.id}" onclick="showPage('dept-${d.id}');closeDeptMenu()">${icon}${_esc(d.name)}</a>`;
    }).join('');
  }

  // Mobile drawer links
  const drawerLinks = document.getElementById('drawer-dept-links');
  if (drawerLinks) {
    drawerLinks.innerHTML = depts.map(d => {
      const icon = d.iconImg
        ? `<img src="${_esc(d.iconImg)}" class="drawer-dept-icon">`
        : (d.icon || '📁');
      return `<a href="javascript:void(0)" onclick="showPage('dept-${d.id}');toggleMobileMenu()"><span class="di">${icon}</span>${_esc(d.name)}</a>`;
    }).join('');
  }

  // Case filter dropdown
  const caseFilter = document.getElementById('case-dept-filter');
  if (caseFilter) {
    const cur = caseFilter.value;
    caseFilter.innerHTML = '<option value="">전체</option>' +
      depts.map(d => `<option value="${d.id}"${cur === d.id ? ' selected' : ''}>${_esc(d.name)}</option>`).join('');
  }
}

// Initialize with defaults immediately (defer means DOM is ready)
_initDeptDOM(DEPARTMENTS);

// ── Card HTML ──────────────────────────────────────────────────
function cardHTML(item, type) {
  const dept = _deptById[item.department];
  const deptName = dept ? dept.name : '';
  const firstPhoto = item.photos && item.photos[0];
  const thumb = firstPhoto
    ? `<div class="card-thumb"><img src="${_cldCard(firstPhoto.url)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span>🦷</span>'"></div>`
    : `<div class="card-thumb"><span>🦷</span></div>`;
  const tags = (item.tags || []).map(t =>
    `<span class="tag" onclick="event.stopPropagation();_filterByTag(this.dataset.tag)" data-tag="${_esc(t)}">${_esc(t)}</span>`
  ).join('');
  const isBm = _bookmarks.has(item.id);
  const bmBtn = `<button class="card-bm-btn${isBm?' active':''}" data-bm-id="${item.id}" onclick="event.stopPropagation();_toggleBookmark('${item.id}')" title="${isBm?'북마크 해제':'북마크'}">★</button>`;
  const statusBadge = type === 'case' && item.status
    ? `<span class="case-status-badge case-status-${item.status}">${item.status === 'ongoing' ? '진행중' : '완료'}</span>`
    : '';
  const adminBtns = isAdmin ? `
    <div class="card-admin-row" onclick="event.stopPropagation()">
      <button class="card-admin-btn edit" onclick="openEditorFor('${item.id}','${type}')">✏️<span class="btn-label"> 편집</span></button>
      <button class="card-admin-btn del"  onclick="deleteCardItem('${item.id}','${type}')">🗑️<span class="btn-label"> 삭제</span></button>
    </div>` : '';
  return `
    <div class="card" onclick="openModal('${item.id}','${type}')">
      ${thumb}
      ${bmBtn}
      <div class="card-body">
        <div class="card-dept">${deptName}${statusBadge}</div>
        <div class="card-title">${item.title}</div>
        <div class="card-summary">${item.summary || ''}</div>
        <div class="card-meta">
          <span>${item.date || ''}</span>
          ${item.photos ? `<span>사진 ${item.photos.length}장</span>` : ''}
        </div>
        ${tags ? `<div class="modal-tags" style="margin-top:0.5rem">${tags}</div>` : ''}
        ${adminBtns}
      </div>
    </div>`;
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(id, type) {
  const item = type === 'case'
    ? allCases.find(c => c.id === id)
    : allContents.find(c => c.id === id);
  if (!item) return;
  _currentModalItem = { item, type };

  const dept = _deptById[item.department];
  currentPhotos = item.photos || [];
  currentPhotoIndex = 0;
  // 사진 프리로드 (네트워크만, decode 없이)
  _photoPreloadCache = currentPhotos.map(p => {
    const preview = new Image();
    preview.src = _cld(p.url, 'w_1200,q_auto,f_auto');
    const orig = new Image();
    orig.src = p.url;
    return { preview, orig, url: p.url };
  });

  // 즉시: 제목·갤러리만 표시하고 모달 오픈 (첫 페인트 최우선)
  document.getElementById('modal-dept').textContent  = dept ? dept.name : '';
  document.getElementById('modal-title').textContent = item.title;
  document.getElementById('modal-date').textContent  = item.date || '';
  document.getElementById('modal-description').innerHTML = '';
  document.getElementById('modal-tags').innerHTML = '';
  document.getElementById('modal-teeth').style.display = 'none';
  renderGallery();

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!_isPopState) {
    _modalPushed = true;
    history.pushState({ page: _currentPage, modal: { id, type } }, '', '#' + type + '-' + id);
  }

  // 첫 페인트 후: markdown·refs·치식 등 무거운 작업 처리
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const descEl = document.getElementById('modal-description');
    descEl.innerHTML = marked.parse(item.description || '');
    // KaTeX는 무거우므로 idle 타임에 처리 (모달 오픈 애니메이션 보호)
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => _renderMath(descEl), { timeout: 1500 });
    } else {
      setTimeout(() => _renderMath(descEl), 0);
    }

    const answerEl  = document.getElementById('modal-answer');
    const answerSec = document.getElementById('modal-answer-section');
    if (answerEl && answerSec) {
      if (item.answer?.trim()) {
        answerEl.innerHTML = _renderWithCitations(item.answer, item.references || []);
        answerSec.style.display = '';
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => _renderMath(answerEl), { timeout: 1500 });
        } else {
          setTimeout(() => _renderMath(answerEl), 0);
        }
      } else {
        answerSec.style.display = 'none';
      }
    }
    document.getElementById('modal-tags').innerHTML = (item.tags||[]).map(t=>
      `<span class="tag" onclick="closeModal();_filterByTag(this.dataset.tag)" data-tag="${_esc(t)}">${_esc(t)}</span>`
    ).join('');
    renderRefs(item.references || []);
    const teethEl = document.getElementById('modal-teeth');
    if (item.teeth && item.teeth.length) {
      teethEl.innerHTML = _renderToothChartHTML(item.teeth, false);
      teethEl.style.display = '';
    } else {
      teethEl.innerHTML = '';
    }
    const ogImg = (item.photos && item.photos[0]) ? item.photos[0].url
      : 'https://snubh-prost.github.io/dental-site/icons/icon-192.png';
    document.getElementById('og-title').setAttribute('content', item.title + ' — 치과 임상 자료실');
    document.getElementById('og-desc').setAttribute('content', item.summary || item.description?.slice(0,100) || '');
    document.getElementById('og-image').setAttribute('content', ogImg);
    document.getElementById('og-url').setAttribute('content', location.href);
    document.title = item.title + ' — 치과 임상 자료실';
  }));
}

function _toggleFocusMode() {
  const on = document.body.classList.toggle('focus-mode');
  document.getElementById('modal-focus-btn').textContent = on ? '⤡' : '⤢';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.classList.remove('focus-mode');
  document.getElementById('modal-focus-btn').textContent = '⤢';
  document.body.style.overflow = '';
  // 프리로드 이미지 참조 해제 (메모리 회수)
  _photoPreloadCache = [];
  document.title = '치과 임상 자료실';
  document.getElementById('og-title').setAttribute('content', '치과 임상 자료실');
  document.getElementById('og-image').setAttribute('content', 'https://snubh-prost.github.io/dental-site/icons/icon-192.png');
  if (_modalPushed) {
    _modalPushed = false;
    history.back();
  } else {
    history.replaceState({ page: _currentPage }, '', location.pathname + location.search);
  }
}

function _copyShareLink() {
  const url = location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => _edToast('링크가 복사되었습니다!'))
      .catch(() => prompt('아래 링크를 복사하세요:', url));
  } else {
    prompt('아래 링크를 복사하세요:', url);
  }
}

// ── Gallery ────────────────────────────────────────────────────
function renderGallery() {
  const el = document.getElementById('gallery-section');
  if (!currentPhotos.length) {
    el.innerHTML = '<div class="no-photo">등록된 사진이 없습니다.</div>';
    return;
  }
  const p = currentPhotos[currentPhotoIndex];
  el.innerHTML = `
    <div class="gallery-main">
      <img id="gallery-main-img" src="${_cldGallery(p.url)}" alt="${p.caption||''}" data-orig="${p.url}">
      <div class="gallery-caption" id="gallery-caption">${p.caption||''}</div>
      <div class="gallery-counter" id="gallery-counter">${currentPhotoIndex+1} / ${currentPhotos.length}</div>
      ${currentPhotos.length > 1 ? `
        <button class="gallery-nav prev" onclick="changePhoto(-1)">&#8249;</button>
        <button class="gallery-nav next" onclick="changePhoto(1)">&#8250;</button>` : ''}
      <button class="gallery-share-btn" onclick="_copyShareLink()" title="링크 복사">🔗</button>
      <button class="gallery-fs-btn" onclick="_openFsGallery()" title="전체화면">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h4v1.5H2.5V4H1V1zm10 0h4v3h-1.5V2.5H11V1zM1 12h1.5v1.5H4V15H1v-3zm10.5 1.5H13V12h1.5v3H11v-1.5z"/></svg>
      </button>
    </div>
    <div class="gallery-thumbs">
      ${currentPhotos.map((ph,i)=>`
        <img src="${_cldThumb(ph.url)}" alt="" class="${i===0?'active':''}" onclick="gotoPhoto(${i})"
          data-orig="${ph.url}" onerror="this.style.display='none'">`).join('')}
    </div>`;
  _placeAnnSVG(el.querySelector('.gallery-main'), p);
  _gz = { s: 1, ox: 50, oy: 50, tx: 0, ty: 0 };
  _setupGallerySwipe();
  _setupGalleryZoom();
}

function changePhoto(dir) {
  currentPhotoIndex = (currentPhotoIndex + dir + currentPhotos.length) % currentPhotos.length;
  _resetGalleryZoom();
  updateGallery();
}

function gotoPhoto(i) {
  currentPhotoIndex = i;
  _resetGalleryZoom();
  updateGallery();
}

function updateGallery() {
  const p   = currentPhotos[currentPhotoIndex];
  const idx = currentPhotoIndex;
  const mainImg = document.getElementById('gallery-main-img');
  const cache   = _photoPreloadCache[idx];

  if (cache?.orig.complete && cache.orig.naturalWidth) {
    // 원본 이미 다운로드+디코딩 완료 → 즉시 표시
    mainImg.src = p.url;
  } else {
    // 프리뷰 즉시 표시 (작아서 빠름), 원본 로드 완료 시 교체
    if (cache?.preview.src) mainImg.src = cache.preview.src;
    if (cache) {
      cache.orig.onload = () => { if (currentPhotoIndex === idx) mainImg.src = p.url; };
    }
  }

  document.getElementById('gallery-caption').textContent = p.caption || '';
  document.getElementById('gallery-counter').textContent = `${idx+1} / ${currentPhotos.length}`;
  document.querySelectorAll('.gallery-thumbs img').forEach((img,i) =>
    img.classList.toggle('active', i === idx));
  const gm = document.querySelector('.gallery-main');
  if (gm) _placeAnnSVG(gm, p);
}

// ── PDF 인쇄 ────────────────────────────────────────────────────
async function printCase() {
  const item = _currentModalItem?.item;
  if (!item) return;
  const dept = _deptById[item.department];
  const refs = item.references || [];
  // 인쇄용 최적화 이미지 (원본보다 빠르고 충분한 해상도)
  const _printImg = u => _cld(u, 'w_1400,q_auto:good,f_auto');

  const statusLabel = item.status === 'ongoing' ? '진행중' : item.status === 'done' ? '완료' : '';
  const statusHTML  = statusLabel
    ? `<span class="print-status print-status-${item.status}">${statusLabel}</span>` : '';

  const photosHTML = (item.photos || []).map(p => `
    <div class="print-photo-item">
      <img src="${_esc(_printImg(p.url))}" alt="${_esc(p.caption||'')}">
      ${p.caption ? `<div class="print-caption">${_esc(p.caption)}</div>` : ''}
    </div>`).join('');

  const tagsHTML = (item.tags || []).map(t =>
    `<span class="print-tag">${_esc(t)}</span>`).join('');

  const refsHTML = refs.length
    ? `<div class="print-section-label">참고 논문</div>
       <ol class="print-refs">${refs.map(r => {
         const title = r.title ? `<strong>${_esc(r.title)}</strong>` : '';
         const doi   = r.doi   ? ` — <a href="https://doi.org/${_esc(r.doi)}">doi:${_esc(r.doi)}</a>` : '';
         const url   = (!r.doi && r.url) ? ` — <a href="${_esc(r.url)}">${_esc(r.url)}</a>` : '';
         return `<li>${title}${doi}${url}</li>`;
       }).join('')}</ol>` : '';

  const teethHTML = (item.teeth && item.teeth.length)
    ? `<div class="print-section-label">치식</div>
       <div class="print-teeth-wrap">${_renderToothChartHTML(item.teeth, false)}</div>` : '';

  const descText = (item.description || '').trim();
  const descHTML = descText
    ? `<div class="print-section-label">설명</div>
       <div class="print-desc">${_renderWithCitations(descText, refs)}</div>` : '';

  const answerText = (item.answer || '').trim();
  const answerHTML = answerText
    ? `<div class="print-section-label">AI Q&amp;A</div>
       <div class="print-desc print-answer">${_renderWithCitations(answerText, refs)}</div>` : '';

  const printArea = document.getElementById('print-area');
  printArea.innerHTML = `
    <div class="print-header">
      <div class="print-header-top">
        ${dept ? `<div class="print-dept-tag">${_esc(dept.name)}</div>` : ''}
        ${statusHTML}
      </div>
      <div class="print-title">${_esc(item.title)}</div>
      ${item.date ? `<div class="print-date">${_esc(item.date)}</div>` : ''}
    </div>
    ${teethHTML}
    ${photosHTML ? `<div class="print-section-label">사진 (${(item.photos||[]).length}장)</div>
       <div class="print-photos">${photosHTML}</div>` : ''}
    ${descHTML}
    ${answerHTML}
    ${tagsHTML ? `<div class="print-tags">${tagsHTML}</div>` : ''}
    ${refsHTML}
    <div class="print-footer">
      <span>치과 임상 자료실 · ${_esc(location.href)}</span>
      <span>${new Date().toLocaleDateString('ko-KR')}</span>
    </div>`;

  // details 요소 인쇄 시 모두 펼치기
  printArea.querySelectorAll('details').forEach(d => d.open = true);
  _renderMath(printArea);

  // 사진이 다 로드되기 전에 인쇄하면 빈 칸으로 나오므로 대기 (최대 8초)
  const imgs = Array.from(printArea.querySelectorAll('img')).filter(im => !im.complete);
  if (imgs.length) {
    _edToast(`사진 ${imgs.length}장 로딩 중…`);
    await Promise.race([
      Promise.all(imgs.map(im => new Promise(res => { im.onload = im.onerror = res; }))),
      new Promise(res => setTimeout(res, 8000)),
    ]);
  }

  window.print();
}

// ── References ─────────────────────────────────────────────────
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderRefs(refs) {
  const el      = document.getElementById('modal-refs');
  const section = document.getElementById('refs-section');
  if (!refs.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  el.innerHTML = refs.map((r, i) => {
    const href = r.doi
      ? `https://doi.org/${r.doi}`
      : r.pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`
        : (r.title && r.journal !== '교과서')
          ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(r.title)}`
          : '';
    const titleHtml = href
      ? `<a href="${_esc(href)}" target="_blank" rel="noopener" class="ref-title-link">${_esc(r.title)}</a>`
      : `${_esc(r.title)}`;
    const badge = r.doi
      ? `<span class="ref-badge ref-badge-doi">DOI</span>`
      : r.pmid
        ? `<span class="ref-badge ref-badge-pmid">PubMed</span>`
        : href
          ? `<span class="ref-badge ref-badge-search">검색</span>`
          : '';
    const hasAbs   = r.abstract || r.abstractEn;
    const absBtn   = hasAbs ? `<button class="ref-abs-toggle" onclick="toggleRefAbs(this,'ref-abs-${i}')">초록 ▼</button>` : '';
    let absContent = '';
    if (r.abstractEn) absContent += `<div class="ref-abs-section"><div class="ref-abs-label">영문</div><div>${_esc(r.abstractEn).replace(/\n/g,'<br>')}</div></div>`;
    if (r.abstract)   absContent += `<div class="ref-abs-section"><div class="ref-abs-label">한글</div><div>${_esc(r.abstract).replace(/\n/g,'<br>')}</div></div>`;
    const absBlock = hasAbs ? `<div class="ref-abstract-text" id="ref-abs-${i}" style="display:none">${absContent}</div>` : '';
    return `<li><div class="ref-main"><strong>${_esc(r.authors)}</strong> (${_esc(r.year)}). ${titleHtml}. <em>${_esc(r.journal)}</em>${r.volume?', '+_esc(r.volume):''}${r.pages?', '+_esc(r.pages):''}. ${badge}${absBtn}</div>${absBlock}</li>`;
  }).join('');
}

function toggleRefAbs(btn, id) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  btn.textContent  = open ? '초록 ▼' : '초록 ▲';
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const _isDark = (localStorage.getItem('dental-theme')||'light') === 'dark';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = _isDark ? '☀️' : '🌙';
  });
  _updateAdminLinks(_isDark);

  // 뷰 모드 초기 버튼 상태 (모든 페이지의 토글 버튼 동기화)
  document.querySelectorAll('.view-toggle-btn[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === _viewMode);
  });

  // 초기 히스토리 상태 설정
  history.replaceState({ page: 'home' }, '');

  // 데이터 로드가 실패해도(오프라인·권한) 이 뒤의 초기화 — 특히 해시 딥링크와
  // 이벤트 핸들러 등록 — 는 계속되어야 한다. 실패를 여기서 삼킨다.
  try { await loadData(); }
  catch (e) { console.warn('[loadData] 실패 — 로컬 시드로 계속합니다', e); }

  const _h = location.hash.slice(1);
  if (_h) { const _m = _h.match(/^(case|content)-(.+)$/); if (_m) openModal(_m[2], _m[1]); }

  // 뒤로가기 핸들러
  window.addEventListener('popstate', e => {
    const state = e.state || { page: 'home' };
    const modalEl = document.getElementById('modal-overlay');
    const modalOpen = modalEl.classList.contains('open');
    const fsOv = document.getElementById('fs-gallery');
    const fsOpen = fsOv && fsOv.classList.contains('open');

    // 날짜 상세 모달 열린 상태에서 뒤로가기 → 모달만 닫기
    const calDayOv = document.getElementById('cal-day-overlay');
    if (calDayOv && calDayOv.classList.contains('open')) {
      _calDayPushed = false;
      calDayOv.classList.remove('open');
      document.body.style.overflow = '';
      return;
    }

    // 검색 오버레이 열린 상태에서 뒤로가기 → 검색 닫기
    const searchOv = document.getElementById('search-overlay');
    if (searchOv && searchOv.classList.contains('open')) {
      searchOv.classList.remove('open');
      document.body.style.overflow = '';
      document.getElementById('search-overlay-input').value = '';
      document.getElementById('search-results-section').style.display = 'none';
      document.getElementById('search-tag-section').style.display = '';
      return;
    }

    // 전체화면 열린 상태에서 뒤로가기 → 전체화면만 닫기
    if (fsOpen) {
      fsOv.classList.remove('open');
      return;
    }

    if (modalOpen) {
      // 모달 열린 상태에서 뒤로가기 → 모달 닫기
      _modalPushed = false;
      modalEl.classList.remove('open');
      document.body.style.overflow = '';
      return;
    }

    if (state.modal && !modalOpen) {
      // 앞으로가기로 모달 상태 복원
      _isPopState = true;
      openModal(state.modal.id, state.modal.type);
      _isPopState = false;
      return;
    }

    // 페이지 이동
    _isPopState = true;
    showPage(state.page || 'home');
    _isPopState = false;
  });

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  const _edOverlay = document.getElementById('editor-overlay');
  let _edMouseDownOnOverlay = false;
  _edOverlay.addEventListener('mousedown', e => {
    _edMouseDownOnOverlay = e.target.id === 'editor-overlay';
  });
  _edOverlay.addEventListener('click', e => {
    if (e.target.id === 'editor-overlay' && _edMouseDownOnOverlay) closeEditor();
    _edMouseDownOnOverlay = false;
  });
  document.addEventListener('keydown', e => {
    const presOpen = document.getElementById('pres-overlay')?.classList.contains('open');
    if (presOpen) {
      if (e.key === 'Escape') _closePresentation();
      if (e.key === 'ArrowLeft')  _presGo(-1);
      if (e.key === 'ArrowRight') _presGo(1);
      return;
    }
    if (e.key === 'Escape') { _closeSearch(); closeModal(); closeEditor(); closeDayModal(); _annCancel(); }
    // Ctrl/Cmd+Enter로 편집기 저장
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'
        && document.getElementById('editor-overlay').classList.contains('open')) {
      e.preventDefault();
      const saveBtn = document.getElementById('ed-save-btn');
      if (saveBtn && !saveBtn.disabled) _edSave();
      return;
    }
    if (document.getElementById('modal-overlay').classList.contains('open')) {
      if (e.key === 'ArrowLeft')  changePhoto(-1);
      if (e.key === 'ArrowRight') changePhoto(1);
    }
    const tag = document.activeElement.tagName;
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault();
      _openSearch();
    }
  });
  document.addEventListener('paste', _edGlobalPasteHandler);

  // SDK 가 없으면(오프라인·CDN 차단) 여기서 예외가 나 뒤의 초기화가 통째로
  // 멈춘다 — 해시 딥링크까지 죽으므로 감싼다. 로그인만 못 할 뿐 조회는 된다.
  try {
    firebase.auth().onAuthStateChanged(user => {
      const nowAdmin = !!user;
      _updateAdminBadge(user);
      if (isAdmin !== nowAdmin) {
        isAdmin = nowAdmin;
        _renderAll();
      }
    });
  } catch (e) {
    console.warn('[auth] 초기화 실패 — 로그인 없이 조회 전용으로 동작합니다', e);
  }

  // 인용 위첨자 툴팁
  _setupCiteTip();

  // 해시로 들어온 참고자료 항목 열기 (#soap-… / #exam-… / #term-… / #lab-…)
  if (/^#(soap|exam|term|lab|tip)-/.test(location.hash)) setTimeout(_openRefFromHash, 300);
  window.addEventListener('hashchange', () => {
    if (/^#(soap|exam|term|lab|tip)-/.test(location.hash)) _openRefFromHash();
  });
});

// ════════════════════════════════════════════════════════════════
// 관리자 인라인 에디터
// ════════════════════════════════════════════════════════════════

let _edId = null, _edType = null;
let _edPhotos = [], _edTags = [], _edTeeth = [];
let _edDirty = false; // 저장하지 않은 변경사항 여부
let _tcMultiSel = new Set(); // shift-선택 중인 치아 번호들
let _tcDragging = false, _tcDragMoved = false;

const TOOTH_TYPES = [
  { id: 'implant', label: '임플란트', color: '#2563eb' },
  { id: 'crown',   label: '크라운',   color: '#f97316' },
  { id: 'pontic',  label: 'Pontic',   color: '#059669' },
  { id: 'rr',      label: 'R.R',      color: '#9f1239' },
  { id: 'bridge',  label: '브릿지',   color: '#7c3aed' },
  { id: 'missing', label: '발치',     color: '#64748b' },
  { id: 'caries',  label: '충치',     color: '#b45309' },
];

function _toothEntry(n) { return _edTeeth.find(t => t.n === n) || null; }

function _renderToothChartHTML(teeth, interactive) {
  const rows = [
    { label:'상악', quads:[[18,17,16,15,14,13,12,11],[21,22,23,24,25,26,27,28]] },
    { label:'하악', quads:[[48,47,46,45,44,43,42,41],[31,32,33,34,35,36,37,38]] }
  ];
  const T = n => {
    const entry = (teeth||[]).find(t => t.n === n);
    const type  = entry ? TOOTH_TYPES.find(t => t.id === entry.type) : null;
    const style = type ? `style="background:${type.color};color:#fff;border-color:${type.color}"` : '';
    const cls   = entry ? ' tc-sel' : '';
    const ev    = interactive ? `onclick="event.stopPropagation();_clickTooth(${n},this,event)"` : '';
    return `<div class="tc-tooth${cls}" data-t="${n}" ${style} ${ev}>${n}</div>`;
  };
  const sorted = [...(teeth||[])].sort((a,b)=>a.n-b.n);
  let badges = '';
  if (sorted.length) {
    const groups = {};
    sorted.forEach(t => { (groups[t.type] = groups[t.type] || []).push(t.n); });
    badges = `<div class="tc-summary">${TOOTH_TYPES.filter(tp => groups[tp.id]).map(tp =>
      `<span class="tc-sum-row"><span class="tc-sum-label" style="color:${tp.color}">${tp.label}</span><span class="tc-sum-nums">${groups[tp.id].join(', ')}</span></span>`
    ).join('')}</div>`;
  }
  return `<div class="tc-wrap">${rows.map(r=>`
    <div class="tc-row">
      <span class="tc-jaw">${r.label}</span>
      <div class="tc-quad">${r.quads[0].map(T).join('')}</div>
      <div class="tc-mid"></div>
      <div class="tc-quad">${r.quads[1].map(T).join('')}</div>
    </div>`).join('')}${badges}</div>`;
}

function _setupTcDrag() {
  const wrap = document.getElementById('ed-tooth');
  if (!wrap || wrap._dragSetup) return;
  wrap._dragSetup = true;

  function toothFromEl(el) {
    const t = el && el.closest ? el.closest('.tc-tooth') : null;
    return t ? +t.dataset.t : null;
  }
  function addToSel(n) {
    if (!n) return;
    const el = wrap.querySelector(`.tc-tooth[data-t="${n}"]`);
    if (!_tcMultiSel.has(n)) { _tcMultiSel.add(n); if (el) el.classList.add('tc-multi'); }
  }

  let _dragStartN = null;

  wrap.addEventListener('mousedown', e => {
    const n = toothFromEl(e.target);
    if (!n) return;
    e.preventDefault();
    _tcDragging = true;
    _tcDragMoved = false;
    _dragStartN = n;
  });

  wrap.addEventListener('mouseover', e => {
    if (!_tcDragging) return;
    const n = toothFromEl(e.target);
    if (!n) return;
    if (!_tcDragMoved) {
      // 첫 이동 시 시작 치아도 포함
      _tcDragMoved = true;
      _closeTcPicker();
      addToSel(_dragStartN);
    }
    addToSel(n);
    _updateMultiBar();
  });

  _setupTcDragGlobal();

  // Touch support
  wrap.addEventListener('touchstart', e => {
    const n = toothFromEl(e.target);
    if (!n) return;
    _tcDragging = true;
    _tcDragMoved = false;
    _dragStartN = n;
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (!_tcDragging) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const n = toothFromEl(el);
    if (!n) return;
    if (!_tcDragMoved) {
      _tcDragMoved = true;
      _closeTcPicker();
      addToSel(_dragStartN);
    }
    addToSel(n);
    _updateMultiBar();
  }, { passive: true });
}

// document 레벨 드래그 종료 리스너 — 1회만 등록 (에디터 재오픈마다 누적 방지)
let _tcGlobalSetup = false;
function _setupTcDragGlobal() {
  if (_tcGlobalSetup) return;
  _tcGlobalSetup = true;
  document.addEventListener('mouseup', () => {
    if (_tcDragging) {
      _tcDragging = false;
      if (_tcDragMoved && _tcMultiSel.size > 0) _updateMultiBar();
    }
  });
  document.addEventListener('touchend', () => { _tcDragging = false; });
}

function _clickTooth(n, el, e) {
  // 드래그 직후 click 이벤트 무시
  if (_tcDragMoved) { _tcDragMoved = false; return; }
  // Shift+클릭: 다중 선택 모드
  if (e && e.shiftKey) {
    _closeTcPicker();
    if (_tcMultiSel.has(n)) { _tcMultiSel.delete(n); el.classList.remove('tc-multi'); }
    else { _tcMultiSel.add(n); el.classList.add('tc-multi'); }
    _updateMultiBar();
    return;
  }
  // 다중 선택 중에 일반 클릭하면 해당 치아도 추가 후 팝업
  if (_tcMultiSel.size > 0) {
    if (!_tcMultiSel.has(n)) { _tcMultiSel.add(n); el.classList.add('tc-multi'); }
    _showMultiPicker(el);
    return;
  }
  // 단일 치아 팝업
  _closeTcPicker();
  const existing = _toothEntry(n);
  const picker = document.createElement('div');
  picker.id = 'tc-picker';
  picker.innerHTML = TOOTH_TYPES.map(t =>
    `<button class="tcp-btn${existing&&existing.type===t.id?' tcp-active':''}"
      style="--tc:${t.color}"
      onclick="event.stopPropagation();_setToothType(${n},'${t.id}')">${t.label}</button>`
  ).join('') +
  (existing ? `<button class="tcp-btn tcp-remove" onclick="event.stopPropagation();_setToothType(${n},null)">✕ 제거</button>` : '');
  _positionPicker(picker, el);
  setTimeout(() => document.addEventListener('click', _closeTcPicker, {once:true}), 0);
}

function _showMultiPicker(anchorEl) {
  _closeTcPicker();
  const cnt = _tcMultiSel.size;
  const picker = document.createElement('div');
  picker.id = 'tc-picker';
  picker.innerHTML =
    `<div class="tcp-label">${cnt}개 치아에 적용:</div>` +
    TOOTH_TYPES.map(t =>
      `<button class="tcp-btn" style="--tc:${t.color}"
        onclick="event.stopPropagation();_applyMultiType('${t.id}')">${t.label}</button>`
    ).join('') +
    `<button class="tcp-btn tcp-remove" onclick="event.stopPropagation();_applyMultiType(null)">✕ 제거</button>`;
  _positionPicker(picker, anchorEl);
  setTimeout(() => document.addEventListener('click', _closeTcPicker, {once:true}), 0);
}

function _positionPicker(picker, el) {
  document.body.appendChild(picker);
  const rect = el.getBoundingClientRect();
  const pw = picker.offsetWidth, ph = picker.offsetHeight;
  let left = rect.left + rect.width/2 - pw/2;
  let top  = rect.bottom + 6;
  if (left < 4) left = 4;
  if (left + pw > window.innerWidth - 4) left = window.innerWidth - pw - 4;
  if (top + ph > window.innerHeight - 4) top = rect.top - ph - 6;
  picker.style.left = left + 'px';
  picker.style.top  = top  + 'px';
}

function _closeTcPicker() {
  const p = document.getElementById('tc-picker');
  if (p) p.remove();
}

function _applyMultiType(typeId) {
  _tcMultiSel.forEach(n => {
    _edTeeth = _edTeeth.filter(t => t.n !== n);
    if (typeId) _edTeeth.push({ n, type: typeId });
  });
  _tcMultiSel.clear();
  _closeTcPicker();
  document.getElementById('ed-tooth').innerHTML = _renderToothChartHTML(_edTeeth, true);
  _setupTcDrag();
  _updateMultiBar();
}

function _updateMultiBar() {
  const wrap = document.querySelector('#ed-tooth .tc-wrap');
  if (!wrap) return;
  let bar = document.getElementById('tc-multi-bar');
  if (_tcMultiSel.size === 0) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'tc-multi-bar'; wrap.appendChild(bar); }
  bar.innerHTML =
    `<span class="tcmb-label">⇧ ${_tcMultiSel.size}개 선택됨 —</span>` +
    TOOTH_TYPES.map(t =>
      `<button class="tcp-btn tcmb-btn" style="--tc:${t.color}"
        onclick="_applyMultiType('${t.id}')">${t.label}</button>`
    ).join('') +
    `<button class="tcp-btn tcp-remove tcmb-btn" onclick="_applyMultiType(null)">✕ 제거</button>` +
    `<button class="tcp-btn tcmb-cancel" onclick="_clearMultiSel()">취소</button>`;
}

function _clearMultiSel() {
  _tcMultiSel.clear();
  document.querySelectorAll('.tc-tooth.tc-multi').forEach(el => el.classList.remove('tc-multi'));
  const bar = document.getElementById('tc-multi-bar');
  if (bar) bar.remove();
}

function _setToothType(n, typeId) {
  _edTeeth = _edTeeth.filter(t => t.n !== n);
  if (typeId) _edTeeth.push({ n, type: typeId });
  document.getElementById('ed-tooth').innerHTML = _renderToothChartHTML(_edTeeth, true);
  _setupTcDrag();
}

function _refreshTcBadges() {
  const wrap = document.querySelector('#ed-tooth .tc-wrap');
  if (!wrap) return;
  let b = wrap.querySelector('.tc-badges');
  const sorted = [..._edTeeth].sort((a,x)=>a.n-x.n);
  if (!b && sorted.length) { b = document.createElement('div'); b.className='tc-badges'; wrap.appendChild(b); }
  if (b) b.innerHTML = sorted.map(t => {
    const type = TOOTH_TYPES.find(x=>x.id===t.type);
    return `<span class="tc-badge">${t.n} ${type?type.label:''}</span>`;
  }).join('');
}
let _edPendingImg = null;

// ── 관리자 배지 ──────────────────────────────────────────────
function _updateAdminBadge(user) {
  let badge = document.getElementById('admin-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'admin-badge';
    document.body.appendChild(badge);
  }
  badge.innerHTML = user
    ? `<div class="ab-on">관리자 모드 <button onclick="firebase.auth().signOut()">로그아웃</button></div>`
    : '';
}

// ── 각과/케이스 페이지에 + 추가 버튼 삽입 ──────────────────
function _injectAdminControls() {
  document.querySelectorAll('.admin-inject').forEach(el => el.remove());
  if (!isAdmin) return;

  // Home page — "부문 관리" button
  const homeHeader = document.querySelector('#page-home .section-header');
  if (homeHeader) {
    const btn = document.createElement('button');
    btn.className = 'admin-add-btn admin-inject';
    btn.textContent = '⚙ 부문 관리';
    btn.onclick = _openDeptManager;
    homeHeader.appendChild(btn);
  }

  const casesHeader = document.querySelector('#page-cases .section-header');
  if (casesHeader) {
    const btn = document.createElement('button');
    btn.className = 'admin-add-btn admin-inject';
    btn.textContent = '+ 케이스 추가';
    btn.onclick = () => openEditorNew('case');
    casesHeader.appendChild(btn);
  }

  _departments.forEach(d => {
    const header = document.querySelector(`#page-dept-${d.id} .section-header`);
    if (!header) return;
    const btn = document.createElement('button');
    btn.className = 'admin-add-btn admin-inject';
    btn.textContent = '+ 자료 추가';
    btn.onclick = () => openEditorNew('content', d.id);
    header.appendChild(btn);
  });

  // Calendar — "사진/텍스트로 일정 가져오기" button
  const calToolbar = document.querySelector('#page-calendar .cal-toolbar');
  if (calToolbar) {
    const btn = document.createElement('button');
    btn.className = 'cal-import-btn admin-inject';
    btn.innerHTML = '📷 일정 가져오기';
    btn.onclick = _openSchedImport;
    calToolbar.appendChild(btn);
  }
}

// ── 부문 관리 (동적 추가/삭제) ────────────────────────────────
// Firestore departments 컬렉션이 비어있으면 현재 기본 부문을 시딩.
// (시딩하지 않으면 새 부문 1개 추가 시 기본 부문들이 사라짐)
async function _seedDepartmentsIfEmpty() {
  const snap = await db.collection('departments').limit(1).get();
  if (!snap.empty) return false;
  const batch = db.batch();
  _departments.forEach((d, i) => {
    const { id, ...rest } = d;
    batch.set(db.collection('departments').doc(id), { ...rest, order: i + 1 });
  });
  await batch.commit();
  return true;
}

async function _openDeptManager() {
  document.getElementById('dept-mgr-modal')?.remove();
  _deptEditingId = null;
  const ov = document.createElement('div');
  ov.id = 'dept-mgr-modal';
  ov.className = 'modal-overlay open';
  ov.innerHTML = `
    <div class="modal" style="max-width:480px;padding:1.5rem">
      <button class="modal-close" onclick="document.getElementById('dept-mgr-modal').remove()">✕</button>
      <div style="font-size:1.05rem;font-weight:700;margin-bottom:1.2rem">부문 관리</div>
      <div id="dept-mgr-list" style="margin-bottom:1rem"></div>
      <div style="border-top:1.5px solid var(--border);padding-top:1rem">
        <div style="font-weight:600;font-size:0.9rem;margin-bottom:0.7rem;color:var(--text-muted)">새 부문 추가</div>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
          <input id="dmf-id"   placeholder="ID (영문, 예: endo)"  style="flex:1;padding:0.5rem 0.7rem;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.85rem">
          <input id="dmf-name" placeholder="이름 (예: 근관치료)"  style="flex:1;padding:0.5rem 0.7rem;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.85rem">
        </div>
        <input id="dmf-icon" placeholder="아이콘 (이모지 또는 이미지 URL, 예: 🦷)" style="width:100%;box-sizing:border-box;padding:0.5rem 0.7rem;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.85rem;margin-bottom:0.7rem">
        <button onclick="_saveDeptNew()" style="padding:0.55rem 1.2rem;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:0.9rem;cursor:pointer;font-weight:600">+ 추가</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  _renderDeptMgrList();

  // 첫 사용 시 기본 부문을 Firestore에 시딩한 뒤 목록 갱신
  try {
    const seeded = await _seedDepartmentsIfEmpty();
    if (seeded) {
      const snap = await db.collection('departments').orderBy('order', 'asc').get();
      _initDeptDOM(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      _renderAll();
      _renderDeptMgrList();
    }
  } catch(e) { /* 시딩 실패 시 메모리 기본값으로 계속 동작 */ }
}

function _renderDeptMgrList() {
  const el = document.getElementById('dept-mgr-list');
  if (!el) return;
  if (!_departments.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem;padding:0.3rem 0">등록된 부문이 없습니다.</div>';
    return;
  }
  const rowStyle = 'display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.7rem;border-radius:8px;background:var(--card-bg);margin-bottom:0.35rem';
  const inStyle  = 'padding:0.4rem 0.55rem;border:1.5px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font-size:0.83rem';
  const btnStyle = 'padding:0.3rem 0.65rem;border:none;border-radius:6px;font-size:0.78rem;cursor:pointer;color:#fff';

  el.innerHTML = _departments.map(d => {
    const count = allContents.filter(c => c.department === d.id).length;

    // 편집 모드
    if (d.id === _deptEditingId) {
      const iconVal = d.iconImg || d.icon || '';
      return `
        <div style="${rowStyle};flex-wrap:wrap">
          <input id="dme-icon-${d.id}" value="${_esc(iconVal)}" placeholder="아이콘/URL" style="${inStyle};width:5.5em">
          <input id="dme-name-${d.id}" value="${_esc(d.name)}" placeholder="이름" style="${inStyle};flex:1;min-width:6em">
          <span style="font-size:0.72rem;color:var(--text-muted)">${d.id}</span>
          <button onclick="_saveDeptEdit('${d.id}')" style="${btnStyle};background:var(--primary)">저장</button>
          <button onclick="_cancelDeptEdit()" style="${btnStyle};background:#94a3b8">취소</button>
        </div>`;
    }

    // 표시 모드
    const iconHtml = d.iconImg
      ? `<img src="${_esc(d.iconImg)}" style="width:1.2em;height:1.2em;vertical-align:middle">`
      : (d.icon || '📁');
    return `
      <div style="${rowStyle}">
        <span style="font-size:1.1em;width:1.5em;text-align:center">${iconHtml}</span>
        <span style="flex:1;font-weight:500">${_esc(d.name)}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);margin-right:0.2rem">${d.id} · ${count}건</span>
        <button onclick="_editDept('${d.id}')" style="${btnStyle};background:var(--primary)">편집</button>
        <button onclick="_deleteDept('${d.id}')" style="${btnStyle};background:#ef4444">삭제</button>
      </div>`;
  }).join('');
}

function _editDept(id) {
  _deptEditingId = id;
  _renderDeptMgrList();
  setTimeout(() => document.getElementById(`dme-name-${id}`)?.focus(), 30);
}

function _cancelDeptEdit() {
  _deptEditingId = null;
  _renderDeptMgrList();
}

async function _saveDeptEdit(id) {
  const name = (document.getElementById(`dme-name-${id}`)?.value || '').trim();
  const icon = (document.getElementById(`dme-icon-${id}`)?.value || '').trim();
  if (!name) { alert('이름을 입력하세요.'); return; }

  // 아이콘: URL이면 iconImg, 그 외엔 icon (반대 필드는 삭제)
  const del  = firebase.firestore.FieldValue.delete();
  const data = { name };
  if (icon.startsWith('http')) { data.iconImg = icon; data.icon = del; }
  else { data.icon = icon || '📁'; data.iconImg = del; }

  try {
    await db.collection('departments').doc(id).update(data);
    _deptEditingId = null;
    const snap = await db.collection('departments').orderBy('order', 'asc').get();
    _initDeptDOM(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    _renderAll();
    _renderDeptMgrList();
  } catch(e) { alert('저장 실패: ' + e.message); }
}

async function _saveDeptNew() {
  const raw  = (document.getElementById('dmf-id')?.value || '').trim();
  const id   = raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const name = (document.getElementById('dmf-name')?.value || '').trim();
  const icon = (document.getElementById('dmf-icon')?.value || '').trim();
  if (!id || !name) { alert('ID와 이름을 입력하세요.'); return; }
  if (_departments.find(d => d.id === id)) { alert('이미 존재하는 ID입니다.'); return; }

  const data = { name, order: _departments.length + 1 };
  if (icon.startsWith('http')) data.iconImg = icon;
  else data.icon = icon || '📁';

  try {
    await db.collection('departments').doc(id).set(data);
    document.getElementById('dmf-id').value   = '';
    document.getElementById('dmf-name').value = '';
    document.getElementById('dmf-icon').value = '';
    const snap = await db.collection('departments').orderBy('order', 'asc').get();
    _initDeptDOM(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    _renderAll();
    _renderDeptMgrList();
  } catch(e) { alert('저장 실패: ' + e.message); }
}

async function _deleteDept(id) {
  const d     = _departments.find(x => x.id === id);
  const count = allContents.filter(c => c.department === id).length;
  const msg   = count
    ? `'${d?.name || id}' 부문을 삭제하시겠습니까?\n(해당 부문의 자료 ${count}건은 삭제되지 않습니다.)`
    : `'${d?.name || id}' 부문을 삭제하시겠습니까?`;
  if (!confirm(msg)) return;
  try {
    await db.collection('departments').doc(id).delete();
    const snap  = await db.collection('departments').orderBy('order', 'asc').get();
    const depts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _initDeptDOM(depts.length ? depts : DEPARTMENTS);
    _renderAll();
    _injectAdminControls();
    _renderDeptMgrList();
  } catch(e) { alert('삭제 실패: ' + e.message); }
}

// ── 삭제 ─────────────────────────────────────────────────────
async function deleteCardItem(id, type) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  const col = type === 'case' ? 'cases' : 'departmentContents';
  await db.collection(col).doc(id).delete();
  await loadData();
}

// ── 에디터 열기 (기존 항목 편집) ────────────────────────────
async function openEditorFor(id, type) {
  const col = type === 'case' ? 'cases' : 'departmentContents';
  const snap = await db.collection(col).doc(id).get();
  if (!snap.exists) return;
  _edId = id; _edType = type;
  _renderEditorForm(snap.data());
  document.getElementById('editor-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ── 에디터 열기 (새 항목) ────────────────────────────────────
function openEditorNew(type, deptId = '') {
  _edId = null; _edType = type;
  _renderEditorForm(deptId ? { department: deptId } : {});
  document.getElementById('editor-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ── 에디터 닫기 ──────────────────────────────────────────────
function closeEditor(force = false) {
  if (!force && _edDirty) {
    if (!confirm('저장하지 않은 변경사항이 있습니다.\n닫으시겠습니까?')) return;
  }
  _edDirty = false;
  document.getElementById('editor-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _edId = null; _edType = null; _edPhotos = []; _edTags = [];
}

// 에디터가 열린 동안 전역 Ctrl+V로 사진 붙여넣기 (업로드 갤러리에 추가)
function _edGlobalPasteHandler(e) {
  if (!document.getElementById('editor-overlay').classList.contains('open')) return;
  // 텍스트영역에 포커스가 있으면 기존 textarea paste 핸들러가 처리
  if (document.activeElement?.id === 'ed-description') return;
  const cd = e.clipboardData;
  if (!cd) return;
  const files = Array.from(cd.items || [])
    .filter(i => i.type.startsWith('image/'))
    .map(i => i.getAsFile())
    .filter(Boolean);
  if (!files.length) return;
  e.preventDefault();
  _edAddFiles(files);
  _edToast(`사진 ${files.length}장을 붙여넣었습니다.`);
}

// ── 폼 렌더 ──────────────────────────────────────────────────
function _renderEditorForm(data = {}) {
  _edPhotos = (data.photos || []).map(p => ({ url: p.url, caption: p.caption || '', annotations: p.annotations || [] }));
  _edTags   = data.tags  ? [...data.tags]  : [];
  _edTeeth  = (data.teeth || []).map(t => typeof t === 'number' ? {n:t, type:'implant'} : t);
  document.getElementById('editor-form-title').textContent =
    _edId
      ? (_edType === 'case' ? '케이스 편집' : '자료 편집')
      : (_edType === 'case' ? '새 임상 케이스' : '새 각과 자료');
  document.getElementById('editor-form-content').innerHTML = _edFormHTML(data);
  document.getElementById('ed-title').value       = data.title || '';
  document.getElementById('ed-summary').value     = data.summary || '';
  document.getElementById('ed-description').value = data.description || '';
  // 진행 상태는 케이스 전용
  const statusGrp = document.getElementById('ed-status-group');
  if (statusGrp) statusGrp.style.display = _edType === 'case' ? '' : 'none';
  _edRenderPhotoPreview();
  _edRenderTagChips();
  _edSetupTextareaDrop();
  _setupTcDrag();
  // 편집기 열릴 때 미리보기 분할 뷰 자동 ON
  const pane  = document.getElementById('ed-preview-pane');
  const split = document.getElementById('ed-split');
  const btn   = document.getElementById('ed-preview-toggle');
  const ta    = document.getElementById('ed-description');
  if (pane && pane.style.display === 'none') {
    pane.style.display = '';
    split?.classList.add('ed-split-active');
    if (ta) ta.style.borderRadius = '0';
    if (btn) btn.classList.add('active');
    _edUpdatePreview();
  }
  // 열릴 때 dirty 초기화 + 이후 변경 감지
  _edDirty = false;
  document.getElementById('editor-form-content').addEventListener('input', () => { _edDirty = true; }, { passive: true });
}

function _edFormHTML(d = {}) {
  const deptOpts = _departments.map(dept =>
    `<option value="${dept.id}"${d.department === dept.id ? ' selected' : ''}>${dept.name}</option>`
  ).join('');
  return `
    <div class="form-card">
      <div class="form-grid">
        <div class="form-group full">
          <label>제목 *</label>
          <input type="text" id="ed-title" placeholder="제목">
        </div>
        <div class="form-group">
          <label>진료과 *</label>
          <select id="ed-dept">${deptOpts}</select>
        </div>
        <div class="form-group">
          <label>날짜</label>
          <input type="date" id="ed-date" value="${d.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group" id="ed-status-group">
          <label>진행 상태</label>
          <select id="ed-status">
            <option value=""${!d.status ? ' selected' : ''}>— 없음</option>
            <option value="ongoing"${d.status === 'ongoing' ? ' selected' : ''}>🔵 진행중</option>
            <option value="done"${d.status === 'done' ? ' selected' : ''}>✅ 완료</option>
          </select>
        </div>
        <div class="form-group full">
          <label>한 줄 요약</label>
          <input type="text" id="ed-summary" placeholder="목록에 표시되는 짧은 설명">
        </div>
        <div class="form-group full">
          <label>상세 설명</label>
          <div class="editor-toolbar">
            <button type="button" class="tb-btn" onclick="_edFmt('bold')"><b>B</b></button>
            <button type="button" class="tb-btn" onclick="_edFmt('italic')"><i>I</i></button>
            <button type="button" class="tb-btn" onclick="_edFmt('strike')"><s>S</s></button>
            <div class="tb-sep"></div>
            <button type="button" class="tb-btn" onclick="_edFmt('h1')">H1</button>
            <button type="button" class="tb-btn" onclick="_edFmt('h2')">H2</button>
            <button type="button" class="tb-btn" onclick="_edFmt('h3')">H3</button>
            <div class="tb-sep"></div>
            <button type="button" class="tb-btn" onclick="_edFmt('ul')">• 목록</button>
            <button type="button" class="tb-btn" onclick="_edFmt('hr')">― 선</button>
            <div class="tb-sep"></div>
            <span class="tb-label">글자색</span>
            <button type="button" class="tb-color" style="background:#ef4444" onclick="_edColor('#ef4444')"></button>
            <button type="button" class="tb-color" style="background:#f97316" onclick="_edColor('#f97316')"></button>
            <button type="button" class="tb-color" style="background:#16a34a" onclick="_edColor('#16a34a')"></button>
            <button type="button" class="tb-color" style="background:#2563eb" onclick="_edColor('#2563eb')"></button>
            <button type="button" class="tb-color" style="background:#7c3aed" onclick="_edColor('#7c3aed')"></button>
            <button type="button" class="tb-color" style="background:#64748b" onclick="_edColor('#64748b')"></button>
            <div class="tb-sep"></div>
            <span class="tb-label">형광펜</span>
            <button type="button" class="tb-color tb-hl" style="background:#fef08a" onclick="_edHl('#fef08a')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#bbf7d0" onclick="_edHl('#bbf7d0')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#bae6fd" onclick="_edHl('#bae6fd')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#fecdd3" onclick="_edHl('#fecdd3')"></button>
            <div class="tb-sep"></div>
            <span class="tb-label">삽입</span>
            <button type="button" class="tb-btn tb-snippet" onclick="_edSnippet('kbd')" title="단계 배지"><kbd style="background:#2563eb;color:#fff;padding:0.1em 0.4em;border-radius:3px;font-size:0.8em">Phase</kbd></button>
            <button type="button" class="tb-btn tb-snippet" onclick="_edSnippet('note')" title="안내 박스" style="color:#0c4a6e">ℹ️ 안내</button>
            <button type="button" class="tb-btn tb-snippet" onclick="_edSnippet('tip')" title="팁 박스" style="color:#14532d">💡 팁</button>
            <button type="button" class="tb-btn tb-snippet" onclick="_edSnippet('warning')" title="주의 박스" style="color:#78350f">⚠️ 주의</button>
            <button type="button" class="tb-btn tb-snippet" onclick="_edSnippet('danger')" title="위험 박스" style="color:#7f1d1d">🚫 위험</button>
            <button type="button" class="tb-btn tb-snippet" onclick="_edSnippet('dl')" title="항목 목록">📋 항목</button>
            <button type="button" class="tb-btn tb-snippet" onclick="_edSnippet('details')" title="접이식 섹션">▶ 접기</button>
            <div class="tb-sep"></div>
            <button type="button" class="tb-btn" onclick="_edTbInsertImg()" title="이미지 삽입">📷 이미지</button>
            <div class="tb-sep"></div>
            <button type="button" class="tb-btn" id="ed-preview-toggle" onclick="_edTogglePreview()" title="미리보기">👁 미리보기</button>
          </div>
          <div class="ed-split" id="ed-split">
            <textarea id="ed-description" rows="10"
              placeholder="케이스/자료 상세 내용&#10;&#10;💡 이미지를 이 칸에 드래그하면 글 중간에 삽입됩니다."
              style="min-height:200px;border-top:none;border-radius:0 0 0 8px"
              oninput="_edUpdatePreview()"></textarea>
            <div class="ed-preview-pane modal-description" id="ed-preview-pane" style="display:none"></div>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.25rem">📷 이미지 버튼 또는 드래그·붙여넣기로 이미지를 삽입할 수 있습니다.</div>
        </div>
        <div class="form-group full">
          <label>태그</label>
          <div class="tag-input-wrap" onclick="document.getElementById('ed-tag-input').focus()">
            <div id="ed-tag-chips"></div>
            <input class="tag-input" id="ed-tag-input" placeholder="태그 입력 후 Enter"
              onkeydown="_edTagInput(event)">
          </div>
        </div>
        <div class="form-group full">
          <label>치식 차팅 <span style="font-weight:400;font-size:0.72rem;color:var(--text-muted)">(클릭으로 선택)</span></label>
          <div id="ed-tooth">${_renderToothChartHTML(_edTeeth, true)}</div>
        </div>
      </div>
    </div>

    <div class="form-card">
      <div class="section-label">사진 업로드</div>
      <div class="upload-zone" id="ed-upload-zone"
        onclick="document.getElementById('ed-file-input').click()"
        ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="_edHandleDrop(event)">
        <input type="file" id="ed-file-input" multiple accept="image/*" onchange="_edFileSelect(event)">
        <div style="font-size:2rem;margin-bottom:0.5rem">📷</div>
        <div>사진을 여기에 드래그하거나 클릭하여 선택</div>
        <div style="font-size:0.8rem;margin-top:0.3rem;color:var(--text-muted)">여러 장 동시 선택 가능 · Ctrl+V로 붙여넣기</div>
      </div>
      <div class="upload-progress" id="ed-progress">
        <div class="upload-progress-bar" id="ed-progress-bar"></div>
      </div>
      <div class="photo-preview-list" id="ed-photo-preview"></div>
    </div>

    <div class="form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
        <div class="section-label" style="margin:0">참고 논문</div>
        <button class="btn btn-outline btn-sm" onclick="_edAddRef()">+ 논문 추가</button>
      </div>
      <div id="ed-refs-container">
        ${(d.references||[]).map((r,i) => _edRefBlockHTML(i, r)).join('')}
      </div>
    </div>

    <div style="display:flex;gap:0.75rem;justify-content:flex-end;align-items:center">
      <span style="font-size:0.72rem;color:var(--text-muted)">Ctrl+Enter로 저장</span>
      <button class="btn btn-outline" onclick="closeEditor()">취소</button>
      <button class="btn btn-primary" id="ed-save-btn" onclick="_edSave()">
        ${_edId ? '저장' : '등록'}
      </button>
    </div>`;
}

function _edRefBlockHTML(idx, r) {
  const ea = _esc;
  const pagesVal   = (r.volume ? r.volume + ', ' : '') + (r.pages || '');
  const absSaved   = (r.abstract || r.abstractEn) ? '<div class="ref-abstract-saved">초록 저장됨 (영문+한글) ✓</div>' : '';
  return `
    <div class="ref-block" id="ed-ref-${idx}">
      <button class="btn btn-danger btn-sm ref-remove" onclick="_edRemoveRef(${idx})">✕</button>
      <div class="ref-grid">
        <div class="form-group"><label>저자</label>
          <input type="text" id="ed-ref-authors-${idx}" value="${ea(r.authors)}" placeholder="저자명"></div>
        <div class="form-group"><label>연도</label>
          <input type="text" id="ed-ref-year-${idx}" value="${ea(r.year)}" placeholder="2024"></div>
        <div class="form-group" style="grid-column:1/-1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">
            <label style="margin:0">논문 제목</label>
            <button type="button" class="btn btn-outline btn-sm pubmed-search-btn" onclick="_edPubMedSearch(${idx})">🔍 PubMed 검색</button>
          </div>
          <input type="text" id="ed-ref-title-${idx}" value="${ea(r.title)}" placeholder="논문 제목">
          <div class="pubmed-results" id="ed-ref-results-${idx}"></div>
          <input type="hidden" id="ed-ref-abstract-en-${idx}" value="${ea(r.abstractEn)}">
          <input type="hidden" id="ed-ref-abstract-${idx}" value="${ea(r.abstract)}">
          <input type="hidden" id="ed-ref-pmid-${idx}" value="${ea(r.pmid)}">
          ${absSaved}
        </div>
        <div class="form-group"><label>저널명</label>
          <input type="text" id="ed-ref-journal-${idx}" value="${ea(r.journal)}" placeholder="저널명"></div>
        <div class="form-group"><label>권호/페이지</label>
          <input type="text" id="ed-ref-pages-${idx}" value="${ea(pagesVal)}" placeholder="73(1), 7-21"></div>
        <div class="form-group"><label>DOI</label>
          <input type="text" id="ed-ref-doi-${idx}" value="${ea(r.doi)}" placeholder="10.xxxx/xxxxx"></div>
      </div>
    </div>`;
}

// ── 태그 ──────────────────────────────────────────────────────
function _edTagInput(e) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const val = e.target.value.trim().replace(/,$/, '');
  if (val && !_edTags.includes(val)) { _edTags.push(val); _edRenderTagChips(); _edDirty = true; }
  e.target.value = '';
}
function _edRemoveTag(idx) { _edTags.splice(idx, 1); _edRenderTagChips(); _edDirty = true; }
function _edRenderTagChips() {
  document.getElementById('ed-tag-chips').innerHTML =
    _edTags.map((t,i) => `
      <span class="tag-chip">${t}
        <button type="button" onclick="_edRemoveTag(${i})">✕</button>
      </span>`).join('');
}

// ── 사진 ──────────────────────────────────────────────────────
function _edFileSelect(e) { _edAddFiles(Array.from(e.target.files)); e.target.value = ''; }
function _edHandleDrop(e) {
  e.preventDefault();
  document.getElementById('ed-upload-zone').classList.remove('dragover');
  _edAddFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
}
function _edAddFiles(files) {
  files.forEach(f => _edPhotos.push({ url: URL.createObjectURL(f), caption: '', file: f, annotations: [] }));
  _edRenderPhotoPreview();
  _edDirty = true;
}
function _edRenderPhotoPreview() {
  const el = document.getElementById('ed-photo-preview');
  if (!el) return;
  el.innerHTML = _edPhotos.map((p,i) => {
    const cnt = (p.annotations||[]).length;
    return `
    <div class="photo-preview-item">
      <img src="${p.url}" alt="" loading="lazy">
      <button class="photo-remove" onclick="_edRemovePhoto(${i})">✕</button>
      <button class="photo-ann-btn" onclick="openAnnotationEditor(${i})" title="주석 편집">✏️${cnt > 0 ? `<span class="ann-count">${cnt}</span>` : ''}</button>
      <input class="caption-input" type="text" placeholder="사진 설명 (선택)"
        value="${p.caption}" oninput="_edPhotos[${i}].caption=this.value">
    </div>`;
  }).join('');
}
function _edRemovePhoto(idx) { _edPhotos.splice(idx, 1); _edRenderPhotoPreview(); _edDirty = true; }

// ── 참고 논문 ─────────────────────────────────────────────────
function _edAddRef() {
  const container = document.getElementById('ed-refs-container');
  const idx = container.querySelectorAll('.ref-block').length;
  container.insertAdjacentHTML('beforeend', _edRefBlockHTML(idx, {}));
}
function _edRemoveRef(idx) {
  document.getElementById(`ed-ref-${idx}`).remove();
  document.querySelectorAll('#ed-refs-container .ref-block').forEach((block, i) => {
    block.id = `ed-ref-${i}`;
    block.querySelector('.ref-remove').setAttribute('onclick', `_edRemoveRef(${i})`);
    const pb = block.querySelector('.pubmed-search-btn');
    if (pb) pb.setAttribute('onclick', `_edPubMedSearch(${i})`);
    ['authors','year','title','journal','pages','doi','pmid','abstract','abstract-en','results'].forEach(f => {
      const el = block.querySelector(`[id*="-ref-${f}-"]`);
      if (el) el.id = `ed-ref-${f}-${i}`;
    });
  });
}
function _edCollectRefs() {
  const blocks = document.querySelectorAll('#ed-refs-container .ref-block');
  return Array.from(blocks).map((_,i) => {
    const g = f => (document.getElementById(`ed-ref-${f}-${i}`) || {value:''}).value.trim();
    const pages = g('pages'), dash = pages.indexOf(', ');
    return {
      authors: g('authors'), year: g('year'), title: g('title'), journal: g('journal'),
      volume: dash > -1 ? pages.slice(0, dash) : '',
      pages:  dash > -1 ? pages.slice(dash + 2) : pages,
      doi: g('doi'),
      pmid: g('pmid'),
      abstract: g('abstract'),
      abstractEn: g('abstract-en')
    };
  }).filter(r => r.title || r.authors);
}

// ── PubMed 검색 ──────────────────────────────────────────────
const _PUBMED = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
let _edPubMedCache = {};

async function _edPubMedSearch(idx) {
  const titleEl = document.getElementById(`ed-ref-title-${idx}`);
  const resultsEl = document.getElementById(`ed-ref-results-${idx}`);
  const btn = document.querySelector(`#ed-ref-${idx} .pubmed-search-btn`);
  const query = titleEl ? titleEl.value.trim() : '';
  if (!query) { _edToast('논문 제목을 먼저 입력하세요.', 'error'); return; }

  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '<span class="ed-spinner"></span> 검색 중...'; btn.disabled = true; }
  if (resultsEl) resultsEl.innerHTML = '';

  const _pmParams = '&tool=dental-site&email=admin@dental-site.app';
  try {
    const searchRes = await fetch(`${_PUBMED}esearch.fcgi?db=pubmed&retmax=6&retmode=json${_pmParams}&term=${encodeURIComponent(query)}`);
    if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    const ids = (searchData.esearchresult || {}).idlist || [];
    if (!ids.length) { _edToast('검색 결과가 없습니다.', 'error'); return; }

    const sumRes = await fetch(`${_PUBMED}esummary.fcgi?db=pubmed&retmode=json${_pmParams}&id=${ids.join(',')}`);
    if (!sumRes.ok) throw new Error(`HTTP ${sumRes.status}`);
    const sumData = await sumRes.json();
    const items = ids.map(id => (sumData.result || {})[id]).filter(Boolean);
    _edPubMedCache[idx] = items;

    if (!resultsEl) return;
    resultsEl.innerHTML = items.map((item, i) => {
      const authors = item.authors ? item.authors.slice(0,3).map(a=>a.name).join(', ') + (item.authors.length>3?' et al.':'') : '';
      const year = (item.pubdate||'').slice(0,4);
      const title = (item.title||'').replace(/<[^>]+>/g,'');
      return `<div class="pubmed-result-item" onclick="_edSelectPubMed(${idx},${i})">
        <div class="pr-title">${_esc(title)}</div>
        <div class="pr-meta">${_esc(authors)} · ${_esc(item.source)} · ${year}</div>
      </div>`;
    }).join('');
    resultsEl.style.display = 'block';

    const close = (e) => {
      if (!resultsEl.contains(e.target) && e.target !== titleEl) {
        resultsEl.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  } catch(e) {
    console.error('[PubMed]', e);
    _edToast('PubMed 검색 실패: ' + (e.message || '네트워크 오류'), 'error');
  } finally {
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
  }
}

async function _edSelectPubMed(idx, itemIdx) {
  const item = (_edPubMedCache[idx] || [])[itemIdx];
  if (!item) return;
  const resultsEl = document.getElementById(`ed-ref-results-${idx}`);
  if (resultsEl) resultsEl.style.display = 'none';

  const set = (f, v) => { const el = document.getElementById(`ed-ref-${f}-${idx}`); if (el) el.value = v || ''; };

  const title   = (item.title || '').replace(/<[^>]+>/g,'');
  const authors = item.authors ? item.authors.map(a=>a.name).join(', ') : '';
  const year    = (item.pubdate || '').slice(0, 4);
  const vol     = item.volume ? `${item.volume}${item.issue?'('+item.issue+')':''}` : '';
  const pages   = [vol, item.pages].filter(Boolean).join(', ');
  let doi = '';
  if (item.elocationid) { const m = item.elocationid.match(/10\.\S+/); if (m) doi = m[0]; }
  if (!doi && item.articleids) {
    const d = item.articleids.find(a => a.idtype === 'doi');
    if (d) doi = d.value;
  }

  set('title', title); set('authors', authors); set('year', year);
  set('journal', item.source); set('pages', pages); set('doi', doi);
  set('pmid', item.uid || '');

  // 초록 가져오기 → 한국어 번역
  _edToast('초록을 가져오는 중...');
  try {
    const fetchRes = await fetch(`${_PUBMED}efetch.fcgi?db=pubmed&retmode=xml&tool=dental-site&email=admin@dental-site.app&id=${item.uid}`);
    const xml = await fetchRes.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const parts = Array.from(doc.querySelectorAll('AbstractText'));
    const abstractEn = parts.map(el => {
      const label = el.getAttribute('Label');
      return label ? `[${label}] ${el.textContent}` : el.textContent;
    }).join('\n\n');

    let abstract = abstractEn;
    if (abstractEn) {
      _edToast('초록을 한국어로 번역하는 중...');
      abstract = await _translateToKorean(abstractEn);
    }

    set('abstract-en', abstractEn);
    set('abstract', abstract);

    const block = document.getElementById(`ed-ref-${idx}`);
    if (block) {
      let saved = block.querySelector('.ref-abstract-saved');
      if (!saved) {
        saved = document.createElement('div');
        saved.className = 'ref-abstract-saved';
        document.getElementById(`ed-ref-abstract-${idx}`).insertAdjacentElement('afterend', saved);
      }
      saved.textContent = (abstract || abstractEn) ? '초록 저장됨 (영문+한글) ✓' : '';
    }
    _edToast(abstract ? '논문 정보 및 초록이 입력되었습니다 ✓' : '논문 정보가 입력되었습니다 ✓');
  } catch(e) {
    _edToast('논문 기본 정보가 입력되었습니다 ✓');
  }
}

// ── 한국어 번역 (MyMemory 무료 API) ────────────────────────────
async function _translateToKorean(text) {
  if (!text) return '';
  const LIMIT = 450;

  const chunks = [];
  let pos = 0;
  while (pos < text.length) {
    if (text.length - pos <= LIMIT) { chunks.push(text.slice(pos)); break; }
    let end = pos + LIMIT;
    const dot = text.lastIndexOf('. ', end);
    if (dot > pos + 50) end = dot + 2;
    chunks.push(text.slice(pos, end));
    pos = end;
  }

  const results = [];
  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|ko`);
      const data = await res.json();
      results.push(data.responseStatus === 200 && data.responseData?.translatedText
        ? data.responseData.translatedText
        : chunk);
    } catch { results.push(chunk); }
  }
  return results.join(' ');
}

// ── 마크다운 툴바 ─────────────────────────────────────────────
function _edFmt(type) {
  const ta = document.getElementById('ed-description');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e);
  const before = ta.value.slice(0, s), after = ta.value.slice(e);
  const maps = {
    bold:   { wrap: ['**','**'], ph: '굵은 텍스트' },
    italic: { wrap: ['*','*'],   ph: '기울임 텍스트' },
    strike: { wrap: ['~~','~~'], ph: '취소선 텍스트' },
    h1:     { line: '# ',        ph: '제목 1' },
    h2:     { line: '## ',       ph: '제목 2' },
    h3:     { line: '### ',      ph: '제목 3' },
    ul:     { line: '- ',        ph: '목록 항목' },
    hr:     { insert: '\n---\n' }
  };
  const r = maps[type];
  let result, cursor;
  if (r.insert) {
    result = before + r.insert + after;
    cursor = s + r.insert.length;
  } else if (r.wrap) {
    const text = sel || r.ph;
    result = before + r.wrap[0] + text + r.wrap[1] + after;
    cursor = s + r.wrap[0].length + text.length + r.wrap[1].length;
  } else {
    const nl = (before.length > 0 && !before.endsWith('\n')) ? '\n' : '';
    const text = sel || r.ph;
    const ins = nl + r.line + text + '\n';
    result = before + ins + after;
    cursor = s + ins.length;
  }
  ta.value = result; ta.setSelectionRange(cursor, cursor); ta.focus();
}
function _edColor(color) {
  const ta = document.getElementById('ed-description');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const tag = `<span style="color:${color}">${ta.value.slice(s,e) || '텍스트'}</span>`;
  ta.value = ta.value.slice(0,s) + tag + ta.value.slice(e);
  ta.setSelectionRange(s + tag.length, s + tag.length); ta.focus();
}
function _edHl(color) {
  const ta = document.getElementById('ed-description');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const tag = `<mark style="background:${color}">${ta.value.slice(s,e) || '텍스트'}</mark>`;
  ta.value = ta.value.slice(0,s) + tag + ta.value.slice(e);
  ta.setSelectionRange(s + tag.length, s + tag.length); ta.focus();
}

function _edTogglePreview() {
  const pane  = document.getElementById('ed-preview-pane');
  const ta    = document.getElementById('ed-description');
  const split = document.getElementById('ed-split');
  const btn   = document.getElementById('ed-preview-toggle');
  const on    = pane.style.display === 'none';
  pane.style.display = on ? '' : 'none';
  split.classList.toggle('ed-split-active', on);
  ta.style.borderRadius = on ? '0' : '0 0 0 8px';
  btn.classList.toggle('active', on);
  if (on) _edUpdatePreview();
}

function _edUpdatePreview() {
  const pane = document.getElementById('ed-preview-pane');
  if (!pane || pane.style.display === 'none') return;
  const val = document.getElementById('ed-description').value;
  pane.innerHTML = marked.parse(val || '<span style="color:#94a3b8">미리보기가 여기에 표시됩니다.</span>');
  _renderMath(pane);
}

function _edSnippet(type) {
  const ta = document.getElementById('ed-description');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e).trim();
  const before = ta.value.slice(0, s), after = ta.value.slice(e);
  const nl = (before.length > 0 && !before.endsWith('\n')) ? '\n' : '';
  const snippets = {
    kbd:     () => { const t = sel||'Phase 1'; return { ins: `<kbd>${t}</kbd>`, cur: 5, len: t.length }; },
    note:    () => ({ ins: `\n<div class="note"><b>ℹ️ 안내</b>${sel||'내용을 입력하세요.'}</div>\n`, cur: 0 }),
    tip:     () => ({ ins: `\n<div class="tip"><b>💡 팁</b>${sel||'내용을 입력하세요.'}</div>\n`, cur: 0 }),
    warning: () => ({ ins: `\n<div class="warning"><b>⚠️ 주의</b>${sel||'내용을 입력하세요.'}</div>\n`, cur: 0 }),
    danger:  () => ({ ins: `\n<div class="danger"><b>🚫 위험</b>${sel||'내용을 입력하세요.'}</div>\n`, cur: 0 }),
    dl:      () => ({ ins: `\n<dl>\n  <dt>항목 1</dt><dd>내용 1</dd>\n  <dt>항목 2</dt><dd>내용 2</dd>\n</dl>\n`, cur: 0 }),
    details: () => ({ ins: `\n<details>\n<summary>${sel||'제목'}</summary>\n\n내용을 입력하세요.\n\n</details>\n`, cur: 0 }),
  };
  const { ins, cur, len } = snippets[type]();
  const full = nl + ins;
  ta.value = before + full + after;
  const pos = s + full.length - (cur ? full.length - nl.length - cur - (len||0) : 0);
  ta.setSelectionRange(pos, pos);
  ta.focus();
}

// ── 텍스트 영역 이미지 드래그 ────────────────────────────────
function _edSetupTextareaDrop() {
  const ta = document.getElementById('ed-description');
  if (!ta) return;
  let savedPos = 0;
  ta.addEventListener('click',   () => { savedPos = ta.selectionStart; });
  ta.addEventListener('keyup',   () => { savedPos = ta.selectionStart; });
  ta.addEventListener('input',   () => { savedPos = ta.selectionStart; });
  ta.addEventListener('dragover', e => { e.preventDefault(); ta.classList.add('drag-active'); });
  ta.addEventListener('dragleave', () => { ta.classList.remove('drag-active'); });
  ta.addEventListener('drop', e => {
    e.preventDefault();
    ta.classList.remove('drag-active');
    const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (f) _edDropImage(ta, f, savedPos);
  });
  ta.addEventListener('paste', e => {
    const cd = e.clipboardData;
    if (!cd) return;
    let file = null;
    // 1) 이미지를 캡처/복사한 경우 (clipboard items)
    const item = Array.from(cd.items || []).find(i => i.type.startsWith('image/'));
    if (item) file = item.getAsFile();
    // 2) 이미지 파일 자체를 복사한 경우 (clipboard files)
    if (!file && cd.files && cd.files.length) {
      file = Array.from(cd.files).find(f => f.type.startsWith('image/'));
    }
    if (!file) return; // 이미지가 아니면 일반 텍스트 붙여넣기 그대로 진행
    e.preventDefault();
    _edDropImage(ta, file, ta.selectionStart);
  });
}

function _edTbInsertImg() {
  const ta = document.getElementById('ed-description');
  if (!ta) return;
  // Snap insert position to end of current line to avoid splitting text mid-sentence
  const pos  = ta.selectionStart;
  const text = ta.value;
  const eol  = text.indexOf('\n', pos);
  const insertAt = eol === -1 ? text.length : eol;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    _edDropImage(ta, file, insertAt);
  };
  input.click();
}

async function _edDropImage(ta, file, insertPos) {
  const placeholder = '![업로드 중...]()'
  const before = ta.value.slice(0, insertPos), after = ta.value.slice(insertPos);
  const sep = (before.length > 0 && !before.endsWith('\n')) ? '\n' : '';
  ta.value = before + sep + placeholder + '\n' + after;
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cloudinaryConfig.uploadPreset);
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error('업로드 실패');
    ta.value = ta.value.replace(sep + placeholder + '\n', '');
    _edPendingImg = { ta, url: data.secure_url, insertPos };
    _edShowSizePicker(data.secure_url);
  } catch {
    ta.value = ta.value.replace(sep + placeholder + '\n', '');
    _edToast('이미지 업로드 실패', 'error');
  }
}

function _edShowSizePicker(previewUrl) {
  document.getElementById('ed-size-picker')?.remove();
  const el = document.createElement('div');
  el.id = 'ed-size-picker';
  el.innerHTML = `
    <div class="sp-preview"><img src="${previewUrl}" alt=""></div>
    <div class="sp-label">이미지 캡션 (선택)</div>
    <input type="text" id="ed-img-caption" class="sp-caption" placeholder="이미지 아래 표시될 설명"
      onkeydown="if(event.key==='Enter'){event.preventDefault();_edInsertImg('md');}">
    <div class="sp-label">이미지 크기 선택</div>
    <div class="sp-btns">
      <button onclick="_edInsertImg('sm')">◼<br>소<br><small>30%</small></button>
      <button onclick="_edInsertImg('md')"><span style="font-size:1.2rem">◼</span><br>중<br><small>50%</small></button>
      <button onclick="_edInsertImg('lg')"><span style="font-size:1.6rem">◼</span><br>대<br><small>75%</small></button>
      <button onclick="_edInsertImg('')"><span style="font-size:2rem">◼</span><br>전체<br><small>100%</small></button>
    </div>
    <button class="sp-close" onclick="document.getElementById('ed-size-picker').remove()">✕</button>`;
  document.body.appendChild(el);
  setTimeout(() => document.getElementById('ed-img-caption')?.focus(), 50);
}

function _edInsertImg(size) {
  if (!_edPendingImg) return;
  const { ta, url, insertPos } = _edPendingImg;
  _edPendingImg = null;
  // 캡션은 픽커 제거 전에 읽어야 함. 마크다운 깨짐 방지로 []() 문자 정리
  const caption = (document.getElementById('ed-img-caption')?.value || '')
    .trim().replace(/[\[\]()|]/g, ' ').replace(/\s+/g, ' ');
  document.getElementById('ed-size-picker')?.remove();
  // alt = "size|캡션" 형식 (size 또는 캡션 한쪽만 있어도 동작)
  const alt = caption ? `${size}|${caption}` : size;
  const md  = alt === '' ? `![](${url})` : `![${alt}](${url})`;
  const before = ta.value.slice(0, insertPos), after = ta.value.slice(insertPos);
  const sep = (before.length > 0 && !before.endsWith('\n')) ? '\n' : '';
  ta.value = before + sep + md + '\n' + after;
  const pos = insertPos + sep.length + md.length + 1;
  ta.setSelectionRange(pos, pos); ta.focus();
  _edToast('삽입 완료!');
}

// ── Cloudinary 업로드 (병렬) ──────────────────────────────────
async function _edUploadPhotos() {
  const progWrap = document.getElementById('ed-progress');
  const progBar  = document.getElementById('ed-progress-bar');
  const toUpload = _edPhotos.filter(p => p.file);
  if (!toUpload.length) return _edPhotos.map(p => ({ url: p.url, caption: p.caption, annotations: p.annotations||[] }));
  progWrap.style.display = 'block';
  let done = 0;
  // 순서 유지하며 병렬 업로드 (이미 업로드된 사진은 그대로, 새 파일만 fetch)
  const results = await Promise.all(_edPhotos.map(async photo => {
    if (!photo.file) return { url: photo.url, caption: photo.caption, annotations: photo.annotations||[] };
    const fd = new FormData();
    fd.append('file', photo.file);
    fd.append('upload_preset', cloudinaryConfig.uploadPreset);
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || '업로드 실패');
    done++;
    progBar.style.width = `${Math.round(done / toUpload.length * 100)}%`;
    return { url: data.secure_url, caption: photo.caption, annotations: photo.annotations||[] };
  }));
  progWrap.style.display = 'none';
  progBar.style.width = '0%';
  return results;
}

// ── 저장 ─────────────────────────────────────────────────────
async function _edSave() {
  const title = document.getElementById('ed-title').value.trim();
  if (!title) { _edToast('제목을 입력하세요.', 'error'); return; }
  const btn = document.getElementById('ed-save-btn');
  btn.innerHTML = '<span class="ed-spinner"></span> 저장 중...';
  btn.disabled = true;
  try {
    const photos = await _edUploadPhotos();
    const statusEl = document.getElementById('ed-status');
    const docData = {
      title,
      department:  document.getElementById('ed-dept').value,
      date:        document.getElementById('ed-date').value,
      summary:     document.getElementById('ed-summary').value.trim(),
      description: document.getElementById('ed-description').value.trim(),
      photos,
      references:  _edCollectRefs(),
      tags:        [..._edTags],
      teeth:       [..._edTeeth],
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    };
    if (_edType === 'case') docData.status = statusEl ? statusEl.value : '';
    const col = _edType === 'case' ? 'cases' : 'departmentContents';
    if (_edId) {
      await db.collection(col).doc(_edId).update(docData);
    } else {
      docData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(col).add(docData);
    }
    _edDirty = false;
    _edToast('저장되었습니다.');
    closeEditor(true);
    await loadData();
  } catch(err) {
    _edToast('저장 실패: ' + err.message, 'error');
    btn.textContent = _edId ? '저장' : '등록';
    btn.disabled = false;
  }
}

// ── 이미지 주석 뷰어 ──────────────────────────────────────────
function _populateAnnSVG(svgEl, annotations, w, h) {
  const ns = 'http://www.w3.org/2000/svg';
  const sw = Math.max(w, h) * 0.007;
  const fs = Math.max(w, h) * 0.044;
  const as = sw * 4.5;
  annotations.forEach(ann => {
    const color = ann.color || '#ef4444';
    if (ann.type === 'arrow') {
      const x1=ann.x1*w, y1=ann.y1*h, x2=ann.x2*w, y2=ann.y2*h;
      if (Math.hypot(x2-x1,y2-y1) < 4) return;
      const angle = Math.atan2(y2-y1, x2-x1);
      const ex=x2-Math.cos(angle)*as*0.4, ey=y2-Math.sin(angle)*as*0.4;
      const a1=angle-Math.PI*0.75, a2=angle+Math.PI*0.75;
      const pts=`${x2},${y2} ${x2+as*Math.cos(a1)},${y2+as*Math.sin(a1)} ${x2+as*Math.cos(a2)},${y2+as*Math.sin(a2)}`;
      const g = document.createElementNS(ns,'g');
      [[`rgba(0,0,0,.45)`,sw*2.5],[color,sw]].forEach(([c,w2],idx)=>{
        const l=document.createElementNS(ns,'line');
        l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',ex);l.setAttribute('y2',ey);
        l.setAttribute('stroke',c);l.setAttribute('stroke-width',w2);l.setAttribute('stroke-linecap','round');
        g.appendChild(l);
        const p=document.createElementNS(ns,'polygon');
        p.setAttribute('points',pts);p.setAttribute('fill',c);g.appendChild(p);
      });
      svgEl.appendChild(g);
    } else if (ann.type === 'circle') {
      const cx=ann.cx*w, cy=ann.cy*h, rx=ann.rx*w, ry=ann.ry*h;
      if (rx<3||ry<3) return;
      [`rgba(0,0,0,.45)`,color].forEach((c,i)=>{
        const el=document.createElementNS(ns,'ellipse');
        el.setAttribute('cx',cx);el.setAttribute('cy',cy);
        el.setAttribute('rx',rx);el.setAttribute('ry',ry);
        el.setAttribute('stroke',c);el.setAttribute('stroke-width',i===0?sw*2.5:sw);el.setAttribute('fill','none');
        svgEl.appendChild(el);
      });
    } else if (ann.type === 'text') {
      const tx=ann.x*w, ty=ann.y*h;
      [['rgba(0,0,0,.7)',sw*4,'none'],[color,0,color]].forEach(([sc,sw2,fc])=>{
        const t=document.createElementNS(ns,'text');
        t.setAttribute('x',tx);t.setAttribute('y',ty);
        t.setAttribute('font-size',fs);t.setAttribute('font-weight','700');t.setAttribute('font-family','sans-serif');
        if(sw2>0){t.setAttribute('stroke',sc);t.setAttribute('stroke-width',sw2);t.setAttribute('stroke-linejoin','round');}
        t.setAttribute('fill',fc);t.textContent=ann.text;
        svgEl.appendChild(t);
      });
    }
  });
}

function _placeAnnSVG(galleryMainEl, photo) {
  galleryMainEl.querySelectorAll('.ann-overlay').forEach(e=>e.remove());
  if (!photo?.annotations?.length) return;
  const img = galleryMainEl.querySelector('img');
  if (!img) return;
  const place = () => {
    galleryMainEl.querySelectorAll('.ann-overlay').forEach(e=>e.remove());
    const ir=img.getBoundingClientRect(), cr=galleryMainEl.getBoundingClientRect();
    const left=ir.left-cr.left, top=ir.top-cr.top, w=ir.width, h=ir.height;
    if (w<1||h<1) return;
    const wrap=document.createElement('div');
    wrap.className='ann-overlay';
    wrap.style.cssText=`position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;pointer-events:none;`;
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('width',w);svg.setAttribute('height',h);svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    _populateAnnSVG(svg,photo.annotations,w,h);
    wrap.appendChild(svg);galleryMainEl.appendChild(wrap);
  };
  if (img.complete&&img.naturalWidth) place(); else img.addEventListener('load',place,{once:true});
}

// ── 이미지 주석 에디터 ────────────────────────────────────────
let _annState = { photoIdx:-1, annotations:[], tool:'arrow', color:'#ef4444', drawing:false, sx:0, sy:0, previewEl:null };

function openAnnotationEditor(photoIdx) {
  _annState.photoIdx = photoIdx;
  _annState.annotations = JSON.parse(JSON.stringify(_edPhotos[photoIdx].annotations||[]));
  _annState.tool='arrow'; _annState.color='#ef4444'; _annState.drawing=false; _annState.previewEl=null;
  const overlay = document.getElementById('ann-editor-overlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.querySelectorAll('.ann-tool-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ann-btn-arrow').classList.add('active');
  document.querySelectorAll('.ann-color-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  const img = document.getElementById('ann-img');
  img.src = _edPhotos[photoIdx].url;
  const setup = () => requestAnimationFrame(() => { _annSetupSVGEvents(); _annRedraw(); });
  if (img.complete && img.naturalWidth) setup(); else img.onload = setup;
}

function _annSetupSVGEvents() {
  const svg=document.getElementById('ann-svg'), img=document.getElementById('ann-img');
  const w=img.clientWidth, h=img.clientHeight;
  svg.style.width=w+'px'; svg.style.height=h+'px';
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  svg.onmousedown=_annMouseDown; svg.onmousemove=_annMouseMove;
  svg.onmouseup=_annMouseUp; svg.onmouseleave=e=>{if(_annState.drawing)_annMouseUp(e);};
  svg.ontouchstart=e=>{e.preventDefault();_annMouseDown(_t2m(e));};
  svg.ontouchmove=e=>{e.preventDefault();_annMouseMove(_t2m(e));};
  svg.ontouchend=e=>{e.preventDefault();_annMouseUp(_t2m(e));};
}
function _t2m(e){const t=e.touches[0]||e.changedTouches[0];return{clientX:t.clientX,clientY:t.clientY};}
function _annXY(e){
  const svg=document.getElementById('ann-svg'), r=svg.getBoundingClientRect();
  return {x:(e.clientX-r.left)/r.width, y:(e.clientY-r.top)/r.height};
}
function _annMouseDown(e) {
  if (_annState.tool==='text') {
    const {x,y}=_annXY(e);
    const text=prompt('텍스트 입력:');
    if (text?.trim()) { _annState.annotations.push({id:Date.now().toString(36),type:'text',x,y,text:text.trim(),color:_annState.color}); _annRedraw(); }
    return;
  }
  _annState.drawing=true;
  const {x,y}=_annXY(e); _annState.sx=x; _annState.sy=y;
}
function _annMouseMove(e) {
  if (!_annState.drawing) return;
  const {x,y}=_annXY(e); _annPreview(x,y);
}
function _annMouseUp(e) {
  if (!_annState.drawing) return;
  _annState.drawing=false;
  _annState.previewEl?.remove(); _annState.previewEl=null;
  const {x,y}=_annXY(e);
  const dx=x-_annState.sx, dy=y-_annState.sy;
  if (Math.hypot(dx,dy)<0.02) return;
  if (_annState.tool==='arrow') {
    _annState.annotations.push({id:Date.now().toString(36),type:'arrow',x1:_annState.sx,y1:_annState.sy,x2:x,y2:y,color:_annState.color});
  } else if (_annState.tool==='circle') {
    _annState.annotations.push({id:Date.now().toString(36),type:'circle',cx:(_annState.sx+x)/2,cy:(_annState.sy+y)/2,rx:Math.abs(dx)/2,ry:Math.abs(dy)/2,color:_annState.color});
  }
  _annRedraw();
}
function _annPreview(x,y) {
  _annState.previewEl?.remove();
  const svg=document.getElementById('ann-svg');
  const vb=svg.getAttribute('viewBox').split(' ').map(Number);
  const W=vb[2], H=vb[3], color=_annState.color, sw=Math.max(W,H)*0.007;
  const ns='http://www.w3.org/2000/svg';
  let el;
  if (_annState.tool==='arrow') {
    el=document.createElementNS(ns,'line');
    el.setAttribute('x1',_annState.sx*W);el.setAttribute('y1',_annState.sy*H);
    el.setAttribute('x2',x*W);el.setAttribute('y2',y*H);
    el.setAttribute('stroke',color);el.setAttribute('stroke-width',sw);
    el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-dasharray','6,3');
  } else if (_annState.tool==='circle') {
    el=document.createElementNS(ns,'ellipse');
    el.setAttribute('cx',((_annState.sx+x)/2)*W);el.setAttribute('cy',((_annState.sy+y)/2)*H);
    el.setAttribute('rx',Math.abs(x-_annState.sx)/2*W);el.setAttribute('ry',Math.abs(y-_annState.sy)/2*H);
    el.setAttribute('stroke',color);el.setAttribute('stroke-width',sw);
    el.setAttribute('fill','none');el.setAttribute('stroke-dasharray','6,3');
  }
  if (el) { svg.appendChild(el); _annState.previewEl=el; }
}
function _annRedraw() {
  const svg=document.getElementById('ann-svg');
  if (!svg) return;
  const vb=svg.getAttribute('viewBox');
  if (!vb) return;
  const [,,W,H]=vb.split(' ').map(Number);
  svg.innerHTML='';
  _populateAnnSVG(svg,_annState.annotations,W,H);
}
function _annSetTool(tool) {
  _annState.tool=tool;
  document.querySelectorAll('.ann-tool-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ann-btn-'+tool)?.classList.add('active');
  const svg=document.getElementById('ann-svg');
  if(svg) svg.style.cursor=tool==='text'?'text':'crosshair';
}
function _annSetColor(color) {
  _annState.color=color;
  document.querySelectorAll('.ann-color-btn').forEach(b=>b.classList.toggle('active',b.dataset.color===color));
}
function _annUndo() { if(_annState.annotations.length){_annState.annotations.pop();_annRedraw();} }
function _annClear() {
  const overlay=document.getElementById('ann-editor-overlay');
  if (!overlay||overlay.style.display==='none') return;
  if (!_annState.annotations.length) return;
  if (confirm('모든 주석을 삭제하시겠습니까?')) { _annState.annotations=[]; _annRedraw(); }
}
function _annSave() {
  _edPhotos[_annState.photoIdx].annotations=[..._annState.annotations];
  document.getElementById('ann-editor-overlay').style.display='none';
  if (!document.getElementById('editor-overlay')?.classList.contains('open')) {
    document.body.style.overflow='';
  }
  _edToast('주석이 저장되었습니다.');
  _edRenderPhotoPreview();
}
function _annCancel() {
  const overlay=document.getElementById('ann-editor-overlay');
  if (overlay) overlay.style.display='none';
  if (document.getElementById('editor-overlay')?.classList.contains('open')) return;
  document.body.style.overflow='';
}

// ── 페이지 하단 맨 위로 버튼 ─────────────────────────────────
function _injectPageBottomBtns() {
  document.querySelectorAll('.page').forEach(page => {
    if (page.querySelector('.page-bottom-nav')) return;
    const nav = document.createElement('div');
    nav.className = 'page-bottom-nav';
    nav.innerHTML = '<button onclick="window.scrollTo({top:0,behavior:\'smooth\'})">↑ 맨 위로</button>';
    page.appendChild(nav);
  });
}

// ── 다크 모드 ─────────────────────────────────────────────────
function _updateAdminLinks(dark) {
  document.querySelectorAll('a[href*="admin.html"]').forEach(a => {
    a.href = 'admin.html?v=1' + (dark ? '&dark=1' : '');
  });
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dental-theme', next);
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = isDark ? '🌙' : '☀️';
  });
  _updateAdminLinks(next === 'dark');
}

// ── 북마크 ────────────────────────────────────────────────────
function _toggleBookmark(id) {
  const isNowBm = !_bookmarks.has(id);
  if (isNowBm) _bookmarks.add(id); else _bookmarks.delete(id);
  localStorage.setItem('dental-bm', JSON.stringify([..._bookmarks]));
  // 해당 카드의 버튼만 업데이트
  document.querySelectorAll(`.card-bm-btn[data-bm-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', isNowBm);
    btn.title = isNowBm ? '북마크 해제' : '북마크';
  });
  // 북마크 필터 중일 때만 목록 재렌더
  if (_showBmOnly) {
    renderCases(
      document.querySelector('#page-cases .search-input')?.value || '',
      document.getElementById('case-dept-filter')?.value || ''
    );
  }
  // 북마크 필터가 켜진 부문 페이지도 재렌더
  _deptBmFilter.forEach(deptId => {
    const input = document.querySelector(`#page-dept-${deptId} .search-input`);
    renderDeptContent(deptId, input?.value || '');
  });
}

function toggleDeptBookmarkFilter(deptId) {
  if (_deptBmFilter.has(deptId)) _deptBmFilter.delete(deptId);
  else _deptBmFilter.add(deptId);
  const btn = document.querySelector(`.bm-filter-btn[data-dept-bm="${deptId}"]`);
  if (btn) btn.classList.toggle('active', _deptBmFilter.has(deptId));
  const input = document.querySelector(`#page-dept-${deptId} .search-input`);
  renderDeptContent(deptId, input?.value || '');
}

function setViewMode(mode) {
  _viewMode = mode;
  localStorage.setItem('dental-view', mode);
  document.querySelectorAll('.view-toggle-btn[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  // 홈 recent-cases 제외 — 홈에서 list-view가 걸리면 레이아웃이 어색함
  document.querySelectorAll('.card-grid:not(#recent-cases)').forEach(el => {
    el.classList.toggle('list-view', mode === 'list');
  });
}

function toggleBookmarkFilter() {
  _showBmOnly = !_showBmOnly;
  const btn = document.getElementById('bm-filter-btn');
  if (btn) btn.classList.toggle('active', _showBmOnly);
  renderCases(
    document.querySelector('#page-cases .search-input')?.value || '',
    document.getElementById('case-dept-filter')?.value || ''
  );
}

function toggleStatusFilter() {
  _showOngoing = !_showOngoing;
  const btn = document.getElementById('status-filter-btn');
  if (btn) btn.classList.toggle('active', _showOngoing);
  renderCases(
    document.querySelector('#page-cases .search-input')?.value || '',
    document.getElementById('case-dept-filter')?.value || ''
  );
}

// ── 태그 필터 ─────────────────────────────────────────────────
function _filterByTag(tag) {
  showPage('cases');
  const searchInput = document.querySelector('#page-cases .search-input');
  if (searchInput) searchInput.value = tag;
  const deptFilter = document.getElementById('case-dept-filter');
  if (deptFilter) deptFilter.value = '';
  _showBmOnly = false;
  const bmBtn = document.getElementById('bm-filter-btn');
  if (bmBtn) bmBtn.classList.remove('active');
  renderCases(tag, '');
}

// ── 갤러리 스와이프 ───────────────────────────────────────────
function _setupGallerySwipe() {
  const gm = document.querySelector('.gallery-main');
  if (!gm) return;

  // 이전/다음 버튼: touchend로 즉시 반응 (click의 300ms 대기 없음)
  const addNavTouch = (sel, dir) => {
    const btn = gm.querySelector(sel);
    if (!btn) return;
    btn.addEventListener('touchend', e => {
      e.preventDefault(); // 후속 click 이벤트 차단
      changePhoto(dir);
    }, { passive: false });
  };
  addNavTouch('.gallery-nav.prev', -1);
  addNavTouch('.gallery-nav.next',  1);

  if (currentPhotos.length <= 1) return;
  let _sx = 0, _sy = 0;
  gm.addEventListener('touchstart', e => {
    _sx = e.touches[0].clientX;
    _sy = e.touches[0].clientY;
  }, { passive: true });
  gm.addEventListener('touchend', e => {
    if (_gz.s > 1) return;
    const dx = e.changedTouches[0].clientX - _sx;
    const dy = e.changedTouches[0].clientY - _sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) changePhoto(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// ── 갤러리 핀치줌 ─────────────────────────────────────────────
function _resetGalleryZoom() {
  _gz = { s: 1, ox: 50, oy: 50, tx: 0, ty: 0 };
  const img = document.getElementById('gallery-main-img');
  if (!img) return;
  img.style.transition = 'transform 0.2s ease';
  img.style.transformOrigin = 'center center';
  img.style.transform = '';
  setTimeout(() => { const i = document.getElementById('gallery-main-img'); if (i) i.style.transition = ''; }, 220);
}

function _setupGalleryZoom() {
  const gm = document.querySelector('.gallery-main');
  const img = gm?.querySelector('img');
  if (!gm || !img) return;

  let lastS = 1, startD = 0, pan = false, panSX = 0, panSY = 0, lastTap = 0;

  function d2(a, b) { return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); }
  function applyGz() {
    img.style.transition = 'none';
    img.style.transformOrigin = `${_gz.ox}% ${_gz.oy}%`;
    img.style.transform = `scale(${_gz.s}) translate(${_gz.tx / _gz.s}px, ${_gz.ty / _gz.s}px)`;
  }

  gm.addEventListener('touchstart', e => {
    const ts = Array.from(e.touches);
    if (ts.length === 2) {
      startD = d2(ts[0], ts[1]);
      lastS = _gz.s;
      pan = false;
      const r = gm.getBoundingClientRect();
      _gz.ox = ((ts[0].clientX + ts[1].clientX) / 2 - r.left) / r.width * 100;
      _gz.oy = ((ts[0].clientY + ts[1].clientY) / 2 - r.top) / r.height * 100;
    } else if (ts.length === 1) {
      if (_gz.s > 1) { pan = true; panSX = ts[0].clientX - _gz.tx; panSY = ts[0].clientY - _gz.ty; }
      const now = Date.now();
      if (now - lastTap < 280) {
        if (_gz.s > 1) { _resetGalleryZoom(); }
        else {
          _gz.ox = 50; _gz.oy = 50; _gz.tx = 0; _gz.ty = 0; _gz.s = 2.5;
          img.style.transition = 'transform 0.2s ease'; applyGz();
          setTimeout(() => { const i = document.getElementById('gallery-main-img'); if (i) i.style.transition = ''; }, 220);
        }
        lastTap = 0; return;
      }
      lastTap = now;
    }
  }, { passive: true });

  gm.addEventListener('touchmove', e => {
    const ts = Array.from(e.touches);
    if (ts.length === 2) {
      e.preventDefault();
      _gz.s = Math.min(Math.max(lastS * (d2(ts[0], ts[1]) / startD), 1), 4);
      applyGz();
    } else if (ts.length === 1 && pan && _gz.s > 1) {
      e.preventDefault();
      _gz.tx = ts[0].clientX - panSX;
      _gz.ty = ts[0].clientY - panSY;
      applyGz();
    }
  }, { passive: false });

  gm.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      pan = false;
      if (_gz.s <= 1.05) _resetGalleryZoom();
    }
  }, { passive: true });
}

// ── 검색 오버레이 ─────────────────────────────────────────────
function _openSearch() {
  _ensureRefsLoaded();
  const ov = document.getElementById('search-overlay');
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('search-overlay-input')?.focus(), 80);
  _renderTagCloud();
  history.pushState({ page: _currentPage, search: true }, '');
}

function _closeSearch() {
  const ov = document.getElementById('search-overlay');
  if (!ov.classList.contains('open')) return;
  ov.classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('search-overlay-input').value = '';
  document.getElementById('search-results-section').style.display = 'none';
  document.getElementById('search-tag-section').style.display = '';
  history.back();
}

function _renderTagCloud() {
  if (!_tagCloudHTML) {
    const freq = {};
    [...allCases, ...allContents].forEach(item =>
      (item.tags || []).forEach(t => { freq[t] = (freq[t] || 0) + 1; })
    );
    _tagCloudHTML = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => `<button class="search-tag-chip" onclick="_searchByTag('${_esc(t).replace(/'/g,"\\'")}')">🏷 ${_esc(t)}</button>`)
      .join('');
  }
  document.getElementById('search-tag-cloud').innerHTML = _tagCloudHTML;
}

function _searchByTag(tag) {
  _closeSearch();
  setTimeout(() => {
    showPage('cases');
    const inp = document.querySelector('#page-cases .search-input');
    if (inp) { inp.value = tag; renderCases(tag, ''); }
  }, 200);
}

let _searchTimer;
function _onSearchInput(q) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => _doSearch(q), 180);
}
function _doSearch(q) {
  const tagSec = document.getElementById('search-tag-section');
  const resSec = document.getElementById('search-results-section');
  if (!q.trim()) {
    resSec.style.display = 'none';
    tagSec.style.display = '';
    return;
  }
  tagSec.style.display = 'none';
  resSec.style.display = '';
  if (!_searchIndex) {
    _searchIndex = [
      ...allCases.map(c => ({ ...c, _type: 'case' })),
      ...allContents.map(c => ({ ...c, _type: 'content' }))
    ];
  }
  const results = _searchIndex.filter(c =>
    c.title.includes(q) || (c.summary||'').includes(q) || (c.tags||[]).some(t => t.includes(q))
  ).slice(0, 12);
  const dept = id => _deptById[id];

  // 참고자료(SOAP · 임상검사 · 용어 · 기공지시서) 통합 검색
  const ql = q.toLowerCase();
  const refHits = _refSearchIndex()
    .filter(r => r.title.toLowerCase().includes(ql) || r.body.includes(ql))
    .slice(0, 15);

  const caseHTML = results.map(c => `
        <div class="search-result-item" onclick="_closeSearch();setTimeout(()=>openModal('${c.id}','${c._type}'),200)">
          <div class="search-result-title">${_esc(c.title)}</div>
          <div class="search-result-meta">${dept(c.department)?.name || ''} · ${c.date || ''}</div>
        </div>`).join('');
  const refHTML = refHits.map(r => `
        <div class="search-result-item" onclick="_openRef('${r.kind}','${r.id}')">
          <div class="search-result-title"><span class="sr-kind sr-${r.kind}">${r.kind === 'soap' ? 'SOAP' : r.kind === 'exam' ? '검사' : r.kind === 'lab' ? '기공' : r.kind === 'tip' ? '팁' : '용어'}</span>${_esc(r.title)}</div>
          <div class="search-result-meta">${_esc(r.sub)}</div>
        </div>`).join('');

  const parts = [];
  if (caseHTML) parts.push('<div class="search-group-label">케이스 · 자료</div>' + caseHTML);
  if (refHTML)  parts.push('<div class="search-group-label">임상 기록 참고</div>' + refHTML);
  document.getElementById('search-results-list').innerHTML =
    parts.length ? parts.join('') : '<div class="search-empty">검색 결과가 없습니다.</div>';
}

// ── 전체화면 갤러리 ─────────────────────────────────────────────
let _fsScale = 1, _fsPanX = 0, _fsPanY = 0;

function _resetFsZoom() {
  _fsScale = 1; _fsPanX = 0; _fsPanY = 0;
  const img = document.getElementById('fs-img');
  if (img) img.style.transform = '';
}

function _applyFsTransform() {
  const img = document.getElementById('fs-img');
  if (!img) return;
  img.style.transform = `translate(${_fsPanX}px,${_fsPanY}px) scale(${_fsScale})`;
}

function _openFsGallery() {
  let ov = document.getElementById('fs-gallery');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'fs-gallery';
    ov.innerHTML = `
      <button class="fs-close" onclick="_closeFsGallery()">✕</button>
      <span class="fs-counter" id="fs-counter"></span>
      <button class="fs-nav fs-prev" onclick="_fsChangePhoto(-1)">&#8249;</button>
      <img id="fs-img" src="" alt="">
      <button class="fs-nav fs-next" onclick="_fsChangePhoto(1)">&#8250;</button>`;
    document.body.appendChild(ov);
    _setupFsSwipe(ov);
  }
  _resetFsZoom();
  _updateFsGallery();
  ov.classList.add('open');
  history.pushState({ page: _currentPage, fs: true }, '');
}

function _closeFsGallery() {
  const ov = document.getElementById('fs-gallery');
  if (!ov || !ov.classList.contains('open')) return;
  ov.classList.remove('open');
  history.back();
}

function _fsChangePhoto(dir) {
  _resetFsZoom();
  currentPhotoIndex = (currentPhotoIndex + dir + currentPhotos.length) % currentPhotos.length;
  _updateFsGallery();
  updateGallery();
}

function _updateFsGallery() {
  const p = currentPhotos[currentPhotoIndex];
  const img = document.getElementById('fs-img');
  const ctr = document.getElementById('fs-counter');
  if (img) img.src = _cldGallery(p.url);
  if (ctr) ctr.textContent = `${currentPhotoIndex + 1} / ${currentPhotos.length}`;
}

function _setupFsSwipe(ov) {
  let sx = 0, sy = 0, cancelled = false, pinchDist = 0, lastTap = 0;

  function clamp() {
    const maxX = Math.max(0, (_fsScale - 1) * ov.clientWidth  / 2);
    const maxY = Math.max(0, (_fsScale - 1) * ov.clientHeight / 2);
    _fsPanX = Math.max(-maxX, Math.min(maxX, _fsPanX));
    _fsPanY = Math.max(-maxY, Math.min(maxY, _fsPanY));
  }

  ov.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      cancelled = true;
      pinchDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      return;
    }
    if (e.touches.length > 2) { cancelled = true; return; }
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    cancelled = _fsScale > 1 || !!e.target.closest('.fs-nav, .fs-close');
    // 더블탭으로 줌 초기화
    const now = Date.now();
    if (now - lastTap < 280 && _fsScale > 1) _resetFsZoom();
    lastTap = now;
  }, { passive: true });

  ov.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      cancelled = true;
      const d = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      _fsScale = Math.max(1, Math.min(6, _fsScale * (d / pinchDist)));
      pinchDist = d;
      clamp();
      _applyFsTransform();
      return;
    }
    if (_fsScale > 1 && e.touches.length === 1) {
      _fsPanX += e.touches[0].clientX - sx;
      _fsPanY += e.touches[0].clientY - sy;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      clamp();
      _applyFsTransform();
    }
  }, { passive: true });

  ov.addEventListener('touchend', e => {
    if (e.touches.length > 0) {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      return;
    }
    if (cancelled) { cancelled = false; return; }
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 60) _fsChangePhoto(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// ── 발표 모드 ─────────────────────────────────────────────────
let _presSlides = [], _presIdx = 0;

function _openPresentation() {
  if (!_currentModalItem) return;
  const { item } = _currentModalItem;
  _presSlides = _buildPresSlides(item);
  _presIdx = 0;

  let ov = document.getElementById('pres-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'pres-overlay';
    ov.innerHTML = `
      <div class="pres-header">
        <button class="pres-close-btn" onclick="_closePresentation()">✕ 나가기</button>
        <span id="pres-counter" class="pres-counter-txt"></span>
      </div>
      <div class="pres-slide-area" id="pres-slide"></div>
      <div class="pres-footer">
        <button class="pres-nav-btn" id="pres-prev" onclick="_presGo(-1)">&#8249;</button>
        <div class="pres-dots" id="pres-dots"></div>
        <button class="pres-nav-btn" id="pres-next" onclick="_presGo(1)">&#8250;</button>
      </div>`;
    document.body.appendChild(ov);
    _setupPresSwipe(ov);
    // 발표 모드 버튼 즉시 반응 (touchend)
    document.getElementById('pres-prev').addEventListener('touchend', e => { e.preventDefault(); _presGo(-1); }, { passive: false });
    document.getElementById('pres-next').addEventListener('touchend', e => { e.preventDefault(); _presGo( 1); }, { passive: false });
  }
  _renderPresSlide();
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function _buildPresSlides(item) {
  const dept = _deptById[item.department];
  const slides = [{ type: 'cover', item, dept }];
  (item.photos || []).forEach((p, i) =>
    slides.push({ type: 'photo', photo: p, photoIdx: i + 1, photoTotal: (item.photos||[]).length })
  );
  if (item.description?.trim()) slides.push({ type: 'desc', text: item.description });
  if (item.answer?.trim()) slides.push({ type: 'answer', text: item.answer, refs: item.references || [] });
  const refs = (item.references || []).filter(r => r.title);
  if (refs.length) slides.push({ type: 'refs', refs });
  return slides;
}

function _renderPresSlide() {
  const slide = _presSlides[_presIdx];
  const el    = document.getElementById('pres-slide');
  if (!el || !slide) return;

  document.getElementById('pres-counter').textContent = `${_presIdx + 1} / ${_presSlides.length}`;
  document.getElementById('pres-prev').disabled = _presIdx === 0;
  document.getElementById('pres-next').disabled = _presIdx === _presSlides.length - 1;

  const dotsEl = document.getElementById('pres-dots');
  if (_presSlides.length <= 14) {
    dotsEl.innerHTML = _presSlides.map((_, i) =>
      `<span class="pres-dot${i === _presIdx ? ' active' : ''}" onclick="_presJump(${i})"></span>`
    ).join('');
  } else {
    dotsEl.innerHTML = '';
  }

  el.className = 'pres-slide-area pres-type-' + slide.type;
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = ''; });

  if (slide.type === 'cover') {
    const tags = (slide.item.tags || []).map(t =>
      `<span class="pres-tag">${_esc(t)}</span>`).join('');
    el.innerHTML = `
      <div class="pres-cover-dept">${slide.dept ? slide.dept.name : ''}</div>
      <h1 class="pres-cover-title">${_esc(slide.item.title)}</h1>
      <div class="pres-cover-date">${slide.item.date || ''}</div>
      ${slide.item.summary ? `<p class="pres-cover-summary">${_esc(slide.item.summary)}</p>` : ''}
      ${tags ? `<div class="pres-cover-tags">${tags}</div>` : ''}`;
  } else if (slide.type === 'photo') {
    el.innerHTML = `
      <div class="pres-photo-wrap">
        <img src="${_cldGallery(slide.photo.url)}" alt="${_esc(slide.photo.caption || '')}" loading="lazy" onerror="this.style.opacity='0.3'">
      </div>
      ${slide.photo.caption ? `<div class="pres-caption">${_esc(slide.photo.caption)}</div>` : ''}
      ${slide.photoTotal > 1 ? `<div class="pres-photo-num">사진 ${slide.photoIdx} / ${slide.photoTotal}</div>` : ''}`;
  } else if (slide.type === 'desc') {
    el.innerHTML = `<div class="pres-desc-inner">${marked.parse(slide.text)}</div>`;
    _renderMath(el.querySelector('.pres-desc-inner'));
  } else if (slide.type === 'answer') {
    el.innerHTML = `<div class="pres-desc-inner pres-answer-inner">${_renderWithCitations(slide.text, slide.refs || [])}</div>`;
    _renderMath(el.querySelector('.pres-answer-inner'));
  } else if (slide.type === 'refs') {
    el.innerHTML = `
      <div class="pres-section-label">참고 논문</div>
      <ol class="pres-refs-list">${slide.refs.map(r => `
        <li>
          ${r.authors ? `<span class="pres-ref-authors">${_esc(r.authors)}</span> ` : ''}
          ${r.year ? `(${r.year}). ` : ''}
          <span class="pres-ref-title">${_esc(r.title)}</span>
          ${r.journal ? ` <em>${_esc(r.journal)}</em>` : ''}
          ${r.doi ? ` <a href="https://doi.org/${r.doi}" target="_blank" class="pres-doi">DOI ↗</a>` : ''}
        </li>`).join('')}
      </ol>`;
  }
}

function _presGo(dir) {
  const next = _presIdx + dir;
  if (next < 0 || next >= _presSlides.length) return;
  const nextSlide = _presSlides[next];
  const curSlide  = _presSlides[_presIdx];

  // 사진 → 사진: img.src만 교체해서 현재 이미지 유지하며 로드
  if (nextSlide.type === 'photo' && curSlide.type === 'photo') {
    _presIdx = next;
    _updatePresPhotoInPlace(nextSlide);
    return;
  }
  _presIdx = next;
  _renderPresSlide();
}

function _updatePresPhotoInPlace(slide) {
  const el  = document.getElementById('pres-slide');
  const img = el?.querySelector('img');
  if (!img) { _renderPresSlide(); return; }

  img.src = _cldGallery(slide.photo.url);
  img.alt = _esc(slide.photo.caption || '');

  // 캡션·번호·카운터만 즉시 갱신 (이미지 자체는 로드되면 자동 교체)
  const captionEl = el.querySelector('.pres-caption');
  if (captionEl) captionEl.textContent = slide.photo.caption || '';
  const numEl = el.querySelector('.pres-photo-num');
  if (numEl) numEl.textContent = `사진 ${slide.photoIdx} / ${slide.photoTotal}`;

  document.getElementById('pres-counter').textContent = `${_presIdx + 1} / ${_presSlides.length}`;
  document.getElementById('pres-prev').disabled = _presIdx === 0;
  document.getElementById('pres-next').disabled = _presIdx === _presSlides.length - 1;
  document.querySelectorAll('.pres-dot').forEach((d, i) => d.classList.toggle('active', i === _presIdx));
}

function _presJump(i) {
  _presIdx = i;
  _renderPresSlide();
}

function _closePresentation() {
  document.getElementById('pres-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function _setupPresSwipe(ov) {
  let sx = 0;
  ov.addEventListener('touchstart', e => { if (e.touches.length === 1) sx = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener('touchend', e => {
    if (e.touches.length > 0) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 55) _presGo(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// ── PWA 설치 배너 ──────────────────────────────────────────────
let _pwaPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  // Only show once per session if not dismissed
  if (!sessionStorage.getItem('pwa-dismissed')) {
    _showPwaBanner();
  }
});

function _showPwaBanner() {
  if (document.getElementById('pwa-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.innerHTML = `
    <span class="pwa-icon">📱</span>
    <span class="pwa-text">홈 화면에 앱으로 추가하면 더 편리하게 사용할 수 있어요</span>
    <button class="pwa-install-btn" onclick="_installPwa()">설치</button>
    <button class="pwa-dismiss-btn" onclick="_dismissPwaBanner()">✕</button>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('visible'));
}

function _installPwa() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') _dismissPwaBanner();
    _pwaPrompt = null;
  });
}

function _dismissPwaBanner() {
  const b = document.getElementById('pwa-banner');
  if (!b) return;
  b.classList.remove('visible');
  sessionStorage.setItem('pwa-dismissed', '1');
  setTimeout(() => b.remove(), 350);
}

// ── 토스트 ────────────────────────────────────────────────────
function _edToast(msg, type = 'success') {
  const t = document.getElementById('ed-toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show' + (type === 'error' ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3000);
}

// ════════════════════════════════════════════════════════════════
// 진료 일정 (달력)
// ════════════════════════════════════════════════════════════════
let _calYear, _calMonth;          // _calMonth: 0-indexed
let _schedules = [];              // 현재 표시 중인 달의 일정 목록
let _schedMonthKey = null;        // 로드된 달 식별자 "YYYY-M"
let _schedEditId = null;          // 편집 중인 일정 id (null이면 신규)
let _schedDayStr = null;          // 현재 열린 날짜 모달의 날짜 "YYYY-MM-DD"
let _calDayPushed = false;        // 날짜 모달 히스토리 push 여부

const _SCHED_COLORS = ['#2563eb','#f97316','#059669','#9f1239','#7c3aed','#0891b2','#b45309','#db2777'];
const _DOWS = ['일','월','화','수','목','금','토'];
function _schedColor(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return _SCHED_COLORS[h % _SCHED_COLORS.length];
}
function _schedEvColor(ev) { return _schedColor(ev.treatment || ev.dept || ev.patient || '일정'); }

function _pad2(n) { return n < 10 ? '0' + n : '' + n; }
function _dateStr(y, m, d) { return `${y}-${_pad2(m + 1)}-${_pad2(d)}`; }
function _todayStr() {
  const t = new Date();
  return _dateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

// 시간 입력: 숫자만 받아 HH:MM(24h)로 자동 포맷
function _onSchedTimeInput(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2);
  el.value = v;
}
// 저장 시 24h HH:MM으로 정규화. 유효하지 않으면 '' 반환
function _normTime(str) {
  const m = (str || '').match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return '';
  let h = +m[1], mm = +m[2];
  if (h > 23 || mm > 59) return '';
  return _pad2(h) + ':' + _pad2(mm);
}

// 현재 달의 일정을 Firestore에서 로드 (날짜 문자열 범위 쿼리, 복합 인덱스 불필요)
// 이미 로드된 달이면 스킵. 저장/삭제 후에는 force로 강제 갱신
async function loadSchedules(y, m, force) {
  if (!force && _schedMonthKey === `${y}-${m}`) return;
  const start = _dateStr(y, m, 1);
  const end   = `${y}-${_pad2(m + 1)}-32`; // 해당 월의 모든 날짜 포함
  try {
    const snap = await db.collection('schedules')
      .where('date', '>=', start).where('date', '<=', end)
      .get();
    _schedules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    _schedules = [];
    console.warn('[schedules]', e);
  }
  _schedMonthKey = `${y}-${m}`;
}

async function renderCalendar() {
  const now = new Date();
  if (_calYear == null) { _calYear = now.getFullYear(); _calMonth = now.getMonth(); }
  await loadSchedules(_calYear, _calMonth);
  _buildCalGrid();
}

function _calShift(delta) {
  _calMonth += delta;
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  if (_calMonth > 11) { _calMonth = 0;  _calYear++; }
  renderCalendar();
}

function _calToday() {
  const now = new Date();
  _calYear = now.getFullYear();
  _calMonth = now.getMonth();
  renderCalendar();
}

function _buildCalGrid() {
  const titleEl = document.getElementById('cal-title');
  if (titleEl) titleEl.textContent = `${_calYear}년 ${_calMonth + 1}월`;

  const grid = document.getElementById('cal-grid');
  if (grid) grid.innerHTML = _calCellsHTML(_calYear, _calMonth);

  _buildCalAgenda(_todayStr());
}

// 한 달치 셀 HTML 생성 (캘린더 페이지·홈 미니 캘린더 공용)
function _calCellsHTML(y, m) {
  const byDate = {};
  _schedules.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });

  const firstDow   = new Date(y, m, 1).getDay(); // 0=일
  const daysInMon  = new Date(y, m + 1, 0).getDate();
  const todayStr   = _todayStr();

  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += '<div class="cal-cell cal-empty"></div>';

  for (let d = 1; d <= daysInMon; d++) {
    const ds   = _dateStr(y, m, d);
    const dow  = (firstDow + d - 1) % 7;
    const evs  = byDate[ds] || [];
    const isToday = ds === todayStr;

    const chips = evs.slice(0, 3).map(ev => {
      const label = ev.treatment || ev.patient || '일정';
      const col   = _schedEvColor(ev);
      const timeStr = ev.time ? `<span class="cal-chip-time">${_esc(ev.time)}</span>` : '';
      return `<div class="cal-chip${ev.done ? ' cal-chip-done' : ''}" style="background:${col}1a;color:${col};border-left:3px solid ${col}">${timeStr}<span class="cal-chip-label">${_esc(label)}</span></div>`;
    }).join('');
    const more = evs.length > 3 ? `<div class="cal-more">+${evs.length - 3}</div>` : '';

    cells += `
      <div class="cal-cell${isToday ? ' cal-today' : ''}${dow === 0 ? ' cal-sun' : dow === 6 ? ' cal-sat' : ''}"
           onclick="openDayModal('${ds}')">
        <div class="cal-daynum">${d}</div>
        <div class="cal-chips">${chips}${more}</div>
      </div>`;
  }
  // 마지막 주를 채워 직사각형 그리드 유지 (노션식 정렬)
  const trailing = (7 - ((firstDow + daysInMon) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="cal-cell cal-empty"></div>';
  return cells;
}

// 캘린더 페이지 + 홈 미니 캘린더를 함께 갱신 (저장/삭제 후)
function _refreshCalViews() {
  _buildCalGrid();
  const homeGrid = document.getElementById('cal-grid-home');
  const now = new Date();
  // 홈은 항상 이번 달만 보여주므로, 보고 있던 달이 이번 달일 때만 갱신
  if (homeGrid && _calYear === now.getFullYear() && _calMonth === now.getMonth()) {
    homeGrid.innerHTML = _calCellsHTML(_calYear, _calMonth);
  }
}

// 홈 화면 하단 미니 캘린더 (항상 이번 달)
async function renderHomeCalendar() {
  const grid = document.getElementById('cal-grid-home');
  if (!grid) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (_calYear == null) { _calYear = y; _calMonth = m; }
  if (_schedMonthKey !== `${y}-${m}`) {
    await loadSchedules(y, m);
    _calYear = y; _calMonth = m;
  }
  grid.innerHTML = _calCellsHTML(y, m);
}

// ── 그리드 아래 어젠다(시간순 목록) ────────────────────────────
function _buildCalAgenda(todayStr) {
  const wrap = document.getElementById('cal-agenda');
  if (!wrap) return;

  const evs = [..._schedules].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '99').localeCompare(b.time || '99');
  });

  if (!evs.length) { wrap.innerHTML = ''; return; }

  let html = '<div class="cal-agenda-title">이번 달 일정</div>';
  let lastDate = null;
  evs.forEach(ev => {
    const past = ev.date < todayStr;
    if (ev.date !== lastDate) {
      const [y, m, d] = ev.date.split('-').map(Number);
      const dow = _DOWS[new Date(y, m - 1, d).getDay()];
      const cls = (past ? ' cal-ag-past' : '') + (ev.date === todayStr ? ' cal-ag-today' : '');
      html += `<div class="cal-ag-date${cls}">${m}/${d} <span>(${dow})</span></div>`;
      lastDate = ev.date;
    }
    const col   = _schedEvColor(ev);
    const label = ev.treatment || ev.patient || '일정';
    const dept  = ev.dept ? _deptById[ev.dept] : null;
    html += `
      <div class="cal-ag-row${ev.done ? ' cal-ag-done' : ''}${past ? ' cal-ag-past' : ''}" onclick="openDayModal('${ev.date}')">
        <span class="cal-ag-time">${ev.time ? _esc(ev.time) : ''}</span>
        <span class="cal-ag-dot" style="background:${col}"></span>
        <span class="cal-ag-label">${_esc(label)}</span>
        ${ev.patient && ev.treatment ? `<span class="cal-ag-sub">${_esc(ev.patient)}</span>` : ''}
        ${dept ? `<span class="cal-ag-dept">${_esc(dept.name)}</span>` : ''}
      </div>`;
  });
  wrap.innerHTML = html;
}

// ── 날짜 상세 모달 ─────────────────────────────────────────────
function openDayModal(ds) {
  _schedDayStr = ds;
  _schedEditId = null;
  const ov = document.getElementById('cal-day-overlay');
  if (!ov) return;
  const [y, m, d] = ds.split('-').map(Number);
  const dow = _DOWS[new Date(y, m - 1, d).getDay()];
  document.getElementById('cal-day-title').textContent = `${y}년 ${m}월 ${d}일 (${dow})`;
  _renderDayList();
  _schedHideForm();
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!_isPopState) { history.pushState({ calDay: ds }, ''); _calDayPushed = true; }
}

function closeDayModal() {
  const ov = document.getElementById('cal-day-overlay');
  if (!ov || !ov.classList.contains('open')) return;
  if (_calDayPushed) {
    history.back(); // popstate 핸들러가 실제로 닫음
  } else {
    ov.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function _renderDayList() {
  const list = document.getElementById('cal-day-list');
  if (!list) return;
  const evs = _schedules
    .filter(s => s.date === _schedDayStr)
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

  const addBtn = isAdmin
    ? `<button class="cal-add-btn" onclick="_schedOpenForm()">+ 일정 추가</button>`
    : '';

  if (!evs.length) {
    list.innerHTML = `<div class="cal-day-empty">등록된 일정이 없습니다.</div>${addBtn}`;
    return;
  }

  list.innerHTML = evs.map(ev => {
    const col  = _schedEvColor(ev);
    const dept = ev.dept ? _deptById[ev.dept] : null;
    const adminBtns = isAdmin ? `
      <div class="cal-ev-actions">
        <button onclick="event.stopPropagation();_schedOpenForm('${ev.id}')" title="편집">✎</button>
        <button onclick="event.stopPropagation();_schedDelete('${ev.id}')" title="삭제">🗑</button>
      </div>` : '';
    return `
      <div class="cal-ev${ev.done ? ' cal-ev-done' : ''}" style="border-left:4px solid ${col}">
        <div class="cal-ev-head">
          <div class="cal-ev-title">
            ${ev.time ? `<span class="cal-ev-time">${_esc(ev.time)}</span>` : ''}
            ${ev.treatment ? `<span class="cal-ev-treat" style="color:${col}">${_esc(ev.treatment)}</span>` : ''}
            ${ev.patient ? `<span class="cal-ev-patient">${_esc(ev.patient)}</span>` : ''}
          </div>
          ${adminBtns}
        </div>
        ${dept ? `<div class="cal-ev-dept">${_deptIconHtml(dept)}${_esc(dept.name)}</div>` : ''}
        ${ev.notes ? `<div class="cal-ev-notes">${marked.parse(ev.notes)}</div>` : ''}
        ${_schedCaseIds(ev).map(cid => {
          const c = allCases.find(x => x.id === cid);
          return `<button class="cal-ev-case-btn" onclick="event.stopPropagation();closeDayModal();openModal('${cid}','case')">📋 ${c ? _esc(c.title) : '관련 케이스 보기'}</button>`;
        }).join('')}
      </div>`;
  }).join('') + addBtn;
}

// 구버전 단일 caseId 데이터 호환
function _schedCaseIds(ev) {
  if (Array.isArray(ev.caseIds)) return ev.caseIds;
  return ev.caseId ? [ev.caseId] : [];
}

function _filterCaseList(input) {
  const q = input.value.trim().toLowerCase();
  document.querySelectorAll('#sf-case-list .cal-case-item').forEach(item => {
    item.style.display = !q || item.dataset.label.includes(q) ? '' : 'none';
  });
}

// ── 일정 추가/편집 폼 ──────────────────────────────────────────
function _schedOpenForm(id) {
  if (!isAdmin) return;
  _schedEditId = id || null;
  const ev = id ? _schedules.find(s => s.id === id) : null;
  const deptOpts = ['<option value="">부문 선택 (선택)</option>']
    .concat(_departments.map(dp =>
      `<option value="${dp.id}"${ev && ev.dept === dp.id ? ' selected' : ''}>${_esc(dp.name)}</option>`))
    .join('');
  const linked = ev ? _schedCaseIds(ev) : [];
  const caseChecks = allCases.map(c => `
    <label class="cal-case-item" data-label="${_esc(((c.date || '') + ' ' + c.title).toLowerCase())}">
      <input type="checkbox" class="sf-case-cb" value="${c.id}"${linked.includes(c.id) ? ' checked' : ''}>
      <span>${_esc(c.date || '')} ${_esc(c.title)}</span>
    </label>`).join('');

  const form = document.getElementById('cal-edit-form');
  form.innerHTML = `
    <div class="cal-form-title">${id ? '✎ 일정 편집' : '＋ 새 일정'}</div>
    <div class="cal-field-row">
      <div class="cal-field" style="flex:2">
        <label class="cal-field-label">진료 종류</label>
        <input id="sf-treatment" class="cal-input" placeholder="예: 임플란트 2차" value="${ev ? _esc(ev.treatment || '') : ''}">
      </div>
      <div class="cal-field" style="flex:1">
        <label class="cal-field-label">시간 (24h)</label>
        <input id="sf-time" class="cal-input" inputmode="numeric" maxlength="5" placeholder="예: 1430" value="${ev ? _esc(ev.time || '') : ''}" oninput="_onSchedTimeInput(this)">
      </div>
    </div>
    <div class="cal-field-row">
      <div class="cal-field">
        <label class="cal-field-label">환자</label>
        <input id="sf-patient" class="cal-input" placeholder="식별 최소 (예: K.H.M / 32세)" value="${ev ? _esc(ev.patient || '') : ''}">
      </div>
      <div class="cal-field">
        <label class="cal-field-label">부문</label>
        <select id="sf-dept" class="cal-input">${deptOpts}</select>
      </div>
    </div>
    <div class="cal-field">
      <label class="cal-field-label">챙길 점 · 메모</label>
      <textarea id="sf-notes" class="cal-input cal-textarea" placeholder="마크다운 사용 가능 (예: - 골이식 부위 확인&#10;- 봉합사 제거)">${ev ? _esc(ev.notes || '') : ''}</textarea>
    </div>
    <div class="cal-field">
      <label class="cal-field-label">관련 케이스 (복수 선택 가능)</label>
      <input class="cal-input cal-case-filter" placeholder="🔍 케이스 검색" oninput="_filterCaseList(this)">
      <div class="cal-case-list" id="sf-case-list">${caseChecks || '<div class="cal-day-empty">케이스가 없습니다.</div>'}</div>
    </div>
    <label class="cal-done-row"><input type="checkbox" id="sf-done"${ev && ev.done ? ' checked' : ''}> 완료 표시</label>
    <div class="cal-form-btns">
      <button class="cal-save-btn" onclick="_schedSave()">저장</button>
      <button class="cal-cancel-btn" onclick="_schedHideForm()">취소</button>
    </div>`;
  form.style.display = 'block';
  document.getElementById('sf-treatment').focus();
}

function _schedHideForm() {
  const form = document.getElementById('cal-edit-form');
  if (form) { form.style.display = 'none'; form.innerHTML = ''; }
  _schedEditId = null;
}

async function _schedSave() {
  if (!isAdmin) return;
  const treatment = document.getElementById('sf-treatment').value.trim();
  const timeRaw   = document.getElementById('sf-time').value.trim();
  const time      = _normTime(timeRaw);
  if (timeRaw && !time) {
    _edToast('시간은 24시간제(예: 1430 또는 14:30)로 입력하세요.', 'error');
    return;
  }
  const patient   = document.getElementById('sf-patient').value.trim();
  const dept      = document.getElementById('sf-dept').value;
  const notes     = document.getElementById('sf-notes').value.trim();
  const done      = document.getElementById('sf-done').checked;
  const caseIds   = Array.from(document.querySelectorAll('.sf-case-cb:checked')).map(cb => cb.value);

  if (!treatment && !patient && !notes) {
    _edToast('내용을 입력하세요.', 'error');
    return;
  }

  const data = { date: _schedDayStr, treatment, time, patient, dept, notes, done, caseIds };
  try {
    if (_schedEditId) {
      data.caseId = firebase.firestore.FieldValue.delete(); // 구버전 단일 필드 정리
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('schedules').doc(_schedEditId).update(data);
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('schedules').add(data);
    }
    await loadSchedules(_calYear, _calMonth, true);
    _refreshCalViews();
    _renderDayList();
    _schedHideForm();
    _edToast('저장되었습니다.');
  } catch (e) {
    _edToast('저장 실패: ' + (e.message || e), 'error');
  }
}

async function _schedDelete(id) {
  if (!isAdmin) return;
  if (!confirm('이 일정을 삭제할까요?')) return;
  try {
    await db.collection('schedules').doc(id).delete();
    await loadSchedules(_calYear, _calMonth, true);
    _refreshCalViews();
    _renderDayList();
    _edToast('삭제되었습니다.');
  } catch (e) {
    _edToast('삭제 실패: ' + (e.message || e), 'error');
  }
}

// ── 글로벌 에러 핸들러 ────────────────────────────────────────
window.addEventListener('unhandledrejection', e => {
  const msg = e.reason?.message || String(e.reason) || '알 수 없는 오류';
  console.warn('[unhandled]', msg, e.reason);
});

// ── 인용 위첨자 툴팁 ──────────────────────────────────────────
function _setupCiteTip() {
  const tip = document.getElementById('cite-tip');
  if (!tip) return;

  function show(el) {
    const text = el.dataset.tip || '';
    if (!text) return;
    tip.textContent = text;
    tip.style.display = 'block';
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.left + window.scrollX + r.width / 2 - tw / 2;
    let top  = r.top  + window.scrollY - th - 8;
    if (left < 8) left = 8;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (top < window.scrollY + 8) top = r.bottom + window.scrollY + 8;
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('.cite-sup');
    if (el) show(el);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('.cite-sup')) tip.style.display = 'none';
  });
  document.addEventListener('click', e => {
    const el = e.target.closest('.cite-sup');
    if (!el) { tip.style.display = 'none'; return; }
    e.stopPropagation();
    // 링크 있는 경우: <a>가 바깥에 있으므로 네이티브 링크가 이미 처리함 → 툴팁만 닫기
    if (el.closest('a.cite-link')) { tip.style.display = 'none'; return; }
    // 링크 없는 경우(교과서 등): 툴팁 토글
    if (tip.style.display === 'none' || tip.dataset.for !== el.dataset.n) {
      tip.dataset.for = el.dataset.n;
      show(el);
    } else {
      tip.style.display = 'none';
    }
  });
}

// ── Inventory (재고) ──────────────────────────────────────────
const BUR_META = {
  shapes: { TR:'Taper Round (테이퍼라운드)', TC:'Taper Cylinder (테이퍼실린더)', TF:'Taper Flat (테이퍼플랫)', FO:'Football/Flame (풋볼)', SO:'Small Round (스몰라운드)', EX:'Extra Shape (엑스트라)' },
  grade_order: ['EF','C','F','REG'],
  shape_order: ['TR','TC','TF','FO','SO','EX'],
  grades: {
    EF:  { name:'Extra Fine', ko:'초극세', grit:'20–30 µm', hex:'#eab308' },
    C:   { name:'Coarse',     ko:'조립',   grit:'125–150 µm', hex:'#22c55e' },
    F:   { name:'Fine',       ko:'세립',   grit:'40 µm',      hex:'#ef4444' },
    REG: { name:'Regular',    ko:'기본/표준', grit:'106–125 µm', hex:'#3b82f6' }
  },
  stock_labels: { enough:'✅ 충분', ok:'있음', low:'🟡 소량', none:'❌ 재고없음', warn:'⚠️ 확인필요' }
};

const BUR_SEED = [
  {code:'TR-11EF',shape:'TR',shape_ko:'테이퍼라운드(소)',grade:'EF',iso:'199/016',full_len:21.7,work_len:9.0,max_dia:1.6,rpm:300,stock:'low',brand:'MANI'},
  {code:'TR-13EF',shape:'TR',shape_ko:'테이퍼라운드(중)',grade:'EF',iso:'198/015',full_len:21.7,work_len:9.0,max_dia:1.5,rpm:300,stock:'enough',brand:'MANI'},
  {code:'TR-25EF',shape:'TR',shape_ko:'테이퍼라운드(대)',grade:'EF',iso:'199/016',full_len:21.7,work_len:10.0,max_dia:1.6,rpm:300,stock:'enough',brand:'MANI'},
  {code:'TR-26EF',shape:'TR',shape_ko:'테이퍼라운드(대)',grade:'EF',iso:'199/016',full_len:21.7,work_len:10.0,max_dia:1.6,rpm:300,stock:'low',brand:'MANI'},
  {code:'TF-12EF',shape:'TF',shape_ko:'테이퍼플랫',grade:'EF',iso:'197/013',full_len:21.0,work_len:7.0,max_dia:1.3,rpm:300,stock:'low',brand:'MANI'},
  {code:'TC-21EF',shape:'TC',shape_ko:'테이퍼실린더',grade:'EF',iso:'171/014',full_len:20.9,work_len:7.0,max_dia:1.4,rpm:300,stock:'low',brand:'MANI'},
  {code:'FO-22EF',shape:'FO',shape_ko:'풋볼',grade:'EF',iso:'297/012',full_len:21.0,work_len:5.2,max_dia:1.2,rpm:300,stock:'low',brand:'MANI'},
  {code:'EX-21EF',shape:'EX',shape_ko:'라운드(엑스트라)',grade:'EF',iso:'830R',full_len:18.9,work_len:4.7,max_dia:2.9,rpm:160,stock:'none',brand:'MANI'},
  {code:'코메 FG-379EF 023',shape:'TR',shape_ko:'FG 테이퍼라운드',grade:'EF',iso:'196/023',full_len:21.5,work_len:8.1,max_dia:2.3,rpm:300,stock:'low',brand:'Komet'},
  {code:'코메 FG-379EF',shape:'TR',shape_ko:'FG 테이퍼라운드',grade:'EF',iso:'196/019',full_len:18.9,work_len:4.9,max_dia:1.9,rpm:300,stock:'low',brand:'Komet'},
  {code:'코메 FG-858EF',shape:'TF',shape_ko:'FG 테이퍼플랫',grade:'EF',iso:'196/016',full_len:19.0,work_len:4.1,max_dia:1.6,rpm:300,stock:'none',brand:'Komet'},
  {code:'코메 FG-859EF',shape:'TF',shape_ko:'FG 테이퍼플랫',grade:'EF',iso:'196/013',full_len:18.9,work_len:3.9,max_dia:1.3,rpm:450,stock:'none',brand:'Komet'},
  {code:'TR-11C',shape:'TR',shape_ko:'테이퍼라운드(소)',grade:'C',iso:'199/016',full_len:21.7,work_len:9.0,max_dia:1.6,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TR-13C',shape:'TR',shape_ko:'테이퍼라운드(중)',grade:'C',iso:'198/018',full_len:21.8,work_len:9.2,max_dia:1.8,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TR-19C',shape:'TR',shape_ko:'테이퍼라운드',grade:'C',iso:'198/018',full_len:21.5,work_len:8.0,max_dia:1.8,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TR-25C',shape:'TR',shape_ko:'테이퍼라운드(대)',grade:'C',iso:'199/021',full_len:21.7,work_len:10.1,max_dia:2.1,rpm:300,stock:'enough',brand:'MANI'},
  {code:'TC-11C',shape:'TC',shape_ko:'테이퍼실린더',grade:'C',iso:'—',full_len:null,work_len:null,max_dia:null,rpm:300,stock:'low',brand:'MANI'},
  {code:'TF-12C',shape:'TF',shape_ko:'테이퍼플랫',grade:'C',iso:'173/016',full_len:21.8,work_len:10.2,max_dia:1.6,rpm:300,stock:'none',brand:'MANI'},
  {code:'TF-20C',shape:'TF',shape_ko:'테이퍼플랫',grade:'C',iso:'173/019',full_len:21.8,work_len:10.1,max_dia:1.9,rpm:300,stock:'none',brand:'MANI'},
  {code:'FO-27C',shape:'FO',shape_ko:'풋볼',grade:'C',iso:'299/016',full_len:21.0,work_len:5.5,max_dia:1.6,rpm:300,stock:'none',brand:'MANI'},
  {code:'SO-21C',shape:'SO',shape_ko:'스몰라운드',grade:'C',iso:'130/014',full_len:21.1,work_len:5.4,max_dia:1.4,rpm:450,stock:'low',brand:'MANI'},
  {code:'EX-21C',shape:'EX',shape_ko:'라운드(엑스트라)',grade:'C',iso:'830R',full_len:19.1,work_len:5.0,max_dia:3.3,rpm:160,stock:'none',brand:'MANI'},
  {code:'코메 FG-6856 012',shape:'TR',shape_ko:'FG φ1.2mm',grade:'C',iso:'196/012',full_len:19.0,work_len:5.1,max_dia:1.2,rpm:300,stock:'low',brand:'Komet'},
  {code:'코메 FG-6856 016',shape:'TR',shape_ko:'FG φ1.6mm',grade:'C',iso:'196/016',full_len:19.0,work_len:5.1,max_dia:1.6,rpm:300,stock:'none',brand:'Komet'},
  {code:'코메 FG-6379 023',shape:'TR',shape_ko:'FG φ2.3mm',grade:'C',iso:'196/023',full_len:21.5,work_len:8.1,max_dia:2.3,rpm:300,stock:'warn',brand:'Komet'},
  {code:'TR-11F',shape:'TR',shape_ko:'테이퍼라운드(소)',grade:'F',iso:'199/016',full_len:21.7,work_len:9.0,max_dia:1.6,rpm:300,stock:'none',brand:'MANI'},
  {code:'TR-13F',shape:'TR',shape_ko:'테이퍼라운드(중)',grade:'F',iso:'198/018',full_len:21.7,work_len:9.1,max_dia:1.8,rpm:300,stock:'none',brand:'MANI'},
  {code:'TR-21F',shape:'TR',shape_ko:'테이퍼라운드',grade:'F',iso:'197/016',full_len:21.5,work_len:8.5,max_dia:1.6,rpm:300,stock:'none',brand:'MANI'},
  {code:'TR-25F',shape:'TR',shape_ko:'테이퍼라운드(대)',grade:'F',iso:'199/021',full_len:21.7,work_len:10.1,max_dia:2.1,rpm:300,stock:'low',brand:'MANI'},
  {code:'TC-11F',shape:'TC',shape_ko:'테이퍼실린더',grade:'F',iso:'—',full_len:null,work_len:null,max_dia:null,rpm:300,stock:'none',brand:'MANI'},
  {code:'EX-21F',shape:'EX',shape_ko:'라운드(엑스트라)',grade:'F',iso:'830R',full_len:18.9,work_len:4.7,max_dia:2.9,rpm:160,stock:'none',brand:'MANI'},
  {code:'코메 FG-8856 016',shape:'TR',shape_ko:'FG φ1.6mm',grade:'F',iso:'196/016',full_len:19.0,work_len:4.1,max_dia:1.6,rpm:300,stock:'ok',brand:'Komet'},
  {code:'코메 FG-8379 023',shape:'TR',shape_ko:'FG φ2.3mm',grade:'F',iso:'196/023',full_len:21.5,work_len:8.1,max_dia:2.3,rpm:300,stock:'ok',brand:'Komet'},
  {code:'코메 FG-8845KR 016',shape:'TR',shape_ko:'FG φ1.6mm',grade:'F',iso:'196/016',full_len:19.0,work_len:5.1,max_dia:1.6,rpm:300,stock:'warn',brand:'Komet'},
  {code:'코메 FG-856',shape:'TR',shape_ko:'FG 테이퍼라운드',grade:'F',iso:'196/016',full_len:19.0,work_len:5.1,max_dia:1.6,rpm:300,stock:'ok',brand:'Komet'},
  {code:'TR-S21',shape:'TR',shape_ko:'테이퍼라운드(쇼트생크)',grade:'REG',iso:'553/016',full_len:19.9,work_len:9.0,max_dia:1.6,rpm:300,stock:'enough',brand:'MANI'},
  {code:'TR-12',shape:'TR',shape_ko:'테이퍼라운드',grade:'REG',iso:'199/016',full_len:21.7,work_len:9.0,max_dia:1.6,rpm:300,stock:'low',brand:'MANI'},
  {code:'TR-14',shape:'TR',shape_ko:'테이퍼라운드',grade:'REG',iso:'199/018',full_len:21.7,work_len:9.5,max_dia:1.8,rpm:300,stock:'low',brand:'MANI'},
  {code:'TR-21',shape:'TR',shape_ko:'테이퍼라운드',grade:'REG',iso:'199/016',full_len:21.7,work_len:9.0,max_dia:1.6,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TR-25',shape:'TR',shape_ko:'테이퍼라운드(대)',grade:'REG',iso:'199/021',full_len:21.7,work_len:10.0,max_dia:2.1,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TR-26',shape:'TR',shape_ko:'테이퍼라운드(대)',grade:'REG',iso:'199/021',full_len:21.7,work_len:10.1,max_dia:2.1,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TR-SS21',shape:'TR',shape_ko:'테이퍼라운드(슈퍼쇼트)',grade:'REG',iso:'197/012',full_len:15.9,work_len:5.9,max_dia:1.2,rpm:450,stock:'ok',brand:'MANI'},
  {code:'TC-11',shape:'TC',shape_ko:'테이퍼실린더',grade:'REG',iso:'—',full_len:null,work_len:null,max_dia:null,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TC-21',shape:'TC',shape_ko:'테이퍼실린더',grade:'REG',iso:'—',full_len:null,work_len:null,max_dia:null,rpm:300,stock:'ok',brand:'MANI'},
  {code:'TF-12',shape:'TF',shape_ko:'테이퍼플랫',grade:'REG',iso:'173/016',full_len:21.8,work_len:10.2,max_dia:1.6,rpm:300,stock:'low',brand:'MANI'},
  {code:'TF-13',shape:'TF',shape_ko:'테이퍼플랫',grade:'REG',iso:'173/018',full_len:21.8,work_len:10.2,max_dia:1.8,rpm:300,stock:'none',brand:'MANI'},
  {code:'FO-25',shape:'FO',shape_ko:'풋볼',grade:'REG',iso:'297/014',full_len:21.0,work_len:5.2,max_dia:1.4,rpm:300,stock:'none',brand:'MANI'},
  {code:'SO-21',shape:'SO',shape_ko:'스몰라운드',grade:'REG',iso:'130/014',full_len:21.1,work_len:5.4,max_dia:1.4,rpm:450,stock:'ok',brand:'MANI'},
  {code:'EX-21',shape:'EX',shape_ko:'라운드(엑스트라)',grade:'REG',iso:'830R',full_len:19.1,work_len:5.0,max_dia:3.2,rpm:160,stock:'ok',brand:'MANI'},
  {code:'EX-40',shape:'EX',shape_ko:'라운드(대)',grade:'REG',iso:'830L',full_len:20.1,work_len:7.2,max_dia:3.5,rpm:160,stock:'warn',brand:'MANI'}
];

let _burItems = [];
let _burGradeFilter = 'all';
let _burStockFilter = 'all';
let _invCat = 'diamond';

// 덴처/폴리싱 공용 simple inventory
let _simpleInvItems = { denture: [], polishing: [] };
let _simpleInvLoaded = { denture: false, polishing: false };
const SIMPLE_INV_COLS = { denture: ['코드','품명','사양','재고','비고'], polishing: ['코드','품명','재료/용도','재고','비고'] };

function _setInvCat(cat) {
  _invCat = cat;
  document.querySelectorAll('.inv-cat-card').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('.inv-sub-page').forEach(p => p.style.display = 'none');
  const sub = document.getElementById(`inv-sub-${cat}`);
  if (sub) sub.style.display = '';
  if (cat === 'diamond') renderInventory();
  else _renderSimpleInv(cat);
}

function _burDocId(code) {
  return code.replace(/\s+/g, '-').replace(/\//g, '_').replace(/[.]/g, '_');
}

async function _loadInventory() {
  const snap = await db.collection('burInventory').get().catch(() => null);
  if (!snap) { renderInventory(); return; }
  if (snap.empty) {
    await _seedInventory();
    const snap2 = await db.collection('burInventory').get();
    _burItems = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    _burItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  renderInventory();
}

async function _seedInventory() {
  const batch = db.batch();
  BUR_SEED.forEach(item => {
    const ref = db.collection('burInventory').doc(_burDocId(item.code));
    batch.set(ref, item);
  });
  await batch.commit();
}

function _setBurGrade(grade) {
  _burGradeFilter = grade;
  document.querySelectorAll('.inv-grade-tab').forEach(b => b.classList.toggle('active', b.dataset.grade === grade));
  renderInventory();
}

function _setBurStock(stock) {
  _burStockFilter = stock;
  document.querySelectorAll('.inv-stock-tab').forEach(b => b.classList.toggle('active', b.dataset.stock === stock));
  renderInventory();
}

function _burStockHTML(stock) {
  const cls = { enough:'inv-s-enough', ok:'inv-s-ok', low:'inv-s-low', none:'inv-s-none', warn:'inv-s-warn' };
  return `<span class="inv-stock ${cls[stock]||''}">${BUR_META.stock_labels[stock]||stock}</span>`;
}

function _burRowHTML(item, showAdminBtns) {
  const rpmHigh = item.rpm >= 450;
  const rpmStr = item.rpm ? `<span class="${rpmHigh ? 'inv-rpm-high' : ''}">${item.rpm}</span>` : '—';
  const editBtn = showAdminBtns
    ? `<button class="inv-edit-btn" onclick="_openBurEdit('${item.id}')">✏️</button>`
    : '';
  return `<tr>
    <td class="inv-code">${_esc(item.code)}<span class="inv-brand-badge inv-brand-${(item.brand||'').toLowerCase()}">${_esc(item.brand||'')}</span></td>
    <td>${_esc(item.shape_ko||'')}</td>
    <td class="inv-iso">${_esc(item.iso||'—')}</td>
    <td class="inv-num">${item.full_len!=null?item.full_len:'—'}</td>
    <td class="inv-num">${item.work_len!=null?item.work_len:'—'}</td>
    <td class="inv-num">${item.max_dia!=null?item.max_dia:'—'}</td>
    <td class="inv-num">${rpmStr}</td>
    <td>${_burStockHTML(item.stock)}</td>
    ${showAdminBtns ? `<td class="inv-act">${editBtn}</td>` : ''}
  </tr>`;
}

function renderInventory() {
  const content = document.getElementById('inv-content');
  if (!content) return;

  const adminBtns = document.getElementById('inv-admin-btns');
  if (adminBtns) {
    adminBtns.innerHTML = isAdmin
      ? `<button class="inv-add-btn" onclick="_openBurEdit(null)">+ 버 추가</button>`
      : '';
  }

  let items = _burItems;
  if (_burGradeFilter !== 'all') items = items.filter(i => i.grade === _burGradeFilter);
  if (_burStockFilter !== 'all') {
    const allow = _burStockFilter.split(',');
    items = items.filter(i => allow.includes(i.stock));
  }

  const grades = _burGradeFilter === 'all' ? BUR_META.grade_order : [_burGradeFilter];
  let html = '';

  grades.forEach(grade => {
    const gm = BUR_META.grades[grade];
    const gi = items.filter(i => i.grade === grade);
    if (!gi.length) return;

    html += `<div class="inv-grade-section">
      <div class="inv-grade-header" style="border-left:4px solid ${gm.hex}">
        <span class="inv-grade-label" style="color:${gm.hex}">${grade === 'REG' ? 'Regular' : grade}</span>
        <span class="inv-grade-desc">${gm.ko} · ${gm.grit}</span>
        <span class="inv-grade-count">${gi.length}종</span>
      </div>`;

    BUR_META.shape_order.forEach(shape => {
      const si = gi.filter(i => i.shape === shape);
      if (!si.length) return;
      const shapeImg = `/dental-site/icons/bur/${shape}.png`;
      html += `<div class="inv-shape-group">
        <div class="inv-shape-header">
          <img src="${shapeImg}" alt="${shape}" class="inv-shape-img" onerror="this.style.display='none'">
          <span class="inv-shape-name">${BUR_META.shapes[shape]||shape}</span>
          <span class="inv-shape-count">${si.length}종</span>
        </div>
        <div class="inv-table-wrap">
          <table class="inv-table">
            <thead><tr>
              <th>코드</th><th>형태명</th><th>ISO</th>
              <th title="전장(mm)">전장</th><th title="작업장(mm)">작업장</th><th title="최대경(mm)">최대경</th><th title="최대RPM ×1000">RPM(K)</th>
              <th>재고</th>${isAdmin ? '<th></th>' : ''}
            </tr></thead>
            <tbody>${si.map(item => _burRowHTML(item, isAdmin)).join('')}</tbody>
          </table>
        </div>
      </div>`;
    });

    // unknown shapes not in shape_order
    const knownShapes = new Set(BUR_META.shape_order);
    const others = gi.filter(i => !knownShapes.has(i.shape));
    if (others.length) {
      html += `<div class="inv-shape-group">
        <div class="inv-shape-header"><span class="inv-shape-name">기타</span><span class="inv-shape-count">${others.length}종</span></div>
        <div class="inv-table-wrap"><table class="inv-table">
          <thead><tr><th>코드</th><th>형태명</th><th>ISO</th><th>전장</th><th>작업장</th><th>최대경</th><th>RPM(K)</th><th>재고</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
          <tbody>${others.map(item => _burRowHTML(item, isAdmin)).join('')}</tbody>
        </table></div>
      </div>`;
    }

    html += '</div>';
  });

  content.innerHTML = html || '<div class="empty" style="padding:2rem;text-align:center">표시할 항목이 없습니다.</div>';

  _renderBurOrderSummary(items);
}

function _renderBurOrderSummary(items) {
  const el = document.getElementById('inv-order-summary');
  if (!el) return;
  const noneItems = (items || _burItems).filter(i => i.stock === 'none');
  if (!noneItems.length) { el.innerHTML = ''; return; }

  const byGrade = {};
  noneItems.forEach(i => {
    if (!byGrade[i.grade]) byGrade[i.grade] = [];
    byGrade[i.grade].push(i);
  });

  let html = `<div class="inv-order-section">
    <div class="inv-order-title">❌ 주문 필요 목록 (${noneItems.length}종)</div>`;
  BUR_META.grade_order.forEach(grade => {
    if (!byGrade[grade]) return;
    const gm = BUR_META.grades[grade];
    html += `<div class="inv-order-grade">
      <span class="inv-order-grade-label" style="color:${gm.hex}">${grade === 'REG' ? 'Regular' : grade}</span>
      ${byGrade[grade].map(i => `<span class="inv-order-item">${_esc(i.code)}</span>`).join('')}
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function _openBurEdit(id) {
  const item = id ? _burItems.find(i => i.id === id) : null;
  const title = item ? '버 정보 편집' : '새 버 추가';

  const fv = (k, def='') => item ? (item[k] != null ? item[k] : def) : def;
  const gradeOpts = BUR_META.grade_order.map(g => {
    const gm = BUR_META.grades[g];
    const sel = fv('grade','EF') === g ? ' selected' : '';
    return `<option value="${g}"${sel}>${g} (${gm.ko})</option>`;
  }).join('');
  const shapeOpts = BUR_META.shape_order.map(s => {
    const sel = fv('shape','TR') === s ? ' selected' : '';
    return `<option value="${s}"${sel}>${s}</option>`;
  }).join('');
  const stockOpts = Object.entries(BUR_META.stock_labels).map(([k,v]) => {
    const sel = fv('stock','ok') === k ? ' selected' : '';
    return `<option value="${k}"${sel}>${v}</option>`;
  }).join('');

  const html = `<div id="bur-edit-overlay" class="modal-overlay open" onclick="if(event.target.id==='bur-edit-overlay')_closeBurEdit()">
    <div class="modal" style="max-width:520px">
      <button class="modal-close" onclick="_closeBurEdit()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 1.2rem">${title}</h3>
        <div class="ed-form-grid">
          <label>버 코드 *<input id="bur-f-code" type="text" value="${_esc(fv('code'))}" placeholder="예: TR-11EF"></label>
          <label>브랜드<select id="bur-f-brand">
            <option value="MANI"${fv('brand','MANI')==='MANI'?' selected':''}>MANI</option>
            <option value="Komet"${fv('brand')==='Komet'?' selected':''}>Komet</option>
            <option value="기타"${fv('brand')==='기타'?' selected':''}>기타</option>
          </select></label>
          <label>형태(shape)<select id="bur-f-shape">${shapeOpts}</select></label>
          <label>형태명(한글)<input id="bur-f-shape-ko" type="text" value="${_esc(fv('shape_ko'))}" placeholder="테이퍼라운드(소)"></label>
          <label>등급<select id="bur-f-grade">${gradeOpts}</select></label>
          <label>ISO 코드<input id="bur-f-iso" type="text" value="${_esc(fv('iso','—'))}" placeholder="199/016"></label>
          <label>전장(mm)<input id="bur-f-full-len" type="number" step="0.1" value="${fv('full_len','')}"></label>
          <label>작업장(mm)<input id="bur-f-work-len" type="number" step="0.1" value="${fv('work_len','')}"></label>
          <label>최대경(mm)<input id="bur-f-max-dia" type="number" step="0.1" value="${fv('max_dia','')}"></label>
          <label>최대RPM(×1000)<input id="bur-f-rpm" type="number" value="${fv('rpm',300)}"></label>
          <label style="grid-column:1/-1">재고 상태<select id="bur-f-stock">${stockOpts}</select></label>
        </div>
        <div style="display:flex;gap:0.7rem;margin-top:1.4rem;justify-content:flex-end">
          ${item && isAdmin ? `<button class="card-admin-btn del" onclick="_deleteBur('${id}')">🗑 삭제</button>` : ''}
          <button class="cal-cancel-btn" onclick="_closeBurEdit()">취소</button>
          <button class="cal-save-btn" onclick="_saveBur('${id||''}')">저장</button>
        </div>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function _closeBurEdit() {
  document.getElementById('bur-edit-overlay')?.remove();
}

async function _saveBur(id) {
  const g = sel => document.getElementById(sel)?.value?.trim();
  const gn = sel => { const v = document.getElementById(sel)?.value; return v === '' || v == null ? null : Number(v); };
  const code = g('bur-f-code');
  if (!code) { alert('버 코드를 입력하세요.'); return; }

  const data = {
    code,
    brand: g('bur-f-brand') || 'MANI',
    shape: g('bur-f-shape') || 'TR',
    shape_ko: g('bur-f-shape-ko') || '',
    grade: g('bur-f-grade') || 'EF',
    iso: g('bur-f-iso') || '—',
    full_len: gn('bur-f-full-len'),
    work_len: gn('bur-f-work-len'),
    max_dia: gn('bur-f-max-dia'),
    rpm: gn('bur-f-rpm') || 300,
    stock: g('bur-f-stock') || 'ok'
  };

  const docId = id || _burDocId(code);
  await db.collection('burInventory').doc(docId).set(data);

  const idx = _burItems.findIndex(i => i.id === docId);
  if (idx >= 0) _burItems[idx] = { id: docId, ...data };
  else _burItems.push({ id: docId, ...data });

  _closeBurEdit();
  renderInventory();
}

async function _deleteBur(id) {
  if (!confirm('이 버를 삭제하시겠습니까?')) return;
  await db.collection('burInventory').doc(id).delete();
  _burItems = _burItems.filter(i => i.id !== id);
  _closeBurEdit();
  renderInventory();
}

// ── Schedule Import (사진/텍스트 → 일정 자동 입력) ───────────
let _schedImportRows = [];   // 검토 중인 파싱 결과
let _tesseractLoading = null;

// claude.ai 등에 붙여넣을 프롬프트 (JSON 출력 강제)
function _schedImportPrompt() {
  const y = _calYear, m = _pad2(_calMonth + 1);
  const depts = _departments.map(d => `${d.id}=${d.name}`).join(', ');
  return [
    '첨부한 진료 일정 사진/표를 읽고, 각 일정을 아래 JSON 배열로만 출력해줘. 설명·코드펜스 없이 JSON 배열 그 자체만.',
    '',
    '형식: [{"date":"YYYY-MM-DD","time":"HH:MM","patient":"환자식별","treatment":"진료종류","dept":"부문ID","notes":"메모"}]',
    '',
    '규칙:',
    `- date는 반드시 YYYY-MM-DD. 연/월이 사진에 없으면 ${_calYear}년 ${m}월로 가정.`,
    '- time은 24시간제 HH:MM. 시간이 없으면 빈 문자열 "".',
    '- dept는 다음 중 ID로 매핑(애매하면 ""): ' + (depts || '(부문 없음)'),
    '- 개인정보 보호: 환자명은 사진에 적힌 그대로 옮기되 새로 추측하지 말 것.',
    '- 값이 없으면 빈 문자열. 일정이 여러 개면 배열에 모두 담을 것.'
  ].join('\n');
}

function _openSchedImport() {
  if (!isAdmin) return;
  _schedImportRows = [];
  const html = `<div id="sched-import-overlay" class="modal-overlay open" onclick="if(event.target.id==='sched-import-overlay')_closeSchedImport()">
    <div class="modal sched-import-modal">
      <button class="modal-close" onclick="_closeSchedImport()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 0.3rem">📷 일정 가져오기</h3>
        <p class="si-hint">사진을 올리면 자동 인식(브라우저 OCR)하거나, claude.ai에서 변환한 JSON을 붙여넣어 한 번에 등록합니다.</p>

        <div class="si-method">
          <div class="si-method-title">방법 1 · 사진 자동 인식 <span class="si-badge">실험적</span></div>
          <label class="si-upload" id="si-upload-label">
            <input type="file" accept="image/*" id="si-file" style="display:none" onchange="_schedImportOCR(this.files[0])">
            <span id="si-upload-text">📁 일정 사진 선택 / 촬영</span>
          </label>
          <div id="si-ocr-status" class="si-status"></div>
        </div>

        <div class="si-divider"><span>또는</span></div>

        <div class="si-method">
          <div class="si-method-title">방법 2 · claude.ai 붙여넣기 <span class="si-badge si-badge-accurate">정확도 높음</span></div>
          <button class="si-copy-btn" onclick="_copySchedPrompt(this)">📋 변환 프롬프트 복사</button>
          <span class="si-copy-hint">→ claude.ai에 사진과 함께 붙여넣고, 나온 JSON을 아래에 붙여넣으세요</span>
          <textarea id="si-paste" class="si-paste" placeholder='여기에 JSON 붙여넣기 — 예:&#10;[{"date":"2026-06-30","time":"14:30","patient":"K.H.M","treatment":"임플란트 2차","dept":"","notes":""}]'></textarea>
          <button class="si-parse-btn" onclick="_schedImportParse()">분석하기 →</button>
        </div>

        <div id="si-review"></div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _closeSchedImport() {
  document.getElementById('sched-import-overlay')?.remove();
  _schedImportRows = [];
}

function _copySchedPrompt(btn) {
  const txt = _schedImportPrompt();
  const done = () => { btn.textContent = '✓ 복사됨'; setTimeout(() => btn.textContent = '📋 변환 프롬프트 복사', 1800); };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(() => { _fallbackCopy(txt); done(); });
  } else { _fallbackCopy(txt); done(); }
}

function _fallbackCopy(txt) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}

// ── 방법 2: 붙여넣은 JSON/텍스트 파싱 ──
function _schedImportParse() {
  const raw = document.getElementById('si-paste')?.value || '';
  if (!raw.trim()) { _edToast('붙여넣은 내용이 없습니다.', 'error'); return; }
  let rows = _parseSchedJSON(raw);
  if (!rows.length) rows = _parseSchedLoose(raw);
  if (!rows.length) { _edToast('일정을 찾지 못했습니다. 형식을 확인하세요.', 'error'); return; }
  _schedImportRows = rows.map(_normSchedRow);
  _renderSchedReview();
}

function _parseSchedJSON(raw) {
  // 코드펜스/앞뒤 텍스트 제거하고 첫 배열 추출
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  const a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

// JSON이 아닐 때: 줄 단위 휴리스틱 (OCR 텍스트/표 붙여넣기 대응)
function _parseSchedLoose(raw) {
  const rows = [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let curDate = '';
  lines.forEach(line => {
    const d = _grabDate(line);
    if (d) curDate = d;
    const t = _grabTime(line);
    // 날짜 또는 시간 또는 의미있는 텍스트가 있으면 후보 행
    let rest = line
      .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, '')
      .replace(/\d{1,2}월\s*\d{1,2}일/g, '')
      .replace(/\d{1,2}:\d{2}/g, '')
      .replace(/\b\d{3,4}\b/g, '')
      .replace(/[|\t]+/g, ' ')
      .trim();
    if (!t && !d && !rest) return;
    if (!rest && !t) return;
    rows.push({ date: curDate || d || '', time: t || '', patient: '', treatment: rest, dept: '', notes: '' });
  });
  return rows;
}

function _grabDate(s) {
  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${_pad2(+m[2])}-${_pad2(+m[3])}`;
  m = s.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (m) return `${_calYear}-${_pad2(+m[1])}-${_pad2(+m[2])}`;
  m = s.match(/\b(\d{1,2})[/.](\d{1,2})\b/);
  if (m) return `${_calYear}-${_pad2(+m[1])}-${_pad2(+m[2])}`;
  return '';
}

function _grabTime(s) {
  let m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) return _normTime(`${m[1]}:${m[2]}`);
  m = s.match(/\b(\d{1,2})시\s*(\d{1,2})?분?/);
  if (m) return _normTime(`${m[1]}:${m[2] ? _pad2(+m[2]) : '00'}`);
  return '';
}

function _normSchedRow(r) {
  const validDept = _departments.some(d => d.id === r.dept) ? r.dept : '';
  return {
    date: _grabDate(String(r.date || '')) || String(r.date || '').trim(),
    time: _normTime(String(r.time || '').replace(/[^\d:]/g,'')) || '',
    patient: String(r.patient || '').trim(),
    treatment: String(r.treatment || '').trim(),
    dept: validDept,
    notes: String(r.notes || '').trim()
  };
}

// ── 방법 1: 브라우저 OCR (Tesseract.js) ──
function _loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (_tesseractLoading) return _tesseractLoading;
  _tesseractLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('OCR 라이브러리 로드 실패'));
    document.head.appendChild(s);
  });
  return _tesseractLoading;
}

async function _schedImportOCR(file) {
  if (!file) return;
  const status = document.getElementById('si-ocr-status');
  const label  = document.getElementById('si-upload-text');
  if (label) label.textContent = '📁 ' + file.name;
  const setS = (msg) => { if (status) status.textContent = msg; };
  setS('OCR 엔진 불러오는 중…');
  try {
    await _loadTesseract();
    setS('이미지 분석 중… (한글 인식은 시간이 걸릴 수 있어요)');
    const { data } = await window.Tesseract.recognize(file, 'kor+eng', {
      logger: m => { if (m.status === 'recognizing text') setS(`인식 중… ${Math.round((m.progress||0)*100)}%`); }
    });
    const text = (data && data.text) || '';
    if (!text.trim()) { setS('글자를 인식하지 못했습니다. 더 선명한 사진을 시도하거나 방법 2를 쓰세요.'); return; }
    const rows = _parseSchedLoose(text).map(_normSchedRow).filter(r => r.date || r.time || r.treatment);
    if (!rows.length) { setS('일정 형태를 못 찾았습니다. 인식된 텍스트를 방법 2 칸에 넣고 정리해 보세요.');
      const pasteEl = document.getElementById('si-paste'); if (pasteEl) pasteEl.value = text; return; }
    setS(`✓ ${rows.length}건 인식됨 — 아래에서 검토·수정하세요.`);
    _schedImportRows = rows;
    _renderSchedReview();
  } catch (e) {
    setS('OCR 실패: ' + (e.message || e) + ' — 방법 2(붙여넣기)를 이용하세요.');
  }
}

// ── 검토 표 ──
function _renderSchedReview() {
  const el = document.getElementById('si-review');
  if (!el) return;
  if (!_schedImportRows.length) { el.innerHTML = ''; return; }
  const deptOpts = (sel) => ['<option value="">—</option>']
    .concat(_departments.map(d => `<option value="${d.id}"${d.id===sel?' selected':''}>${_esc(d.name)}</option>`)).join('');
  const rows = _schedImportRows.map((r, i) => `<tr>
    <td><input class="si-cell" value="${_esc(r.date)}" placeholder="YYYY-MM-DD" oninput="_schedImportRows[${i}].date=this.value"></td>
    <td><input class="si-cell si-cell-time" value="${_esc(r.time)}" placeholder="HH:MM" oninput="_schedImportRows[${i}].time=this.value"></td>
    <td><input class="si-cell" value="${_esc(r.patient)}" placeholder="환자" oninput="_schedImportRows[${i}].patient=this.value"></td>
    <td><input class="si-cell" value="${_esc(r.treatment)}" placeholder="진료" oninput="_schedImportRows[${i}].treatment=this.value"></td>
    <td><select class="si-cell" onchange="_schedImportRows[${i}].dept=this.value">${deptOpts(r.dept)}</select></td>
    <td><button class="si-row-del" onclick="_schedImportDelRow(${i})" title="삭제">✕</button></td>
  </tr>`).join('');
  el.innerHTML = `
    <div class="si-review-title">검토 (${_schedImportRows.length}건) — 잘못된 칸은 직접 수정하세요</div>
    <div class="si-table-wrap"><table class="si-table">
      <thead><tr><th>날짜</th><th>시간</th><th>환자</th><th>진료</th><th>부문</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="si-review-btns">
      <button class="cal-cancel-btn" onclick="_closeSchedImport()">취소</button>
      <button class="cal-save-btn" onclick="_schedImportCommit()">✓ 전부 등록</button>
    </div>`;
}

function _schedImportDelRow(i) {
  _schedImportRows.splice(i, 1);
  _renderSchedReview();
}

async function _schedImportCommit() {
  if (!isAdmin) return;
  const valid = _schedImportRows.filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && (r.treatment || r.patient || r.notes));
  if (!valid.length) { _edToast('등록할 유효한 일정이 없습니다. 날짜(YYYY-MM-DD)를 확인하세요.', 'error'); return; }
  const skipped = _schedImportRows.length - valid.length;
  try {
    // 붙여넣기 건수는 제한이 없으므로 batch 상한(500)을 넘을 수 있다 → 분할 커밋
    const ops = [];
    valid.forEach(r => {
      const ref = db.collection('schedules').doc();
      ops.push({ type: 'set', ref, data: {
        date: r.date,
        time: _normTime(r.time) || '',
        treatment: r.treatment || '',
        patient: r.patient || '',
        dept: _departments.some(d => d.id === r.dept) ? r.dept : '',
        notes: r.notes || '',
        done: false,
        caseIds: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      } });
    });
    await _commitOps(ops);
    await loadSchedules(_calYear, _calMonth, true);
    _refreshCalViews();
    _closeSchedImport();
    _edToast(`${valid.length}건 등록 완료${skipped ? ` (${skipped}건은 날짜 누락으로 건너뜀)` : ''}.`);
  } catch (e) {
    _edToast('등록 실패: ' + (e.message || e), 'error');
  }
}

// ── 진료별 SOAP ───────────────────────────────────────────────
// SOAP_CATS / SOAP_SEED_VERSION / SOAP_SEED 는 js/soap-seed.js 에 정의됨

let _soapItems = [];
let _soapLoadError = '';
let _soapCatFilter = 'all';
let _soapSearch = '';
let _soapOpenId = null;

function _soapDocId(title) {
  return 'soap-' + title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 60);
}

async function _loadSOAP() {
  // 시드 파일(js/soap-seed.js) 미로드 방어 — 예외로 렌더가 통째로 중단되는 것을 막는다
  if (typeof SOAP_SEED === 'undefined' || !Array.isArray(SOAP_SEED) || !SOAP_SEED.length) {
    console.error('[soap] SOAP_SEED 로드 실패 — js/soap-seed.js 확인 필요');
    _soapItems = [];
    _soapLoadError = '템플릿 파일을 불러오지 못했습니다.';
    renderSOAP();
    return;
  }
  _soapLoadError = '';
  // 로컬 시드를 기본값으로 — Firestore 실패·권한·캐시와 무관하게 항상 내용이 보이도록
  const base = SOAP_SEED.map(t => ({ id: _soapDocId(t.title), ...t, seed: true }));
  const newIds = new Set(base.map(b => b.id));
  try {
    const [snap, metaSnap] = await Promise.all([
      db.collection('soapTemplates').get(),
      db.collection('appMeta').doc('soapSeed').get().catch(() => null)
    ]);
    const ver = (metaSnap && metaSnap.exists) ? (metaSnap.data().version || 0) : 0;

    if (isAdmin && (snap.empty || ver < SOAP_SEED_VERSION)) {
      // 관리자만 재시드 시도 (쓰기 권한 필요) — 실패해도 화면은 로컬 시드로 렌더
      try { await _seedSOAP(snap); } catch (e) { console.warn('[soap reseed]', e); }
      const s2 = await db.collection('soapTemplates').get().catch(() => null);
      _soapItems = s2 ? s2.docs.map(d => ({ id: d.id, ...d.data() })) : base;
    } else if (!snap.empty) {
      // Firestore 내용을 로컬 시드 위에 덮어씀 (관리자 편집·추가 반영, 옛 시드는 정리)
      const byId = {};
      base.forEach(it => { byId[it.id] = it; });
      snap.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
      _soapItems = Object.values(byId).filter(it => it.userCreated || newIds.has(it.id));
    } else {
      _soapItems = base;
    }
  } catch (e) {
    console.warn('[soap load]', e);
    _soapItems = base;
  }
  if (!_soapItems.length) _soapItems = base;
  renderSOAP();
}

// 시드 항목을 최신 SOAP_SEED로 교체. 관리자가 직접 만든 항목(userCreated)은 보존.
async function _seedSOAP(existingSnap) {
  const ops = [];
  const newIds = new Set(SOAP_SEED.map(t => _soapDocId(t.title)));
  if (existingSnap) {
    existingSnap.forEach(d => {
      const data = d.data() || {};
      if (!data.userCreated && !newIds.has(d.id)) ops.push({ type: 'del', ref: d.ref }); // 옛 시드 정리
    });
  }
  SOAP_SEED.forEach(t => ops.push({ type: 'set', ref: db.collection('soapTemplates').doc(_soapDocId(t.title)), data: { ...t, seed: true } }));
  await _commitOps(ops);
  // 버전 마커는 별도 커밋 — appMeta 쓰기가 막혀도 템플릿 저장은 유지
  try { await db.collection('appMeta').doc('soapSeed').set({ version: SOAP_SEED_VERSION }); }
  catch (e) { console.warn('[soap seed meta]', e); }
}

function _soapCatOrder(cat) {
  const i = SOAP_CATS.indexOf(cat);
  return i < 0 ? 99 : i;
}

function _setSoapCat(cat) {
  _soapCatFilter = cat;
  renderSOAP();
  _scrollTop();
}

function _soapFilter(v) {
  _soapSearch = (v || '').trim().toLowerCase();
  renderSOAP();
}

function _soapToggle(id) {
  const opening = _soapOpenId !== id;
  _soapOpenId = opening ? id : null;
  _renderKeepingAnchor('soap-list', id, renderSOAP, opening);
}

function renderSOAP() {
  const list = document.getElementById('soap-list');
  const tabs = document.getElementById('soap-cat-tabs');
  const adminEl = document.getElementById('soap-admin-btns');
  if (!list) return;

  if (adminEl) adminEl.innerHTML = isAdmin
    ? '<button class="soap-add-btn" onclick="_openSoapEdit(null)">+ SOAP 추가</button>' : '';
  const toolsEl = document.getElementById('soap-tools');
  if (toolsEl) toolsEl.innerHTML = _refToolsHTML('soap', _soapItems.filter(i => _isFav(i.id)).length);

  // 카테고리 탭
  const usedCats = SOAP_CATS.filter(c => _soapItems.some(i => i.category === c));
  if (tabs) {
    tabs.innerHTML = ['all'].concat(usedCats).map(c =>
      `<button class="soap-cat-tab${_soapCatFilter === c ? ' active' : ''}" onclick="_setSoapCat('${c}')">${c === 'all' ? '전체' : c}</button>`
    ).join('');
  }

  let items = _soapItems.slice();
  if (_favOnly.soap) items = items.filter(i => _isFav(i.id));
  if (_soapCatFilter !== 'all') items = items.filter(i => i.category === _soapCatFilter);
  if (_soapSearch) items = items.filter(i =>
    (i.title || '').toLowerCase().includes(_soapSearch) ||
    [i.subjective, i.objective, i.assessment, i.plan, i.tx].join(' ').toLowerCase().includes(_soapSearch));

  items.sort((a, b) =>
    _soapCatOrder(a.category) - _soapCatOrder(b.category) ||
    (a.order || 0) - (b.order || 0) ||
    (a.title || '').localeCompare(b.title || ''));

  if (!items.length) {
    list.innerHTML = _soapLoadError
      ? `<div class="empty" style="padding:2.5rem 1.5rem;text-align:center;color:var(--text-muted);line-height:1.8">
           <div style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:0.5rem">SOAP 템플릿을 불러오지 못했습니다</div>
           ${_esc(_soapLoadError)}<br>
           네트워크 또는 캐시 문제일 수 있습니다.<br>
           <button class="soap-add-btn" style="margin-top:0.9rem" onclick="_soapHardReload()">캐시 지우고 다시 불러오기</button>
         </div>`
      : '<div class="empty" style="padding:2.5rem;text-align:center;color:var(--text-muted)">항목이 없습니다.</div>';
    return;
  }

  let html = (typeof SOAP_REFS !== 'undefined' ? SOAP_REFS : ''), lastCat = null;
  items.forEach(it => {
    if (it.category !== lastCat && _soapCatFilter === 'all') {
      html += `<div class="soap-cat-label">${_esc(it.category || '기타')}</div>`;
      lastCat = it.category;
    }
    const open = _printAll() || _soapOpenId === it.id;
    const editBtn = isAdmin
      ? `<button class="soap-edit-btn" onclick="event.stopPropagation();_openSoapEdit('${it.id}')">✏️</button>` : '';
    const body = open ? `<div class="soap-body">
        ${_soapBlock('S', 'Subjective 주관적', it.subjective)}
        ${_soapBlock('O', 'Objective 객관적', it.objective)}
        ${_relatedExamHTML(it.category, it.title)}
        ${_soapBlock('A', 'Assessment 평가', it.assessment)}
        ${_soapBlock('P', 'Plan 계획', it.plan)}
        ${_soapBlock('Tx', '시행 술식 (Treatment)', it.tx)}
        ${_relatedLabHTML(it.title)}
      </div>` : '';
    html += `<div class="soap-card${open ? ' open' : ''}">
      <div class="soap-card-head" data-ref-id="${it.id}" onclick="_soapToggle('${it.id}')">
        <span class="soap-cat-badge">${_esc(it.category || '')}</span>
        <span class="soap-card-title">${_esc(it.title || '')}</span>
        ${_favBtn('soap', it.id)}
        ${editBtn}
        <span class="soap-chevron">${open ? '▲' : '▼'}</span>
      </div>
      ${body}
    </div>`;
  });
  list.innerHTML = html;
  _injectCopyButtons(list);
}

function _soapBlock(letter, label, md) {
  if (!md || !String(md).trim()) return '';
  let body;
  try { body = marked.parse(String(md)); }
  catch (e) { console.warn('[soap] 마크다운 파싱 실패', label, e); body = _esc(String(md)).replace(/\n/g, '<br>'); }
  return `<div class="soap-sec soap-sec-${letter.toLowerCase()}">
    <div class="soap-sec-label"><span class="soap-sec-letter">${letter}</span>${label}</div>
    <div class="soap-sec-body markdown-body">${body}</div>
  </div>`;
}

// ── 임상검사 (Clinical Examination) ──────────────────────────
// SOAP의 O를 "어떻게 파악하는가" — 검사 술기 참고.
// 로컬 시드를 기본값으로, Firestore(examTemplates)를 그 위에 덮어써 관리자 편집을 반영.
let _examItems = [];
let _examCatFilter = 'all';
let _examSearch = '';
let _examOpenId = null;
let _examLoadError = '';

const EXAM_FIELDS = [
  ['purpose',        '목적', 'Purpose 무엇을 알아내는가'],
  ['technique',      '술기', 'Technique 어떻게 하는가'],
  ['criteria',       '기준', 'Criteria 정상치·판정 기준'],
  ['interpretation', '해석', 'Interpretation 무엇을 의미하는가'],
  ['pitfalls',       '함정', 'Pitfalls 값을 틀리게 만드는 것'],
];

function _examDocId(title) {
  return 'exam-' + title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 60);
}

async function _loadExam() {
  if (typeof EXAM_SEED === 'undefined' || !Array.isArray(EXAM_SEED) || !EXAM_SEED.length) {
    console.error('[exam] EXAM_SEED 로드 실패 — js/exam-seed.js 확인 필요');
    _examItems = [];
    _examLoadError = '검사 자료 파일을 불러오지 못했습니다.';
    renderExam();
    return;
  }
  _examLoadError = '';
  const base = EXAM_SEED.map(t => ({ id: _examDocId(t.title), ...t, seed: true }));
  const newIds = new Set(base.map(b => b.id));
  try {
    const [snap, metaSnap] = await Promise.all([
      db.collection('examTemplates').get(),
      db.collection('appMeta').doc('examSeed').get().catch(() => null)
    ]);
    const ver = (metaSnap && metaSnap.exists) ? (metaSnap.data().version || 0) : 0;

    if (isAdmin && (snap.empty || ver < EXAM_SEED_VERSION)) {
      try { await _seedExam(snap); } catch (e) { console.warn('[exam reseed]', e); }
      const s2 = await db.collection('examTemplates').get().catch(() => null);
      _examItems = s2 && !s2.empty ? s2.docs.map(d => ({ id: d.id, ...d.data() })) : base;
    } else if (!snap.empty) {
      const byId = {};
      base.forEach(it => { byId[it.id] = it; });
      snap.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
      _examItems = Object.values(byId).filter(it => it.userCreated || newIds.has(it.id));
    } else {
      _examItems = base;
    }
  } catch (e) {
    console.warn('[exam load]', e);
    _examItems = base;
  }
  if (!_examItems.length) _examItems = base;
  renderExam();
}

// 시드 항목을 최신 EXAM_SEED로 교체. 관리자가 만든 항목(userCreated)은 보존.
async function _seedExam(existingSnap) {
  const ops = [];
  const newIds = new Set(EXAM_SEED.map(t => _examDocId(t.title)));
  if (existingSnap) {
    existingSnap.forEach(d => {
      const data = d.data() || {};
      if (!data.userCreated && !newIds.has(d.id)) ops.push({ type: 'del', ref: d.ref });
    });
  }
  EXAM_SEED.forEach(t => ops.push({ type: 'set', ref: db.collection('examTemplates').doc(_examDocId(t.title)), data: { ...t, seed: true } }));
  await _commitOps(ops);
  try { await db.collection('appMeta').doc('examSeed').set({ version: EXAM_SEED_VERSION }); }
  catch (e) { console.warn('[exam seed meta]', e); }
}

function _examCatOrder(cat) {
  const i = EXAM_CATS.indexOf(cat);
  return i < 0 ? 99 : i;
}

function _setExamCat(cat) { _examCatFilter = cat; renderExam(); _scrollTop(); }
function _examFilter(v) { _examSearch = (v || '').trim().toLowerCase(); renderExam(); }
function _examToggle(id) {
  const opening = _examOpenId !== id;
  _examOpenId = opening ? id : null;
  _renderKeepingAnchor('exam-list', id, renderExam, opening);
}

function renderExam() {
  const list = document.getElementById('exam-list');
  const tabs = document.getElementById('exam-cat-tabs');
  const adminEl = document.getElementById('exam-admin-btns');
  if (!list) return;

  if (adminEl) adminEl.innerHTML = isAdmin
    ? '<button class="soap-add-btn" onclick="_openExamEdit(null)">+ 검사 추가</button>' : '';
  const toolsEl = document.getElementById('exam-tools');
  if (toolsEl) toolsEl.innerHTML = _refToolsHTML('exam', _examItems.filter(i => _isFav(i.id)).length);

  const usedCats = EXAM_CATS.filter(c => _examItems.some(i => i.category === c));
  if (tabs) {
    tabs.innerHTML = ['all'].concat(usedCats).map(c =>
      `<button class="soap-cat-tab${_examCatFilter === c ? ' active' : ''}" onclick="_setExamCat('${c}')">${c === 'all' ? '전체' : c}</button>`
    ).join('');
  }

  let items = _examItems.slice();
  if (_favOnly.exam) items = items.filter(i => _isFav(i.id));
  if (_examCatFilter !== 'all') items = items.filter(i => i.category === _examCatFilter);
  if (_examSearch) items = items.filter(i =>
    (i.title || '').toLowerCase().includes(_examSearch) ||
    (EXAM_FIELDS.map(([k]) => i[k] || '').join(' ') + ' ' + (i.source || '')).toLowerCase().includes(_examSearch));

  items.sort((a, b) =>
    _examCatOrder(a.category) - _examCatOrder(b.category) ||
    (a.order || 0) - (b.order || 0) ||
    (a.title || '').localeCompare(b.title || ''));

  if (!items.length) {
    list.innerHTML = _examLoadError
      ? `<div class="empty" style="padding:2.5rem 1.5rem;text-align:center;color:var(--text-muted);line-height:1.8">
           <div style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:0.5rem">임상검사 자료를 불러오지 못했습니다</div>
           ${_esc(_examLoadError)}<br>네트워크 또는 캐시 문제일 수 있습니다.<br>
           <button class="soap-add-btn" style="margin-top:0.9rem" onclick="_soapHardReload()">캐시 지우고 다시 불러오기</button>
         </div>`
      : '<div class="empty" style="padding:2.5rem;text-align:center;color:var(--text-muted)">항목이 없습니다.</div>';
    return;
  }

  let html = '', lastCat = null;
  items.forEach(it => {
    if (it.category !== lastCat && _examCatFilter === 'all') {
      html += `<div class="soap-cat-label">${_esc(it.category || '')}</div>`;
      lastCat = it.category;
    }
    const open = _printAll() || _examOpenId === it.id;
    const editBtn = isAdmin
      ? `<button class="soap-edit-btn" onclick="event.stopPropagation();_openExamEdit('${it.id}')">✏️</button>` : '';
    const body = open
      ? `<div class="soap-body">${EXAM_FIELDS.map(([k, label, sub]) => _examBlock(label, sub, it[k])).join('')}${_sourceHTML(it.source)}</div>`
      : '';
    html += `<div class="soap-card exam-card${open ? ' open' : ''}">
      <div class="soap-card-head" data-ref-id="${it.id}" onclick="_examToggle('${it.id}')">
        <span class="soap-cat-badge">${_esc(it.category || '')}</span>
        <span class="soap-card-title">${_esc(it.title || '')}</span>
        ${_favBtn('exam', it.id)}
        ${editBtn}
        <span class="soap-chevron">${open ? '▲' : '▼'}</span>
      </div>
      ${body}
    </div>`;
  });
  list.innerHTML = html;
  _injectCopyButtons(list);
}

const _EXAM_KEY = { '목적': 'purpose', '술기': 'tech', '기준': 'crit', '해석': 'interp', '함정': 'pit' };

function _examBlock(label, sub, md) {
  if (!md || !String(md).trim()) return '';
  let body;
  try { body = marked.parse(String(md)); }
  catch (e) { console.warn('[exam] 마크다운 파싱 실패', label, e); body = _esc(String(md)).replace(/\n/g, '<br>'); }
  const key = _EXAM_KEY[label] || 'purpose';
  return `<div class="soap-sec exam-sec-${key}">
    <div class="soap-sec-label"><span class="soap-sec-letter exam-letter">${label}</span>${sub}</div>
    <div class="soap-sec-body markdown-body">${body}</div>
  </div>`;
}

function _openExamEdit(id) {
  if (!isAdmin) return;
  const it = id ? _examItems.find(x => x.id === id) : null;
  const fv = (k, d = '') => it ? (it[k] != null ? it[k] : d) : d;
  const catOpts = EXAM_CATS.map(c => `<option value="${c}"${fv('category', EXAM_CATS[0]) === c ? ' selected' : ''}>${c}</option>`).join('');
  const ta = (id2, label, val) =>
    `<label class="soap-f-label">${label}<textarea id="${id2}" class="soap-f-ta">${_esc(val)}</textarea></label>`;
  const html = `<div id="exam-edit-overlay" class="modal-overlay open" onclick="if(event.target.id==='exam-edit-overlay')_closeExamEdit()">
    <div class="modal soap-edit-modal">
      <button class="modal-close" onclick="_closeExamEdit()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 1rem">${it ? '검사 편집' : '새 검사'}</h3>
        <div class="soap-f-row">
          <label class="soap-f-label" style="flex:2">검사명<input id="exam-f-title" class="soap-f-input" value="${_esc(fv('title'))}" placeholder="예: 치주 탐침 — PD · CAL · BOP"></label>
          <label class="soap-f-label" style="flex:1">분류<select id="exam-f-cat" class="soap-f-input">${catOpts}</select></label>
          <label class="soap-f-label" style="width:5rem">순서<input id="exam-f-order" type="number" class="soap-f-input" value="${fv('order', 0)}"></label>
        </div>
        <p class="soap-f-hint">각 칸은 마크다운 지원 (- 목록, **굵게**, tip/warning/danger 박스, dl 정의목록 등).</p>
        ${ta('exam-f-purpose', '목적 — 무엇을 알아내는가', fv('purpose'))}
        ${ta('exam-f-technique', '술기 — 어떻게 하는가 (힘·시간·각도 등 조건 포함)', fv('technique'))}
        ${ta('exam-f-criteria', '기준 — 정상치·판정 기준', fv('criteria'))}
        ${ta('exam-f-interpretation', '해석 — 무엇을 의미하는가', fv('interpretation'))}
        ${ta('exam-f-pitfalls', '함정 — 값을 틀리게 만드는 것', fv('pitfalls'))}
        <label class="soap-f-label">출처 — 참고 교과서<input id="exam-f-source" class="soap-f-input" value="${_esc(fv('source'))}" placeholder="예: Newman & Carranza's Clinical Periodontology"></label>
        <div class="soap-f-btns">
          ${it ? `<button class="card-admin-btn del" onclick="_deleteExam('${id}')">🗑 삭제</button>` : ''}
          <button class="cal-cancel-btn" onclick="_closeExamEdit()">취소</button>
          <button class="cal-save-btn" onclick="_saveExam('${id || ''}')">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _closeExamEdit() {
  document.getElementById('exam-edit-overlay')?.remove();
}

async function _saveExam(id) {
  if (!isAdmin) return;
  const g = s => document.getElementById(s)?.value ?? '';
  const title = g('exam-f-title').trim();
  if (!title) { _edToast('검사명을 입력하세요.', 'error'); return; }
  const data = {
    title,
    category: g('exam-f-cat') || EXAM_CATS[0],
    order: Number(g('exam-f-order')) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  EXAM_FIELDS.forEach(([k]) => { data[k] = g('exam-f-' + k).trim(); });
  data.source = g('exam-f-source').trim();
  if (!id) data.userCreated = true; // 관리자가 새로 만든 항목은 재시드 시 보존
  const docId = id || _examDocId(title);
  try {
    await db.collection('examTemplates').doc(docId).set(data, { merge: true });
    const idx = _examItems.findIndex(x => x.id === docId);
    if (idx >= 0) _examItems[idx] = { ...(_examItems[idx]), id: docId, ...data };
    else _examItems.push({ id: docId, ...data });
    _closeExamEdit();
    renderExam();
    _edToast('저장되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'examTemplates'), 'error');
  }
}

async function _deleteExam(id) {
  if (!confirm('이 검사 항목을 삭제하시겠습니까?')) return;
  try {
    await db.collection('examTemplates').doc(id).delete();
    _examItems = _examItems.filter(x => x.id !== id);
    if (_examOpenId === id) _examOpenId = null;
    _closeExamEdit();
    renderExam();
    _edToast('삭제되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'examTemplates'), 'error');
  }
}

// ── SOAP ↔ 임상검사 연결 ─────────────────────────────────────
// O에 적을 값을 만드는 술기는 임상검사 탭에 있으므로, 항목에서 바로 건너갈 수 있어야 한다.
const SOAP_RELATED_EXAM = {
  '고정성':   ['치주 탐침 — PD · CAL · BOP', '치수 생활력 검사 (Cold · EPT)', '균열치 · 수직치근파절 검사 (Crack · VRF)',
               'Ferrule · 잔존 치질 계측', '변연 · 내면 적합 검사', '인접 접촉 검사 (Proximal contact)', '교합 접촉 검사 (교합지 · shimstock)', '색조 채득 (Shade taking)'],
  '국소의치': ['치주 탐침 — PD · CAL · BOP', '동요도 · 근분지부 검사 (Mobility · Furcation)',
               '치은 표현형 및 각화치은 폭 평가', '의치 적합 검사 (PIP · Disclosing wax)',
               '지지영역·완화부 확인 (무치악)', '교합 접촉 검사 (교합지 · shimstock)', '수직고경 계측 (VDO · VDR · FWS)'],
  '총의치':   ['무치악 치조제 형태·흡수도 평가', '지지영역·완화부 확인 (무치악)', '가동 치조제(flabby ridge) 평가',
               '구개 형태 및 후방 봉쇄 영역 평가', '전정 깊이·소대 부착 평가', '혀 크기·위치 평가', '구역반사 평가',
               '기존 의치 평가', '무치악 난이도 분류 및 적응 유형',
               '의치 유지·안정·지지 평가', '의치 적합 검사 (PIP · Disclosing wax)',
               '수직고경 계측 (VDO · VDR · FWS)', '중심위 유도 및 CR–MIP 편위 계측', '교합 접촉 검사 (교합지 · shimstock)'],
  '임플란트': ['임플란트 주위 탐침 및 변연골 판독', '골유착 평가 (타진 · 동요 · ISQ)',
               '변연 · 내면 적합 검사', '인접 접촉 검사 (Proximal contact)', '교합 접촉 검사 (교합지 · shimstock)'],
  '임시의치': ['의치 적합 검사 (PIP · Disclosing wax)', '교합 접촉 검사 (교합지 · shimstock)',
               '무치악 치조제 형태·흡수도 평가', '지지영역·완화부 확인 (무치악)'],
  '심미':     ['색조 채득 (Shade taking)', '규격 사진 · 방사선 촬영과 판독', 'Bone sounding (골 탐침)'],
  '기타':     ['개구량 · 하악 운동 계측', '관절음 · 관절 촉진', '저작근 촉진',
               '중심위 유도 및 CR–MIP 편위 계측', '수직고경 계측 (VDO · VDR · FWS)', '편심 운동 검사 (Excursive movements)'],
};

// 항목별로 더 정확한 연결이 필요한 경우의 예외표 (분류 기본값보다 우선한다)
const SOAP_RELATED_EXAM_BY_TITLE = {
  '기타 7-1 · 초진 상담 및 전신 위험도 평가': [
    '활력징후 측정 및 ASA 판정', '항응고·항혈소판제 복용 평가',
    '골흡수억제제 복용력 및 MRONJ 위험 평가', '당뇨 조절 상태 평가 (HbA1c)',
    '전신질환의 구강 발현 스크리닝'],
  '기타 7-6 · 전신질환·복약 환자의 침습 처치 전 평가': [
    '활력징후 측정 및 ASA 판정', '항응고·항혈소판제 복용 평가',
    '골흡수억제제 복용력 및 MRONJ 위험 평가',
    '감염성 심내막염 예방적 항생제 적응증 확인', '당뇨 조절 상태 평가 (HbA1c)',
    '두경부 방사선치료 병력 및 ORN 위험 평가', '전신질환의 구강 발현 스크리닝'],
};

function _relatedExamHTML(category, title) {
  const titles = SOAP_RELATED_EXAM_BY_TITLE[title] || SOAP_RELATED_EXAM[category] || [];
  if (!titles.length) return '';
  const chips = titles.map(t => {
    const id = _examDocId(t);
    return `<button class="ref-chip" onclick="event.stopPropagation();_openRef('exam','${id}')">${_esc(t)}</button>`;
  }).join('');
  return `<div class="ref-links">
    <span class="ref-links-label">🔬 관련 임상검사</span>
    <div class="ref-chips">${chips}</div>
  </div>`;
}

// ── 기공지시서 (Lab prescription) ────────────────────────────
// "무엇을 결정해서 어떻게 적는가" — 기공소에 설계 의도를 전달하는 법.
// 로컬 시드를 기본값으로, Firestore(labTemplates)를 그 위에 덮어써 관리자 편집을 반영.
let _labItems = [];
let _labCatFilter = 'all';
let _labSearch = '';
let _labOpenId = null;
let _labLoadError = '';

const LAB_FIELDS = [
  ['purpose',   '목적', 'Purpose 이 지시서가 결정하는 것'],
  ['decide',    '결정', 'Decision 무엇을 고르고 왜 그렇게 적는가'],
  ['required',  '필수', 'Required 빠지면 제작이 멈추는 항목'],
  ['enclosure', '동봉', 'Enclosure 함께 보내는 자료'],
  ['pitfalls',  '함정', 'Pitfalls 자주 나는 사고와 원인'],
];

function _labDocId(title) {
  return 'lab-' + title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 60);
}

async function _loadLab() {
  if (typeof LAB_SEED === 'undefined' || !Array.isArray(LAB_SEED) || !LAB_SEED.length) {
    console.error('[lab] LAB_SEED 로드 실패 — js/lab-seed.js 확인 필요');
    _labItems = [];
    _labLoadError = '기공지시서 자료 파일을 불러오지 못했습니다.';
    renderLab();
    return;
  }
  _labLoadError = '';
  const base = LAB_SEED.map(t => ({ id: _labDocId(t.title), ...t, seed: true }));
  const newIds = new Set(base.map(b => b.id));
  try {
    const [snap, metaSnap] = await Promise.all([
      db.collection('labTemplates').get(),
      db.collection('appMeta').doc('labSeed').get().catch(() => null)
    ]);
    const ver = (metaSnap && metaSnap.exists) ? (metaSnap.data().version || 0) : 0;

    if (isAdmin && (snap.empty || ver < LAB_SEED_VERSION)) {
      try { await _seedLab(snap); } catch (e) { console.warn('[lab reseed]', e); }
      const s2 = await db.collection('labTemplates').get().catch(() => null);
      _labItems = s2 && !s2.empty ? s2.docs.map(d => ({ id: d.id, ...d.data() })) : base;
    } else if (!snap.empty) {
      const byId = {};
      base.forEach(it => { byId[it.id] = it; });
      snap.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
      _labItems = Object.values(byId).filter(it => it.userCreated || newIds.has(it.id));
    } else {
      _labItems = base;
    }
  } catch (e) {
    console.warn('[lab load]', e);
    _labItems = base;
  }
  if (!_labItems.length) _labItems = base;
  renderLab();
}

// 시드 항목을 최신 LAB_SEED로 교체. 관리자가 만든 항목(userCreated)은 보존.
async function _seedLab(existingSnap) {
  const ops = [];
  const newIds = new Set(LAB_SEED.map(t => _labDocId(t.title)));
  if (existingSnap) {
    existingSnap.forEach(d => {
      const data = d.data() || {};
      if (!data.userCreated && !newIds.has(d.id)) ops.push({ type: 'del', ref: d.ref });
    });
  }
  LAB_SEED.forEach(t => ops.push({ type: 'set', ref: db.collection('labTemplates').doc(_labDocId(t.title)), data: { ...t, seed: true } }));
  await _commitOps(ops);
  try { await db.collection('appMeta').doc('labSeed').set({ version: LAB_SEED_VERSION }); }
  catch (e) { console.warn('[lab seed meta]', e); }
}

function _labCatOrder(cat) {
  const i = LAB_CATS.indexOf(cat);
  return i < 0 ? 99 : i;
}

function _setLabCat(cat) { _labCatFilter = cat; renderLab(); _scrollTop(); }
function _labFilter(v) { _labSearch = (v || '').trim().toLowerCase(); renderLab(); }
function _labToggle(id) {
  const opening = _labOpenId !== id;
  _labOpenId = opening ? id : null;
  _renderKeepingAnchor('lab-list', id, renderLab, opening);
}

function renderLab() {
  const list = document.getElementById('lab-list');
  const tabs = document.getElementById('lab-cat-tabs');
  const adminEl = document.getElementById('lab-admin-btns');
  if (!list) return;

  if (adminEl) adminEl.innerHTML = isAdmin
    ? '<button class="soap-add-btn" onclick="_openLabEdit(null)">+ 항목 추가</button>' : '';
  const toolsEl = document.getElementById('lab-tools');
  if (toolsEl) toolsEl.innerHTML = _refToolsHTML('lab', _labItems.filter(i => _isFav(i.id)).length);

  const usedCats = LAB_CATS.filter(c => _labItems.some(i => i.category === c));
  if (tabs) {
    tabs.innerHTML = ['all'].concat(usedCats).map(c =>
      `<button class="soap-cat-tab${_labCatFilter === c ? ' active' : ''}" onclick="_setLabCat('${c}')">${c === 'all' ? '전체' : c}</button>`
    ).join('');
  }

  let items = _labItems.slice();
  if (_favOnly.lab) items = items.filter(i => _isFav(i.id));
  if (_labCatFilter !== 'all') items = items.filter(i => i.category === _labCatFilter);
  if (_labSearch) items = items.filter(i =>
    (i.title || '').toLowerCase().includes(_labSearch) ||
    (LAB_FIELDS.map(([k]) => i[k] || '').join(' ') + ' ' + (i.example || '') + ' ' + (i.source || '')).toLowerCase().includes(_labSearch));

  items.sort((a, b) =>
    _labCatOrder(a.category) - _labCatOrder(b.category) ||
    (a.order || 0) - (b.order || 0) ||
    (a.title || '').localeCompare(b.title || ''));

  if (!items.length) {
    list.innerHTML = _labLoadError
      ? `<div class="empty" style="padding:2.5rem 1.5rem;text-align:center;color:var(--text-muted);line-height:1.8">
           <div style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:0.5rem">기공지시서 자료를 불러오지 못했습니다</div>
           ${_esc(_labLoadError)}<br>네트워크 또는 캐시 문제일 수 있습니다.<br>
           <button class="soap-add-btn" style="margin-top:0.9rem" onclick="_soapHardReload()">캐시 지우고 다시 불러오기</button>
         </div>`
      : '<div class="empty" style="padding:2.5rem;text-align:center;color:var(--text-muted)">항목이 없습니다.</div>';
    return;
  }

  let html = '', lastCat = null;
  items.forEach(it => {
    if (it.category !== lastCat && _labCatFilter === 'all') {
      html += `<div class="soap-cat-label">${_esc(it.category || '')}</div>`;
      lastCat = it.category;
    }
    const open = _printAll() || _labOpenId === it.id;
    const editBtn = isAdmin
      ? `<button class="soap-edit-btn" onclick="event.stopPropagation();_openLabEdit('${it.id}')">✏️</button>` : '';
    const body = open
      ? `<div class="soap-body">${LAB_FIELDS.map(([k, label, sub]) => _labBlock(label, sub, it[k])).join('')}${_labExampleHTML(it.example, it.id)}${_relatedSoapHTML(it.title)}${_sourceHTML(it.source)}</div>`
      : '';
    html += `<div class="soap-card lab-card${open ? ' open' : ''}">
      <div class="soap-card-head" data-ref-id="${it.id}" onclick="_labToggle('${it.id}')">
        <span class="soap-cat-badge">${_esc(it.category || '')}</span>
        <span class="soap-card-title">${_esc(it.title || '')}</span>
        ${_favBtn('lab', it.id)}
        ${editBtn}
        <span class="soap-chevron">${open ? '▲' : '▼'}</span>
      </div>
      ${body}
    </div>`;
  });
  list.innerHTML = html;
  _injectCopyButtons(list);
}

const _LAB_KEY = { '목적': 'purpose', '결정': 'decide', '필수': 'req', '동봉': 'encl', '함정': 'pit' };

function _labBlock(label, sub, md) {
  if (!md || !String(md).trim()) return '';
  let body;
  try { body = marked.parse(String(md)); }
  catch (e) { console.warn('[lab] 마크다운 파싱 실패', label, e); body = _esc(String(md)).replace(/\n/g, '<br>'); }
  const key = _LAB_KEY[label] || 'purpose';
  return `<div class="soap-sec lab-sec-${key}">
    <div class="soap-sec-label"><span class="soap-sec-letter lab-letter">${label}</span>${sub}</div>
    <div class="soap-sec-body markdown-body">${body}</div>
  </div>`;
}

// 예문은 그대로 복사해 지시서에 붙여 쓰는 것이 용도라 서식을 보존한다.
function _labExampleHTML(text, id) {
  if (!text || !String(text).trim()) return '';
  return `<div class="soap-sec lab-sec-eg">
    <div class="soap-sec-label"><span class="soap-sec-letter lab-letter">예문</span>Example 복사해 고쳐 쓰는 문안</div>
    <div class="lab-example"><b>지시서 예문</b>${_esc(String(text))}</div>
    <button class="ref-chip lab-build-btn" onclick="event.stopPropagation();_openLabBuilder('${id}')">🧾 이 예문으로 지시서 만들기</button>
  </div>`;
}

function _openLabEdit(id) {
  if (!isAdmin) return;
  const it = id ? _labItems.find(x => x.id === id) : null;
  const fv = (k, d = '') => it ? (it[k] != null ? it[k] : d) : d;
  const catOpts = LAB_CATS.map(c => `<option value="${c}"${fv('category', LAB_CATS[0]) === c ? ' selected' : ''}>${c}</option>`).join('');
  const ta = (id2, label, val) =>
    `<label class="soap-f-label">${label}<textarea id="${id2}" class="soap-f-ta">${_esc(val)}</textarea></label>`;
  const html = `<div id="lab-edit-overlay" class="modal-overlay open" onclick="if(event.target.id==='lab-edit-overlay')_closeLabEdit()">
    <div class="modal soap-edit-modal">
      <button class="modal-close" onclick="_closeLabEdit()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 1rem">${it ? '기공지시서 항목 편집' : '새 기공지시서 항목'}</h3>
        <div class="soap-f-row">
          <label class="soap-f-label" style="flex:2">항목명<input id="lab-f-title" class="soap-f-input" value="${_esc(fv('title'))}" placeholder="예: 단관 — 모놀리식 지르코니아"></label>
          <label class="soap-f-label" style="flex:1">분류<select id="lab-f-cat" class="soap-f-input">${catOpts}</select></label>
          <label class="soap-f-label" style="width:5rem">순서<input id="lab-f-order" type="number" class="soap-f-input" value="${fv('order', 0)}"></label>
        </div>
        <p class="soap-f-hint">각 칸은 마크다운 지원 (- 목록, **굵게**, tip/warning/danger 박스, dl 정의목록 등). 예문 칸은 서식이 그대로 보존됩니다.</p>
        ${ta('lab-f-purpose', '목적 — 이 지시서가 결정하는 것', fv('purpose'))}
        ${ta('lab-f-decide', '결정 — 무엇을 고르고 왜 그렇게 적는가', fv('decide'))}
        ${ta('lab-f-required', '필수 — 빠지면 제작이 멈추는 항목', fv('required'))}
        ${ta('lab-f-enclosure', '동봉 — 함께 보내는 자료', fv('enclosure'))}
        ${ta('lab-f-pitfalls', '함정 — 자주 나는 사고와 원인', fv('pitfalls'))}
        ${ta('lab-f-example', '예문 — 복사해 고쳐 쓰는 문안 (마크다운 아님, 서식 보존)', fv('example'))}
        <label class="soap-f-label">출처 — 참고 교과서·법령<input id="lab-f-source" class="soap-f-input" value="${_esc(fv('source'))}" placeholder="예: Shillingburg, Fundamentals of Fixed Prosthodontics"></label>
        <div class="soap-f-btns">
          ${it ? `<button class="card-admin-btn del" onclick="_deleteLab('${id}')">🗑 삭제</button>` : ''}
          <button class="cal-cancel-btn" onclick="_closeLabEdit()">취소</button>
          <button class="cal-save-btn" onclick="_saveLab('${id || ''}')">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _closeLabEdit() {
  document.getElementById('lab-edit-overlay')?.remove();
}

async function _saveLab(id) {
  if (!isAdmin) return;
  const g = s => document.getElementById(s)?.value ?? '';
  const title = g('lab-f-title').trim();
  if (!title) { _edToast('항목명을 입력하세요.', 'error'); return; }
  const data = {
    title,
    category: g('lab-f-cat') || LAB_CATS[0],
    order: Number(g('lab-f-order')) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  LAB_FIELDS.forEach(([k]) => { data[k] = g('lab-f-' + k).trim(); });
  data.example = g('lab-f-example').trim();
  data.source = g('lab-f-source').trim();
  if (!id) data.userCreated = true; // 관리자가 새로 만든 항목은 재시드 시 보존
  const docId = id || _labDocId(title);
  try {
    await db.collection('labTemplates').doc(docId).set(data, { merge: true });
    const idx = _labItems.findIndex(x => x.id === docId);
    if (idx >= 0) _labItems[idx] = { ...(_labItems[idx]), id: docId, ...data };
    else _labItems.push({ id: docId, ...data });
    _closeLabEdit();
    renderLab();
    _edToast('저장되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'labTemplates'), 'error');
  }
}

async function _deleteLab(id) {
  if (!confirm('이 기공지시서 항목을 삭제하시겠습니까?')) return;
  try {
    await db.collection('labTemplates').doc(id).delete();
    _labItems = _labItems.filter(x => x.id !== id);
    if (_labOpenId === id) _labOpenId = null;
    _closeLabEdit();
    renderLab();
    _edToast('삭제되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'labTemplates'), 'error');
  }
}

// ── SOAP ↔ 기공지시서 연결 ───────────────────────────────────
// 진료 단계에서 기공소로 무엇을 넘겨야 하는지는 SOAP 옆에 붙어 있어야 쓸모가 있다.
// SOAP 항목 제목 → 기공지시서 항목 제목 (양방향으로 쓴다)
const SOAP_RELATED_LAB = {
  '고정성 1-1 · 진단 및 치료계획': ['진단 wax-up·시적용 모형', '기공지시서는 무엇을 결정하는 문서인가'],
  '고정성 1-2 · 지대치 형성 (Tooth Preparation)': ['변연과 적합을 지시하는 법', '모호한 말을 수치로 바꾸는 법'],
  '고정성 1-3 · 임시보철 (Provisional Restoration)': ['임시 고정성 보철 — 기공소 제작(장기 임시)'],
  '고정성 1-4 · 정밀인상 및 악간관계 채득': ['인상·스캔·디지털 파일을 지시하는 법', '교합을 지시하는 법', '색조를 지시하는 법'],
  '고정성 1-5 · 시적 (Framework / Bisque Try-in)': ['단관 — 금속도재(PFM)', '단관 — 모놀리식 지르코니아', '가공의치(FPD) — pontic 설계 지시'],
  '고정성 1-6 · 최종 접착 및 장착 (Cementation)': ['단관 — 리튬디실리케이트', '인레이·온레이'],
  '고정성 1-7 · Post & Core (실활치 수복)': ['주조 post & core'],
  '고정성 1-8 · 치관연장술 / 교정적 정출 협진': ['주조 post & core', '변연과 적합을 지시하는 법'],
  '고정성 1-9 · 보철물 탈락·파절 응급 처치': ['재제작·수정 의뢰서 쓰는 법', '접착 브릿지(resin-bonded FDP)'],
  'RPD 2-1 · 진단·서베잉·설계': ['RPD 진단·서베잉 의뢰 — 설계를 확정하기 전에'],
  'RPD 2-2 · 구강 형성 (Mouth Preparation)': ['RPD 금속구조물(framework) 설계 지시', '이중관(telescopic) 보철 의뢰'],
  'RPD 2-3 · 정밀인상 (Final Impression)': ['RPD 이차 인상(altered cast) 의뢰'],
  'RPD 2-4 · 금속 주조체 시적 (Framework Try-in)': ['RPD 금속구조물(framework) 설계 지시'],
  'RPD 2-5 · 악간관계 채득 및 인공치 선택': ['RPD 인공치 배열·온성 지시'],
  'RPD 2-6 · 납의치 시적 (Wax Try-in)': ['RPD 인공치 배열·온성 지시'],
  'RPD 2-7 · 의치 장착 및 초기 조정': ['RPD 인공치 배열·온성 지시'],
  'RPD 2-8 · 사후관리 — 이장·수리·재평가': ['RPD 수리·첨상·이장 의뢰'],
  'CD 3-1 · 진단 및 예비인상': ['총의치 — 개인 트레이(custom tray) 제작 지시'],
  'CD 3-2 · 정밀인상 (Final Impression)': ['총의치 — 개인 트레이(custom tray) 제작 지시', '총의치 — 후방 봉쇄(post-dam)와 의치상 외형 지시'],
  'CD 3-3 · 악간관계 채득 (Jaw Relation Record)': ['총의치 — record base·occlusal rim 지시'],
  'CD 3-4 · 납의치 시적 (Wax Try-in)': ['총의치 — 인공치 선택·배열 지시', '단일 총의치 — 대합이 자연치·RPD일 때'],
  'CD 3-5 · 의치 장착 (Insertion)': ['총의치 — 온성·remount 지시'],
  'CD 3-6 · 장착 후 조정 (Post-insertion)': ['총의치 — 온성·remount 지시'],
  'CD 3-7 · 유지관리 — 이장·재제작·의치성 구내염': ['총의치 — 이장·개상·수리 의뢰', '조직조정·치료용 의치 의뢰', '총의치 — 디지털(밀링·프린팅) 제작 지시'],
  '임플란트 4-1 · 보철 주도 치료계획': ['임플란트 서지컬 가이드 의뢰', '진단 wax-up·시적용 모형'],
  '임플란트 4-2 · 2차 수술 및 연조직 형성': ['임플란트 임시보철 — 연조직 형태를 만드는 지시'],
  '임플란트 4-3 · 인상 채득': ['임플란트 인상·스캔 자료 전달 지시'],
  '임플란트 4-4 · Abutment & Crown 시적': ['임플란트 단관 — 어버트먼트 선택을 지시서에 적는 법', '임플란트 다수 유닛·브리지 — passive fit 지시', '임플란트 전악 고정성 보철 — 재료와 공간 지시'],
  '임플란트 4-5 · 최종 장착 및 유지관리 이관': ['임플란트 단관 — 어버트먼트 선택을 지시서에 적는 법'],
  '임플란트 4-6 · 임플란트 오버덴처 (IOD)': ['임플란트 오버덴처 — 어태치먼트 선택 지시'],
  '임플란트 4-7 · 유지관리 및 임플란트 주위 질환': ['임플란트 보철 유지관리·수리 의뢰'],
  '임시의치 5-1 · 임시 국소의치 (Interim RPD)': ['RPD 수리·첨상·이장 의뢰'],
  '임시의치 5-2 · 즉시의치 (Immediate Denture)': ['즉시의치(immediate denture) 의뢰'],
  '임시의치 5-3 · 조직 조정 (Tissue Conditioning)': ['조직조정·치료용 의치 의뢰'],
  '심미 6-1 · 심미 진단 및 디자인': ['진단 wax-up·시적용 모형', '단일 전치 수복 — 색을 맞추기 가장 어려운 증례'],
  '심미 6-2 · 라미네이트 베니어 — 형성 및 인상': ['라미네이트 베니어'],
  '심미 6-3 · 라미네이트 베니어 — 시적 및 접착': ['라미네이트 베니어', '단일 전치 수복 — 색을 맞추기 가장 어려운 증례'],
  '기타 7-2 · 교합안정장치 (Occlusal Splint)': ['교합안정장치(스플린트)', '수면무호흡 구강내장치(MAD) 의뢰', '스포츠 마우스가드 의뢰'],
  '기타 7-4 · 교합 재구성 진단 (VDO · 전악 재수복)': ['교합을 지시하는 법', '진단 wax-up·시적용 모형', '임시 고정성 보철 — 기공소 제작(장기 임시)'],
  '기타 7-5 · 보철 정기 리콜 및 유지관리': ['재제작·수정 의뢰서 쓰는 법', '기공물 소독·운송·보관 — 지시서에 함께 적는 것'],
};

// 기공지시서 → SOAP 역방향 (위 표를 뒤집어 만든다)
let _labToSoap = null;
function _labRelatedSoapTitles(labTitle) {
  if (!_labToSoap) {
    _labToSoap = {};
    Object.entries(SOAP_RELATED_LAB).forEach(([soapTitle, labs]) =>
      labs.forEach(l => (_labToSoap[l] = _labToSoap[l] || []).push(soapTitle)));
  }
  return _labToSoap[labTitle] || [];
}

function _relatedLabHTML(soapTitle) {
  const titles = SOAP_RELATED_LAB[soapTitle] || [];
  if (!titles.length) return '';
  const chips = titles.map(t =>
    `<button class="ref-chip" onclick="event.stopPropagation();_openRef('lab','${_labDocId(t)}')">${_esc(t)}</button>`).join('');
  return `<div class="ref-links ref-links-lab">
    <span class="ref-links-label">🧾 기공지시서 작성</span>
    <div class="ref-chips">${chips}</div>
  </div>`;
}

function _relatedSoapHTML(labTitle) {
  const titles = _labRelatedSoapTitles(labTitle);
  if (!titles.length) return '';
  const chips = titles.map(t =>
    `<button class="ref-chip" onclick="event.stopPropagation();_openRef('soap','${_soapDocId(t)}')">${_esc(t)}</button>`).join('');
  return `<div class="ref-links ref-links-soap">
    <span class="ref-links-label">📝 관련 진료 단계 (SOAP)</span>
    <div class="ref-chips">${chips}</div>
  </div>`;
}

// ── 차팅 예문 복사 ───────────────────────────────────────────
// 예문은 EMR에 붙여넣어 쓰는 것이 실제 용도라 한 번에 복사되어야 한다.
function _injectCopyButtons(root) {
  _wrapTables(root);
  (root || document).querySelectorAll('.chart-eg, .term-example, .lab-example').forEach(el => {
    if (el.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.title = '예문 복사';
    btn.textContent = '복사';
    btn.onclick = e => { e.stopPropagation(); _copyExample(el, btn); };
    el.appendChild(btn);
  });
}

// 마크다운 표는 좁은 화면에서 컨테이너를 넘어 잘린다. 가로 스크롤 상자로 감싼다.
function _wrapTables(root) {
  (root || document).querySelectorAll('.markdown-body table, .soap-sec-body table').forEach(t => {
    if (t.parentElement?.classList.contains('table-scroll')) return;
    const box = document.createElement('div');
    box.className = 'table-scroll';
    t.parentNode.insertBefore(box, t);
    box.appendChild(t);
  });
}

async function _copyExample(el, btn) {
  // 라벨(차팅 예시)과 버튼 텍스트를 제외한 본문만
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.copy-btn, b').forEach(n => n.remove());
  const text = clone.innerText.replace(/\n{3,}/g, '\n\n').trim();
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) { console.warn('[copy]', e2); }
    ta.remove();
  }
  btn.textContent = '복사됨';
  btn.classList.add('done');
  setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('done'); }, 1400);
}

// ── 즐겨찾기 · 인쇄 · 개정 이력 (참고자료 공통) ───────────────
// 항목 id 는 kind 접두사(soap-/exam-/term-/lab-)가 있어 한 저장소로 충분하다.
const FAV_KEY = 'dental-ref-favs';
let _favs = new Set();
try { _favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (e) { /* 손상 시 무시 */ }
let _favOnly = { soap: false, exam: false, term: false, lab: false, tip: false };

function _isFav(id) { return _favs.has(id); }

function _toggleFav(kind, id) {
  _favs.has(id) ? _favs.delete(id) : _favs.add(id);
  try { localStorage.setItem(FAV_KEY, JSON.stringify([..._favs])); } catch (e) { console.warn('[fav]', e); }
  ({ soap: renderSOAP, exam: renderExam, term: renderTerm, lab: renderLab, tip: renderTip })[kind]?.();
}

function _favBtn(kind, id) {
  const on = _isFav(id);
  return `<button class="fav-btn${on ? ' on' : ''}" title="${on ? '즐겨찾기 해제' : '즐겨찾기'}"
    onclick="event.stopPropagation();_toggleFav('${kind}','${id}')">${on ? '★' : '☆'}</button>`;
}

function _setFavOnly(kind, v) {
  _favOnly[kind] = v;
  ({ soap: renderSOAP, exam: renderExam, term: renderTerm, lab: renderLab, tip: renderTip })[kind]?.();
}

// 탭 상단 도구 막대 — 즐겨찾기 필터 · 인쇄 · 개정 이력
function _refToolsHTML(kind, favCount) {
  const on = _favOnly[kind];
  return `
    <button class="ref-tool${on ? ' active' : ''}" onclick="_setFavOnly('${kind}',${!on})">★ 즐겨찾기${favCount ? ` <span class="ref-tool-n">${favCount}</span>` : ''}</button>
    <button class="ref-tool" onclick="_printRef('${kind}')" title="현재 보이는 목록을 인쇄">🖨 인쇄</button>
    <button class="ref-tool" onclick="_openChangelog()" title="참고자료 개정 이력">🕘 이력</button>
    ${kind === 'lab' ? '<button class="ref-tool primary" onclick="_openLabBuilder()" title="지시서 문안 만들기">🧾 지시서 만들기</button>' : ''}`;
}

// 현재 필터·검색 결과를 그대로, 모두 펼친 상태로 인쇄
function _printRef(kind) {
  const saved = {
    soapOpen: _soapOpenId, examOpen: _examOpenId, termOpen: _termOpenId, labOpen: _labOpenId, tipOpen: _tipOpenId,
    topics: new Set(_termOpenTopics),
  };
  document.body.classList.add('printing-ref', 'printing-' + kind);
  if (kind === 'term') {
    // 인쇄에서는 주제·항목을 모두 펼친다
    _termItems.forEach(i => _termOpenTopics.add(i.category + '|' + (i.topic || '기타')));
  }
  document.body.dataset.printAll = '1';
  ({ soap: renderSOAP, exam: renderExam, term: renderTerm, lab: renderLab, tip: renderTip })[kind]?.();

  const cleanup = () => {
    delete document.body.dataset.printAll;
    document.body.classList.remove('printing-ref', 'printing-' + kind);
    _soapOpenId = saved.soapOpen; _examOpenId = saved.examOpen; _termOpenId = saved.termOpen;
    _labOpenId = saved.labOpen; _tipOpenId = saved.tipOpen;
    _termOpenTopics = saved.topics;
    ({ soap: renderSOAP, exam: renderExam, term: renderTerm, lab: renderLab, tip: renderTip })[kind]?.();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => { window.print(); setTimeout(cleanup, 800); }, 120);
}

// 인쇄 모드에서는 전 항목을 펼친다
function _printAll() { return document.body.dataset.printAll === '1'; }

function _openChangelog() {
  const list = (typeof REF_CHANGELOG !== 'undefined' ? REF_CHANGELOG : []).map(c => `
    <div class="chg-entry">
      <div class="chg-head"><span class="chg-date">${_esc(c.date)}</span>${_esc(c.title)}</div>
      <ul>${c.items.map(i => `<li>${_esc(i)}</li>`).join('')}</ul>
    </div>`).join('') || '<p style="color:var(--text-muted)">기록된 이력이 없습니다.</p>';
  document.body.insertAdjacentHTML('beforeend', `
    <div id="chg-overlay" class="modal-overlay open" onclick="if(event.target.id==='chg-overlay')_closeChangelog()">
      <div class="modal soap-edit-modal">
        <button class="modal-close" onclick="_closeChangelog()">✕</button>
        <div class="modal-body">
          <h3 style="margin:0 0 0.3rem">참고자료 개정 이력</h3>
          <p class="soap-f-hint">SOAP · 임상검사 · 용어 · 기공지시서의 내용이 바뀐 기록입니다.</p>
          ${list}
        </div>
      </div>
    </div>`);
}
function _closeChangelog() { document.getElementById('chg-overlay')?.remove(); }

// 출처 표기 — 임상검사는 항목별, 용어는 분류별
const TERM_SOURCE = {
  '기술 어휘': "Neville, Oral and Maxillofacial Pathology / Burket's Oral Medicine",
  '판정 어휘': 'ADA·ACP Parameters of Care / 임상 기록 표준 관행',
  '구강내과': "Burket's Oral Medicine / Neville / Scully, Oral and Maxillofacial Medicine",
  '구강외과': 'Hupp·Peterson, Contemporary Oral and Maxillofacial Surgery / Fragiskos',
  '치아·수복물': "Sturdevant's Operative Dentistry / Shillingburg / Rosenstiel",
  '치수·치근단': "Cohen's Pathways of the Pulp / Ingle's Endodontics",
  '치주': "Newman & Carranza's Clinical Periodontology / Lindhe / 2017 World Workshop",
  '교정': 'Proffit, Contemporary Orthodontics',
  '교합·악관절': 'Okeson, Management of TMD and Occlusion / Dawson, Functional Occlusion / DC/TMD',
  '의치': "Zarb·Boucher, Prosthodontic Treatment for Edentulous Patients / McCracken's",
  '임플란트': 'Misch, Dental Implant Prosthetics / ITI Treatment Guide / 2017 World Workshop',
  '방사선': 'White & Pharoah, Oral Radiology',
};

function _sourceHTML(text) {
  if (!text) return '';
  return `<div class="ref-source"><span>📚 출처</span>${_esc(text)}</div>`;
}

// ── Firestore 공통 헬퍼 ──────────────────────────────────────
// 한 batch 는 500 쓰기가 상한이다. 시드 항목이 늘면(용어 331개 + 옛 문서 삭제)
// 한 번에 넘길 수 있으므로 나누어 커밋한다.
const FB_BATCH_LIMIT = 400;

async function _commitOps(ops) {
  for (let i = 0; i < ops.length; i += FB_BATCH_LIMIT) {
    const batch = db.batch();
    ops.slice(i, i + FB_BATCH_LIMIT).forEach(op =>
      op.type === 'set' ? batch.set(op.ref, op.data) : batch.delete(op.ref));
    await batch.commit();
  }
}

// 권한 오류는 원인이 코드가 아니라 보안 규칙이므로 그대로 알려준다
function _fbErrMsg(e, collection) {
  const code = String((e && (e.code || e.message)) || '');
  if (code.includes('permission-denied')) {
    return `저장 권한이 없습니다 — Firestore 보안 규칙에 '${collection}' 컬렉션 허용 규칙을 추가해야 합니다.`;
  }
  if (code.includes('unavailable') || code.includes('offline')) {
    return '네트워크에 연결되지 않아 저장하지 못했습니다.';
  }
  return '실패: ' + (e && e.message ? e.message : e);
}

// ── 임상 팁 (Clinical Tips) ──────────────────────────────────
// "무엇이 표준인가"가 아니라 "그래서 나는 어떻게 정했는가"를 남기는 탭.
// 로컬 시드를 기본값으로, Firestore(tipTemplates)를 그 위에 덮어써 편집을 반영.
let _tipItems = [];
let _tipCatFilter = 'all';
let _tipSearch = '';
let _tipOpenId = null;
let _tipLoadError = '';

const TIP_FIELDS = [
  ['situation', '상황', 'Context 언제 이 고민이 생기는가'],
  ['crossroad', '갈림길', 'Crossroad 무엇과 무엇 사이에서 갈리는가'],
  ['judgment',  '판단', 'Judgment 나는 어떻게 정하는가'],
  ['basis',     '근거', 'Basis 그 판단을 받치는 것'],
  ['memo',      '메모', 'Memo 덧붙임 · 남은 의문'],
];

function _tipDocId(title) {
  return 'tip-' + title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 60);
}

async function _loadTip() {
  if (typeof TIP_SEED === 'undefined' || !Array.isArray(TIP_SEED)) {
    console.error('[tip] TIP_SEED 로드 실패 — js/tip-seed.js 확인 필요');
    _tipItems = [];
    _tipLoadError = '임상 팁 자료 파일을 불러오지 못했습니다.';
    renderTip();
    return;
  }
  _tipLoadError = '';
  const base = TIP_SEED.map(t => ({ id: _tipDocId(t.title), ...t, seed: true }));
  const newIds = new Set(base.map(b => b.id));
  try {
    const [snap, metaSnap] = await Promise.all([
      db.collection('tipTemplates').get(),
      db.collection('appMeta').doc('tipSeed').get().catch(() => null)
    ]);
    const ver = (metaSnap && metaSnap.exists) ? (metaSnap.data().version || 0) : 0;

    if (isAdmin && (snap.empty || ver < TIP_SEED_VERSION)) {
      try { await _seedTip(snap); } catch (e) { console.warn('[tip reseed]', e); }
      const s2 = await db.collection('tipTemplates').get().catch(() => null);
      _tipItems = s2 && !s2.empty ? s2.docs.map(d => ({ id: d.id, ...d.data() })) : base;
    } else if (!snap.empty) {
      const byId = {};
      base.forEach(it => { byId[it.id] = it; });
      snap.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
      // 팁은 사용자가 만든 항목이 주인공이므로 시드에 없는 문서도 남긴다
      _tipItems = Object.values(byId);
    } else {
      _tipItems = base;
    }
  } catch (e) {
    console.warn('[tip load]', e);
    _tipItems = base;
  }
  if (!_tipItems.length) _tipItems = base;
  renderTip();
}

async function _seedTip(existingSnap) {
  const ops = [];
  TIP_SEED.forEach(t => ops.push({ type: 'set', ref: db.collection('tipTemplates').doc(_tipDocId(t.title)), data: { ...t, seed: true } }));
  await _commitOps(ops);
  try { await db.collection('appMeta').doc('tipSeed').set({ version: TIP_SEED_VERSION }); }
  catch (e) { console.warn('[tip seed meta]', e); }
}

function _tipCatOrder(cat) {
  const i = TIP_CATS.indexOf(cat);
  return i < 0 ? 99 : i;
}

function _setTipCat(cat) { _tipCatFilter = cat; renderTip(); _scrollTop(); }
function _tipFilter(v) { _tipSearch = (v || '').trim().toLowerCase(); renderTip(); }
function _tipToggle(id) {
  const opening = _tipOpenId !== id;
  _tipOpenId = opening ? id : null;
  _renderKeepingAnchor('tip-list', id, renderTip, opening);
}

function renderTip() {
  const list = document.getElementById('tip-list');
  const tabs = document.getElementById('tip-cat-tabs');
  const adminEl = document.getElementById('tip-admin-btns');
  if (!list) return;

  if (adminEl) adminEl.innerHTML = isAdmin
    ? '<button class="soap-add-btn" onclick="_openTipEdit(null)">+ 팁 추가</button>' : '';
  const toolsEl = document.getElementById('tip-tools');
  if (toolsEl) toolsEl.innerHTML = _refToolsHTML('tip', _tipItems.filter(i => _isFav(i.id)).length);

  const usedCats = TIP_CATS.filter(c => _tipItems.some(i => i.category === c));
  if (tabs) {
    tabs.innerHTML = ['all'].concat(usedCats).map(c =>
      `<button class="soap-cat-tab${_tipCatFilter === c ? ' active' : ''}" onclick="_setTipCat('${c}')">${c === 'all' ? '전체' : c}</button>`
    ).join('');
  }

  let items = _tipItems.slice();
  if (_favOnly.tip) items = items.filter(i => _isFav(i.id));
  if (_tipCatFilter !== 'all') items = items.filter(i => i.category === _tipCatFilter);
  if (_tipSearch) items = items.filter(i =>
    (i.title || '').toLowerCase().includes(_tipSearch) ||
    (TIP_FIELDS.map(([k]) => i[k] || '').join(' ') + ' ' + (i.source || '')).toLowerCase().includes(_tipSearch));

  items.sort((a, b) =>
    _tipCatOrder(a.category) - _tipCatOrder(b.category) ||
    (a.order || 0) - (b.order || 0) ||
    (a.title || '').localeCompare(b.title || ''));

  if (!items.length) {
    list.innerHTML = _tipLoadError
      ? `<div class="empty" style="padding:2.5rem 1.5rem;text-align:center;color:var(--text-muted);line-height:1.8">
           ${_esc(_tipLoadError)}<br>네트워크 또는 캐시 문제일 수 있습니다.
         </div>`
      : `<div class="empty" style="padding:2.5rem;text-align:center;color:var(--text-muted)">
           아직 적어 둔 팁이 없습니다.${isAdmin ? ' 오른쪽 위 <b>+ 팁 추가</b>로 시작하세요.' : ''}
         </div>`;
    return;
  }

  let html = '', lastCat = null;
  items.forEach(it => {
    if (it.category !== lastCat && _tipCatFilter === 'all') {
      html += `<div class="soap-cat-label">${_esc(it.category || '')}</div>`;
      lastCat = it.category;
    }
    const open = _printAll() || _tipOpenId === it.id;
    const editBtn = isAdmin
      ? `<button class="soap-edit-btn" onclick="event.stopPropagation();_openTipEdit('${it.id}')">✏️</button>` : '';
    const body = open
      ? `<div class="soap-body">${TIP_FIELDS.map(([k, label, sub]) => _tipBlock(label, sub, it[k])).join('')}${_sourceHTML(it.source)}</div>`
      : '';
    html += `<div class="soap-card tip-card${open ? ' open' : ''}">
      <div class="soap-card-head" data-ref-id="${it.id}" onclick="_tipToggle('${it.id}')">
        <span class="soap-cat-badge">${_esc(it.category || '')}</span>
        <span class="soap-card-title">${_esc(it.title || '')}</span>
        ${_favBtn('tip', it.id)}
        ${editBtn}
        <span class="soap-chevron">${open ? '▲' : '▼'}</span>
      </div>
      ${body}
    </div>`;
  });
  list.innerHTML = html;
  _injectCopyButtons(list);
}

const _TIP_KEY = { '상황': 'ctx', '갈림길': 'cross', '판단': 'judge', '근거': 'basis', '메모': 'memo' };

function _tipBlock(label, sub, md) {
  if (!md || !String(md).trim()) return '';
  let body;
  try { body = marked.parse(String(md)); }
  catch (e) { console.warn('[tip] 마크다운 파싱 실패', label, e); body = _esc(String(md)).replace(/\n/g, '<br>'); }
  const key = _TIP_KEY[label] || 'ctx';
  return `<div class="soap-sec tip-sec-${key}">
    <div class="soap-sec-label"><span class="soap-sec-letter tip-letter">${label}</span>${sub}</div>
    <div class="soap-sec-body markdown-body">${body}</div>
  </div>`;
}

function _openTipEdit(id) {
  if (!isAdmin) return;
  const it = id ? _tipItems.find(x => x.id === id) : null;
  const fv = (k, d = '') => it ? (it[k] != null ? it[k] : d) : d;
  const catOpts = TIP_CATS.map(c => `<option value="${c}"${fv('category', TIP_CATS[0]) === c ? ' selected' : ''}>${c}</option>`).join('');
  const ta = (id2, label, val) =>
    `<label class="soap-f-label">${label}<textarea id="${id2}" class="soap-f-ta">${_esc(val)}</textarea></label>`;
  document.body.insertAdjacentHTML('beforeend', `<div id="tip-edit-overlay" class="modal-overlay open" onclick="if(event.target.id==='tip-edit-overlay')_closeTipEdit()">
    <div class="modal soap-edit-modal">
      <button class="modal-close" onclick="_closeTipEdit()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 1rem">${it ? '팁 편집' : '새 팁'}</h3>
        <div class="soap-f-row">
          <label class="soap-f-label" style="flex:2">제목<input id="tip-f-title" class="soap-f-input" value="${_esc(fv('title'))}" placeholder="예: RPD 설계 — 무엇부터 정하는가"></label>
          <label class="soap-f-label" style="flex:1">분류<select id="tip-f-cat" class="soap-f-input">${catOpts}</select></label>
          <label class="soap-f-label" style="width:5rem">순서<input id="tip-f-order" type="number" class="soap-f-input" value="${fv('order', 0)}"></label>
        </div>
        <p class="soap-f-hint">칸을 다 채울 필요는 없습니다. 비운 칸은 표시되지 않습니다. 마크다운 지원 (- 목록, **굵게**, tip/warning/danger 박스, details 접기 등).</p>
        ${ta('tip-f-situation', '상황 — 언제 이 고민이 생기는가', fv('situation'))}
        ${ta('tip-f-crossroad', '갈림길 — 무엇과 무엇 사이에서 갈리는가', fv('crossroad'))}
        ${ta('tip-f-judgment', '판단 — 나는 어떻게 정하는가', fv('judgment'))}
        ${ta('tip-f-basis', '근거 — 그 판단을 받치는 것', fv('basis'))}
        ${ta('tip-f-memo', '메모 — 덧붙임 · 남은 의문', fv('memo'))}
        <label class="soap-f-label">출처 — 참고 자료(선택)<input id="tip-f-source" class="soap-f-input" value="${_esc(fv('source'))}"></label>
        <div class="soap-f-btns">
          ${it ? `<button class="card-admin-btn del" onclick="_deleteTip('${id}')">🗑 삭제</button>` : ''}
          <button class="cal-cancel-btn" onclick="_closeTipEdit()">취소</button>
          <button class="cal-save-btn" onclick="_saveTip('${id || ''}')">저장</button>
        </div>
      </div>
    </div>
  </div>`);
}

function _closeTipEdit() { document.getElementById('tip-edit-overlay')?.remove(); }

async function _saveTip(id) {
  if (!isAdmin) return;
  const g = s => document.getElementById(s)?.value ?? '';
  const title = g('tip-f-title').trim();
  if (!title) { _edToast('제목을 입력하세요.', 'error'); return; }
  const data = {
    title,
    category: g('tip-f-cat') || TIP_CATS[0],
    order: Number(g('tip-f-order')) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  TIP_FIELDS.forEach(([k]) => { data[k] = g('tip-f-' + k).trim(); });
  data.source = g('tip-f-source').trim();
  if (!id) data.userCreated = true;
  const docId = id || _tipDocId(title);
  try {
    await db.collection('tipTemplates').doc(docId).set(data, { merge: true });
    const idx = _tipItems.findIndex(x => x.id === docId);
    if (idx >= 0) _tipItems[idx] = { ...(_tipItems[idx]), id: docId, ...data };
    else _tipItems.push({ id: docId, ...data });
    _closeTipEdit();
    renderTip();
    _edToast('저장되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'tipTemplates'), 'error');
  }
}

async function _deleteTip(id) {
  if (!confirm('이 팁을 삭제하시겠습니까?')) return;
  try {
    await db.collection('tipTemplates').doc(id).delete();
    _tipItems = _tipItems.filter(x => x.id !== id);
    if (_tipOpenId === id) _tipOpenId = null;
    _closeTipEdit();
    renderTip();
    _edToast('삭제되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'tipTemplates'), 'error');
  }
}

// ── 기공지시서 빌더 ──────────────────────────────────────────
// 예문을 복사해 손으로 고치는 대신, 항목을 고르고 빈칸을 채우면
// 완성된 지시서 문안이 나오게 한다. 본문은 언제든 직접 고쳐 쓸 수 있다.
const LAB_ISSUER_KEY = 'dental-lab-issuer';

function _labIssuer() {
  try { return JSON.parse(localStorage.getItem(LAB_ISSUER_KEY) || '{}'); }
  catch (e) { return {}; }
}

function _labTodayISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 예문에는 머리말이 이미 들어 있는 경우가 있다. 폼으로 받는 항목과 겹치지 않게 걷어낸다.
function _labStripHeader(text, hasSite, hasDue) {
  return String(text || '').split('\n').filter(line => {
    const t = line.trim();
    if (/^\[.*\]$/.test(t)) return false;
    if (/^(환자|의뢰|의뢰일|연락|환자 정보)\s*[:：]/.test(t)) return false;
    if (hasSite && /^부위\s*[:：]/.test(t)) return false;
    if (hasDue && /^납기\s*[:：]/.test(t)) return false;
    return true;
  }).join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')   // 마크다운 강조는 지시서 문안에 불필요
    .replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');
}

const LAB_STOCK_NOTES = {
  spec: '지시 두께·언더컷 등 기준을 충족하기 어려우면 제작 전 연락 바랍니다. 임의 축소 금지.',
  disinfect: '인상체·교합기록은 구강 제거 직후 세척 후 중수준 소독제로 소독·헹굼하여 발송했습니다. 완성물 발송 시에도 소독 방법을 함께 기재해 주시기 바랍니다.',
  legal: '본 의뢰서 사본을 본원에 보관합니다 (의료기사 등에 관한 법률 제11조의3 — 치과의사·치과기공소 각각 2년 보존).',
};

function _openLabBuilder(presetId) {
  if (!_labItems.length) { _loadLab(); }
  const iss = _labIssuer();
  const items = _labItems.slice().sort((a, b) =>
    _labCatOrder(a.category) - _labCatOrder(b.category) || (a.order || 0) - (b.order || 0));
  const groups = LAB_CATS.map(cat => {
    const opts = items.filter(i => i.category === cat).map(i =>
      `<option value="${i.id}"${i.id === presetId ? ' selected' : ''}>${_esc(i.title)}</option>`).join('');
    return opts ? `<optgroup label="${cat}">${opts}</optgroup>` : '';
  }).join('');

  document.body.insertAdjacentHTML('beforeend', `
  <div id="lab-builder-overlay" class="modal-overlay open" onclick="if(event.target.id==='lab-builder-overlay')_closeLabBuilder()">
    <div class="modal lab-builder-modal">
      <button class="modal-close" onclick="_closeLabBuilder()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 0.3rem">기공지시서 만들기</h3>
        <p class="soap-f-hint">항목을 고르면 그 항목의 예문이 본문에 들어옵니다. 빈칸을 채우고 본문을 고쳐 쓴 뒤 복사하거나 인쇄하세요.</p>

        <label class="soap-f-label">항목
          <select id="lb-item" class="soap-f-input" onchange="_labBuilderPickItem()">${groups}</select>
        </label>

        <div class="lb-grid">
          <label class="soap-f-label">환자명<input id="lb-name" class="soap-f-input" oninput="_labBuilderRender()" placeholder="홍○○"></label>
          <label class="soap-f-label">등록번호<input id="lb-chart" class="soap-f-input" oninput="_labBuilderRender()" placeholder="12345678"></label>
          <label class="soap-f-label">의뢰일<input id="lb-date" type="date" class="soap-f-input" value="${_labTodayISO()}" oninput="_labBuilderRender()"></label>
          <label class="soap-f-label">부위<input id="lb-site" class="soap-f-input" oninput="_labBuilderRender()" placeholder="#46"></label>
          <label class="soap-f-label">납기<input id="lb-due" type="date" class="soap-f-input" oninput="_labBuilderRender()"></label>
          <label class="soap-f-label">구분
            <select id="lb-kind" class="soap-f-input" onchange="_labBuilderRender()">
              <option value="">신규</option>
              <option value="재제작">재제작</option>
              <option value="수정">수정</option>
            </select>
          </label>
        </div>

        <details class="lb-issuer"${iss.clinic ? '' : ' open'}>
          <summary>의뢰자 정보${iss.clinic ? ` — ${_esc(iss.clinic)} ${_esc(iss.doctor || '')}` : ''}</summary>
          <div class="lb-grid">
            <label class="soap-f-label">치과명<input id="lb-clinic" class="soap-f-input" value="${_esc(iss.clinic || '')}" oninput="_labBuilderRender()"></label>
            <label class="soap-f-label">치과의사<input id="lb-doctor" class="soap-f-input" value="${_esc(iss.doctor || '')}" oninput="_labBuilderRender()"></label>
            <label class="soap-f-label">면허번호<input id="lb-license" class="soap-f-input" value="${_esc(iss.license || '')}" oninput="_labBuilderRender()"></label>
            <label class="soap-f-label">연락처<input id="lb-phone" class="soap-f-input" value="${_esc(iss.phone || '')}" oninput="_labBuilderRender()"></label>
          </div>
          <button class="ref-tool" onclick="_labBuilderSaveIssuer()">💾 이 정보를 이 기기에 저장</button>
        </details>

        <label class="soap-f-label">본문 — 자유롭게 고쳐 쓰세요 <span class="lb-note">(위 칸에 적은 환자·부위·납기 줄은 중복을 피해 자동으로 빠집니다)</span>
          <textarea id="lb-body" class="soap-f-ta lb-body" oninput="_labBuilderRender()"></textarea>
        </label>

        <div class="lb-opts">
          <label><input type="checkbox" id="lb-opt-spec" checked onchange="_labBuilderRender()"> 기준 미달 시 제작 전 연락 문구</label>
          <label><input type="checkbox" id="lb-opt-disinfect" onchange="_labBuilderRender()"> 소독·발송 문구</label>
          <label><input type="checkbox" id="lb-opt-legal" onchange="_labBuilderRender()"> 법정 보존 문구</label>
        </div>

        <div class="lb-preview-wrap">
          <div class="lb-preview-label">미리보기</div>
          <pre id="lb-preview" class="lb-preview"></pre>
        </div>

        <div class="soap-f-btns">
          <button class="cal-cancel-btn" onclick="_closeLabBuilder()">닫기</button>
          <button class="ref-tool" onclick="_printLabDoc()">🖨 인쇄</button>
          <button class="cal-save-btn" onclick="_copyLabDoc(this)">📋 복사</button>
        </div>
      </div>
    </div>
  </div>`);
  _labBuilderPickItem();
}

function _closeLabBuilder() { document.getElementById('lab-builder-overlay')?.remove(); }

// 항목을 바꾸면 본문을 그 항목의 예문으로 채운다. 이미 손댄 본문은 확인 후 교체.
function _labBuilderPickItem() {
  const sel = document.getElementById('lb-item');
  const ta = document.getElementById('lb-body');
  if (!sel || !ta) return;
  const it = _labItems.find(i => i.id === sel.value);
  const next = _labStripHeader(it?.example, !!_lbVal('lb-site'), !!_lbVal('lb-due'));
  if (ta.value.trim() && ta.value.trim() !== ta.dataset.seeded &&
      !confirm('본문을 선택한 항목의 예문으로 바꿀까요? 지금 쓴 내용은 사라집니다.')) {
    _labBuilderRender();
    return;
  }
  ta.value = next;
  ta.dataset.seeded = next.trim();
  _labBuilderRender();
}

function _lbVal(id) { return (document.getElementById(id)?.value || '').trim(); }
function _lbChecked(id) { return !!document.getElementById(id)?.checked; }

function _labBuilderCompose() {
  const it = _labItems.find(i => i.id === _lbVal('lb-item'));
  const L = [];
  L.push('[치과기공물제작의뢰서]');
  const idLine = [
    _lbVal('lb-name') ? `환자: ${_lbVal('lb-name')}` : '',
    _lbVal('lb-chart') ? `(등록번호 ${_lbVal('lb-chart')})` : '',
  ].filter(Boolean).join(' ');
  const dateLine = _lbVal('lb-date') ? `의뢰일: ${_lbVal('lb-date')}` : '';
  if (idLine || dateLine) L.push([idLine, dateLine].filter(Boolean).join('     '));
  const who = [
    _lbVal('lb-clinic'), _lbVal('lb-doctor'),
    _lbVal('lb-license') ? `(면허 ${_lbVal('lb-license')})` : '',
  ].filter(Boolean).join(' ');
  const contact = _lbVal('lb-phone') ? `연락: ${_lbVal('lb-phone')}` : '';
  if (who || contact) L.push([who ? `의뢰: ${who}` : '', contact].filter(Boolean).join('     '));
  L.push('');
  if (it) L.push(`종류: ${it.title}`);
  if (_lbVal('lb-site')) L.push(`부위: ${_lbVal('lb-site')}`);
  if (_lbVal('lb-kind')) L.push(`구분: ${_lbVal('lb-kind')}`);
  if (_lbVal('lb-due')) L.push(`납기: ${_lbVal('lb-due')}`);
  L.push('');
  // 폼으로 이미 적은 항목이 본문에도 있으면 중복되므로 조립 단계에서 걷어낸다
  const raw = document.getElementById('lb-body')?.value || '';
  const body = _labStripHeader(raw, !!_lbVal('lb-site'), !!_lbVal('lb-due')).trim();
  if (body) { L.push(body); L.push(''); }
  const notes = [];
  if (_lbChecked('lb-opt-spec')) notes.push(LAB_STOCK_NOTES.spec);
  if (_lbChecked('lb-opt-disinfect')) notes.push(LAB_STOCK_NOTES.disinfect);
  if (_lbChecked('lb-opt-legal')) notes.push(LAB_STOCK_NOTES.legal);
  if (notes.length) { L.push('— 공통 —'); notes.forEach(n => L.push(`· ${n}`)); }
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function _labBuilderRender() {
  const ta = document.getElementById('lb-body');
  // 아직 손대지 않은 본문이면, 부위·납기를 채운 뒤 그 줄이 남지 않도록 다시 시드한다
  if (ta && ta.dataset.seeded !== undefined && ta.value.trim() === ta.dataset.seeded) {
    const it = _labItems.find(i => i.id === _lbVal('lb-item'));
    const next = _labStripHeader(it?.example, !!_lbVal('lb-site'), !!_lbVal('lb-due'));
    if (next.trim() !== ta.dataset.seeded) { ta.value = next; ta.dataset.seeded = next.trim(); }
  }
  const pre = document.getElementById('lb-preview');
  if (pre) pre.textContent = _labBuilderCompose();
}

function _labBuilderSaveIssuer() {
  const data = {
    clinic: _lbVal('lb-clinic'), doctor: _lbVal('lb-doctor'),
    license: _lbVal('lb-license'), phone: _lbVal('lb-phone'),
  };
  try { localStorage.setItem(LAB_ISSUER_KEY, JSON.stringify(data)); _edToast('의뢰자 정보를 저장했습니다.'); }
  catch (e) { _edToast('저장하지 못했습니다.', 'error'); }
}

async function _copyLabDoc(btn) {
  const text = _labBuilderCompose();
  try { await navigator.clipboard.writeText(text); }
  catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) { console.warn('[labdoc copy]', e2); }
    ta.remove();
  }
  if (btn) {
    const t = btn.textContent;
    btn.textContent = '복사됨';
    setTimeout(() => { btn.textContent = t; }, 1400);
  }
}

// 인쇄는 기존 #print-area 경로를 그대로 쓴다 (인쇄 시 이 영역만 남는다)
function _printLabDoc() {
  const area = document.getElementById('print-area');
  if (!area) return;
  area.innerHTML = `<div class="labdoc-print"><pre>${_esc(_labBuilderCompose())}</pre></div>`;
  const cleanup = () => { area.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => { window.print(); setTimeout(cleanup, 1000); }, 80);
}

// ── 아코디언 스크롤 고정 ─────────────────────────────────────
// 긴 항목을 펼친 채 다른 항목을 누르면 위쪽 카드가 접히며 화면이 통째로 밀린다.
// 누른 항목의 머리를 클릭 직전 위치에 그대로 붙잡아 둔다 (모바일에서 특히 중요).
function _refAnchorEl(listId, anchorId) {
  const list = document.getElementById(listId);
  if (!list) return null;
  return list.querySelector('[data-ref-id="' + String(anchorId).replace(/["\\]/g, '\\$&') + '"]');
}

function _renderKeepingAnchor(listId, anchorId, render, opening) {
  const before = _refAnchorEl(listId, anchorId);
  const top0 = before ? before.getBoundingClientRect().top : null;
  render();
  if (top0 == null) return;
  const after = _refAnchorEl(listId, anchorId);
  if (!after) return;
  let delta = after.getBoundingClientRect().top - top0;
  if (opening) {
    // 펼친 항목이 화면 아래쪽에 있으면 본문이 안 보이므로 머리를 헤더 밑으로 끌어올린다
    const headerH = document.querySelector('header')?.getBoundingClientRect().height || 60;
    if (top0 > headerH + window.innerHeight * 0.45) {
      delta = after.getBoundingClientRect().top - (headerH + 8);
    }
  }
  if (Math.abs(delta) > 1) window.scrollBy(0, delta);
}

// 분류·구획 탭을 바꾸면 목록이 통째로 달라지므로 맨 위에서 다시 시작한다
function _scrollTop() { window.scrollTo(0, 0); }

// ── 참고자료 딥링크 (SOAP · 임상검사 · 용어) ─────────────────
// 각 탭은 서로를 참조하므로 항목 단위로 이동·강조할 수 있어야 한다.
// URL 해시(#soap-… / #exam-… / #term-… / #lab-…)로 특정 항목을 공유할 수도 있다.
const REF_KINDS = {
  soap: { page: 'soap', list: 'soap-list' },
  exam: { page: 'exam', list: 'exam-list' },
  term: { page: 'term', list: 'term-list' },
  lab:  { page: 'lab',  list: 'lab-list' },
  tip:  { page: 'tip',  list: 'tip-list' },
};

// 항목을 펼친 상태로 해당 탭을 열고 스크롤·강조한다.
async function _openRef(kind, id, opts = {}) {
  const k = REF_KINDS[kind];
  if (!k) return;
  _closeSearch?.();
  showPage(k.page);

  // 데이터가 아직 없으면 로드될 때까지 기다린다
  const items = () => kind === 'soap' ? _soapItems : kind === 'exam' ? _examItems : kind === 'lab' ? _labItems : kind === 'tip' ? _tipItems : _termItems;
  if (!items().length) {
    (kind === 'soap' ? _loadSOAP : kind === 'exam' ? _loadExam : kind === 'lab' ? _loadLab : kind === 'tip' ? _loadTip : _loadTerm)();
    for (let i = 0; i < 40 && !items().length; i++) await new Promise(r => setTimeout(r, 50));
  }
  const it = items().find(x => x.id === id);
  if (!it) return;

  if (kind === 'soap') { _soapCatFilter = 'all'; _soapSearch = ''; _soapOpenId = id; renderSOAP(); }
  if (kind === 'exam') { _examCatFilter = 'all'; _examSearch = ''; _examOpenId = id; renderExam(); }
  if (kind === 'lab')  { _labCatFilter = 'all'; _labSearch = ''; _labOpenId = id; renderLab(); }
  if (kind === 'tip')  { _tipCatFilter = 'all'; _tipSearch = ''; _tipOpenId = id; renderTip(); }
  if (kind === 'term') {
    _termCatFilter = 'all'; _termSecFilter = 'all'; _termSearch = '';
    const searchEl = document.getElementById('term-search');
    if (searchEl) searchEl.value = '';
    _termOpenTopics.add(it.category + '|' + (it.topic || '기타'));
    _termOpenId = id;
    renderTerm();
  }
  if (!opts.noHash) history.replaceState(history.state, '', '#' + id);
  requestAnimationFrame(() => _flashRef(k.list, id));
}

// 대상 항목으로 스크롤하고 잠시 강조
function _flashRef(listId, id) {
  const list = document.getElementById(listId);
  if (!list) return;
  const el = _refAnchorEl(listId, id)?.closest('.soap-card, .term-row');
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  el.classList.add('ref-flash');
  setTimeout(() => el.classList.remove('ref-flash'), 1600);
}

// 페이지 로드 시 해시가 참고자료 항목이면 그 항목을 연다
function _openRefFromHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  const m = h.match(/^(soap|exam|term|lab|tip)-/);
  if (m) _openRef(m[1], h, { noHash: true });
}

// 통합 검색용 인덱스 — 참고자료 탭을 모두 포함
function _refSearchIndex() {
  const idx = [];
  const push = (kind, arr, title, sub, body) => arr.forEach(it =>
    idx.push({ kind, id: it.id, title: title(it), sub: sub(it), body: body(it).toLowerCase() }));
  if (typeof _soapItems !== 'undefined')
    push('soap', _soapItems, i => i.title, i => 'SOAP · ' + (i.category || ''),
         i => [i.title, i.subjective, i.objective, i.assessment, i.plan, i.tx].join(' '));
  if (typeof _examItems !== 'undefined')
    push('exam', _examItems, i => i.title, i => '임상검사 · ' + (i.category || ''),
         i => [i.title, i.purpose, i.technique, i.criteria, i.interpretation, i.pitfalls].join(' '));
  if (typeof _tipItems !== 'undefined')
    push('tip', _tipItems, i => i.title, i => '임상 팁 · ' + (i.category || ''),
         i => [i.title, i.situation, i.crossroad, i.judgment, i.basis, i.memo].join(' '));
  if (typeof _labItems !== 'undefined')
    push('lab', _labItems, i => i.title, i => '기공지시서 · ' + (i.category || ''),
         i => [i.title, i.purpose, i.decide, i.required, i.enclosure, i.pitfalls, i.example].join(' '));
  if (typeof _termItems !== 'undefined')
    push('term', _termItems, i => i.ko + ' — ' + i.en, i => '용어 · ' + (i.section || '') + ' · ' + (i.topic || ''),
         i => [i.ko, i.en, i.meaning, i.variants, i.distinguish, i.example, i.caution].join(' '));
  return idx;
}

// 참고자료가 아직 로드되지 않았으면 조용히 불러온다 (검색 대상에 포함시키기 위해)
function _ensureRefsLoaded() {
  if (typeof _soapItems !== 'undefined' && !_soapItems.length) _loadSOAP();
  if (typeof _examItems !== 'undefined' && !_examItems.length) _loadExam();
  if (typeof _termItems !== 'undefined' && !_termItems.length) _loadTerm();
  if (typeof _labItems !== 'undefined' && !_labItems.length) _loadLab();
  if (typeof _tipItems !== 'undefined' && !_tipItems.length) _loadTip();
}

// ── 차팅 용어 (Charting Terminology) ─────────────────────────
// 한국어 임상 표현 → 영어 차팅 표현. 검색 우선 UI.
let _termItems = [];
let _termCatFilter = 'all';
let _termSecFilter = 'all';   // all | O | A
let _termSearch = '';
let _termOpenId = null;
let _termOpenTopics = new Set();   // 펼쳐진 주제(category|topic)
let _termLoadError = '';

const TERM_SECS = [['all', '전체'], ['O', 'O 소견'], ['A', 'A 진단']];

function _termDocId(ko, en) {
  return 'term-' + (ko + '-' + (en || '').split(/[ /(]/)[0])
    .replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 60);
}

async function _loadTerm() {
  if (typeof TERM_SEED === 'undefined' || !Array.isArray(TERM_SEED) || !TERM_SEED.length) {
    console.error('[term] TERM_SEED 로드 실패 — js/term-seed.js 확인 필요');
    _termItems = [];
    _termLoadError = '용어 자료 파일을 불러오지 못했습니다.';
    renderTerm();
    return;
  }
  _termLoadError = '';
  const base = TERM_SEED.map(t => ({ id: _termDocId(t.ko, t.en), ...t, seed: true }));
  const newIds = new Set(base.map(b => b.id));
  try {
    const [snap, metaSnap] = await Promise.all([
      db.collection('termTemplates').get(),
      db.collection('appMeta').doc('termSeed').get().catch(() => null)
    ]);
    const ver = (metaSnap && metaSnap.exists) ? (metaSnap.data().version || 0) : 0;

    if (isAdmin && (snap.empty || ver < TERM_SEED_VERSION)) {
      try { await _seedTerm(snap); } catch (e) { console.warn('[term reseed]', e); }
      const s2 = await db.collection('termTemplates').get().catch(() => null);
      _termItems = s2 && !s2.empty ? s2.docs.map(d => ({ id: d.id, ...d.data() })) : base;
    } else if (!snap.empty) {
      const byId = {};
      base.forEach(it => { byId[it.id] = it; });
      snap.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
      _termItems = Object.values(byId).filter(it => it.userCreated || newIds.has(it.id));
    } else {
      _termItems = base;
    }
  } catch (e) {
    console.warn('[term load]', e);
    _termItems = base;
  }
  if (!_termItems.length) _termItems = base;
  renderTerm();
}

async function _seedTerm(existingSnap) {
  const ops = [];
  const newIds = new Set(TERM_SEED.map(t => _termDocId(t.ko, t.en)));
  if (existingSnap) {
    existingSnap.forEach(d => {
      const data = d.data() || {};
      if (!data.userCreated && !newIds.has(d.id)) ops.push({ type: 'del', ref: d.ref });
    });
  }
  TERM_SEED.forEach(t => ops.push({ type: 'set', ref: db.collection('termTemplates').doc(_termDocId(t.ko, t.en)), data: { ...t, seed: true } }));
  await _commitOps(ops);
  try { await db.collection('appMeta').doc('termSeed').set({ version: TERM_SEED_VERSION }); }
  catch (e) { console.warn('[term seed meta]', e); }
}

function _setTermCat(cat) { _termCatFilter = cat; renderTerm(); _scrollTop(); }
function _setTermSec(sec) { _termSecFilter = sec; renderTerm(); _scrollTop(); }
function _termFilter(v) { _termSearch = (v || '').trim().toLowerCase(); renderTerm(); }
function _termToggle(id) {
  const opening = _termOpenId !== id;
  _termOpenId = opening ? id : null;
  _renderKeepingAnchor('term-list', id, renderTerm, opening);
}
function _termToggleTopic(key) {
  const opening = !_termOpenTopics.has(key);
  opening ? _termOpenTopics.add(key) : _termOpenTopics.delete(key);
  _renderKeepingAnchor('term-list', key, renderTerm, opening);
}
function _termExpandAll(open) {
  _termOpenTopics = new Set();
  if (open) _termItems.forEach(i => _termOpenTopics.add(i.category + '|' + (i.topic || '기타')));
  renderTerm();
  _scrollTop();
}

function renderTerm() {
  const list = document.getElementById('term-list');
  const catTabs = document.getElementById('term-cat-tabs');
  const secTabs = document.getElementById('term-sec-tabs');
  const adminEl = document.getElementById('term-admin-btns');
  if (!list) return;

  if (adminEl) adminEl.innerHTML = isAdmin
    ? '<button class="soap-add-btn" onclick="_openTermEdit(null)">+ 용어 추가</button>' : '';
  const toolsEl = document.getElementById('term-tools');
  if (toolsEl) toolsEl.innerHTML = _refToolsHTML('term', _termItems.filter(i => _isFav(i.id)).length);

  if (secTabs) {
    secTabs.innerHTML = TERM_SECS.map(([v, label]) =>
      `<button class="term-sec-tab${_termSecFilter === v ? ' active' : ''} term-sec-${v}" onclick="_setTermSec('${v}')">${label}</button>`
    ).join('');
  }

  const dl = document.getElementById('term-topic-list');
  if (dl) dl.innerHTML = [...new Set(_termItems.map(i => i.topic).filter(Boolean))]
    .map(t => `<option value="${_esc(t)}">`).join('');

  const usedCats = TERM_CATS.filter(c => _termItems.some(i => i.category === c));
  if (catTabs) {
    catTabs.innerHTML = ['all'].concat(usedCats).map(c =>
      `<button class="soap-cat-tab${_termCatFilter === c ? ' active' : ''}" onclick="_setTermCat('${c}')">${c === 'all' ? '전체' : c}</button>`
    ).join('');
  }

  let items = _termItems.slice();
  if (_favOnly.term) items = items.filter(i => _isFav(i.id));
  if (_termCatFilter !== 'all') items = items.filter(i => i.category === _termCatFilter);
  if (_termSecFilter !== 'all') items = items.filter(i => (i.section || '').includes(_termSecFilter));
  if (_termSearch) items = items.filter(i =>
    [i.ko, i.en, i.meaning, i.variants, i.distinguish, i.example, i.caution].join(' ').toLowerCase().includes(_termSearch));

  items.sort((a, b) =>
    TERM_CATS.indexOf(a.category) - TERM_CATS.indexOf(b.category) ||
    (a.order || 0) - (b.order || 0) ||
    (a.ko || '').localeCompare(b.ko || ''));

  if (!items.length) {
    list.innerHTML = _termLoadError
      ? `<div class="empty" style="padding:2.5rem 1.5rem;text-align:center;color:var(--text-muted);line-height:1.8">
           <div style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:0.5rem">용어 자료를 불러오지 못했습니다</div>
           ${_esc(_termLoadError)}<br>네트워크 또는 캐시 문제일 수 있습니다.<br>
           <button class="soap-add-btn" style="margin-top:0.9rem" onclick="_soapHardReload()">캐시 지우고 다시 불러오기</button>
         </div>`
      : `<div class="empty" style="padding:2.5rem;text-align:center;color:var(--text-muted)">
           검색 결과가 없습니다.${_termSearch ? `<br><span style="font-size:0.85rem">“${_esc(_termSearch)}”</span>` : ''}
         </div>`;
    return;
  }

  // 주제(topic)별로 묶기 — 검색 중에는 모두 펼침
  const groups = [];
  const byKey = new Map();
  items.forEach(it => {
    const topic = it.topic || '기타';
    const key = it.category + '|' + topic;
    if (!byKey.has(key)) { const g = { key, category: it.category, topic, terms: [] }; byKey.set(key, g); groups.push(g); }
    byKey.get(key).terms.push(it);
  });

  // 검색·섹션 필터로 범위를 좁혔을 때는 자동으로 펼침 (분류 필터는 훑어보기용이라 접힌 상태 유지)
  const searching = _printAll() || !!_termSearch || _termSecFilter !== 'all' || _favOnly.term;
  let html = '', lastCat = null;
  groups.forEach(g => {
    if (_termCatFilter === 'all' && g.category !== lastCat) {
      html += `<div class="soap-cat-label">${_esc(g.category)}</div>`;
      lastCat = g.category;
    }
    const open = searching || _termOpenTopics.has(g.key);
    html += `<div class="term-group${open ? ' open' : ''}">
      <div class="term-group-head" data-ref-id="${_esc(g.key)}" onclick="_termToggleTopic('${_esc(g.key).replace(/'/g, "\\'")}')">
        <span class="term-group-caret">${open ? '▾' : '▸'}</span>
        <span class="term-group-title">${_esc(g.topic)}</span>
        <span class="term-group-count">${g.terms.length}</span>
      </div>`;
    if (open) {
      html += '<div class="term-group-body">';
      g.terms.forEach(it => {
        const rowOpen = _printAll() || _termOpenId === it.id;
        const secCls = (it.section || '').startsWith('A') ? 'a' : (it.section || '').startsWith('O') ? 'o' : 'oa';
        const editBtn = isAdmin
          ? `<button class="soap-edit-btn" onclick="event.stopPropagation();_openTermEdit('${it.id}')">✏️</button>` : '';
        const detail = rowOpen ? `<div class="term-detail">
            ${it.meaning     ? `<div class="term-field"><span class="term-flabel">뜻</span><div class="markdown-body">${_termMd(it.meaning)}</div></div>` : ''}
            ${it.variants    ? `<div class="term-field"><span class="term-flabel">갈래</span><div class="markdown-body">${_termMd(it.variants)}</div></div>` : ''}
            ${it.distinguish ? `<div class="term-field"><span class="term-flabel dist">감별</span><div class="markdown-body">${_termMd(it.distinguish)}</div></div>` : ''}
            ${it.example     ? `<div class="term-field"><span class="term-flabel">예문</span><div class="term-example">${_esc(it.example)}</div></div>` : ''}
            ${it.caution     ? `<div class="term-field"><span class="term-flabel warn">주의</span><div class="markdown-body">${_termMd(it.caution)}</div></div>` : ''}
            ${_sourceHTML(TERM_SOURCE[it.category])}
          </div>` : '';
        html += `<div class="term-row${rowOpen ? ' open' : ''}">
          <div class="term-head" data-ref-id="${it.id}" onclick="_termToggle('${it.id}')">
            <span class="term-sec-badge sec-${secCls}">${_esc(it.section || '')}</span>
            <span class="term-ko">${_esc(it.ko || '')}</span>
            <span class="term-arrow">→</span>
            <span class="term-en">${_esc(it.en || '')}</span>
            ${_favBtn('term', it.id)}
            ${editBtn}
            <span class="soap-chevron">${rowOpen ? '▲' : '▼'}</span>
          </div>
          ${detail}
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
  });
  list.innerHTML = html;
  _injectCopyButtons(list);
}

function _termMd(md) {
  try { return marked.parse(String(md)); }
  catch (e) { return _esc(String(md)).replace(/\n/g, '<br>'); }
}

function _openTermEdit(id) {
  if (!isAdmin) return;
  const it = id ? _termItems.find(x => x.id === id) : null;
  const fv = (k, d = '') => it ? (it[k] != null ? it[k] : d) : d;
  const catOpts = TERM_CATS.map(c => `<option value="${c}"${fv('category', TERM_CATS[0]) === c ? ' selected' : ''}>${c}</option>`).join('');
  const secOpts = ['O', 'A', 'O·A', 'A·P'].map(v => `<option value="${v}"${fv('section', 'O') === v ? ' selected' : ''}>${v}</option>`).join('');
  const ta = (id2, label, val) =>
    `<label class="soap-f-label">${label}<textarea id="${id2}" class="soap-f-ta">${_esc(val)}</textarea></label>`;
  const html = `<div id="term-edit-overlay" class="modal-overlay open" onclick="if(event.target.id==='term-edit-overlay')_closeTermEdit()">
    <div class="modal soap-edit-modal">
      <button class="modal-close" onclick="_closeTermEdit()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 1rem">${it ? '용어 편집' : '새 용어'}</h3>
        <div class="soap-f-row">
          <label class="soap-f-label" style="flex:1">한글 표현<input id="term-f-ko" class="soap-f-input" value="${_esc(fv('ko'))}" placeholder="예: 보철물 탈락"></label>
          <label class="soap-f-label" style="flex:1.4">영어 표현<input id="term-f-en" class="soap-f-input" value="${_esc(fv('en'))}" placeholder="예: decementation / debonding"></label>
        </div>
        <div class="soap-f-row">
          <label class="soap-f-label" style="flex:1">분류<select id="term-f-cat" class="soap-f-input">${catOpts}</select></label>
          <label class="soap-f-label" style="flex:1">주제<input id="term-f-topic" class="soap-f-input" value="${_esc(fv('topic'))}" placeholder="예: TMJ — 골 변화" list="term-topic-list"></label>
          <label class="soap-f-label" style="width:7rem">섹션<select id="term-f-sec" class="soap-f-input">${secOpts}</select></label>
          <label class="soap-f-label" style="width:5rem">순서<input id="term-f-order" type="number" class="soap-f-input" value="${fv('order', 0)}"></label>
        </div>
        <p class="soap-f-hint">뜻·구분·주의 칸은 마크다운 지원 (**굵게**, dl 정의목록 등). 예문은 영문 차팅 문장 그대로.</p>
        ${ta('term-f-meaning', '뜻 — 무엇을 가리키는가', fv('meaning'))}
        ${ta('term-f-variants', '갈래 — 대상·원인에 따라 갈리는 단어 (없으면 비워둠)', fv('variants'))}
        ${ta('term-f-distinguish', '감별 — 비슷한 것과 어떻게 구별하는가', fv('distinguish'))}
        ${ta('term-f-example', '예문 — 영문 차팅 문장', fv('example'))}
        ${ta('term-f-caution', '주의 — 혼동·오용 (없으면 비워둠)', fv('caution'))}
        <div class="soap-f-btns">
          ${it ? `<button class="card-admin-btn del" onclick="_deleteTerm('${id}')">🗑 삭제</button>` : ''}
          <button class="cal-cancel-btn" onclick="_closeTermEdit()">취소</button>
          <button class="cal-save-btn" onclick="_saveTerm('${id || ''}')">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _closeTermEdit() {
  document.getElementById('term-edit-overlay')?.remove();
}

async function _saveTerm(id) {
  if (!isAdmin) return;
  const g = s => document.getElementById(s)?.value ?? '';
  const ko = g('term-f-ko').trim();
  const en = g('term-f-en').trim();
  if (!ko || !en) { _edToast('한글 표현과 영어 표현을 모두 입력하세요.', 'error'); return; }
  const data = {
    ko, en,
    category: g('term-f-cat') || TERM_CATS[0],
    topic: g('term-f-topic').trim() || '기타',
    section: g('term-f-sec') || 'O',
    order: Number(g('term-f-order')) || 0,
    meaning: g('term-f-meaning').trim(),
    distinguish: g('term-f-distinguish').trim(),
    variants: g('term-f-variants').trim(),
    example: g('term-f-example').trim(),
    caution: g('term-f-caution').trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (!id) data.userCreated = true;
  const docId = id || _termDocId(ko, en);
  try {
    await db.collection('termTemplates').doc(docId).set(data, { merge: true });
    const idx = _termItems.findIndex(x => x.id === docId);
    if (idx >= 0) _termItems[idx] = { ...(_termItems[idx]), id: docId, ...data };
    else _termItems.push({ id: docId, ...data });
    _closeTermEdit();
    renderTerm();
    _edToast('저장되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'termTemplates'), 'error');
  }
}

async function _deleteTerm(id) {
  if (!confirm('이 용어를 삭제하시겠습니까?')) return;
  try {
    await db.collection('termTemplates').doc(id).delete();
    _termItems = _termItems.filter(x => x.id !== id);
    if (_termOpenId === id) _termOpenId = null;
    _closeTermEdit();
    renderTerm();
    _edToast('삭제되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'termTemplates'), 'error');
  }
}

// 서비스워커 캐시까지 비우고 강제 재로드 (SOAP 로드 실패 시 사용자 조치)
async function _soapHardReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) { console.warn('[soap] 캐시 정리 실패', e); }
  location.reload();
}

function _openSoapEdit(id) {
  if (!isAdmin) return;
  const it = id ? _soapItems.find(x => x.id === id) : null;
  const fv = (k, d = '') => it ? (it[k] != null ? it[k] : d) : d;
  const catOpts = SOAP_CATS.map(c => `<option value="${c}"${fv('category', '고정성') === c ? ' selected' : ''}>${c}</option>`).join('');
  const ta = (id2, label, val) =>
    `<label class="soap-f-label">${label}<textarea id="${id2}" class="soap-f-ta">${_esc(val)}</textarea></label>`;
  const html = `<div id="soap-edit-overlay" class="modal-overlay open" onclick="if(event.target.id==='soap-edit-overlay')_closeSoapEdit()">
    <div class="modal soap-edit-modal">
      <button class="modal-close" onclick="_closeSoapEdit()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 1rem">${it ? 'SOAP 편집' : '새 SOAP'}</h3>
        <div class="soap-f-row">
          <label class="soap-f-label" style="flex:2">진료명<input id="soap-f-title" class="soap-f-input" value="${_esc(fv('title'))}" placeholder="예: 싱글 크라운 — 최종 접착"></label>
          <label class="soap-f-label" style="flex:1">분류<select id="soap-f-cat" class="soap-f-input">${catOpts}</select></label>
          <label class="soap-f-label" style="width:5rem">순서<input id="soap-f-order" type="number" class="soap-f-input" value="${fv('order', 0)}"></label>
        </div>
        <p class="soap-f-hint">각 칸은 마크다운 지원 (- 목록, **굵게**, tip/warning 박스 등). 이전 대화의 SOAP 내용을 그대로 붙여넣어도 됩니다.</p>
        ${ta('soap-f-s', 'S — Subjective (주관적)', fv('subjective'))}
        ${ta('soap-f-o', 'O — Objective (객관적)', fv('objective'))}
        ${ta('soap-f-a', 'A — Assessment (평가)', fv('assessment'))}
        ${ta('soap-f-p', 'P — Plan (계획)', fv('plan'))}
        ${ta('soap-f-tx', 'Tx — 시행 술식 (SOAP와 별개, 당일 시행한 처치 기록)', fv('tx'))}
        <div class="soap-f-btns">
          ${it ? `<button class="card-admin-btn del" onclick="_deleteSoap('${id}')">🗑 삭제</button>` : ''}
          <button class="cal-cancel-btn" onclick="_closeSoapEdit()">취소</button>
          <button class="cal-save-btn" onclick="_saveSoap('${id || ''}')">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _closeSoapEdit() {
  document.getElementById('soap-edit-overlay')?.remove();
}

async function _saveSoap(id) {
  if (!isAdmin) return;
  const g = s => document.getElementById(s)?.value ?? '';
  const title = g('soap-f-title').trim();
  if (!title) { _edToast('진료명을 입력하세요.', 'error'); return; }
  const data = {
    title,
    category: g('soap-f-cat') || '기타',
    order: Number(g('soap-f-order')) || 0,
    subjective: g('soap-f-s').trim(),
    objective: g('soap-f-o').trim(),
    assessment: g('soap-f-a').trim(),
    plan: g('soap-f-p').trim(),
    tx: g('soap-f-tx').trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (!id) data.userCreated = true; // 관리자가 새로 만든 항목은 재시드 시 보존
  const docId = id || _soapDocId(title);
  try {
    await db.collection('soapTemplates').doc(docId).set(data, { merge: true });
    const idx = _soapItems.findIndex(x => x.id === docId);
    if (idx >= 0) _soapItems[idx] = { ...(_soapItems[idx]), id: docId, ...data };
    else _soapItems.push({ id: docId, ...data });
    _closeSoapEdit();
    renderSOAP();
    _edToast('저장되었습니다.');
  } catch (e) {
    _edToast(_fbErrMsg(e, 'soapTemplates'), 'error');
  }
}

async function _deleteSoap(id) {
  if (!confirm('이 SOAP 항목을 삭제하시겠습니까?')) return;
  await db.collection('soapTemplates').doc(id).delete();
  _soapItems = _soapItems.filter(x => x.id !== id);
  if (_soapOpenId === id) _soapOpenId = null;
  _closeSoapEdit();
  renderSOAP();
}

// ── Statistics (통계) ─────────────────────────────────────────
function renderStats() {
  const summary = document.getElementById('stats-summary-row');
  const charts  = document.getElementById('stats-charts');
  const updated = document.getElementById('stats-updated');
  if (!summary || !charts) return;

  const now   = new Date();
  const thisM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const total = allCases.length;
  const thisMonth = allCases.filter(c => (c.date||'').startsWith(thisM)).length;
  const ongoing   = allCases.filter(c => c.status === 'ongoing').length;
  const done      = allCases.filter(c => c.status === 'done').length;

  if (updated) updated.textContent = `총 ${total}건 · ${now.toLocaleDateString('ko-KR')} 기준`;

  summary.innerHTML = [
    { label:'전체 케이스', value: total,      icon:'📋', cls:'' },
    { label:'이번 달',    value: thisMonth,   icon:'📅', cls:'' },
    { label:'진행중',     value: ongoing,     icon:'🔄', cls:'stat-card-ongoing' },
    { label:'완료',       value: done,        icon:'✅', cls:'stat-card-done' }
  ].map(s => `<div class="stat-card ${s.cls}">
    <div class="stat-card-icon">${s.icon}</div>
    <div class="stat-card-value">${s.value}</div>
    <div class="stat-card-label">${s.label}</div>
  </div>`).join('');

  charts.innerHTML = `
    <div class="stats-chart-card stats-chart-full">
      <div class="stats-chart-title">월별 케이스 등록 수 <span class="stats-chart-sub">(최근 12개월)</span></div>
      ${_statsMonthlyChart()}
    </div>
    <div class="stats-chart-card">
      <div class="stats-chart-title">부문별 케이스 수</div>
      ${_statsDeptChart()}
    </div>
    <div class="stats-chart-card">
      <div class="stats-chart-title">자주 쓰인 태그 <span class="stats-chart-sub">(상위 15개)</span></div>
      ${_statsTagChart()}
    </div>`;
}

function _statsMonthlyChart() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push({ key, label: `${d.getFullYear()}.${d.getMonth()+1}`, short: `${d.getMonth()+1}월`, count: 0 });
  }
  allCases.forEach(c => {
    if (!c.date) return;
    const key = c.date.slice(0, 7);
    const m = months.find(m => m.key === key);
    if (m) m.count++;
  });

  const maxCount = Math.max(...months.map(m => m.count), 1);
  const W = 560, H = 160, PT = 14, PB = 28, PL = 28, PR = 8;
  const bw_total = (W - PL - PR) / months.length;
  const bw = bw_total * 0.65;
  const bpad = bw_total * 0.175;
  const ch = H - PT - PB;

  const gridY = [0.25, 0.5, 0.75, 1].filter(f => Math.round(f * maxCount) > 0);
  const grids = gridY.map(f => {
    const y = PT + ch - f * ch;
    return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3" stroke-width="1"/>
      <text x="${PL-4}" y="${y+4}" text-anchor="end" font-size="9" fill="var(--text-muted)">${Math.round(f*maxCount)}</text>`;
  }).join('');

  const bars = months.map((m, i) => {
    const bh = maxCount ? (m.count / maxCount) * ch : 0;
    const x  = PL + i * bw_total + bpad;
    const y  = PT + ch - bh;
    const mid = x + bw / 2;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="var(--primary)" opacity="0.82">
        <title>${m.label}: ${m.count}건</title></rect>
      ${m.count > 0 ? `<text x="${mid}" y="${y-3}" text-anchor="middle" font-size="9" fill="var(--primary)" font-weight="600">${m.count}</text>` : ''}
      <text x="${mid}" y="${H-PB+13}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${m.short}</text>`;
  }).join('');

  return `<div class="stats-svg-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block">
    ${grids}
    <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT+ch}" stroke="var(--border)" stroke-width="1"/>
    ${bars}
  </svg></div>`;
}

function _statsDeptChart() {
  const counts = {};
  allCases.forEach(c => { if (c.department) counts[c.department] = (counts[c.department]||0)+1; });
  const items = _departments
    .map(d => ({ name: d.name, count: counts[d.id]||0 }))
    .filter(d => d.count > 0)
    .sort((a,b) => b.count - a.count);
  if (!items.length) return '<div class="stats-empty">케이스가 없습니다.</div>';
  const max = items[0].count;
  return `<div class="stats-hbar-list">${items.map((d,i) => {
    const pct = Math.round((d.count/max)*100);
    const hue = (i * 47) % 360;
    return `<div class="stats-hbar-row">
      <div class="stats-hbar-label">${_esc(d.name)}</div>
      <div class="stats-hbar-track">
        <div class="stats-hbar-fill" style="width:${pct}%;background:hsl(${hue},60%,52%)"></div>
      </div>
      <div class="stats-hbar-count">${d.count}</div>
    </div>`;
  }).join('')}</div>`;
}

function _statsTagChart() {
  const counts = {};
  allCases.forEach(c => (c.tags||[]).forEach(t => { counts[t] = (counts[t]||0)+1; }));
  const items = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,15);
  if (!items.length) return '<div class="stats-empty">태그가 없습니다.</div>';
  const max = items[0][1];
  return `<div class="stats-hbar-list">${items.map(([tag, count]) => {
    const pct = Math.round((count/max)*100);
    return `<div class="stats-hbar-row">
      <div class="stats-hbar-label stats-tag-label">${_esc(tag)}</div>
      <div class="stats-hbar-track">
        <div class="stats-hbar-fill" style="width:${pct}%;background:var(--primary)"></div>
      </div>
      <div class="stats-hbar-count">${count}</div>
    </div>`;
  }).join('')}</div>`;
}

// ── Simple Inventory (덴처버 / 폴리싱) ───────────────────────
const _SIMPLE_COLLS = { denture: 'dentureBurInventory', polishing: 'polishingInventory' };
const _SIMPLE_LABELS = { denture: '덴처 버', polishing: '폴리싱' };

async function _loadSimpleInv(cat) {
  const coll = _SIMPLE_COLLS[cat];
  const snap = await db.collection(coll).get().catch(() => null);
  _simpleInvLoaded[cat] = true;
  _simpleInvItems[cat] = snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  _renderSimpleInv(cat);
}

function _renderSimpleInv(cat) {
  const content = document.getElementById(`inv-${cat}-content`);
  const adminEl = document.getElementById(`inv-${cat}-admin-btns`);
  if (!content) return;
  if (adminEl) adminEl.innerHTML = isAdmin
    ? `<button class="inv-add-btn" onclick="_openSimpleEdit('${cat}',null)">+ 추가</button>` : '';

  if (!_simpleInvItems[cat].length) {
    if (!_simpleInvLoaded[cat]) {
      content.innerHTML = '<div class="empty" style="padding:2rem;text-align:center">불러오는 중…</div>';
      _loadSimpleInv(cat);
      return;
    }
    content.innerHTML = `<div class="empty" style="padding:3rem;text-align:center;color:var(--text-muted)">
      등록된 항목이 없습니다.<br><small>관리자가 항목을 추가할 수 있습니다.</small></div>`;
    return;
  }

  const items = _simpleInvItems[cat];
  const stockCls = { enough:'inv-s-enough', ok:'inv-s-ok', low:'inv-s-low', none:'inv-s-none', warn:'inv-s-warn' };
  content.innerHTML = `<div class="inv-table-wrap"><table class="inv-table">
    <thead><tr>
      <th>코드</th><th>품명</th><th>${cat==='denture'?'사양':'재료/용도'}</th><th>재고</th><th>비고</th>
      ${isAdmin?'<th></th>':''}
    </tr></thead>
    <tbody>${items.map(it => `<tr>
      <td class="inv-code">${_esc(it.code||'')}</td>
      <td>${_esc(it.name||'')}</td>
      <td class="inv-iso">${_esc(it.spec||'')}</td>
      <td><span class="inv-stock ${stockCls[it.stock]||''}">${BUR_META.stock_labels[it.stock]||it.stock||''}</span></td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${_esc(it.notes||'')}</td>
      ${isAdmin?`<td class="inv-act"><button class="inv-edit-btn" onclick="_openSimpleEdit('${cat}','${_esc(it.id)}')">✏️</button></td>`:''}
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function _openSimpleEdit(cat, id) {
  const item = id ? (_simpleInvItems[cat]||[]).find(i => i.id === id) : null;
  const fv = (k, def='') => item ? (item[k] ?? def) : def;
  const stockOpts = Object.entries(BUR_META.stock_labels).map(([k,v]) =>
    `<option value="${k}"${fv('stock','ok')===k?' selected':''}>${v}</option>`).join('');
  const specLabel = cat === 'denture' ? '사양' : '재료/용도';
  const html = `<div id="simple-edit-overlay" class="modal-overlay open" onclick="if(event.target.id==='simple-edit-overlay')_closeSimpleEdit()">
    <div class="modal" style="max-width:440px">
      <button class="modal-close" onclick="_closeSimpleEdit()">✕</button>
      <div class="modal-body">
        <h3 style="margin:0 0 1.2rem">${item ? _SIMPLE_LABELS[cat]+' 편집' : _SIMPLE_LABELS[cat]+' 추가'}</h3>
        <div class="inv-form-grid">
          <label>코드<input id="si-f-code" type="text" value="${_esc(fv('code'))}" placeholder="예: DC-01"></label>
          <label>품명 *<input id="si-f-name" type="text" value="${_esc(fv('name'))}" placeholder="품명"></label>
          <label>${specLabel}<input id="si-f-spec" type="text" value="${_esc(fv('spec'))}" placeholder="사양/용도"></label>
          <label>재고 상태<select id="si-f-stock">${stockOpts}</select></label>
          <label style="grid-column:1/-1">비고<input id="si-f-notes" type="text" value="${_esc(fv('notes'))}" placeholder="메모"></label>
        </div>
        <div style="display:flex;gap:0.7rem;margin-top:1.4rem;justify-content:flex-end;align-items:center">
          ${item ? `<button class="card-admin-btn del" onclick="_deleteSimpleItem('${cat}','${_esc(id)}')">🗑 삭제</button>` : ''}
          <button class="cal-cancel-btn" onclick="_closeSimpleEdit()">취소</button>
          <button class="cal-save-btn" onclick="_saveSimpleItem('${cat}','${_esc(id||'')}')">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _closeSimpleEdit() {
  document.getElementById('simple-edit-overlay')?.remove();
}

async function _saveSimpleItem(cat, id) {
  const g = sel => document.getElementById(sel)?.value?.trim();
  const name = g('si-f-name');
  if (!name) { alert('품명을 입력하세요.'); return; }
  const data = { code: g('si-f-code')||'', name, spec: g('si-f-spec')||'', stock: g('si-f-stock')||'ok', notes: g('si-f-notes')||'' };
  const coll = _SIMPLE_COLLS[cat];
  const docId = id || _burDocId(name + '-' + Date.now());
  await db.collection(coll).doc(docId).set(data);
  const arr = _simpleInvItems[cat] || [];
  const idx = arr.findIndex(i => i.id === docId);
  if (idx >= 0) arr[idx] = { id: docId, ...data };
  else arr.push({ id: docId, ...data });
  _simpleInvItems[cat] = arr;
  _closeSimpleEdit();
  _renderSimpleInv(cat);
}

async function _deleteSimpleItem(cat, id) {
  if (!confirm('삭제하시겠습니까?')) return;
  await db.collection(_SIMPLE_COLLS[cat]).doc(id).delete();
  _simpleInvItems[cat] = (_simpleInvItems[cat]||[]).filter(i => i.id !== id);
  _closeSimpleEdit();
  _renderSimpleInv(cat);
}

// ── Pull-to-refresh (모바일) ──────────────────────────────────
(function _setupPTR() {
  let startY = 0, curDY = 0, active = false;
  const THRESH = 72;

  const ind = document.createElement('div');
  ind.id = 'ptr-indicator';
  ind.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
  document.body.appendChild(ind);

  function setPos(dy) {
    const p = Math.min(dy / THRESH, 1);
    const y = Math.min(dy * 0.5, 44) - 48;
    ind.style.opacity = p;
    ind.style.transform = `translateY(${y}px)`;
    ind.classList.toggle('ptr-ready', p >= 1);
  }
  function reset() {
    ind.style.opacity = '0';
    ind.style.transform = 'translateY(-48px)';
    ind.classList.remove('ptr-ready', 'ptr-spin');
  }

  document.addEventListener('touchstart', e => {
    if (window.scrollY > 2) return;
    if (document.getElementById('modal-overlay')?.classList.contains('open')) return;
    startY = e.touches[0].clientY;
    curDY = 0; active = true;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!active) return;
    curDY = Math.max(0, e.touches[0].clientY - startY);
    if (curDY === 0) { active = false; return; }
    setPos(curDY);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    if (curDY >= THRESH) {
      ind.classList.add('ptr-spin');
      ind.style.opacity = '1';
      loadData().finally(reset);
    } else {
      reset();
    }
  }, { passive: true });
})();

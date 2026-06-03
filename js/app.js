// ── Firebase 초기화 ───────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
    const hrefAttr = href ? ` data-href="${href.replace(/"/g, '&quot;')}"` : '';
    return `<sup class="cite-sup" data-n="${n + 1}" data-tip="${tip}"${hrefAttr}>[${n + 1}]</sup>`;
  });

  return marked.parse(processed);
}

// ── marked 커스텀 렌더러 (이미지 크기 + Fig 자동 번호) ───────
let _figNum = 0; // marked.parse 호출마다 리셋 (아래 래퍼)
(function setupMarked() {
  const renderer = new marked.Renderer();
  const sizeMap  = { sm: '30%', md: '50%', lg: '75%' };
  const escAttr = s => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    const imgTag = `<img src="${href}" alt="${escAttr(caption || sizeKey)}" style="width:${w};display:block;border-radius:8px;margin:0 auto;border:1px solid #e2e8f0;max-width:100%">`;
    if (caption) {
      // 이미 Fig/그림/사진 라벨을 직접 붙였으면 그대로, 아니면 "Fig. N." 자동 부여
      const hasLabel = /^\s*(fig\.?|figure|그림|사진)\s*\.?\s*\d/i.test(caption);
      let capHtml;
      if (hasLabel) {
        capHtml = escAttr(caption);
      } else {
        _figNum++;
        capHtml = `<b>Fig. ${_figNum}.</b> ${escAttr(caption)}`;
      }
      return `<figure style="margin:0.75rem auto;text-align:center;max-width:100%">${imgTag}` +
        `<figcaption style="margin-top:0.4rem;font-size:0.82rem;color:var(--text-muted,#64748b);line-height:1.5;word-break:keep-all">${capHtml}</figcaption></figure>`;
    }
    return `<img src="${href}" alt="${escAttr(sizeKey)}" style="width:${w};display:block;border-radius:8px;margin:0.75rem 0;border:1px solid #e2e8f0;max-width:100%">`;
  };
  marked.setOptions({ renderer, breaks: true });

  // marked.parse 호출 시작마다 Fig 카운터 리셋 (문서별 1번부터)
  const _origParse = marked.parse.bind(marked);
  marked.parse = function() {
    _figNum = 0;
    return _origParse.apply(this, arguments);
  };
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

let allCases = [];
let allContents = [];
let currentPhotos = [];
let _photoPreloadCache = []; // GC 방지 + decode() 선디코딩
let currentPhotoIndex = 0;
let _currentModalItem = null;
let isAdmin = false;
let _bookmarks = new Set(JSON.parse(localStorage.getItem('dental-bm') || '[]'));
let _showBmOnly = false;
let _gz = { s: 1, ox: 50, oy: 50, tx: 0, ty: 0 }; // gallery zoom state
let _viewMode = localStorage.getItem('dental-view') || 'grid';
let _currentPage = 'home';
let _isPopState = false;
let _modalPushed = false;

// ── 데이터 로드 ───────────────────────────────────────────────
const _CACHE_KEY_CASES    = 'dental_cache_cases';
const _CACHE_KEY_CONTENTS = 'dental_cache_contents';
const _CACHE_KEY_TS       = 'dental_cache_ts';
const _CACHE_TTL          = 3 * 60 * 1000; // 3분

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
  const now = Date.now();
  // 캐시가 있으면 즉시 표시 (빠른 초기 렌더)
  try {
    const cc = localStorage.getItem(_CACHE_KEY_CASES);
    const ct = localStorage.getItem(_CACHE_KEY_CONTENTS);
    if (cc && ct) {
      allCases    = JSON.parse(cc);
      allContents = _sortContents(JSON.parse(ct));
      _renderAll();
    }
  } catch(e) {}

  // 항상 Firestore에서 최신 데이터를 가져와 갱신
  const [casesSnap, contentsSnap, deptsSnap] = await Promise.all([
    db.collection("cases").orderBy("date", "desc").get(),
    db.collection("departmentContents").orderBy("createdAt", "desc").get(),
    db.collection("departments").orderBy("order", "asc").get().catch(() => null)
  ]);

  allCases    = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allContents = _sortContents(contentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

  if (deptsSnap && deptsSnap.docs.length) {
    _initDeptDOM(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  try {
    localStorage.setItem(_CACHE_KEY_CASES,    JSON.stringify(allCases));
    localStorage.setItem(_CACHE_KEY_CONTENTS, JSON.stringify(allContents));
    localStorage.setItem(_CACHE_KEY_TS,       String(now));
  } catch(e) {}

  _renderAll();
}

// ── Navigation ────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  const navLink = document.querySelector(`nav a[data-page="${pageId}"]`);
  if (navLink) navLink.classList.add('active');
  window.scrollTo(0, 0);
  _currentPage = pageId;
  if (!_isPopState) {
    history.pushState({ page: pageId }, '');
  }
}

// ── Home ──────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('dept-grid-home');
  grid.innerHTML = _departments.map(d => {
    const count = allContents.filter(c => c.department === d.id).length;
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
}

// ── Clinical Cases ─────────────────────────────────────────────
function renderCases(filter = '', deptFilter = '') {
  const list = allCases.filter(c => {
    const q = filter.trim();
    const matchText = !q || c.title.includes(q) || (c.summary||'').includes(q) || (c.tags||[]).some(t => t.includes(q));
    const matchDept = !deptFilter || c.department === deptFilter;
    const matchBm   = !_showBmOnly || _bookmarks.has(c.id);
    return matchText && matchDept && matchBm;
  });
  const el = document.getElementById('cases-grid');
  el.className = _viewMode === 'list' ? 'card-grid list-view' : 'card-grid';
  el.innerHTML = list.length ? list.map(c => cardHTML(c, 'case')).join('') :
    '<div class="empty">검색 결과가 없습니다.</div>';
}

// ── Department pages ───────────────────────────────────────────
function renderDeptPages() {
  _departments.forEach(d => {
    const container = document.getElementById(`dept-content-${d.id}`);
    if (!container) return;
    const items = allContents.filter(c => c.department === d.id);
    container.className = _viewMode === 'list' ? 'card-grid list-view' : 'card-grid';
    container.innerHTML = items.length ? items.map(c => cardHTML(c, 'content')).join('') :
      '<div class="empty">등록된 자료가 없습니다.</div>';
  });
}

function filterDept(deptId, filter = '') {
  const items = allContents.filter(c => {
    const q = filter.trim();
    return c.department === deptId && (!q || c.title.includes(q) || (c.summary||'').includes(q));
  });
  const container = document.getElementById(`dept-content-${deptId}`);
  container.className = _viewMode === 'list' ? 'card-grid list-view' : 'card-grid';
  container.innerHTML = items.length ? items.map(c => cardHTML(c, 'content')).join('') :
    '<div class="empty">검색 결과가 없습니다.</div>';
}
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

  // Generate dept page divs
  const pagesContainer = document.getElementById('dept-pages-container');
  if (pagesContainer) {
    const activeDeptId = _currentPage && _currentPage.startsWith('dept-') ? _currentPage : null;
    pagesContainer.innerHTML = depts.map(d => `
      <div id="page-dept-${d.id}" class="page${activeDeptId === 'dept-' + d.id ? ' active' : ''}">
        <div class="section-header"><div class="section-title">${_deptIconHtml(d)}${_esc(d.name)}</div></div>
        <div class="toolbar">
          <input class="search-input" type="text" placeholder="자료 검색..." oninput="_filterDeptDebounced('${d.id}',this.value)">
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
  const dept = _departments.find(d => d.id === item.department);
  const deptName = dept ? dept.name : '';
  const firstPhoto = item.photos && item.photos[0];
  const thumb = firstPhoto
    ? `<div class="card-thumb"><img src="${_cldCard(firstPhoto.url)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span>🦷</span>'"></div>`
    : `<div class="card-thumb"><span>🦷</span></div>`;
  const tags = (item.tags || []).map(t =>
    `<span class="tag" onclick="event.stopPropagation();_filterByTag(this.dataset.tag)" data-tag="${_esc(t).replace(/"/g,'&quot;')}">${_esc(t)}</span>`
  ).join('');
  const isBm = _bookmarks.has(item.id);
  const bmBtn = `<button class="card-bm-btn${isBm?' active':''}" data-bm-id="${item.id}" onclick="event.stopPropagation();_toggleBookmark('${item.id}')" title="${isBm?'북마크 해제':'북마크'}">★</button>`;
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
        <div class="card-dept">${deptName}</div>
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

  const dept = _departments.find(d => d.id === item.department);
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
      `<span class="tag" onclick="closeModal();_filterByTag(this.dataset.tag)" data-tag="${_esc(t).replace(/"/g,'&quot;')}">${_esc(t)}</span>`
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
function printCase() {
  const item = _currentModalItem?.item;
  if (!item) return;
  const dept = _departments.find(d => d.id === item.department);

  const photosHTML = (item.photos || []).map(p => `
    <div class="print-photo-item">
      <img src="${_esc(p.url)}" alt="${_esc(p.caption||'')}">
      ${p.caption ? `<div class="print-caption">${_esc(p.caption)}</div>` : ''}
    </div>`).join('');

  const tagsHTML = (item.tags || []).map(t =>
    `<span class="print-tag">${_esc(t)}</span>`).join('');

  const refsHTML = (item.references || []).length
    ? `<div class="print-section-label">참고 논문</div>
       <ol class="print-refs">${(item.references||[]).map(r => {
         const title = r.title ? `<strong>${_esc(r.title)}</strong>` : '';
         const doi   = r.doi   ? ` — <a href="https://doi.org/${_esc(r.doi)}" target="_blank">doi:${_esc(r.doi)}</a>` : '';
         const url   = (!r.doi && r.url) ? ` — <a href="${_esc(r.url)}" target="_blank">${_esc(r.url)}</a>` : '';
         return `<li>${title}${doi}${url}</li>`;
       }).join('')}</ol>` : '';

  const teethHTML = (item.teeth && item.teeth.length)
    ? `<div class="print-section-label">치식</div>
       <div class="print-teeth-wrap">${_renderToothChartHTML(item.teeth, false)}</div>` : '';

  const descText = (item.description || '').trim();
  const descHTML = descText
    ? `<div class="print-section-label">설명</div>
       <div class="print-desc">${marked.parse(descText)}</div>` : '';

  const printArea = document.getElementById('print-area');
  printArea.innerHTML = `
    <div class="print-header">
      ${dept ? `<div class="print-dept-tag">${_esc(dept.name)}</div>` : ''}
      <div class="print-title">${_esc(item.title)}</div>
      ${item.date ? `<div class="print-date">${_esc(item.date)}</div>` : ''}
    </div>
    ${teethHTML}
    ${photosHTML ? `<div class="print-section-label">사진 (${(item.photos||[]).length}장)</div>
       <div class="print-photos">${photosHTML}</div>` : ''}
    ${descHTML}
    ${tagsHTML ? `<div class="print-tags">${tagsHTML}</div>` : ''}
    ${refsHTML}
    <div class="print-footer">
      <span>치과 임상 자료실 · ${_esc(location.href)}</span>
      <span>${new Date().toLocaleDateString('ko-KR')}</span>
    </div>`;

  // details 요소 인쇄 시 모두 펼치기
  printArea.querySelectorAll('details').forEach(d => d.open = true);
  _renderMath(printArea);

  window.print();
}

// ── References ─────────────────────────────────────────────────
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderRefs(refs) {
  const el      = document.getElementById('modal-refs');
  const section = document.getElementById('refs-section');
  if (!refs.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  el.innerHTML = refs.map((r, i) => {
    const doiLink  = r.doi ? `<a href="https://doi.org/${r.doi}" target="_blank" class="ref-doi-link">DOI ↗</a>` : '';
    const hasAbs   = r.abstract || r.abstractEn;
    const absBtn   = hasAbs ? `<button class="ref-abs-toggle" onclick="toggleRefAbs(this,'ref-abs-${i}')">초록 ▼</button>` : '';
    let absContent = '';
    if (r.abstractEn) absContent += `<div class="ref-abs-section"><div class="ref-abs-label">영문</div><div>${_esc(r.abstractEn).replace(/\n/g,'<br>')}</div></div>`;
    if (r.abstract)   absContent += `<div class="ref-abs-section"><div class="ref-abs-label">한글</div><div>${_esc(r.abstract).replace(/\n/g,'<br>')}</div></div>`;
    const absBlock = hasAbs ? `<div class="ref-abstract-text" id="ref-abs-${i}" style="display:none">${absContent}</div>` : '';
    return `<li><div class="ref-main"><strong>${_esc(r.authors)}</strong> (${_esc(r.year)}). ${_esc(r.title)}. <em>${_esc(r.journal)}</em>${r.volume?', '+_esc(r.volume):''}${r.pages?', '+_esc(r.pages):''}. ${doiLink}${absBtn}</div>${absBlock}</li>`;
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

  await loadData();

  const _h = location.hash.slice(1);
  if (_h) { const _m = _h.match(/^(case|content)-(.+)$/); if (_m) openModal(_m[2], _m[1]); }

  // 뒤로가기 핸들러
  window.addEventListener('popstate', e => {
    const state = e.state || { page: 'home' };
    const modalEl = document.getElementById('modal-overlay');
    const modalOpen = modalEl.classList.contains('open');
    const fsOv = document.getElementById('fs-gallery');
    const fsOpen = fsOv && fsOv.classList.contains('open');

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
  document.getElementById('editor-overlay').addEventListener('click', e => {
    if (e.target.id === 'editor-overlay') closeEditor();
  });
  document.addEventListener('keydown', e => {
    const presOpen = document.getElementById('pres-overlay')?.classList.contains('open');
    if (presOpen) {
      if (e.key === 'Escape') _closePresentation();
      if (e.key === 'ArrowLeft')  _presGo(-1);
      if (e.key === 'ArrowRight') _presGo(1);
      return;
    }
    if (e.key === 'Escape') { _closeSearch(); closeModal(); closeEditor(); _annCancel(); }
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


  firebase.auth().onAuthStateChanged(user => {
    isAdmin = !!user;
    _updateAdminBadge(user);
    renderHome();
    renderCases();
    renderDeptPages();
    _injectAdminControls();
  });

  // 인용 위첨자 툴팁
  _setupCiteTip();
});

// ════════════════════════════════════════════════════════════════
// 관리자 인라인 에디터
// ════════════════════════════════════════════════════════════════

let _edId = null, _edType = null;
let _edPhotos = [], _edTags = [], _edTeeth = [];
// _edTeeth: [{n: 16, type: 'implant'}, ...]
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

  document.addEventListener('mouseup', () => {
    if (_tcDragging) {
      _tcDragging = false;
      if (_tcDragMoved && _tcMultiSel.size > 0) _updateMultiBar();
    }
  });

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
  const ov = document.createElement('div');
  ov.id = 'dept-mgr-modal';
  ov.className = 'modal-overlay active';
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
  el.innerHTML = _departments.map(d => {
    const iconHtml = d.iconImg
      ? `<img src="${_esc(d.iconImg)}" style="width:1.2em;height:1.2em;vertical-align:middle">`
      : (d.icon || '📁');
    const count = allContents.filter(c => c.department === d.id).length;
    return `
      <div style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.7rem;border-radius:8px;background:var(--card-bg);margin-bottom:0.35rem">
        <span style="font-size:1.1em;width:1.5em;text-align:center">${iconHtml}</span>
        <span style="flex:1;font-weight:500">${_esc(d.name)}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);margin-right:0.2rem">${d.id} · ${count}건</span>
        <button onclick="_deleteDept('${d.id}')" style="padding:0.3rem 0.65rem;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:0.78rem;cursor:pointer">삭제</button>
      </div>`;
  }).join('');
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
function closeEditor() {
  document.getElementById('editor-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _edId = null; _edType = null; _edPhotos = []; _edTags = [];
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
  _edRenderPhotoPreview();
  _edRenderTagChips();
  _edSetupTextareaDrop();
  _setupTcDrag();
}

function _edFormHTML(d = {}) {
  function ea(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
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
        <div style="font-size:0.8rem;margin-top:0.3rem;color:var(--text-muted)">여러 장 동시 선택 가능</div>
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
        ${(d.references||[]).map((r,i) => _edRefBlockHTML(i, r, ea)).join('')}
      </div>
    </div>

    <div style="display:flex;gap:0.75rem;justify-content:flex-end">
      <button class="btn btn-outline" onclick="closeEditor()">취소</button>
      <button class="btn btn-primary" id="ed-save-btn" onclick="_edSave()">
        ${_edId ? '저장' : '등록'}
      </button>
    </div>`;
}

function _edRefBlockHTML(idx, r, ea) {
  if (!ea) ea = s => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
  if (val && !_edTags.includes(val)) { _edTags.push(val); _edRenderTagChips(); }
  e.target.value = '';
}
function _edRemoveTag(idx) { _edTags.splice(idx, 1); _edRenderTagChips(); }
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
}
function _edRenderPhotoPreview() {
  const el = document.getElementById('ed-photo-preview');
  if (!el) return;
  el.innerHTML = _edPhotos.map((p,i) => {
    const cnt = (p.annotations||[]).length;
    return `
    <div class="photo-preview-item">
      <img src="${p.url}" alt="">
      <button class="photo-remove" onclick="_edRemovePhoto(${i})">✕</button>
      <button class="photo-ann-btn" onclick="openAnnotationEditor(${i})" title="주석 편집">✏️${cnt > 0 ? `<span class="ann-count">${cnt}</span>` : ''}</button>
      <input class="caption-input" type="text" placeholder="사진 설명 (선택)"
        value="${p.caption}" oninput="_edPhotos[${i}].caption=this.value">
    </div>`;
  }).join('');
}
function _edRemovePhoto(idx) { _edPhotos.splice(idx, 1); _edRenderPhotoPreview(); }

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
    ['authors','year','title','journal','pages','doi','abstract','abstract-en','results'].forEach(f => {
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

// ── Cloudinary 업로드 ─────────────────────────────────────────
async function _edUploadPhotos() {
  const progWrap = document.getElementById('ed-progress');
  const progBar  = document.getElementById('ed-progress-bar');
  const toUpload = _edPhotos.filter(p => p.file);
  if (!toUpload.length) return _edPhotos.map(p => ({ url: p.url, caption: p.caption, annotations: p.annotations||[] }));
  progWrap.style.display = 'block';
  let done = 0;
  const results = [];
  for (const photo of _edPhotos) {
    if (!photo.file) { results.push({ url: photo.url, caption: photo.caption, annotations: photo.annotations||[] }); continue; }
    const fd = new FormData();
    fd.append('file', photo.file);
    fd.append('upload_preset', cloudinaryConfig.uploadPreset);
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || '업로드 실패');
    results.push({ url: data.secure_url, caption: photo.caption, annotations: photo.annotations||[] });
    done++;
    progBar.style.width = `${Math.round(done / toUpload.length * 100)}%`;
  }
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
    const col = _edType === 'case' ? 'cases' : 'departmentContents';
    if (_edId) {
      await db.collection(col).doc(_edId).update(docData);
    } else {
      docData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(col).add(docData);
    }
    _edToast('저장되었습니다.');
    closeEditor();
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
}

function setViewMode(mode) {
  _viewMode = mode;
  localStorage.setItem('dental-view', mode);
  document.querySelectorAll('.view-toggle-btn[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.querySelectorAll('.card-grid').forEach(el => {
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
  const all = [...allCases, ...allContents];
  const freq = {};
  all.forEach(item => (item.tags || []).forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  document.getElementById('search-tag-cloud').innerHTML = sorted.map(([t]) =>
    `<button class="search-tag-chip" onclick="_searchByTag('${_esc(t).replace(/'/g,"\\'")}')">🏷 ${_esc(t)}</button>`
  ).join('');
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
  const all = [
    ...allCases.map(c => ({ ...c, _type: 'case' })),
    ...allContents.map(c => ({ ...c, _type: 'content' }))
  ];
  const results = all.filter(c =>
    c.title.includes(q) || (c.summary||'').includes(q) || (c.tags||[]).some(t => t.includes(q))
  ).slice(0, 20);
  const dept = id => _departments.find(d => d.id === id);
  document.getElementById('search-results-list').innerHTML = results.length
    ? results.map(c => `
        <div class="search-result-item" onclick="_closeSearch();setTimeout(()=>openModal('${c.id}','${c._type}'),200)">
          <div class="search-result-title">${_esc(c.title)}</div>
          <div class="search-result-meta">${dept(c.department)?.name || ''} · ${c.date || ''}</div>
        </div>`).join('')
    : '<div class="search-empty">검색 결과가 없습니다.</div>';
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
  const dept = _departments.find(d => d.id === item.department);
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
        <img src="${_cldGallery(slide.photo.url)}" alt="${_esc(slide.photo.caption || '')}">
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
    if (el.dataset.href) {
      window.open(el.dataset.href, '_blank', 'noopener');
      return;
    }
    // 링크 없는 경우(교과서 등): 툴팁 토글
    if (tip.style.display === 'none' || tip.dataset.for !== el.dataset.n) {
      tip.dataset.for = el.dataset.n;
      show(el);
    } else {
      tip.style.display = 'none';
    }
  });
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

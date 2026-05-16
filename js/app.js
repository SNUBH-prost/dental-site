// ── Firebase 초기화 ───────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const DEPARTMENTS = [
  { id: "surgery",          name: "외과 / 치주과",   icon: "🦷" },
  { id: "medicine",         name: "내과",            icon: "🩺" },
  { id: "conservative",     name: "보존과",           icon: "🔬" },
  { id: "orthodontics",     name: "교정과",           icon: "📐" },
  { id: "prost-fixed",      name: "보철 — 고정성",   icon: "🦷" },
  { id: "prost-implant",    name: "보철 — 임플란트", icon: "⚙️"  },
  { id: "prost-removable",  name: "보철 — 가철성",   icon: "🔩" },
  { id: "prost-materials",  name: "보철 — 재료",     icon: "🧪" }
];

let allCases = [];
let allContents = [];
let currentPhotos = [];
let currentPhotoIndex = 0;

// ── 데이터 로드 ───────────────────────────────────────────────
async function loadData() {
  const [casesSnap, contentsSnap] = await Promise.all([
    db.collection("cases").orderBy("date", "desc").get(),
    db.collection("departmentContents").orderBy("date", "desc").get()
  ]);

  allCases    = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allContents = contentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderHome();
  renderCases();
  renderDeptPages();
}

// ── Navigation ────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  const navLink = document.querySelector(`nav a[data-page="${pageId}"]`);
  if (navLink) navLink.classList.add('active');
  window.scrollTo(0, 0);
}

// ── Home ──────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('dept-grid-home');
  grid.innerHTML = DEPARTMENTS.map(d => {
    const count = allContents.filter(c => c.department === d.id).length;
    return `
      <div class="dept-card" onclick="showPage('dept-${d.id}')">
        <div class="icon">${d.icon}</div>
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
    return matchText && matchDept;
  });
  const el = document.getElementById('cases-grid');
  el.innerHTML = list.length ? list.map(c => cardHTML(c, 'case')).join('') :
    '<div class="empty">검색 결과가 없습니다.</div>';
}

// ── Department pages ───────────────────────────────────────────
function renderDeptPages() {
  DEPARTMENTS.forEach(d => {
    const container = document.getElementById(`dept-content-${d.id}`);
    if (!container) return;
    const items = allContents.filter(c => c.department === d.id);
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
  container.innerHTML = items.length ? items.map(c => cardHTML(c, 'content')).join('') :
    '<div class="empty">검색 결과가 없습니다.</div>';
}

// ── Card HTML ──────────────────────────────────────────────────
function cardHTML(item, type) {
  const dept = DEPARTMENTS.find(d => d.id === item.department);
  const deptName = dept ? dept.name : '';
  const firstPhoto = item.photos && item.photos[0];
  const thumb = firstPhoto
    ? `<div class="card-thumb"><img src="${firstPhoto.url}" alt="" onerror="this.parentElement.innerHTML='<span>🦷</span>'"></div>`
    : `<div class="card-thumb"><span>🦷</span></div>`;
  const tags = (item.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
  return `
    <div class="card" onclick="openModal('${item.id}','${type}')">
      ${thumb}
      <div class="card-body">
        <div class="card-dept">${deptName}</div>
        <div class="card-title">${item.title}</div>
        <div class="card-summary">${item.summary || ''}</div>
        <div class="card-meta">
          <span>${item.date || ''}</span>
          ${item.photos ? `<span>사진 ${item.photos.length}장</span>` : ''}
        </div>
        ${tags ? `<div class="modal-tags" style="margin-top:0.5rem">${tags}</div>` : ''}
      </div>
    </div>`;
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(id, type) {
  const item = type === 'case'
    ? allCases.find(c => c.id === id)
    : allContents.find(c => c.id === id);
  if (!item) return;

  const dept = DEPARTMENTS.find(d => d.id === item.department);
  currentPhotos = item.photos || [];
  currentPhotoIndex = 0;

  document.getElementById('modal-dept').textContent  = dept ? dept.name : '';
  document.getElementById('modal-title').textContent = item.title;
  document.getElementById('modal-date').textContent  = item.date || '';
  document.getElementById('modal-description').textContent = item.description || '';
  document.getElementById('modal-tags').innerHTML = (item.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('');

  renderRefs(item.references || []);
  renderGallery();

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
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
      <img id="gallery-main-img" src="${p.url}" alt="${p.caption||''}">
      <div class="gallery-caption" id="gallery-caption">${p.caption||''}</div>
      <div class="gallery-counter" id="gallery-counter">${currentPhotoIndex+1} / ${currentPhotos.length}</div>
      ${currentPhotos.length > 1 ? `
        <button class="gallery-nav prev" onclick="changePhoto(-1)">&#8249;</button>
        <button class="gallery-nav next" onclick="changePhoto(1)">&#8250;</button>` : ''}
    </div>
    <div class="gallery-thumbs">
      ${currentPhotos.map((ph,i)=>`
        <img src="${ph.url}" alt="" class="${i===0?'active':''}" onclick="gotoPhoto(${i})"
          onerror="this.style.display='none'">`).join('')}
    </div>`;
}

function changePhoto(dir) {
  currentPhotoIndex = (currentPhotoIndex + dir + currentPhotos.length) % currentPhotos.length;
  updateGallery();
}

function gotoPhoto(i) {
  currentPhotoIndex = i;
  updateGallery();
}

function updateGallery() {
  const p = currentPhotos[currentPhotoIndex];
  document.getElementById('gallery-main-img').src = p.url;
  document.getElementById('gallery-caption').textContent = p.caption || '';
  document.getElementById('gallery-counter').textContent = `${currentPhotoIndex+1} / ${currentPhotos.length}`;
  document.querySelectorAll('.gallery-thumbs img').forEach((img,i) =>
    img.classList.toggle('active', i === currentPhotoIndex));
}

// ── References ─────────────────────────────────────────────────
function renderRefs(refs) {
  const el      = document.getElementById('modal-refs');
  const section = document.getElementById('refs-section');
  if (!refs.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  el.innerHTML = refs.map(r => {
    const doiLink = r.doi ? `<a href="https://doi.org/${r.doi}" target="_blank">DOI</a>` : '';
    return `<li><strong>${r.authors}</strong> (${r.year}). ${r.title}. <em>${r.journal}</em>${r.volume?', '+r.volume:''}${r.pages?', '+r.pages:''}. ${doiLink}</li>`;
  }).join('');
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (document.getElementById('modal-overlay').classList.contains('open')) {
      if (e.key === 'ArrowLeft')  changePhoto(-1);
      if (e.key === 'ArrowRight') changePhoto(1);
    }
  });
});

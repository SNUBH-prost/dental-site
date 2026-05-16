// ── Firebase 초기화 ───────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

const DEPARTMENTS = [
  { id: "surgery",         name: "외과 / 치주과"   },
  { id: "medicine",        name: "내과"            },
  { id: "conservative",    name: "보존과"           },
  { id: "orthodontics",    name: "교정과"           },
  { id: "prost-fixed",     name: "보철 — 고정성"   },
  { id: "prost-implant",   name: "보철 — 임플란트" },
  { id: "prost-removable", name: "보철 — 가철성"   },
  { id: "prost-materials", name: "보철 — 재료"     }
];

// 편집 중인 항목 ID
let editingCaseId    = null;
let editingContentId = null;

// 사진 상태 (기존 URL + 새 파일)
let casePhotos    = [];   // {url, caption, file?}
let contentPhotos = [];

// 태그 상태
let caseTags    = [];
let contentTags = [];

// ── Auth ──────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('admin-screen').style.display  = 'block';
    document.getElementById('user-email-display').textContent = user.email;
    loadCasesList();
    loadContentsList();
    renderCaseForm();
    renderContentForm();
  } else {
    document.getElementById('login-screen').style.display  = 'flex';
    document.getElementById('admin-screen').style.display  = 'none';
  }
});

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value;
  const btn   = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled  = true;
  errEl.style.display = 'none';
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch(e) {
    errEl.textContent   = '로그인 실패: 이메일 또는 비밀번호를 확인하세요.';
    errEl.style.display = 'block';
    btn.textContent     = '로그인';
    btn.disabled        = false;
  }
}

function doLogout() {
  auth.signOut();
}

// ── Navigation ────────────────────────────────────────────────
function switchPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent  = msg;
  t.className    = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── 케이스 목록 ───────────────────────────────────────────────
async function loadCasesList() {
  const snap = await db.collection('cases').orderBy('date','desc').get();
  const el   = document.getElementById('cases-list-content');
  if (snap.empty) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">등록된 케이스가 없습니다.</p>'; return; }
  el.innerHTML = `<div class="item-list">${snap.docs.map(d => {
    const c    = d.data();
    const dept = DEPARTMENTS.find(x => x.id === c.department);
    return `
      <div class="item-row">
        <div class="item-row-info">
          <div class="item-row-dept">${dept ? dept.name : ''}</div>
          <div class="item-row-title">${c.title}</div>
          <div class="item-row-meta">${c.date || ''} · 사진 ${(c.photos||[]).length}장</div>
        </div>
        <div class="item-row-actions">
          <button class="btn btn-outline btn-sm" onclick="editCase('${d.id}')">편집</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteItem('cases','${d.id}')">삭제</button>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ── 자료 목록 ─────────────────────────────────────────────────
async function loadContentsList() {
  const snap = await db.collection('departmentContents').orderBy('date','desc').get();
  const el   = document.getElementById('contents-list-content');
  if (snap.empty) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">등록된 자료가 없습니다.</p>'; return; }
  el.innerHTML = `<div class="item-list">${snap.docs.map(d => {
    const c    = d.data();
    const dept = DEPARTMENTS.find(x => x.id === c.department);
    return `
      <div class="item-row">
        <div class="item-row-info">
          <div class="item-row-dept">${dept ? dept.name : ''}</div>
          <div class="item-row-title">${c.title}</div>
          <div class="item-row-meta">${c.date || ''} · 사진 ${(c.photos||[]).length}장</div>
        </div>
        <div class="item-row-actions">
          <button class="btn btn-outline btn-sm" onclick="editContent('${d.id}')">편집</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteItem('departmentContents','${d.id}')">삭제</button>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ── 삭제 ─────────────────────────────────────────────────────
async function deleteItem(collection, id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await db.collection(collection).doc(id).delete();
  showToast('삭제되었습니다.');
  if (collection === 'cases') loadCasesList();
  else loadContentsList();
}

// ── 케이스 폼 렌더 ────────────────────────────────────────────
function renderCaseForm(data = {}) {
  casePhotos = (data.photos || []).map(p => ({ url: p.url, caption: p.caption || '' }));
  caseTags   = data.tags ? [...data.tags] : [];
  document.getElementById('case-form-title').textContent = editingCaseId ? '케이스 편집' : '새 임상 케이스';
  document.getElementById('case-form-content').innerHTML = formHTML('case', data);
  renderPhotoPreview('case');
  renderTagChips('case');
}

function renderContentForm(data = {}) {
  contentPhotos = (data.photos || []).map(p => ({ url: p.url, caption: p.caption || '' }));
  contentTags   = data.tags ? [...data.tags] : [];
  document.getElementById('content-form-title').textContent = editingContentId ? '자료 편집' : '새 각과 자료';
  document.getElementById('content-form-content').innerHTML = formHTML('content', data);
  renderPhotoPreview('content');
  renderTagChips('content');
}

function formHTML(type, d = {}) {
  const deptOptions = DEPARTMENTS.map(dept =>
    `<option value="${dept.id}" ${d.department === dept.id ? 'selected' : ''}>${dept.name}</option>`
  ).join('');
  return `
    <div class="form-card">
      <div class="form-grid">
        <div class="form-group full">
          <label>제목 *</label>
          <input type="text" id="${type}-title" value="${d.title || ''}" placeholder="케이스/자료 제목">
        </div>
        <div class="form-group">
          <label>진료과 *</label>
          <select id="${type}-dept">${deptOptions}</select>
        </div>
        <div class="form-group">
          <label>날짜</label>
          <input type="date" id="${type}-date" value="${d.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group full">
          <label>한 줄 요약</label>
          <input type="text" id="${type}-summary" value="${d.summary || ''}" placeholder="목록에 표시되는 짧은 설명">
        </div>
        <div class="form-group full">
          <label>상세 설명</label>
          <textarea id="${type}-description" rows="5" placeholder="케이스/자료 상세 내용">${d.description || ''}</textarea>
        </div>
        <div class="form-group full">
          <label>태그</label>
          <div class="tag-input-wrap" onclick="document.getElementById('${type}-tag-input').focus()">
            <div id="${type}-tag-chips"></div>
            <input class="tag-input" id="${type}-tag-input" placeholder="태그 입력 후 Enter"
              onkeydown="handleTagInput(event,'${type}')">
          </div>
        </div>
      </div>
    </div>

    <!-- 사진 업로드 -->
    <div class="form-card">
      <div class="section-label">사진 업로드</div>
      <div class="upload-zone" id="${type}-upload-zone"
        onclick="document.getElementById('${type}-file-input').click()"
        ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="handleDrop(event,'${type}')">
        <input type="file" id="${type}-file-input" multiple accept="image/*"
          onchange="handleFileSelect(event,'${type}')">
        <div style="font-size:2rem;margin-bottom:0.5rem">📷</div>
        <div>사진을 여기에 드래그하거나 클릭하여 선택</div>
        <div style="font-size:0.8rem;margin-top:0.3rem;color:var(--text-muted)">여러 장 동시 선택 가능</div>
      </div>
      <div class="upload-progress" id="${type}-progress">
        <div class="upload-progress-bar" id="${type}-progress-bar"></div>
      </div>
      <div class="photo-preview-list" id="${type}-photo-preview"></div>
    </div>

    <!-- 참고 논문 -->
    <div class="form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
        <div class="section-label" style="margin:0">참고 논문</div>
        <button class="btn btn-outline btn-sm" onclick="addRef('${type}')">+ 논문 추가</button>
      </div>
      <div id="${type}-refs-container">
        ${(d.references||[]).map((r,i) => refBlockHTML(type, i, r)).join('')}
      </div>
    </div>

    <!-- 저장 버튼 -->
    <div style="display:flex;gap:0.75rem;justify-content:flex-end">
      <button class="btn btn-outline" onclick="cancelEdit('${type}')">취소</button>
      <button class="btn btn-primary" id="${type}-save-btn" onclick="saveItem('${type}')">
        ${type === 'case' ? (editingCaseId ? '케이스 저장' : '케이스 등록') : (editingContentId ? '자료 저장' : '자료 등록')}
      </button>
    </div>`;
}

function refBlockHTML(type, idx, r = {}) {
  return `
    <div class="ref-block" id="${type}-ref-${idx}">
      <button class="btn btn-danger btn-sm ref-remove" onclick="removeRef('${type}',${idx})">✕</button>
      <div class="ref-grid">
        <div class="form-group"><label>저자</label>
          <input type="text" id="${type}-ref-authors-${idx}" value="${r.authors||''}" placeholder="저자명"></div>
        <div class="form-group"><label>연도</label>
          <input type="text" id="${type}-ref-year-${idx}" value="${r.year||''}" placeholder="2024"></div>
        <div class="form-group" style="grid-column:1/-1"><label>논문 제목</label>
          <input type="text" id="${type}-ref-title-${idx}" value="${r.title||''}" placeholder="논문 제목"></div>
        <div class="form-group"><label>저널명</label>
          <input type="text" id="${type}-ref-journal-${idx}" value="${r.journal||''}" placeholder="저널명"></div>
        <div class="form-group"><label>권호/페이지</label>
          <input type="text" id="${type}-ref-pages-${idx}" value="${(r.volume?r.volume+', ':''+(r.pages||''))}" placeholder="73(1), 7-21"></div>
        <div class="form-group"><label>DOI (선택)</label>
          <input type="text" id="${type}-ref-doi-${idx}" value="${r.doi||''}" placeholder="10.xxxx/xxxxx"></div>
      </div>
    </div>`;
}

function addRef(type) {
  const container = document.getElementById(`${type}-refs-container`);
  const idx = container.querySelectorAll('.ref-block').length;
  container.insertAdjacentHTML('beforeend', refBlockHTML(type, idx));
}

function removeRef(type, idx) {
  document.getElementById(`${type}-ref-${idx}`).remove();
  renumberRefs(type);
}

function renumberRefs(type) {
  const blocks = document.querySelectorAll(`#${type}-refs-container .ref-block`);
  blocks.forEach((block, i) => {
    block.id = `${type}-ref-${i}`;
    block.querySelector('.ref-remove').setAttribute('onclick', `removeRef('${type}',${i})`);
    ['authors','year','title','journal','pages','doi'].forEach(f => {
      const el = block.querySelector(`[id$="-${f}-"]`) ||
                 block.querySelector(`[id*="-ref-${f}-"]`);
      if (el) el.id = `${type}-ref-${f}-${i}`;
    });
  });
}

// ── 태그 ──────────────────────────────────────────────────────
function handleTagInput(e, type) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (!val) return;
    const tags = type === 'case' ? caseTags : contentTags;
    if (!tags.includes(val)) { tags.push(val); renderTagChips(type); }
    e.target.value = '';
  }
}

function removeTag(type, idx) {
  const tags = type === 'case' ? caseTags : contentTags;
  tags.splice(idx, 1);
  renderTagChips(type);
}

function renderTagChips(type) {
  const tags = type === 'case' ? caseTags : contentTags;
  document.getElementById(`${type}-tag-chips`).innerHTML =
    tags.map((t,i) => `
      <span class="tag-chip">${t}
        <button type="button" onclick="removeTag('${type}',${i})">✕</button>
      </span>`).join('');
}

// ── 사진 처리 ─────────────────────────────────────────────────
function handleFileSelect(e, type) {
  addFiles(Array.from(e.target.files), type);
  e.target.value = '';
}

function handleDrop(e, type) {
  e.preventDefault();
  document.getElementById(`${type}-upload-zone`).classList.remove('dragover');
  addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')), type);
}

function addFiles(files, type) {
  const photos = type === 'case' ? casePhotos : contentPhotos;
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    photos.push({ url, caption: '', file });
  });
  renderPhotoPreview(type);
}

function renderPhotoPreview(type) {
  const photos = type === 'case' ? casePhotos : contentPhotos;
  const el = document.getElementById(`${type}-photo-preview`);
  el.innerHTML = photos.map((p, i) => `
    <div class="photo-preview-item">
      <img src="${p.url}" alt="">
      <button class="photo-remove" onclick="removePhoto('${type}',${i})">✕</button>
      <input class="caption-input" type="text" placeholder="사진 설명 (선택)"
        value="${p.caption}" oninput="updateCaption('${type}',${i},this.value)">
    </div>`).join('');
}

function removePhoto(type, idx) {
  const photos = type === 'case' ? casePhotos : contentPhotos;
  photos.splice(idx, 1);
  renderPhotoPreview(type);
}

function updateCaption(type, idx, val) {
  const photos = type === 'case' ? casePhotos : contentPhotos;
  photos[idx].caption = val;
}

// ── 사진 Cloudinary 업로드 ────────────────────────────────────
async function uploadPhotos(type) {
  const photos   = type === 'case' ? casePhotos : contentPhotos;
  const progWrap = document.getElementById(`${type}-progress`);
  const progBar  = document.getElementById(`${type}-progress-bar`);
  const toUpload = photos.filter(p => p.file);
  if (!toUpload.length) return photos.map(p => ({ url: p.url, caption: p.caption }));

  progWrap.style.display = 'block';
  let done = 0;
  const results = [];

  for (const photo of photos) {
    if (!photo.file) {
      results.push({ url: photo.url, caption: photo.caption });
      continue;
    }
    const formData = new FormData();
    formData.append('file', photo.file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || '업로드 실패');

    results.push({ url: data.secure_url, caption: photo.caption });
    done++;
    progBar.style.width = `${Math.round((done / toUpload.length) * 100)}%`;
  }

  progWrap.style.display = 'none';
  progBar.style.width    = '0%';
  return results;
}

// ── 레퍼런스 수집 ─────────────────────────────────────────────
function collectRefs(type) {
  const blocks = document.querySelectorAll(`#${type}-refs-container .ref-block`);
  return Array.from(blocks).map((_, i) => {
    const g = id => (document.getElementById(`${type}-ref-${id}-${i}`) || {value:''}).value.trim();
    const pages = g('pages');
    const dashIdx = pages.indexOf(', ');
    return {
      authors: g('authors'),
      year:    g('year'),
      title:   g('title'),
      journal: g('journal'),
      volume:  dashIdx > -1 ? pages.slice(0, dashIdx) : '',
      pages:   dashIdx > -1 ? pages.slice(dashIdx + 2) : pages,
      doi:     g('doi')
    };
  }).filter(r => r.title || r.authors);
}

// ── 저장 ─────────────────────────────────────────────────────
async function saveItem(type) {
  const isCase  = type === 'case';
  const titleEl = document.getElementById(`${type}-title`);
  if (!titleEl.value.trim()) { showToast('제목을 입력하세요.', 'error'); return; }

  const btn = document.getElementById(`${type}-save-btn`);
  btn.innerHTML = '<span class="spinner"></span> 저장 중...';
  btn.disabled  = true;

  try {
    const photos = await uploadPhotos(type);
    const tags   = isCase ? caseTags : contentTags;

    const docData = {
      title:       document.getElementById(`${type}-title`).value.trim(),
      department:  document.getElementById(`${type}-dept`).value,
      date:        document.getElementById(`${type}-date`).value,
      summary:     document.getElementById(`${type}-summary`).value.trim(),
      description: document.getElementById(`${type}-description`).value.trim(),
      photos,
      references:  collectRefs(type),
      tags:        [...tags],
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    };

    const col     = isCase ? 'cases' : 'departmentContents';
    const editId  = isCase ? editingCaseId : editingContentId;

    if (editId) {
      await db.collection(col).doc(editId).update(docData);
    } else {
      docData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(col).add(docData);
    }

    showToast(isCase ? '케이스가 저장되었습니다.' : '자료가 저장되었습니다.');
    if (isCase) { editingCaseId = null; loadCasesList(); renderCaseForm(); switchPanel('cases-list'); }
    else        { editingContentId = null; loadContentsList(); renderContentForm(); switchPanel('contents-list'); }

  } catch(e) {
    showToast('저장 실패: ' + e.message, 'error');
    btn.textContent = isCase ? '케이스 등록' : '자료 등록';
    btn.disabled = false;
  }
}

// ── 편집 ─────────────────────────────────────────────────────
async function editCase(id) {
  const snap = await db.collection('cases').doc(id).get();
  editingCaseId = id;
  renderCaseForm(snap.data());
  switchPanel('case-add');
}

async function editContent(id) {
  const snap = await db.collection('departmentContents').doc(id).get();
  editingContentId = id;
  renderContentForm(snap.data());
  switchPanel('content-add');
}

function cancelEdit(type) {
  if (type === 'case') { editingCaseId = null; renderCaseForm(); switchPanel('cases-list'); }
  else                 { editingContentId = null; renderContentForm(); switchPanel('contents-list'); }
}

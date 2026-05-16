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

// ── JSON 파일 가져오기 ────────────────────────────────────────
function importFromJSONFile(event) {
  const errEl = document.getElementById('import-error');
  const type  = document.getElementById('import-type').value;
  errEl.style.display = 'none';

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch(err) {
      errEl.textContent = 'JSON 파싱 오류: ' + err.message;
      errEl.style.display = 'inline';
      return;
    }

    if (type === 'case') {
      editingCaseId = null;
      renderCaseForm(data);
      switchPanel('case-add');
    } else {
      editingContentId = null;
      renderContentForm(data);
      switchPanel('content-add');
    }

    showToast('폼에 가져왔습니다! 내용 확인 후 저장하세요.', 'success');
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
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
  setupTextareaDrop('case');
}

function renderContentForm(data = {}) {
  contentPhotos = (data.photos || []).map(p => ({ url: p.url, caption: p.caption || '' }));
  contentTags   = data.tags ? [...data.tags] : [];
  document.getElementById('content-form-title').textContent = editingContentId ? '자료 편집' : '새 각과 자료';
  document.getElementById('content-form-content').innerHTML = formHTML('content', data);
  renderPhotoPreview('content');
  renderTagChips('content');
  setupTextareaDrop('content');
}

// ── 서식 툴바 ─────────────────────────────────────────────────
function applyFmt(type, id) {
  const ta    = document.getElementById(`${id}-description`);
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end);
  const before = ta.value.slice(0, start);
  const after  = ta.value.slice(end);

  const maps = {
    bold:   { wrap: ['**','**'],  placeholder: '굵은 텍스트' },
    italic: { wrap: ['*','*'],    placeholder: '기울임 텍스트' },
    strike: { wrap: ['~~','~~'],  placeholder: '취소선 텍스트' },
    h1:     { line: '# ',         placeholder: '제목 1' },
    h2:     { line: '## ',        placeholder: '제목 2' },
    h3:     { line: '### ',       placeholder: '제목 3' },
    ul:     { line: '- ',         placeholder: '목록 항목' },
    hr:     { insert: '\n---\n' }
  };

  const rule = maps[type];
  let result, cursor;

  if (rule.insert) {
    result = before + rule.insert + after;
    cursor = start + rule.insert.length;
  } else if (rule.wrap) {
    const [open, close] = rule.wrap;
    const text = sel || rule.placeholder;
    result = before + open + text + close + after;
    cursor = start + open.length + text.length + close.length;
  } else if (rule.line) {
    const nlBefore = (before.length > 0 && !before.endsWith('\n')) ? '\n' : '';
    const text = sel || rule.placeholder;
    const inserted = nlBefore + rule.line + text + '\n';
    result = before + inserted + after;
    cursor = start + inserted.length;
  }

  ta.value = result;
  ta.setSelectionRange(cursor, cursor);
  ta.focus();
}

function applyColor(color, id) {
  const ta    = document.getElementById(`${id}-description`);
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end) || '텍스트';
  const tag   = `<span style="color:${color}">${sel}</span>`;
  ta.value = ta.value.slice(0, start) + tag + ta.value.slice(end);
  ta.setSelectionRange(start + tag.length, start + tag.length);
  ta.focus();
}

function applyHighlight(color, id) {
  const ta    = document.getElementById(`${id}-description`);
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end) || '텍스트';
  const tag   = `<mark style="background:${color}">${sel}</mark>`;
  ta.value = ta.value.slice(0, start) + tag + ta.value.slice(end);
  ta.setSelectionRange(start + tag.length, start + tag.length);
  ta.focus();
}

// ── 텍스트 영역 드래그 이벤트 등록 ──────────────────────────
function setupTextareaDrop(type) {
  const textarea = document.getElementById(`${type}-description`);
  if (!textarea) return;

  let savedPos = 0;
  textarea.addEventListener('click',  () => { savedPos = textarea.selectionStart; });
  textarea.addEventListener('keyup',  () => { savedPos = textarea.selectionStart; });
  textarea.addEventListener('input',  () => { savedPos = textarea.selectionStart; });
  textarea.addEventListener('dragenter', () => { savedPos = textarea.selectionStart; });

  // 반드시 무조건 preventDefault — 이게 없으면 drop 자체가 안 됨
  textarea.addEventListener('dragover', e => {
    e.preventDefault();
    textarea.classList.add('drag-active');
  });

  textarea.addEventListener('dragleave', () => {
    textarea.classList.remove('drag-active');
  });

  textarea.addEventListener('drop', e => {
    e.preventDefault(); // drop 허용 — 파일 체크 전에 반드시 먼저 호출
    textarea.classList.remove('drag-active');
    const imageFile = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (!imageFile) return;
    dropImageIntoText(textarea, imageFile, savedPos);
  });

  textarea.addEventListener('paste', e => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    dropImageIntoText(textarea, item.getAsFile(), textarea.selectionStart);
  });
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
          <div class="editor-toolbar">
            <button type="button" class="tb-btn" title="굵게" onclick="applyFmt('bold','${type}')"><b>B</b></button>
            <button type="button" class="tb-btn" title="기울임" onclick="applyFmt('italic','${type}')"><i>I</i></button>
            <button type="button" class="tb-btn" title="취소선" onclick="applyFmt('strike','${type}')"><s>S</s></button>
            <div class="tb-sep"></div>
            <button type="button" class="tb-btn" title="제목 1" onclick="applyFmt('h1','${type}')">H1</button>
            <button type="button" class="tb-btn" title="제목 2" onclick="applyFmt('h2','${type}')">H2</button>
            <button type="button" class="tb-btn" title="제목 3" onclick="applyFmt('h3','${type}')">H3</button>
            <div class="tb-sep"></div>
            <button type="button" class="tb-btn" title="목록" onclick="applyFmt('ul','${type}')">• 목록</button>
            <button type="button" class="tb-btn" title="구분선" onclick="applyFmt('hr','${type}')">― 선</button>
            <div class="tb-sep"></div>
            <span class="tb-label">글자색</span>
            <button type="button" class="tb-color" style="background:#ef4444" title="빨강"  onclick="applyColor('#ef4444','${type}')"></button>
            <button type="button" class="tb-color" style="background:#f97316" title="주황"  onclick="applyColor('#f97316','${type}')"></button>
            <button type="button" class="tb-color" style="background:#16a34a" title="초록"  onclick="applyColor('#16a34a','${type}')"></button>
            <button type="button" class="tb-color" style="background:#2563eb" title="파랑"  onclick="applyColor('#2563eb','${type}')"></button>
            <button type="button" class="tb-color" style="background:#7c3aed" title="보라"  onclick="applyColor('#7c3aed','${type}')"></button>
            <button type="button" class="tb-color" style="background:#64748b" title="회색"  onclick="applyColor('#64748b','${type}')"></button>
            <div class="tb-sep"></div>
            <span class="tb-label">형광펜</span>
            <button type="button" class="tb-color tb-hl" style="background:#fef08a" title="노랑"  onclick="applyHighlight('#fef08a','${type}')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#bbf7d0" title="초록"  onclick="applyHighlight('#bbf7d0','${type}')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#bae6fd" title="파랑"  onclick="applyHighlight('#bae6fd','${type}')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#fecdd3" title="분홍"  onclick="applyHighlight('#fecdd3','${type}')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#fed7aa" title="주황"  onclick="applyHighlight('#fed7aa','${type}')"></button>
            <button type="button" class="tb-color tb-hl" style="background:#e9d5ff" title="���라"  onclick="applyHighlight('#e9d5ff','${type}')"></button>
          </div>
          <textarea id="${type}-description" rows="10"
            placeholder="케이스/자료 상세 내용&#10;&#10;💡 이미지를 이 칸에 드래그하면 글 중간에 삽입됩니다."
            style="min-height:200px;border-top:none;border-radius:0 0 8px 8px">${d.description || ''}</textarea>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem">이미지를 텍스트 영역으로 드래그하면 현재 커서 위치에 자동 삽입됩니다.</div>
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

// ── 텍스트 영역 이미지 업로드 후 삽입 ───────────────────────
let _pendingImg = null;

async function dropImageIntoText(textarea, file, insertPos) {
  if (insertPos == null) insertPos = textarea.value.length;

  const placeholder = '![업로드 중...]()';
  const before = textarea.value.slice(0, insertPos);
  const after  = textarea.value.slice(insertPos);
  const sep    = (before.length > 0 && !before.endsWith('\n')) ? '\n' : '';
  textarea.value = before + sep + placeholder + '\n' + after;

  showToast('업로드 중...', 'success');

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error('업로드 실패');

    // 플레이스홀더 제거 후 크기 선택 팝업 표시
    textarea.value = textarea.value.replace(sep + placeholder + '\n', '');
    _pendingImg = { textarea, url: data.secure_url, insertPos };
    showSizePicker(data.secure_url);

  } catch(err) {
    textarea.value = textarea.value.replace(sep + placeholder + '\n', '');
    showToast('이미지 업로드 실패', 'error');
  }
}

// ── 크기 선택 팝업 ────────────────────────────────────────────
function showSizePicker(previewUrl) {
  closeSizePicker();
  const el = document.createElement('div');
  el.id = 'size-picker';
  el.innerHTML = `
    <div class="sp-preview"><img src="${previewUrl}" alt=""></div>
    <div class="sp-label">이미지 크기 선택</div>
    <div class="sp-btns">
      <button onclick="insertSizedImage('sm')"><span class="sp-icon">◼</span><br>소<br><small>30%</small></button>
      <button onclick="insertSizedImage('md')"><span class="sp-icon" style="font-size:1.3rem">◼</span><br>중<br><small>50%</small></button>
      <button onclick="insertSizedImage('lg')"><span class="sp-icon" style="font-size:1.8rem">◼</span><br>대<br><small>75%</small></button>
      <button onclick="insertSizedImage('')" ><span class="sp-icon" style="font-size:2.2rem">◼</span><br>전체<br><small>100%</small></button>
      <button onclick="insertSizedImage('row')"><span style="font-size:1.1rem">◼◼</span><br>나란히<br><small>48%</small></button>
    </div>
    <button class="sp-close" onclick="closeSizePicker()">✕</button>`;
  document.body.appendChild(el);
}

function insertSizedImage(size) {
  if (!_pendingImg) return;
  const { textarea, url, insertPos } = _pendingImg;
  _pendingImg = null;
  closeSizePicker();

  let markdown;
  if (size === 'row') {
    // 나란히: HTML inline-block 사용 (마크다운으론 inline 불가)
    markdown = `<img src="${url}" style="width:48%;display:inline-block;vertical-align:top;border-radius:8px;margin:0 1% 0.5rem 0;border:1px solid #e2e8f0">`;
  } else if (size === '') {
    markdown = `![](${url})`;
  } else {
    markdown = `![${size}](${url})`;
  }

  const before = textarea.value.slice(0, insertPos);
  const after  = textarea.value.slice(insertPos);
  const sep    = (before.length > 0 && !before.endsWith('\n')) ? '\n' : '';
  textarea.value = before + sep + markdown + '\n' + after;
  const newPos = insertPos + sep.length + markdown.length + 1;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();
  showToast('삽입 완료!', 'success');
}

function closeSizePicker() {
  const el = document.getElementById('size-picker');
  if (el) el.remove();
}

// ── 인라인 이미지 업로드 ──────────────────────────────────────
function handleInlineDrop(e) {
  e.preventDefault();
  document.getElementById('inline-upload-zone').classList.remove('dragover');
  const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
  if (file) uploadInlineFile(file);
}

function uploadInlineImage(e) {
  const file = e.target.files[0];
  if (file) uploadInlineFile(file);
  e.target.value = '';
}

async function uploadInlineFile(file) {
  const progWrap = document.getElementById('inline-progress');
  const progBar  = document.getElementById('inline-progress-bar');
  const result   = document.getElementById('inline-result');
  result.style.display = 'none';
  progWrap.style.display = 'block';
  progBar.style.width = '30%';

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    progBar.style.width = '60%';
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
      method: 'POST', body: formData
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error('업로드 실패');

    progBar.style.width = '100%';
    setTimeout(() => { progWrap.style.display = 'none'; progBar.style.width = '0%'; }, 400);

    const url = data.secure_url;
    document.getElementById('inline-url-img').value     = `![이미지](${url})`;
    document.getElementById('inline-url-caption').value = `![캡션을_여기에](${url})`;
    document.getElementById('inline-preview-img').src   = url;
    result.style.display = 'block';
    showToast('업로드 완료! URL을 복사하세요.', 'success');
  } catch(e) {
    progWrap.style.display = 'none';
    showToast('업로드 실패: ' + e.message, 'error');
  }
}

function copyInline(inputId) {
  const el = document.getElementById(inputId);
  navigator.clipboard.writeText(el.value).then(() => showToast('클립보드에 복사됐습니다!', 'success'));
}

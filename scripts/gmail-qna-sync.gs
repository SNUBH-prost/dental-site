// ── 설정 (여기만 채우면 됩니다) ──────────────────────────────────
const CONFIG = {
  FIREBASE_API_KEY: 'AIzaSyAFgVx2JCezjhUg_40TQrc3s1k-pts4H8Q',
  PROJECT_ID:       'dental-clinical-5c291',

  // Firebase 콘솔 관리자 계정 (Authentication 탭에서 확인)
  ADMIN_EMAIL:    '',   // 예: 'admin@gmail.com'
  ADMIN_PASSWORD: '',   // 예: 'yourpassword'

  // 검색 조건: 제목에 [QnA] 포함된 읽지 않은 메일
  SEARCH_QUERY:     'subject:[QnA] is:unread',
  PROCESSED_LABEL:  'QnA-완료',
};

// ── Firebase Auth: 관리자 로그인 → ID 토큰 ──────────────────────
function _getIdToken() {
  const url =
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
    CONFIG.FIREBASE_API_KEY;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      email: CONFIG.ADMIN_EMAIL,
      password: CONFIG.ADMIN_PASSWORD,
      returnSecureToken: true,
    }),
    muteHttpExceptions: true,
  });

  const data = JSON.parse(res.getContentText());
  if (!data.idToken) throw new Error('Firebase 인증 실패: ' + res.getContentText());
  return data.idToken;
}

// ── Firestore에 Q&A 문서 저장 ────────────────────────────────────
function _addQnADoc(title, description) {
  const token   = _getIdToken();
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const body = {
    fields: {
      title:       { stringValue: title },
      description: { stringValue: description },
      summary:     { stringValue: description.slice(0, 120) },
      department:  { stringValue: 'qna' },
      date:        { stringValue: dateStr },
      photos:      { arrayValue: { values: [] } },
      tags:        { arrayValue: { values: [{ stringValue: '이메일' }] } },
      references:  { arrayValue: { values: [] } },
    },
  };

  const url =
    'https://firestore.googleapis.com/v1/projects/' +
    CONFIG.PROJECT_ID +
    '/databases/(default)/documents/departmentContents';

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  if (!result.name) throw new Error('Firestore 저장 실패: ' + res.getContentText());
  Logger.log('[저장 완료] ' + title);
}

// ── Gmail 라벨 생성 또는 가져오기 ────────────────────────────────
function _getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// ── 메인: 이메일 감지 → Q&A 등록 ────────────────────────────────
// 이 함수를 5분 트리거로 실행하세요
function checkQnAEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, 20);
  if (!threads.length) { Logger.log('새 QnA 이메일 없음'); return; }

  const doneLabel = _getOrCreateLabel(CONFIG.PROCESSED_LABEL);

  threads.forEach(thread => {
    try {
      const msg   = thread.getMessages()[0];
      const title = msg.getSubject().replace(/^\[QnA\]\s*/i, '').trim() || '(제목 없음)';
      const body  = msg.getPlainBody().trim();

      _addQnADoc(title, body);

      thread.markRead();
      thread.addLabel(doneLabel);
    } catch (e) {
      Logger.log('[오류] ' + e.message);
    }
  });
}

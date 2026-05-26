// ── 설정 (여기만 채우면 됩니다) ──────────────────────────────────
const CONFIG = {
  FIREBASE_API_KEY: 'AIzaSyAFgVx2JCezjhUg_40TQrc3s1k-pts4H8Q',
  PROJECT_ID:       'dental-clinical-5c291',

  ADMIN_EMAIL:    '',   // Firebase 관리자 이메일
  ADMIN_PASSWORD: '',   // Firebase 관리자 비밀번호

  GROQ_API_KEY: '',     // https://console.groq.com 에서 발급

  CLOUDINARY_CLOUD_NAME:    'dg7aas4ky',
  CLOUDINARY_UPLOAD_PRESET: 'dental_clinic',

  SEARCH_QUERY:    'subject:[QnA] is:unread',
  PROCESSED_LABEL: 'QnA-완료',
};

// ── Firebase Auth → ID 토큰 ──────────────────────────────────────
function _getIdToken() {
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + CONFIG.FIREBASE_API_KEY;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD, returnSecureToken: true }),
    muteHttpExceptions: true,
  });
  const data = JSON.parse(res.getContentText());
  if (!data.idToken) throw new Error('Firebase 인증 실패: ' + res.getContentText());
  return data.idToken;
}

// ── Groq API → 답변 초안 생성 ───────────────────────────────────
function _callGroq(question) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const systemPrompt =
    '당신은 서울대학교 치과병원 보철과 전임의입니다. ' +
    '아래 임상 질문에 대해 다음 원칙에 따라 답변하세요.\n\n' +
    '1. 근거 중심(Evidence-based): 정립된 임상 원칙, 보철학 문헌(Literature) 또는 학회 가이드라인의 핵심 근거를 명시할 것.\n' +
    '2. 단계별 구조화: 진단(Diagnosis), 치료 계획(Treatment planning), 실행(Execution) 등 흐름에 맞춰 소제목이나 번호로 구분할 것.\n' +
    '3. 임상 실무 적용: 실제 원내 임상(Clinical practice)에서 바로 적용할 수 있는 구체적인 팁이나 주의사항(예: 재료 선택, 삭제법, 기공 소통 등 문맥에 맞는 내용)을 1~2가지 포함할 것.\n' +
    '4. 장기 예후 및 한계 명시: 치료 후의 유지 관리(Maintenance) 측면을 고려하되, 환자 상태나 술식에 따라 가변적인 부분은 "임상적 판단 필요"로 명확히 선을 그을 것.\n' +
    '5. 권위 있는 레퍼런스 첨부: 답변과 직접적으로 관련된 전 세계 보철/접착 분야의 주요 논문(예: JPD, JOE, JER 등) 레퍼런스(저자, 연도, 저널명 포함)를 5개 제시할 것.\n' +
    '6. 한국어로 작성, 전문 용어는 영문 병기.';

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + CONFIG.GROQ_API_KEY,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      model: 'deepseek-r1-distill-llama-70b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  const text = result?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq 응답 실패: ' + res.getContentText());
  Logger.log('[Groq 답변 생성 완료]');
  // deepseek-r1의 <think>...</think> 블록 제거
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ── Cloudinary 이미지 업로드 → URL ───────────────────────────────
function _uploadToCloudinary(attachment) {
  const base64  = Utilities.base64Encode(attachment.getBytes());
  const dataUri = 'data:' + attachment.getContentType() + ';base64,' + base64;
  const url     = 'https://api.cloudinary.com/v1_1/' + CONFIG.CLOUDINARY_CLOUD_NAME + '/image/upload';

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { file: dataUri, upload_preset: CONFIG.CLOUDINARY_UPLOAD_PRESET },
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  if (!result.secure_url) throw new Error('Cloudinary 업로드 실패: ' + res.getContentText());
  Logger.log('[이미지 업로드] ' + result.secure_url);
  return result.secure_url;
}

// ── Firestore에 Q&A 문서 저장 ────────────────────────────────────
function _addQnADoc(title, description, answer, photoUrls) {
  const token   = _getIdToken();
  const dateStr = new Date().toISOString().slice(0, 10);

  const photoValues = photoUrls.map(url => ({
    mapValue: {
      fields: {
        url:         { stringValue: url },
        caption:     { stringValue: '' },
        annotations: { arrayValue: { values: [] } },
      },
    },
  }));

  const body = {
    fields: {
      title:       { stringValue: title },
      description: { stringValue: description },
      summary:     { stringValue: description.slice(0, 120) },
      answer:      { stringValue: answer },
      department:  { stringValue: 'qna' },
      date:        { stringValue: dateStr },
      photos:      { arrayValue: { values: photoValues } },
      tags:        { arrayValue: { values: [{ stringValue: '이메일' }] } },
      references:  { arrayValue: { values: [] } },
    },
  };

  const url = 'https://firestore.googleapis.com/v1/projects/' + CONFIG.PROJECT_ID + '/databases/(default)/documents/departmentContents';
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  if (!result.name) throw new Error('Firestore 저장 실패: ' + res.getContentText());
  Logger.log('[저장 완료] ' + title + ' / 사진 ' + photoUrls.length + '장 / 답변 ' + (answer ? '있음' : '없음'));
}

// ── Gmail 라벨 생성 또는 가져오기 ────────────────────────────────
function _getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// ── 메인: 이메일 → 이미지 업로드 → Gemini 답변 → Q&A 저장 ───────
function checkQnAEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, 20);
  if (!threads.length) { Logger.log('새 QnA 이메일 없음'); return; }

  const doneLabel = _getOrCreateLabel(CONFIG.PROCESSED_LABEL);

  threads.forEach(thread => {
    try {
      const msg   = thread.getMessages()[0];
      const title = msg.getSubject().replace(/^\[QnA\]\s*/i, '').trim() || '(제목 없음)';
      const body  = msg.getPlainBody().trim();

      // 이미지 첨부파일 업로드
      const photoUrls = [];
      msg.getAttachments().forEach(att => {
        if (!att.getContentType().startsWith('image/')) return;
        try { photoUrls.push(_uploadToCloudinary(att)); }
        catch(e) { Logger.log('[이미지 오류] ' + e.message); }
      });

      // Groq 답변 초안 생성
      let answer = '';
      if (CONFIG.GROQ_API_KEY) {
        try { answer = _callGroq(title + '\n\n' + body); }
        catch(e) { Logger.log('[Groq 오류] ' + e.message); }
      }

      _addQnADoc(title, body, answer, photoUrls);
      thread.markRead();
      thread.addLabel(doneLabel);
    } catch(e) {
      Logger.log('[오류] ' + e.message);
    }
  });
}

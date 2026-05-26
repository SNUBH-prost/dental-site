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

// ── Groq API → 답변 + 레퍼런스 생성 ────────────────────────────
function _callGroq(question) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const systemPrompt =
    '당신은 서울대학교 치과병원 보철과 전임의입니다.\n' +
    '아래 임상 질문에 대해 **논문 리뷰 수준의 상세하고 심층적인 답변**을 작성하세요.\n\n' +
    '## 답변 분량 및 구조\n' +
    '- 최소 1500자 이상, 논문 리뷰(Review article) 형식\n' +
    '- 아래 섹션을 모두 포함하되, 질문과 무관한 섹션은 "해당 없음"으로 표기\n' +
    '  1. 개요 및 임상적 의의\n' +
    '  2. 진단 및 평가 (Diagnosis & Assessment)\n' +
    '  3. 치료 계획 수립 (Treatment Planning)\n' +
    '  4. 술식 상세 (Clinical Procedure)\n' +
    '  5. 재료 선택 및 기공 소통 (Material Selection & Lab Communication)\n' +
    '  6. 합병증 및 대처 (Complications & Management)\n' +
    '  7. 유지관리 및 장기 예후 (Maintenance & Long-term Prognosis)\n' +
    '  8. 결론 및 임상 권고사항\n\n' +
    '## 내용 원칙\n' +
    '1. 근거 중심(Evidence-based): 정립된 임상 원칙, 보철학 문헌 또는 학회 가이드라인의 핵심 근거 명시\n' +
    '2. 각 섹션마다 충분한 세부 설명과 수치(성공률, 생존율, 권장 수치 등) 포함\n' +
    '3. 임상 실무 팁: 실제 적용 가능한 구체적 팁, 주의사항, 실수하기 쉬운 포인트 포함\n' +
    '4. 가변적 부분은 "임상적 판단 필요"로 명확히 구분\n' +
    '5. 한국어로 작성, 전문 용어는 영문 병기\n\n' +
    '## 레퍼런스 출력 형식 (필수)\n' +
    '답변 본문을 모두 작성한 후, 반드시 아래 JSON 블록을 출력하세요.\n' +
    '레퍼런스는 JPD, JOE, JER, IJPRD, JOMI, IJOI, CCED 등 주요 보철/접착/임플란트 저널에서 5개 이상 제시하세요.\n\n' +
    '```json\n' +
    '[\n' +
    '  {\n' +
    '    "authors": "저자1 AA, 저자2 BB",\n' +
    '    "year": "2023",\n' +
    '    "title": "논문 전체 제목",\n' +
    '    "journal": "저널명",\n' +
    '    "volume": "73(1)",\n' +
    '    "pages": "7-21",\n' +
    '    "doi": "10.xxxx/xxxxx"\n' +
    '  }\n' +
    ']\n' +
    '```';

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + CONFIG.GROQ_API_KEY,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  const text = result?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq 응답 실패: ' + res.getContentText());
  Logger.log('[Groq 답변 생성 완료]');
  return text.trim();
}

// ── Groq 응답에서 본문과 레퍼런스 분리 ────────────────────────
function _parseGroqResponse(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  let refs = [];
  let answer = text;

  if (jsonMatch) {
    try {
      refs = JSON.parse(jsonMatch[1].trim());
      if (!Array.isArray(refs)) refs = [];
    } catch(e) {
      Logger.log('[레퍼런스 파싱 오류] ' + e.message);
      refs = [];
    }
    answer = text.slice(0, text.indexOf(jsonMatch[0])).trim();
  }

  return { answer: answer, references: refs };
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
function _addQnADoc(title, description, answer, photoUrls, references) {
  const token   = _getIdToken();
  const dateStr = new Date().toISOString().slice(0, 10);

  const photoValues = photoUrls.map(function(u) {
    return {
      mapValue: {
        fields: {
          url:         { stringValue: u },
          caption:     { stringValue: '' },
          annotations: { arrayValue: { values: [] } },
        },
      },
    };
  });

  const refValues = (references || []).map(function(r) {
    return {
      mapValue: {
        fields: {
          authors:    { stringValue: r.authors    || '' },
          year:       { stringValue: r.year       || '' },
          title:      { stringValue: r.title      || '' },
          journal:    { stringValue: r.journal    || '' },
          volume:     { stringValue: r.volume     || '' },
          pages:      { stringValue: r.pages      || '' },
          doi:        { stringValue: r.doi        || '' },
          abstract:   { stringValue: '' },
          abstractEn: { stringValue: '' },
        },
      },
    };
  });

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
      references:  { arrayValue: { values: refValues } },
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
  Logger.log('[저장 완료] ' + title + ' / 사진 ' + photoUrls.length + '장 / 레퍼런스 ' + refValues.length + '개 / 답변 ' + (answer ? '있음' : '없음'));
}

// ── Gmail 라벨 생성 또는 가져오기 ────────────────────────────────
function _getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// ── 메인: 이메일 → 이미지 업로드 → Groq 답변 → Q&A 저장 ─────────
function checkQnAEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, 20);
  if (!threads.length) { Logger.log('새 QnA 이메일 없음'); return; }

  const doneLabel = _getOrCreateLabel(CONFIG.PROCESSED_LABEL);

  threads.forEach(function(thread) {
    try {
      const msg   = thread.getMessages()[0];
      const title = msg.getSubject().replace(/^\[QnA\]\s*/i, '').trim() || '(제목 없음)';
      const body  = msg.getPlainBody().trim();

      // 이미지 첨부파일 업로드
      const photoUrls = [];
      msg.getAttachments().forEach(function(att) {
        if (!att.getContentType().startsWith('image/')) return;
        try { photoUrls.push(_uploadToCloudinary(att)); }
        catch(e) { Logger.log('[이미지 오류] ' + e.message); }
      });

      // Groq 답변 초안 생성 + 레퍼런스 파싱
      let answer = '';
      let references = [];
      if (CONFIG.GROQ_API_KEY) {
        try {
          const raw = _callGroq(title + '\n\n' + body);
          const parsed = _parseGroqResponse(raw);
          answer = parsed.answer;
          references = parsed.references;
          Logger.log('[레퍼런스 ' + references.length + '개 파싱됨]');
        } catch(e) {
          Logger.log('[Groq 오류] ' + e.message);
        }
      }

      _addQnADoc(title, body, answer, photoUrls, references);
      thread.markRead();
      thread.addLabel(doneLabel);
    } catch(e) {
      Logger.log('[오류] ' + e.message);
    }
  });
}

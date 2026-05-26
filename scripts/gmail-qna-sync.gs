// ── 설정 (여기만 채우면 됩니다) ──────────────────────────────────
const CONFIG = {
  FIREBASE_API_KEY: 'AIzaSyAFgVx2JCezjhUg_40TQrc3s1k-pts4H8Q',
  PROJECT_ID:       'dental-clinical-5c291',

  ADMIN_EMAIL:    '',   // Firebase 관리자 이메일
  ADMIN_PASSWORD: '',   // Firebase 관리자 비밀번호

  OPENAI_API_KEY: '', // https://platform.openai.com 에서 발급

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

// ── OpenAI GPT → 공부 가이드 생성 (찾아볼 점 + 관점별 질문) ───────
function _callGPT(question) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const systemPrompt =
    '당신은 치과 보철과 전공의 교육을 담당하는 시니어 레지던트입니다.\n' +
    '아래 임상 질문을 받은 전공의가 스스로 깊이 공부할 수 있도록, 답을 직접 알려주지 말고 **공부 방향을 잡아주는 가이드**를 작성하세요.\n\n' +

    '## 작성할 내용\n\n' +

    '### 1. 이 질문의 핵심 포인트\n' +
    '- 이 질문이 왜 중요한지, 임상에서 어떤 상황에서 마주치는지 2~3문장으로.\n\n' +

    '### 2. 먼저 확인해야 할 기본 개념\n' +
    '- 이 질문에 답하려면 먼저 알아야 하는 기초 지식/개념 목록.\n' +
    '- 각 항목마다 왜 알아야 하는지 한 줄 이유 추가.\n\n' +

    '### 3. 찾아볼 점 (Literature / 교과서)\n' +
    '- PubMed 검색 키워드 3~5개 (영문, 따옴표로 표시)\n' +
    '- 관련 교과서 챕터 또는 참고할 저자/그룹명\n' +
    '- 어떤 종류의 논문을 찾아야 하는지 (RCT, systematic review, in vitro 등)\n\n' +

    '### 4. 생각해볼 점 (Clinical Thinking)\n' +
    '- 이 주제에서 전공의들이 자주 놓치는 함정이나 오개념\n' +
    '- 찬반이 갈리거나 아직 논란 중인 부분\n' +
    '- 임상 상황별로 답이 달라질 수 있는 변수들\n\n' +

    '### 5. 관점별 질문 (가장 중요한 섹션 — 총 20개 이상)\n' +
    '질문과 관련된 여러 진료과/관점에서 던질 수 있는 질문을 카테고리별로 나눠 제시하세요.\n' +
    '각 카테고리마다 3~4개씩, 전체 합산 20개 이상이 되도록 하세요.\n' +
    '관련성이 낮은 카테고리도 최대한 연결고리를 찾아 질문을 만들어 주세요.\n\n' +
    '**[보철 관점]** 수복물 설계, 교합, 심미, 유지력, 장기 예후 — 3~4개\n' +
    '**[외과 관점]** 수술 접근, 해부학적 위험, 골 처치, 발치/이식, 치유 — 3~4개\n' +
    '**[치주 관점]** 치주 조직 반응, 생물학적 폭경, 점막/골 유지, 위생 관리 — 3~4개\n' +
    '**[재료 관점]** 재료 특성 비교, 접착 기전, 기계적 강도, 재료 선택 근거 — 3~4개\n' +
    '**[술식 관점]** 단계별 protocol, 임상 팁, 흔한 실수, 실패 원인 — 3~4개\n' +
    '**[세미나 방어용]** 교수님이 반박·심화 질문으로 던질 법한 날카로운 질문 — 4~5개\n\n' +

    '## 핵심 원칙\n' +
    '- **답을 직접 쓰지 말 것.** 공부 방향과 질문만 제시.\n' +
    '- **구체적 임상 사실(수치, 재료명, 성공률, 특정 술식 단계 등)을 직접 서술하지 말 것.**\n' +
    '  → 대신 "이 수치를 교과서/논문에서 확인해보세요", "이 재료의 특성을 비교해보세요" 형태로.\n' +
    '  → 확실하지 않은 내용은 쓰지 말고, 찾아보도록 유도할 것.\n' +
    '- 질문은 구체적이고 날카롭게 — "어떻게 하나요?" 같은 막연한 질문 금지.\n' +
    '- 한국어로 작성, 전문 용어는 영문 병기.';

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + CONFIG.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      model:      'gpt-4o-mini', // 품질 부족하면 'gpt-4o' 로 교체
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question },
      ],
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  const text = result?.choices?.[0]?.message?.content;
  if (!text) throw new Error('GPT 응답 실패: ' + res.getContentText());
  Logger.log('[GPT 공부 가이드 생성 완료]');
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
          abstract:   { stringValue: r.abstract   || '' },
          abstractEn: { stringValue: r.abstractEn || '' },
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

// ── 메인: 이메일 → 이미지 업로드 → GPT 공부가이드 → Q&A 저장 ─────
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
      if (CONFIG.OPENAI_API_KEY) {
        try {
          const raw = _callGPT(title + '\n\n' + body);
          const parsed = _parseGroqResponse(raw);
          answer = parsed.answer;
          references = parsed.references;
          Logger.log('[레퍼런스 ' + references.length + '개 파싱됨]');
        } catch(e) {
          Logger.log('[GPT 오류] ' + e.message);
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

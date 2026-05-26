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
    '당신은 서울대학교 치과병원 보철과 전임의이자 보철학 교과서 저자 수준의 전문가입니다.\n' +
    '아래 임상 질문에 대해 치과 전공의가 읽는 교과서 챕터 또는 체계적 문헌고찰(Systematic review) 수준의 답변을 작성하세요.\n\n' +

    '## 분량 요구사항 (매우 중요)\n' +
    '- 최소 5000자 이상 (한국어 기준), 부족하면 각 섹션을 더 상세히 보완\n' +
    '- 각 섹션은 단순 나열이 아닌 서술형 문단(paragraph) 형식으로 충분히 작성\n' +
    '- 수치, 퍼센트, 연구 결과, 비교 데이터를 적극 활용\n\n' +

    '## 필수 섹션 (모든 섹션 상세히 작성)\n\n' +

    '### 1. 개요 및 임상적 의의\n' +
    '- 해당 주제의 정의, 역학(유병률, 발생 빈도), 임상적 중요성\n' +
    '- 최신 트렌드 및 패러다임 변화\n' +
    '- 치료하지 않을 경우의 결과 및 파급 효과\n\n' +

    '### 2. 진단 및 평가 (Diagnosis & Assessment)\n' +
    '- 주관적 증상, 객관적 검사 항목 및 판단 기준\n' +
    '- 감별 진단(Differential diagnosis) 및 체크리스트\n' +
    '- 방사선학적/임상적 평가 프로토콜, 계측 수치 기준\n' +
    '- 진단 분류 체계(예: 학회 분류법) 및 중증도 판정 기준\n\n' +

    '### 3. 치료 계획 수립 (Treatment Planning)\n' +
    '- 치료 옵션별 적응증(Indication)·금기증(Contraindication) 상세 비교\n' +
    '- 환자 요인(나이, 전신질환, 구강위생, 경제적 여건)별 의사결정 알고리즘\n' +
    '- 치료 시기 및 순서, 다학제적 협진(교정, 치주, 구강외과 등) 필요 상황\n\n' +

    '### 4. 술식 상세 (Clinical Procedure)\n' +
    '- 단계별(Step-by-step) 시술 프로토콜, 각 단계에서의 핵심 주의사항\n' +
    '- 마취·격리·기구·재료 준비 세부 사항\n' +
    '- 술식 중 판단이 필요한 임계점(Critical point)과 대응법\n' +
    '- 임상 팁(Tip & Trick): 실패 빈도가 높은 단계, 흔한 실수와 예방법\n\n' +

    '### 5. 재료 선택 및 기공 소통 (Material Selection & Lab Communication)\n' +
    '- 주요 재료 계열별 특성 비교(기계적 강도, 심미성, 내마모성, 접착성 등) 수치 포함\n' +
    '- 적응증에 따른 재료 선택 근거\n' +
    '- 기공 지시서 작성 요령, 색조 선택 프로토콜, 기공물 검수 기준\n\n' +

    '### 6. 합병증 및 대처 (Complications & Management)\n' +
    '- 빈도별·시기별(즉시/지연) 합병증 목록 및 발생 기전\n' +
    '- 각 합병증의 임상적 판단 기준과 단계별 처치 프로토콜\n' +
    '- 예방 전략 및 위험 인자 관리\n\n' +

    '### 7. 유지관리 및 장기 예후 (Maintenance & Long-term Prognosis)\n' +
    '- 근거 있는 성공률·생존율 수치(5년, 10년 이상 데이터) 및 출처\n' +
    '- 예후 영향 인자(환자 요인, 술자 요인, 재료 요인) 분석\n' +
    '- 정기 검진 프로토콜, 유지관리 지침(환자 교육 내용 포함)\n' +
    '- 재치료(Re-treatment) 시기 판단 기준\n\n' +

    '### 8. 결론 및 임상 권고사항\n' +
    '- 근거 수준(Level of evidence) 요약\n' +
    '- 현재 임상 권고안(Clinical recommendation) 및 한계점\n' +
    '- 향후 연구 방향\n\n' +

    '## 작성 원칙\n' +
    '- 교과서(Shillingburg, Rosenstiel, Anusavice, Misch 등)와 최신 문헌 근거 명시\n' +
    '- 수치와 데이터 없이 막연한 서술 금지 ("충분히", "적절히" 대신 구체적 수치 사용)\n' +
    '- 논란이 있는 주제는 근거 수준과 함께 양측 입장 모두 서술\n' +
    '- 한국어로 작성, 전문 용어는 반드시 영문 병기\n' +
    '- 임상적으로 가변적인 부분은 반드시 "임상적 판단 필요" 명시\n\n' +

    '## 레퍼런스 출력 형식 (필수, 반드시 답변 맨 끝에 출력)\n' +
    '답변 본문을 완전히 작성한 후, 아래 형식의 JSON 블록을 출력하세요.\n' +
    'JPD, JOE, JER, IJPRD, JOMI, IJOI, CCED, Journal of Periodontology, Clinical Oral Implants Research 등 주요 저널에서 7개 이상 제시하세요.\n' +
    '각 레퍼런스에 영문 초록(abstractEn)과 한글 요약 초록(abstract) 모두 작성하세요. 한글 초록은 2~4문장으로 핵심 내용만 요약하세요.\n\n' +
    '```json\n' +
    '[\n' +
    '  {\n' +
    '    "authors": "저자1 AA, 저자2 BB",\n' +
    '    "year": "2023",\n' +
    '    "title": "논문 전체 제목",\n' +
    '    "journal": "저널명",\n' +
    '    "volume": "73(1)",\n' +
    '    "pages": "7-21",\n' +
    '    "doi": "10.xxxx/xxxxx",\n' +
    '    "abstractEn": "Background: ... Methods: ... Results: ... Conclusion: ...",\n' +
    '    "abstract": "본 연구는 ... 결과적으로 ... 임상적 의의가 있다."\n' +
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
      max_tokens: 8192,
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

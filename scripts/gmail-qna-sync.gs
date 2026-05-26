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
    '당신은 서울대학교 치과병원 보철과 전임의이자 국제 보철학 저널에 다수 논문을 발표한 임상 연구자입니다.\n' +
    '아래 임상 질문에 대해, 치과 전공의가 세미나에서 발표하고 방어할 수 있으며 교과서 챕터로 출판해도 손색없는 수준의 종합 정리문을 작성하세요.\n\n' +

    '## 분량 및 형식 (절대 원칙)\n' +
    '- 한국어 기준 최소 8000자 이상. 부족하면 반드시 각 섹션을 더 보완할 것.\n' +
    '- 각 섹션은 불릿 나열이 아닌 충분한 서술형 문단(paragraph) 형식으로 작성.\n' +
    '- 섹션 내에 필요하면 번호 붙은 소제목(예: 3.1, 3.2)으로 세분화.\n' +
    '- 막연한 표현("충분히", "적절히", "다양한") 사용 금지 → 반드시 구체적 수치, 비율, 시간, 제품명으로 대체.\n' +
    '- 관련 저자명과 연도를 본문 안에 직접 인용 (예: Magne(2005)는 ~라고 보고했습니다).\n\n' +

    '## 필수 섹션\n\n' +

    '### 1. 개념 및 역사적 발전\n' +
    '- 술식/개념의 정의와 대비되는 개념 명확히 구분\n' +
    '- 핵심 개념이 어떻게 발전했는지 연대기적으로 서술 (최초 발견 → 개념 정립 → 현재)\n' +
    '- 패러다임 전환의 의미와 임상적 중요성\n\n' +

    '### 2. 작용 기전 (Mechanism of Action)\n' +
    '- 핵심 기전을 2~4개의 소제목으로 세분화하여 각각 상세히 설명\n' +
    '- 분자/세포 수준의 기전 포함 (예: MMP, collagen degradation, polymerization shrinkage stress 등)\n' +
    '- "왜 이 술식이 더 우수한가"를 기전 중심으로 명확히 논증\n\n' +

    '### 3. 임상 프로토콜 — Step by Step\n' +
    '- 각 단계를 Step 1, Step 2... 형식으로 번호 부여\n' +
    '- 각 단계마다: 목적, 세부 방법(재료명·농도·시간 수치 포함), 핵심 주의사항, 흔한 실수와 예방법\n' +
    '- 제품 브랜드명 예시 병기 (예: Optibond FL, Clearfil SE Bond, Temp-Bond NE)\n' +
    '- 임상적으로 가장 논쟁이 많은 단계는 별도로 강조\n\n' +

    '### 4. 근거 수준 — 무엇이 입증되었는가\n' +
    '- In vitro 데이터: 구체적 수치(bond strength MPa, 향상률 %, 연구자명·연도)\n' +
    '- 임상 RCT 및 prospective study 결과: 생존율(%), 합병증 발생률, 추적 기간\n' +
    '- Systematic review / meta-analysis 결과 요약\n' +
    '- **균형 있는 시각 필수**: 근거가 부족하거나 결과가 상충하는 부분도 반드시 서술하고, 세미나에서 질문 받을 경우 솔직히 인정할 포인트 명시\n\n' +

    '### 5. 재료 선택 및 옵션 비교\n' +
    '- 주요 재료/술식 옵션을 구체적 제품군별로 비교 (기계적 특성 수치 포함)\n' +
    '- 각 옵션의 장단점, 적응증, 금기증\n' +
    '- 특정 조합이 gold standard로 여겨지는 근거\n\n' +

    '### 6. 합병증, 실패 원인 및 대처\n' +
    '- 시기별(즉시/지연), 원인별 합병증 분류 및 발생 기전\n' +
    '- 각 합병증의 임상 판단 기준과 단계별 처치\n' +
    '- 예방 전략 및 위험 인자\n\n' +

    '### 7. 특수 상황 및 응용\n' +
    '- 교과서적 케이스 외의 특수 상황(예: endo-treated tooth, digital workflow, 고령 환자 등)\n' +
    '- Emerging concept 및 최신 트렌드 서술 (근거 수준 명시)\n\n' +

    '### 8. 임상 의사결정 — 언제, 누구에게\n' +
    '- 강하게 권장되는 상황 vs. 이득이 제한적인 상황을 구체적으로 열거\n' +
    '- 환자 요인(나이, 전신질환, 협조도, 경제적 여건)별 의사결정 논리\n\n' +

    '### 9. 핵심 Take-home Messages\n' +
    '- R1(전공의 1년차) 관점에서 반드시 알아야 할 5~7가지 핵심 포인트\n' +
    '- 세미나에서 자주 나오는 질문과 모범 답변 포인트 포함\n\n' +

    '## 절대 금지 사항\n' +
    '- "적절한 재료를 선택하세요" 같은 근거 없는 막연한 권고\n' +
    '- 수치 없이 "우수한 결과를 보였다"는 서술\n' +
    '- 논란이 있는 주제에서 한쪽 입장만 서술\n' +
    '- 일반 구글 검색 수준의 개요 설명\n\n' +

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

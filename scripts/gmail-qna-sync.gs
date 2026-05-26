// ── 설정 (여기만 채우면 됩니다) ──────────────────────────────────
const CONFIG = {
  FIREBASE_API_KEY: 'AIzaSyAFgVx2JCezjhUg_40TQrc3s1k-pts4H8Q',
  PROJECT_ID:       'dental-clinical-5c291',

  ADMIN_EMAIL:    '',   // Firebase 관리자 이메일
  ADMIN_PASSWORD: '',   // Firebase 관리자 비밀번호

  ANTHROPIC_API_KEY: '', // https://console.anthropic.com 에서 발급 (claude-sonnet-4-6 사용)

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

// ── Anthropic Claude API → 답변 + 레퍼런스 생성 ─────────────────
function _callClaude(question) {
  const url = 'https://api.anthropic.com/v1/messages';

  const systemPrompt =
    '당신은 서울대학교 치과병원 보철과 전임의이자 JPD·Dent Mater 등 국제 보철학 저널에 다수 논문을 발표한 임상 연구자입니다.\n' +
    '아래 임상 질문에 대해 치과 전공의가 세미나에서 발표하고 방어할 수 있으며, 교과서 챕터나 리뷰 논문으로 출판해도 손색없는 수준의 종합 정리문을 작성하세요.\n\n' +

    '## 품질 기준 — 이것이 핵심입니다\n\n' +

    '**[깊이]**\n' +
    '- 표면적 설명("bonding agent를 도포한다")이 아닌, 그 이유와 기전("왜 이 시점에 해야 하는가, 하지 않으면 분자 수준에서 무슨 일이 생기는가")까지 서술하세요.\n' +
    '- 단순 사실 나열이 아닌, 개념 간의 인과 관계와 임상적 의미를 연결해서 논증하세요.\n' +
    '- 역사적 맥락: 이 개념이 왜, 어떻게 등장했는지 선행 연구의 흐름을 짚어주세요.\n\n' +

    '**[정밀도]**\n' +
    '- 모든 수치는 구체적으로: "충분한 시간", "적절한 양" → "15초", "35~37% 농도", "0.5 mm 두께", "20~30% 향상" 등으로 대체.\n' +
    '- 제품명·브랜드명 명시: "resin cement" → "RelyX Ultimate, Panavia F 2.0" 등 실제 임상에서 쓰는 이름.\n' +
    '- 저자명과 연도를 본문 안에 직접 인용: "Magne(2005)는...", "van den Breemer et al.(2021)의 RCT에서...".\n\n' +

    '**[균형]**\n' +
    '- 지지하는 근거와 상충하는 근거를 모두 제시하세요. 세미나에서 반박 질문이 들어올 포인트를 먼저 인정하고 논거를 제시하세요.\n' +
    '- In vitro vs. in vivo 결과 차이, 연구 방법론의 한계, 아직 consensus가 없는 영역을 솔직하게 구분하세요.\n\n' +

    '**[임상 실용성]**\n' +
    '- "임상에서 바로 쓸 수 있는" 수준으로: 실패 빈도가 높은 단계, 흔한 실수, Critical point마다 "왜 그게 문제인가"를 명확히 서술.\n' +
    '- 임상적으로 가변적인 부분은 반드시 "임상적 판단 필요"로 구분.\n\n' +

    '## 구조 지침\n' +
    '- 목차는 질문의 성격에 맞게 자유롭게 구성하세요. 고정된 템플릿을 따르지 않아도 됩니다.\n' +
    '- 단, 답변 전체 길이는 한국어 기준 최소 8000자 이상이어야 합니다.\n' +
    '- 각 섹션은 불릿 나열이 아닌 서술형 문단으로, 필요하면 번호 붙은 소제목(예: 3.1, 3.2)으로 세분화.\n' +
    '- 마지막에는 반드시 **"핵심 Take-home Messages"** 섹션을 두세요: R1 관점에서 알아야 할 핵심 5~7가지, 세미나 질문 대비 포인트.\n' +
    '- 한국어로 작성, 전문 용어는 영문 병기.\n\n' +

    '## 절대 금지\n' +
    '- "적절한 재료를 선택한다", "충분히 경화시킨다" 같은 막연한 서술\n' +
    '- 수치 없이 "우수한 결과를 보였다"\n' +
    '- 논란 있는 주제에서 한쪽 입장만 서술\n' +
    '- 구글 검색 수준의 피상적 개요 나열\n\n' +

    '## 품질 기준 예시 — 아래와 같은 깊이와 문체로 작성하세요\n\n' +
    '다음은 "Immediate Dentin Sealing(IDS)"에 대한 답변 일부입니다. 이 수준이 요구하는 최소 품질입니다.\n\n' +
    '---\n' +
    '이 개념의 뿌리는 1990년대 초로 거슬러 올라갑니다. Pashley와 동료들이 1992년 dentin bonding agent를 치아 삭제 직후 적용하면 dentin permeability가 유의하게 감소한다는 것을 발견했고, 이것이 "dentin pre-hybridization"이라는 개념의 출발점이었습니다. Paul과 Schärer는 1997년 "dual bonding technique"을 제안했는데, 이는 prep 시점과 final cementation 시점 두 번에 걸쳐 bonding을 시행하는 방식이었습니다. Pascal Magne(2005)가 이 개념을 체계화하면서 "Immediate Dentin Sealing"이라는 용어로 정립했고, J Esthet Restor Dent와 J Prosthet Dent에 연이은 논문을 발표하면서 현재의 protocol이 자리잡았습니다.\n\n' +
    'DDS에서는 dentin bonding과 resin cement의 polymerization shrinkage가 거의 동시에 발생하면서, 그 stress가 미성숙한 hybrid layer에 직접 전달됩니다. 반면 IDS에서는 hybrid layer가 이미 완전히 polymerize되어 있는 상태이기 때문에, final cementation 시점의 shrinkage stress가 이 pre-cured layer에 의해 일부 흡수·분산되어 interfacial strain이 최소화됩니다. 이를 stress-absorbing layer(elastic cushion) 개념이라고도 부릅니다.\n\n' +
    'Matrix metalloproteinase(MMP) — dentin 내부에 존재하는 zinc/calcium 의존성 endogenous protease — 는 phosphoric acid etching 과정에서 활성화되어 hybrid layer 내 collagen fibril을 시간이 지남에 따라 가수분해하는데, 이것이 "adhesive aging"의 핵심 기전입니다. IDS는 prep 직후 안정적인 resin seal을 제공함으로써 MMP 활성을 제한하고 collagen degradation 진행을 지연시킬 수 있습니다. DDS에서는 dentin이 노출된 채로 1~2주 이상 유지되면서 MMP-mediated degradation이 최대화되는 시간이 주어지는 셈입니다.\n\n' +
    'Alghauli et al.(2024)의 systematic review and meta-analysis에서 11개의 임상 연구를 종합한 결과, IDS 그룹의 survival rate은 96.4~100%로 IDS를 시행하지 않은 그룹(81.8~96.7%)보다 유의하게 높았습니다(P<.05). 그러나 균형 있게 봐야 합니다. van den Breemer et al.(2019)의 RCT 결과는 단기 outcome — 특히 postoperative sensitivity와 patient satisfaction — 에서 IDS와 DDS 간 유의한 차이를 발견하지 못했습니다. 이는 IDS의 임상적 이득이 모든 상황에서 동일하게 큰 것은 아니며, 특히 extensive dentin exposure와 deep preparation 케이스에서 더 두드러진다는 것을 시사합니다.\n' +
    '---\n\n' +
    '위 예시처럼: 역사적 흐름 → 분자 기전 → 구체적 수치가 있는 임상 근거 → 상충하는 근거까지 모두 포함된 깊이로 작성하세요.\n\n' +

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
      'x-api-key':         CONFIG.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    payload: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 8192,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: question }],
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  const text = result?.content?.[0]?.text;
  if (!text) throw new Error('Claude 응답 실패: ' + res.getContentText());
  Logger.log('[Claude 답변 생성 완료]');
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
      if (CONFIG.ANTHROPIC_API_KEY) {
        try {
          const raw = _callClaude(title + '\n\n' + body);
          const parsed = _parseGroqResponse(raw);
          answer = parsed.answer;
          references = parsed.references;
          Logger.log('[레퍼런스 ' + references.length + '개 파싱됨]');
        } catch(e) {
          Logger.log('[Claude 오류] ' + e.message);
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

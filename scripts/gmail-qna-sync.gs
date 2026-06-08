// ── 설정 (여기만 채우면 됩니다) ──────────────────────────────────
const CONFIG = {
  FIREBASE_API_KEY: 'AIzaSyAFgVx2JCezjhUg_40TQrc3s1k-pts4H8Q',
  PROJECT_ID:       'dental-clinical-5c291',

  ADMIN_EMAIL:    '',   // Firebase 관리자 이메일
  ADMIN_PASSWORD: '',   // Firebase 관리자 비밀번호

  OPENAI_API_KEY: '', // https://platform.openai.com 에서 발급

  CLOUDINARY_CLOUD_NAME:    'dg7aas4ky',
  CLOUDINARY_UPLOAD_PRESET: 'dental_clinic',

  // 메일 제목 접두어 → Firestore department ID 매핑
  // 새 부문 추가 시 여기에만 줄 추가 — SEARCH_QUERY는 아래에서 자동 생성
  DEPT_MAP: {
    'QnA':    'qna',
    '고정성': 'fixed',
    '임플란트': 'implant',
    'RPD':    'rpd',
    'CD':     'cd',
    '재료':   'materials',
  },

  // QnA 부문만 GPT Q1~Q10 생성; 나머지는 이미지+본문 단순 업로드
  // 여기에 부문 ID를 추가하면 해당 부문도 GPT Q&A 처리
  GPT_QA_DEPTS: ['qna'],

  PROCESSED_LABEL: '덴탈-완료',
};

// SEARCH_QUERY: DEPT_MAP 키에서 자동 생성 (수동으로 맞출 필요 없음)
CONFIG.SEARCH_QUERY = '(' + Object.keys(CONFIG.DEPT_MAP).map(function(k) {
  return 'subject:[' + k + ']';
}).join(' OR ') + ') is:unread';

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

// ── OpenAI GPT Q&A 생성 (Q1~Q10, narrative review 스타일) ──────────
function _callGPTBatch(question) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const systemPrompt =
    '당신은 치과대학 임상 교수입니다. 주어진 주제에 대해 ' +
    '**임상 narrative review 논문 수준의 Q&A를 Q1부터 Q10까지 정확히 10개** 작성하세요.\n' +
    '제목, 머리말, 마무리 등 Q&A 외의 텍스트는 일절 출력하지 말 것.\n\n' +

    '## 답변 구조 — 모든 답변에 반드시 적용\n' +
    '각 답변은 아래 흐름을 따르는 **서술식 학술 문체**로 작성한다 (소제목 없이 자연스럽게 이어지는 단락으로):\n' +
    '① **개요/배경** — 개념 정의, 임상적 중요성, 문제 제기\n' +
    '② **근거** — SR·MA·RCT를 in vitro 연구보다 우선 인용. 수치(생존율·bond strength·KIC 등)는 반드시 출처와 함께\n' +
    '③ **임상 적용** — 술식이 있으면 단계별(step-by-step) 기술, 재료·방법 선택 기준 제시\n' +
    '④ **한계·논란** — 반론, 근거 공백, 방법론적 한계를 균형 있게 제시\n' +
    '⑤ **결론** — 현재 근거 수준(SR·RCT·전문가 합의 등) 명시 후 임상 권고\n\n' +

    '## 답변 품질 기준 — 절대 준수\n' +
    '- 각 답변 **최소 400단어** (한글 기준)\n' +
    '- 인용 **최소 6개**. 가능하면 체계적 문헌고찰(SR)·메타분석(MA)·RCT를 1순위로 인용\n' +
    '- 없는 논문·틀린 수치 절대 금지. 불확실한 경우 "[문헌 확인 필요]" 표시\n' +
    '- 표준 교과서 적극 활용: Rosenstiel, Shillingburg, Magne, Lindhe, Van Noort, Anusavice, Powers & Wataha, Nanci 등\n' +
    '- 인용 형식: 저자, 연도, 저널명, 권호 포함 — 예: (Pjetursson et al., 2018, Clin Oral Implants Res 29(S16):196-223)\n' +
    '- 전문 용어는 영문 병기. 번역투 금지 — 교수가 전공의에게 강의하듯 자연스러운 한국어\n\n' +

    '## 질문 설계 기준\n' +
    '- 개념(why) + 술식(how) + 근거(what evidence)를 통합하는 질문\n' +
    '- 단순 정의·나열 질문 금지. 판단·선택·논란이 내포된 질문\n' +
    '- 10개 질문은 서로 다른 임상 측면(재료·술식·합병증·예후·의사결정 등)을 다룰 것\n' +
    '- 같은 키워드가 2개 이상 겹치지 않을 것\n\n' +
    '**Q1부터 Q10까지 정확히 10개. 이 범위를 벗어난 번호 출력 금지.**';

  const fewShotUser = 'Immediate Dentin Sealing (IDS) — Q1부터 Q2까지 작성해줘';

  const fewShotAssistant =
    '**Q1. IDS(Immediate Dentin Sealing)의 생물학적 근거, 표준 술식, 그리고 DDS 대비 임상적 효과에 대한 현재까지의 근거 수준은 어떠한가?**\n\n' +
    'A: IDS는 지대치 형성 직후, 인상 채득 전에 resin adhesive를 dentin에 즉시 도포·중합하는 술식으로, Magne et al.에 의해 체계화되었다. 핵심 이론적 근거는 두 가지다: 첫째, 노출된 dentin에 존재하는 MMP(matrix metalloproteinase)-2, -8, -9는 phosphoric acid etching에 의해 활성화되어 hybrid layer 내 미침투 collagen fibril을 점진적으로 가수분해하며, IDS는 이 경로를 조기에 차단한다 (Tjäderhane et al., 2013, Dent Mater 29(1):116-135). 둘째, provisional 기간 중 구강액 및 임시접착제 성분에 의한 dentin 오염을 방지하여 최종 접착 시 clean bonding substrate를 확보할 수 있다 (Magne et al., 2005, J Prosthet Dent 93(3):226-235).\n\n' +
    'In vitro bond strength 연구들은 일관되게 IDS의 우월성을 지지한다. Magne & Nielsen(2009, J Prosthet Dent 102(3):168-177)에서 IDS군의 microtensile bond strength(μTBS)는 평균 51 MPa로 DDS군(32 MPa)을 유의하게 상회하였으며, Stavridakis et al.(2004, Oper Dent 29(2):144-154)에서도 IDS군이 약 40% 높은 μTBS를 보였다. IDS의 표준 술식은 다음과 같다: ① 형성 완료 후 세척·건조, ② 37% phosphoric acid 15초 도포 후 세척, ③ 선택한 adhesive system 도포, ④ 광중합 후 oxygen-inhibited layer(OIL) 제거 — pumice microabrasion 또는 glycerin gel 하 2차 광중합, ⑤ dies spacer 적용 후 인상 채득. OIL을 반드시 제거해야 하는 이유는 최종 cementation 시 luting resin과의 재접착(rebonding)을 위한 reactive surface 확보를 위해서다 (Grégoire et al., 2003, J Prosthet Dent 89(5):462-472).\n\n' +
    '임상 RCT 데이터는 아직 제한적이다. van den Breemer et al.(2019, Oper Dent 44(1):E1-E15)의 split-mouth RCT에서는 2년 추적 결과 IDS군과 DDS군 간 restoration survival rate에 통계적으로 유의한 차이가 없었다. 이는 단기 관찰 한계 및 소표본이라는 방법론적 제약을 반영한다. 현재 IDS를 지지하는 근거 수준은 in vitro evidence와 expert consensus(Level III–IV) 수준에 머물러 있으며, 장기 무작위 대조 연구가 부재하다는 점은 명확한 한계다. 결론적으로, adhesive indirect restoration에서 IDS는 생물학적 합리성과 실험실 근거가 충분하여 임상적으로 권장할 수 있으나, "IDS = 임상 outcome 향상"이라는 직접적 인과관계는 아직 고수준 RCT로 입증되지 않았음을 인지해야 한다.\n\n' +

    '**Q2. Dental ceramic 계열별 fracture toughness의 차이와 임상 파절 패턴, 그리고 수복 위치·교합 조건에 따른 재료 선택 근거는 무엇인가?**\n\n' +
    'A: 치과용 세라믹은 결정상(crystalline phase) 함량과 종류에 따라 크게 feldspathic porcelain, leucite-reinforced glass ceramic(e.g., IPS Empress), lithium disilicate(e.g., IPS e.max CAD), 그리고 yttria-stabilized tetragonal zirconia polycrystal(Y-TZP)로 나뉜다. Fracture toughness(KIC)는 재료의 균열 저항성을 나타내는 핵심 지표이며, 계열 간 현저한 차이를 보인다: feldspathic porcelain 0.7–1.0 MPa·m½, leucite-reinforced 1.2–1.5 MPa·m½, lithium disilicate 2.0–3.5 MPa·m½, Y-TZP 5.0–10.0 MPa·m½ (Kelly & Benetti, 2011, Dent Mater 27(1):73-82). Zirconia의 높은 강도는 tetragonal→monoclinic phase transformation(transformation toughening)에 기반하는데, 균열 선단에 compressive stress를 형성하여 균열 진전을 억제한다 (Chevalier, 2006, Biomaterials 27(4):535-543).\n\n' +
    '임상 생존율 메타분석에서 Pjetursson et al.(2018, Clin Oral Implants Res 29(S16):196-223)은 zirconia FDP의 10년 생존율을 약 90.4%로 보고하였으며, 이는 metal-ceramic FDP(94.4%)와 통계적으로 유의한 차이가 없었다. Lithium disilicate 단관의 5년 생존율은 Mörmann et al.(2013, J Dent 41(12):1100-1111)에서 97.2%로 우수한 성적을 보였다. 수복 위치 및 교합 조건에 따른 선택 기준은 다음과 같다: ① 전치부 veneer 또는 partial coverage — feldspathic 또는 ultra-thin lithium disilicate(≥0.3 mm), ② 구치부 단관 — monolithic lithium disilicate 또는 monolithic zirconia, ③ 3-unit 이상 FDP — Y-TZP 프레임워크 또는 monolithic high-translucency zirconia, ④ 임플란트 상부구조 — screw-retained monolithic zirconia가 cement void 없이 위생에 유리하다. Antagonist wear 측면에서 polished monolithic zirconia는 enamel 마모를 최소화한다는 점도 임상 선택에 중요한 근거가 된다 (Lawson et al., 2014, J Prosthet Dent 112(6):1380-1387).\n\n' +
    '논란이 되는 부분은 고투명 zirconia(5Y-TZP, cubic-containing)의 long-term durability다. 투명도를 높이기 위해 결정립 크기를 증가시키면 transformation toughening 효율이 감소하여 3Y-TZP 대비 KIC가 낮아지는 paradox가 발생한다 (Zhang & Lawn, 2018, J Dent Res 97(2):140-147). 또한 Y-TZP는 저온 열화(low-temperature degradation, LTD)에 의해 표면 tetragonal phase가 자발적으로 monoclinic으로 전환되어 장기 강도가 저하될 수 있다는 우려도 존재한다 (Lughi & Sergo, 2010, Dent Mater 26(8):807-820). 결론적으로, 치과 세라믹 선택은 단일 지표(강도)로 결정할 수 없으며, 수복 위치·교합력·심미 요구·위생 관리 가능성을 통합적으로 고려해야 한다. 현재 근거 수준에서 lithium disilicate는 단관·소교의에, zirconia는 장교의 및 고부하 구치부에 우선 권장되나, 10년 이상 장기 RCT 비교 데이터는 여전히 제한적이다.';

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + CONFIG.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      model:       'gpt-4o',
      max_tokens:  16384,
      temperature: 0,
      messages: [
        { role: 'system',    content: systemPrompt },
        { role: 'user',      content: fewShotUser },
        { role: 'assistant', content: fewShotAssistant },
        { role: 'user',      content: question + '\n\n[Q1부터 Q10까지 정확히 10개만 작성할 것. Q11 이상 출력 절대 금지.]' },
      ],
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  const rawText = result?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('GPT 응답 실패: ' + res.getContentText());

  // Q10 이후 내용 강제 제거 (GPT가 10개 초과 생성할 경우 대비)
  const text = _trimAfterQ10(rawText.trim());
  const qCount = (text.match(/\*\*Q\d+\./g) || []).length;
  Logger.log('[GPT Q&A 생성 완료] 질문 수: ' + qCount);
  return text;
}

// ── OpenAI GPT → Q1~Q10 단일 호출 ───────────────────────────────
function _callGPT(question) {
  return _callGPTBatch(question);
}

// ── Q10 이후 내용 강제 제거 ───────────────────────────────────────
function _trimAfterQ10(text) {
  // Q11 이상 (**Q11. / ## Q11. / Q20. 등 모두) → 그 앞에서 자름
  // Q1[1-9] 는 Q11-Q19만 커버 → [2-9]\d 로 Q20+ 도 처리
  const pos = text.search(/(\*{0,2}|#{1,3}\s*)Q(?:1[1-9]|[2-9]\d|\d{3,})\./);
  if (pos !== -1) {
    const trimmed = text.slice(0, pos).trimEnd();
    Logger.log('[Q&A 후처리] Q11 이후 내용 제거 (' + (text.length - trimmed.length) + '자)');
    return trimmed;
  }
  return text;
}

// ── GPT 답변에서 인용 파싱 ────────────────────────────────────
function _extractCitations(text) {
  // Normalize "Author et al.(year, Journal)" → "(Author year, Journal)"
  text = text.replace(
    /(?<!\()([A-Za-zÄÖÜäöüéèêàâčšžćđ']+(?:\s+et\s+al\.?)?(?:\s+&\s+[A-Za-z']+)?)\s*\(\s*((?:19|20)\d{2})\s*[,;]\s*([^)(]*(?:\([^)]*\))*[^)(]*)\)/g,
    '($1 $2, $3)'
  );
  // Handles: (Author year, Journal), (Author, year, Journal), O'Brien-style names, 29(1):116-135 volumes
  const regex = /\(([A-Za-zÄÖÜäöüéèêàâčšžćđ']+(?:\s+et\s+al\.?)?(?:\s+&\s+[A-Za-z']+)?)[,;\s]+(\d{4})[,;\s]+([^)(]*(?:\([^)]*\))*[^)(]*)\)/g;
  const seen  = {};
  const out   = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const key = m[1].trim() + '_' + m[2].trim();
    if (seen[key]) continue;
    seen[key] = true;
    out.push({ author: m[1].trim(), year: m[2].trim(), source: m[3].trim() });
  }
  return out;
}

// ── PubMed API 논문 조회 ──────────────────────────────────────
function _searchPubMed(author, year, source) {
  try {
    // 저자 성(last name)만 추출
    const lastName = author.replace(/\s+et\s+al\.?/i, '').replace(/\s+&\s+.+/, '').trim().split(/\s+/).pop();
    // 저널 첫 단어만 사용 (괄호/권호 제거)
    const journalWord = source.replace(/\d+\(.*/, '').split(/[,\s]/)[0];
    const query = lastName + '[Author] AND ' + year + '[pdat] AND ' + journalWord + '[journal]';
    const searchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
      + '?db=pubmed&retmode=json&retmax=1&term=' + encodeURIComponent(query);

    const sRes  = UrlFetchApp.fetch(searchUrl, { muteHttpExceptions: true });
    const sData = JSON.parse(sRes.getContentText());
    const ids   = sData?.esearchresult?.idlist;
    if (!ids || ids.length === 0) return null;

    const pmid = ids[0];
    const sumUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'
      + '?db=pubmed&retmode=json&id=' + pmid;
    const sumRes  = UrlFetchApp.fetch(sumUrl, { muteHttpExceptions: true });
    const sumData = JSON.parse(sumRes.getContentText());
    const doc     = sumData?.result?.[pmid];
    if (!doc) return null;

    const doi = (doc.articleids || []).find(function(a) { return a.idtype === 'doi'; });
    return {
      authors:  (doc.authors || []).map(function(a) { return a.name; }).join(', '),
      year:     (doc.pubdate || year).split(' ')[0],
      title:    doc.title   || '',
      journal:  doc.fulljournalname || doc.source || source,
      volume:   doc.volume  || '',
      pages:    doc.pages   || '',
      doi:      doi ? doi.value : '',
      pmid:     pmid,
      abstract: '',
      abstractEn: '',
    };
  } catch(e) {
    Logger.log('[PubMed 오류] ' + author + ' ' + year + ': ' + e.message);
    return null;
  }
}

// ── 교과서 여부 판별 (PubMed 검색 건너뛰기용) ─────────────────
function _isTextbook(source) {
  const publishers = ['Quintessence', 'Mosby', 'Elsevier', 'Blackwell', 'Wiley',
    'Springer', 'Saunders', 'Year Book', 'Hanover Park', 'Karger', 'Thieme'];
  const s = source || '';
  return publishers.some(function(p) { return s.indexOf(p) !== -1; });
}

// ── GPT 답변 파싱 + PubMed 인용 검증 ────────────────────────
function _parseAndVerify(text) {
  const citations = _extractCitations(text);
  Logger.log('[인용 추출] ' + citations.length + '개');

  const refs = [];
  citations.forEach(function(c) {
    if (_isTextbook(c.source)) {
      Logger.log('[교과서 — PubMed 건너뜀] ' + c.author + ' ' + c.year);
      refs.push({
        authors: c.author, year: c.year, title: c.source, journal: '교과서',
        volume: '', pages: '', doi: '', abstract: '', abstractEn: '',
      });
      return; // sleep 없이 건너뜀
    }
    const found = _searchPubMed(c.author, c.year, c.source);
    if (found) {
      Logger.log('[PubMed 확인] ' + c.author + ' ' + c.year + ' → ' + found.title.slice(0, 60));
      refs.push(found);
    } else {
      Logger.log('[PubMed 미발견] ' + c.author + ' ' + c.year + ' / ' + c.source);
      refs.push({
        authors: c.author, year: c.year, title: '', journal: c.source,
        volume: '', pages: '', doi: '', abstract: '', abstractEn: '',
      });
    }
    Utilities.sleep(350); // NCBI rate limit 준수 (3 req/s)
  });

  return { answer: text, references: refs };
}

// ── GPT-4o Vision 호출 헬퍼 ─────────────────────────────────────
function _visionCall(systemMsg, userText, imageBlocks, maxTokens) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const userContent = [{ type: 'text', text: userText }].concat(imageBlocks);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + CONFIG.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    payload: JSON.stringify({
      model: 'gpt-4o', max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user',   content: userContent },
      ],
    }),
    muteHttpExceptions: true,
  });
  const result = JSON.parse(res.getContentText());
  return result?.choices?.[0]?.message?.content || '';
}

// ── GPT-4o Vision → 치과적 이미지 심층 분석 (2-pass) ─────────────
function _analyzeImagesWithVision(attachments) {
  if (!attachments || attachments.length === 0) return '';

  // 이미지 base64 인코딩 (최대 6장)
  const imageBlocks = [];
  attachments.slice(0, 6).forEach(function(att) {
    if (!att.getContentType().startsWith('image/')) return;
    try {
      const b64 = Utilities.base64Encode(att.getBytes());
      imageBlocks.push({
        type: 'image_url',
        image_url: { url: 'data:' + att.getContentType() + ';base64,' + b64, detail: 'high' },
      });
    } catch(e) { Logger.log('[Vision 인코딩 오류] ' + e.message); }
  });
  if (imageBlocks.length === 0) return '';

  // ── PASS 1: 각 이미지를 사실 그대로 상세 묘사 (raw observation) ──
  const pass1System =
    '당신은 치과 보철과 전문의입니다. 제공된 이미지들을 보고 ' +
    '각 이미지에서 보이는 것을 최대한 구체적이고 사실적으로 묘사하세요. ' +
    '해석이나 결론은 아직 내리지 말고, 보이는 것만 나열하세요.\n\n' +
    '각 이미지마다:\n' +
    '**이미지 N:** 촬영 각도, 잔존 치아, 결손 부위, 마킹 라인, 수복물, ' +
    '모델 상태, 연조직/경조직 형태 등 눈에 보이는 모든 것을 빠짐없이 기술하세요.';

  Logger.log('[Vision Pass 1 시작]');
  const rawObservation = _visionCall(pass1System, '각 이미지를 상세히 묘사해주세요.', imageBlocks, 2048);
  if (!rawObservation) return '';
  Logger.log('[Vision Pass 1 완료]');

  // ── PASS 2: Pass1 묘사를 바탕으로 보철과 교수 수준 임상 분석 ──
  const pass2System =
    '당신은 대학병원 치과 교수(보철, 보존, 치주, 구강외과, 교정 전 분야 통합 지식 보유)입니다. ' +
    '아래 이미지 관찰 내용을 읽고 다음 순서로 작성하세요.\n\n' +
    '번역투 금지. 교수가 전공의에게 강의하듯 자연스러운 한국어. 전문 용어는 영문 병기.\n\n' +

    '---\n\n' +

    '## STEP 1 — 케이스 유형 판별\n' +
    '관찰 내용을 보고 이 케이스의 주된 임상 분야를 먼저 명시하세요.\n' +
    '(예: 고정성 보철 / 가철성 보철·RPD / 완전 의치 / 임플란트 보철 / 치주 / 보존·충치 / 근관치료 / 구강외과 / 교정 / 소아치과 / 복합 증례)\n\n' +

    '---\n\n' +

    '## STEP 2 — 공통 기본 소견\n' +
    '케이스 유형과 무관하게 항상 작성:\n' +
    '- **치아 번호(FDI)** 및 결손/잔존 현황\n' +
    '- 촬영 매체 구분 (임상 사진 / X-ray 종류 / 스터디 모델 / 기타)\n' +
    '- 전반적인 구강위생 상태, 기존 수복물, 연조직 이상 여부\n' +
    '- 교합 관계 (Angle 분류, 과잉맹출, 경사, 회전 등 관찰 가능한 범위)\n\n' +

    '---\n\n' +

    '## STEP 3 — 케이스 유형별 심층 분석\n' +
    '판별된 케이스 유형에 따라 아래 해당 항목을 적용하세요.\n\n' +

    '### [고정성 보철 / 크라운·브릿지]\n' +
    '지대치 형성 평가: 삭제량, 수렴각(taper), 마진 위치·형태(chamfer/shoulder/knife-edge)\n' +
    '보철물 평가(있는 경우): 변연 적합도, emergence profile, 색조 조화, 교합 접촉\n' +
    '임시 보철물 평가(있는 경우): 형태, 마진 봉쇄, 치은 반응\n' +
    'Bridge 케이스: pontic 형태, connector 크기, 위생 관리 가능성\n\n' +

    '### [가철성 보철 — RPD]\n' +
    'Kennedy 분류 + Applegate 수정 분류\n' +
    '지대치별: 서베이 라인, 언더컷 방향·양, 클라스프 종류 추천(Akers/RPI/RPA/bar clasp)\n' +
    '레스트 시트 위치 및 준비 적합성\n' +
    '주연결장치(major connector) 추천: lingual bar / lingual plate / palatal bar / palatal plate 등\n' +
    'Ridge 형태(Cawood & Howell), 삽입로(path of insertion) 고려사항\n' +
    'Mouth preparation 필요 항목, 임플란트 overdenture 전환 기준\n\n' +

    '### [완전 의치]\n' +
    '무치악 ridge 형태 및 흡수 정도(상·하악 구분)\n' +
    '주변 해부학적 구조 관찰(hamular notch, retromolar pad, vibrating line 등)\n' +
    '수직 고경, 중심위 관련 고려사항\n' +
    'Impression 방식 제안 (primary vs. final impression technique)\n\n' +

    '### [임플란트]\n' +
    '임플란트 위치, 식립 각도, 인접 치아와의 거리 추정\n' +
    '골수준(bone level), 변연골 소실 여부 (X-ray 있는 경우)\n' +
    'Emergence profile, 연조직 contour, 위생 관리 가능성\n' +
    '보철 연결 방식: cement-retained vs. screw-retained\n' +
    '하중 프로토콜 고려사항 (immediate / early / conventional loading)\n\n' +

    '### [치주]\n' +
    '치은 형태: 색, 형태, 질감(stippling 유무), 출혈 징후\n' +
    '골 소실 패턴 추정 (수평형/수직형), 치근 분리부(furcation) 침범 가능성\n' +
    '치은 퇴축(recession): Miller 분류 가능 시 적용\n' +
    '치석·치태 분포, 치주 치료 후 평가(있는 경우)\n\n' +

    '### [보존 / 충치 / 직접 수복]\n' +
    '우식 위치(Black 분류), 범위, 인접면·치경부·교합면 여부\n' +
    '기존 수복물 상태: 이차 우식, 변연 파절, 변색\n' +
    '직접 vs. 간접 수복 선택 기준\n' +
    '치수 노출 위험도 추정\n\n' +

    '### [근관치료 / 치수치료]\n' +
    'X-ray 소견: 근관 형태, 만곡도, 폐쇄 여부, 기존 충전 상태\n' +
    '근단 병소 여부, 크기, 경계 명확성\n' +
    '치근 흡수, file 분리, perforation 여부\n' +
    '치료 후 평가(있는 경우): 충전 밀도, 길이, 측방 충전 여부\n\n' +

    '### [구강외과 / 발치 / 임플란트 식립 전]\n' +
    '발치 예정 치아: 치근 형태, 만곡, 분리 여부, 골 유착 가능성\n' +
    '매복치: 위치(수직/수평/도립), 인접 치아 흡수, 신경 근접도\n' +
    '발치와/이식 부위 평가(있는 경우): 치유 단계, 감염 징후\n\n' +

    '### [교정]\n' +
    'Angle 분류, skeletal 관계 추정\n' +
    '개별 치아 이상: crowding, spacing, 회전, 경사, 과잉맹출\n' +
    '브라켓/장치 위치 평가(있는 경우)\n' +
    '치근 흡수, 골 지지 충분성 (보조 X-ray 있는 경우)\n\n' +

    '---\n\n' +

    '## STEP 4 — 치료 계획 제안\n' +
    '- 전처치(pre-prosthetic/pre-restorative treatment) 필요 항목\n' +
    '- 단계별 치료 순서 제안\n' +
    '- 대안적 치료 옵션 및 각 옵션의 장단점\n' +
    '- 장기 예후에 영향을 미치는 주요 변수\n\n' +

    '## STEP 5 — 전공의 세미나 포인트\n' +
    '- 추가로 반드시 확인해야 할 자료 (파노라마, CBCT, 교합 분석, 사진 추가 촬영 등)\n' +
    '- 이 케이스의 핵심 임상 난이도 요소 3가지\n' +
    '- **교수가 세미나에서 반드시 물어볼 질문 5가지 + 각 예상 모범 답안**\n\n' +

    '## 주의\n' +
    '확정적 진단 금지. 관찰 불가 항목은 반드시 "확인 불가 — 추가 자료 필요"로 명시.';

  const pass2UserText =
    '아래는 이미지 관찰 내용입니다:\n\n' + rawObservation +
    '\n\n위 관찰을 바탕으로 심층 임상 분석을 작성해주세요.';

  Logger.log('[Vision Pass 2 시작]');
  const deepAnalysis = _visionCall(pass2System, pass2UserText, [], 6144);
  Logger.log('[Vision Pass 2 완료]');

  return deepAnalysis.trim();
}

// ── 이미지 MIME 타입 해석 헬퍼 ───────────────────────────────────
// content-type이 image/* 면 그대로, octet-stream 등이면 확장자로 추론.
// 이미지가 아니면 null 반환.
var _IMAGE_EXT_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif',  webp: 'image/webp', heic: 'image/heic',
  bmp: 'image/bmp',  tif:  'image/tiff', tiff: 'image/tiff',
};
function _getImageMimeType(att) {
  var ct = att.getContentType() || '';
  if (ct.startsWith('image/')) return ct;
  var ext = (att.getName() || '').split('.').pop().toLowerCase();
  return _IMAGE_EXT_MAP[ext] || null;
}

// ── Cloudinary 이미지 업로드 → URL ───────────────────────────────
function _uploadToCloudinary(attachment) {
  const ct = _getImageMimeType(attachment) || 'image/jpeg';

  const base64  = Utilities.base64Encode(attachment.getBytes());
  const dataUri = 'data:' + ct + ';base64,' + base64;
  const url     = 'https://api.cloudinary.com/v1_1/' + CONFIG.CLOUDINARY_CLOUD_NAME + '/image/upload';

  // 파일명의 슬래시·특수문자 제거 → public_id에 명시해 Cloudinary 오류 방지
  const rawName  = (attachment.getName() || 'image').replace(/\.[^.]+$/, '');
  const publicId = rawName.replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_') + '_' + Date.now();

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { file: dataUri, upload_preset: CONFIG.CLOUDINARY_UPLOAD_PRESET, public_id: publicId },
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  if (!result.secure_url) throw new Error('Cloudinary 업로드 실패 (' + ct + '): ' + res.getContentText().slice(0, 300));
  Logger.log('[이미지 업로드 완료] ' + attachment.getName() + ' → ' + result.secure_url);
  return result.secure_url;
}

// ── Firestore에 문서 저장 ────────────────────────────────────────
function _addQnADoc(title, description, answer, photoUrls, references, department, cachedToken) {
  const token   = cachedToken || _getIdToken();
  const dateStr = new Date().toISOString().slice(0, 10);
  const dept    = department || 'qna';

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
          pmid:       { stringValue: r.pmid       || '' },
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
      department:  { stringValue: dept },
      date:        { stringValue: dateStr },
      createdAt:   { timestampValue: new Date().toISOString() },
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

// ── 메인: 이메일 → 이미지 업로드 → (QnA면 GPT) → Firestore 저장 ──
function checkQnAEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, 20);
  if (!threads.length) { Logger.log('새 이메일 없음'); return; }

  const doneLabel = _getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  const idToken   = _getIdToken(); // 루프 밖에서 1회만 인증

  threads.forEach(function(thread) {
    try {
      const msg     = thread.getMessages()[0];
      const subject = msg.getSubject();

      // 제목에서 [부문] 접두어 파싱 → 부문 ID 결정
      // 예) "[고정성] 세라믹 수복 케이스" → prefix="고정성", dept="fixed"
      const prefixMatch = subject.match(/^\[([^\]]+)\]/);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      const dept   = CONFIG.DEPT_MAP[prefix] || 'qna';
      const title  = subject.replace(/^\[[^\]]+\]\s*/, '').trim() || '(제목 없음)';
      const body   = msg.getPlainBody().trim();

      Logger.log('[처리 시작] 부문=' + dept + ' / 제목=' + title);

      // 첨부파일 수집 — includeInlineImages:true 로 본문 인라인 이미지도 포함
      const allAtts = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
      Logger.log('[첨부파일] 총 ' + allAtts.length + '개 / 타입: ' + allAtts.map(function(a) { return a.getName() + '(' + a.getContentType() + ')'; }).join(', '));

      const imageAtts = allAtts.filter(function(a) { return !!_getImageMimeType(a); });
      Logger.log('[이미지] ' + imageAtts.length + '개 감지');

      const photoUrls = [];
      imageAtts.forEach(function(att) {
        try { photoUrls.push(_uploadToCloudinary(att)); }
        catch(e) { Logger.log('[이미지 업로드 오류] ' + att.getName() + ' — ' + e.message); }
      });

      // GPT-4o Vision 이미지 해설 (첨부 이미지 있을 때만, 모든 부문 공통)
      let visionNote = '';
      if (CONFIG.OPENAI_API_KEY && imageAtts.length > 0) {
        try { visionNote = _analyzeImagesWithVision(imageAtts); }
        catch(e) { Logger.log('[Vision 오류] ' + e.message); }
      }

      let answer = '';
      let references = [];

      if (CONFIG.GPT_QA_DEPTS.indexOf(dept) !== -1 && CONFIG.OPENAI_API_KEY) {
        // ── GPT Q&A 생성 부문 (기본: QnA) ──────────────────────────
        try {
          let qnaContext = '주제: ' + title;
          if (body) qnaContext += '\n\n' + body;
          if (visionNote) {
            qnaContext += '\n\n[첨부 이미지 임상 소견]\n' + visionNote;
            qnaContext += '\n\n위 임상 사진과 소견을 바탕으로 이 케이스에 대한 깊이 있는 Q&A를 작성해주세요.';
          } else {
            qnaContext += '\n\n위 주제에 대한 깊이 있는 Q&A를 작성해주세요.';
          }
          const raw    = _callGPT(qnaContext);
          const parsed = _parseAndVerify(raw);
          answer     = visionNote ? visionNote + '\n\n---\n\n' + parsed.answer : parsed.answer;
          references = parsed.references;
          Logger.log('[PubMed 검증 완료 — 레퍼런스 ' + references.length + '개]');
        } catch(e) {
          Logger.log('[GPT 오류] ' + e.message);
        }
      } else {
        // ── 단순 업로드 부문: Vision 소견만 answer에 포함 ──────────
        answer = visionNote; // 이미지 없으면 '' → answer 필드 비어 있음
      }

      _addQnADoc(title, body, answer, photoUrls, references, dept, idToken);
      thread.markRead();
      thread.addLabel(doneLabel);
      Logger.log('[완료] ' + dept + ' / ' + title + ' / 사진 ' + photoUrls.length + '장');
    } catch(e) {
      Logger.log('[오류] ' + e.message);
    }
  });
}

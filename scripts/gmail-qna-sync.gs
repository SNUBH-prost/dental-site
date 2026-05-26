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

// ── OpenAI GPT 단일 배치 호출 (startQ~endQ) ──────────────────────
function _callGPTBatch(question, startQ, endQ) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const rangeLabel = 'Q' + startQ + '부터 Q' + endQ + '까지 정확히 ' + (endQ - startQ + 1) + '개';

  const systemPrompt =
    '당신은 치과 보철과 교수이자 해당 분야 전문가입니다.\n' +
    '전공의가 보내온 임상 주제에 대해 **깊이 있는 Q&A를 ' + rangeLabel + '** 작성하세요.\n' +
    '이전 또는 이후 번호는 절대 포함하지 말 것. ' + rangeLabel + '만 출력.\n\n' +

    '## 형식 (반드시 준수)\n' +
    '제목, 머리말, 요약, 마무리 문장 등 Q&A 이외의 텍스트는 일절 출력하지 말 것. 오직 Q&A만 출력.\n\n' +
    '**Q' + startQ + '. [질문]**\n' +
    'A: [답변 — 7~10문장 이상, 출처 4개 이상 포함. 각 출처마다 해당 근거가 답변의 어느 부분을 뒷받침하는지 명확히 연결할 것.]\n\n' +
    '**Q' + (startQ + 1) + '. [질문]**\n' +
    'A: [답변 — 7~10문장 이상, 출처 4개 이상 포함.]\n\n' +
    '...\n\n' +
    '**Q' + endQ + '. [질문]**\n' +
    'A: [답변 — 7~10문장 이상, 출처 4개 이상 포함.]\n\n' +

    '## 답변 깊이 원칙 — 절대 준수\n' +
    '- 각 답변은 **최소 200단어 이상** 작성할 것\n' +
    '- 단순 사실 나열 금지. 반드시 ① 배경/기전 → ② 핵심 근거(논문/교과서) → ③ 임상적 함의 → ④ 반론 또는 한계 구조로 전개\n' +
    '- 수치(%, MPa, mm, 생존율 등)는 반드시 출처와 함께 제시\n' +
    '- 논란이 있는 주제는 찬반 양쪽 근거를 모두 제시하고 최종 임상 판단 제안\n\n' +

    '## 근거 원칙 — 절대 준수\n' +
    '- **모든 답변은 논문 또는 교과서에 근거해야 한다**\n' +
    '- 각 답변에 출처 **최소 4개** 이상\n' +
    '- 출처가 불확실하면 해당 내용을 쓰지 말 것. 꼭 써야 하면 "[문헌 확인 필요]"로 표시\n' +
    '- 없는 논문 만들지 말 것. 틀린 수치 제시 금지\n' +
    '- Rosenstiel, Shillingburg, Magne, Lindhe, Van Noort, Anusavice, Powers & Wataha, Nanci(Ten Cate) 등 표준 교과서 적극 활용\n' +
    '- Journal 인용 시 저자, 연도, 저널명, 가능하면 권호 포함: (Tjäderhane et al. 2013, Dent Mater 29(1):116-135)\n\n' +

    '## 질문 수준 원칙 — 절대 준수\n' +
    '❌ 금지: "~의 기전은?", "~의 적응증은?", "~란 무엇인가?", "~의 장점은?" — 1학년 수준 질문 절대 금지\n' +
    '✅ 목표: 임상에서 실제로 부딪히는 판단 문제, 두 옵션 중 어느 것이 나은가, 논란이 있는 부분, 여러 변수가 충돌하는 상황\n' +
    '✅ 다양한 관점 포함: 보철 / 외과 / 치주 / 재료 / 술식 / 세미나 방어\n' +
    '✅ 번역투 금지: 한국 교수가 전공의에게 강의하듯 자연스러운 한국어로\n\n' +
    '전문 용어는 영문 병기.\n' +
    '**반드시 Q' + startQ + '부터 Q' + endQ + '까지 정확히 ' + (endQ - startQ + 1) + '개 작성. 이 범위를 벗어난 번호는 출력 금지.**';

  const fewShotUser = 'Immediate Dentin Sealing (IDS) — Q1부터 Q2까지 작성해줘';

  const fewShotAssistant =
    '**Q1. IDS가 DDS 대비 microtensile bond strength를 실제로 유의하게 향상시키는가, 아니면 in vitro 수치가 임상적으로 과대평가된 것인가?**\n' +
    'A: In vitro에서는 IDS가 DDS 대비 약 20–30% 높은 microtensile bond strength(μTBS)를 보인다는 보고가 일관되게 존재한다. Magne et al.(2005, J Prosthet Dent 93(3):226-235)은 IDS가 fresh dentin에 대해 최적의 hybrid layer를 형성하고, provisional 기간 동안의 oral fluid 오염과 MMP-mediated collagen degradation을 방지하기 때문이라고 설명했다. 구체적으로 IDS군의 μTBS는 평균 42–55 MPa 범위인 반면 DDS군은 28–38 MPa 수준으로 보고된 바 있다 (Magne & Nielsen 2009, J Prosthet Dent 102(3):168-177). Tjäderhane et al.(2013, Dent Mater 29(1):116-135)은 MMP에 의한 collagen 분해가 bond 열화의 핵심 기전임을 확인했으며, IDS가 이 경로를 차단한다는 점에서 이론적 타당성이 뒷받침된다. 다만 van den Breemer et al.(2019, Oper Dent 44(1):E1-E15)의 RCT에서는 단기(2년) 임상 outcome에서 IDS와 DDS 간 restoration failure rate에 유의한 차이가 없었다. 이 불일치는 in vitro 환경이 구강 내 열순환(thermocycling), pH 변화, 교합력 등 복합 스트레스를 완전히 재현하지 못하기 때문으로 해석된다 (Sano et al. 1994, J Dent Res 73(6):1087-1092). 결론적으로 bond strength 향상이 임상적 failure rate 감소로 직결된다는 장기 RCT 증거는 아직 부족하나, adhesive 수복물의 장기 생존을 위한 예방적 조치로서 IDS의 생물학적 합리성은 충분하다.\n\n' +

    '**Q2. Phosphoric acid etching 후 MMP가 활성화되는 기전은 무엇이며, self-etch system에서는 이 문제가 동일하게 발생하는가?**\n' +
    'A: Phosphoric acid etching(37%)은 dentin matrix에 내재된 latent MMP(matrix metalloproteinase), 특히 MMP-2(gelatinase A), MMP-8(collagenase-2), MMP-9(gelatinase B)를 활성화시킨다. 이 효소들은 정상 상태에서 calcium에 의해 억제되어 있으나, phosphoric acid에 의한 calcium chelation으로 활성 구조로 전환된다 (Tjäderhane et al. 2013, Dent Mater 29(1):116-135). 활성화된 MMP는 hybrid layer 내 resin monomer가 침투하지 못한 노출 collagen fibril을 시간 경과에 따라 가수분해하여, 임상적으로는 수개월~수년 후 bond strength의 점진적 저하로 나타난다 (De Munck et al. 2003, J Dent Res 82(6):434-442). Self-etch system의 경우 산성 monomer(pH 1.5–2.5)가 smear layer를 부분 용해하면서 calcium을 일부 chelate하므로 MMP가 어느 정도 활성화되지만, 강산 etch-and-rinse(pH <1)에 비해 활성화 정도가 낮다는 보고가 있다 (Nishitani et al. 2006, Eur J Oral Sci 114(2):160-166). 또한 self-etch에서는 resin monomer와 demineralized dentin이 동시에 반응하므로 collagen 노출 시간이 짧아 MMP 활성화 창이 줄어든다는 이론적 이점이 있다. 그러나 self-etch에서도 MMP 활성화가 완전히 차단되지는 않으며, chlorhexidine이나 HEMA-based inhibitor 추가 도포가 보완책으로 제안된다 (Brackett et al. 2007, Oper Dent 32(5):512-517). 따라서 self-etch로 IDS를 시행할 때 anti-MMP degradation 이점이 etch-and-rinse 대비 상대적으로 감소할 수 있으나, 임상적 유의성을 직접 비교한 장기 RCT는 현재까지 부족하다.';

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + CONFIG.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      model:      'gpt-4o',
      max_tokens: 16384,
      messages: [
        { role: 'system',    content: systemPrompt },
        { role: 'user',      content: fewShotUser },
        { role: 'assistant', content: fewShotAssistant },
        { role: 'user',      content: question + '\n\n[' + rangeLabel + '만 작성할 것]' },
      ],
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  const text = result?.choices?.[0]?.message?.content;
  if (!text) throw new Error('GPT 응답 실패 (Q' + startQ + '-Q' + endQ + '): ' + res.getContentText());
  Logger.log('[GPT Q' + startQ + '-Q' + endQ + ' 생성 완료]');
  return text.trim();
}

// ── OpenAI GPT → Q1~Q20 두 번 나눠 호출 후 합산 ─────────────────
function _callGPT(question) {
  const part1 = _callGPTBatch(question, 1,  10);
  const part2 = _callGPTBatch(question, 11, 20);
  return part1 + '\n\n' + part2;
}

// ── GPT 답변에서 인용 파싱 ────────────────────────────────────
function _extractCitations(text) {
  // (Author 2005, Journal ...) 또는 (Author et al. 2005, Journal ...) 패턴
  const regex = /\(([A-Za-zÄÖÜäöüéèêàâčšžćđ]+(?:\s+et\s+al\.?)?(?:\s+&\s+[A-Za-z]+)?)\s+(\d{4})[,;\s]+([^)]{3,80})\)/g;
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
      abstract: '',
      abstractEn: '',
    };
  } catch(e) {
    Logger.log('[PubMed 오류] ' + author + ' ' + year + ': ' + e.message);
    return null;
  }
}

// ── GPT 답변 파싱 + PubMed 인용 검증 ────────────────────────
function _parseAndVerify(text) {
  const citations = _extractCitations(text);
  Logger.log('[인용 추출] ' + citations.length + '개');

  const refs = [];
  citations.forEach(function(c) {
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
          const parsed = _parseAndVerify(raw);
          answer = parsed.answer;
          references = parsed.references;
          Logger.log('[PubMed 검증 완료 — 레퍼런스 ' + references.length + '개]');
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

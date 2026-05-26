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

// ── OpenAI GPT → 임상 종합 정리 + 관점별 질문 ──────────────────────
function _callGPT(question) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const systemPrompt =
    '당신은 치과 보철과 교수이자 해당 분야 전문가입니다.\n' +
    '전공의가 보내온 임상 주제에 대해 **깊이 있는 Q&A를 반드시 Q1부터 시작하여 20개 이상** 작성하세요.\n\n' +

    '## 형식 (반드시 준수)\n' +
    '**Q1. [질문]**\n' +
    'A: [답변 — 7~10문장 이상, 출처 4개 이상 포함. 각 출처마다 해당 근거가 답변의 어느 부분을 뒷받침하는지 명확히 연결할 것.]\n\n' +
    '**Q2. [질문]**\n' +
    'A: [답변 — 7~10문장 이상, 출처 4개 이상 포함. 각 출처마다 해당 근거가 답변의 어느 부분을 뒷받침하는지 명확히 연결할 것.]\n\n' +
    '... Q1부터 시작하여 Q20 이상까지. 20개 미만이면 불완전한 답변임.\n\n' +

    '## 답변 깊이 원칙 — 절대 준수\n' +
    '- 각 답변은 **최소 200단어 이상** 작성할 것\n' +
    '- 단순 사실 나열 금지. 반드시 ① 배경/기전 → ② 핵심 근거(논문/교과서) → ③ 임상적 함의 → ④ 반론 또는 한계 구조로 전개\n' +
    '- 수치(%, MPa, mm, 생존율 등)는 반드시 출처와 함께 제시\n' +
    '- 논란이 있는 주제는 찬반 양쪽 근거를 모두 제시하고 최종 임상 판단 제안\n\n' +

    '## 근거 원칙 — 절대 준수\n' +
    '- **모든 답변은 논문 또는 교과서에 근거해야 한다**\n' +
    '- 각 답변에 출처 **최소 4개** 이상: (Magne 2005, J Prosthet Dent), (Rosenstiel et al., Contemporary Fixed Prosthodontics 5th ed.), (Lindhe et al., Clinical Periodontology and Implant Dentistry)\n' +
    '- 출처가 불확실하면 해당 내용을 쓰지 말 것. 꼭 써야 하면 "[문헌 확인 필요]"로 표시\n' +
    '- 없는 논문 만들지 말 것. 틀린 수치 제시 금지\n' +
    '- Rosenstiel, Shillingburg, Magne, Lindhe, Van Noort, Anusavice, Powers & Wataha, Nanci(Ten Cate), Schroeder, Sicher & DuBrul 등 표준 교과서 적극 활용\n' +
    '- Journal 인용 시 저자, 연도, 저널명, 가능하면 권호 포함: (Tjäderhane et al. 2013, Dent Mater 29(1):116-135)\n\n' +

    '## 질문 수준 원칙 — 절대 준수\n' +
    '❌ 금지: "~의 기전은?", "~의 적응증은?", "~란 무엇인가?", "~의 장점은?" — 1학년 수준 질문 절대 금지\n' +
    '✅ 목표: 임상에서 실제로 부딪히는 판단 문제, 두 옵션 중 어느 것이 나은가, 논란이 있는 부분, 여러 변수가 충돌하는 상황\n' +
    '✅ 다양한 관점 포함: 보철 / 외과 / 치주 / 재료 / 술식 / 세미나 방어\n' +
    '✅ 번역투 금지: 한국 교수가 전공의에게 강의하듯 자연스러운 한국어로\n\n' +
    '전문 용어는 영문 병기.\n' +
    '**다시 강조: 반드시 Q1부터 시작하고, Q20 이상까지 작성할 것. 각 답변은 7문장 이상, 출처 4개 이상 필수.**';

  // Few-shot: IDS 예시 (GPT가 목표 수준을 정확히 인식하도록)
  const fewShotUser = 'Immediate Dentin Sealing (IDS) 에 대해 종합 정리해줘';

  const fewShotAssistant =
    '## Immediate Dentin Sealing (IDS) — Q&A\n\n' +

    '**Q1. IDS가 DDS 대비 microtensile bond strength를 실제로 유의하게 향상시키는가, 아니면 in vitro 수치가 임상적으로 과대평가된 것인가?**\n' +
    'A: In vitro에서는 IDS가 DDS 대비 약 20–30% 높은 microtensile bond strength(μTBS)를 보인다는 보고가 일관되게 존재한다. Magne et al.(2005, J Prosthet Dent 93(3):226-235)은 IDS가 fresh dentin에 대해 최적의 hybrid layer를 형성하고, provisional 기간 동안의 oral fluid 오염과 MMP-mediated collagen degradation을 방지하기 때문이라고 설명했다. 구체적으로 IDS군의 μTBS는 평균 42–55 MPa 범위인 반면 DDS군은 28–38 MPa 수준으로 보고된 바 있다 (Magne & Nielsen 2009, J Prosthet Dent 102(3):168-177). Tjäderhane et al.(2013, Dent Mater 29(1):116-135)은 MMP에 의한 collagen 분해가 bond 열화의 핵심 기전임을 확인했으며, IDS가 이 경로를 차단한다는 점에서 이론적 타당성이 뒷받침된다. 다만 van den Breemer et al.(2019, Oper Dent 44(1):E1-E15)의 RCT에서는 단기(2년) 임상 outcome에서 IDS와 DDS 간 restoration failure rate에 유의한 차이가 없었다. 이 불일치는 in vitro 환경이 구강 내 열순환(thermocycling), pH 변화, 교합력 등 복합 스트레스를 완전히 재현하지 못하기 때문으로 해석된다 (Sano et al. 1994, J Dent Res 73(6):1087-1092). 결론적으로 bond strength 향상이 임상적 failure rate 감소로 직결된다는 장기 RCT 증거는 아직 부족하나, adhesive 수복물의 장기 생존을 위한 예방적 조치로서 IDS의 생물학적 합리성은 충분하다.\n\n' +

    '**Q2. Phosphoric acid etching 후 MMP가 활성화되는 기전은 무엇이며, self-etch system에서는 이 문제가 동일하게 발생하는가?**\n' +
    'A: Phosphoric acid etching(37%)은 dentin matrix에 내재된 latent MMP(matrix metalloproteinase), 특히 MMP-2(gelatinase A), MMP-8(collagenase-2), MMP-9(gelatinase B)를 활성화시킨다. 이 효소들은 정상 상태에서 calcium에 의해 억제되어 있으나, phosphoric acid에 의한 calcium chelation으로 활성 구조로 전환된다 (Tjäderhane et al. 2013, Dent Mater 29(1):116-135). 활성화된 MMP는 hybrid layer 내 resin monomer가 침투하지 못한 노출 collagen fibril을 시간 경과에 따라 가수분해하여, 임상적으로는 수개월~수년 후 bond strength의 점진적 저하로 나타난다 (De Munck et al. 2003, J Dent Res 82(6):434-442). Self-etch system의 경우 산성 monomer(pH 1.5–2.5)가 smear layer를 부분 용해하면서 calcium을 일부 chelate하므로 MMP가 어느 정도 활성화되지만, 강산 etch-and-rinse(pH <1)에 비해 활성화 정도가 낮다는 보고가 있다 (Nishitani et al. 2006, Eur J Oral Sci 114(2):160-166). 또한 self-etch에서는 resin monomer와 demineralized dentin이 동시에 반응하므로 collagen 노출 시간이 짧아 MMP 활성화 창이 줄어든다는 이론적 이점이 있다. 그러나 self-etch에서도 MMP 활성화가 완전히 차단되지는 않으며, chlorhexidine이나 HEMA-based inhibitor 추가 도포가 보완책으로 제안된다 (Brackett et al. 2007, Oper Dent 32(5):512-517). 따라서 self-etch로 IDS를 시행할 때 anti-MMP degradation 이점이 etch-and-rinse 대비 상대적으로 감소할 수 있으나, 임상적 유의성을 직접 비교한 장기 RCT는 현재까지 부족하다.\n\n' +

    '**Q3. OIL(Oxygen-Inhibition Layer)을 제거하지 않으면 PVS impression에 구체적으로 어떤 문제가 생기며, IOS 기반 digital workflow에서는 이 문제가 사라지는가?**\n' +
    'A: Magne & Nielsen(2009, J Prosthet Dent)은 OIL이 잔존하면 PVS impression material의 polymerization이 inhibition되어 impression tear와 surface detail 손실이 발생한다고 보고했다. Glycerin gel 도포 후 추가 10초 light cure가 가장 효과적인 해결책이다. IOS 기반 digital workflow에서는 impression material 자체를 사용하지 않으므로 이 특정 문제는 사라진다. 다만 OIL surface는 scan powder나 scan spray의 adhesion에 영향을 줄 수 있어 pumice polishing이나 glycerin re-cure 후 스캔을 권장하는 임상가들이 있다 [문헌 확인 필요].\n\n' +

    '**Q4. Eugenol이 포함된 temporary cement를 사용하면 final resin cement polymerization에 실제로 얼마나 영향을 미치는가?**\n' +
    'A: Eugenol은 free radical scavenger로 작용하여 resin cement의 radical chain polymerization을 억제한다. Wataha et al. 및 Rosenstiel, Land & Fujimoto (Contemporary Fixed Prosthodontics 교과서)에서는 eugenol-based cement 사용 후 dentin surface에 잔류하는 eugenol이 resin monomer의 conversion degree를 유의하게 감소시킨다고 기술한다. 이 영향은 cement 제거 후에도 tubule 내 잔류 eugenol로 인해 지속될 수 있다. 임상적으로는 zinc oxide non-eugenol cement(예: Temp Bond NE) 또는 resin-based provisional cement 사용이 권장된다.\n\n' +

    '**Q5. Filled adhesive(예: Optibond FL)와 unfilled adhesive를 IDS에 사용했을 때 후속 surface conditioning(airborne abrasion)에 대한 저항성 차이가 임상적으로 중요한가?**\n' +
    'A: Stavridakis et al.(2005, Oper Dent)은 IDS layer가 너무 얇으면 후속 cleaning 과정에서 제거되어 bond strength가 오히려 감소한다고 보고했다. Filled adhesive인 Optibond FL은 cured film 두께가 약 40–80 μm로 unfilled adhesive 대비 두꺼워 mechanical conditioning에 대한 내성이 높다. 이 때문에 IDS에서는 filled adhesive가 gold standard로 권장되며, unfilled/lightly filled adhesive를 사용할 경우 flowable composite을 0.5 mm 두께로 추가 coating하여 보완하는 것이 권장된다 (Magne 2005).\n\n' +

    '**Q6. IDS 후 crown lengthening이 필요해진 경우, 이미 형성된 IDS layer는 어떻게 처리해야 하는가?**\n' +
    'A: 직접적으로 이 시나리오를 다룬 전향적 연구는 부족하다 [문헌 확인 필요]. 일반적 임상 원칙상, crown lengthening 후 healing이 완료되면 IDS layer를 air abrasion 또는 phosphoric acid로 conditioning하고 필요 시 새로운 adhesive를 재도포하는 방식이 권장된다. Healing 기간에 대해서는 보편적으로 3–6개월이 권장되지만, 이는 치주 healing 원칙(Lindhe, Clinical Periodontology 교과서)에 근거한 것이며 IDS 특이적 data는 없다.\n\n' +

    '**Q7. Alghauli et al.(2024)의 systematic review에서 보고된 IDS 그룹의 survival rate 96.4–100%와 비IDS 그룹의 81.8–96.7% 차이는 어떤 restoration type에서 가장 두드러지게 나타났는가?**\n' +
    'A: Alghauli et al.(2024, J Prosthet Dent) systematic review는 ceramic partial coverage restoration(inlay, onlay, partial crown)과 laminate veneer에서 IDS의 이점이 가장 뚜렷하다고 보고했다. 이는 해당 수복물이 adhesive cementation에 전적으로 의존하며, dentin bonding quality가 long-term survival의 핵심 변수이기 때문이다. Full-coverage crown에서 conventional cement를 사용하는 경우 IDS의 이득은 주로 postoperative sensitivity 감소에 국한된다는 점도 언급되었다.\n\n' +

    '**Q8. Non-vital tooth에서 IDS를 시행할 때 vital tooth 대비 어떤 변수가 달라지며, 그 차이가 임상 결과에 영향을 미치는가?**\n' +
    'A: Vital tooth에서는 outward pulpal fluid pressure(약 14–25 cmH₂O)가 adhesive의 dentin infiltration을 방해하는 요인이 되는 반면, non-vital tooth에서는 이 압력이 없어 이론적으로 adhesive penetration이 더 용이하다. 그러나 endodontic treatment 과정에서 사용된 NaOCl은 collagen denaturation을 일으켜 dentin의 bonding substrate를 변화시키며, EDTA는 smear layer 제거 후 tubule을 개방하여 adhesive 침투에 영향을 준다 (Bitter et al., J Adhes Dent 참고). IPDS(Immediate Pre-endodontic Dentin Sealing) 개념이 이에 대한 해결책으로 제안되었으나 아직 RCT 수준의 evidence는 부족하다.\n\n' +

    '**Q9. Subgingival margin에서 IDS를 시행할 때 rubber dam isolation이 불가능한 경우, 습기 조절 수준이 bond strength에 미치는 영향을 정량적으로 어떻게 이해해야 하는가?**\n' +
    'A: Rubber dam 없이 면봉과 retraction cord만으로 조절한 환경에서의 IDS bond strength는 rubber dam 환경 대비 유의하게 낮다는 보고들이 있다 [문헌 확인 필요]. 일반 원칙으로, saliva 오염은 hybrid layer 형성을 방해하여 접착력을 크게 저하시킨다 (Van Meerbeek et al., Oper Dent). 임상적 판단으로는 isolation이 완벽하지 않다면 IDS의 이론적 이점이 반감될 수 있으므로, 조건이 불량한 경우 conventional cementation protocol로의 전환을 고려해야 한다.\n\n' +

    '**Q10. IDS 위에 사용하는 resin cement로 self-adhesive resin cement(예: RelyX Unicem)와 conventional resin cement + separate adhesive 중 어느 것이 더 나은 결과를 보이는가?**\n' +
    'A: Self-adhesive resin cement는 IDS layer 위에서 additional adhesive 없이 사용 시 bond strength가 conventional resin cement + adhesive 조합보다 낮다는 in vitro 연구들이 있다. 이는 self-adhesive cement의 산성 monomer가 이미 중합된 IDS resin layer를 효과적으로 etching하지 못하기 때문이다 (Radovic et al., J Dent 참고). IDS 위에는 phosphoric acid cleansing etch 후 thin adhesive layer를 재도포하고 conventional resin cement를 사용하는 것이 권장된다 (Magne 2005, J Esthet Restor Dent).';

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
        { role: 'user',      content: question },
      ],
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(res.getContentText());
  const text = result?.choices?.[0]?.message?.content;
  if (!text) throw new Error('GPT 응답 실패: ' + res.getContentText());
  Logger.log('[GPT 종합 정리 생성 완료]');
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

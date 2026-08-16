/* ─────────────────────────────────────────────────────────────
 * SOAP 임상 차팅 템플릿 시드
 * 근거 교과서 (본문 인용 표기 기준)
 *  · Shillingburg — Fundamentals of Fixed Prosthodontics, 4e (Quintessence)
 *  · Rosenstiel/Land/Fujimoto — Contemporary Fixed Prosthodontics, 5e (Elsevier)
 *  · Wiskott — Fixed Prosthodontics: Principles and Clinics (Quintessence)
 *  · Carr & Brown — McCracken’s Removable Partial Prosthodontics, 13e
 *  · Phoenix/Cagna/DeFreest — Stewart’s Clinical Removable Partial Prosthodontics, 4e
 *  · Zarb/Hobkirk/Eckert/Jacob — Prosthodontic Treatment for Edentulous Patients (Boucher’s), 13e
 *  · Misch — Dental Implant Prosthetics, 2e / Contemporary Implant Dentistry, 3e
 *  · Newman & Carranza’s Clinical Periodontology, 13e
 *  · Okeson — Management of TMD and Occlusion, 8e / Dawson — Functional Occlusion
 *  · Fradeani — Esthetic Rehabilitation in Fixed Prosthodontics / Magne & Belser — Bonded Porcelain Restorations
 *  · Malamed — Handbook of Local Anesthesia, 7e
 *  · GPT-10 (용어) · ITI Treatment Guide 1–13 · ACP/ADA Parameters of Care
 * ───────────────────────────────────────────────────────────── */

const SOAP_CATS = ['고정성', '국소의치', '총의치', '임플란트', '임시의치', '심미', '기타'];

// SOAP 목록 상단에 표시되는 근거 문헌 패널
const SOAP_REFS = `<details class="soap-refs">
  <summary>📚 이 템플릿의 근거 — 참고 교과서·지침</summary>
  <div class="soap-refs-body">
    <b>고정성 보철</b>
    <ul>
      <li>Shillingburg HT et al. <i>Fundamentals of Fixed Prosthodontics</i>, 4th ed. Quintessence.</li>
      <li>Rosenstiel SF, Land MF, Fujimoto J. <i>Contemporary Fixed Prosthodontics</i>, 5th ed. Elsevier.</li>
      <li>Wiskott HWA. <i>Fixed Prosthodontics: Principles and Clinics</i>. Quintessence.</li>
    </ul>
    <b>가철성 보철</b>
    <ul>
      <li>Carr AB, Brown DT. <i>McCracken’s Removable Partial Prosthodontics</i>, 13th ed. Elsevier.</li>
      <li>Phoenix RD et al. <i>Stewart’s Clinical Removable Partial Prosthodontics</i>, 4th ed. Quintessence.</li>
      <li>Zarb G, Hobkirk J, Eckert S, Jacob R. <i>Prosthodontic Treatment for Edentulous Patients</i> (Boucher’s), 13th ed. Elsevier.</li>
    </ul>
    <b>임플란트</b>
    <ul>
      <li>Misch CE. <i>Dental Implant Prosthetics</i>, 2nd ed. / <i>Contemporary Implant Dentistry</i>, 3rd ed. Elsevier.</li>
      <li>ITI Treatment Guide Series (Vol. 1–13), ITI Consensus Statements.</li>
      <li>2017 World Workshop — Peri-implant Health, Peri-implant Mucositis, Peri-implantitis (<i>J Periodontol / JCP</i>).</li>
    </ul>
    <b>교합 · 심미 · 치주</b>
    <ul>
      <li>Okeson JP. <i>Management of TMD and Occlusion</i>, 8th ed. / Dawson PE. <i>Functional Occlusion</i>.</li>
      <li>Fradeani M. <i>Esthetic Rehabilitation in Fixed Prosthodontics</i>. / Magne P, Belser U. <i>Bonded Porcelain Restorations</i>.</li>
      <li>Newman & Carranza’s <i>Clinical Periodontology</i>, 13th ed.</li>
      <li>Malamed SF. <i>Handbook of Local Anesthesia</i>, 7th ed.</li>
    </ul>
    <b>용어 · 지침</b>
    <ul>
      <li>The Glossary of Prosthodontic Terms (GPT-10), <i>J Prosthet Dent</i>.</li>
      <li>ACP/ADA Parameters of Care · ACP PDI (Prosthodontic Diagnostic Index).</li>
      <li>AHA 2021 Infective Endocarditis Prophylaxis · SDCEP 항혈전제 지침 · AAOMS MRONJ Position Paper.</li>
    </ul>
    <p class="soap-refs-note">본 템플릿은 위 교과서·지침의 원칙을 임상 차팅 형식으로 재구성한 <b>교육용 참고자료</b>입니다. 수치·프로토콜은 제품·시스템·환자별로 달라질 수 있으므로 <b>제조사 지침과 원문을 우선</b>하며, 최종 판단은 술자의 임상적 책임입니다.</p>
  </div>
</details>`;
const SOAP_SEED_VERSION = 5; // 시드 콘텐츠 버전 — 올리면 기존 시드 항목이 새 내용으로 교체됨

const SOAP_SEED = [
  // ═══════════════ 1. 고정성 보철 (Crown & Bridge) ═══════════════
  {
    title: '고정성 1-1 · 진단 및 치료계획',
    category: '고정성', order: 1,
    subjective: '- **주소(C.C.)** — 환자 표현 그대로 인용 후 <u>OPQRST</u>로 구조화: 발생 시점 / 유발·완화 인자 / 성질 / 방사 / 강도(NRS 0–10) / 경과\n- **통증 감별** — 자극 제거 후 &lt;10초 소실 = 가역성 치수염, **자발통·야간통·지속통 = 비가역성** → 보철 전 근관 판단 필요. 저작 시 예리한 통증 + 이완 시 통증 = <u>cracked tooth</u> 의심\n- **치과력** — 기존 수복물 장착 시기와 **실패 원인**(이차우식 / 수복물 파절 / 치아 파절 / 탈락 / 치수 괴사)을 반드시 특정. 근관·치주·교정 병력, 과거 마취 합병증\n- **의과력** — 당뇨(HbA1c), 감염성 심내막염 고위험군, **항흡수제·항혈관형성제(MRONJ)** 종류·경로·기간, 항응고/항혈소판제, 두경부 방사선(선량·부위), 구강건조 유발 약제, 금속·라텍스 알레르기\n- **습관·기여인자** — sleep/awake bruxism(동거인이 소리를 듣는지), clenching 자각, 흡연(pack-year), 위산역류·산성음료·구토, 직업적 습관\n- **기대치·제약** — 심미 요구 수준, 기간·비용 한계, 내원 가능 빈도, 치과불안(MDAS)\n\n<div class="tip"><b>💡 문진 팁</b>“기존 보철물이 왜 실패했는가”를 특정하지 못하면 같은 실패를 반복합니다. 원인이 <u>교합 과부하</u>면 재료를 바꿔야 하고, <u>위생</u>이면 설계(마진 위치·pontic 형태)를 바꿔야 하며, <u>ferrule 부족</u>이면 외과·교정 전처치가 먼저입니다.</div>',
    objective: '**① 구외 (Extraoral)**\n- 안모 대칭·정중선·안모수직고경, 입술 지지·구각\n- **TMJ**: 최대개구 <mark style="background:#fef08a">40–55 mm</mark>(&lt;40 mm 제한), 개구 편위·편향, click / crepitus, 촉진 압통\n- 저작근 촉진(교근·측두근·익돌근), 경부 림프절\n\n**② 구내 (Intraoral)**\n- 연조직 전악 스크리닝(구강암 선별) → 소견 기록 후 다음 단계\n- **치주**: 6점 probing, BOP %, plaque index, 퇴축·각화치은 폭, 동요도(**Miller I &lt;1 mm / II &gt;1 mm / III 수직 함몰**), 근분지부(**Glickman I–IV**)\n- 우식·기존 수복물·균열선(투조·염색·교합지·bite test)\n- 잔존 치질과 **ferrule 가능성**: 연속 <mark style="background:#fef08a">높이 ≥1.5–2 mm · 두께 ≥1 mm</mark>\n\n**③ 교합 (Occlusion)**\n- VDO, 안정위–교합위 차(**freeway space 2–4 mm**)\n- **CR–MIP 편위** 방향·크기, 조기접촉 치아 특정\n- 유도양식: canine guidance / group function / 전방유도 부재\n- 마모(**TWI, Smith & Knight**), 교모면·abfraction, 대합 정출·경사\n\n**④ 방사선·자료**\n- 파노라마 + **지대치 규격 PA**, 후방부 bitewing / 필요 시 CBCT(근관 병소·근접 해부구조·임플란트 대안 검토)\n- 골지지량, C:R ratio, 근관치료 상태, 치근단 병소, 치근 형태·이개\n- **반조절성 교합기 마운팅 진단모형**(facebow ± CR record), **diagnostic wax-up**, 규격 사진(구내 5 + 안모 3)',
    assessment: '- **진단명** — 치질(우식·파절·마모) / 치수·치근단 / 치주 / 교합 / 결손 / 심미 를 각각 기재\n- **치아별 예후** — good · fair · poor · questionable · hopeless (McGuire & Nunn 기준: 골지지·동요도·근분지부·C:R·환자 협조도) 또는 favorable / questionable / unfavorable / hopeless (Kwok & Caton)\n- **지대치 적합성 체크** — ① ferrule 확보 ② C:R ratio(이상 1:2, **최소 1:1**) ③ 치주 안정 ④ 치수 생활력·근관 예후 ⑤ 축의 평행성\n- **설계 결정** — 단관 / FPD(경간 길이) / cantilever / RBB / 임플란트 / 무처치\n- **난이도 층화** — ACP PDI(부분무치악 Class I–IV)\n\n<details><summary>📚 교과서 — 지대치 선택의 고전 원칙과 그 한계</summary>\n\n**Ante의 법칙**(Ante 1926; Shillingburg Ch.5): 지대치 치근 표면적의 합 ≥ 결손 치아 치근 표면적의 합. → 교과서적 출발점이지만 **전향적 근거로 검증된 규칙이 아니며**, 치주적으로 감소된 지지에서도 장기 성공한 cross-arch splint 보고(Nyman & Lindhe)가 반례로 인용된다. 절대 기준이 아니라 **위험 신호 체크리스트**로 사용할 것.\n\n**경간 처짐(deflection)**: 경간 길이의 <u>3제곱</u>에 비례하고 두께의 3제곱에 반비례. 2배 경간 = **8배 처짐**. → 장경간에서는 재료 강성(금속·모놀리식 지르코니아)과 connector 단면적이 결정적.\n\n**Connector 단면적**: 전부도재 FPD에서 최소 <mark style="background:#fef08a">≈9–16 mm²</mark>(재료·부위별 상이, 지르코니아 구치부 기준 3×3 mm 이상) 및 **gingival embrasure 반경 확보**가 파절 저항의 핵심(Rosenstiel Ch.26).\n\n</details>',
    plan: '- **단계별 순서** — Phase 0 전신·응급 → Phase I 원인 조절(치주·우식·근관·발치) → **재평가** → Phase II 전처치(교정·crown lengthening·임플란트 식립) → Phase III 최종 보철 → Phase IV 유지관리\n- **대안 제시 의무** — 무처치, 가철성, 임플란트, 접착성 보철 각각의 장단점·비용·기간\n- **Informed consent** — 이득·위험·대안·비용·예후·유지관리 필요성 문서화 후 서명\n- 다음 예약: 전처치 또는 지대치 형성\n\n<details><summary>🔬 근거 — 보철 유형·재료별 생존율</summary>\n\n**FPD**: 통상형 5년 <mark style="background:#fef08a">93.8%</mark> / 10년 <mark style="background:#fef08a">89.2%</mark>(Tan, *COIR* 2004). **Cantilever FPD**는 10년 약 80%로 유의하게 낮음(Pjetursson 2004). **Resin-bonded bridge**는 5년 생존 약 88% 수준이나 탈락(debonding)이 주 합병증.\n\n**단관 5년**: 금속도재 94.7% · 리튬디실리케이트 96.6% · 지르코니아 91.2%(실패의 다수는 도재 chipping). **FPD 5년**: MCC 94.4% vs 전부도재 88.6%(Sailer & Pjetursson, *Dent Mater* 2015).\n\n→ 전치 단관은 glass-ceramic이 심미·생존 모두 유리, **장경간 FPD·bruxer·응력 집중부는 금속 하부구조 또는 모놀리식 지르코니아** 우선.\n\n</details>\n\n<details><summary>🏥 프로토콜 — 전신 위험 관리 (내원 전 확인)</summary>\n\n- **감염성 심내막염 예방**: AHA 2021 scientific statement — 인공판막·과거 IE·특정 선천성 심질환·심장이식 판막병증 등 **최고위험군에 한해**, 치은/치근단 조작 또는 구강점막 천공 시술 시 <u>amoxicillin 2 g, 시술 30–60분 전</u>(소아 50 mg/kg). 그 외 대부분은 불필요(NICE는 더 보수적).\n- **항응고제**: 통상 발치·치주치료 수준에서는 **warfarin(INR &lt;4) · DOAC를 중단하지 않는다**(SDCEP 지침). 국소 지혈 조치를 준비.\n- **MRONJ**: AAOMS position paper 기준 위험 층화 — 정맥주사 항흡수제·항혈관형성제·고용량·장기 투여에서 위험↑. **침습 시술 전 상담·문서화**, 보철적으로는 <u>가철성 의치 압박 궤양</u>도 유발인자이므로 변연 조정에 각별히 주의.\n- **당뇨**: HbA1c 조절 불량 시 치주·창상치유 불리 → 보철 시작 전 내과 협진.\n\n</details>',
  },
  {
    title: '고정성 1-2 · 지대치 형성 (Tooth Preparation)',
    category: '고정성', order: 2,
    subjective: '- 지난 내원 후 증상(자발통·냉온·저작통), 치료 범위·비용 **동의 재확인**\n- 당일 전신 상태·복약·식사 여부 확인(마취 전 필수)',
    objective: '**① 마취·격리**\n- 약제·농도·용량·부위 기록(예: 2% lidocaine c 1:100,000 epi, 1.7 mL ×2, IANB). 최대용량 인지(Malamed)\n- 러버댐 또는 격리 보조, 연조직 보호\n\n**② 삭제량 (재료별 최소치)**\n\n| 재료 | 교합면 | 축면 | 변연 형태 |\n|---|---|---|---|\n| 모놀리식 지르코니아 | 1.0–1.5 mm | 0.5–1.0 mm | chamfer 0.5 mm |\n| 리튬디실리케이트 | 1.5–2.0 mm | 1.0–1.5 mm | rounded shoulder / heavy chamfer 1.0 mm |\n| 도재소부금속(PFM) | 1.5–2.0 mm | 순면 1.2–1.5 / 설면 0.5 | 순면 shoulder 1.0–1.4, 설면 chamfer |\n| 전부금속 | 기능교두 1.5 / 비기능 1.0 | 0.5 | chamfer 0.3–0.5 mm |\n\n- **깊이 유도구(depth cut)** 를 먼저 형성 → 과·과소 삭제 방지. 기능교두 사면(functional cusp bevel) 반드시 부여\n\n**③ 형태 (Geometry)**\n- **Taper**: 목표 total occlusal convergence <mark style="background:#fef08a">10–20°</mark> (한쪽 축면 5–10°)\n- **Resistance form**: 회전 저항이 유지의 핵심. **축벽 높이 부족**(구치 &lt;3–4 mm)·큰 직경일수록 불리 → **보조 홈(groove)·box·pin** 추가\n- **Retention form**: 표면적, 평행도, 시멘트 종류로 보완. 단 “접착으로 형태 부족을 메운다”는 접근은 장기 예후에 불리\n- 명확·연속적 변연, **내면 선각은 둥글게**(CAD/CAM 밀링 버 반경·도재 응력집중 고려)\n- Undercut 무, 단일 착탈로(FPD는 지대치 간 평행성 필수 — 시적 전 surveyor/육안 확인)\n\n**④ 변연 위치**\n- 원칙 **치은연상**(위생·인상·접착·재발우식 진단 모두 유리)\n- 치은연하는 우식·기존 마진·심미·유지 필요 시에 한정 → **변연–치조골 ≥3 mm** 확보 여부 먼저 판단\n\n**⑤ 마무리**\n- 세립 다이아몬드/카바이드로 활택, 예리한 각 제거\n- **Shade 채득은 삭제·탈수 전**에 완료(탈수되면 명도 상승 → 오차)\n- 형성 평가: 거울·확대·실리콘 index 절단면으로 삭제량 확인',
    assessment: '- 삭제량 재료 요구치 충족, TOC·저항형태 적절, 변연 연속·명확, ferrule 확보\n- undercut 없음 / (FPD) 지대치 간 착탈로 일치\n- 치수 노출·근접 여부, 잔존 치질 예후',
    plan: '- 임시보철 제작·장착(→ 1-3), 지각과민 관리 지침\n- 다음 예약(정밀인상)\n\n<details><summary>📚 교과서 — 형성의 5대 원칙</summary>\n\nShillingburg Ch.7은 지대치 형성을 다섯 원칙으로 정리한다 — **① 치질 보존 ② 유지·저항 형태 ③ 구조적 내구성(structural durability) ④ 변연 완전성(marginal integrity) ⑤ 치주 보존**. 임상에서 실패는 대개 ②와 ④에서 나온다: 축벽이 짧고 벌어졌는데 시멘트로 버티려 하거나, 변연이 불연속·치은연하 깊이 들어가 염증을 만드는 경우.\n\n**저항형태의 기하학**(Rosenstiel Ch.7): 유지력은 <u>평행도 · 축벽 높이 · 표면적</u>의 함수. 축벽 높이가 부족하면 taper를 아무리 줄여도 회전 저항이 확보되지 않으므로 **홈·box를 추가**하는 것이 정답이다.\n\n</details>\n\n<details><summary>🔬 근거 — taper 목표치와 생물학적 폭경</summary>\n\n**Taper**: 이론적 최적 6°는 in-vitro 유래 값(Jørgensen 1955)이며, **임상 권장은 TOC 10–20°**(Goodacre, *JPD* 2001). 실제 술자 달성치는 흔히 15–27°로 보고된다. 6°를 맹목적으로 좇다 undercut·치수 노출을 만들지 말 것.\n\n**생물학적 폭경 / supracrestal attachment**: 평균 2.04 mm(접합상피 0.97 + 결합조직 1.07; Gargiulo, *J Periodontol* 1961)이며 개인차가 크다. 변연을 치은연하로 둘 땐 **변연–치조골정 ≥3 mm**를 확보(Nevins & Skurow; Padbury, *JCP* 2003). 침범 시 만성 염증·부착소실·예측 불가한 퇴축이 발생하며, 이는 **crown lengthening 또는 교정적 정출의 적응증**이다.\n\n</details>\n\n<div class="warning"><b>⚠️ 흔한 오류</b>① 기능교두 사면 미부여 → 대합 접촉부 도재 두께 부족 → chipping. ② 축벽 과다 삭제로 저항형태 상실. ③ 변연이 치은연하로 “미끄러져” 들어가며 불연속 형성 → 인상·접착·위생 모두 실패.</div>',
  },
  {
    title: '고정성 1-3 · 임시보철 (Provisional Restoration)',
    category: '고정성', order: 3,
    subjective: '- 형성 후 지각과민·불편감, 심미 임시 기대 수준 확인',
    objective: '- **제작법**: 직접법(bis-acryl + 형성 전 실리콘 index / 기성 shell) / 간접법(진단 wax-up 기반 PMMA, 장기 임시·다수 지대치)\n- **재료 특성** —\n<dl><dt>Bis-acryl</dt><dd>발열·수축 적고 조작 간편, 취성 → 단기·소수 유닛에 적합</dd><dt>PMMA(자가·열중합)</dt><dd>강도·수리성·연마성 우수, 발열·수축(≈6–8%)·유리단량체 자극 → 간접법 권장</dd><dt>CAD/CAM PMMA</dt><dd>장기 임시(3–12개월)·전악 재구성 검증용, 물성·색안정 우수</dd></dl>\n- **필수 요건 6가지 점검**: ① 변연 적합 ② 인접 접촉 ③ 교합(CO·편심) ④ 축면 형태·emergence ⑤ 표면 활택·연마 ⑥ 심미·발음\n- **임시 접착**: 비유게놀 임시시멘트(최종이 **레진 접착**일 때 유게놀은 중합 저해). 접착 후 잉여 시멘트·치실 통과 확인\n- **연조직 형성 목적 시**: ovate pontic site 형성, emergence profile 조각, 임플란트 임시보철로 papilla 유도',
    assessment: '- 변연·접촉·교합·형태 acceptable, 치은 반응 양호\n- (장기 임시) 교합 재구성·VDO 변화·치주/근관 예후 관찰 목적 명시',
    plan: '- 관리 지침: 끈적한 음식·치실 수직 제거(측방으로 빼내기), 탈락 시 **즉시 내원**(지대치 정출·이동으로 재장착 불가해짐)\n- 지각과민 시 desensitizer / 임시시멘트 재접착\n- 다음 예약(정밀인상)\n\n<details><summary>📚 교과서 — 임시보철의 5가지 요구조건</summary>\n\nRosenstiel Ch.15는 임시보철의 요건을 **생물학적(치수 보호·치주 건강·위생 가능·치아 위치 안정) · 기계적(저작 저항·탈락 저항·수리 가능) · 심미적**으로 분류한다. 임시보철은 “때우는 것”이 아니라 <u>최종 보철의 축소 리허설</u>이다 — 임시에서 발음·심미·교합이 실패하면 최종에서도 실패한다.\n\n**장기 임시보철의 진단적 가치**: VDO 증가, 전방유도 재설정, 예후 불확실 지대치 관찰, 심미 디자인 확정 등은 최소 **4–12주** 임시 상태로 검증한 뒤 최종으로 복제하는 것이 표준(Dawson; Fradeani).\n\n</details>\n\n<div class="danger"><b>🚫 놓치기 쉬운 부분</b>임시보철의 <u>과충전 변연·거친 표면</u>은 며칠 만에 치은 염증·출혈을 만들고, 그 상태로 인상을 뜨면 압배·인상·접착이 연쇄 실패합니다. 임시보철 연마는 시간 낭비가 아니라 최종 성공의 전제조건입니다.</div>',
  },
  {
    title: '고정성 1-4 · 정밀인상 및 악간관계 채득',
    category: '고정성', order: 4,
    subjective: '- 임시보철 사용감(불편·지각과민·탈락·음식물 끼임), 심미 중간 피드백',
    objective: '**① 술 전 조직 평가**\n- 임시보철 제거 → 변연 치은 발적·부종·출혈 확인. **염증 있으면 인상을 연기**하고 임시보철 수정 + 위생 강화 후 재내원\n\n**② 치은 압배 (Gingival Displacement)**\n- **2-cord 기법**: 1st(가는 cord, 열구 기저부·지혈) → 2nd(굵은 cord, 측방 압배) → **4–8분** 유지 → 2nd만 제거 직후 인상 주입(열구는 약 30초 내 되돌아옴)\n- **지혈제**: 염화알루미늄 ≈25%(범용) / 황산제2철 15.5%(강력하나 **착색·레진 중합 저해** → 완전 세척 필수). **epinephrine cord는 지양**\n- 대안: cordless paste(kaolin·알루미늄염), 전기소작·레이저(각화치은 충분·부착 안정 시 한정)\n\n**③ 인상**\n<dl><dt>부가중합형 실리콘(PVS)</dt><dd>정밀·안정, 소수성 → 습기 취약(친수화 제품 사용). 지연 주입 가능</dd><dt>Polyether</dt><dd>친수성 우수(습한 열구에 유리), 강직 → 심한 undercut·다수 지대치에서 제거 곤란, <u>수중 보관 금지</u></dd><dt>구강스캐너(IOS)</dt><dd>단관·소수 유닛에서 통상법과 대등. 전악·다수 임플란트는 스캔 전략·검증 필요</dd></dl>\n- 확인 항목: **전 둘레 변연 인기**, 기포·당김·미인기 없음, 인접치·대합 관계\n\n**④ 악간관계**\n- 안정된 MIP가 있고 국소 수복이면 **MIP record**\n- 전악·VDO 변화·MIP 불안정이면 **CR record**(bimanual manipulation, 전방 deprogrammer, leaf gauge)\n- **Facebow** 이전(교합평면·전방유도 재현이 필요한 경우)\n- 대합 인상, shade 사진(회색카드·shade tab 동시 촬영)\n\n**⑤ 기공지시서**\n- 재료·색조(사진 첨부)·변연 형태 및 위치·교합양식·pontic 형태·연결부 설계·납기·연락처 명기',
    assessment: '- 압배 충분(변연 하방 치질 노출), 인상 정밀·전둘레 재현, 악간관계 재현성 확인\n- 대합·인접 관계 정확, 색조 정보 충분',
    plan: '- 기공 의뢰, 임시보철 재장착·교합 확인, 다음 예약(시적)\n\n<details><summary>📚 교과서 — 압배와 인상의 인과관계</summary>\n\n인상의 실패는 대부분 **인상재가 아니라 조직 관리**에서 비롯된다(Rosenstiel Ch.14). 변연 하방으로 최소 <mark style="background:#fef08a">0.2 mm</mark>의 치질이 노출되어야 기공사가 변연을 “읽을” 수 있고, 그 폭은 압배로만 만들어진다. 출혈·삼출이 있는 상태의 인상은 재시행이 원칙이며, 특히 **레진 접착 예정 증례에서는 지혈 실패가 곧 접착 실패**로 이어진다.\n\n**압배 시간**: cord를 4–8분 유지해야 열구가 충분히 벌어지며, 제거 후 수십 초 내 회복되므로 **제거 즉시 주입**한다. cord를 오래(&gt;15분) 두거나 강한 힘으로 밀어 넣으면 부착 손상·퇴축 위험이 있다.\n\n</details>\n\n<details><summary>🔬 근거 — 디지털 vs 통상 인상</summary>\n\n단일 크라운·소수 유닛의 **변연 및 내면 적합에서 디지털(IOS) 워크플로는 통상 인상과 동등하거나 우수**하다는 체계적 고찰이 다수다(예: Chochlidakis, *JPD* 2016). 반면 **전악 스캔의 정확도(trueness)** 는 스캐너·전략·무치악 여부에 따라 편차가 커, 다수 임플란트 보철에서는 photogrammetry·verification jig 등 검증 절차를 병용하는 것이 안전하다.\n\n</details>\n\n<div class="tip"><b>💡 보철과 디테일</b>인상 직후 <u>확대경으로 변연을 한 바퀴 추적</u>하는 습관을 들이세요. 한 곳이라도 끊기면 기공사는 변연을 “창작”하게 되고, 그 결과는 시적 단계가 아니라 <b>2년 뒤 이차우식</b>으로 돌아옵니다.</div>',
  },
  {
    title: '고정성 1-5 · 시적 (Framework / Bisque Try-in)',
    category: '고정성', order: 5,
    subjective: '- 임시보철 경과, 심미 기대 재확인, 지각과민·저작 불편',
    objective: '**① 적합 (Fit)**\n- **변연 적합**: explorer 촉진 + 확대 + 필요 시 방사선. Rocking·tipping 여부\n- **내면 적합**: fit-checker/실리콘 박막으로 조기접촉점 특정 후 선택 삭제\n- (FPD) **완전 안착 실패 시**: 인접 접촉 과다 → 변연 → 내면 순으로 감별. 안착이 안 되면 **절단 후 재연결(solder/re-fire)** 이 정답, 억지 삽입 금지\n\n**② 인접 접촉**\n- **Shimstock 8 μm** 저항감, floss는 “snap” 후 통과. 접촉 위치(교합측 1/3·협설 중앙)와 면적 확인\n\n**③ 교합**\n- CO에서 **균등 접촉**(자연치와 동시), 편심(측방·전방)에서 간섭 제거\n- 교합지 색 구분 사용(적=편심, 흑/청=CO)\n\n**④ 심미 (bisque 단계)**\n- 색조·명도·채도·특성화, 형태·길이·정중선·절단연 위치, 순면 texture\n- 발음(F/V, S), 입술 지지, smile line 조화\n- **환자·보호자 확인 후 서면 동의**(색·형태는 이 단계 이후 변경이 어렵다는 점 설명)',
    assessment: '- 하부구조 수동적 적합, 변연 허용치 내, 접촉·교합 acceptable\n- 심미 항목별 수용 여부와 **수정 지시 사항을 구체적으로 특정**(예: 중절치 절단연 0.5 mm 연장, 치경부 채도 ↑)',
    plan: '- 기공 재의뢰(glaze·형태·색 수정) 또는 그대로 최종 완성\n- 임시보철 재장착, 다음 예약(장착)\n\n<details><summary>🔬 근거 — 변연 적합의 임상 기준</summary>\n\n임상적 허용 변연 간극은 고전적으로 <mark style="background:#fef08a">&lt;120 μm</mark>(McLean & von Fraunhofer, *Br Dent J* 1971 — in vivo 약 1,000개 관찰치 기반). 이는 **역사적 임상 허용치**이며, 현대 CAD/CAM 연구의 in-vitro 목표는 대체로 **≤75–100 μm**로 더 엄격하다. 간극이 클수록 시멘트 용해·미세누출·치태 축적·이차우식 위험이 증가한다.\n\n</details>\n\n<div class="warning"><b>⚠️ 판단 기준</b>“조금 뜨지만 시멘트로 채우면 되겠지”는 없습니다. 완전 안착되지 않은 보철물은 <u>교합·인접 접촉·변연</u> 세 가지가 동시에 틀어지고, 시멘트 층이 두꺼워져 용해·이차우식으로 직결됩니다. 안착이 안 되면 원인을 찾을 때까지 다음 단계로 넘어가지 마세요.</div>',
  },
  {
    title: '고정성 1-6 · 최종 접착 및 장착 (Cementation)',
    category: '고정성', order: 6,
    subjective: '- 임시보철 경과, 최종 심미 최종 확인(장착 전 거울 확인 기회 제공)',
    objective: '**① 준비**\n- 임시보철·임시시멘트 **완전 제거**(pumice·초음파), 지대치 세정·건조\n- **Try-in paste**로 최종 색조 확인(전치부 레진 시멘트 시)\n- 적합·접촉·교합 재확인 → **교합 조정은 접착 전에 대부분 완료**\n\n**② 표면 처리 — 재료별**\n<dl><dt>지르코니아(3Y/4Y/5Y)</dt><dd>50 μm 알루미나 블라스트(**0.05–0.2 MPa, 10 mm, 짧게**) → 세척 → <u>MDP 함유 프라이머</u> → 레진/자가접착 레진 시멘트. <b>HF는 무효</b></dd><dt>리튬디실리케이트</dt><dd>HF ≈5% <b>20초</b> → 수세·초음파 세척 → 실란 60초 → 레진 시멘트(광/이중중합)</dd><dt>장석계 도재·베니어</dt><dd>HF 9.5% <b>60초</b> → 실란 → 광중합 레진 시멘트</dd><dt>금속·귀금속</dt><dd>블라스트 + (귀금속) 황화합물 프라이머, 유지형태 충분하면 RMGI/GI</dd></dl>\n- **시적 중 타액 오염** 시: 인산 세정 또는 산화지르코늄 현탁 세정제로 재세정 후 프라이머 재도포\n\n**③ 시멘트 선택**\n- 유지·저항형태 충분 + 비심미 → **RMGI / GI**(조작 간편, 불소 방출, 술후 지각과민 적음)\n- 형태 부족 · 전부도재 · 베니어 · 짧은 지대치 → **레진 시멘트**(접착 강도, 다만 격리·잉여 제거 부담)\n- **자가접착 레진 시멘트**: 지르코니아·금속 크라운의 실용적 절충안\n\n**④ 접착·마무리**\n- 방습(코튼롤·러버댐·격리기구), 완전 안착 상태로 **손가락/교합압 유지 하 경화**\n- **잉여 시멘트 완전 제거** — 겔 상태에서 1차 제거 → 치실 통과(접착 전 미리 통과시켜 두기) → 경화 후 scaler·floss\n- 산소저지층 처리(글리세린 젤), 최종 교합 미세 조정 후 **연마**(도재는 재글레이즈보다 <u>연마가 대합치 마모에 유리</u>)\n- **Final PA**로 잔여 시멘트·완전 안착 확인',
    assessment: '- 완전 안착, 변연·접촉·교합 양호, 잉여 시멘트 제거 확인, 심미 승인',
    plan: '- 술후 지침: 초기 저작 적응, 지각과민 2–4주 가능, 치실 사용법(측방 제거), **bruxer는 야간 가드 제작**\n- **리콜 6–12개월** — 변연·교합·치주·이차우식 점검\n\n<div class="danger"><b>🚫 역효과 주의</b>치은연하 잔존 레진 시멘트는 만성 염증·부착소실·이차우식의 대표 원인입니다. ① 접착 전 인접부에 치실을 미리 통과시켜 두고 ② 겔 상태에서 대부분 제거하며 ③ 경화 후 <u>방사선으로 잔사를 확인</u>하세요. 변연이 깊을수록 이 위험은 기하급수적으로 커집니다.</div>\n\n<details><summary>📚 교과서 — 시멘트 선택의 사고 순서</summary>\n\nRosenstiel Ch.31의 원칙은 “**가장 단순한 시멘트로 충분한가**”를 먼저 묻는 것이다. 유지·저항 형태가 충분한 금속·지르코니아 크라운에 굳이 복잡한 다단계 접착을 쓰면, 얻는 것보다 **잉여 시멘트·기술 민감도·술후 과민**이라는 대가가 크다. 반대로 **베니어·짧은 지대치·전부도재 인레이**는 접착이 곧 유지이자 강도이므로 러버댐 격리와 완전한 프로토콜이 필수다.\n\n</details>',
  },
  {
    title: '고정성 1-7 · Post & Core (실활치 수복)',
    category: '고정성', order: 7,
    subjective: '- 근관치료 시기·증상 유무, 저작 시 불편, 기존 core 탈락력\n- 해당 치아의 **전략적 가치**(지대치 여부, 대체 옵션) 확인',
    objective: '- **근관 상태**: 충전 치밀도·길이, 치근단 병소 유무·치유 경과, 증상\n- **잔존 치질**: 벽 개수·두께, **연속적 ferrule 높이 ≥1.5–2 mm / 두께 ≥1 mm** 확보 여부\n- 치근 형태: 길이·만곡·단면(근심 함몰), 치근 두께, **VRF 징후**(고립성 깊은 협측 포켓, J형 투과상, 변연부 sinus tract)\n- **Post 설계 기준** —\n  - 길이: 치근 길이의 **2/3** 또는 임상 치관 길이 이상, **치근단 GP 봉쇄 ≥4–5 mm 보존**\n  - 직경: 치근 직경의 **1/3 이하**, 잔존 상아질 벽 **≥1 mm**\n  - 골지지 내에 post 말단이 위치(치조골정 하방까지 연장이 유리)\n- **Post 종류 선택**: 섬유강화 레진 post(탄성계수가 상아질과 유사, 실패 시 재수복 가능) vs 주조 post & core(치질 소실 심함·축 경사 보정 필요·다근치)\n- 구치부는 **치수강 유지(chamber retention)** 만으로 충분한 경우가 많음 — 불필요한 post는 치근 약화',
    assessment: '- Ferrule 확보 여부가 예후를 좌우 → 미확보 시 **crown lengthening / 교정적 정출 / 발치 후 임플란트** 중 선택\n- 근관 예후, 치근 파절 위험, 지대치로서의 적합성 판정',
    plan: '- Post space 형성(가급적 근관충전 후 조기, 러버댐 하) → post 접착 → core 축조 → 형성으로 연결\n- 다음 예약(형성·인상)\n\n<details><summary>🔬 근거 — ferrule과 post 선택</summary>\n\n**Ferrule**: 연속적인 1.5–2 mm 치질 ferrule은 post-core 수복치의 파절 저항을 유의하게 증가시킨다(Sorensen & Engelman, *JPD* 1990; 체계적 고찰 Juloski, *J Endod* 2012). **부분(협측만) ferrule은 예측성이 낮아** 전처치를 먼저 고려한다.\n\n**Post의 역할**: post는 치아를 “강화”하지 않는다 — <u>core를 유지</u>하는 장치일 뿐이며, post space 형성 자체가 치질을 제거해 파절 위험을 높인다. 따라서 **잔존 치질로 core 유지가 가능하면 post를 넣지 않는 것이 원칙**이다(Shillingburg Ch.12; Rosenstiel Ch.12).\n\n**섬유 post vs 주조 post**: 생존율은 증례 선택에 크게 좌우되어 우열이 단정되지 않으나, **실패 양상**에서 섬유 post가 재수복 가능한 형태(post 탈락·파절)로 실패하는 반면 주조 post는 **치근 파절 = 발치**로 이어지는 경향이 보고된다.\n\n</details>\n\n<div class="warning"><b>⚠️ 판단 순서</b>“post를 어떻게 넣을까”보다 <u>“이 치아를 살릴 가치가 있는가”</u>가 먼저입니다. ferrule 확보 불가 + C:R 불량 + 치주 지지 소실이 겹치면, 무리한 post & core는 수년 뒤 <b>수복 불가능한 치근 파절</b>로 끝나 임플란트 예후까지 나빠집니다.</div>',
  },
  {
    title: '고정성 1-8 · 치관연장술 / 교정적 정출 협진',
    category: '고정성', order: 8,
    subjective: '- 해당 치아의 반복적 문제(마진 재우식·수복물 탈락), 심미 요구(gummy smile·치은 비대칭)\n- 수술 수용 의사, 치유 기간 대기 가능 여부',
    objective: '- **필요량 산정**: 예정 변연 위치에서 **치조골정까지 ≥3 mm** (부착 2 mm + 열구 1 mm) 확보에 부족한 거리\n- 골 탐침(bone sounding, 마취 하), 각화치은 폭, 치조골 형태, 인접치 관계\n- **정출 방식 결정** —\n<dl><dt>치관연장술(외과)</dt><dd>치은절제 ± 골삭제 ± 판막. 치관/치근비 악화, 인접치 골지지·심미 부위 주의</dd><dt>교정적 정출(강제 맹출)</dt><dd>주 0.5–1 mm 속도. <u>fiberotomy 병용 시</u> 치조골·치은이 따라오지 않아 순수 치관 노출 효과, 병용 안 하면 골도 함께 이동(수직 골결손 개선에 활용)</dd><dt>발치 후 임플란트</dt><dd>C:R 악화·심미 손실이 클 때의 대안</dd></dl>\n- **치유·안정화 기간**: 비심미 구치부 **6주** 이상, **심미 전치부 12주 이상**(변연 치은 위치 안정까지 수개월). 교정 정출은 **8–12주 보정**',
    assessment: '- Supracrestal attachment 침범 예상 → 전처치 적응증\n- 술식 선택 근거와 예상 C:R 변화, 심미 위험(인접 papilla·치은 라인 비대칭) 기재',
    plan: '- 치주·교정과 협진 의뢰(목표 변연 위치와 필요 노출량을 **수치로** 전달, 임시보철·wax-up 제공)\n- 치유 기간 중 임시보철로 치은 형태 유도 → 안정 후 최종 형성·인상\n\n<details><summary>📚 교과서 — 왜 3 mm인가</summary>\n\nGargiulo(1961)의 치아–치은 결합부 계측(접합상피 0.97 + 결합조직 부착 1.07 ≈ **2.04 mm**)에 **열구 깊이 약 1 mm**를 더한 값이 “변연–골정 3 mm” 기준의 근거다(Nevins & Skurow; Padbury, *JCP* 2003). 2017 World Workshop 이후 용어는 <u>supracrestal tissue attachment</u>로 정리되었다.\n\n중요한 것은 **평균값이 아니라 개인차**다. Kois는 골정–유리치은 거리(dentogingival complex)가 개인마다 다르므로 **bone sounding으로 실측**할 것을 강조한다 — 얇은 biotype에서는 침범 시 염증 대신 **퇴축**으로 나타나 심미 실패가 된다.\n\n</details>',
  },
  {
    title: '고정성 1-9 · 보철물 탈락·파절 응급 처치',
    category: '고정성', order: 9,
    subjective: '- 탈락/파절 시점·상황(딱딱한 음식, 반복 여부), 통증·지각과민, 보철물 보관 여부\n- **반복 탈락 이력** — 몇 번째인지, 이전에 어떻게 처치했는지',
    objective: '- **탈락 원인 감별** — ① 시멘트 실패(내면 시멘트 잔존) ② **지대치 우식**(내면에 상아질·연화 치질) ③ 치아 파절 ④ 유지형태 부족(짧은/과경사 축벽) ⑤ 교합 과부하·간섭\n- 지대치 검사: 우식 제거 후 잔존 치질, ferrule, 동요도, 타진·치수 검사, **균열·VRF 징후**\n- **방사선(PA)**: 치근단 병소, 이차우식, 잔존 시멘트, 파절선\n- 보철물 평가: 내면 적합, 변연 손상, 도재 chip 범위(대합 접촉·심미 부위 포함 여부)',
    assessment: '- **재접착 가능** — 지대치 건전 + 보철물 온전 + 유지형태 충분\n- **재제작 필요** — 이차우식으로 변연 이동, 유지형태 부족, 치아 파절, 반복 탈락\n- **발치 고려** — 수복 불가 파절(VRF), ferrule 확보 불가 + 지지 소실\n- 파절이 재료 문제인지 **교합 과부하/파라펑션** 문제인지 반드시 구분',
    plan: '- **재접착 시**: 내면·지대치 완전 세정 → 우식 제거·필요 시 core 재축조 → 유지 보완(홈 추가) → 교합 간섭 제거 → 접착력 높은 시멘트로 재접착 → 원인 교정(가드 등)\n- **도재 chipping**: 소범위·비기능부는 연마 마무리, 기능·심미부는 구내 수리 kit(HF/실란/opaquer/composite) — **수리는 잠정적 해결**임을 설명하고 재제작 시점 합의\n- **임플란트 나사 풀림**: 나사 교체 + 규정 토크 재체결 + **교합 원인 제거**(단순 재조임만 하면 재발)\n- 원인·처치·환자 설명 내용을 문서화, 재평가 예약\n\n<div class="tip"><b>💡 진단 요령</b>탈락한 크라운 <u>내면</u>을 먼저 보세요. 시멘트가 깨끗이 붙어 있으면 <b>지대치 쪽 접착 실패</b>(우식·습기·오염), 내면이 깨끗하면 <b>시멘트–보철물 계면 실패</b>(표면처리 부족), 내면에 치질이 붙어 있으면 <b>치아 파절</b>입니다. 원인을 모른 채 다시 붙이면 같은 자리에서 반복됩니다.</div>',
  },

  // ═══════════════ 2. 국소의치 (RPD) ═══════════════
  {
    title: 'RPD 2-1 · 진단·예비인상·서베잉·설계',
    category: '국소의치', order: 1,
    subjective: '- 주소, **결손 부위·상실 시기·상실 원인**(우식/치주/외상 — 원인은 잔존치의 미래를 예고)\n- 기존 의치 경험: 사용 기간, 불만(유지·통증·심미·발음·저작), **착탈 능력·손재주**, 야간 착용 습관\n- 전신: 손 떨림·관절염(착탈 곤란), 구강건조 유발 약제, 연하·구역반사\n- 기대치와 수용 범위: 클래스프 금속 노출 허용 여부, 비용·기간',
    objective: '**① 구내 평가**\n- 잔존치: 우식·수복물·치주(probing·BOP·동요도·근분지부)·**C:R ratio**·정출·경사\n- 무치악 치조제: 형태·높이·언더컷·flabby ridge·과잉조직·융기(torus)·소대 부착\n- 각화점막 폭, 하악 설측 **구강저 높이**(설측 major connector 선택 좌우), 개구량, 타액\n- 대합: 자연치 / 보철 / 총의치 (대합이 총의치면 응력 배분·안정성이 완전히 달라짐)\n\n**② 예비인상·진단모형**\n- Alginate 예비인상 → 진단모형 → **개인트레이 제작**, 교합기 마운팅\n\n**③ 서베잉 (Surveying)**\n- Analyzing rod로 **착탈로 결정** — ① guiding plane 평행성 ② 유지 언더컷 분포 ③ 간섭 제거 ④ 심미(클래스프 노출)\n- **Undercut gauge**: 주조 circumferential clasp <mark style="background:#fef08a">0.25 mm(0.01")</mark> · **I-bar** 0.25 mm · **wrought wire** 0.5 mm(0.02")\n- Height of contour, 삼각 표시(tripodization)로 모형 위치 기록\n\n**④ 설계 (McCracken 순서)**\n1. **Kennedy 분류 + Applegate 규칙** 확정 (Class I 양측 유리단 / II 편측 유리단 / III 치아지지 / IV 정중 전방)\n2. **지지(rest)** 결정 → 3. **안정·상반(reciprocation)** → 4. **유지(retainer)** → 5. **연결(connector)**\n- **Major connector**: 하악 lingual bar는 유리치은연–구강저 <mark style="background:#fef08a">≥8 mm</mark> 필요(bar 폭 4 mm + 치은연 하방 3 mm), 부족 시 lingual plate. 상악은 치은연에서 **6 mm 이격**, palatal strap은 폭 ≥8 mm\n- **Minor connector**: 서로 5 mm 이상 이격, 융기·소대 회피, 치은연에 수직 진입\n- **직접유지장치**: 치아지지(Class III)는 주조 circumferential(Akers) 유리, **유리단(Class I·II)** 은 응력 완충형 — <u>RPI(mesial rest + proximal plate + I-bar)</u> · RPA · wrought wire clasp\n- **간접유지장치**: fulcrum line에 **수직으로, 가능한 한 멀리**(전방) 배치',
    assessment: '- **Kennedy Class ___ mod ___**, 지지 형태(치아지지 / 치아–점막 혼합지지)\n- 지대치별 예후와 **전략적 가치**, 추가 상실 가능성 → 향후 첨상(tooth addition) 가능한 설계인지\n- ACP PDI(부분무치악) Class I–IV로 난이도 층화\n- 전처치 필요 목록: 치주치료 / 수복 / 근관 / 발치 / **surveyed crown** / 정출·교합조정',
    plan: '- 전처치 시행 후 재평가 → **구강 형성**(2-2) 예약\n- 설계도(주모형에 색 구분 표기)를 기공지시서에 첨부\n- 위생·리콜의 중요성을 **설계의 일부로** 설명하고 동의\n\n<details><summary>📚 교과서 — RPD 설계는 “지지 → 유지” 순서다</summary>\n\nMcCracken 13e의 핵심은 설계 순서다. 초심자는 “어디에 클래스프를 걸까”부터 생각하지만, 교과서는 **지지(rest)를 먼저 완전히 배치한 뒤** 안정·유지를 얹으라고 가르친다. 지지가 부실한 상태에서 유지만 강하면, 의치는 저작 시 조직으로 침하하면서 **지대치를 지렛대로 사용**해 뽑아내는 방향의 힘을 만든다.\n\n**유리단의 본질적 문제**: 치아(비압축성, 침하 0.1 mm 이하)와 점막(압축성, 1–2 mm 침하)이라는 <u>물성이 다른 두 지지체</u>를 한 보철물이 동시에 사용한다. RPI·wrought wire 같은 응력 완충 설계와 altered cast 인상은 모두 이 문제 하나를 다루기 위한 장치다(Kratochvil; Krol).\n\n</details>\n\n<details><summary>🔬 근거 — RPD는 지대치 위험 인자다</summary>\n\n장기 관찰 연구에서 RPD 장착은 **지대치·잔존치의 치태 축적, 치은염, 우식, 동요도 증가**와 연관된다. 그러나 이 위험은 <u>정기 리콜과 위생 관리가 병행되면 크게 감소</u>한다는 것이 반복된 결론이다. 즉 RPD의 예후는 설계뿐 아니라 **유지관리 체계**로 결정된다(McCracken Ch.15; Carranza 관련 장).\n\n</details>',
  },
  {
    title: 'RPD 2-2 · 구강 형성 (Mouth Preparation)',
    category: '국소의치', order: 2,
    subjective: '- 전처치 후 경과, 잔여 증상, 지난 내원 이후 변화',
    objective: '**형성 순서 (McCracken 권장 — 순서를 지키는 것이 핵심)**\n1. **Guiding plane** — 지대치 인접면을 착탈로에 평행하게, 협설폭의 약 2/3, 교합·치은 방향 **2–4 mm 높이**로 형성. 착탈로 일치·안정·상반 작용 제공\n2. **치관 형태 수정** — 유지부(언더컷)와 상반부(비유지면) 형태 조정, 필요 시 height of contour 하향\n3. **Rest seat — 반드시 마지막에** (앞 단계에서 삭제되어 없어지므로)\n\n**Rest seat 기준**\n<dl><dt>교합면 rest</dt><dd>둥근 삼각형(정점은 치아 중심), 협설폭 = 교두정간 거리의 <b>≈1/2</b>, 근원심 길이 = 근원심 폭의 <b>≈1/3</b>, 변연융선부 깊이 <b>1–1.5 mm</b>. 바닥은 치아 중심을 향해 <u>정점 방향으로 경사</u>, rest–minor connector 각도 <b>&lt;90°</b></dd><dt>Cingulum rest(견치·전치)</dt><dd>설면 cingulum 상방에 반달형(V) 형성, 법랑질 내에서. 얇으면 레진/금속 rest seat 수복</dd><dt>Incisal rest</dt><dd>절단연 우각부에 V형. 심미·응력 불리 → 대안 없을 때만</dd></dl>\n- **삭제는 법랑질 내에서** — 상아질 노출 시 불소 도포·레진 수복, 광범위하면 **surveyed crown**으로 전환\n- Surveyed crown이 필요하면: 왁스업 단계에서 **guide plane·rest seat·언더컷·상반면을 미리 부여**하고 서베잉된 모형에서 형성\n- 교합 간섭 조정, 정출치 조정(필요 시 근관·보철 협진)',
    assessment: '- Guiding plane 평행·연속, rest seat 형태·깊이 적절(응력이 **치아 장축**으로 전달), 언더컷 계측치 확보\n- 법랑질 보존 여부, 추가 수복 필요 항목',
    plan: '- 불소 도포·위생 지침, 정밀인상(2-3) 예약\n\n<div class="warning"><b>⚠️ 가장 흔한 실패</b>rest seat 바닥이 <u>평평하거나 바깥으로 경사</u>지면 저작력이 지대치에 측방력으로 작용해 동요·정출·상실을 유발합니다. 바닥은 반드시 치아 중심(장축) 쪽으로 기울어야 하고, rest와 minor connector가 이루는 각은 90° 미만이어야 합니다. 이 한 가지가 지대치 수명을 좌우합니다.</div>\n\n<div class="tip"><b>💡 임상 팁</b>구강 형성 전 <u>진단모형에 미리 형성 연습</u>을 하면 삭제량과 각도를 손에 익힐 수 있습니다. 특히 guiding plane은 구내에서 착탈로를 눈으로 확인하기 어려우므로, 모형 서베잉 결과를 사진·메모로 남겨 두고 참조하세요.</div>',
  },
  {
    title: 'RPD 2-3 · 정밀인상 (Final Impression)',
    category: '국소의치', order: 3,
    subjective: '- 특이사항, 구강 형성 후 지각과민 여부',
    objective: '- **개인트레이** 시적 — 변연을 vestibule보다 **2 mm 짧게**, 소대 절흔, tissue stop 부여\n- (유리단·가동 조직) 필요 시 **border molding**\n- **인상재**: PVS(정밀·안정) / polyether(친수·강직) / 알지네이트(치아지지 단순 증례에 한정)\n- 필수 인기 항목: **모든 rest seat · guiding plane · 언더컷 · 잔존 치조제 전체 · 소대·변연 형태 · 대합**\n- **유리단(Kennedy I·II)** — <u>Altered cast(수정 모형) 기법</u>\n  1. 통상 정밀인상 → 주모형 → framework 제작\n  2. framework 위 유리단부에 **개별 record base** 부착\n  3. border molding 후 **기능 압력 하 인상**(선택적 가압)\n  4. 주모형의 유리단부를 절단·제거하고 새 인상으로 **재부착(altered cast)**\n- 인상 후 즉시 모형 제작(알지네이트) / PVS는 지연 주입 허용',
    assessment: '- 변연·지지영역·rest seat·guide plane 인기 정확, 기포·당김 없음\n- (유리단) 조직 지지 확대 확보',
    plan: '- Framework 제작 의뢰 — **설계도(주모형 표기) + 착탈로 삼각 표시 + 재료(Co-Cr / Ti / 열가소성)** 명기\n- 다음 예약(framework 시적)\n\n<details><summary>📚 교과서 — altered cast는 왜 필요한가</summary>\n\n유리단 부위 점막은 원심으로 갈수록 피압축성이 커진다. **해부학적(무압) 인상**만으로 제작하면 저작 시 의치상이 조직 쪽으로 가라앉으면서 지대치에 **torque(지렛대 힘)** 가 걸린다. altered cast 기법(McCracken Ch.16)은 유리단만 **기능 부하 상태**로 다시 인기해 지지 면적을 넓히고 침하량을 줄여, 결과적으로 지대치 응력을 감소시킨다.\n\n같은 목적의 대안으로 **functional reline(장착 후 기능 이장)** 이 있으며, 실무에서는 altered cast를 생략한 경우의 사후 보정 수단으로 널리 쓰인다.\n\n</details>',
  },
  {
    title: 'RPD 2-4 · 금속 주조체 시적 (Framework Try-in)',
    category: '국소의치', order: 4,
    subjective: '- 특이사항, 착용 시 압박·통증·이물감',
    objective: '- **육안 검수(구외)**: 주조 결함·기포·연마 상태, 설계도 대비 일치, 예리한 변연 제거\n- **모형 위 적합** 확인 후 구내 시적 — **손가락 압력만으로 착탈로를 따라 서서히** 삽입(강제 삽입 금지)\n- **Passive fit 확인** —\n  - 모든 **rest가 rest seat에 완전 착좌**\n  - **Rocking 없음**(교대로 눌러 확인)\n  - Major/minor connector가 조직을 압박하지 않음(설측 bar–점막 간 미세 이격)\n  - Guiding plane–proximal plate 접촉이 면(面)으로 닿음\n- 부적합 시 **disclosing wax / fit-checker / PIP**로 접촉점을 특정해 **선택적으로만** 삭제\n- 클래스프 유지부 tip이 계측된 언더컷에 위치하는지 확인, 유지력 예비 평가\n- 교합: framework가 대합과 조기접촉하지 않는지 확인',
    assessment: '- Framework 수동적 적합, rest 완전 착좌, rocking 없음, connector 압박 없음\n- (부적합 시) 원인 특정 — 조기접촉 / 주조 변형 / 모형 손상 / 착탈로 불일치',
    plan: '- (유리단) **altered cast 인상** 시행 → 모형 수정\n- 적합 확인 후 record base + occlusion rim 제작 의뢰, 다음 예약(악간관계)\n\n<div class="danger"><b>🚫 여기서 타협하면 전부 무너집니다</b>rocking하거나 rest가 뜬 상태로 배열 단계에 넘어가면, 완성 의치는 <u>유지 상실·조직 손상·지대치 동요</u>가 동시에 발생합니다. 원인을 못 찾으면 <b>재제작</b>이 정답입니다. 금속을 억지로 구부려 맞추는 것은 파절과 응력 집중을 만들 뿐입니다.</div>',
  },
  {
    title: 'RPD 2-5 · 악간관계 채득 및 인공치 선택',
    category: '국소의치', order: 5,
    subjective: '- 특이사항, 심미 요구(치아 색·형태·배열) 청취',
    objective: '- **Record base + wax rim**을 framework 위에 장착(안정성 확인)\n- **잔존치가 충분하고 MIP가 안정** → MIP 기록(교합지·왁스·PVS bite)\n- **후방 지지 상실·MIP 불안정·VDO 변경** → **CR 기록**(bimanual, gothic arch tracer)\n- **VDO 확인**: 안모·발음·연하 + **freeway space 2–4 mm**\n- **Facebow** (교합평면·편심 재현이 필요한 경우)\n- **인공치 선택**: mold(잔존치·안모 조화), shade(잔존치와 비교, 자연광), 재료 — 레진(조정 용이·마모↑) / 도재(내마모·대합 마모 위험) / **복합레진계**\n- 교합평면·교합양식 결정: 잔존 자연치와 조화, 유리단에서는 **협설 폭 축소·교두 경사 완화**로 응력 감소',
    assessment: '- VDO·CR(또는 MIP) 재현 가능, 교합평면 적절, 인공치 선택 근거 기재',
    plan: '- 인공치 배열 의뢰, 다음 예약(납의치 시적)\n\n<div class="tip"><b>💡 유리단 배열 원칙</b>Kennedy Class I·II에서는 후방으로 갈수록 지지가 불리해집니다. <u>협설 폭을 좁히고, 교두 경사를 낮추고, 최후방 인공치(제2대구치)를 생략</u>하면 치조제 응력과 지대치 torque가 함께 줄어듭니다. “치아를 다 채워 넣는 것”이 좋은 의치가 아닙니다.</div>',
  },
  {
    title: 'RPD 2-6 · 납의치 시적 (Wax Try-in)',
    category: '국소의치', order: 6,
    subjective: '- 심미 피드백(색·형태·배열·노출량), 발음 자각',
    objective: '- Framework 적합 재확인(왁스 배열 상태에서도 rocking 없음)\n- **VDO·악간관계 재검증**(freeway space, 안모)\n- **심미**: 정중선, 절단연 위치·노출량, 순측 지지, smile line, 치은 형태·클래스프 노출\n- **발음**: F/V(절단연–하순), S(전방 공간)\n- **교합**: 잔존 자연치와 동시 접촉, 편심 간섭, 유리단부 균등 접촉\n- **환자·보호자 확인 후 서면 동의**(색·배열은 이후 변경이 어려움을 설명)',
    assessment: '- VDO·심미·발음·교합 acceptable, 환자 동의 확보',
    plan: '- 온성(processing) 의뢰 — 레진 종류·치은색·후처리 명기\n- 다음 예약(장착)\n\n<div class="warning"><b>⚠️ 체크 누락 주의</b>납의치 단계에서 <u>클래스프 노출량</u>을 환자와 함께 거울로 확인하지 않으면, 완성 후 “금속이 보인다”는 불만으로 재제작을 요구받게 됩니다. 심미가 중요한 증례라면 이 단계에서 <b>I-bar·근심 rest·치아색 클래스프</b> 등 설계 변경 여부를 최종 결정하세요.</div>',
  },
  {
    title: 'RPD 2-7 · 의치 장착 및 초기 조정',
    category: '국소의치', order: 7,
    subjective: '- 장착 시 압박감·통증 부위, 유지력 체감, 발음·저작 예상 불편',
    objective: '**① 장착 전**\n- 의치 검수: 예리한 변연·레진 돌기 제거, 연마 상태\n\n**② 적합·조직 조정**\n- 착탈로 따라 삽입 — 억지로 넣지 않기\n- **PIP(pressure indicating paste)** 로 과압박점 특정 → 선택 삭제(조직면)\n- **Disclosing wax**로 변연 과신장 조정\n\n**③ 유지·안정**\n- 클래스프 유지력 미세 조정(**plier 사용, 손가락 금지**), 언더컷 진입 확인\n- 전후·측방 rocking, 간접유지장치 작동 확인\n\n**④ 교합**\n- 구내 조정 후, 가능하면 **clinical remount**로 교합기 상에서 정밀 조정\n- CO 균등 접촉(잔존치·인공치 동시), 편심 간섭 제거\n\n**⑤ 환자 교육 (구두 + 서면)**\n- 착탈 방법 시연 → **환자가 직접 3회 이상** 성공할 때까지\n- 세척: 물+의치용 솔·중성세제(**치약 연마제 금지**), 열탕 변형 주의\n- **야간 제거·물에 보관**, 조직 휴식\n- 초기 발음·타액 증가·이물감은 수일–수주 내 적응\n- 통증 시 **자가 삭제 금지**, 내원 24시간 전부터 착용하고 오기(압박점 표시를 위해)',
    assessment: '- 적합·유지·안정·교합 양호, 압박점 해소, 환자 착탈 습득',
    plan: '- **24–48시간 후 1차 조정** 예약 → 이후 sore spot 소실까지 3–4회\n- 3개월·6개월 점검, 이후 **연 1회 정기 검진**(잔존치·치조제 흡수·유지력·이장 필요성)\n\n<div class="tip"><b>💡 조정 예약의 원칙</b>“아프면 오세요”가 아니라 <u>날짜를 정해 예약</u>하세요. 궤양은 초기에 조정하면 며칠이면 낫지만, 방치하면 증식성 조직(epulis fissuratum)으로 진행해 외과적 절제가 필요해집니다.</div>',
  },
  {
    title: 'RPD 2-8 · 사후관리 — 이장·수리·재평가',
    category: '국소의치', order: 8,
    subjective: '- 사용 기간, 최근 변화(헐거워짐·통증·소리·파절), 착용 시간, 세척 방법, 야간 착용 여부\n- 저작 만족도, 심미 만족도',
    objective: '- **잔존치**: 우식(특히 클래스프·rest 접촉부), 치주 상태, 동요도 변화, 지대치 정출\n- **치조제**: 흡수량, 발적·궤양·증식조직·**의치성 구내염**(Newton I–III)\n- **의치**: 적합(PIP), 유지력, 클래스프 변형·파절, rest 착좌, 레진 파절·마모, 인공치 마모·탈락\n- **교합**: 마모로 인한 VDO 감소, 편측 접촉\n- 필요 시 방사선(지대치·잔존제)\n\n**처치 판단**\n<dl><dt>이장(Reline)</dt><dd>조직면만 갱신 — 유리단 침하·전반적 적합 저하. <b>Functional reline</b>: 조직면에 이장재 도포 후 기능운동·교합 하에 인기</dd><dt>개상(Rebase)</dt><dd>인공치·framework는 유지, 의치상 레진 전체 교체 — 레진 변색·다공성·다회 이장 후</dd><dt>수리(Repair)</dt><dd>클래스프 파절(재주조·wrought wire 대체), 레진 파절(원인=적합 불량·응력 집중), 인공치 첨상</dd><dt>재제작</dt><dd>framework 변형·파절, 지대치 상실로 설계 변경, VDO 상실 심함</dd></dl>',
    assessment: '- 잔존치·치조제·의치 각각의 상태 판정과 원인 규명\n- **레진이나 클래스프가 부러졌다면 그 자체가 결과** — 적합 불량, 교합 간섭, 설계 오류 중 원인을 명시',
    plan: '- 해당 처치 시행 + **원인 교정**(교합 조정·설계 보완·위생 재교육)\n- 의치성 구내염 동반 시: 야간 제거 철저, 의치 소독, 필요 시 항진균제, 조직 회복 후 이장\n- 다음 리콜 일정 지정(통상 6–12개월, 위험군은 3–6개월)\n\n<div class="warning"><b>⚠️ 반복 파절의 진짜 원인</b>같은 자리가 두 번 부러지면 접착·보강이 아니라 <u>설계·적합·교합</u>을 의심하세요. 유리단 침하가 방치되면 지렛대 응력이 한 지점에 집중되어, 아무리 튼튼하게 수리해도 다시 부러집니다. <b>이장으로 지지를 회복시키는 것이 진짜 수리</b>입니다.</div>',
  },

  // ═══════════════ 3. 총의치 (Complete Denture) ═══════════════
  {
    title: 'CD 3-1 · 진단·예비인상 (Preliminary Impression)',
    category: '총의치', order: 1,
    subjective: '- **무치악 기간**과 발치 경위, 현재 의치 사용 연수·개수\n- **기존 의치 불만을 항목별로 분리**: 유지(빠진다) / 안정(움직인다) / 통증 / 심미 / 발음 / 저작 / 구역 — 항목마다 원인이 다름\n- 하루 착용 시간, 야간 착용 여부, 세척 방법, 접착제 사용량\n- 전신: 구강건조 유발 약제, 파킨슨·뇌졸중(신경근 조절), 당뇨, 영양·체중 변화\n- **적응력·성격 유형** 및 기대 수준 — 총의치 성공의 최대 변수',
    objective: '**① 구외·구내 일반**\n- 안모(입술 지지·구각·안모수직고경), TMJ·저작근, 구각염(VDO 저하·칸디다 시사)\n- 점막 상태: 발적·궤양·**의치성 구내염(Newton I 점상 / II 미만성 발적 / III 유두증식)**, 증식성 조직, 구강건조, 백색·적색 병변(선별)\n\n**② 무치악 해부 평가**\n<dl><dt>상악</dt><dd><b>주지지역</b> 수평 경구개 후방·치조제 정상 / <b>완화</b> 절치유두·정중구개봉합·융기 / <b>변연(한계)</b> 순협측 vestibule·소대·hamular notch·<b>vibrating line</b></dd><dt>하악</dt><dd><b>주지지역</b> buccal shelf(협붕) / <b>보조</b> 치조제 정상·retromolar pad / <b>완화</b> mylohyoid ridge·이공(mental foramen)·genial tubercle·torus / <b>변연</b> retromylohyoid fossa·설소대</dd></dl>\n- 치조제 흡수도, 언더컷, **flabby(가동성) ridge** 유무와 범위, 잔존 골융기\n- 혀 크기·위치(Wright 분류), 타액 양·점조도, 개구·구역반사\n\n**③ 예비인상**\n- 기성 트레이 + 알지네이트(또는 모델링 컴파운드) — **모든 해부학적 경계 포함**, 필요 시 트레이 변연 왁스 연장\n- 진단모형 제작 → **개인트레이 설계·제작**\n- 기존 의치 사진·계측(성공 요소는 복제, 실패 요소는 교정)',
    assessment: '- **ACP PDI(완전무치악) Class I–IV**로 난이도 층화\n- 지지·유지·안정 각각의 예후 예측과 **불리 요인 명시**(심한 흡수, flabby ridge, 구강건조, 큰 혀, 신경근 조절 저하, 비현실적 기대)\n- 필요 전처치: 증식조직 절제, 융기 제거, 조직 조정(tissue conditioning), 임플란트 오버덴처 대안 상담',
    plan: '- 개인트레이 제작, 정밀인상(3-2) 예약\n- **초기 상담이 곧 치료의 절반** — 총의치의 한계(저작 효율은 자연치의 일부, 하악 유지 한계, 적응 기간)를 **처음에** 설명하고 문서화\n- 하악 흡수 심함 → **임플란트 오버덴처** 옵션을 반드시 제시\n\n<details><summary>🔬 근거 — 치조제 흡수는 멈추지 않는다 (Tallgren)</summary>\n\nTallgren의 25년 종단 연구(*JPD* 1972)는 발치 후 치조제 흡수가 **첫 해에 급격**하고 이후 완만하게(대략 연 0.1–0.2 mm 수준) **평생 지속**되며, **하악 전방부가 상악의 약 4배** 속도로 흡수됨을 보였다.\n\n임상적 함의는 세 가지다 — ① 오늘 완벽히 맞는 의치도 **수년 뒤에는 반드시 헐거워진다**(이장·재제작을 처음부터 예고할 것) ② 하악이 더 빨리 나빠지므로 **하악 유지 대책(임플란트 2개 오버덴처)** 을 조기에 상담 ③ 잔존제 보존을 위해 **과압박·과대 VDO를 피한다**.\n\n</details>',
  },
  {
    title: 'CD 3-2 · 정밀인상 (Final Impression)',
    category: '총의치', order: 2,
    subjective: '- 특이사항, 개인트레이 착용 시 불편',
    objective: '**① 개인트레이 시적**\n- 변연을 vestibule보다 **1–2 mm 짧게**, 소대 부위 절흔, **tissue stop**으로 균등 이격 확보\n- 트레이 안정성·중앙 위치 확인, 근육 운동 시 들리지 않는지\n\n**② Border molding (변연 형성)**\n- **분할법**: 모델링 컴파운드(green stick)를 구역별로 순차 형성 — 순측 → 협측 → 후방(hamular notch/retromolar) → 설측(하악)\n- 또는 **일괄법**: heavy body PVS로 한 번에\n- **기능 운동**: 상악(입술 당기기, 볼 당기고 아래로, “아” 발음 / 하악 개구·측방·연하, 혀 내밀기·좌우 이동)\n- 목표는 **변연 폐쇄(border seal)** — 유지력의 물리적 기반\n\n**③ 최종 인상**\n- 재료: light-body PVS / polysulfide / ZOE / polyether\n- **선택적 가압(selective pressure)** 개념 — 주지지역은 지지, 완화부는 이격\n- **Flabby ridge**: 트레이에 창(window)을 내고 **무압 인상**(석고·저점도 재료)으로 조직 변형 방지\n- **상악 post-dam(후방 구개 봉쇄)**: vibrating line(“아” 발음 시 관찰) 확인 → 구내 표시 → 모형에 **폭 나비형, 깊이 1–1.5 mm**로 조각\n- 하악: retromolar pad **전체 덮기**, buccal shelf까지 확장, 설측은 mylohyoid 근육 기능에 맞춰\n\n**④ 확인**\n- 전 변연이 둥글고 균일한 두께, 기포·노출 트레이 없음, 주지지역 과압박 없음',
    assessment: '- 변연 신장·폐쇄 적절, 지지영역 정확 인기, flabby 부위 무변형\n- Post-dam 위치·깊이 결정',
    plan: '- 주모형(boxing 후 주입) 제작, **record base + occlusion rim** 의뢰\n- 다음 예약(악간관계 채득)\n\n<details><summary>📚 교과서 — 유지·안정·지지의 삼각형</summary>\n\nZarb/Boucher 13e는 총의치 성공을 세 축으로 정리한다 — **Support(지지, 수직 힘 저항)** 는 <u>넓고 단단한 주지지역</u>에서, **Retention(유지, 이탈 저항)** 은 <u>변연 폐쇄·계면장력·흡착·근육 균형</u>에서, **Stability(안정, 수평 힘 저항)** 는 <u>치조제 형태·의치상 연마면 형태(polished surface)·교합·인공치 위치</u>에서 나온다.\n\n환자가 “빠진다”고 하면 <u>변연 폐쇄</u>를, “움직인다”고 하면 <u>교합과 연마면 형태</u>를, “아프다”고 하면 <u>지지·과압박</u>을 먼저 의심하는 것이 진단의 지름길이다.\n\n**Neutral zone(중립대)**: 혀와 협·순근의 힘이 상쇄되는 공간에 인공치와 연마면을 위치시키면 안정이 극적으로 개선된다. 심한 흡수·하악 불안정 증례에서 특히 유효한 고전 기법이다.\n\n</details>',
  },
  {
    title: 'CD 3-3 · 악간관계 채득 (Jaw Relation Record)',
    category: '총의치', order: 3,
    subjective: '- 특이사항, record base 착용감',
    objective: '**① Record base + occlusion rim 조정**\n- Record base 적합·안정 확인(불안정하면 이후 모든 기록이 무효)\n- **상악 rim**: 순측 지지로 입술 형태 회복, 절단연 위치 = 안정 시 상순 하방 **1–2 mm 노출**(연령·성별·상순 길이 고려)\n- **교합평면**: 전방은 **동공간선(interpupillary line)** 평행, 후방은 **Camper’s plane(비익–이주선)** 평행, 높이는 **retromolar pad 상방 1/2–2/3** 및 혀 외측연 수준\n- **하악 rim**: 상악과 균등 접촉, 폭·위치는 neutral zone 고려\n\n**② 수직 고경 (VDO)**\n- **생리적 안정위(rest position)** 계측 후 **freeway space <mark style="background:#fef08a">2–4 mm</mark>** 확보\n- 보조법: 발음(“S” 발음 시 closest speaking space 약 1–2 mm), 연하, 안모 비율·구순 폐쇄, 기존 의치·발치 전 자료\n\n**③ 수평 고경 (CR)**\n- 재현 가능한 **CR**로 유도: bimanual manipulation(Dawson) / 하악 유도 + 연하법 / **Gothic arch tracing**(가장 객관적·검증 가능)\n- 기록재: 왁스·ZOE·PVS bite registration — **경화 중 base가 들리지 않게**\n- **Facebow** 이전(반조절성 교합기)\n\n**④ 인공치 선택**\n- **크기·형태**: 안모형·성별·연령·구순선 참고, 상악 6전치 폭은 구각간 거리·안모 폭 기준\n- **색조**: 연령·피부·잔존치 없음 → 자연스러운 선택, 환자·보호자 함께 결정\n- **재질**: 레진(조정 용이, 마모 빠름) / 도재(내마모, 대합 조직·의치 마모 위험, 소음) / 고강도 복합레진\n- **교두 각도**: 해부학적(30–33°) / 반해부학적(20°) / 무교두(0°) — 치조제·악간관계에 따라 선택\n\n**⑤ 중심선·기준선 표시**: 정중선, 구각선, 고소선(smile line)',
    assessment: '- VDO 적절(**과대**: 저작통·구각 긴장·치조제 흡수 가속·clicking / **과소**: 심미 저하·구각염·저작 효율 감소)\n- CR 재현 가능, 교합평면·순측 지지 적절, 인공치 선택 근거 기록',
    plan: '- 인공치 배열 의뢰(교합양식 지정), 다음 예약(납의치 시적)\n\n<details><summary>🔬 근거 — 교합양식 선택</summary>\n\n체계적 고찰들의 종합에 따르면 **balanced · lingualized · canine-guided 사이에 만족도·저작 능력의 결정적 우열은 확립되어 있지 않다**. 다만 세 방식 모두 **monoplane(무교두 평면)보다는 우수한 경향**이며, **치조제 흡수가 심한 증례에서는 lingualized occlusion이 안정·저작 면에서 완만한 이점**을 보인다는 보고가 반복된다.\n\n실무 결론: “정답인 교합양식”을 찾기보다 **잔존제 상태·환자 신경근 조절·기공 여건**에 맞춰 선택하고, 어떤 방식이든 **양측성 동시 접촉과 정확한 CR**을 확보하는 것이 훨씬 중요하다.\n\n</details>\n\n<div class="warning"><b>⚠️ 이 단계의 오차는 복구되지 않습니다</b>record base가 불안정하거나 CR이 아닌 습관성 위치를 기록하면, 이후 시적·장착·조정에서 아무리 노력해도 <u>“씹을 때 어긋난다”</u>는 호소가 남습니다. base 안정 → VDO → CR 순서를 절대 건너뛰지 마세요.</div>',
  },
  {
    title: 'CD 3-4 · 납의치 시적 (Wax Try-in)',
    category: '총의치', order: 4,
    subjective: '- 심미 피드백(치아 색·크기·배열, 잇몸 색, 노출량), 발음 자각, **보호자 의견**',
    objective: '**① 기록 재검증 (가장 중요)**\n- **VDO** 재확인(freeway space), **CR** 재확인 — 폐구 시 좌우 균등 동시 접촉, 습관성 전방위 배제\n- 필요 시 **새 CR 기록 후 재마운팅**\n\n**② 심미**\n- 정중선(안모 정중선·인중과 일치), 절단연 노출량(안정 시 1–2 mm, 미소 시 치경부까지)\n- 순측 지지·비순각, smile line과 절단연 곡선 조화, **buccal corridor**\n- 치아 배열의 자연스러움(약간의 비대칭·회전 허용), 치은색·형태\n\n**③ 발음**\n- **F/V**: 상악 절단연이 하순 내면 습윤선에 접촉\n- **S**: 전방 공간 적절(휘슬음·혀짧은 소리 없음), closest speaking space\n- **Th**: 혀가 절단연에 살짝 접촉\n\n**④ 교합·기능**\n- 양측성 동시 접촉, 편심 시 균형(선택한 교합양식대로)\n- 연하·개폐 시 base 이탈 여부\n\n**⑤ 승인**\n- 거울로 환자 확인 + **보호자 동석 확인** 권장 → **서면 동의**',
    assessment: '- VDO·CR·심미·발음·교합 모두 acceptable, 환자 및 보호자 승인 확보\n- 수정 필요 항목은 **구체적 수치·부위로 특정**',
    plan: '- 온성(processing) 의뢰 — post-dam·연마면 형태·치은 색 지정\n- 다음 예약(장착)\n\n<div class="tip"><b>💡 심미 합의의 기술</b>“마음에 드세요?”보다 <u>“치아가 조금 더 길었으면 하세요, 지금이 좋으세요?”</u>처럼 선택지를 주고 물으면 훨씬 구체적인 답을 얻습니다. 이 단계에서 얻은 <b>서면 동의</b>는 장착 후 심미 분쟁을 막는 가장 확실한 장치입니다.</div>',
  },
  {
    title: 'CD 3-5 · 의치 장착 (Insertion)',
    category: '총의치', order: 5,
    subjective: '- 첫 착용 소감, 압박·통증 부위, 유지력 체감',
    objective: '**① 장착 전 검수**\n- 조직면 기포·돌기·예리한 변연 제거, 연마 상태, post-dam 형태 확인\n\n**② 적합**\n- **PIP**로 조직면 과압박점 특정 → 선택 삭제(완화부·mylohyoid ridge·이공부 주의)\n- **Disclosing wax**로 변연 과신장 확인 → 조정\n- 유지력 시험: 전방 견인·후방 견인, 개구·혀 운동 시 이탈 여부\n\n**③ 교합 — clinical remount 권장**\n- 구내 조정만으로는 **중합 수축 오차**를 잡을 수 없음 → 구내에서 새 CR 기록 → 교합기 재마운팅 → **선택 삭마(selective grinding)**\n<dl><dt>중심위 조기접촉</dt><dd>지지교두(상악 설측·하악 협측)는 보존하고 <b>대합 와(fossa)를 깊게</b>. 조기접촉이 교두 정점이면 정점 조정</dd><dt>작업측 간섭</dt><dd><b>BULL</b> — 상악 협측 교두 내사면 / 하악 설측 교두 내사면 조정</dd><dt>균형측 간섭</dt><dd>상악 설측 교두 내사면 또는 하악 협측 교두 내사면 조정</dd><dt>전방운동 간섭</dt><dd><b>DUML</b> — 상악 원심 사면 / 하악 근심 사면 조정</dd></dl>\n- 조정 후 **재연마**(거친 면은 치태·점막 자극)\n\n**④ 환자 교육 (서면 병행)**\n- 적응 기간: 타액 증가·구역·발음 어눌함은 **수일–수주 내 개선**\n- 저작: 처음엔 부드러운 음식, **양측 동시**로, 앞니로 자르지 말 것\n- 세척: 매 식후 물로, 하루 1회 의치용 솔·중성세제(**일반 치약 금지** — 연마제), 세정정 사용\n- **야간 제거 후 물에 보관** — 조직 회복·칸디다 예방\n- 통증 시 자가 삭제 금지, **내원 24시간 전부터 착용**하고 오기\n- 접착제는 보조 수단일 뿐, 남용 시 부적합을 은폐',
    assessment: '- 적합·유지·안정·교합 양호, 압박점 해소, 환자 착탈·관리법 습득',
    plan: '- **24시간 후 1차 조정** 필수 예약 → 이후 1주 → 1개월(3-6)\n- 3–6개월 후 점검, 이후 **연 1회 정기 검진**(점막·잔존제·교합·이장 필요성 + 구강암 선별)\n\n<div class="tip"><b>💡 왜 clinical remount인가</b>레진 중합 수축으로 온성 후 교합은 반드시 미세하게 어긋납니다. 흔들리는 의치를 구내에서 교합지로 조정하면 <u>움직인 상태의 오차까지 함께 새겨져</u> 오히려 나빠집니다. 교합기 위에서 조정해야 정확합니다 — Zarb/Boucher가 remount를 표준 절차로 두는 이유입니다.</div>',
  },
  {
    title: 'CD 3-6 · 장착 후 조정 (Post-insertion Adjustment)',
    category: '총의치', order: 6,
    subjective: '- **증상을 부위·시점·유발 상황으로 구체화**: 어디가, 언제부터, 무엇을 할 때\n- 착용 시간·식이·수면 시 착용 여부, 통증으로 못 낀 기간',
    objective: '- 의치 제거 후 **점막 병소 위치·형태 기록**(사진), 의치 조직면 대응 부위 표시\n- **PIP / disclosing wax**로 원인 부위 특정\n- 교합 재확인(조기접촉이 원인인 궤양은 조직면을 깎아도 재발)\n\n**증상별 감별 (핵심)**\n\n| 호소 | 흔한 원인 | 처치 |\n|---|---|---|\n| 치조제 정상부 궤양 | 조직면 과압박 · **교합 조기접촉** | PIP 조정 + 교합 remount |\n| 변연부 선상 궤양 | 변연 과신장 · 소대 압박 | disclosing wax로 변연 단축 |\n| 전반적 통증·작열감 | VDO 과대 · 지지 부족 · 구강건조 | VDO 재평가, 타액 검토 |\n| 유지 상실(빠짐) | 변연 폐쇄 실패 · post-dam 부족 · 흡수 | 이장 / post-dam 보강 |\n| 저작 시 흔들림 | 교합 불균형 · 인공치 위치(neutral zone) | remount, 배열 재검토 |\n| 볼·혀 씹힘 | 수평 피개 부족 · VDO 과소 | 협측 교두 조정, 피개 증가 |\n| 구역질 | 후방 변연 과신장·과두께, post-dam 과다 | 후연 조정, 점진 적응 |\n| 발음 이상(S) | 전방 공간 과소/과대, 구개부 두께 | 구개부 형태·절치 위치 조정 |\n\n- 3회 이상 조정에도 같은 부위 재발 → **의치 자체(적합·교합·설계)를 재평가**',
    assessment: '- 각 증상의 원인 규명(조직면 / 변연 / 교합 / VDO / 심리적 적응)\n- 조정으로 해결 가능 vs 이장·재제작 필요 판정',
    plan: '- 조정 시행 후 **재연마**, 궤양 치유까지 단기 재예약(3–7일)\n- 심한 궤양: 1–2일 의치 휴식 + 조직 회복 후 재장착, 필요 시 **tissue conditioner**\n- 통상 **24시간 → 1주 → 1개월** 일정으로 조정 완료 후 유지관리로 이관\n\n<div class="danger"><b>🚫 가장 흔한 오진</b>궤양이 보이면 반사적으로 그 부위 조직면을 깎는 것 — 원인이 <u>교합 조기접촉</u>이면 아무리 깎아도 재발하고 의치만 얇아집니다. 조직면을 깎기 전에 <b>항상 교합을 먼저 확인</b>하세요.</div>',
  },
  {
    title: 'CD 3-7 · 유지관리 — 이장·재제작·의치성 구내염',
    category: '총의치', order: 7,
    subjective: '- 사용 기간, 최근 변화(헐거움·통증·발음·심미), 접착제 사용 여부·양\n- 세척·야간 착용 습관, 전신 상태·약제 변화(구강건조)',
    objective: '- **점막**: 발적·궤양·증식조직(epulis fissuratum)·유두증식, **의치성 구내염 Newton 분류(I 국소 점상 / II 미만성 발적 / III 유두증식성)**, 구각염\n- **잔존 치조제**: 흡수 정도, 예리한 골융선, 이공 노출\n- **의치**: 적합(PIP), 유지·안정, 변연 길이, 인공치 마모(→ VDO 감소·교합 상실), 레진 균열·변색·다공성, 위생 상태(치석·바이오필름)\n- **교합**: VDO, CR 일치, 편측 접촉\n- 구강암 선별(무치악 고령 환자 정기 검진의 필수 항목)\n\n**처치 선택**\n<dl><dt>Reline(이장)</dt><dd>적합만 저하, 교합·심미·VDO 양호할 때. 직접(구내) 또는 간접(기공). 기능 인상 원리 적용</dd><dt>Rebase(개상)</dt><dd>인공치는 유지, 의치상 전체 교체 — 레진 열화·다회 이장 후</dd><dt>재제작</dt><dd>VDO 상실, 인공치 마모 심함, 교합관계 붕괴, 심한 흡수로 설계 변경 필요</dd><dt>임플란트 오버덴처 전환</dt><dd>하악 유지 불량이 반복될 때의 근본 해법</dd></dl>',
    assessment: '- 조직·의치·교합의 상태 판정, 처치 방침과 근거 기재\n- 의치성 구내염 시 **원인 층화**: 야간 착용 / 위생 불량 / 부적합(외상) / 칸디다 / 전신(당뇨·면역·구강건조)',
    plan: '- **의치성 구내염 프로토콜**: ① **야간 반드시 제거** ② 의치 기계적 세척 + 소독액 침적 ③ 조직면 부적합 교정(tissue conditioner) ④ 필요 시 국소 항진균제 ⑤ 전신 요인 검토 ⑥ **조직이 건강해진 뒤** 이장·재제작\n- 증식조직은 원인 제거 후에도 남으면 외과적 절제 후 인상\n- **연 1회 이상 정기 검진** 안내 — “의치는 완성으로 끝나는 치료가 아니라 관리가 필요한 장치”임을 명시\n\n<div class="warning"><b>⚠️ 조직이 나쁜 상태에서 뜬 인상은 나쁜 의치가 됩니다</b>발적·부종·증식조직이 있는 상태의 인상은 <u>회복 후 형태와 다릅니다</u>. tissue conditioner로 2–4주 조직을 회복시킨 뒤 최종 인상을 뜨는 것이 원칙입니다.</div>',
  },

  // ═══════════════ 4. 임플란트 보철 (Implant Prosthetics) ═══════════════
  {
    title: '임플란트 4-1 · 보철 주도 치료계획 (Prosthetically Driven Planning)',
    category: '임플란트', order: 1,
    subjective: '- 주소·기대치(심미 수준, 저작, 가철성 회피 희망), 치료 기간·비용 수용 범위\n- **위험 인자 문진**: 흡연(개비/일, pack-year), 조절되지 않는 당뇨, **치주염 병력**, bruxism, 항흡수제·방사선 치료력, 정기 검진 이행도\n- 결손 원인(치주 / 파절 / 근관 실패)과 인접치 상태',
    objective: '**① 보철 공간 (Restorative Space) — 먼저 확인**\n- **근원심 폭**: 단일 임플란트에서 인접치와 **각 1.5–2 mm** 이격 → 대구치 최소 ≈7 mm 이상 필요\n- **임플란트 간 거리 ≥3 mm**(인접 골정 보존)\n- **수직 공간**: 임플란트 플랫폼–대합까지 단관은 통상 **≥5–7 mm**, **오버덴처는 attachment별로 8–15 mm**(locator형 &lt; bar형)\n- 협설 폭·연조직 두께, 각화점막 폭(**≥2 mm** 권장)\n\n**② 진단 자료**\n- 마운팅 진단모형 + **diagnostic wax-up** → **방사선/수술 스텐트** 제작(보철 위치가 식립 위치를 결정)\n- **CBCT**: 골 높이·폭·밀도, 상악동 하연, 하치조신경·이공 위치·전방 loop, 설측 함몰\n- 교합: 대합 상태(자연치/보철/총의치), 유도양식, 파라펑션 징후\n\n**③ 위험도 평가**\n- **ITI SAC 분류**(Straightforward / Advanced / Complex)\n- **ITI 심미 위험도(ERA)**: 구순선, biotype, 치관 형태, 인접 수복물, 결손 폭, 연조직·골 결손, 감염력, 환자 기대치\n- 식립 시기(발치와 관련): **Type 1 즉시 / Type 2 조기(4–8주, 연조직 치유) / Type 3 조기(12–16주, 부분 골치유) / Type 4 지연(≥6개월)**\n- 하중 시기: **즉시(&lt;1주) / 조기(1주–2개월) / 통상(&gt;2개월)** (ITI consensus)',
    assessment: '- 보철 설계 확정(단관 / 브릿지 / 스크류 vs 시멘트 / 오버덴처 / 고정성 전악)\n- 필요한 식립 개수·위치·각도와 **골·연조직 증대 필요성**\n- SAC 난이도·심미 위험도, 성공 저해 인자 명시(흡연·치주염 병력·bruxism·위생)',
    plan: '- 구강외과/치주과 협진 의뢰 — **wax-up·스텐트·CBCT를 함께 전달**(“여기에 뼈가 있으니 여기 심자”가 아니라 “보철이 여기 필요하니 여기에 심자”)\n- 치료 순서·기간·비용·대안(FPD, RPD, 무처치) 설명 후 **informed consent**\n- 식립 후 치유 기간 예약 계획 수립\n\n<details><summary>📚 교과서 — 왜 “보철 주도”인가</summary>\n\nMisch는 임플란트 치료를 **최종 보철물의 형태·위치에서 역산**하는 과정으로 정의한다. 골이 있는 곳에 편하게 식립하면 보철 단계에서 **각도 보정 abutment, 과도한 cantilever, 청소 불가능한 emergence, 심미 실패**로 되돌아온다.\n\n**골질 분류(Misch D1–D4)** 와 **가용골 분류**는 식립 토크·치유 기간·하중 시기 결정에 쓰이며, D4(상악 후방 저밀도)에서는 치유 기간을 늘리고 즉시 하중을 피하는 것이 통례다.\n\n**Cantilever·힘 관리**: 임플란트는 치주인대가 없어 **완충과 고유수용성 감각이 없다**. 따라서 자연치보다 과부하에 취약하며, 파라펑션·긴 cantilever·불량한 crown-to-implant 비율은 **나사 풀림·파절·변연골 소실**로 직결된다.\n\n</details>',
  },
  {
    title: '임플란트 4-2 · 2차 수술 및 연조직 형성',
    category: '임플란트', order: 2,
    subjective: '- 식립 후 경과(동통·부종·감각이상 유무), 임시 보철 사용 여부·불편\n- 흡연·위생 상태 재확인',
    objective: '- **골유착 평가**: 타진음(청명한 금속음), 동요 없음, 방사선상 **투과대 없음**, 변연골 수준 기록, 필요 시 **ISQ**(일반적으로 70 이상이면 안정적으로 해석)\n- 2차 수술: 절개 디자인은 **각화점막을 협측으로 이동·보존**하는 방향으로(apically positioned flap 등)\n- **Healing abutment** 연결 — 직경·높이를 연조직 두께에 맞춰 선택\n- **각화점막 폭 &lt;2 mm** 이거나 전정이 얕으면 **연조직 이식(FGG/CTG)** 고려\n- 연조직 성숙 **2–3주** 대기, 심미부는 **임시보철로 emergence profile·papilla를 능동적으로 형성**\n- 인접치·대합 관계, 인접 접촉 공간, papilla 높이 평가',
    assessment: '- 골유착 양호(임상·방사선), 연조직 두께·각화점막 폭 평가, 심미 위험 재평가\n- 연조직 증대 필요 여부와 시기',
    plan: '- 위생 지침(임플란트 전용 브러시·치실, 저마모), 2–3주 후 인상 예약\n- 심미부: 임시 보철로 조직 유도 → 형태 확정 후 **customized impression coping**으로 복제\n\n<details><summary>🔬 근거 — 성공 기준과 papilla</summary>\n\n**성공 기준(Albrektsson, *IJOMI* 1986)**: 개별 임플란트의 임상적 동요 없음, 방사선 투과대 없음, **첫 해 이후 연간 변연골 소실 <mark style="background:#fef08a">&lt;0.2 mm</mark>**, 지속적 통증·감염·감각이상 없음. (첫 해 remodeling은 원 논문상 약 1.0–1.2 mm이며, 흔히 인용되는 “1.5 mm”는 오인용에 가깝다.)\n\n**Pisa 합의(Misch, *Implant Dent* 2008)** 는 단순 성공/실패가 아닌 **success / satisfactory survival / compromised survival / failure**의 4단계 건강 척도를 제시한다.\n\n**Papilla 예측(Tarnow, *J Periodontol* 1992)**: 접촉점–골정 거리가 **≤5 mm**이면 papilla가 거의 항상 채워지고, 6 mm에서 약 절반, 7 mm 이상에서는 드물다. 임플란트–자연치, 임플란트–임플란트 간에는 더 불리하므로 **심미부 papilla는 식립 위치·간격에서 이미 결정된다**.\n\n</details>\n\n<div class="tip"><b>💡 각화점막</b>각화점막이 2 mm 미만이면 위생 시 불편·출혈이 늘고 치태 조절이 어려워 <u>주위 점막염 위험이 증가</u>한다는 보고가 축적되어 있습니다. 보철을 시작하기 전이 이식하기 가장 좋은 시점입니다.</div>',
  },
  {
    title: '임플란트 4-3 · 인상 채득 (Implant Impression)',
    category: '임플란트', order: 3,
    subjective: '- 특이사항, healing abutment 주변 불편·출혈',
    objective: '- Healing abutment 제거 → 연조직 cuff 형태·건강 상태 확인(발적·출혈 시 원인 교정 후 진행)\n- **인상법 선택**\n<dl><dt>Pick-up (open tray)</dt><dd>다수·비평행 임플란트, 정확도 유리. 트레이 천공 필요, 경화 후 스크류 풀고 제거</dd><dt>Transfer (closed tray)</dt><dd>단일·개구 제한 증례에 편리. 코핑 재위치 오차 가능</dd><dt>디지털 (scan body)</dt><dd>단일·소수 유닛에서 유용. 다수·전악은 스캔 전략·검증 필요</dd></dl>\n- **다수 임플란트**: 인상 코핑을 **splinting**(레진 + 분할 후 재연결로 수축 보상) 또는 **verification jig** 제작\n- **인상 코핑 완전 안착을 방사선(PA)으로 확인** — 육안·촉진만으로는 불충분\n- **Custom abutment 설계 정보**: emergence profile(임시보철 복제), 변연 위치(**협측은 점막연하 ≤1 mm** 목표), 각도, 재료(Ti / Ti-base + 지르코니아)\n- 대합 인상, 악간관계, shade(사진 동반)\n- 인상 후 healing abutment 재연결',
    assessment: '- 인상 코핑 완전 안착(방사선 확인), 연조직 형태 정확 복제, 대합·악간 기록 적절',
    plan: '- 기공 의뢰(abutment 설계·보철 유형·유지 방식 명기), 다음 예약(abutment/crown 시적)\n\n<div class="danger"><b>🚫 단 하나의 치명적 오류</b>인상 코핑이 완전히 안착되지 않으면 <u>보철물 전체가 부정합</u>이 되고, 이는 나사 풀림·나사 파절·변연골 소실로 이어집니다. 특히 다수 연결 보철에서 <b>수동적 적합(passive fit)</b> 실패는 눈으로 보이지 않으므로, 방사선 확인과 verification jig를 습관화하세요.</div>',
  },
  {
    title: '임플란트 4-4 · Abutment & Crown 시적',
    category: '임플란트', order: 4,
    subjective: '- 특이사항, 임시보철 사용 경과',
    objective: '**① Abutment**\n- 방향·형태·변연 위치 확인 → 완전 안착 후 **방사선(PA)으로 gap 유무 확인**\n- **제조사 지정 토크로 체결** (통상 <mark style="background:#fef08a">20–35 Ncm</mark> — 시스템·나사 종류별 상이하므로 반드시 제조사 값 확인)\n- 연조직 압박에 의한 일시적 허혈(blanching)은 수분 내 회복되는지 확인\n\n**② Crown**\n- 적합(변연·내면), **인접 접촉**(shimstock·floss), 형태·emergence, 심미\n- **방사선으로 완전 안착 재확인**\n- **교합 (implant-protected occlusion)**\n  - 경(輕)교합 시 **약접촉 또는 무접촉**, 강교합 시 자연치와 **균등**\n  - 측방·전방 운동에서 **간섭 없음**(가능하면 자연치가 유도)\n  - 근원심 cantilever 최소화, 협설 폭 축소로 측방 응력 감소\n- 스크류 유지형이면 access hole 위치가 기능·심미를 해치지 않는지 확인',
    assessment: '- Abutment 적합·완전 안착·토크 완료, crown 적합·접촉·교합 acceptable\n- 수정 필요 항목 특정(접촉 과다, 형태, 색조, access 위치)',
    plan: '- (수정 시) 기공 재의뢰, 최종 장착 예약\n\n<details><summary>🔬 근거 — implant-protected occlusion은 “합의”이지 “증명”이 아니다</summary>\n\n경하중 약접촉·측방 무접촉 원칙은 Misch & Bidez의 **생역학적 개념**에서 출발했고 임상에서 널리 표준으로 통용된다. 다만 **특정 임플란트 교합양식이 생물학적·기계적 실패를 감소시킨다는 고수준 근거(RCT)는 확립되어 있지 않다**는 것이 리뷰들의 일관된 결론이다(Koyano & Esaki 2015; Sheridan 2016).\n\n실무적 함의: 교합양식 자체를 신봉하기보다 **과부하 요인(파라펑션, cantilever, 대합 상태, 임플란트 개수·직경)** 을 관리하는 것이 더 중요하며, 교합 조정은 <u>정기 리콜마다 재확인</u>해야 한다(자연치는 마모·정출로 움직이지만 임플란트는 그대로 있기 때문).\n\n</details>',
  },
  {
    title: '임플란트 4-5 · 최종 장착 및 유지관리 이관',
    category: '임플란트', order: 5,
    subjective: '- 특이사항, 임시 사용 경과, 최종 심미 확인',
    objective: '**① 유지 방식별 프로토콜**\n<dl><dt>스크류 유지형</dt><dd>제조사 지정 최종 토크로 체결 → <b>access hole 봉쇄</b>: 나사 머리 위 <u>PTFE(테플론) 테이프</u> 또는 코튼 + 광중합 복합레진. 재접근 가능성을 위해 위치 기록</dd><dt>시멘트 유지형</dt><dd>변연을 <b>가능한 한 얕게</b>(점막연하 ≤1 mm), 시멘트 최소량 도포, <u>copy abutment/실리콘 index로 잉여 시멘트 사전 제거</u>, 경화 후 스케일러·치실로 제거 + <b>방사선으로 잔사 확인</b></dd></dl>\n\n**② 최종 확인**\n- 완전 안착(PA), 인접 접촉, 교합(경하중 약접촉 · 편심 무간섭), 위생 접근성(치실·interdental brush 통과 여부)\n- 심미: 형태·색조·치은 조화\n\n**③ 기준 자료 확보 (Baseline)**\n- **장착 시점 PA를 baseline으로 저장** — 이후 변연골 변화 판독의 기준\n- 임플란트 시스템·직경·길이·abutment 종류·토크값·시멘트 종류를 **차트에 명시**(향후 수리·재접근에 필수)',
    assessment: '- 적합·교합·심미·위생 접근성 양호, 잉여 시멘트 없음, baseline 자료 확보',
    plan: '- **위생 교육**: 임플란트 전용 치실(수퍼플로스), interdental brush(금속 코팅 없는 것), 저마모 세정\n- **리콜 계획**: 초기 1개월 → 이후 **3–6개월**(위험군) 또는 6–12개월. 매회 **탐침·BOP·교합·나사 상태 확인**, 방사선은 임상 소견에 따라\n- 야간 가드(파라펑션 환자), 흡연 중단 상담\n\n<div class="danger"><b>🚫 잉여 시멘트 — 가장 많이 보고된 인재(人災)</b>Wilson(<i>J Periodontol</i> 2009)의 내시경 관찰에서 임플란트 주위 질환 부위의 <mark style="background:#fef08a">81%</mark>에서 치은연하 잉여 시멘트가 발견되었고, <b>제거 후 74%가 임상 징후 소실</b>을 보였습니다. 변연이 깊을수록 제거는 사실상 불가능하므로, 심부 변연이 불가피하면 <u>스크류 유지형 또는 맞춤 abutment로 변연을 얕게 올리는 것</u>이 정답입니다.</div>',
  },
  {
    title: '임플란트 4-6 · 임플란트 오버덴처 (IOD)',
    category: '임플란트', order: 6,
    subjective: '- 기존 총의치 불만(특히 **하악 유지·저작**), 착탈 능력·손재주, 위생 관리 능력\n- 비용·유지관리 부담(부속 교체 필요성) 수용 여부',
    objective: '- 무치악 평가(3-1과 동일) + **수직 보철 공간 계측** — attachment별 요구 공간이 다름(단독형 &lt; bar형; 통상 **8–15 mm** 범위, 시스템별 확인 필수)\n- **식립 위치**: 하악은 통상 **견치 부위(측절치–견치)** 2개, 상악은 지지·유지 요구가 커 **4개 이상**이 일반적\n- 임플란트 평행성·각도(각도 편차가 크면 attachment 마모 급증)\n- **Attachment 선택**\n<dl><dt>단독형(locator형·ball)</dt><dd>공간 요구 적음, 위생 유리, 착탈 쉬움. 유지력 캡을 <b>주기적 교체</b></dd><dt>Bar</dt><dd>임플란트 splinting으로 응력 분산·안정 우수, 공간·위생 부담 큼</dd><dt>Telescopic / milled bar</dt><dd>유지·안정 최상, 비용·기술 요구 최대</dd></dl>\n- 의치상 설계: **점막 지지 병용 여부**(bar/attachment가 모든 힘을 받지 않도록), 변연 폐쇄 유지\n- 교합: 총의치 원칙 준용(양측 균형 또는 lingualized)',
    assessment: '- 오버덴처 적응증 부합 여부, 임플란트 개수·위치·attachment 선택 근거\n- 유지관리 요구(부속 교체 주기, 이장 필요성) 명시',
    plan: '- Attachment 픽업(구내 직접법 — **완화용 스페이서·러버댐 격리로 언더컷 침투 방지**) 또는 기공 간접법\n- 유지력은 **환자가 스스로 착탈 가능한 최소 강도**로 시작해 단계적 조정\n- 교육: 매일 착탈·세척, **야간 제거**, attachment 주변 위생, 캡 마모 시 교체 안내\n- 리콜 3–6개월: 유지력·캡 마모·점막·변연골·의치상 적합 확인\n\n<details><summary>🔬 근거 — 하악 2-임플란트 오버덴처</summary>\n\n**McGill 합의(2002)** 와 이어진 **York 합의(2009)** 는, 통상 총의치에 만족하지 못하는 무치악 하악 환자에게 **2개 임플란트 지지 오버덴처를 1차 표준 치료로 고려할 것**을 권고했다. 무작위 연구들에서 통상 총의치 대비 **환자 만족도·저작 능력·삶의 질**의 향상이 반복적으로 확인된다.\n\n다만 **유지관리 부담은 증가**한다 — attachment 캡 교체, 의치상 이장, 파절 수리 등 보철적 합병증이 통상 총의치보다 흔하므로, **처음 상담 때 “관리가 필요한 장치”임을 반드시 설명**해야 한다.\n\n</details>',
  },
  {
    title: '임플란트 4-7 · 유지관리 및 임플란트 주위 질환',
    category: '임플란트', order: 7,
    subjective: '- 불편감·출혈·구취·배농, 나사 풀림 느낌·소리, 저작 시 이상\n- **위험 인자 재확인**: 흡연, 혈당 조절, 치주염 활성도, 위생 습관, 정기 검진 이행, 파라펑션',
    objective: '- **탐침**: 전용/플라스틱 프로브로 가벼운 힘(**≈0.25 N**) — **BOP·배농·탐침 깊이** 기록\n- **방사선**: 규격 PA를 **baseline과 비교**(장착 시점 대비 변연골 변화량)\n- 보철: 나사 풀림·파절, 도재 chipping, 접촉 상실(**식편압입 = 인접 자연치 이동 신호**), 교합 변화, 잉여 시멘트\n- 각화점막 폭, 치태·치석, 위생 접근성\n\n**진단 (2017 World Workshop 정의)**\n<dl><dt>임플란트 주위 건강</dt><dd>염증 징후 없음, BOP 없음, 초기 개조 이후 진행성 골소실 없음</dd><dt>임플란트 주위 점막염</dt><dd><b>BOP(+)</b>, 발적·부종 — <u>초기 개조를 넘어서는 골소실 없음</u> (가역적)</dd><dt>임플란트 주위염</dt><dd>BOP/배농 + <b>탐침 깊이 증가</b> + <b>초기 개조를 넘어서는 진행성 변연골 소실</b>. 기준 자료가 없으면 <u>골정이 임플란트 골내부 최상방으로부터 ≥3 mm 근단측 + PD ≥6 mm + BOP</u> 를 대리 기준으로 사용</dd></dl>',
    assessment: '- 진단명(건강 / 점막염 / 주위염)과 **원인 인자 특정**(치태, 잉여 시멘트, 과부하, 위생 불가능한 보철 형태, 각화점막 부족, 전신·흡연)\n- 골소실 정도·진행 속도, 임플란트 예후 판정',
    plan: '**단계적 처치 (Lang & Mombelli의 CIST/AKUT 개념)**\n1. **치태 조절·기계적 세정 + 위생 재교육** — 점막염은 이 단계에서 대개 가역적\n2. **국소 항균 요법**(클로르헥시딘 등) 병용\n3. **전신 항생제** (진행성 병소)\n4. **외과적 처치** — 절개 소파, 표면 정화(decontamination), 절제형(resective) 또는 재생형(regenerative) 술식\n5. **제거(explantation)** — 광범위 골소실·동요·수복 불가\n\n- **동반 필수 조치**: 잉여 시멘트 제거, **위생 가능한 형태로 보철물 수정/재제작**, 교합 과부하 교정, 금연 상담, 혈당 관리 협진\n- 리콜 간격 재설정(위험군 **3개월**), 매회 baseline 방사선과 비교\n\n<div class="warning"><b>⚠️ 예방이 유일하게 확실한 전략</b>임플란트 주위염은 <u>치료 결과가 예측 불가능</u>하고 재발이 흔합니다. 반면 <b>점막염 단계</b>는 치태 조절만으로 대부분 회복됩니다. 따라서 정기 리콜의 목적은 “주위염을 치료하는 것”이 아니라 <b>점막염 단계에서 잡는 것</b>입니다. 치주염 병력이 있는 환자는 임플란트 주위염 위험이 유의하게 높으므로 리콜 간격을 짧게 잡으세요.</div>',
  },

  // ═══════════════ 5. 임시·즉시의치 (Interim / Immediate) ═══════════════
  {
    title: '임시의치 5-1 · 임시 국소의치 장착 (Interim RPD)',
    category: '임시의치', order: 1,
    subjective: '- 내원 목적(심미 / 공간 유지 / 기능 / 적응 훈련 / 임플란트 대기)\n- **“임시” 보철임을 이해하는지 확인** — 기간·한계·최종 계획을 환자 언어로 재확인시킴\n- 심미·발음 기대 수준, 착탈 능력',
    objective: '- **유형**: interim RPD(acrylic ± wrought wire clasp) / flipper / 치료용 의치(treatment denture)\n- 알지네이트 인상 → 즉시 또는 익일 제작\n- 장착 조정: 조직면 적합(PIP), 변연 압박, 유지(clasp 조정), **교합 — 조기접촉 반드시 제거**, 심미·발음\n- **임플란트 대기 중이면 식립부 조직면을 충분히 완화(relief)** — 치유 기간 중 하중·압박은 골유착 실패·창상 열개 위험\n- 잔존치 접촉부 위생 확인(임시의치는 치태 정체가 특히 심함)',
    assessment: '- **잠정(임시) 보철**임을 명시하고 **목적을 특정**(심미 / 공간 유지 / 저작 / 적응 / 예후 불확실 지대치 관찰)\n- 유지·적합은 **임시 수준에서 acceptable**로 기록(최종 기준을 적용하지 않음)',
    plan: '- **확정 계획과 시기를 반드시 기재**(치유 후 확정 RPD / 임플란트 보철 / 이장)\n- 환자 지침: 저작 효율 제한, 딱딱한 음식 회피, **야간 제거**, 매 식후 세척, 파절 시 즉시 내원\n- Informed consent(임시성·한계·추가 비용), 조정 재내원 예약\n\n<div class="warning"><b>⚠️ 임시의치가 “영구화”되는 문제</b>편해졌다는 이유로 임시의치를 수년간 사용하면 <u>치조제 흡수·잔존치 이동·교합 붕괴·치태성 치주 파괴</u>가 진행됩니다. 차트에 <b>사용 예정 기간과 재평가 시점을 명시</b>하고, 리콜 때마다 최종 계획을 상기시키세요.</div>',
  },
  {
    title: '임시의치 5-2 · 즉시의치 (Immediate Denture)',
    category: '임시의치', order: 2,
    subjective: '- 발치 예정 부위·개수, 심미 요구(치아 없는 기간을 만들지 않으려는 목적)\n- 출혈성 소인·항응고제, 치유 지연 요인(당뇨·흡연·항흡수제)\n- **한계 이해 확인**: 시적 단계가 없으므로 심미·교합 예측성이 낮고, 흡수로 인해 **이장·재제작이 예정**되어 있음',
    objective: '**① 술 전 (Pre-extraction)**\n- 잔존치 상태·배열·색조를 사진·계측으로 기록(가능하면 발치 전 자료가 최종 심미의 기준)\n- 인상·악간관계 채득(잔존 전치가 있으면 이를 기준으로 VDO·정중선 결정)\n- **모형 수술(cast surgery)**: 발치 예정 치아를 모형에서 제거하고 치조제를 예상 치유 형태로 다듬어 배열\n- 후방 치아가 남아 있으면 **후방부는 통상 try-in 가능** → 가능한 범위에서 검증\n\n**② 발치·장착 당일**\n- 발치 → 필요 시 치조제 정형 → **즉시 장착**, 지혈 확인\n- 조정은 **최소한으로**(부종 상태이므로 과도한 조정은 후일 부적합 초래), 명백한 압박·과신장만 완화\n- 필요 시 **tissue conditioner / 연성 이장재** 적용\n\n**③ 술후 관리**\n- **첫 24시간 제거 금지** — 압박 드레싱 역할(지혈·부종 억제·창상 보호)\n- 익일 첫 제거·세척·조정 시행(술자 입회 하)',
    assessment: '- 발치와 위에 장착된 **이행기 보철**로, 치유·흡수에 따라 **이장 또는 재제작이 예정**됨을 명시\n- 지혈·창상 상태, 초기 적합·교합 평가',
    plan: '- **일정**: 익일(24시간) → 1주 → 2–4주 → 이후 월 단위 조정\n- **이장 시기**: 흡수는 발치 후 초기 수개월에 집중 → 조기 경성 이장은 곧 헐거워짐 → 통상 **3–6개월경 경성 이장(rebase)** 또는 확정 의치 제작(Tallgren 흡수 곡선 근거)\n- 술후 지침: 부드러운 음식, 온찜질 금지·냉찜질, 처방약 복용, 심한 출혈·통증·발열 시 즉시 연락\n- 통증·궤양 시 자가 삭제 금지\n\n<div class="danger"><b>🚫 24시간 규칙</b>즉시의치를 첫날 임의로 빼면 부종으로 재장착이 어려워지고 창상 보호 효과도 사라집니다. “아파도 내일 아침 진료실에서 처음 빼시는 겁니다”라고 <u>명확히, 반복해서</u> 설명하고 서면으로도 전달하세요.</div>',
  },
  {
    title: '임시의치 5-3 · 조직 조정 (Tissue Conditioning)',
    category: '임시의치', order: 3,
    subjective: '- 통증·발적 지속 기간, 의치 착용 시간(특히 **야간 착용 여부**), 세척 습관\n- 이전 조정 이력과 반응',
    objective: '- 점막 소견: 발적 범위·궤양·부종·유두 증식, **의치성 구내염(Newton I–III)**, 구각염\n- 원인 감별: 부적합(외상) / 교합 조기접촉 / 야간 착용 / 위생 불량 / 칸디다 / 전신(당뇨·구강건조·면역)\n- **적용**: 의치 조직면을 균등 삭제(약 1–2 mm 공간 확보) 후 **tissue conditioner**(가소제 함유 아크릴계) 도포 → 기능 운동 하에 성형\n- 동시에 **교합 조정**(조직면만 다루면 재발)\n- 재료는 시간이 지나면 경화·거칠어지고 칸디다 정착 → **3–7일 간격으로 교체**, 통상 **2–4주** 지속',
    assessment: '- 조직 손상의 원인 규명과 회복 정도 평가\n- 최종 인상·이장·재제작 가능 시점 판단(**조직이 건강해진 뒤**)',
    plan: '- 야간 제거 철저, 의치 소독·세척 재교육, 필요 시 항진균 치료·전신 요인 협진\n- 조직 회복 확인 후 **최종 인상 → 이장/재제작**\n- 재발 방지: 근본 원인(적합·교합·위생·전신) 교정 여부를 차트에 명시\n\n<div class="tip"><b>💡 왜 조직 조정이 먼저인가</b>염증으로 부어 있는 점막에서 뜬 인상은 <u>회복 후의 실제 형태와 다릅니다</u>. 그 인상으로 만든 의치는 다시 부적합이 되고, 다시 염증을 만드는 악순환이 생깁니다. <b>조직 조정 2–4주 → 최종 인상</b>이 정석입니다.</div>',
  },

  // ═══════════════ 6. 심미 보철 (Esthetic) ═══════════════
  {
    title: '심미 6-1 · 심미 진단 및 디자인 (Esthetic Analysis)',
    category: '심미', order: 1,
    subjective: '- **환자가 무엇을 불만스러워하는지 스스로 지목하게 할 것**(거울·사진 사용) — 술자가 보는 문제와 환자가 보는 문제는 자주 다름\n- 기대 수준·참고 이미지, 과거 심미 치료 경험과 불만\n- 색·형태·배열 중 **우선순위**, 최소 침습 선호 여부, 기간·비용\n- 파라펑션·산 노출·흡연·착색 음식 습관',
    objective: '**① 안모 분석 (Facial)**\n- 안모 정중선과 **치아 정중선 일치 여부**(경미한 불일치보다 **정중선 경사**가 훨씬 눈에 띔)\n- 동공간선·구각선과 절단연 평면의 평행성, 안모 비율, 측모(입술 지지)\n\n**② 치아–입술 분석 (Dentolabial)**\n- **안정 시 상악 절치 노출량** — 젊은 여성에서 더 크고 연령 증가에 따라 감소(대표 계측: Vig & Brundo)\n- **미소선(smile line)**: 절단연 곡선이 하순 상연 곡선과 조화하는지\n- **치은 노출량**: 미소 시 치은 노출 **3 mm 이상**이면 gummy smile로 인지되는 경향 → 원인 감별(수동적 맹출 지연 / 상악 수직 과성장 / 짧은 상순 / 과활성 거상근)\n- **Buccal corridor**, 상순 길이·이동량\n\n**③ 치아 분석 (Dental)**\n- 중절치 **폭:길이 비 ≈75–80%**, 인접치와의 비율(golden proportion은 참고 가이드일 뿐 절대 기준 아님)\n- **치은 zenith** 위치(중절치·견치는 원심측, 측절치는 중앙), 치은 라인 대칭\n- 절단연 형태·마모, 접촉점·incisal embrasure의 점진적 확대\n- 색: 명도(value) → 채도(chroma) → 색상(hue) 순으로 판단, 치경부–절단부 그라데이션, 특성(백반·균열·투명대)\n- **Biotype(얇음/두꺼움)** — 퇴축·회색 비침 위험 예측\n\n**④ 기록**\n- 규격 사진(정면·미소·측방·구내·역광), 진단 모형 마운팅, **diagnostic wax-up**\n- **Mock-up / APT(심미 예비 임시보철)**: wax-up을 구내에 실리콘 index로 옮겨 **삭제 전에 결과를 미리 보여주고 합의**',
    assessment: '- 심미 문제의 원인 분류 — **치아(색·형태·위치) / 치은(라인·노출·비대칭) / 골격(수직 과성장) / 입술(길이·이동)**\n- 필요한 학제 간 치료 판단: 교정 / 치주(치관연장) / 악교정 / 보철 / 미백 단독\n- **최소 침습 순서**: 미백 → 교정 → 접착 수복 → 베니어 → 크라운 (가능한 낮은 단계에서 해결)',
    plan: '- **Mock-up 기반 합의** → 사진 기록 → 치료계획 확정 → informed consent(한계·유지관리·재치료 가능성 포함)\n- 필요 시 협진 의뢰(교정·치주·구강외과)\n- 다음 예약(형성 또는 선행 치료)\n\n<details><summary>📚 교과서 — 심미는 “규칙”이 아니라 “위계”다</summary>\n\nFradeani(*Esthetic Rehabilitation in Fixed Prosthodontics*)와 Magne & Belser는 심미 분석을 **안모 → 치아–입술 → 치은 → 치아** 순의 위계로 접근한다. 개별 치아의 비율(golden proportion 등)은 **가장 마지막 단계**의 미세 조정 도구이며, 정중선 경사나 절단연 평면의 기울기 같은 **상위 요소의 오류를 하위 요소로 보정할 수 없다**.\n\n**Mock-up의 가치**: 삭제 전에 결과를 눈으로 확인시키는 것은 심미 분쟁을 예방하는 가장 강력한 수단이며, 동시에 **삭제량을 mock-up 표면 기준으로 계측**(APT 기법, Gürel)하게 해 <u>불필요한 치질 삭제를 줄인다</u>.\n\n</details>',
  },
  {
    title: '심미 6-2 · 라미네이트 베니어 — 형성 및 인상',
    category: '심미', order: 2,
    subjective: '- Mock-up 결과 동의 확인, 최종 형태·색 목표 재확인\n- 지각과민·파라펑션 이력',
    objective: '**① 적응증·금기 재확인**\n- 적응: 변색(미백 무반응), 형태 이상·왜소치, 경미한 총생·정중이개, 마모된 절단연, 다수 수복물 없는 법랑질 우세 치아\n- **상대적 금기**: 법랑질 부족(상아질 노출 광범위), 심한 파라펑션, 절단연 대합 과다 부하, 조절되지 않는 치주염, 비현실적 기대\n\n**② 형성 (mock-up 위에서 depth cut)**\n- **삭제량**: 치경부 **0.3 mm** · 중앙 **0.5 mm** · 절단측 **0.7–1.0 mm**, 절단연 연장 시 별도\n- **원칙: 가능한 한 법랑질 내에 머무를 것** — 접착 강도·변연 밀폐·장기 생존이 법랑질 접착에 좌우됨\n- **절단연 디자인**: window(절단연 보존) / feather / **butt joint(절단연 삭제 후 맞대기)** / overlap(설측 감싸기) — 마모·심미·강도에 따라 선택\n- 변연: **치은연 또는 그 직상방**, 인접부는 접촉점 직전까지(변색 방지·심미 이행), 모든 선각은 둥글게\n- 인접치 손상 방지(metal strip 보호)\n\n**③ 인상·기록**\n- 압배(가는 cord) 후 정밀 인상 또는 구강 스캔\n- **색조**: 지대치 색(stump shade)까지 함께 전달 — 베니어는 반투명해 하부 색이 비침\n- 사진: 편광·역광 포함, shade tab 동시 촬영\n\n**④ 임시**\n- Mock-up 형태의 bis-acryl 임시 — **spot etching**으로 소량 접착(제거 용이), 심미·발음 재확인 기회로 활용',
    assessment: '- 삭제량이 재료 요구치 충족, **법랑질 잔존 비율** 평가(접착 예후의 핵심), 변연 위치 적절\n- 절단연 디자인 근거 기재',
    plan: '- 기공 의뢰(재료: 장석계 / 리튬디실리케이트, 두께·투명도·stump shade 명기)\n- 다음 예약(시적·접착), 임시 관리 지침(앞니로 끊어 먹지 않기)\n\n<details><summary>🔬 근거 — 베니어의 생존율과 법랑질</summary>\n\n도재 라미네이트 베니어의 장기 생존율은 여러 코호트에서 **10년 90–95% 수준**으로 보고된다. 실패의 주요 양상은 **파절·탈락·변연 변색**이며, 일관되게 확인되는 예후 인자는 **접착면이 법랑질인가 상아질인가**이다 — 상아질 노출이 많을수록 탈락·미세누출 위험이 증가한다(Magne & Belser의 “bonded porcelain restoration” 개념).\n\n따라서 “형태를 얻기 위해 더 깎는” 접근은 즉각적인 심미를 주지만 장기 예후를 악화시킨다. **mock-up 표면에서 depth cut을 시행(APT)** 하면 최종 형태를 기준으로 최소 삭제가 가능하다.\n\n</details>',
  },
  {
    title: '심미 6-3 · 라미네이트 베니어 — 시적 및 접착',
    category: '심미', order: 3,
    subjective: '- 임시 사용 중 형태·색·발음 피드백, 최종 색 선호(더 밝게/자연스럽게)',
    objective: '**① 시적 (접착 전)**\n- 개별 적합 확인 → 인접부 접촉 조정 → **전체 동시 시적**으로 배열·정중선·절단연 곡선 확인\n- **Try-in paste**로 시멘트 색조 결정(가장 결정적 단계 — 반드시 환자 확인 및 사진 기록)\n- 시적 후 초음파 세척으로 paste 완전 제거\n\n**② 격리**\n- **러버댐 권장**(또는 retraction cord + 격리기구) — 습기 오염은 곧 실패\n\n**③ 도재 처리**\n<dl><dt>장석계(feldspathic)</dt><dd>HF <b>9.5% 약 60초</b> → 수세 → 초음파 세척 → 건조 → 실란 60초</dd><dt>리튬디실리케이트</dt><dd>HF <b>약 5% 20초</b> → 수세 → 초음파 세척 → 건조 → 실란 60초 (제조사 지침 우선)</dd></dl>\n- 실란 후 가온 건조로 용매 휘발, 필요 시 접착제 도포(광중합 전)\n\n**④ 치아 처리**\n- 법랑질 **37% 인산 30초**(상아질 노출부는 15초) → 수세·적정 건조 → 접착제 도포\n- (선택) 상아질 노출부는 형성 당일 **immediate dentin sealing**을 해두면 유리\n\n**⑤ 접착**\n- **광중합 전용 레진 시멘트**(색안정 우수) 또는 가온 컴포지트 — 이중중합형은 아민에 의한 변색 위험\n- 안착 → 잉여 시멘트 1차 제거(브러시·플로스) → **글리세린 젤 도포 후 최종 광중합**(산소저지층 제거)\n- 각 면 충분한 조사 시간 확보(도재 두께·투명도 고려)\n\n**⑥ 마무리**\n- 변연 잉여 제거(#12 blade·스케일러), 인접부 floss 통과 확인\n- 교합: CO 균등, **전방·측방 유도에서 베니어에 과도한 부하가 걸리지 않게** 조정 후 도재 연마 시스템으로 활택',
    assessment: '- 적합·색·형태·정중선·교합 양호, 잉여 시멘트 없음, 환자 승인',
    plan: '- **야간 가드 제작**(파라펑션·절단연 부하 증례에서는 사실상 필수)\n- 지침: 앞니로 딱딱한 것 끊지 않기(손톱·얼음·병뚜껑), 착색 관리, 연마제 강한 치약 회피\n- 리콜 6–12개월(변연·색·교합·치은)\n\n<div class="danger"><b>🚫 되돌릴 수 없는 단계</b>베니어 접착은 <u>제거가 사실상 불가능</u>합니다. 색은 <b>try-in paste 단계에서 환자와 함께</b> 결정하고 사진으로 남기세요. 접착 후 “조금 더 밝게”는 재제작을 의미합니다. 또한 습기 오염 한 번이 몇 년 뒤 변연 변색·탈락으로 나타나므로 격리에 타협하지 마세요.</div>',
  },
  {
    title: '심미 6-4 · 치아 미백 (Tooth Whitening)',
    category: '심미', order: 4,
    subjective: '- 변색 인지 시점·양상(전반적 / 국소 / 띠 형태), 원인 추정(연령·착색 음식·흡연·테트라사이클린·불소증·외상 후 실활)\n- 기대 수준, 지각과민 병력, 과거 미백 경험·부작용\n- 임신·수유 여부, 향후 보철 계획(**색 결정 시점에 영향**)',
    objective: '- 변색 유형 감별: **외인성(착색)** vs **내인성(연령·테트라사이클린·불소증·실활치)**\n- 우식·비수복 변연·균열·노출 상아질·퇴축 확인(**미백 전 반드시 처치** — 통증·자극 원인)\n- 기존 수복물·보철물 위치와 색 — **레진·도재는 미백되지 않음**(미백 후 색 불일치 → 재수복 필요성 사전 설명)\n- 초기 색조를 **shade tab + 규격 사진**으로 기록(before)\n- 실활치는 근관 충전 상태·치근단 병소 확인\n\n**방법**\n<dl><dt>자가 미백(가정형)</dt><dd>맞춤 트레이 + 저농도 과산화요소(전형적으로 10% 야간 착용) — 고전적 nightguard vital bleaching(Haywood & Heymann, 1989). 효과·안전성 근거 축적이 가장 두터움</dd><dt>진료실 미백</dt><dd>고농도 과산화수소 + 연조직 차단(치은 보호제). 빠른 초기 변화, 지각과민 빈도 높음. <b>국가·지역별 농도 규제 확인 필요</b></dd><dt>실활치 미백(walking bleach)</dt><dd>근관 충전부 상방에 <b>치조정 하방 차단층(GI 등)</b> 형성 후 과붕산나트륨 등 봉입·교체. <u>열촉매법은 외흡수 위험</u>으로 지양</dd></dl>',
    assessment: '- 변색 유형과 예상 반응성(**연령성·경도 착색 &gt; 테트라사이클린 회색대**), 필요 회차·기간\n- 지각과민 위험도, 기존 수복물 재수복 필요성',
    plan: '- 지각과민 대비: **질산칼륨·불소** 함유 제제 병용, 착용 시간 조절, 중단 후 회복됨을 설명\n- 결과는 **개인차·재발(relapse)** 이 있으며 습관(커피·흡연)에 따라 유지 기간이 달라짐 → 필요 시 touch-up\n- **보철·접착 수복은 미백 종료 후 최소 1–2주 뒤**에 색 결정 및 접착 — 잔류 산소가 레진 중합·접착 강도를 저하시킴\n- 결과 사진(after) 기록, 재평가 예약\n\n<div class="warning"><b>⚠️ 순서를 틀리면 다시 해야 합니다</b>① 미백 → ② 2주 대기 → ③ 최종 색 결정 → ④ 수복·보철. 이 순서를 지키지 않고 보철을 먼저 하면, 나중에 미백한 자연치와 색이 어긋나 <u>보철물을 다시 만들어야</u> 합니다. 반대로 미백 직후 접착하면 접착 실패 위험이 커집니다.</div>',
  },

  // ═══════════════ 7. 기타 (Adjunctive) ═══════════════
  {
    title: '기타 7-1 · 초진 상담 및 전신 위험도 평가',
    category: '기타', order: 1,
    subjective: '- 주소와 내원 동기, **환자가 원하는 결과**를 그대로 인용\n- 전신 병력(진단명·조절 상태·최근 검사치), **복용 약물 전체 목록**(일반의약품·건강기능식품 포함)\n- 알레르기(약물·라텍스·금속), 과거 마취·수술·출혈 경험, 입원력\n- 임신·수유, 흡연·음주, 최근 6개월 내 심혈관 사건\n- 치과 불안 수준, 이전 치과 경험의 부정적 요소',
    objective: '- 활력징후(필요 시 혈압·맥박), 전신 상태 관찰(호흡·부종·안색)\n- **ASA 신체상태 분류** 판정\n- 구외·구내 검사, 구강암 선별, 치주·우식·교합·보철 상태 전반\n- 필요한 방사선(선택 기준에 따라 최소한으로)\n\n**주요 위험군별 확인 사항**\n<dl><dt>심혈관</dt><dd>혈압 조절, 최근 심근경색·뇌졸중(선택적 처치 연기 기간), 항혈전제 종류</dd><dt>당뇨</dt><dd>HbA1c·공복혈당, 저혈당 대비(식사 여부 확인), 창상 치유·치주 예후에 직결</dd><dt>항흡수제·항혈관형성제</dt><dd>약제명·경로(경구/정주)·투여 기간·적응증(골다공증 vs 악성종양) → <b>MRONJ 위험 층화</b></dd><dt>항응고/항혈소판</dt><dd>통상 치과 처치에서 <b>임의 중단하지 않음</b>이 원칙(SDCEP) — 국소 지혈 준비, 필요 시 처방의 협의</dd><dt>감염성 심내막염 고위험</dt><dd>AHA 2021 기준 해당 시에만 예방적 항생제(amoxicillin 2 g, 30–60분 전)</dd><dt>두경부 방사선</dt><dd>선량·부위·시기 → ORN 위험, 발치·수술 전 협진 필수</dd><dt>구강건조</dt><dd>원인 약제·쇼그렌 → 우식 급증·의치 유지 저하, 불소·타액 대체제</dd></dl>',
    assessment: '- **ASA 분류 + 치과적 위험 요약**(출혈 / 감염 / 창상치유 / 응급 / 약물 상호작용)\n- 진료 가능 범위와 **협진·의뢰가 필요한 항목** 명시\n- 우선순위: 통증·감염 → 질환 조절 → 기능 회복 → 심미',
    plan: '- 필요한 내과 협진 의뢰서 발송(구체적 질문 형태로 — “발치 가능 여부” 보다 “현재 INR 및 중단 필요 여부”처럼)\n- 응급 상황 대비(약제·산소·모니터링), 예약 시간대 조정(당뇨 환자는 오전·식후)\n- 치료 계획 상담 → **문서화된 동의**\n- 정기 검진 주기 설정\n\n<div class="tip"><b>💡 문진의 핵심 질문</b>“지병 있으세요?”보다 <u>“지금 드시는 약을 전부 말씀해 주세요(약봉투·앱 화면도 좋습니다)”</u>가 훨씬 정확합니다. 골다공증 주사제, 항응고제, 면역억제제는 환자가 “지병”으로 인식하지 않는 경우가 매우 흔합니다.</div>',
  },
  {
    title: '기타 7-2 · 교합안정장치 (Occlusal Splint)',
    category: '기타', order: 2,
    subjective: '- 증상: 아침 턱 피로·두통, 저작 시 통증, 관절 잡음·잠김, 치아 시림·마모 인지\n- **이갈이 근거**: 동거인의 소리 청취(수면 이갈이의 유력한 단서), 낮 시간 이악물기 자각\n- 스트레스·수면의 질, 코골이·수면무호흡 의심 증상, 복용 약물(SSRI 등)\n- 통증 강도(NRS)·빈도·기능 제한, 기존 장치 사용 경험',
    objective: '- **DC/TMD 기반 검사**: 최대 무통 개구·최대 개구, 개구 편위·편향, 관절음(click/crepitus)의 시점, 저작근·관절 촉진 압통 부위 기록\n- 치아: 교모면·wear facet 위치와 대합 일치 여부, 지각과민, 파절·수복물 반복 파절, abfraction\n- 교합: CR–MIP 편위, 조기접촉, 편심 간섭, 유도양식\n- 필요 시 영상(파노라마 / 관절 이상 의심 시 추가 영상)\n- **감별**: 치성 통증, 부비동염, 신경병성 통증, 두통 질환 — TMD로 단정하기 전에 배제',
    assessment: '- 진단: **근육성(근막통) / 관절성(관절통·디스크 변위·관절염) / 혼합**, 이갈이(수면/각성)의 존재\n- 장치의 목적을 명시 — **치아 보호 / 근육 이완·통증 완화 / 진단적 시험(가역적)**\n- 이갈이 자체는 “질환”이라기보다 **행동/현상**이며, 장치는 원인 제거가 아니라 **보호·완화**임을 이해',
    plan: '**장치 설계 (안정형 splint 표준)**\n- **전악 피개(full-arch coverage)** — 부분 피개 장치는 미피개 치아의 정출·교합 변화 위험\n- 평탄한 교합면, **모든 대합 교두가 균등·동시 접촉**, 전방·측방에서 **견치 유도 램프**로 구치 이개\n- 통상 경질 아크릴, 두께는 최소 필요량(구치부 1–2 mm 수준)에서 시작\n- 상악 vs 하악은 증례·환자 편의로 선택\n\n**장착·조정**\n- 장착 시 교합 조정 → **1–2주 내 재조정**(근육 이완으로 하악 위치가 변함) → 이후 정기 점검\n- 사용 지침(주로 야간 착용), 세척·보관, 사용 일지\n- 통증 관리 병행: 자가 관리 교육(부드러운 식이, 온찜질, 이악물기 자각 훈련), 필요 시 물리치료·약물\n- **재평가 4–8주**: 증상 변화·장치 마모 양상 기록\n\n<details><summary>🔬 근거 — 스플린트를 어떻게 볼 것인가</summary>\n\n체계적 고찰들은 안정형 교합장치가 **일부 TMD 환자에서 통증을 완화**시키지만, **다른 보존적 치료(자가 관리 교육, 물리치료, 인지행동요법) 대비 명확한 우월성은 확립되지 않았다**고 정리한다. 또한 장치가 **이갈이 자체를 없애지는 못하며**, 주된 이득은 <u>치아·수복물의 마모 보호</u>와 근육 증상 완화다.\n\n**주의가 필요한 설계**: 전치부만 접촉하는 소형 장치(NTI 유형)를 <u>장시간·비감독</u> 사용하면 후방 치아 정출로 **개교합(open bite)** 이 발생한 증례들이 보고되었다. 사용 시 반드시 짧은 간격의 추적이 필요하다.\n\n**용어 정리**: 국제 합의(Lobbezoo 등)는 이갈이를 수면 이갈이와 각성 이갈이로 구분하고, 건강한 개인에서는 **질환이 아니라 근활동**으로 규정한다 — 치료 목표를 “이갈이 근절”이 아니라 **손상 예방과 증상 관리**로 잡아야 하는 이유다.\n\n</details>',
  },
  {
    title: '기타 7-3 · 지각과민 처치 (Dentin Hypersensitivity)',
    category: '기타', order: 3,
    subjective: '- 유발 자극(찬 것·단 것·칫솔질·바람), **지속 시간**(자극 제거 후 즉시 소실 = 지각과민 / 지속 = 치수염 의심)\n- 부위 특정 가능 여부, 시작 시점(치주 치료 후·미백 후·보철 후·마모)\n- 칫솔질 습관(강도·솔·치약), 산성 음식·역류',
    objective: '- **감별 진단이 먼저** — 우식, 치아 균열(cracked tooth), 파절, 결손 수복물, 이차우식, 치수염, 근단성 병소를 배제\n- 노출 상아질 위치: 치경부 마모·abfraction·퇴축부·**보철 변연 인접부**\n- 검사: 냉자극(반응 강도·지속), 탐침, 교합 접촉(과부하 부위), 투조·염색(균열), 필요 시 방사선·치수 검사\n- 교합 확인: 편심 간섭·조기접촉이 치경부 응력·과민의 기여 인자일 수 있음',
    assessment: '- 진단: 상아질 지각과민(**유체역학설** — 상아세관 내 액체 이동이 신경 자극) vs 치수 병변 vs 균열\n- 기여 인자 특정: 마모성 칫솔질 / 산 침식 / 퇴축 / 최근 처치(치주·미백·형성) / 교합 과부하',
    plan: '**단계적 접근 (원인 제거 → 저농도부터)**\n1. **원인 교정** — 칫솔질 방법·부드러운 솔, 산성 식품 후 즉시 칫솔질 회피, 역류 관리, 교합 간섭 제거\n2. **가정 요법** — 질산칼륨·불화주석·아르기닌 등 함유 지각과민 치약을 **최소 2–4주 지속 사용**(즉효 아님을 설명)\n3. **진료실 도포** — 고농도 불소 바니시, 옥살산염, 글루타르알데하이드/HEMA 제제, 상아질 접착제 도포(sealing)\n4. **수복** — 결손·마모가 큰 부위는 컴포지트 수복\n5. **불응성** — 치수 병변 재평가, 필요 시 근관치료(마지막 수단)\n\n- 보철 관련: 형성 후 과민은 대개 **수주 내 완화**되나, 임시보철 변연 부적합·임시시멘트 누출을 먼저 점검\n- 재평가 2–4주 후, 반응 없으면 진단 재검토(**균열 치아 누락이 가장 흔한 함정**)\n\n<div class="warning"><b>⚠️ “시리다”를 전부 지각과민으로 처리하지 마세요</b>자극 제거 후에도 통증이 <u>수 초 이상 지속</u>되거나, 저작 시 특정 교두에서 예리한 통증 후 이완통이 있으면 <b>비가역성 치수염 또는 균열 치아</b>를 먼저 의심해야 합니다. 지각과민제를 반복 도포하며 시간을 보내는 사이 치아가 갈라집니다.</div>',
  },
  {
    title: '기타 7-4 · 교합 재구성 진단 (VDO·전악 재수복)',
    category: '기타', order: 4,
    subjective: '- 주소: 마모·심미 저하·저작 곤란·반복 파절, 진행 속도(사진 비교)\n- **마모 원인 문진**: 이갈이·이악물기, 산 노출(역류·구토·탄산·감귤·와인), 연마성 습관, 직업\n- 기존 치료 이력과 실패 양상, 기대치·비용·기간 수용 범위',
    objective: '- **마모 정도·분포 기록**(TWI 등 지수, 규격 사진, 모형 보관) — **활성도 판단이 핵심**(진행 중인지, 정지되었는지)\n- 마모 양상 감별: **교모(attrition, 대합면 일치·평탄)** / **침식(erosion, 컵 모양·수복물이 솟아 보임)** / **마모(abrasion, 치경부 쐐기)**\n- **VDO 평가**: 안모 비율, 안정위–교합위 차(freeway space), 발음(closest speaking space), 기존 사진과 비교\n  - **중요**: 치아 마모가 있어도 **치조 보상성 정출(dentoalveolar compensation)** 로 VDO가 유지된 경우가 많다 → 마모량 = VDO 감소량이 아님\n- 수복 공간 부족 여부, 대합·교합평면·전방유도 상태\n- 교합기 마운팅(**facebow + CR record**) + **진단 wax-up**으로 필요한 VDO 증가량·공간 산출\n- TMJ·근육 상태(재구성 전 안정 확인)',
    assessment: '- 진단: 마모의 원인·활성도, **VDO 상실 여부(실제 상실 vs 보상 유지)**, 수복 공간 부족 정도\n- 재구성 필요 범위(국소 / 분악 / 전악)와 목표 VDO·전방유도 설계\n- 위험: 파라펑션 지속 시 재파절, 근관 노출 가능성, 비용·기간',
    plan: '**단계적·가역적 검증 절차 (핵심 원칙)**\n1. **원인 조절** — 산 노출 차단(내과 협진·식이), 파라펑션 관리\n2. **가역적 시험**: 목표 VDO를 반영한 **교합안정장치 또는 시험 임시보철**로 **4–8주** 적응·증상 관찰\n3. **Wax-up → mock-up/임시보철**로 심미·발음·기능 검증(환자 동의)\n4. 검증된 형태를 **최종 보철로 복제**(silicone index·CAD 복제)\n5. **유지관리**: 야간 가드, 정기 리콜, 원인 재발 감시\n\n- **공간 확보 대안**: VDO 증가 / 교정적 압하·정출 / **Dahl 개념**(국소 상승 후 자연 재접촉 유도) / 치관연장술 — 각각의 적응증과 한계 비교 후 선택\n- Informed consent: 비가역적 치질 삭제 범위, 실패·재치료 가능성, 유지관리 부담 명시\n\n<details><summary>📚 교과서 — VDO 증가는 얼마나 안전한가</summary>\n\n임상 문헌은 **적정 범위의 VDO 증가는 대부분의 환자가 수주 내에 적응**하며, 지속적인 근육·관절 증상을 유발한다는 근거는 약하다고 정리한다(Dawson; Okeson). 그럼에도 원칙은 변하지 않는다 — **필요한 최소량만, 가역적 장치로 먼저 검증한 뒤** 최종 보철로 옮긴다.\n\n가장 흔한 실수는 <u>“마모된 만큼 올리면 된다”</u>는 계산이다. 치조 보상성 정출로 VDO가 유지된 증례에서 마모량만큼 VDO를 올리면 과대 VDO가 되어 저작통·심미 실패를 만든다. **freeway space와 발음, 안모**로 검증하고, 공간이 부족하면 VDO만이 아니라 **교정·crown lengthening·Dahl** 을 함께 저울질해야 한다.\n\n</details>',
  },
  {
    title: '기타 7-5 · 보철 정기 리콜 및 유지관리',
    category: '기타', order: 5,
    subjective: '- 지난 방문 이후 변화: 불편·통증·시림, 보철물 느낌(높다·끼인다·흔들린다), 파절·탈락 경험\n- 위생 습관(칫솔·치실·치간칫솔 사용 빈도), 야간 가드 착용 여부\n- 전신·복약 변화(구강건조·골다공증 약제 시작 등)',
    objective: '**① 위험도 재평가**\n- 우식 위험(타액·식이·불소 노출), 치주 위험(흡연·당뇨·병력), 파라펑션, 임플란트 병력\n\n**② 구강 검진**\n- 연조직·구강암 선별, 치주(부분/전악 probing·BOP·퇴축), 우식(특히 **보철 변연부**)\n- **보철물 점검** —\n  - 크라운/브릿지: 변연 적합·이차우식, 도재 chip, pontic 하방 위생·조직, 접촉 상실(식편압입)\n  - 임플란트: **BOP·PD·배농**, 나사 풀림, 잉여 시멘트, baseline 대비 변연골, 교합 변화\n  - 가철성: 적합·유지·변연, 점막 병소, 인공치 마모, 클래스프 상태, **이장 필요성**\n  - 교합장치: 마모 양상(이갈이 활성도 지표), 적합, 균열\n- **교합**: 새 조기접촉·간섭(자연치 마모·이동으로 시간이 지나면 반드시 변함), 마모면 변화\n\n**③ 영상**\n- 임상 소견·위험도에 따라 선택적으로(무증상 저위험군에 일률적 촬영은 지양), 임플란트는 **baseline 비교 가능한 규격 촬영**',
    assessment: '- 각 보철물의 상태 등급과 **조치 필요 항목**(관찰 / 조정 / 수리 / 재제작)\n- 위험도에 따른 **다음 리콜 간격 재설정**(저위험 12개월 / 중등도 6개월 / 고위험·임플란트·가철성 3–6개월)',
    plan: '- 전문가 치면세정·바이오필름 제거(**임플란트·도재에는 저마모 기구·파우더** 사용)\n- 불소 도포(우식 고위험), 위생 재교육(도구를 실제로 사용해 보게 할 것)\n- 발견된 문제 처치 예약, 교합 조정\n- 다음 리콜 예약 확정 + 변화 시 즉시 내원해야 할 **경고 신호** 교육(보철물 흔들림, 잇몸 부종·출혈·냄새, 파절, 통증)\n\n<div class="tip"><b>💡 리콜이 보철 성공률을 만든다</b>보철물의 장기 생존율 데이터는 대부분 <u>정기 관리가 이루어진 코호트</u>에서 산출된 값입니다. 같은 크라운·임플란트라도 리콜 없이 방치되면 생존율은 문헌 수치와 전혀 다릅니다. <b>“보철은 완성이 아니라 시작”</b>이라는 설명을 장착 당일과 매 리콜마다 반복하세요.</div>',
  },
];

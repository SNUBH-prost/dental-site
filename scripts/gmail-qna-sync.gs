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
    '당신은 치과 보철과 교수이자 해당 분야 KOL(Key Opinion Leader)입니다.\n' +
    '전공의가 보내온 임상 질문에 대해 **대학원 교재 챕터 수준**으로 종합 정리를 작성하세요.\n\n' +

    '## 분량 및 깊이 요구사항 (반드시 준수)\n' +
    '- 전체 분량: **최소 3,000단어** (한국어 기준). 짧게 끝내지 말 것.\n' +
    '- 각 섹션: 최소 3~5문단. 단순 bullet 나열 금지 — 설명·근거·연결이 있는 **서술형 문단**으로.\n' +
    '- 기전 설명: 분자·세포 수준까지 (어떤 효소/단백질이 어떤 기질에 작용해서 어떤 결과가 나오는지 구체적으로)\n' +
    '- 임상 프로토콜: 각 step마다 "왜 그렇게 하는가"의 근거를 반드시 포함\n' +
    '- 논란·미해결 문제: 반드시 포함. "아직 결론이 없다"는 것 자체가 중요한 임상 지식\n' +
    '- 수치·통계: 알고 있는 것은 구체적으로 기재, 불확실한 것은 "[확인 필요]" 표시\n\n' +

    '## 문체 원칙 (매우 중요)\n' +
    '- **번역투 절대 금지**: "이것은 ~에 의해 야기됩니다", "~하는 것이 중요합니다" 같은 직역체 금지\n' +
    '- 한국 치과대학 교수가 전공의에게 직접 강의하듯이 자연스럽게 작성\n' +
    '- 전문 용어는 영문 병기하되, 문장 흐름은 자연스러운 한국어로\n' +
    '- 수동태보다 능동태, 명사화보다 동사 중심 문장 선호\n\n' +

    '## 출력 형식\n' +
    '### 1. 개념과 정의\n' +
    '### 2. 역사적 발전 과정\n' +
    '### 3. 작용 기전 (소제목으로 세분화, 분자 수준까지)\n' +
    '### 4. 임상 프로토콜 — Step by Step (각 step에 근거 포함)\n' +
    '### 5. 근거 — 무엇이 입증되었나 (in vitro / RCT / systematic review / 한계)\n' +
    '### 6. 특수 상황 / 응용\n' +
    '### 7. 임상 의사결정 — 언제, 왜\n' +
    '### 8. 핵심 Take-home messages\n' +
    '### 9. 주요 참고문헌\n' +
    '### 10. 관점별 질문 (총 20개 이상)\n\n' +

    '## 근거 원칙 (가장 중요 — 반드시 준수)\n' +
    '**작성하는 모든 내용은 논문 또는 교과서에 근거해야 한다.**\n' +
    '- 수치, 기전 설명, 임상 권고, 비교 데이터 등 모든 서술은 출처가 있는 내용만 작성\n' +
    '- 근거가 있는 내용: 논문/교과서 출처를 문장 끝에 간략히 표시 (예: (Magne 2005), (Rosenstiel 교과서))\n' +
    '- 근거가 불확실한 내용: 아예 쓰지 말 것. 쓰고 싶다면 반드시 "이 부분은 문헌에서 확인 필요" 형태로만\n' +
    '- **절대 금지**: 근거 없이 그럴듯하게 들리는 내용 서술, 없는 논문 만들기, 확인되지 않은 수치 제시\n\n' +

    '## 참고문헌 원칙\n' +
    '- 실제 존재하는 논문(저자·연도·저널)만 기재.\n' +
    '- 불확실하면 "[확인 필요]" 표시. 없는 논문 만들지 말 것.\n\n' +

    '## 관점별 질문 — 절대 원칙\n' +
    '❌ 절대 금지: "~의 기전은?", "~의 적응증은?", "~란 무엇인가?", "~의 장점은?" (교과서 첫 페이지 수준 금지)\n' +
    '✅ 목표: 세미나에서 교수가 전공의를 당황하게 만드는 수준의 질문. 여러 변수가 충돌하거나, 논란이 있거나, 일반적 통념을 뒤집는 질문.\n' +
    '  ❌ "OIL을 제거해야 하나요?" → ✅ "IOS digital workflow에서 glycerin re-cure 없이 scan하면 실제로 impression accuracy에 문제가 생기는가?"\n' +
    '  ❌ "MMP란 무엇인가요?" → ✅ "MMP 활성화가 self-etch에서도 etch-and-rinse와 동일하게 우려되는가? 아니라면 self-etch IDS의 anti-degradation 이점이 줄어드는가?"\n' +
    '카테고리: [보철] [외과] [치주] [재료] [술식] [세미나 방어용] 각 3~4개, 합산 20개 이상.\n\n' +
    '한국어로 작성, 전문 용어는 영문 병기.';

  // Few-shot: IDS 예시 (GPT가 목표 수준을 정확히 인식하도록)
  const fewShotUser = 'Immediate Dentin Sealing (IDS) 에 대해 종합 정리해줘';

  const fewShotAssistant =
    '## Immediate Dentin Sealing (IDS) — 종합 정리\n\n' +

    '### 1. 개념과 정의\n' +
    'Immediate Dentin Sealing (IDS)은 indirect restoration을 위한 치아 삭제(prep) 직후, 인상 채득 이전에 노출된 dentin 표면에 dentin bonding agent(±flowable)를 즉시 도포·중합하여 hybrid layer를 미리 성숙시켜두는 술식입니다.\n' +
    '이와 대비되는 개념이 Delayed Dentin Sealing (DDS) — 즉, 통상적인 protocol처럼 final cementation 시점에 dentin bonding을 시행하는 방식입니다.\n' +
    '핵심 차이는 bonding 시점과 그로 인한 hybrid layer의 성숙 환경입니다. Indirect 수복물에서 final cementation은 보통 prep 후 1–2주 뒤에 이루어지는데, 이 기간 동안 dentin이 어떤 상태로 유지되느냐가 long-term 성공에 직접적인 영향을 미칩니다.\n\n' +

    '### 2. 역사적 발전 과정\n' +
    'Pashley와 동료들이 1992년 dentin bonding agent를 치아 삭제 직후 적용하면 dentin permeability가 유의하게 감소한다는 것을 발견했고, 이것이 "dentin pre-hybridization"이라는 개념의 출발점이었습니다.\n' +
    'Paul과 Schärer는 1997년 "dual bonding technique"을 제안했는데, 이는 prep 시점과 final cementation 시점 두 번에 걸쳐 bonding을 시행하는 방식이었습니다.\n' +
    'Pascal Magne(2005)가 이 개념을 체계화하면서 "Immediate Dentin Sealing"이라는 용어로 정립했고, J Esthet Restor Dent와 J Prosthet Dent에 연이은 논문을 발표하면서 현재의 protocol이 자리잡았습니다.\n\n' +

    '### 3. 작용 기전\n\n' +
    '#### 3.1 Fresh dentin substrate와 Hybrid layer 성숙\n' +
    '치아 삭제 직후의 dentin은 saliva, blood, sulcular fluid 등에 의해 오염되지 않은 신선한 상태이며, collagen network이 노출되어 있어 primer와 resin이 최적의 wetting과 infiltration을 보입니다. 반면 DDS protocol에서는 provisional 기간 동안 dentin이 temporary cement, oral fluids, 미세 박테리아에 노출됩니다.\n' +
    'Adhesive가 final cementation보다 훨씬 일찍 중합되기 때문에 resin network이 충분히 성숙할 시간을 갖게 됩니다. 이는 mechanical property와 interfacial stability 모두를 향상시킵니다.\n\n' +

    '#### 3.2 Polymerization stress의 decoupling\n' +
    'DDS에서는 dentin bonding과 resin cement의 polymerization shrinkage가 거의 동시에 발생하면서, 그 stress가 미성숙한 hybrid layer에 직접 전달됩니다. 반면 IDS에서는 hybrid layer가 이미 완전히 polymerize되어 있는 상태이기 때문에, final cementation 시점의 shrinkage stress가 이 pre-cured layer에 의해 일부 흡수·분산되어 interfacial strain이 최소화됩니다. 이를 stress-absorbing layer(elastic cushion) 개념이라고도 부릅니다.\n\n' +

    '#### 3.3 MMP 매개 hybrid layer degradation의 억제\n' +
    'Matrix metalloproteinase(MMP) — dentin 내부에 존재하는 zinc/calcium 의존성 endogenous protease — 는 phosphoric acid etching 과정에서 활성화되어 hybrid layer 내 collagen fibril을 시간이 지남에 따라 가수분해합니다. IDS는 prep 직후 안정적인 resin seal을 제공함으로써 MMP 활성을 제한하고 collagen degradation 진행을 지연시킬 수 있습니다. DDS에서는 dentin이 노출된 채로 1–2주 이상 유지되면서 MMP-mediated degradation이 최대화되는 시간이 주어지는 셈입니다.\n\n' +

    '#### 3.4 Postoperative sensitivity 감소\n' +
    'Pashley(1992)는 얕은 cavity에서도 ~20,000개, 깊은 cavity에서는 최대 ~40,000개의 dentinal tubule이 노출된다고 보고했습니다. IDS는 이 tubule을 prep 시점에 즉시 봉쇄함으로써 provisional cement, oral debris, moisture에의 노출을 차단합니다.\n\n' +

    '### 4. 임상 프로토콜 — Step by Step\n\n' +
    '**Step 1. Tooth preparation**\n' +
    '원하는 형태로 prep을 완료한 뒤, 충치 및 기존 수복물을 모두 제거합니다. Desiccation은 반드시 피해야 합니다 — collagen network이 collapse되면 primer infiltration이 차단됩니다.\n\n' +

    '**Step 2. Isolation**\n' +
    'Rubber dam isolation이 standard입니다. Saliva, sulcular fluid, blood에 의한 minor contamination만으로도 adhesive wettability와 polymerization이 disrupt됩니다. Hemostatic agent를 사용했다면 residue가 monomer polymerization을 방해하므로 완전히 rinse해야 합니다.\n\n' +

    '**Step 3. Adhesive system 선택 및 적용**\n' +
    '3-step etch-and-rinse (예: Optibond FL)가 IDS gold standard: 35–37% phosphoric acid 15초 → rinse, moist bonding → primer active rubbing → bonding resin air-thin, light cure.\n' +
    'Filled adhesive를 사용하는 이유: cured film이 더 두껍고 mechanical robustness가 좋아 이후 surface conditioning(airborne abrasion 등)에도 견딥니다.\n\n' +

    '**Step 4. Flowable composite coating (권장)**\n' +
    '두께 약 0.5 mm의 flowable composite을 cured adhesive 위에 도포하고 light cure합니다. Unfilled/lightly filled adhesive system에서 특히 중요하며, micro-void를 메우고 oxygen inhibition으로 인한 약점을 보강합니다.\n\n' +

    '**Step 5. Oxygen-Inhibition Layer (OIL) 제거 — 핵심**\n' +
    '광중합된 adhesive 표면에는 oxygen에 의해 중합이 억제된 sticky uncured monomer layer가 남아 있습니다. 이 OIL이 남으면: (1) PVS impression material이 OIL에 결합·tear 발생, (2) resin-based provisional이 OIL에 bonding되어 제거 어려움.\n' +
    'OIL 제거: Glycerin gel 도포 후 추가 10초 light cure (가장 권장) → alcohol-soaked cotton wiping → pumice slurry polishing.\n\n' +

    '**Step 6. Provisional restoration**\n' +
    'Non-eugenol cement 필수. Eugenol은 free radical scavenger로 작용하여 final cementation 시 resin cement의 polymerization을 방해합니다. IDS surface 위에 glycerin gel 또는 vaseline을 얇게 도포한 뒤 provisional 제작 시 unwanted adhesion을 방지할 수 있습니다.\n\n' +

    '**Step 7. Final cementation — Surface refreshing**\n' +
    'Provisional 제거 후 IDS surface cleaning 필수. Airborne particle abrasion (50 μm Al₂O₃, low pressure), phosphoric acid cleansing etch, pumice polishing 등이 효과적입니다. 과도한 conditioning은 IDS layer 자체를 제거할 수 있어 주의가 필요합니다.\n\n' +

    '### 5. 근거 — 무엇이 입증되었나\n\n' +
    '**In vitro bond strength**\n' +
    '다수의 laboratory study에서 IDS가 DDS 대비 microtensile bond strength를 약 20–30% 향상시킨다고 보고합니다. Thermocycling과 long-term water storage 같은 aging 조건 하에서 IDS가 hydrolytic degradation과 nanoleakage에 더 잘 견디는 것으로 나타났습니다.\n\n' +
    '**임상 결과**\n' +
    '- Gresnigt et al.(2019, Dent Mater) — 11-year prospective trial, ceramic laminate veneer에서 IDS의 우수한 임상 성능 보고\n' +
    '- van den Breemer et al.(2021, Clin Oral Invest) — 765개의 partial glass-ceramic posterior restoration 평가, 우수한 결과\n' +
    '- Alghauli et al.(2024, J Prosthet Dent) systematic review: IDS 그룹 survival rate 96.4–100% vs 비IDS 81.8–96.7%, postoperative sensitivity 유의하게 감소 (P<.05)\n\n' +
    '**그러나 — 문헌의 한계**\n' +
    'van den Breemer et al.(2019, Oper Dent)의 RCT 결과는 단기 outcome에서 IDS와 DDS 간 유의한 차이를 발견하지 못했습니다. Evidence의 상당 부분이 in vitro이고, 임상 환경의 salivary contamination, pulpal fluid pressure, operator variability 등을 완전히 재현하지 못한다는 methodological 한계가 있습니다.\n\n' +

    '### 6. 특수 상황 / 응용\n\n' +
    '**Endodontically treated tooth — IPDS 개념**\n' +
    '최근 Immediate Pre-endodontic Dentin Sealing (IPDS) 개념이 제안되고 있습니다. Endodontic treatment 시작 전 dentin sealing이 bond strength를 향상시킬 수 있다고 보고되었으나, 아직 evidence가 제한적입니다. Non-vital tooth에서 outward pulpal fluid pressure가 없어 adhesive interaction이 다를 수 있고, irrigant나 sealer contamination이 변수가 됩니다.\n\n' +
    '**Digital workflow 통합**\n' +
    'IOS 기반 fully digital workflow에서는 PVS와 OIL의 interaction 우려는 사라집니다. 다만 scan quality를 위해 glycerin re-cure나 pumice polishing으로 sealed surface를 처리하는 것이 권장됩니다.\n\n' +

    '### 7. 임상 의사결정 — 언제 IDS를 해야 하는가\n\n' +
    '**강하게 권장:**\n' +
    '- Indirect adhesive restoration 예정 (inlay, onlay, partial crown, veneer, adhesive bridge)\n' +
    '- Deep preparation — pulp에 가까운 prep\n' +
    '- Provisional 기간이 길어질 것이 예상되는 경우 (다수 unit, complex full-mouth rehab)\n' +
    '- Postoperative sensitivity 위험이 높은 환자 (gingival recession, exposed root surface)\n' +
    '- Bonded ceramic restoration (lithium disilicate, leucite-reinforced)\n\n' +
    '**이득이 상대적으로 적은 상황:**\n' +
    '- Pure enamel margin의 minimal prep veneer\n' +
    '- Non-vital tooth의 cuspal coverage crown\n' +
    '- Provisional 기간이 매우 짧은 경우\n\n' +

    '### 8. 핵심 Take-home messages\n\n' +
    '1. IDS는 "한 가지 술식"이 아니라 protocol 전체 — adhesive 선택, isolation, OIL 처리, provisional cement 선택, cementation 시점의 surface conditioning까지 모두 일관되게 관리해야 효과가 납니다.\n' +
    '2. 3-step etch-and-rinse + filled adhesive (Optibond FL)가 가장 robust한 조합.\n' +
    '3. Glycerin re-cure로 OIL 제거는 생략하지 말 것 — impression tear, provisional contamination, final bond 감소가 모두 발생합니다.\n' +
    '4. Non-eugenol provisional cement는 절대 원칙.\n' +
    '5. Evidence는 long-term survival과 sensitivity 감소에 강력하나, marginal adaptation/microleakage 개선은 in vitro에서 일관되지 않습니다 — 세미나에서 질문 받으면 솔직하게 인정해야 합니다.\n\n' +

    '### 9. 주요 참고문헌\n\n' +
    '- Magne P. Immediate dentin sealing: a fundamental procedure for indirect bonded restorations. J Esthet Restor Dent. 2005;17(3):144–154.\n' +
    '- Magne P, Kim TH, Cascione D, Donovan TE. Immediate dentin sealing improves bond strength of indirect restorations. J Prosthet Dent. 2005;94(6):511–519.\n' +
    '- Magne P, Nielsen B. Interactions between impression materials and immediate dentin sealing. J Prosthet Dent. 2009;102(5):298–305.\n' +
    '- Gresnigt MMM, et al. Performance of ceramic laminate veneers with immediate dentine sealing: An 11-year prospective clinical trial. Dent Mater. 2019;35(7):1042–1052.\n' +
    '- Alghauli MA, Alqutaibi AY, Borzangy S. Clinical benefits of immediate dentin sealing: a systematic review and meta-analysis. J Prosthet Dent. 2024.\n' +
    '- Tjäderhane L, et al. Strategies to prevent hydrolytic degradation of the hybrid layer. Dent Mater. 2013;29(10):999–1011.\n\n' +

    '### 10. 관점별 질문 (총 22개)\n\n' +
    '**[보철 관점]**\n' +
    '1. Optibond FL로 IDS 후 flowable composite을 추가 coating한 경우, final cementation 시 resin cement와 flowable 간 interlayer bonding strength가 flowable-dentin 간 bonding strength보다 약한지 확인된 data가 있는가?\n' +
    '2. IDS 위에 resin cement vs glass ionomer-based cement를 사용할 때 장기 marginal integrity 차이가 있는가, 그리고 IDS가 conventional cementation의 대안이 될 수 있는가?\n' +
    '3. Full-arch rehabilitation에서 natural abutment와 implant abutment가 혼재할 때, IDS를 natural tooth에만 시행하면 두 group 간 cementation 시점의 seating 동작이 달라지는가?\n' +
    '4. Provisional 기간 중 추가 occlusal adjustment나 margin refinement가 필요한 경우, IDS layer를 일부 삭제하고 re-seal하는 것이 최선인가?\n\n' +
    '**[외과 관점]**\n' +
    '5. Immediate implant 케이스에서 인접 자연치를 동시에 prep하고 IDS를 시행할 때, 수술 중 blood contamination 리스크를 어떻게 관리할 것인가?\n' +
    '6. Subgingival margin이 깊어 rubber dam isolation이 불가능한 경우, IDS를 시행하는 것과 포기하는 것 중 어느 쪽의 예후가 더 좋은가에 대한 근거는?\n' +
    '7. Crown lengthening 후 IDS를 시행할 때 healing 기간을 얼마나 기다려야 하는가, 그리고 초기 healing 상태에서 sulcular fluid flow가 hybrid layer 성숙을 방해하는가?\n\n' +
    '**[치주 관점]**\n' +
    '8. IDS 시행 후 biologic width violation이 발생한 경우, 염증성 sulcular exudate가 IDS layer 하방으로 침투하여 hybrid layer를 degradation시키는가?\n' +
    '9. Subgingival margin에서 IDS를 시행할 때, sulcus에서 발생하는 MMP-8(collagenase)가 IDS layer 주변 dentin에 미치는 영향이 supragingival 상황과 다른가?\n' +
    '10. Aggressive periodontitis 환자에서 높은 MMP 활성도가 IDS seal 유지에 불리하게 작용할 수 있는가, 그리고 chlorhexidine 전처치가 IDS 효과를 향상시키는 근거가 있는가?\n\n' +
    '**[재료 관점]**\n' +
    '11. Self-etch adhesive로 IDS를 시행할 경우, phosphoric acid를 사용하는 etch-and-rinse 대비 MMP 활성화 정도가 어떻게 다르며, IDS의 anti-degradation 이점이 동일하게 기대되는가?\n' +
    '12. Universal adhesive를 self-etch mode로 사용하여 IDS 시행 시 vs etch-and-rinse mode — 후속 conditioning에 대한 resistance와 final bond strength에 차이가 있는가?\n' +
    '13. IDS에 사용한 adhesive와 final cementation resin cement의 monomer composition이 호환되지 않을 때(예: MDP-based vs non-MDP), 어떤 interfacial incompatibility 문제가 발생하는가?\n' +
    '14. Flowable composite으로 IDS 두께를 과도하게 확보했을 때(예: 1mm 이상) seating accuracy와 marginal fit에 어떤 영향이 있는가?\n\n' +
    '**[술식 관점]**\n' +
    '15. IDS 시행 후 final impression 시 retraction cord에 함유된 epinephrine이나 aluminum chloride가 IDS layer에 미치는 영향이 있는가?\n' +
    '16. Lithium disilicate restoration 내면을 HF etching + silane 처리할 때, IDS surface를 air abrasion으로 refresh하는 것과 phosphoric acid만으로 cleansing하는 것의 bond strength 차이는?\n' +
    '17. IDS 후 PMMA 기반 long-term provisional을 직접법으로 제작할 때, vaseline을 도포했음에도 provisional resin이 일부 결합되는 경우 어떻게 관리하는가?\n' +
    '18. 여러 치아에 동시 IDS 시행 시 각 치아의 curing time을 단축하면 hybrid layer의 conversion degree에 어떤 영향이 있으며, bulk cure가 가능한가?\n\n' +
    '**[세미나 방어용]**\n' +
    '19. IDS의 long-term benefit을 지지하는 핵심 RCT들이 단기 outcome에서는 DDS와 유의한 차이를 보이지 못했는데, IDS의 이득이 임상적으로 meaningful한 차이를 만드는 것은 어떤 specific scenario로 제한되는가?\n' +
    '20. In vitro의 "20–30% bond strength 향상"이 임상적으로 실제 failure rate 감소로 이어진다는 직접적 evidence는 어느 수준인가? Bond strength와 clinical success rate의 correlation이 확립되어 있는가?\n' +
    '21. IDS layer 위에 self-adhesive resin cement로 adhesive 재도포 없이 cementation하는 것과, 별도 adhesive를 재도포한 후 conventional resin cement를 사용하는 것 중 어느 쪽이 더 우수한가?\n' +
    '22. Endodontically treated tooth에서 IPDS 개념이 valid하다면, NaOCl·EDTA irrigant와 sealer가 잔류하는 상황에서 adhesive bonding의 기전이 vital tooth와 어떻게 달라지는가?';

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

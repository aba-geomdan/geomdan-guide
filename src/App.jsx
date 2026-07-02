import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════════
   Supabase 클라우드 연결 어댑터
   ───────────────────────────────────────────────────────────────
   기존 window.storage 호출(get/set/delete)을 그대로 받아서
   Supabase 테이블(shared_store / teacher_store)로 흘려보낸다.
   - 두 번째 인자 shared=true  → shared_store (모두 공유)
   - 두 번째 인자 없음/false a  → teacher_store (현재 로그인 선생님 소유)
   반환 형태는 기존과 동일: get() → { value } | null
   ═══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://vdubgrxwijydwfabwpnk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkdWJncnh3aWp5ZHdmYWJ3cG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk1ODgsImV4cCI6MjA5NzE4NTU4OH0.nqNO3vany3M6fzmG5BG6QVdvi8BW2UbhTDhxNnwvA88";

const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 현재 로그인한 선생님 이름을 알아내기 위한 헬퍼
// (앱이 localStorage의 AUTH_CURRENT_USER_KEY에 {role,name}을 저장함)
function _currentOwner() {
  try {
    const raw = localStorage.getItem("gd-aba-current-user");
    if (!raw) return "__nobody__";
    const u = JSON.parse(raw);
    return (u && u.name) ? u.name : "__nobody__";
  } catch (e) {
    return "__nobody__";
  }
}

window.storage = {
  async get(key, shared) {
    try {
      if (shared) {
        const { data, error } = await _sb
          .from("shared_store")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        if (error) { console.warn("[supabase get shared]", error.message); return null; }
        return data ? { value: data.value } : null;
      } else {
        const { data, error } = await _sb
          .from("teacher_store")
          .select("value")
          .eq("owner_name", _currentOwner())
          .eq("key", key)
          .maybeSingle();
        if (error) { console.warn("[supabase get teacher]", error.message); return null; }
        return data ? { value: data.value } : null;
      }
    } catch (e) {
      console.warn("[supabase get 예외]", e);
      return null;
    }
  },

  async set(key, value, shared) {
    try {
      if (shared) {
        const { error } = await _sb
          .from("shared_store")
          .upsert(
            { key, value, updated_at: new Date().toISOString(), last_editor: _currentOwner() },
            { onConflict: "key" }
          );
        if (error) { console.warn("[supabase set shared]", error.message); return null; }
      } else {
        const { error } = await _sb
          .from("teacher_store")
          .upsert(
            { owner_name: _currentOwner(), key, value, updated_at: new Date().toISOString() },
            { onConflict: "owner_name,key" }
          );
        if (error) { console.warn("[supabase set teacher]", error.message); return null; }
      }
      return { value };
    } catch (e) {
      console.warn("[supabase set 예외]", e);
      return null;
    }
  },

  async delete(key, shared) {
    try {
      if (shared) {
        await _sb.from("shared_store").delete().eq("key", key);
      } else {
        await _sb.from("teacher_store").delete()
          .eq("owner_name", _currentOwner()).eq("key", key);
      }
      return { deleted: true };
    } catch (e) {
      console.warn("[supabase delete 예외]", e);
      return null;
    }
  },

  async list(prefix, shared) {
    try {
      const table = shared ? "shared_store" : "teacher_store";
      let q = _sb.from(table).select("key");
      if (!shared) q = q.eq("owner_name", _currentOwner());
      if (prefix) q = q.like("key", prefix + "%");
      const { data, error } = await q;
      if (error) { console.warn("[supabase list]", error.message); return { keys: [] }; }
      return { keys: (data || []).map(r => r.key) };
    } catch (e) {
      console.warn("[supabase list 예외]", e);
      return { keys: [] };
    }
  },
};


/* ═══════════════════════════════════════════════════════════════
   검단ABA 개별화 교육 계획안(IEP) 작성 시스템 v1.0
   ───────────────────────────────────────────────────────────────
   • ELCAR / VB-MAPP / ESDM 커리큘럼 통합 선택
   • 지능형 연동: ELCAR → VB-MAPP/ESDM 추천 자동 제시
   • 현행 수준 · 목표 설정 사유 자동 문장 생성
   • HWP 샘플과 동일한 공문서 양식 인쇄 출력
   • 기초선(Baseline) 방사형·막대 그래프 포함
   • 데이터는 localStorage + window.storage 자동 저장
   ═══════════════════════════════════════════════════════════════ */

const PK = "#F5A0B1", PKL = "#FFF0F3", PKD = "#D4728A";
const GREEN = "#639922", BLUE = "#378ADD", ORANGE = "#EF9F27", RED = "#E24B4A";
const SUPERVISOR_NAME = "민다혜";
const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAMAAAAJixmgAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAA/1BMVEWeW185L0bNanOuYGjacHUqJFR5aGsjGyI7Lkr63t7XmpkyKTxtFmTln6DgboI8MEvysbHMk5NBMk9cKy/IaW1ENFVAMlC3hoe6X3CumJn8gH7raGj8wb0AAP/0W6MAXwD/AP+pYpzytsL//6r/zMxVqlXbcIT//3+/Pz+/P3/bdIcAAAD3fHzxd4z7srBFNVb9hIc8PD33rKr///84LUQ5LUb/AAAtKDI+ME1VVVUwKDj/f3//qqo+ME06Lkc9MUsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7V20FAAAAQHRSTlMbXZ9W0BsLENv/nVQJ1OuNC2tcFmvgnUqTFvgF/wEDAgET/wMFA6ACBARPAP39/v3+BvsBcIwBFPEDLQID0bGvbavxgQAAC8pJREFUeNrtnAl32kgSgFvoBAQYY5zYzjmbmT0a0AkS4vr//2qrqlsHjp1kn1fymFQ9P4EMUvfXdXZLQsjfTAQDMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADXwrwppTfBPhLA/03MWlXy2+hYSHN5ViL5SfOxQPv5Dhcagnfy/2lAztSLBsiXlvFon0F95rAvddOhK03n8hxE3hpvjKxaP38Zxa9XFpyv7lk4EcWTXFrd9Em7Z5bNMYt+e/LBf4KSZhkXG2WS/81ddwy8F5bdDgqN+TGrxi42m15I2dKtf0+bP7oh+fEYrffiYsCFtqigRU2cQm8tHxQ/r7MWxcEvH8coyu5ocZ7f/0lOnZo0a5FOyXgeIx/DRn3eha96ThNtQosNjpGL+P+aDRCR35CTPnpUoAbVUcfJXwSuNfpDKpN4LOJ0qr/xzPuPL4YH96VVYdy4vGzwMmFAD+eKD0tYa/TqCXaVLBY/op0uyYgOglZlIV0GqpilWniP8ZCOhfiww2LHpszVWjUvO/pH/8xZbe8LQKLOmRZgOsLbKqOYmYihDaECwFuWLQvZ73FYmGBOt/Xs2JoWuw7nza11+CX2biy3pkV3i8WYWjK2RnwJU0Pv9bmKxIzXKCEYNu9SwWuJ0pjoFTAi4VZDcOlAZdTfwTOpKWBw8sF3jcCsig1fL8QF2vSSaPqMKXQCu5JaV0m8EZGVV0VWpG26dDcmBcbpaUwSxFXFbAUN/p/WdMc9ih3F7CmVYpZm/RrS2tR2jVvKuktyiht9W5uoHZ+EI12k414R1p/2z7sQ2FVyaIU2ukJ+XAW0AcfVijvkrs3DCwWNeYjCRfNa6ZOImLiXQ26WPp4DeDFfdggvpKDFRLHq9jpYKr4KsDwkZPM9Dd3TkzAsJkC/WUCL+qFrFLBKKMOJsevBWy5yl/vpIgr4NW79peouwfGmL0MF2opK0nkqOKNIWz949KAISndCGH2FlRa7pKGQWPYan9Fr2NgzEgqGYndbg8harBqSBdhq1tgtGQ5HQymWo/ijBeAR62n4o6BTekQYzyYXl1NB7HmrGXadtjqADiMawXPsIyMYyo04ooV31Ks7iBsdQDc7+O7fkzZV1cZcbyqmft9eAebTsJWB8ArBbwi4Lv4zIIV5Aq0TsAdhK3WgWE7wtdR+AwwWnhcG3bbYat94P7IahSUjvbVBu+Hfkyy6pO2W6622jfplfJhrLDCRSanFW710i9Fh639m/dhJSGlJSTGrDStSkoMWCjlJFG0atRd5OER4nzQ00JocjrFlQ23UUTXgbv1sNVN4XEfPi4thWhW0To162orS948cKPWWvZuTJo8bKbfxesuJomvMz0MsaiePmnSbYet11oAAGeeNsN1o85st9pqcZn2/sdLPBUwEA6uxNUgXnURtlq78uD+WMNmBUwapa5Ui3mxm7w54H19EfzJJS35rTZpU+6FI67kuzpsbfZvDVhIM/yBBwsw2ql23LJ63stRB2GrNZPePa9iuvJQAw8c5bFXyaBh5M5bA97sZlb4LO+nhoYHOkTVK9T1/94QMD4b3WteUKsurPVmeC0N8GgGvPoQi2RDK7ZO/EH78IfYeXMmTcTipmedSa+HV0ux0Ts5HWlRjz0IKUaVDJy2ZhCtXhB/us97X76itHsHwG63351JshOVsTqJlnqAanmjwH9DYWAGZmAGZuALB06S6lcMnL0SsWl+/Mtn2v4NgCOUqiNb2o0eV5BPiPN0weXD0fav4lei2/6ybbSsu9LszKOOvVDD578clFV7D9Icz9Q9SI4UPSXmrByHRA4G9b05ihVLywJP4H8s1VrQxs5wnNzPMvu+6x9LKpllLWo4G6bDYWpE0vVy6C3uwW4mD7nWk5841S/sJNIqp0SWfg56j8sYV/Ku7LRt3BoFdHoYTCRCUecjmQYpKP8Q5MExyvJjEaxhbNJbLSfCH956pxTHIz/hwBnXBsq1UeMPhy8Fxp6QpB9dL4hkkavdocwDbT90i/vYSXwNvEAFW3hb0k6NwWhVrV84cq0P/zIMsNfuKfAOgCongYGjcOvN17IIvGFwhN1DoAUGt+zJsTgegzkcUZQfwlfJRmy7CPLsxRou1iAHGHACHgb5Gke1kAevnAA46kGdfQlM5m+F6i4dodap3lEzDvYyHa6xXwjsZ3ngwRAaPgxEKqP02livjbQBbP+JHvwnugIemhmAB4gHbGKt5Bh45CLw/Ulw2kb/Dx9282B9OOQ5tnrQ/4MxSDM6/H24tJZLBx+YJODZw8NO3oT3pvyXUnBcrlpFwLWGV+ij5wEwKM3L3DW+Q+BSZ0Mv9zQwOtBwaAx9VPARwsI6mBRp1QkUQ/uGDWMIpvPzQC9+miiyQ3AcYk8QOM/8SAEHQSF9MOVlaJn6Ke9Kw7ichU5MCp4OaF1SAaP9HokLME9gyNIOcjeawAfY47VxMshvjuDSp8pqbcRRwGACCpgitBOtyRmg6SH4v3eyX6zhzIBQ4sqoIB8OcmzKNbI5aNjVDyeZ+OAGPhNLwKa6IZzupfwnKvhOaBVvQR2HAgOBAWoiYAjO4CvgpQhsgP5BYZkyafjEuL4+BJPrawN30KQRSpm0r1KSHXnBkOw4BfcoQA0T90XA9hGGGzoJZ/FIwxBkDnkwN+Z55cFjNzGVFxMwBel7awYuu8drwQO6+Ux5ceYFYK5IM1TA9nYLwHjKFC38mIHTuIHnoklTEPYCYwgvhdTx7pgZkzOTPuRIiKhHV7owHF7xIuA8OOlYvz6CNeP45vkpzQ45Rmml4P2VP14uIT8RMC1dQV6aJYIULL5dfa3WnrPJPDisXdsn4CNiktWgrdvQGIYwFzXsyeO8suhg7qF5nOZHtKoCorQsDC0Q5oYZRgM4wbUtjRwcOXpJHs6yVAuB21GUKR/O6F52+pkZekq2hzdOllGabPqbVnBDxSCfKXwRsBHkRnGEdx8JWBYnyLSuaxQuGvft7TXmWthMbg1ZOqcbIbAdNCUFx8ukY8wntszsl0Zpo8qGGQxzhrkf4laOwKRgi0qrJQbqPUXpBMDxjS8jzMEkq1LF0QHj7xaA1xB2PDpvodMS1Q6YmQ9GQaPqGka6TsvKwj16WWSrVOGvT8cTZOTgCC9lpMKA/eI8HMFpTqTgHIBRMwcqrg3DVgpe6tIKVUyPJ83Eg9ipMI13c+jbN9RVbh9U42VQBW8j28XCIz3drgt4o4BtiLmBNwe79qKP0TYth3rt4mBEkBe2Nhxpl+WFjWaiBsO3bRsSHGx9+8XA1/TO8zLaqyMGKVgXzz3wYkdWaWlGF4DBgwdalBcT8FONqEpLugdMpRjbbEr/E8O2DQMTIqTHKA+K84kF6GLrb7eOHJ5ZeCH9F2oYc/+w1HAOyQLEiDb4Iw7Vj45QoKa0BNJb3IMPlx5cefEegfOUjr+mzkdb0Bgm6DkBf4ZaI3MzSFwAnOVEjxHYQGDwW6jFoOVrW5cIBpZr9JWTV8sxe6mGax+O6hIWegh2Czn4AZebP32CQD0W9eQhtEjBIrki2d+t1G2jUV4H3oYeiklBCGDSuYeJ67OzxQIFdtDACSHzqp64JfBB/s+L+j8vLdPbCcptSlHFUHuT22IDWrV8R00DP+GOk5jWvbqkcoPzwvpBpB3tYL1tT1QNPDGe7Cvknvn8ZKjqIT158/nhVEYte6KOnaTlMNHEo5xwVlPuFlc8xKyxDOC4Z2sBCZ47qffETyzp77PEE50tLTQXGpLvriOVM/3k2dP65fHbZ1Y56Du6ZfqOUw6GHT1e5Ej8NoB/IM7muZ3vlnnka//qMK9aMjADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADMzADM3CL8l+bfVstzxxTAwAAAABJRU5ErkJggg==";
const SUPERVISOR_TITLE = "검단ABA언어행동연구소";
const SUPERVISOR_CERT = "국제응용행동분석전문가 BCBA 1-21-55036";

const REPORT_FOOTER = "검단ABA언어행동연구소. 본 보고서에 포함된 데이터 기반 분석은 아동의 발달적 진전을 확인하고 다음 단계의 중재 방향을 설정하는 데 활용됩니다.";
const REPORT_STRATS = ["DTT","NET","PECS","Errorless Teaching","Shaping","Chaining","Prompting","Prompt Fading","Token Economy","FCT","Social Stories","Video Modeling","Extinction","DRO/DRA/DRI","NCR","Incidental Teaching"];
const REPORT_PREIN = ["식품 강화제","장난감·선호 물건","감각 자극(시각·청각)","감각 자극(촉각·전정)","활동 강화제","사회적 접촉"];
const REPORT_SREIN = ["토큰(스티커·코인)","칭찬·언어적 강화","하이파이브","활동 선택권","스크린 타임","성취감"];
const REPORT_FUNCS = [{k:"escape",l:"탈출·회피",c:"#fcebeb"},{k:"attention",l:"주목·관심",c:"#e6f1fb"},{k:"sensory",l:"감각자극",c:"#faeeda"},{k:"access",l:"획득",c:"#eaf3de"},{k:"other",l:"기타",c:"#f0f0f0"}];
const INTERVENTION_PRESETS = ["DRO", "DRA", "NCR", "FCT", "선행조절"];

const CURR_COLORS = {
  vbmapp: {
    accent: "#FBDBC6",    // 매우 연한 살구
    bg:     "#FEFAF6",    // 거의 흰색 살구
    deep:   "#C28258",    // 글자/막대용 (가독성 위해 중간 톤)
    line:   "#F0B894",    // 차트 라인
    label:  "VB-MAPP",
    sub:    "언어 행동",
  },
  elcar: {
    accent: "#E8D7F2",    // 매우 연한 라벤더
    bg:     "#FCF9FE",    // 거의 흰색 라벤더
    deep:   "#9B7BBF",    // 글자/막대용
    line:   "#D4BBE5",    // 차트 라인
    label:  "ELCAR",
    sub:    "조기 언어",
  },
  esdm: {
    accent: "#F7DDB0",    // 매우 연한 머스타드
    bg:     "#FEFAF0",    // 거의 흰색 머스타드
    deep:   "#B8924B",    // 글자/막대용
    line:   "#EBCC8A",    // 차트 라인
    label:  "ESDM",
    sub:    "발달 통합",
  },
  other: {
    accent: "#DAE3EC",    // 연한 청회색 (slate)
    bg:     "#F8FAFC",    // 거의 흰색 청회색
    deep:   "#6B7E92",    // 글자/막대용 (가독성 위해 중간 톤)
    line:   "#BCC9D6",    // 차트 라인
    label:  "기타",
    sub:    "맞춤 학습",
  },
};

function classifyCurriculum(domain) {
  if (!domain) return "other";
  const cleanDom = domain.replace(/^[Ⅰ-Ⅺ]\s*/, "").trim();
  if (typeof VBMAPP_DOMAINS !== "undefined" && Array.isArray(VBMAPP_DOMAINS)) {
    for (const v of VBMAPP_DOMAINS) {
      const vName = (v.d || "").replace(/\s*\(.+?\)\s*/, "").trim(); // "Mand (요구)" → "Mand"
      if (vName && cleanDom.includes(vName)) return "vbmapp";
    }
  }
  if (typeof ELCAR !== "undefined" && Array.isArray(ELCAR)) {
    for (const e of ELCAR) {
      const elcClean = (e.d || "").replace(/^[Ⅰ-Ⅺ]\s*/, "").trim();
      if (elcClean && (cleanDom === elcClean || (e.d || "").trim() === domain.trim())) return "elcar";
    }
  }
  if (typeof ESDM_DOMAINS !== "undefined" && ESDM_DOMAINS) {
    for (const lvl of Object.keys(ESDM_DOMAINS)) {
      if (ESDM_DOMAINS[lvl] && Object.keys(ESDM_DOMAINS[lvl]).includes(cleanDom)) return "esdm";
    }
  }
  const d = (domain || "").toLowerCase();
  if (d.includes("vb-mapp") || d.includes("vbmapp") || d.includes("mand") || d.includes("tact") || d.includes("listener") || d.includes("echoic") || d.includes("intraverbal") || d.includes("vp/mts") || d.includes("lrffc")) return "vbmapp";
  if (d.includes("esdm") || d.includes("수용 언어") || d.includes("표현 언어") || d.includes("자조") || d.includes("개인적 독립") || d.includes("합동 주시")) return "esdm";
  if (d.includes("선호물") || d.includes("강화제") || d.includes("조건화") || d.includes("화자") || d.includes("청자") || d.includes("교수") || d.includes("자기관리") || d.includes("언어행동") || d.includes("학습능력") || d.includes("신체발달") || d.includes("elcar")) return "elcar";
  return "other";
}

const PAUSE_REASON_MAP = {
  "일반화 어려움": "치료실 외 환경(가정 등)에서의 안정적 수행을 확인한 후, 점진적인 환경 확장을 통해 재개할 예정입니다.",
  "선행 기술 부족": "필요한 선행 기술의 기초를 충분히 다져 성공 경험을 높인 후, 더 안정적으로 재시작할 예정입니다.",
  "아동 컨디션 변화": "아동의 정서와 학습 효율을 최우선으로 고려하여 잠시 보류하였으며, 컨디션이 회복되는 시점에 부드럽게 재개하겠습니다.",
  "가정 환경 변화": "가정 내 변화에 따른 새로운 루틴에 맞추어 중재 방향을 최적화한 후 재개할 예정입니다.",
  "우선순위 조정": "현재 시기에 더 시급한 핵심 기술 습득을 위해 전략적으로 순서를 조정하였으며, 적절한 시점에 다시 진행하겠습니다.",
  "도구·자료 부족": "더 효과적인 교구와 시각 자료를 보완한 후, 한층 풍부한 학습 환경에서 재개할 예정입니다."
};

function softenPauseReason(raw) {
  if (!raw || typeof raw !== "string") return "";
  const text = raw.trim();
  if (!text) return "";
  if (PAUSE_REASON_MAP[text]) return PAUSE_REASON_MAP[text];
  const NEG_PATTERNS = [
    { re: /너무\s*어렵|너무\s*힘들|어려워|어려움|난이도\s*높/, soft: "난이도 재조정 및 세부 단계 분석(Task Analysis) 후 재개 예정" },
    { re: /못\s*함|못함|못해|불가능|안\s*됨|안됨|실패/, soft: "충분한 선행 기술을 다진 후 단계적으로 재개 예정" },
    { re: /거부|싫어함|싫어|짜증|울음|문제행동/, soft: "아동의 정서적 안정과 학습 동기를 우선 고려하여 적절한 시점에 재개 예정" },
    { re: /지루|흥미\s*없|관심\s*없|동기\s*없|재미\s*없/, soft: "강화제 재평가 및 흥미 유발 요소 보완 후 재개 예정" },
    { re: /시간\s*부족|시간\s*없|일정/, soft: "회기 일정 조정을 통해 충분한 연습 시간 확보 후 재개 예정" },
    { re: /부모\s*거부|보호자\s*반대|가정\s*반대/, soft: "가정과의 충분한 소통을 거쳐 협의된 방향으로 재개 예정" }
  ];
  for (const p of NEG_PATTERNS) {
    if (p.re.test(text)) return p.soft;
  }
  return text;
}

const CUR_FIELDS = ["언어","사회성","문제행동 / 주의 집중","교수 참여도 및 반응성","최근 변화"];

const IS = { width: "100%", border: "1px solid #e8d0d6", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const LS = { display: "block", fontSize: 12, color: "#767676", marginBottom: 4 };
const CS = { background: "#fff", border: "1px solid #f0e0e5", borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" };
const BS = { border: `1px solid ${PK}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, background: "transparent", color: PKD, cursor: "pointer", fontFamily: "inherit" };
const BP = { ...BS, background: PK, color: "#fff" };

const ELCAR = [
  { d: "Ⅰ 선호물·강화제", s: [
    { n: "A 잠재적 강화제", i: ["거울 – 자신을 보기", "거울 – 타인을 보기", "거울 – 동작을 보기", "향기 자극 반응", "까꿍 반응", "시끄러운 장난감 강화제", "불이 반짝이는 장난감", "비눗방울", "촉감 – 장난스러운 신체 접촉", "촉감 – 질감", "자유 작동행동 – 장난감", "자유 작동행동 – 먹을 것", "자유 작동행동 – 책", "음악 (무의미)", "음악이 있는 비디오"] },
    { n: "B 자유 놀이 관찰", i: ["상동행동 관찰", "일탈행동 (놀이영역 이탈·물건 부숨)", "사물 비선호 (정적)", "수동성·부동", "사물 비선호 (움직임)", "사물 선호 (정적)", "사물 선호 (움직임)", "촉감 – 가벼운 압박", "촉감 – 강한 압박", "적절한 놀이 관찰"] }
  ]},
  { d: "Ⅱ 조건화된 강화", s: [
    { n: "A~D 자극", i: ["3D 입체 – 원인과 결과 장난감", "3D 입체 – 그림", "3D 입체 – 글자와 숫자", "2D 평면 – 전자기기 그림", "2D 평면 – 전자기기 글자·숫자", "얼굴 자극 반응", "목소리 자극 반응"] },
    { n: "E~G 환경음·공동주의", i: ["E 환경음 반응", "F 공동주의 – 눈맞춤", "F 공동관심반응 – 포인팅", "F 공동관심반응 – 시선 이동", "F 공유관심개시 – 어른", "F 공유관심개시 – 또래", "G Mand – 음성 지연된 모방 시도", "G 비언어 음성 발성"] }
  ]},
  { d: "Ⅲ 화자 언어 작동", s: [
    { n: "A 언어 작동 행동", i: ["에코익 – 또래와 상응", "에코익 – 어른과 상응", "택트 – 사물 관심 (또래)", "택트 – 사물 관심 (어른)", "맨드 – 자극 획득 (또래)", "맨드 – 자극 획득 (어른)", "맨드 – 종료 요구 (또래)", "맨드 – 종료 요구 (어른)", "인트라버벌 – 청자", "인트라버벌 – 화자", "대화 유닛 – 또래", "대화 유닛 – 어른", "말하기-행하기 독백", "상징놀이 중 독백"] }
  ]},
  { d: "Ⅳ 교수 준비도", s: [
    { n: "A 교수 주의 집중", i: ["시각적 큐 + 음성지시 따르기 – 또래", "시각적 큐 + 음성지시 따르기 – 어른"] }
  ]},
  { d: "Ⅴ 자기관리", s: [
    { n: "A 학교 자조 능력", i: ["놀이 장소에 10분 머물기", "이름 불렸을 경우에만 반응", "먹을 것만 입에 넣기", "교사 옆 손 잡지 않고 걷기", "5초 안에 줄 서기", "교사 수업시 머리 방향 유지", "강화제 10초 대기", "구조화된 활동 전이", "시각 단서 + 교사 지시 5초 이내", "장난감 강화제 짜증 없이 돌려주기", "독립적으로 학급 일과 따르기", "가벼운 불만 받아들이기", "수정 받아들이기", "손 씻기", "점심 먹기", "개별교수 테이블 착석", "그룹 활동 책상 착석", "화장실 사용 요청", "교실 규칙 지키기", "정리하기 (Clean-up)"] },
    { n: "B 학교 상호작용", i: ["인사에 반응하기", "적절한 신체접촉", "어른 호명 반응", "또래 호명 반응", "저항없이 등교·입실", "구조화된 놀이 참여 (5분)", "개별교수 지시+10초 바라보기", "그룹교수 지시+10초 바라보기", "어른 도움 구하기", "인사 개시하기", "질문에 답할 때 눈 맞추기", "화자 대화 중 눈 맞추기", "청자 대화 중 눈 맞추기", "또래 지시 따르기", "어른과 긍정 상호작용 (5분)", "또래와 긍정 상호작용 (5분)", "평행놀이 (5분, 1.5m)", "번갈아 참여 – 차례 (5분)", "장난감·책 공유 (5분)", "협동 놀이 (5분)", "게임 규칙 설명/따르기", "이겼을 때 적절 행동", "졌을 때 적절 행동"] }
  ]},
  { d: "Ⅵ 언어행동기초", s: [
    { n: "A 화자 기초", i: ["시야 밖 아이템 찾기", "선호하는 아이템 선택", "교수 상황 제스처 맨드", "일반 상황 제스처 맨드", "어른 손을 잡아 의사소통", "발성·유사어로 맨드"] },
    { n: "B·C 모방", i: ["사물 이용 동작 모방", "새로운 단-단계 제스처 모방", "양쪽 가로지르는 제스처", "새로운 2단계 제스처 모방", "구강 움직임 모방", "소근육 모방", "일반화된 사물 동작 모방", "일반화된 제스처 모방", "일반화된 소근육 모방"] },
    { n: "D 시각 자극 통제", i: ["단사례 사물·그림 가리키기·두드리기", "시각적 매칭 – 동일한 사물", "시각적 매칭 – 동일한 그림", "시각적 매칭 – 사물→그림", "시각적 매칭 – 그림→사물", "시각적 매칭 – 비관련 특징 사물", "시각적 매칭 – 비관련 특징 그림", "시각적 매칭 – 비관련 특징 사물→그림", "시각적 매칭 – 비관련 특징 그림→사물", '"같은" 선행자극에 적절히 반응', "동일/유사 사물 두 그룹으로 분류"] }
  ]},
  { d: "Ⅶ 청자", s: [
    { n: "A 음성 지시", i: ['"나 봐" 눈맞춤 3초 유지', "1:1 단-단계 음성 지시 따르기", "1:1 2단계 음성 지시 따르기", "그룹 단-단계 음성 지시", "그룹 2단계 음성 지시", "교사 신호에 반응하기", "5개 사물 중 3개 주기", "교실 다른 곳에서 3개 가져오기"] },
    { n: "B 초기 화자 (에코익)", i: ["제스처 맨드 (눈맞춤 동반)", "음성 유사어 동반 제스처", "환경소리 모방", "단음절어 에코 5개", "2음절어 에코 5개", "3음절어 에코 5개", "2단어 구 에코", "3-5단어 구 에코", "맨드 기능 네/아니오", '"이거·저거·저것들" 차례 맨드'] },
    { n: "C 맨드", i: ["인트라버벌 맨드", "음식·음료 맨드 + 택트", "사물 맨드 + 택트", "전정·자기수용·촉각 자극 맨드", "부적절 맨드 대체 행동", "도움 맨드 + 택트", "활동 맨드", "환경 자극 제거·종료 맨드", "사회 상호작용 맨드", "경험 공유 맨드", "차례·기회 맨드"] },
    { n: "D 정보 맨드·오토클리틱", i: ['"무엇" 이용 맨드', '"언제" 이용 맨드', '"어디" 이용 맨드', '"누구" 이용 맨드', '"어떻게" 이용 맨드', '"주세요" 사용 맨드', '고개 끄덕 오토클리틱 맨드', '오토클리틱 형용사 사용 맨드'] }
  ]},
  { d: "Ⅷ 화자", s: [
    { n: "E 택트", i: ["인트라버벌 택트", "단단어 자극 택트", "신체적·정서적 사건 택트", "호감·비호감 택트", "감탄사 택트", "소개로서 택트", "자신·타인 소유 택트", "신체부위 기능 역방향 (12개)", "오토클리틱 택트 – 누구", "오토클리틱 택트 – 왜", "오토클리틱 택트 – 언제", "오토클리틱 택트 – 어디에"] },
    { n: "F 오토클리틱 택트", i: ["포인팅 + 택트 (오토클리틱 제스처)", "특정화 택트 – 이거/저거", "오토클리틱 형용사 사용 택트", "나이 적절 문법·문장구조 택트"] },
    { n: "H 인트라버벌", i: ["연결된 비-파생적 인트라버벌 (5개)", "다중 통제 범주 꾸밈어 (5개)", "다중 통제 범주 2단어+ (5개)", "과거 사건·개인정보 질문 (5개)", "다중 택트+오토클리틱 질문 (5개)", "대응 택트 – 주고받기 (5개)"] }
  ]},
  { d: "Ⅸ 강화제군", s: [
    { n: "A 학교 기반 강화", i: ["상동행동 감소 중재 불필요", "방해행동 감소 중재 불필요", "특정 자극 선호가 일상 저해 안 함", "다양한 자극이 학습 강화제로 작용", "또래 행동 모방 (사물 사용)", "또래 행동 모방 (자유놀이 순서)", "그룹 이야기 듣기 5분 90%"] },
    { n: "B 읽기·음악·수학 강화", i: ["자유놀이 중 책 보기", "교사 이야기 듣기", "이야기 내용 듣기가 강화", "수학 자료 선택", "노래 활동 참여", "춤 순서 모방", "먹을 것으로 강화되는 과제", "토큰으로 강화되는 과제"] }
  ]},
  { d: "Ⅹ 학습능력", s: [
    { n: "A 매칭", i: ["새로운 자극 시각적 매치", "집안 물품 사물 구성 모방", "청자 사물 구성 사후 모방", "가리키기를 통해 그림 매칭 (10개)"] },
    { n: "B 일반 지식", i: ["범주에 따른 아이템 분류 (25개)", "색깔 청자/화자", "모양 청자/화자", "탈 것 청자/화자", "농장 동물 청자/화자", "반려동물 청자/화자", "곤충 청자/화자", "과일 청자/화자", "야채 청자/화자", "일반 음식 청자/화자", "장난감 청자/화자", "의류 청자/화자", "학교 물품 청자/화자", "동작 변별·시연 청자/화자", "신체부위 – 자신/그림/인형", "급우 청자/화자", "가족 구성원 청자/화자", "전자 제품 청자/화자", "악기 청자/화자", "감정 청자/화자", "자연 자극 청자/화자"] },
    { n: "C 개념", i: ["공간 속 위치 M/T/IV", "크기 M/T/IV", "시간(전에/후에) M/T/IV", "촉감 3단어 M/T/IV", "분류(같은/다른) M/T/IV", "방향(가까운/먼) M/T/IV", "비교급(더 큰/더 작은) M/T/IV", "공간/장소(맨 위/아래) M/T/IV", "최상급(가장 큰) M/T/IV", "신체적 상태 M/T/IV"] },
    { n: "D 읽기 전 단계", i: ["두 단어 듣고 구분 (10개)", "복합어 조합 IV (10개)", "복합어 분리 IV (10개)", "음절 수 두드리기 (10개)", "공통 첫 소리 말하기 (10개)", "그림과 글자 변별", "blending – 2음소", "blending – 3음소", "segmenting (10개)"] },
    { n: "E 읽기", i: ["글자 이름 식별 (26개)", "글자 이름 화자로 말하기 (26개)", "글자 소리 구분 소문자 (26개)", "인쇄 글자 매칭 소문자", "인쇄 글자 매칭 대문자", "글자 이름→소리 (26개)", "두 글자 조합 읽기 (20개)", "자-모-자 단어 읽기", "운율 – 비슷한 단어 분류", "기록된 지시 따르기", "기초 단어/통문자 읽기", "단어-그림 매칭 (10개)", "문장-그림 매칭 (10개)", "이야기 다시 말하기 (5사건)"] },
    { n: "F 수학", i: ["같은 양 매칭 (1-10)", "같은 양 매칭 (11-20)", "수 그룹 식별 (1-10)", "아라비아 숫자-사물 매칭 (1-10)", "수직선 사물 양 세기 (1-10)", "인쇄된 숫자 읽기 (1-20)", "1:1 상응 사물 세기", "씩 세기/거꾸로 세기", "더 많은/더 적은", "이전/이후 숫자", "조작물 덧셈 (0-10)", "조작물 뺄셈 (0-10)"] },
    { n: "G 쓰기", i: ["교사 시연 마크 모방", "교사 시연 마크 베끼기", "자음 따라 쓰기 (19개)", "모음 따라 쓰기 (21개)", "자음 독립 쓰기", "모음 독립 쓰기", "숫자 따라 쓰기 (0-9)", "숫자 독립 쓰기 (0-9)", "성과 이름 따라·베껴·독립 쓰기", "키보드 자음·모음 타이프", "키보드 이름 타이프"] }
  ]},
  { d: "Ⅺ 신체발달", s: [
    { n: "A 쓰는 근육 운동", i: ["포인팅 반응 (테이블)", "포인팅 – 식별 기능", "종이에 점 찍기", "크레용·연필 tripod grasp", "스텐실 모양 추적·그리기", "표시 추적 그리기", "글자·숫자 추적 쓰기", "끈으로 엮기·구슬 꿰기", "사람 그리기 (머리+특징)", "단순한 그림 그리기", "선을 넘지 않고 색칠하기"] },
    { n: "B 학급 조작물", i: ["시선 추적 10초", "테이블 활동 중간선 넘기", "종이 3번 접기", "클립 끼우기", "가위 바르게 잡기", "가위로 자르기", "종이 반으로 자르기", "사각형·동그라미 오리기", "한 손으로 종이 잡기", "퍼즐 맞추기 (12개+)", "풀 사용하기", "블록 10개+ 쌓기", "티셔츠 입기/벗기", "바지 입기/벗기", "양말·신발 신기/벗기", "지퍼 잠그기", "단추 채우기/풀기", "숟가락·포크·칼 사용", "빨대·컵으로 마시기"] },
    { n: "C 대근육 운동", i: ["적절한 자세로 걷기", "100m 달리기", "지지 없이 앉기/서기", "방해물 피해 걷기", "뒷걸음 걷기", "까치발 걷기", "한 발로 서기 (5초)", "공 잡기 (튀긴·던진)", "테니스 공 던지기", "공 튕겨 주고받기", "멈춘 공/구르는 공 차기", "한 발 깡총 3번", "점프하기", "두 발 연속 뛰기", "그네 타기", "세발자전거 50m", "계단 오르내리기", "평균대 걷기 3m"] }
  ]}
];

const VBMAPP_DOMAINS = [
  { d: "Mand (요구)", s: [
    { n: "L1 (0-18개월)", i: ["2가지 이상 행동으로 원하는 것 요구", "에코 프롬프트 없이 10가지 Mand", "자발적으로 20가지 이상 Mand", "눈 맞추며 Mand 하기", "다른 사람에게 Mand 하기"] },
    { n: "L2 (18-30개월)", i: ["행동 Mand (밀어줘·열어줘·들어올려줘)", "50가지 이상 2단어 조합 Mand", "'yes/no' 질문으로 원하는 것 Mand", "10가지 이상 사물 정보 Mand", "주의 끌기 Mand"] },
    { n: "L3 (30-48개월)", i: ["형용사 포함 Mand (큰 거 줘)", "'왜'·'어떻게' 질문 Mand", "평균발화길이(MLU) 적절한 Mand", "정보를 요청하는 Mand 10가지", "미래 사건에 대한 Mand"] }
  ]},
  { d: "Tact (명명)", s: [
    { n: "L1 (0-18개월)", i: ["에코 프롬프트로 2가지 항목 Tact", "자발적으로 10가지 항목 Tact", "25가지 항목 비훈련 인물에게 Tact", "50가지 이상 사물 Tact", "환경 내 다양한 자극 Tact"] },
    { n: "L2 (18-30개월)", i: ["50가지 2단어 이상 조합 Tact", "동사 25가지 Tact", "형용사·전치사·대명사 25가지 Tact", "행동 관찰 후 Tact", "그림 속 사건 Tact"] },
    { n: "L3 (30-48개월)", i: ["명사+동사+형용사 4단어 Tact 50가지", "감정·형용사 Tact (슬퍼 보여)", "1000가지 이상 Tact", "과거·미래 시제 Tact", "원인·결과 관계 Tact"] }
  ]},
  { d: "Listener Responding (청자 반응)", s: [
    { n: "L1 (0-18개월)", i: ["가까이 있는 사람에게 주의 전환", "앉아/이리와/손 흔들기 4가지 지시", "10가지 지시 따르기", "이름 부르면 반응하기", "기본 사물 선택하기"] },
    { n: "L2 (18-30개월)", i: ["신체 부위 지시 + 동작 변별 따르기", "2단계 지시 따르기 (가서 … 가져와)", "서로 관련 없는 3단계 지시", "동사 지시 따르기 25가지", "형용사·전치사 포함 지시"] },
    { n: "L3 (30-48개월)", i: ["형용사 포함 3단계 지시 따르기", "시간 관련 지시 이해 (나중에·먼저)", "이야기 듣고 내용 질문 응답", "복잡한 다단계 지시", "추론이 필요한 지시"] }
  ]},
  { d: "VP/MTS (시각 수행·매칭)", s: [
    { n: "L1 (0-18개월)", i: ["3개 블록 쌓기·3개 고리 끼우기", "3조각 퍼즐 맞추기", "동일 사물-그림 6가지 짝 맞추기", "사물 분류하기 (동일 사물끼리)", "간단한 형태 분류"] },
    { n: "L2 (18-30개월)", i: ["4가지 색 분류하기", "블록 디자인 모방 10가지", "비동일 그림 25가지 짝 맞추기", "10조각 퍼즐 맞추기", "범주별 분류 (동물·음식)"] },
    { n: "L3 (30-48개월)", i: ["패턴 연속 완성 (ABAB 등)", "연관 사물 짝 맞추기 (숟가락-그릇)", "단어-그림 매칭 10가지", "복잡한 블록 디자인 모방", "3차원 구조물 모방"] }
  ]},
  { d: "Play (독립 놀이)", s: [
    { n: "L1 (0-18개월)", i: ["다른 장난감으로 독립 놀이 2분", "원인-결과 장난감 조작", "5가지 장난감 기능적 독립 놀이 2분", "장난감 탐색하기", "블록·퍼즐 간단 조작"] },
    { n: "L2 (18-30개월)", i: ["연속 놀이 동작 5가지", "가작놀이 2가지 (인형 먹이기·전화하기)", "독립 놀이 10분", "복합 장난감 기능대로 놀기", "역할 놀이 시작"] },
    { n: "L3 (30-48개월)", i: ["가작놀이 대본 자발 생성", "규칙 있는 보드 게임 참여", "또래와 게임 시 적절 반응", "창의적 놀이 주제 만들기", "복잡한 역할극 놀이"] }
  ]},
  { d: "Social (사회성)", s: [
    { n: "L1 (0-18개월)", i: ["성인의 사회적 접촉 수용", "눈맞춤 + 긍정적 정서 5회 이상", "성인의 동작 2가지 이상 자발 모방", "사회적 미소 짓기", "이름 부르면 반응"] },
    { n: "L2 (18-30개월)", i: ["또래 옆에서 독립놀이 2분", "또래에게 자발 Mand 2가지", "또래와 함께 놀이 5분 유지", "간단한 사회적 인사", "차례 주고받기"] },
    { n: "L3 (30-48개월)", i: ["또래에게 자발 인사", "대화 3회전 이상 유지", "또래와 협동 놀이 (역할 나누기)", "친구의 감정 이해하기", "갈등 상황 협상"] }
  ]},
  { d: "Motor Imitation (운동 모방)", s: [
    { n: "L1 (0-18개월)", i: ["성인의 대근육 동작 관찰", "사물 이용 동작 2가지 모방", "모터 동작 20가지 모방", "손뼉·손흔들기 모방", "간단한 얼굴 표정 모방"] },
    { n: "L2 (18-30개월)", i: ["눈·입 관련 미세 모방", "사물 이용 연쇄 동작 모방", "교실 안 기능적 모방 자발 수행", "2단계 동작 순서 모방", "거울·지연 모방"] },
    { n: "L3 (30-48개월)", i: ["여러 단계 연쇄 모방", "노래/게임 연속 동작 모방", "미니어처 가상놀이 행동 모방", "복잡한 운동 시퀀스 모방", "새로운 동작 즉시 모방"] }
  ]},
  { d: "Echoic (에코익)", s: [
    { n: "L1 (0-18개월)", i: ["어떤 소리든 모방 시도", "자음-모음 조합 5가지 에코", "단어 10가지 에코", "간단한 단음절 모방", "울음·웃음 소리 모방"] },
    { n: "L2 (18-30개월)", i: ["3단어 구 에코", "조음 정확도 80% 이상", "완전한 문장 에코", "억양 포함 에코", "긴 단어 에코"] },
    { n: "L3 (30-48개월)", i: ["운율·강세 적절한 에코", "긴 문장 정확히 에코", "새 단어 즉각 모방", "외국어 단어 에코", "복합문 정확한 에코"] }
  ]},
  { d: "Spontaneous Vocal (자발 발성)", s: [
    { n: "L1 (0-18개월)", i: ["자발적 옹알이", "5가지 자발 발성", "다양한 자음·모음 산출", "의미있는 발성 시도", "자발적 단어 발화"] },
    { n: "L2 (18-30개월)", i: ["자발적 단어 조합 발화", "자발 발성 빈도 증가", "다양한 단어 자발 사용", "자발적 2단어 문장", "자발적 노래 부르기"] },
    { n: "L3 (30-48개월)", i: ["자발적 문장 구사", "다양한 상황별 자발 발화", "자발적 이야기 만들기", "자발적 질문하기", "자발적 대화 주도"] }
  ]},
  { d: "LRFFC (기능·특성·범주 청자반응)", s: [
    { n: "L1 (0-18개월)", i: ["기능 단서로 간단한 사물 선택", "일상 용품 식별하기", "기본 범주 이해 (음식·장난감)", "간단한 기능 이해", "친숙한 범주 선택"] },
    { n: "L2 (18-30개월)", i: ["기능 단서로 사물 선택 5가지 (뭘로 마시지?)", "특성 단서로 사물 선택 5가지 (날개가 있는 것은?)", "범주 단서로 사물 선택 5가지", "다양한 기능 변별", "여러 특성 조합 변별"] },
    { n: "L3 (30-48개월)", i: ["비훈련 항목으로 기능 변별 일반화", "비훈련 항목 특성 변별 일반화", "FFC 통합 50가지 이상 변별", "복잡한 기능·특성 추론", "하위 범주 이해"] }
  ]},
  { d: "Intraverbal (인트라버벌)", s: [
    { n: "L1 (0-18개월)", i: ["간단한 노래 빈칸 채우기 (기초)", "익숙한 구 완성하기", "기본 사회적 질문 답하기 (이름·나이)", "간단한 동요 따라 부르기", "좋아하는 것 대답하기"] },
    { n: "L2 (18-30개월)", i: ["노래·동물소리 빈칸 채우기 5가지", "일상·사회적 질문 대답 5가지", "개방형 WH질문 대답 25가지", "연관어 답하기", "역할별 답하기"] },
    { n: "L3 (30-48개월)", i: ["범주 명명 5가지 (과일 뭐가 있지?)", "WH질문 25가지", "두 사물 비교·대조", "추론적 질문 답하기", "논리적 연결 대답"] }
  ]},
  { d: "Classroom Routines (학급 일과)", s: [
    { n: "L1 (0-18개월)", i: ["교실 활동 관찰하기", "간단한 신호에 반응", "기본 전환 따르기", "교사 옆에 앉기", "간단한 지시 따르기"] },
    { n: "L2 (18-30개월)", i: ["그룹 활동 참여", "교실 규칙 따르기", "수업 중 착석 유지", "전환 독립적으로 수행", "간단한 교실 과제 수행"] },
    { n: "L3 (30-48개월)", i: ["복잡한 교실 일과 따르기", "독립적 과제 완성", "그룹 활동 능동 참여", "교실 규칙 자발 준수", "또래와 협력 과제"] }
  ]},
  { d: "Group Skills (집단 기술)", s: [
    { n: "L1 (0-18개월)", i: ["성인과 1:1 활동 유지", "1:1 짧은 주의 유지", "기본 반응 산출", "간단한 노래·동작 따라하기", "집중 3분 이상"] },
    { n: "L2 (18-30개월)", i: ["소그룹 5분 참여", "그룹 지시 따르기", "또래와 짧은 상호작용", "차례 기다리기", "그룹 활동 모방"] },
    { n: "L3 (30-48개월)", i: ["대그룹 15분 참여", "복잡한 그룹 지시 따르기", "또래와 협동 과제", "역할 맡아 수행", "그룹 토론 참여"] }
  ]},
  { d: "Reading (읽기)", s: [
    { n: "L1 (0-18개월)", i: ["책 보기·넘기기", "그림책 선호 표현", "책 속 그림 가리키기", "책 함께 보기", "간단한 그림 인식"] },
    { n: "L2 (18-30개월)", i: ["친숙한 그림책 이름 대기", "이야기 예측하기", "5-10분 책 읽기 집중", "글자 관심 보이기", "자기 이름 글자 인식"] },
    { n: "L3 (30-48개월)", i: ["자기 이름 글자 인식", "10개 이상 글자 이름 말하기", "CVC 단어 해독 5개 이상", "간단한 단어 읽기", "문장 읽기 시도"] }
  ]},
  { d: "Writing (쓰기)", s: [
    { n: "L1 (0-18개월)", i: ["크레용 잡기", "종이에 낙서하기", "다양한 도구 사용 시도", "점·선 그리기", "도구로 흔적 남기기"] },
    { n: "L2 (18-30개월)", i: ["선·원 따라 그리기", "기본 모양 그리기", "자기 이름 일부 쓰기 시도", "글자 모양 흉내", "색칠하기"] },
    { n: "L3 (30-48개월)", i: ["자기 이름 쓰기", "글자 따라 쓰기 10개", "간단한 문장 쓰기", "알파벳·숫자 쓰기", "독립적 짧은 글쓰기"] }
  ]},
  { d: "Math (수학)", s: [
    { n: "L1 (0-18개월)", i: ["1-2개 수 세기 관찰", "많다·적다 개념 초기", "기본 수량 인식", "하나·둘 구분", "간단한 양 비교"] },
    { n: "L2 (18-30개월)", i: ["1-5 수 세기 (기계적)", "수-양 대응 1-3", "간단한 수량 비교", "기본 도형 인식", "크기 비교"] },
    { n: "L3 (30-48개월)", i: ["수 세기 1~5", "수-양 1:1 대응 1~5", "더 많은·더 적은 비교", "수 인식 1-10", "간단한 더하기·빼기 개념"] }
  ]}
];

const VBMAPP_GRID_DATA = (() => {
  const domains = (typeof VBMAPP_DOMAINS !== "undefined" ? VBMAPP_DOMAINS : []).map(d =>
    (d.d || "").replace(/\s*\(.+?\)\s*/, "").trim()
  ).filter(Boolean);
  const levels = [
    { name: "Level 1 (0-18개월)", range: [1, 5] },
    { name: "Level 2 (18-30개월)", range: [6, 10] },
    { name: "Level 3 (30-48개월)", range: [11, 15] },
  ];
  return { domains, levels };
})();

const ELCAR_VBMAPP_GRID_MAP = [
  {k:"오토클리틱 택트",v:"Tact",lv:3},
  {k:"동기조작 변형",v:"Intraverbal",lv:3},
  {k:"정보 맨드",v:"Mand",lv:2},{k:"정보맨드",v:"Mand",lv:2},
  {k:"초기 화자",v:"Echoic",lv:2},{k:"초기화자",v:"Echoic",lv:2},
  {k:"자유 놀이 관찰",v:"Play",lv:1},{k:"자유놀이관찰",v:"Play",lv:1},
  {k:"잠재적 강화제",v:"Mand",lv:1},
  {k:"자극·공동주의",v:"Listener Responding",lv:1},
  {k:"환경음·공동주의",v:"Listener Responding",lv:1},
  {k:"공동주의",v:"Listener Responding",lv:1},
  {k:"화자 기초",v:"Mand",lv:1},
  {k:"시각 자극 통제",v:"VP/MTS",lv:1},{k:"시각자극",v:"VP/MTS",lv:1},
  {k:"음성 지시",v:"Listener Responding",lv:2},{k:"음성지시",v:"Listener Responding",lv:2},
  {k:"학교 상호작용",v:"Social",lv:3},{k:"학교상호작용",v:"Social",lv:3},
  {k:"학교 자조 능력",v:"Classroom Routines",lv:3},
  {k:"학교 자조",v:"Classroom Routines",lv:3},{k:"학교자조",v:"Classroom Routines",lv:3},
  {k:"교수 준비도",v:"Listener Responding",lv:1},
  {k:"교수 주의 집중",v:"Listener Responding",lv:1},
  {k:"읽기 전 단계",v:"Reading",lv:3},
  {k:"읽기·음악·수학",v:"Reading",lv:3},
  {k:"강화제군",v:"Play",lv:3},
  {k:"쓰는 근육",v:"Motor Imitation",lv:1},
  {k:"오토클리틱",v:"Tact",lv:3},
  {k:"동기조작",v:"Intraverbal",lv:3},
  {k:"인트라버벌",v:"Intraverbal",lv:2},
  {k:"택트",v:"Tact",lv:2},
  {k:"맨드",v:"Mand",lv:2},
  {k:"모방",v:"Motor Imitation",lv:1},
  {k:"매칭",v:"VP/MTS",lv:2},
  {k:"일반 지식",v:"Tact",lv:3},{k:"일반지식",v:"Tact",lv:3},
  {k:"개념",v:"Intraverbal",lv:3},
  {k:"읽기",v:"Reading",lv:3},
  {k:"수학",v:"Math",lv:3},
  {k:"쓰기",v:"Writing",lv:3},
  {k:"대근육",v:"Play",lv:1},
  {k:"소근육",v:"Motor Imitation",lv:1},
  {k:"사물 기능",v:"LRFFC",lv:2},
  {k:"특성 단서",v:"LRFFC",lv:2},
  {k:"범주 단서",v:"LRFFC",lv:2},
  {k:"기능·특성·범주",v:"LRFFC",lv:3},
  {k:"LRFFC",v:"LRFFC",lv:2},
];

function findVbmappGridMapping(domClean, stoName, stoKey) {
  const combined = (domClean || "") + "|" + (stoName || "") + "|" + (stoKey || "");
  for (const entry of ELCAR_VBMAPP_GRID_MAP) {
    if (combined.includes(entry.k)) return { domain: entry.v, lv: entry.lv };
  }
  return null;
}

const ESDM_DOMAINS = [
  { d: "수용 언어", s: [
    { n: "레벨1 (12-18개월)", i: ["이름 부르면 쳐다보기", "고개 돌려 말하는 사람 바라보기", "간단한 일상적 지시 따르기"] },
    { n: "레벨2 (19-24개월)", i: ["기초적인 공간개념 이해", "2단계 지시 따르기", "신체 부위 명명에 반응", "다양한 사물 명명에 반응"] },
    { n: "레벨3 (25-36개월)", i: ["형용사·수량 개념 이해", "3단계 관련 지시 따르기", "부정문·질문문 이해"] },
    { n: "레벨4 (37-48개월)", i: ["복잡한 문장 이해", "이야기 듣고 질문에 답하기", "추상 개념 이해"] }
  ]},
  { d: "표현 언어", s: [
    { n: "레벨1 (12-18개월)", i: ["요청 의미로 손 뻗기", "의도적으로 소리 내기", "초기 단어 5가지"] },
    { n: "레벨2 (19-24개월)", i: ["명사+동사 2단어 조합", "다양한 자음 소리 자발적", "10가지 이상 명명"] },
    { n: "레벨3 (25-36개월)", i: ["WH질문에 대답", "문장으로 표현 (3-4단어)", "감정·필요 표현"] },
    { n: "레벨4 (37-48개월)", i: ["이야기 만들어 말하기", "과거·미래 시제 사용", "복합문 구사"] }
  ]},
  { d: "합동 주시 행동", s: [
    { n: "레벨1 (12-18개월)", i: ["'이거 봐' 물건 제시 반응", "시선 따라가기", "함께 주의 공유"] },
    { n: "레벨2 (19-24개월)", i: ["'저기 봐' 멀리 가리키면 반응", "교사 눈 쳐다보며 물건 주고받기", "자발적으로 물건 보여주기"] }
  ]},
  { d: "사회기술: 어른/친구", s: [
    { n: "레벨2 (19-24개월)", i: ["인사에 반응하기", "눈맞춤 유지", "상대방 요구 시 물건 공유"] },
    { n: "레벨3 (25-36개월)", i: ["놀이시 차례 지키기", "간단한 대화 시작", "친구 이름 부르기"] },
    { n: "레벨4 (37-48개월)", i: ["협동 놀이 참여", "상호작용 오래 유지", "도움 주고받기"] }
  ]},
  { d: "모방", s: [
    { n: "레벨1 (12-18개월)", i: ["물체 활동 8~10가지 모방", "간단한 동작 모방", "소리 모방 시도"] },
    { n: "레벨2 (19-24개월)", i: ["볼 수 있는 동작 10가지 모방", "구강-얼굴 동작 모방", "단어 모방"] },
    { n: "레벨3 (25-36개월)", i: ["여러 단계 연쇄 모방", "복잡한 동작 순서 모방", "지연 모방"] }
  ]},
  { d: "인지", s: [
    { n: "레벨1 (12-18개월)", i: ["원인-결과 이해", "사물 영속성 이해", "단순 짝 맞추기"] },
    { n: "레벨2 (19-24개월)", i: ["같은 사물끼리 짝 맞추기", "색깔·도형 분류", "기초 수 개념"] },
    { n: "레벨3 (25-36개월)", i: ["범주에 따라 분류", "반대어 이해", "크기·양 개념"] },
    { n: "레벨4 (37-48개월)", i: ["수 세기 10까지", "순서 짓기", "추론·문제 해결"] }
  ]},
  { d: "놀이", s: [
    { n: "레벨1 (12-18개월)", i: ["장난감 기능에 맞게 놀기", "다양한 장난감 탐색", "기초적 인과놀이"] },
    { n: "레벨2 (19-24개월)", i: ["놀이 끝내고 치우기", "독립적 놀이 10분", "간단한 가작놀이"] },
    { n: "레벨3 (25-36개월)", i: ["놀이 주제 따라 행동", "역할놀이 참여", "또래와 평행놀이"] }
  ]},
  { d: "소근육 운동", s: [
    { n: "레벨2 (19-24개월)", i: ["크레파스로 낙서·선·마크", "블록 쌓기 (5개 이상)", "단추 끼우기"] },
    { n: "레벨3 (25-36개월)", i: ["가위로 종이 자르기", "퍼즐 혼자 맞추기", "간단한 모양 그리기"] },
    { n: "레벨4 (37-48개월)", i: ["블록·레고 따라 만들기", "글자 따라 쓰기", "세밀한 조작"] }
  ]},
  { d: "대근육 운동", s: [
    { n: "레벨2 (19-24개월)", i: ["공 던지기·받기", "계단 오르내리기", "달리기"] },
    { n: "레벨3 (25-36개월)", i: ["한 발로 서기", "점프하기", "세발자전거 타기"] },
    { n: "레벨4 (37-48개월)", i: ["목표 지점으로 공차기", "평균대 걷기", "스킵·갤롭"] }
  ]},
  { d: "자조: 식사", s: [
    { n: "레벨2 (19-24개월)", i: ["스스로 컵·숟가락 사용", "다양한 음식 먹기", "식사 독립적으로"] },
    { n: "레벨3 (25-36개월)", i: ["포크·칼 사용", "흘리지 않고 먹기", "식탁 예절 지키기"] }
  ]},
  { d: "자조: 옷입기·위생", s: [
    { n: "레벨2 (19-24개월)", i: ["간단한 옷 벗기", "손 씻기 시도", "양치 협조"] },
    { n: "레벨3 (25-36개월)", i: ["단순한 옷 입기", "손 혼자 씻기", "화장실 사용 요청"] },
    { n: "레벨4 (37-48개월)", i: ["완전히 혼자 옷입기", "양치 혼자", "코 풀기·세수"] }
  ]}
];

const VBMAPP_RECOMMEND = {
  "Mand": {
    1: ["2가지 이상 행동으로 원하는 것 요구", "에코 프롬프트 없이 10가지 Mand", "자발적으로 20가지 이상 Mand"],
    2: ["행동 Mand (밀어줘·열어줘·들어올려줘)", "50가지 이상 2단어 조합 Mand", "'yes/no' 질문으로 원하는 것 Mand"],
    3: ["형용사 포함 Mand (큰 거 줘)", "'왜'·'어떻게' 질문 Mand", "평균발화길이(MLU) 적절한 Mand"]
  },
  "Tact": {
    1: ["에코 프롬프트로 2가지 항목 Tact", "자발적으로 10가지 항목 Tact", "25가지 항목 비훈련 인물에게 Tact"],
    2: ["50가지 2단어 이상 조합 Tact", "동사 25가지 Tact", "형용사·전치사·대명사 25가지 Tact"],
    3: ["명사+동사+형용사 4단어 Tact 50가지", "감정·형용사 Tact (슬퍼 보여)", "1000가지 이상 Tact"]
  },
  "Listener Responding": {
    1: ["가까이 있는 사람에게 주의 전환", "앉아/이리와/손 흔들기 4가지 지시", "10가지 지시 따르기"],
    2: ["신체 부위 지시 + 동작 변별 따르기", "2단계 지시 따르기 (가서 … 가져와)", "서로 관련 없는 3단계 지시"],
    3: ["형용사 포함 3단계 지시 따르기", "시간 관련 지시 이해 (나중에·먼저)", "이야기 듣고 내용 질문 응답"]
  },
  "VP/MTS": {
    1: ["3개 블록 쌓기·3개 고리 끼우기", "3조각 퍼즐 맞추기", "동일 사물-그림 6가지 짝 맞추기"],
    2: ["4가지 색 분류하기", "블록 디자인 모방 10가지", "비동일 그림 25가지 짝 맞추기"],
    3: ["패턴 연속 완성 (ABAB 등)", "연관 사물 짝 맞추기 (숟가락-그릇)", "단어-그림 매칭 10가지"]
  },
  "Play": {
    1: ["다른 장난감으로 독립 놀이 2분", "원인-결과 장난감 조작", "5가지 장난감 기능적 독립 놀이 2분"],
    2: ["연속 놀이 동작 5가지", "가작놀이 2가지 (인형 먹이기·전화하기)", "독립 놀이 10분"],
    3: ["가작놀이 대본 자발 생성", "규칙 있는 보드 게임 참여", "또래와 게임 시 적절 반응"]
  },
  "Social": {
    1: ["성인의 사회적 접촉 수용", "눈맞춤 + 긍정적 정서 5회 이상", "성인의 동작 2가지 이상 자발 모방"],
    2: ["또래 옆에서 독립놀이 2분", "또래에게 자발 Mand 2가지", "또래와 함께 놀이 5분 유지"],
    3: ["또래에게 자발 인사", "대화 3회전 이상 유지", "또래와 협동 놀이 (역할 나누기)"]
  },
  "Motor Imitation": {
    1: ["성인의 대근육 동작 관찰", "사물 이용 동작 2가지 모방", "모터 동작 20가지 모방"],
    2: ["눈·입 관련 미세 모방", "사물 이용 연쇄 동작 모방", "교실 안 기능적 모방 자발 수행"],
    3: ["여러 단계 연쇄 모방", "노래/게임 연속 동작 모방", "미니어처 가상놀이 행동 모방"]
  },
  "Echoic": {
    1: ["어떤 소리든 모방 시도", "자음-모음 조합 5가지 에코", "단어 10가지 에코"],
    2: ["3단어 구 에코", "조음 정확도 80% 이상", "완전한 문장 에코"],
    3: ["운율·강세 적절한 에코", "긴 문장 정확히 에코", "새 단어 즉각 모방"]
  },
  "LRFFC": {
    2: ["기능 단서로 사물 선택 5가지 (뭘로 마시지?)", "특성 단서로 사물 선택 5가지 (날개가 있는 것은?)", "범주 단서로 사물 선택 5가지"],
    3: ["비훈련 항목으로 기능 변별 일반화", "비훈련 항목 특성 변별 일반화", "FFC 통합 50가지 이상 변별"]
  },
  "Intraverbal": {
    2: ["노래·동물소리 빈칸 채우기 5가지", "일상·사회적 질문 대답 5가지", "개방형 WH질문 대답 25가지"],
    3: ["범주 명명 5가지 (과일 뭐가 있지?)", "WH질문 25가지", "두 사물 비교·대조"]
  },
  "Reading": {
    3: ["자기 이름 글자 인식", "10개 이상 글자 이름 말하기", "CVC 단어 해독 5개 이상"]
  },
  "Writing": {
    3: ["자기 이름 쓰기", "글자 따라 쓰기 10개", "간단한 문장 쓰기"]
  },
  "Math": {
    3: ["수 세기 1~5", "수-양 1:1 대응 1~5", "더 많은·더 적은 비교"]
  }
};

const ELCAR_VBMAPP_MAP = [
  { k: "손 씻기", v: "Social", lv: 2 },
  { k: "화장실 사용", v: "Social", lv: 2 },
  { k: "정리", v: "Social", lv: 2 },
  { k: "착석", v: "Listener Responding", lv: 2 },
  { k: "줄 서기", v: "Listener Responding", lv: 2 },
  { k: "인사에 반응", v: "Social", lv: 2 },
  { k: "인사 개시", v: "Social", lv: 3 },
  { k: "눈 맞춤", v: "Social", lv: 2 }, { k: "눈 맞추기", v: "Social", lv: 2 }, { k: "눈맞춤", v: "Social", lv: 2 },
  { k: "차례", v: "Social", lv: 3 },
  { k: "공유", v: "Social", lv: 3 },
  { k: "평행놀이", v: "Play", lv: 2 }, { k: "협동 놀이", v: "Play", lv: 3 },
  { k: "호명 반응", v: "Listener Responding", lv: 1 },
  { k: "지시 따르기", v: "Listener Responding", lv: 2 }, { k: "지시 따르", v: "Listener Responding", lv: 2 },
  { k: "놀이 참여", v: "Play", lv: 2 },
  { k: "도움 구하기", v: "Mand", lv: 2 }, { k: "도움 맨드", v: "Mand", lv: 2 },
  { k: "요청", v: "Mand", lv: 1 },
  { k: "강화제 대기", v: "Listener Responding", lv: 2 },
  { k: "등교", v: "Social", lv: 2 }, { k: "입실", v: "Social", lv: 2 },
  { k: "수정 받아들이기", v: "Social", lv: 3 },
  { k: "불만 받아들이기", v: "Social", lv: 3 },
  { k: "교실 규칙", v: "Listener Responding", lv: 2 },
  { k: "오토클리틱 택트", v: "Tact", lv: 3 },
  { k: "동기조작 변형", v: "Intraverbal", lv: 3 },
  { k: "정보 맨드", v: "Mand", lv: 2 }, { k: "정보맨드", v: "Mand", lv: 2 },
  { k: "초기 화자", v: "Echoic", lv: 2 }, { k: "초기화자", v: "Echoic", lv: 2 },
  { k: "자유 놀이 관찰", v: "Play", lv: 1 }, { k: "자유놀이관찰", v: "Play", lv: 1 },
  { k: "잠재적 강화제", v: "Mand", lv: 1 },
  { k: "공동주의", v: "Listener Responding", lv: 1 },
  { k: "화자 기초", v: "Mand", lv: 1 },
  { k: "시각 자극 통제", v: "VP/MTS", lv: 1 }, { k: "시각자극", v: "VP/MTS", lv: 1 },
  { k: "음성 지시", v: "Listener Responding", lv: 2 }, { k: "음성지시", v: "Listener Responding", lv: 2 },
  { k: "학교 상호작용", v: "Social", lv: 3 },
  { k: "학교 자조", v: "Social", lv: 2 },
  { k: "교수 준비도", v: "Listener Responding", lv: 1 },
  { k: "교수 주의 집중", v: "Listener Responding", lv: 1 },
  { k: "읽기 전 단계", v: "Reading", lv: 3 },
  { k: "읽기·음악·수학", v: "Reading", lv: 3 },
  { k: "쓰는 근육", v: "Motor Imitation", lv: 1 },
  { k: "학급 조작물", v: "Motor Imitation", lv: 2 },
  { k: "오토클리틱", v: "Tact", lv: 3 },
  { k: "동기조작", v: "Intraverbal", lv: 3 },
  { k: "인트라버벌", v: "Intraverbal", lv: 2 },
  { k: "택트", v: "Tact", lv: 2 },
  { k: "맨드", v: "Mand", lv: 2 },
  { k: "에코익", v: "Echoic", lv: 2 }, { k: "에코", v: "Echoic", lv: 2 },
  { k: "모방", v: "Motor Imitation", lv: 1 },
  { k: "매칭", v: "VP/MTS", lv: 2 },
  { k: "일반 지식", v: "Tact", lv: 3 }, { k: "일반지식", v: "Tact", lv: 3 },
  { k: "개념", v: "Intraverbal", lv: 3 },
  { k: "읽기", v: "Reading", lv: 3 },
  { k: "수학", v: "Math", lv: 3 },
  { k: "쓰기", v: "Writing", lv: 3 },
  { k: "대근육", v: "Play", lv: 1 },
  { k: "소근육", v: "Motor Imitation", lv: 1 },
  { k: "LRFFC", v: "LRFFC", lv: 2 }
];

const ELCAR_ESDM_MAP = [
  { k: "손 씻기", v: "자조: 식사", lv: "레벨2(19-24개월)" },
  { k: "화장실", v: "자조: 식사", lv: "레벨3(25-36개월)" },
  { k: "점심 먹기", v: "자조: 식사", lv: "레벨2(19-24개월)" },
  { k: "인사에 반응", v: "사회기술: 어른/친구", lv: "레벨2(19-24개월)" },
  { k: "인사 개시", v: "사회기술: 어른/친구", lv: "레벨3(25-36개월)" },
  { k: "눈 맞춤", v: "사회기술: 어른/친구", lv: "레벨2(19-24개월)" }, { k: "눈 맞추기", v: "사회기술: 어른/친구", lv: "레벨2(19-24개월)" }, { k: "눈맞춤", v: "사회기술: 어른/친구", lv: "레벨2(19-24개월)" },
  { k: "차례", v: "사회기술: 어른/친구", lv: "레벨3(25-36개월)" },
  { k: "공유", v: "사회기술: 어른/친구", lv: "레벨3(25-36개월)" },
  { k: "호명 반응", v: "수용 언어", lv: "레벨1(12-18개월)" },
  { k: "지시 따르", v: "수용 언어", lv: "레벨2(19-24개월)" },
  { k: "평행놀이", v: "놀이", lv: "레벨2(19-24개월)" },
  { k: "협동 놀이", v: "놀이", lv: "레벨3(25-36개월)" },
  { k: "놀이 참여", v: "놀이", lv: "레벨2(19-24개월)" },
  { k: "도움", v: "표현 언어", lv: "레벨2(19-24개월)" },
  { k: "요청", v: "표현 언어", lv: "레벨1(12-18개월)" },
  { k: "착석", v: "수용 언어", lv: "레벨2(19-24개월)" },
  { k: "줄 서기", v: "수용 언어", lv: "레벨2(19-24개월)" },
  { k: "잠재적 강화제", v: "놀이", lv: "레벨1(12-18개월)" },
  { k: "자유 놀이 관찰", v: "놀이", lv: "레벨1(12-18개월)" },
  { k: "공동주의", v: "합동 주시 행동", lv: "레벨2(19-24개월)" },
  { k: "교수 준비도", v: "수용 언어", lv: "레벨1(12-18개월)" },
  { k: "학교 자조", v: "자조: 식사", lv: "레벨2(19-24개월)" },
  { k: "학교 상호작용", v: "사회기술: 어른/친구", lv: "레벨2(19-24개월)" },
  { k: "화자 기초", v: "표현 언어", lv: "레벨1(12-18개월)" },
  { k: "시각 자극 통제", v: "인지", lv: "레벨1(12-18개월)" },
  { k: "음성 지시", v: "수용 언어", lv: "레벨2(19-24개월)" },
  { k: "초기 화자", v: "표현 언어", lv: "레벨2(19-24개월)" },
  { k: "맨드", v: "표현 언어", lv: "레벨2(19-24개월)" },
  { k: "택트", v: "표현 언어", lv: "레벨3(25-36개월)" },
  { k: "인트라버벌", v: "표현 언어", lv: "레벨3(25-36개월)" },
  { k: "모방", v: "모방", lv: "레벨1(12-18개월)" },
  { k: "매칭", v: "인지", lv: "레벨2(19-24개월)" },
  { k: "일반 지식", v: "인지", lv: "레벨3(25-36개월)" }, { k: "일반지식", v: "인지", lv: "레벨3(25-36개월)" },
  { k: "개념", v: "인지", lv: "레벨3(25-36개월)" },
  { k: "읽기", v: "인지", lv: "레벨4(37-48개월)" },
  { k: "수학", v: "인지", lv: "레벨4(37-48개월)" },
  { k: "쓰기", v: "소근육 운동", lv: "레벨3(25-36개월)" },
  { k: "쓰는 근육", v: "소근육 운동", lv: "레벨2(19-24개월)" },
  { k: "학급 조작물", v: "소근육 운동", lv: "레벨3(25-36개월)" },
  { k: "대근육", v: "대근육 운동", lv: "레벨2(19-24개월)" }
];

const ESDM_GOALS = {
  "수용 언어": ["이름 부르면 쳐다보기", "고개 돌려 말하는 사람 바라보기", "간단한 일상적 지시 따르기", "기초적인 공간개념 이해", "2단계 지시 따르기"],
  "표현 언어": ["요청 의미로 손 뻗기", "의도적으로 소리 내기", "명사+동사 2단어 조합", "다양한 자음 소리 자발적", "WH질문에 대답"],
  "합동 주시 행동": ["'이거 봐' 물건 제시 반응", "'저기 봐' 멀리 가리키면 반응", "교사 눈 쳐다보며 물건 주고받기", "자발적으로 물건 보여주기"],
  "사회기술: 어른/친구": ["인사에 반응하기", "눈맞춤 유지", "상대방 요구 시 물건 공유", "놀이시 차례 지키기"],
  "모방": ["물체 활동 8~10가지 모방", "볼 수 있는 동작 10가지 모방", "구강-얼굴 동작 모방", "여러 단계 연쇄 모방"],
  "인지": ["같은 사물끼리 짝 맞추기", "색깔·도형 분류", "범주에 따라 분류", "반대어 이해", "크기·양 개념"],
  "놀이": ["장난감 기능에 맞게 놀기", "놀이 끝내고 치우기", "독립적 놀이 10분", "놀이 주제 따라 행동"],
  "소근육 운동": ["크레파스로 낙서·선·마크", "가위로 종이 자르기", "퍼즐 혼자 맞추기", "블록·레고 따라 만들기"],
  "대근육 운동": ["공 던지기·받기", "한 발로 서기", "점프하기", "목표 지점으로 공차기"],
  "자조: 식사": ["스스로 컵·숟가락 사용", "다양한 음식 먹기", "식사 독립적으로"]
};

function findMapping(elcarText) {
  const t = elcarText || "";
  let vbmapp = null;
  for (const entry of ELCAR_VBMAPP_MAP) {
    if (t.includes(entry.k)) { vbmapp = entry; break; }
  }
  let esdm = null;
  for (const entry of ELCAR_ESDM_MAP) {
    if (t.includes(entry.k)) { esdm = entry; break; }
  }
  return { vbmapp, esdm };
}

function withParticle(word, withFinal, withoutFinal) {
  if (!word) return withoutFinal;
  const last = word.charAt(word.length - 1);
  const code = last.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) {
    return withoutFinal;  // 한글이 아니면 기본 (받침 없음)
  }
  const hasFinal = ((code - 0xAC00) % 28) !== 0;
  return hasFinal ? withFinal : withoutFinal;
}
const josa은는 = (w) => withParticle(w, "은", "는");
const josa을를 = (w) => withParticle(w, "을", "를");
const josa이가 = (w) => withParticle(w, "이", "가");
const josa과와 = (w) => withParticle(w, "과", "와");

function personalizeText(text, childName) {
  if (!text) return text;
  if (!childName || childName === "아동") return text;
  let out = text.replace(/(본|각|이|그|해당|대상)\s*아동/g, "아동");
  const replacements = [
    { re: /아동은/g, particle: () => withParticle(childName, "은", "는") },
    { re: /아동는/g, particle: () => withParticle(childName, "은", "는") },
    { re: /아동이/g, particle: () => withParticle(childName, "이", "가") },
    { re: /아동가/g, particle: () => withParticle(childName, "이", "가") },
    { re: /아동을/g, particle: () => withParticle(childName, "을", "를") },
    { re: /아동를/g, particle: () => withParticle(childName, "을", "를") },
    { re: /아동과/g, particle: () => withParticle(childName, "과", "와") },
    { re: /아동와/g, particle: () => withParticle(childName, "과", "와") },
    { re: /아동의/g, particle: () => "의" },
    { re: /아동에게/g, particle: () => "에게" },
    { re: /아동에/g, particle: () => "에" },
    { re: /아동도/g, particle: () => "도" },
    { re: /아동만/g, particle: () => "만" },
    { re: /아동이라/g, particle: () => "(이)라" }, // 미소 케이스
  ];
  for (const r of replacements) {
    out = out.replace(r.re, () => childName + r.particle());
  }
  out = out.replace(/아동/g, childName);
  return out;
}

function stripSurname(fullName) {
  if (!fullName) return fullName;
  const trimmed = fullName.trim();
  if (trimmed.length < 2) return trimmed;
  const firstChar = trimmed.charAt(0);
  const code = firstChar.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return trimmed;
  return trimmed.slice(1);
}

function nameWithSuffix(name) {
  if (!name) return name;
  const last = name.charAt(name.length - 1);
  const code = last.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return name;
  const hasFinal = ((code - 0xAC00) % 28) !== 0;
  return hasFinal ? name + "이" : name;
}

function buildSummary(stosForReport, info) {
  if (!stosForReport || stosForReport.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";
  const active = stosForReport.filter(s => s.status !== "중단");
  const total = active.length;
  const done = active.filter(s => s.status === "완료").length;
  let lastSum = 0, lastCnt = 0, firstSum = 0, firstCnt = 0;
  active.forEach(s => {
    const pts = s.points || [];
    if (pts.length > 0) {
      const lastV = pts[pts.length - 1].value;
      const firstV = pts[0].value;
      if (typeof lastV === "number" && lastV > 0) { lastSum += lastV; lastCnt++; }
      if (typeof firstV === "number" && firstV > 0) { firstSum += firstV; firstCnt++; }
    }
  });
  const lastAvg = lastCnt > 0 ? Math.round(lastSum / lastCnt) : 0;
  const firstAvg = firstCnt > 0 ? Math.round(firstSum / firstCnt) : 0;
  const diff = lastAvg - firstAvg;
  if (total === 0) {
    return `${fn}${josa은는(fn)} 본 보고 기간에 평가가 진행됐습니다.`;
  } else if (done === total && done > 0) {
    return `${fn}${josa은는(fn)} 본 보고 기간에 ${total}개 단기 목표(STO) 전체에서 준거를 달성해 안정화 단계에 들어갔습니다.`;
  } else if (diff >= 10) {
    return `${fn}${josa은는(fn)} 본 보고 기간에 평균 달성률이 ${firstAvg}%에서 ${lastAvg}%로 +${diff}%p 올랐습니다${done > 0 ? `. ${done}개 목표에서 준거를 달성했습니다` : ""}.`;
  } else if (diff >= 0 && done > 0) {
    return `${fn}${josa은는(fn)} 본 보고 기간에 평균 ${lastAvg}%의 정반응률을 유지했고, ${total}개 STO 중 ${done}개에서 준거를 달성했습니다.`;
  } else if (done > 0) {
    return `${fn}${josa은는(fn)} 본 보고 기간에 ${total}개 STO 중 ${done}개에서 준거를 달성했습니다.`;
  } else {
    return `${fn}${josa은는(fn)} 본 보고 기간에 평균 ${lastAvg}%의 정반응률을 보였고, 기초선 형성 단계에서 진행되고 있습니다.`;
  }
}

function buildBehaviorChange(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";

  const KEY_DESC = {
    "떼쓰기 감소":          `치료 시작 시 일과 변화나 거절 상황에서 자주 나타나던 떼쓰기 행동이 종결 시점에는 빈도와 강도 모두 눈에 띄게 줄었습니다`,
    "공격·자해 행동 감소":   `초기에 좌절 상황에서 보이던 공격적인 행동이나 자해 시도가 치료 중 대체 행동 학습을 거치면서 종결 시점에는 거의 나오지 않습니다`,
    "자기자극 행동 감소":    `반복적인 자기자극 행동이 학습 활동을 방해하던 초기와 비교해, 종결 시점에는 활동 참여가 가능한 수준으로 안정됐습니다`,
    "정서 표현 안정화":      `좌절·불안 상황에서 즉각적인 정서 폭발로 표현되던 양상이 점차 말이나 표정으로 감정을 전달하려는 시도로 바뀌었습니다`,
    "전환 상황 적응 향상":   `환경이나 일과 변화에 거부 반응이 두드러졌던 초기와 비교해, 종결 시점에는 새로운 상황을 비교적 수월하게 받아들이는 모습입니다`,
    "수면·식사 패턴 안정":   `초기에 보였던 수면·식사 패턴의 불안정함이 가정 지원과 학습 환경 적응을 거치며 점차 안정됐습니다`,
    "언어로 의사 표현 시도 증가": `이전에는 행동으로만 표현되던 욕구나 거부의 메시지가 종결 시점에는 단어·짧은 문장 등 언어적 표현으로 바뀌는 빈도가 늘었습니다`,
    "특이 문제행동 없음":    `본 치료 기간 중 임상적으로 문제가 되는 행동은 관찰되지 않았으며, 일상적 행동 외에 별도의 중재가 필요한 상황은 없었습니다`
  };

  const phrases = selected.map(l => KEY_DESC[l]).filter(Boolean);
  if (phrases.length === 0) return "";

  const intro = `${fn}${이가(fn)} 본 치료 기간에 보인 문제행동의 변화는 다음과 같습니다.`;

  let body;
  if (phrases.length === 1) {
    body = `${phrases[0]}.`;
  } else {
    body = phrases.map(p => `${p}.`).join(" ");
  }

  let closing;
  if (selected.includes("특이 문제행동 없음") && selected.length === 1) {
    closing = `${fn}${이가(fn)} 학습 환경에 잘 적응하면서 정서와 행동을 적절히 조절했음을 나타냅니다.`;
  } else if (phrases.length >= 2) {
    closing = `이 변화들은 ${fn}${이가(fn)} 감정과 욕구를 더 적응적인 방식으로 표현하게 됐다는 의미입니다.`;
  } else {
    closing = `이 변화는 ${fn}${이가(fn)} 감정과 욕구를 더 적응적으로 표현하게 됐다는 의미입니다.`;
  }

  return `${intro} ${body} ${closing}`;
}

function buildRecommendations(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 을를 = (w) => has받침(w) ? "을" : "를";

  const KEY_DESC = {
    "후속 ABA 치료 권고":          { cat: "therapy",    desc: `${fn}의 안정적인 발달과 학습 기술 일반화를 위해, 적당한 시점에 후속 ABA 치료를 검토해 주시기를 권합니다. 종결 후에도 필요하시면 단기 집중 회기나 컨설팅을 받으실 수 있습니다` },
    "언어치료 병행 권고":          { cat: "therapy",    desc: `의사소통 발달을 위해 언어치료 병행을 권합니다. ${fn}의 표현·수용 언어 발달에 전문적인 지원이 더해지면 도움이 됩니다` },
    "감각통합치료 병행 권고":      { cat: "therapy",    desc: `감각 처리 안정과 일상 활동 참여를 위해 감각통합치료 병행을 권합니다` },
    "유치원·학교 입학 후 적응 모니터링": { cat: "transition", desc: `유치원·학교 등 새 환경에 입학한 뒤 적응 과정을 살펴봐 주시기를 권합니다. 초기 적응 시기의 어려움은 일찍 개입할수록 효과적입니다` },
    "일반화·유지 위한 재평가":     { cat: "monitor",    desc: `학습 기술의 일반화와 유지 상태를 확인하기 위해 약 6개월 후 재평가를 받아보시기를 권합니다. 객관적인 평가로 다음 단계를 잡아갈 수 있습니다` },
    "가정 내 행동지원 지속":       { cat: "family",     desc: `종결 후에도 가정에서 일관된 행동지원을 이어가 주시는 게 중요합니다. 본 보고서의 가정 유지 방안을 참고하셔서 ${fn}의 발달이 끊기지 않도록 지원해 주세요` },
    "또래 상호작용 기회 확대 권고": { cat: "family",     desc: `또래와의 상호작용 기회를 늘려 주시기를 권합니다. 놀이터·소그룹 활동·또래 만남을 통해 ${fn}${josa이가(fn)} 사회적 기술을 일상에서 연습할 수 있도록 도와주세요` },
    "필요 시 BCBA 컨설팅 재개":    { cat: "monitor",    desc: `도전 행동이 다시 늘거나 학습한 기술이 퇴행하는 모습이 보이면, 가능한 빨리 BCBA(행동분석전문가) 컨설팅을 의뢰해 주세요` }
  };

  const CAT_NAMES = {
    therapy:    "후속 치료 권고",
    transition: "환경 전환기 지원",
    monitor:    "정기 점검과 재평가",
    family:     "가정과 사회적 환경에서의 지속"
  };
  const CAT_ORDER = ["therapy", "transition", "family", "monitor"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `${fn}의 본 치료 종결과 관련해서, 앞으로의 발달과 적응을 위해 다음을 권해드립니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) {
      return `${heading}\n${descs[0]}.`;
    }
    const paragraphed = descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ");
    return `${heading}\n${paragraphed}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `위 권고는 ${fn}의 현재 발달 상황과 가정 환경을 고려한 안내입니다. 어려움이 생기시거나 추가 상담이 필요하시면 본 센터로 문의해 주세요.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`.replace(/이\(가\)/g, 이가(fn));
}

function buildHandover(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";

  const KEY_DESC = {
    "사회적 강화에 잘 반응":           { cat: "reinforce", desc: `칭찬, 박수, 하이파이브, 짧은 칭찬 말에 잘 반응합니다. 별도의 물질적 강화제 없이도 학습 동기를 유지할 수 있어, 자연 강화제를 활용하시기를 권합니다` },
    "선호 간식 효과적":                { cat: "reinforce", desc: `좋아하는 간식이 강한 동기가 됩니다. 학습 직전이나 직후에 짧게 제공하면 효과가 좋습니다 (보호자와 미리 협의된 간식만)` },
    "토큰 시스템 활용":                { cat: "reinforce", desc: `토큰을 모아 좋아하는 활동으로 교환하는 토큰 시스템이 효과적이었습니다. 진행 상황이 눈으로 보이는 게 학습 지속에 도움이 되는 유형입니다` },
    "캐릭터·스티커 선호":              { cat: "preference", desc: `특정 캐릭터나 스티커를 좋아합니다. 학습 자료에 캐릭터를 쓰면 흥미와 집중도가 올라갑니다` },
    "음악·노래 활동 선호":             { cat: "preference", desc: `음악이나 노래가 들어간 활동에 적극적으로 참여합니다. 새 개념을 노래로 만들면 빨리 익히는 강점이 있습니다` },
    "신체 활동 좋아함":                { cat: "preference", desc: `움직임이 많은 활동, 신체 놀이, 점프·달리기 같은 대근육 활동을 좋아합니다. 학습 사이에 짧은 신체 휴식이 집중력 회복에 효과적입니다` },
    "구조화된 환경 필요":              { cat: "caution",   desc: `학습 환경이 명확하게 구조화돼 있을 때 가장 안정적으로 참여합니다. 시각적 일정표, 활동 순서 안내, 일관된 좌석 배치 같은 환경 구조화가 중요합니다` },
    "전환 시 사전 예고 필요":          { cat: "caution",   desc: `활동 전환이나 환경 변화 시 사전 예고가 필요합니다. "5분 후에 끝낼 거예요", "다음에는 ○○를 할 거예요" 같은 안내가 적응에 도움이 됩니다` },
    "특정 자극에 민감":                { cat: "caution",   desc: `특정 감각 자극(큰 소리, 강한 빛, 붐비는 환경 등)에 민감하게 반응할 수 있습니다. 새 환경 적응 시 점진적 노출과 안전 신호 마련을 권합니다` },
    "낯가림·새 환경 적응 시간 필요":   { cat: "caution",   desc: `처음 만나는 사람이나 새 환경에서 적응에 시간이 걸리는 편입니다. 초기 1~2회는 짧게 관찰·라포 형성 위주로 진행하시기를 권합니다` },
    "공동 주의 단서 효과적":           { cat: "strategy",  desc: `눈맞춤·손가락 가리키기 같은 공동 주의 단서를 활용하면 지시 따르기와 학습 효과가 좋아집니다` },
    "촉구 단계적 소거 효과":           { cat: "strategy",  desc: `신체 촉구 → 모델링 → 언어 촉구 순으로 단계적으로 촉구를 줄였을 때(prompt fading) 가장 안정적으로 학습이 됐습니다` }
  };

  const CAT_NAMES = {
    reinforce:  "효과적인 강화 방식",
    preference: "선호 활동·자극",
    caution:    "주의사항·환경 고려 요인",
    strategy:   "효과적이었던 중재 전략"
  };
  const CAT_ORDER = ["reinforce", "preference", "strategy", "caution"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `${fn}${이가(fn)} 본 치료 종결 후 다른 기관(유치원, 학교, 후속 치료 기관 등)에서도 잘 적응하고 학습할 수 있도록, 치료 기간 중에 관찰한 ${fn}의 특성과 효과가 좋았던 접근 방식을 정리해 드립니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) {
      return `${heading}\n${descs[0]}.`;
    }
    const paragraphed = descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ");
    return `${heading}\n${paragraphed}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `위 내용은 ${fn}${이가(fn)} 본 센터의 치료 기간에 관찰된 특성을 바탕으로 정리한 안내입니다. 새 환경에서는 충분한 적응 시간을 두고 단계적으로 접근해 주시기를 권합니다. 추가 정보나 인계 관련 상담이 필요하시면 본 센터로 문의해 주세요.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildInterimSummary(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";

  const KEY_DESC = {
    "표현 언어 향상":         { cat: "lang",   desc: `원하는 것을 말로 표현하거나 의사를 전달하는 빈도가 늘고 있습니다` },
    "수용 언어 안정":         { cat: "lang",   desc: `간단한 지시나 일상 대화 내용을 이해하고 적절히 반응하는 능력이 안정적입니다` },
    "발성 다양화":            { cat: "lang",   desc: `단어 수준의 발성에서 짧은 구·문장 수준으로 발화 길이와 다양성이 늘고 있습니다` },
    "비구어 → 구어 전환":     { cat: "lang",   desc: `이전에 행동이나 몸짓으로만 표현하던 의사가 점차 음성 언어로 바뀌고 있습니다` },
    "또래 관심 증가":         { cat: "social", desc: `또래의 활동에 관심을 보이고 가까이 가려는 시도가 늘고 있습니다` },
    "공동주의 형성":          { cat: "social", desc: `다른 사람과 같은 대상을 바라보거나 손가락 가리키기에 반응하는 공동주의 행동이 나오고 있습니다` },
    "차례 지키기 습득":       { cat: "social", desc: `놀이나 활동에서 자기 차례를 기다리고 다른 사람의 차례를 인정하는 사회적 규칙을 익히고 있습니다` },
    "눈맞춤 안정":            { cat: "social", desc: `대화나 활동 중 눈맞춤을 주고받는 빈도가 안정적입니다` },
    "도전 행동 감소":         { cat: "behav",  desc: `좌절·전환 상황에서 나타나던 떼쓰기·자해·공격 행동의 빈도와 강도가 줄고 있습니다` },
    "정서 안정":              { cat: "behav",  desc: `감정 변화의 폭이 안정되고, 좌절 상황에서도 적응적으로 대처하려는 모습이 관찰됩니다` },
    "전환 적응 향상":         { cat: "behav",  desc: `활동이나 환경 전환 시 거부 반응이 줄고, 사전 안내가 있으면 비교적 잘 받아들입니다` },
    "지시 따르기 안정":       { cat: "learn",  desc: `다양한 단계의 지시를 이해하고 따라하는 능력이 안정적입니다` },
    "학습 참여 시간 증가":    { cat: "learn",  desc: `착석 학습 시간과 활동 참여 지속 시간이 늘고 있습니다` },
    "선호 활동 다양화":       { cat: "learn",  desc: `이전에 관심 없던 활동에도 흥미를 보이며, 활동 폭이 넓어지고 있습니다` },
    "촉구 단계 감소":         { cat: "learn",  desc: `학습 활동에서 필요한 촉구의 강도가 줄고, 자발적 수행 비율이 늘고 있습니다` }
  };

  const CAT_NAMES = {
    lang:   "의사소통",
    social: "사회적 상호작용",
    behav:  "행동 조절",
    learn:  "학습 참여"
  };
  const CAT_ORDER = ["lang", "social", "behav", "learn"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `${fn}${은는(fn)} 본 보고 기간에 다음과 같은 발달 양상을 보이고 있습니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) {
      return `${heading}\n${descs[0]}.`;
    }
    const paragraphed = descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ");
    return `${heading}\n${paragraphed}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `이 발달 양상은 ${fn}${이가(fn)} 본 치료에 참여하면서 학습이 진행되고 있음을 나타내며, 다음 단계로 넘어갈 기반이 잡혀가고 있습니다.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildInterimGrowth(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";

  const KEY_DESC = {
    "초기 대비 큰 폭 향상":      { cat: "achievement", desc: `보고 기간 시작 시점과 비교해 여러 영역에서 뚜렷한 향상이 보입니다. 학습한 기술이 안정적으로 자리잡고 있습니다` },
    "마일스톤 달성":             { cat: "achievement", desc: `중요한 발달 마일스톤이 본 보고 기간에 새로 달성됐고, 다음 단계로 넘어갈 기반이 잡혔습니다` },
    "꾸준한 점진적 성장":        { cat: "achievement", desc: `단기간의 큰 변화는 아니지만 회기마다 조금씩 진전이 쌓이고 있어, 학습 곡선이 안정적입니다` },
    "강점 영역 확장":            { cat: "strength",    desc: `안정적으로 자리잡았던 강점 영역이 다양한 상황과 맥락으로 확장되고 있습니다` },
    "새로운 관심사 등장":        { cat: "strength",    desc: `이전에 관심 없던 영역이나 활동에 새로 흥미를 보이는 모습이 관찰돼, 학습의 폭이 넓어지고 있습니다` },
    "자발적 시도 증가":          { cat: "strength",    desc: `촉구 없이 스스로 시도하는 자발성의 빈도가 늘고, 학습에 능동적인 태도가 잡혀가고 있습니다` },
    "도전 영역 진전":            { cat: "challenge",   desc: `초기에 어려워했던 영역에서도 진전이 보여, 다양한 학습 상황에서 적응력이 늘고 있습니다` },
    "변화·전환 적응 향상":       { cat: "challenge",   desc: `이전에 어려워했던 환경 변화나 일과 전환 상황에 적응력이 늘었고, 일상의 다양한 상황에서 더 안정적입니다` },
    "정서·행동 자기조절 향상":  { cat: "challenge",   desc: `좌절이나 불안 상황에서 스스로 감정과 행동을 조절하는 능력이 늘었고, 회복 시간이 짧아지고 있습니다` },
    "가정·기관 연계 강화":       { cat: "context",     desc: `센터에서 익힌 기술이 가정과 기관 등 다양한 환경에서도 나오기 시작했고, 일반화가 잡혀가고 있습니다` },
    "또래 관계 발전":            { cat: "context",     desc: `또래와의 상호작용 빈도와 질이 늘었고, 사회적 환경에서의 적응력이 자리잡고 있습니다` }
  };

  const CAT_NAMES = {
    achievement: "주요 성취",
    strength:    "강점의 발전",
    challenge:   "도전 영역의 진전",
    context:     "맥락 확장과 일반화"
  };
  const CAT_ORDER = ["achievement", "strength", "challenge", "context"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `본 보고 기간에 ${fn}${은는(fn)} 다음과 같은 변화를 보였습니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) {
      return `${heading}\n${descs[0]}.`;
    }
    const paragraphed = descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ");
    return `${heading}\n${paragraphed}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `이 변화는 ${fn}의 학습 수행 능력이 단계적으로 늘고 있음을 나타내며, 다음 회기에서도 단계적으로 접근하겠습니다.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildInterimHomeCoop(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";

  const KEY_DESC = {
    "센터 학습 기술 가정 적용": { cat: "reinforce", desc: `센터에서 학습한 기술을 가정에서도 활용할 수 있도록, 일상 대화 내에 학습 기회를 마련해 주시기를 권해드립니다` },
    "긍정적 강화 일관성":        { cat: "reinforce", desc: `${fn}${이가(fn)} 적절한 행동을 보일 때 즉각적인 칭찬과 관심을 표현해 주십시오. 가정에서의 일관된 강화가 학습 효과 향상에 기여합니다` },
    "일상 루틴 안에서 연습":      { cat: "routine",   desc: `식사·놀이·외출 등 일상 활동 내에서 학습 기술을 연습할 기회를 마련해 주십시오` },
    "사진·시각 단서 활용":        { cat: "routine",   desc: `필요에 따라 시각적 일정표나 사진 단서를 활용하시면 ${fn}${이가(fn)} 다음 활동을 예측하고 적응하는 데 도움이 됩니다` },
    "주간 진행 상황 공유":        { cat: "communication", desc: `주 1회 정도 가정에서 관찰된 ${fn}의 변화나 어려움을 본 센터와 공유해 주시면 회기 계획에 반영됩니다` },
    "행동 일지 기록":             { cat: "communication", desc: `특정 도전 행동이나 신규 변화 관찰 시 간단한 메모를 기록해 주시기를 권해드립니다. 작은 기록도 다음 회기 진행에 도움이 됩니다` },
    "구조화된 환경 제공":         { cat: "environment",   desc: `${fn}의 학습이 안정적으로 진행되도록, 가정에서도 예측 가능한 일과와 명확한 환경 구조를 유지해 주십시오` },
    "또래 만남 기회 마련":        { cat: "environment",   desc: `놀이터나 또래 활동 등 사회적 상호작용 기회를 정기적으로 마련해 주시면 사회적 기술 발달에 도움이 됩니다` },
    "도전 행동 시 차분한 대응":   { cat: "challenge", desc: `도전 행동 발생 시 즉각 반응을 자제하시고, 적절한 대체 행동이 나타날 때 즉시 관심과 칭찬을 표현해 주십시오` },
    "전환 시 사전 예고":          { cat: "challenge", desc: `활동 전환이나 외출 등 환경 변화 시 사전 예고를 제공하시면 ${fn}${이가(fn)} 더 안정적으로 적응할 수 있습니다` }
  };

  const CAT_NAMES = {
    reinforce:     "일관된 강화와 동기 유지",
    routine:       "일상 루틴 안에서의 학습",
    communication: "센터-가정 소통",
    environment:   "환경 구조화와 기회 마련",
    challenge:     "도전 상황에서의 대응"
  };
  const CAT_ORDER = ["reinforce", "routine", "communication", "environment", "challenge"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `${fn}${이가(fn)} 본 치료에서 습득하는 기술이 가정에서도 적용·확장될 수 있도록, 다음 협력 방안을 안내드립니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) {
      return `${heading}\n${descs[0]}.`;
    }
    const paragraphed = descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ");
    return `${heading}\n${paragraphed}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `위 방안은 ${fn}의 발달 상황과 가정 환경에 맞춰 유연하게 조정해 주시기 바라며, 가정과 센터가 같은 방식으로 가는 것이 학습 효과 유지에 중요합니다.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildInterimNextGoal(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";

  const KEY_DESC = {
    "표현 언어 확장":      { cat: "lang",    desc: `현재 형성된 표현 언어 기반을 바탕으로, 단어에서 짧은 구·문장 수준으로 발화 길이와 다양성을 늘려가는 것을 다음 목표로 합니다` },
    "수용 언어 정교화":    { cat: "lang",    desc: `복잡한 지시 따르기, 다단계 요구 이해 등 수용 언어의 정교한 발달을 다음 단계로 진행합니다` },
    "사회적 상호작용 확장": { cat: "social",  desc: `또래·소그룹 환경에서의 상호작용 빈도와 질을 늘리는 것을 다음 목표로 합니다` },
    "공동 활동 참여 향상":  { cat: "social",  desc: `또래나 가족과 함께하는 협동 활동·놀이에 능동적으로 참여하는 능력을 단계적으로 확장합니다` },
    "다양한 환경 일반화":   { cat: "general", desc: `센터에서 익힌 기술이 가정·기관·외부 환경 등 다양한 맥락에서도 안정적으로 나오도록 일반화 목표를 잡습니다` },
    "다른 사람과의 일반화": { cat: "general", desc: `학습한 기술을 치료사 외의 다른 사람(보호자, 또래, 교사 등)과의 상호작용에서도 나오도록 일반화 단계로 확장합니다` },
    "자발적 시도 강화":     { cat: "autonomy", desc: `촉구에 의존하지 않고 스스로 시도하는 자발적 행동의 빈도와 다양성을 늘려가는 것을 다음 목표로 합니다` },
    "선택·결정 기회 확대":   { cat: "autonomy", desc: `${fn}${이가(fn)} 스스로 선택하고 결정할 기회를 늘려, 자기결정 능력의 기초를 만듭니다` },
    "도전 행동 안정화":     { cat: "challenge", desc: `현재 진행 중인 도전 행동 중재의 결과를 유지하고 잔존 빈도를 더 줄이는 것을 다음 목표로 합니다` },
    "전환·변화 적응 강화":  { cat: "challenge", desc: `다양한 환경·일과 변화 상황에 대한 적응력을 더 강화해서, 일상의 여러 상황에서 안정적으로 기능할 수 있도록 지원합니다` },
    "학습 준비 기술 강화":  { cat: "school",  desc: `유치원·학교 환경 적응을 위한 학습 준비 기술(착석, 집단 지시 따르기, 차례 기다리기 등)을 단계적으로 강화합니다` },
    "또래 환경 적응":       { cat: "school",  desc: `또래 집단 환경에서의 적응과 참여 능력 향상을 다음 단계의 목표로 잡습니다` }
  };

  const CAT_NAMES = {
    lang:      "의사소통 영역",
    social:    "사회적 상호작용 영역",
    general:   "기술의 일반화",
    autonomy:  "자발성과 자기결정",
    challenge: "도전 영역의 안정화",
    school:    "학교·기관 환경 준비"
  };
  const CAT_ORDER = ["lang", "social", "challenge", "general", "autonomy", "school"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `${fn}${이가(fn)} 지금까지의 학습 진행과 다음 단계 발달 과제를 정리해서, 다음 회기에서는 다음 방향으로 진행할 예정입니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) {
      return `${heading}\n${descs[0]}.`;
    }
    const paragraphed = descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ");
    return `${heading}\n${paragraphed}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `위 목표는 ${fn}의 현재 발달 수준과 학습 진행을 고려해서 단계적으로 접근할 예정이며, 회기 진행 상황을 보면서 조정해 가겠습니다.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildInterimStrengths(domAvgs, stos, info) {
  if (!Array.isArray(domAvgs) || domAvgs.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";
  const 을를 = (w) => has받침(w) ? "을" : "를";

  const strengths = [];

  const highDomains = domAvgs.filter(d => d.value >= 80);
  if (highDomains.length >= 2) {
    const names = highDomains.slice(0, 3).map(d => d.name).join("·");
    strengths.push({
      title: "여러 영역의 안정적 수행",
      desc: `${names} 영역에서 일관되게 높은 수행이 나오고 있어, ${fn}${이가(fn)} 학습한 내용을 안정적으로 활용할 수 있는 기반이 있습니다.`
    });
  } else if (highDomains.length === 1) {
    const d = highDomains[0];
    strengths.push({
      title: `${d.name} 영역의 안정적 수행`,
      desc: `${d.name} 영역에서 안정적인 수행이 나오고 있어, ${fn}의 강점 영역으로 확인됩니다.`
    });
  }

  const activeStos = (stos || []).filter(s => !s.isPaused);
  const masteredCount = activeStos.filter(s => s.isMastered).length;
  if (masteredCount >= 5) {
    strengths.push({
      title: "체계적인 학습 진행",
      desc: `이번 보고 기간에 총 ${masteredCount}개 활동에서 준거를 달성해, ${fn}${이가(fn)} 단계적으로 학습 내용을 습득하고 있습니다.`
    });
  } else if (masteredCount >= 2) {
    strengths.push({
      title: "단계적 성취",
      desc: `${masteredCount}개 활동에서 준거를 달성해, ${fn}${이가(fn)} 단계적으로 학습이 진행되고 있습니다.`
    });
  }

  const withGrowth = activeStos.filter(s => {
    const pts = s.points || [];
    if (pts.length < 2) return false;
    const first = pts[0]?.value;
    const last = pts[pts.length - 1]?.value;
    return typeof first === "number" && typeof last === "number" && (last - first) >= 20;
  });
  if (withGrowth.length >= 3) {
    strengths.push({
      title: "여러 영역의 향상",
      desc: `${withGrowth.length}개 이상의 활동에서 초기 대비 향상이 보여, ${fn}의 학습 진행이 데이터로 확인됩니다.`
    });
  } else if (withGrowth.length >= 1) {
    const exemplar = withGrowth[0];
    const first = exemplar.points[0].value;
    const last = exemplar.points[exemplar.points.length - 1].value;
    strengths.push({
      title: "구체적 향상 사례",
      desc: `'${exemplar.name}' 활동에서 ${first}%에서 ${last}%로 향상돼, ${fn}의 학습 진행이 데이터로 확인됩니다.`
    });
  }

  if (domAvgs.length >= 4) {
    const avgValue = domAvgs.reduce((s, d) => s + d.value, 0) / domAvgs.length;
    const stdDev = Math.sqrt(
      domAvgs.reduce((s, d) => s + Math.pow(d.value - avgValue, 2), 0) / domAvgs.length
    );
    if (stdDev < 15 && avgValue >= 50) {
      strengths.push({
        title: "영역 간 균형",
        desc: `의사소통·사회성·행동 등 여러 영역에서 균형 있는 발달 양상이 보여, ${fn}${이가(fn)} 한 영역에 치우치지 않고 전반적으로 진행되고 있습니다.`
      });
    }
  }

  if (strengths.length === 0) {
    return `${fn}${은는(fn)} 본 보고 기간에 매 회기 참여하면서 학습이 단계적으로 진행되고 있습니다.`;
  }

  const intro = `${fn}${이가(fn)} 본 보고 기간에 보인 강점은 다음과 같습니다.`;
  const items = strengths.map(s => `▸ ${s.title}\n${s.desc}`).join("\n\n");
  const closing = `이 강점은 ${fn}의 학습 특성을 나타내는 지표이며, 다음 학습 방향 설정에 활용하겠습니다.`;

  return `${intro}\n\n${items}\n\n${closing}`;
}

function buildInterimHighlights(domAvgs, stos, info, dailyMemos) {
  if (!Array.isArray(stos) || stos.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";

  const highlights = [];
  const activeStos = stos.filter(s => !s.isPaused);

  const withGrowth = activeStos
    .filter(s => {
      const pts = s.points || [];
      if (pts.length < 2) return false;
      const first = pts[0]?.value;
      const last = pts[pts.length - 1]?.value;
      return typeof first === "number" && typeof last === "number" && (last - first) >= 25;
    })
    .map(s => {
      const pts = s.points;
      const first = pts[0].value;
      const last = pts[pts.length - 1].value;
      return { name: s.name, first, last, diff: last - first, domain: s.domain };
    })
    .sort((a, b) => b.diff - a.diff);

  if (withGrowth.length > 0) {
    const top = withGrowth[0];
    highlights.push({
      title: `'${top.name}' 활동의 향상`,
      desc: `초기 ${top.first}%에서 최근 ${top.last}%까지 올라가, ${fn}${이가(fn)} 단계적 연습으로 수행 능력이 늘고 있음이 확인됩니다.`
    });
  }

  const masteredRecent = activeStos
    .filter(s => s.isMastered && s.points && s.points.length > 0)
    .map(s => {
      const lastPt = s.points[s.points.length - 1];
      return { name: s.name, finalRate: lastPt?.value || 0, domain: s.domain };
    })
    .sort((a, b) => b.finalRate - a.finalRate)
    .slice(0, 2);

  if (masteredRecent.length >= 2) {
    const names = masteredRecent.map(m => `'${m.name}'`).join(", ");
    highlights.push({
      title: "여러 활동의 안정적 수행",
      desc: `${names} 등 여러 활동에서 일관된 수행이 나와, ${fn}${이가(fn)} 학습 내용을 안정적으로 적용하고 있음이 확인됩니다.`
    });
  } else if (masteredRecent.length === 1) {
    const m = masteredRecent[0];
    highlights.push({
      title: `'${m.name}' 활동의 안정적 수행`,
      desc: `연속 회기에서 일관된 수행이 나와, ${fn}${이가(fn)} 해당 활동에서 준거 수준에 도달했음이 확인됩니다.`
    });
  }

  const fastClimb = activeStos.filter(s => {
    const pts = s.points || [];
    if (pts.length < 3 || pts.length > 6) return false;
    const last = pts[pts.length - 1]?.value;
    return typeof last === "number" && last >= 80;
  });

  if (fastClimb.length > 0 && highlights.length < 3) {
    const ex = fastClimb[0];
    highlights.push({
      title: `'${ex.name}' 활동에 빠른 적응`,
      desc: `학습 시작 후 단기간에 안정적인 수행이 나와, ${fn}${이가(fn)} 새 학습 내용에 빠르게 적응했습니다.`
    });
  }

  if (dailyMemos && typeof dailyMemos === "object" && highlights.length < 3) {
    const POSITIVE_KEYWORDS = ["처음으로", "스스로", "자발적", "자발", "먼저", "혼자", "스스럼", "능숙", "정확히", "또렷", "분명히"];
    const memoEntries = Object.entries(dailyMemos);
    for (const [date, memo] of memoEntries) {
      if (typeof memo !== "string" || !memo.trim()) continue;
      for (const kw of POSITIVE_KEYWORDS) {
        if (memo.includes(kw)) {
          const sentences = memo.split(/[.!?。]/);
          const targetSentence = sentences.find(s => s.includes(kw));
          if (targetSentence && targetSentence.trim().length >= 5 && targetSentence.trim().length <= 80) {
            const cleanSentence = targetSentence.trim().replace(/^[\s,;:]+|[\s,;:]+$/g, "");
            highlights.push({
              title: "회기 중 관찰 사항",
              desc: `${date} 회기에서 "${cleanSentence}"라는 양상이 관찰됐습니다.`
            });
            break;
          }
        }
      }
      if (highlights.length >= 3) break;
    }
  }

  if (highlights.length === 0) {
    return "";  // 하이라이트 없으면 섹션 자체를 생략
  }

  const intro = `본 보고 기간에 ${fn}${이가(fn)} 보인 주요 변화는 다음과 같습니다.`;
  const items = highlights.map(h => `▸ ${h.title}\n${h.desc}`).join("\n\n");
  const closing = `이 변화는 ${fn}의 학습이 단계적으로 진행되고 있음을 나타냅니다.`;

  return `${intro}\n\n${items}\n\n${closing}`;
}

function buildHomeMaintenance(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";
  const 을를 = (w) => has받침(w) ? "을" : "를";

  const KEY_DESC = {
    "일관된 강화 유지":           { cat: "reinforce",      desc: `${fn}${이가(fn)} 적절한 행동을 보일 때 바로 칭찬과 관심을 보여 주세요. 물질적 강화제보다 언어적 칭찬, 사회적 강화가 장기적으로 더 잘 유지됩니다` },
    "일상 루틴에 통합":           { cat: "routine",        desc: `학습한 기술이 회기 내에서만 머물지 않도록, 식사·놀이·외출 같은 일상 활동에서 적용 기회를 만들어 주세요. 식사 때 요청하기, 놀이 중 차례 지키기 같은 식으로 일상 흐름에 넣으시면 됩니다` },
    "가족 모두 같은 방식 적용":   { cat: "consistency",    desc: `보호자와 다른 양육자가 같은 방식으로 일관되게 대응해 주시는 게 중요합니다. ${fn}${이가(fn)} 어떤 상황에서도 같은 기준과 반응을 경험할 때 학습한 행동이 유지됩니다` },
    "선호 활동을 활용":           { cat: "reinforce",      desc: `${fn}${이가(fn)} 좋아하는 놀이나 활동을 학습과 연결해 주시면 자연스러운 동기가 됩니다. 좋아하는 책 보기 전에 간단한 지시 따르기, 좋아하는 간식 전에 요청하기 같은 식으로 학습 기회를 만들어 주세요` },
    "일반화 환경 다양화":         { cat: "generalization", desc: `센터에서 익힌 기술이 가정 외의 다양한 환경에서도 나오도록, 마트·공원·친척 집 등 새 장소에서도 같은 기술을 연습할 기회를 만들어 주세요` },
    "도전 행동 발생 시 무관심 후 대안 행동 강화": { cat: "regression", desc: `도전 행동이 다시 나올 때는 그 행동에 바로 반응하지 마시고, ${fn}${이가(fn)} 적절한 대체 행동을 보일 때 바로 칭찬과 관심을 주세요` },
    "정기적 부모 모니터링":       { cat: "monitor",        desc: `주 1회 정도 ${fn}의 행동과 학습 기술 유지 상태를 짧게 점검하고 메모로 남겨 주세요. 작은 변화도 기록해 두시면 다음 단계 검토에 도움이 됩니다` },
    "퇴행 시 즉시 ABA 치료 재개 검토": { cat: "regression", desc: `일정 기간 이상 학습한 기술이 퇴행하거나 새 도전 행동이 늘어나면, 가능한 빨리 ABA 치료 재개나 컨설팅을 검토해 주세요. 일찍 개입하는 게 효과적입니다` },
    "또래 상호작용 기회 정기 마련": { cat: "social",        desc: `놀이터·또래 만남·소그룹 활동 같은 기회를 정기적으로 만들어 주시면 사회적 기술 발달에 도움이 됩니다. ${fn}${josa이가(fn)} 또래 안에서 어울리도록 격려해 주세요` },
    "시각적 일정표·사진 단서 활용": { cat: "routine",        desc: `필요하시면 시각적 일정표나 사진 단서를 활용해 주세요. ${fn}${이가(fn)} 다음에 일어날 일을 예측하고 전환 상황에 적응하는 데 도움이 됩니다` }
  };

  const CAT_NAMES = {
    reinforce:      "일상 속 강화와 동기 유지",
    routine:        "일상 루틴 안에서의 기술 통합",
    consistency:    "일관성 있는 양육 환경",
    generalization: "다양한 환경으로의 일반화",
    monitor:        "정기적인 점검과 기록",
    regression:     "퇴행이나 도전 행동에 대한 대처",
    social:         "또래·사회적 기회 마련"
  };
  const CAT_ORDER = ["consistency", "reinforce", "routine", "generalization", "social", "monitor", "regression"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `${fn}${이가(fn)} 본 치료에서 익힌 기술이 가정에서도 유지·확장되도록, 다음 방안을 안내드립니다.`;

  const buildCatPara = (cat, descs) => {
    const intro = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) {
      return `${intro}\n${descs[0]}.`;
    }
    const paragraphed = descs.map((d, i) => {
      if (i === 0) return d + ".";
      return "또한 " + d + ".";
    }).join(" ");
    return `${intro}\n${paragraphed}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `위 방안은 ${fn}의 발달 상황과 가정 환경에 맞춰 조정해 주시기 바라며, 일관성 있게 적용하시는 게 효과 유지에 중요합니다. 어려움이 생기시면 본 센터로 문의해 주세요.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildIepReferralReason(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const KEY_DESC = {
    "표현 언어 지연":          { cat: "lang",   desc: "원하는 것을 언어로 표현하거나 의사를 전달하는 데 제한이 있는 양상" },
    "수용 언어 지연":          { cat: "lang",   desc: "주변 사람의 말이나 지시 이해에 시간이 필요한 양상" },
    "비구어/제한된 발성":     { cat: "lang",   desc: "발성이 충분히 산출되지 않아 의사 표현이 매우 제한적인 상태" },
    "또래 상호작용 어려움":   { cat: "social", desc: "또래와의 상호작용 및 협동 놀이의 어려움" },
    "눈맞춤·공동주의 부족":  { cat: "social", desc: "눈맞춤 교환이나 공동주의 행동의 부족" },
    "사회적 단서 이해 부족":  { cat: "social", desc: "표정·몸짓 등 사회적 신호 변별의 어려움" },
    "도전 행동":               { cat: "behav",  desc: "감정 표현이나 좌절 상황에서의 떼쓰기, 자해, 공격적 행동" },
    "자기자극·상동 행동":    { cat: "behav",  desc: "활동 참여를 방해하는 반복적인 자기자극 행동" },
    "변화·전환 어려움":      { cat: "behav",  desc: "환경이나 일과 변화 시 전환 적응의 어려움" },
    "자조 기술 부족":          { cat: "adapt",  desc: "식사, 옷 입기, 화장실 사용 등 일상생활 기술이 또래 수준에 미달한 상태" },
    "학습 준비 부족":          { cat: "adapt",  desc: "착석 및 모방하기 등 기본 학습 준비 행동의 부족" },
    "감각 처리 어려움":        { cat: "adapt",  desc: "특정 감각 자극에 대한 과민·둔감 반응으로 일상 참여에 영향을 주는 양상" }
  };

  const CAT_NAMES = {
    lang:   "의사소통",
    social: "사회적 상호작용",
    behav:  "행동 조절",
    adapt:  "일상 기능"
  };
  const CAT_ORDER = ["lang", "social", "behav", "adapt"];

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (word) => has받침(word) ? "이" : "가";
  const 은는 = (word) => has받침(word) ? "은" : "는";

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const catLabels = cats.map(c => CAT_NAMES[c]);
  let para1;
  if (catLabels.length === 1) {
    para1 = `${fn}${은는(fn)} 현재 ${catLabels[0]} 측면에서의 발달적 지원이 필요한 상태로 관찰되어, 본 센터에서 개별화 교육 계획(IEP)을 수립하여 단계적으로 접근하고자 합니다.`;
  } else if (catLabels.length === 2) {
    const conn = has받침(catLabels[0]) ? "과" : "와";
    para1 = `${fn}${은는(fn)} 현재 ${catLabels[0]}${conn} ${catLabels[1]} 측면에 걸친 발달적 지원이 필요한 상태로 관찰되어, 본 센터에서 개별화 교육 계획(IEP)을 수립하여 단계적으로 접근하고자 합니다.`;
  } else {
    const front = catLabels.slice(0, -1).join(", ");
    para1 = `${fn}${은는(fn)} 현재 ${front}, ${catLabels[catLabels.length - 1]} 등 발달 전반에 걸친 지원이 필요한 상태로 관찰되어, 본 센터에서 개별화 교육 계획(IEP)을 수립하여 단계적으로 접근하고자 합니다.`;
  }

  const buildCatSentence = (cat, descs, isFirst) => {
    const catName = CAT_NAMES[cat];
    const prefix = isFirst ? `구체적으로 ${catName} 면에서` : `${catName} 면에서는`;
    if (descs.length === 1) {
      return `${prefix} ${descs[0]}${이가(descs[0])} 관찰되고 있습니다.`;
    }
    if (descs.length === 2) {
      return `${prefix} ${descs[0]}, 그리고 ${descs[1]}${이가(descs[1])} 함께 관찰되고 있습니다.`;
    }
    const front = descs.slice(0, -1).join(", ");
    return `${prefix} ${front}, 그리고 ${descs[descs.length - 1]} 등 여러 어려움이 함께 관찰되고 있습니다.`;
  };

  const catSentences = cats.map((cat, idx) => buildCatSentence(cat, byCategory[cat], idx === 0));
  const para2 = catSentences.join(" ");

  const para3 = `본 IEP에서는 ${fn}의 현재 발달 수준과 강점 영역을 토대로 단계적 목표를 설정하고, 데이터 기반의 체계적 중재를 통해 발달적 진전을 도모하고자 합니다.`;

  return [para1, para2, para3].join(" ");
}

function buildIepHomeCollab(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";
  const 은는 = (w) => has받침(w) ? "은" : "는";

  const KEY_DESC = {
    "센터 학습 가정 연계":      { cat: "reinforce", desc: `센터에서 신규 습득한 기술을 가정에서도 일관되게 연습할 수 있도록, 주간 학습 내용을 보호자에게 공유하고 가정 활용 방안을 안내합니다` },
    "긍정적 강화 일관성":         { cat: "reinforce", desc: `센터와 가정에서 동일 방식의 긍정적 강화를 적용함으로써, ${fn}${이가(fn)} 신규 기술을 안정적으로 습득하고 일반화할 수 있도록 협력합니다` },
    "일상 루틴 안에서 연습":     { cat: "routine",   desc: `식사·옷 입기·놀이 등 ${fn}의 일상 루틴 내에서 학습 목표가 적용될 수 있도록, 활동별 구체적 적용 방안을 안내합니다` },
    "보호자 직접 시연 안내":     { cat: "routine",   desc: `회기 후 보호자에게 ${fn}의 학습 상황을 시연하고, 가정에서 적용 가능한 핵심 기술을 점검합니다` },
    "주간 진행 상황 공유":       { cat: "communication", desc: `매주 ${fn}의 진행 상황과 데이터를 보호자와 공유하여, 변화 양상을 검토하고 다음 단계를 논의합니다` },
    "관찰 일지 활용":             { cat: "communication", desc: `보호자가 가정에서 관찰한 변화나 도전 상황을 회기 시작 시 공유받아, 회기 데이터와 통합적으로 검토합니다` },
    "구조화된 환경 마련":         { cat: "environment",   desc: `가정에서도 ${fn}${이가(fn)} 안정적으로 학습·휴식할 수 있는 구조화된 환경을 마련할 수 있도록, 시각적 일정표와 환경 구성 가이드를 제공합니다` },
    "또래 만남 기회 확대":         { cat: "environment",   desc: `${fn}의 사회적 기술 일반화를 위해, 가정과 인근 환경에서 또래와의 상호작용 기회를 단계적으로 확대하시기 바랍니다` }
  };

  const CAT_NAMES = {
    reinforce:     "센터·가정 일관성",
    routine:       "일상 루틴 통합",
    communication: "지속적 소통",
    environment:   "환경 조성"
  };
  const CAT_ORDER = ["reinforce", "routine", "communication", "environment"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `${fn}의 IEP 목표 달성을 위해서는 센터의 체계적 중재와 가정의 일관된 지원이 병행되어야 합니다. 이를 위해 본 센터는 보호자와 다음과 같이 협력합니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) return `${heading}\n${descs[0]}.`;
    return `${heading}\n${descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ")}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `이러한 협력 체계를 통해 ${fn}${이가(fn)} 본 IEP 목표를 안정적으로 달성하고, 일상 환경에서도 학습된 기술이 적용될 수 있는 기반을 구축하고자 합니다.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildIepRecommendations(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (w) => has받침(w) ? "이" : "가";

  const KEY_DESC = {
    "정기 진행 점검":           { cat: "monitoring", desc: `매 4~8주 단위로 IEP 목표 달성도를 정기적으로 점검하고, 필요 시 목표나 중재 전략을 조정합니다` },
    "데이터 기반 진행도 평가":  { cat: "monitoring", desc: `회기마다 수집되는 정반응률 및 진행도 데이터를 바탕으로, 목표별 달성 여부를 객관적으로 평가합니다` },
    "마일스톤 재평가":          { cat: "monitoring", desc: `학기말 또는 6개월 단위로 VB-MAPP 등 표준 평가 도구를 활용한 마일스톤 재평가를 진행합니다` },
    "타 영역 전문가 협력":      { cat: "collab",     desc: `필요 시 언어치료, 작업치료 등 타 전문 영역의 전문가와 협력하여 ${fn}의 발달을 다각도로 지원합니다` },
    "교육기관 연계":            { cat: "collab",     desc: `유치원·학교 등 ${fn}${이가(fn)} 다니는 교육기관과의 정보 공유 및 협력을 통해 일관된 지원이 이루어지도록 합니다` },
    "확장 목표 단계적 도입":    { cat: "future",     desc: `현재 IEP 목표 달성 시점에 맞추어, 다음 단계의 확장 목표를 단계적으로 도입할 예정입니다` },
    "자연 환경 일반화 단계":    { cat: "future",     desc: `센터 내 학습이 안정화되면 자연 환경에서의 일반화 단계를 통해, 학습된 기술이 실제 일상에서 활용될 수 있도록 합니다` },
    "보호자 교육 워크숍":       { cat: "education",  desc: `보호자님을 위한 정기 ABA 교육 워크숍 또는 1:1 코칭을 통해, 가정에서도 효과적인 지원을 제공하실 수 있도록 돕습니다` }
  };

  const CAT_NAMES = {
    monitoring: "진행도 점검 체계",
    collab:     "전문가·기관 협력",
    future:     "다음 단계 계획",
    education:  "보호자 교육"
  };
  const CAT_ORDER = ["monitoring", "collab", "future", "education"];

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const intro = `본 IEP 시행 과정에서 ${fn}의 안정적인 발달적 진전을 위해 다음 사항을 권해드립니다.`;

  const buildCatPara = (cat, descs) => {
    const heading = `▸ ${CAT_NAMES[cat]}`;
    if (descs.length === 1) return `${heading}\n${descs[0]}.`;
    return `${heading}\n${descs.map((d, i) => i === 0 ? d + "." : "또한 " + d + ".").join(" ")}`;
  };

  const catParagraphs = cats.map(c => buildCatPara(c, byCategory[c]));

  const closing = `위 사항들은 본 IEP 시행 기간 중 정기적으로 점검·갱신되며, ${fn}의 변화와 가족의 상황에 맞추어 유연하게 조정될 예정입니다.`;

  return `${intro}\n\n${catParagraphs.join("\n\n")}\n\n${closing}`;
}

function buildReferralReason(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";
  const i_ga = josa이가(fn) === "이" ? "이" : "가";

  const KEY_DESC = {
    "표현 언어 지연":          { cat: "lang",   desc: "원하는 것을 언어로 표현하거나 의사를 전달하는 데 제한이 있는 양상" },
    "수용 언어 지연":          { cat: "lang",   desc: "주변 사람의 말이나 지시 이해에 시간이 필요한 양상" },
    "비구어/제한된 발성":     { cat: "lang",   desc: "발성이 충분히 산출되지 않아 의사 표현이 매우 제한적인 상태" },
    "또래 상호작용 어려움":   { cat: "social", desc: "또래와의 상호작용 및 협동 놀이의 어려움" },
    "눈맞춤·공동주의 부족":  { cat: "social", desc: "눈맞춤 교환이나 공동주의 행동의 부족" },
    "사회적 단서 이해 부족":  { cat: "social", desc: "표정·몸짓 등 사회적 신호 변별의 어려움" },
    "도전 행동":               { cat: "behav",  desc: "감정 표현이나 좌절 상황에서의 떼쓰기, 자해, 공격적 행동" },
    "자기자극·상동 행동":    { cat: "behav",  desc: "활동 참여를 방해하는 반복적인 자기자극 행동" },
    "변화·전환 어려움":      { cat: "behav",  desc: "환경이나 일과 변화 시 전환 적응의 어려움" },
    "자조 기술 부족":          { cat: "adapt",  desc: "식사, 옷 입기, 화장실 사용 등 일상생활 기술이 또래 수준에 미달한 상태" },
    "학습 준비 부족":          { cat: "adapt",  desc: "착석 및 모방하기 등 기본 학습 준비 행동의 부족" },
    "감각 처리 어려움":        { cat: "adapt",  desc: "특정 감각 자극에 대한 과민·둔감 반응으로 일상 참여에 영향을 주는 양상" }
  };

  const CAT_NAMES = {
    lang:   "의사소통",
    social: "사회적 상호작용",
    behav:  "행동 조절",
    adapt:  "일상 기능"
  };
  const CAT_ORDER = ["lang", "social", "behav", "adapt"];

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false; // 한글 아니면 false
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (word) => has받침(word) ? "이" : "가";
  const 은는 = (word) => has받침(word) ? "은" : "는";
  const 을를 = (word) => has받침(word) ? "을" : "를";

  const byCategory = {};
  selected.forEach(label => {
    const item = KEY_DESC[label];
    if (!item) return;
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item.desc);
  });

  const cats = CAT_ORDER.filter(c => byCategory[c]);
  if (cats.length === 0) return "";

  const catLabels = cats.map(c => CAT_NAMES[c]);
  let para1;
  if (catLabels.length === 1) {
    para1 = `${fn}${은는(fn)} 본 치료를 의뢰받을 무렵 ${catLabels[0]} 측면에서의 발달적 어려움이 주된 호소 사항이었습니다.`;
  } else if (catLabels.length === 2) {
    const conn = has받침(catLabels[0]) ? "과" : "와";
    para1 = `${fn}${은는(fn)} 본 치료를 의뢰받을 무렵 ${catLabels[0]}${conn} ${catLabels[1]} 측면 전반에 걸친 발달적 어려움이 주된 호소 사항이었습니다.`;
  } else {
    const front = catLabels.slice(0, -1).join(", ");
    para1 = `${fn}${은는(fn)} 본 치료를 의뢰받을 무렵 ${front}, ${catLabels[catLabels.length - 1]} 등 발달 전반에 걸친 어려움이 주된 호소 사항이었습니다.`;
  }

  const buildCatSentence = (cat, descs, isFirst) => {
    const catName = CAT_NAMES[cat];
    const prefix = isFirst ? `구체적으로는 ${catName} 면에서` : `${catName} 면에서는`;

    if (descs.length === 1) {
      return `${prefix} ${descs[0]}${이가(descs[0])} 관찰되었습니다.`;
    }
    if (descs.length === 2) {
      return `${prefix} ${descs[0]}, 그리고 ${descs[1]}${이가(descs[1])} 함께 관찰되었습니다.`;
    }
    const front = descs.slice(0, -1).join(", ");
    return `${prefix} ${front}, 그리고 ${descs[descs.length - 1]} 등 여러 어려움이 함께 관찰되었습니다.`;
  };

  const catSentences = cats.map((cat, idx) => buildCatSentence(cat, byCategory[cat], idx === 0));
  const para2 = catSentences.join(" ");

  const para3 = `이러한 출발점에서 본 치료팀은 ${fn}의 현재 발달 수준과 강점 영역을 바탕으로 단계적 접근을 통한 발달적 진전을 목표로 중재를 진행하였습니다.`;

  return [para1, para2, para3].join(" ");
}

function buildEndReason(selected, info) {
  if (!selected || selected.length === 0) return "";
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";

  const has받침 = (word) => {
    if (!word) return false;
    const last = word[word.length - 1];
    const code = last.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  };
  const 이가 = (word) => has받침(word) ? "이" : "가";
  const 은는 = (word) => has받침(word) ? "은" : "는";

  const KEY_DESC = {
    "IEP 목표 달성":      "치료 시작 시 설정한 IEP 목표 대부분에 안정적으로 도달하였고",
    "일반화 안정화":      "치료 중 습득된 기술이 가정과 기관 등 다양한 환경에서 발현되기 시작하였으며",
    "다음 단계 이행":     "유치원·학교 입학 등 다음 발달 단계로의 이행이 가능한 시점에 도달하였고",
    "보호자 의사":        "보호자와의 협의를 통해 종결 시점에 대한 합의가 이루어졌으며",
    "가족 사정":          "이사·일정 변경 등 가정 내 사정으로 정기적인 치료 지속이 어려워졌고",
    "치료 기간 만료":     "예정된 치료 기간이 종료되었으며"
  };

  const descs = selected.map(l => KEY_DESC[l]).filter(Boolean);
  if (descs.length === 0) return "";

  const intro = `${fn}${은는(fn)} 본 치료의 종결에 이르기까지 다음과 같은 진행 사항이 확인되었습니다.`;

  let body;
  if (descs.length === 1) {
    body = `${descs[0]} 이러한 사유로 본 치료를 종결하게 되었습니다.`;
  } else if (descs.length === 2) {
    body = `${descs[0]}, ${descs[1]} 이러한 사유에 따라 본 치료를 종결하게 되었습니다.`;
  } else {
    const front = descs.slice(0, -1).join(", ");
    body = `${front}, 그리고 ${descs[descs.length - 1]} 이러한 사유에 따라 본 치료를 종결하게 되었습니다.`;
  }

  const closing = `본 종결은 ${fn}의 다음 발달 단계로의 이행 시점에 해당하며, 본 치료 기간 동안의 협력에 감사드립니다.`;

  return `${intro} ${body} ${closing}`;
}

function buildFinalSummary(goals, info) {
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";
  const startDate = info?.evalStart || "";
  const endDate = info?.finalEndDate || info?.evalEnd || "";

  const allSessionDates = new Set();
  goals.forEach(g => {
    if (!g.includeInIep) return;
    (g.tasks || []).forEach(t => {
      Object.keys(t.daily || {}).forEach(d => allSessionDates.add(d));
    });
  });
  const totalSessions = allSessionDates.size;

  const byDomain = {};
  let firstSessionDate = null;
  goals.forEach(g => {
    if (!g.includeInIep) return;
    const d = g.domain || "(영역 없음)";
    if (!byDomain[d]) byDomain[d] = { firstRates: [], lastRates: [], masteredTasks: 0, pausedTasks: 0, totalTasks: 0 };
    (g.tasks || []).forEach(t => {
      byDomain[d].totalTasks++;
      if ((t.listGroup || "1") === "2") byDomain[d].masteredTasks++;
      if ((t.listGroup || "1") === "paused") byDomain[d].pausedTasks++;
      const dates = Object.keys(t.daily || {}).sort();
      if (dates.length > 0 && (!firstSessionDate || dates[0] < firstSessionDate)) firstSessionDate = dates[0];
      const rates = dates.map(d2 => calcDayRateGlobal(t.daily[d2], t.plannedTrials)).filter(r => r !== null);
      if (rates.length > 0) {
        const N = 5;
        const firstN = rates.slice(0, Math.min(N, rates.length));
        const lastN = rates.slice(-Math.min(N, rates.length));
        const firstAvg = firstN.reduce((a, b) => a + b, 0) / firstN.length;
        const lastAvg = lastN.reduce((a, b) => a + b, 0) / lastN.length;
        byDomain[d].firstRates.push(firstAvg);
        byDomain[d].lastRates.push(lastAvg);
      }
    });
  });

  const domainSummaries = Object.entries(byDomain).map(([dom, d]) => {
    const firstAvg = d.firstRates.length > 0 ? Math.round(d.firstRates.reduce((a, b) => a + b, 0) / d.firstRates.length) : null;
    const lastAvg = d.lastRates.length > 0 ? Math.round(d.lastRates.reduce((a, b) => a + b, 0) / d.lastRates.length) : null;
    const change = (firstAvg !== null && lastAvg !== null) ? lastAvg - firstAvg : null;
    return { domain: dom, firstAvg, lastAvg, change, masteredTasks: d.masteredTasks, pausedTasks: d.pausedTasks, totalTasks: d.totalTasks };
  }).filter(r => r.totalTasks > 0);

  const totalDomains = domainSummaries.length;
  const totalTasks = domainSummaries.reduce((s, r) => s + r.totalTasks, 0);
  const totalMastered = domainSummaries.reduce((s, r) => s + r.masteredTasks, 0);
  const totalPaused = domainSummaries.reduce((s, r) => s + r.pausedTasks, 0);
  const masterPct = totalTasks > 0 ? Math.round(totalMastered / totalTasks * 100) : 0;

  const sortedByChange = [...domainSummaries].filter(r => r.change !== null && r.change > 0).sort((a, b) => b.change - a.change);
  const topDomains = sortedByChange.slice(0, 3);

  const validChanges = domainSummaries.map(r => r.change).filter(c => c !== null);
  const avgChange = validChanges.length > 0 ? Math.round(validChanges.reduce((a, b) => a + b, 0) / validChanges.length) : 0;

  let monthsLabel = "";
  if (startDate && endDate) {
    const s = new Date(startDate); const e = new Date(endDate);
    const months = Math.round((e - s) / (1000 * 60 * 60 * 24 * 30));
    if (months >= 12) {
      const y = Math.floor(months / 12); const m = months % 12;
      monthsLabel = m > 0 ? `${y}년 ${m}개월에 걸친` : `${y}년에 걸친`;
    } else if (months > 0) {
      monthsLabel = `약 ${months}개월에 걸친`;
    }
  }

  const para1Parts = [];
  if (startDate && endDate) {
    if (monthsLabel) {
      para1Parts.push(`${fn}${josa은는(fn)} ${startDate}부터 ${endDate}까지 ${monthsLabel} 본 ABA 치료 프로그램에 참여하였습니다.`);
    } else {
      para1Parts.push(`${fn}${josa은는(fn)} ${startDate}부터 ${endDate}까지 본 ABA 치료 프로그램에 참여하였습니다.`);
    }
  } else {
    para1Parts.push(`${fn}${josa은는(fn)} 본 ABA 치료 프로그램에 참여하였습니다.`);
  }
  const referral = (info?.finalReferralReason || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
  if (referral) {
    const firstSentence = referral.split(/[.\n]/).find(s => s.trim().length > 10) || referral.split("\n")[0];
    if (firstSentence && firstSentence.trim()) {
      para1Parts.push(`치료 시작 시점에는 ${firstSentence.trim().replace(/^[·\-\s]+/, "")}${firstSentence.endsWith(".") ? "" : "."}`);
    }
  }
  if (totalTasks > 0 && totalDomains > 0) {
    if (totalSessions > 0) {
      para1Parts.push(`이러한 출발점에서 ${fn}의 현재 발달 수준과 강점 영역을 토대로 중재가 진행되었으며, 총 ${totalSessions}회의 회기 동안 ${totalDomains}개 영역에서 ${totalTasks}개의 학습 과제를 단계적으로 진행하였습니다.`);
    } else {
      para1Parts.push(`이러한 출발점에서 ${fn}의 현재 발달 수준과 강점 영역을 토대로 중재가 진행되었으며, 총 ${totalDomains}개 영역에서 ${totalTasks}개의 학습 과제를 단계적으로 진행하였습니다.`);
    }
  }
  const para1 = para1Parts.join(" ");

  const para2Parts = [];
  if (totalMastered > 0) {
    if (masterPct >= 80) {
      para2Parts.push(`치료 종결 시점에 전체 ${totalTasks}개 과제 중 ${totalMastered}개(${masterPct}%)를 안정적인 수행 수준으로 습득하였습니다.`);
      para2Parts.push(`이는 ${fn}의 학습 환경 적응과 단계적 과제 수행이 효과적으로 이루어졌음을 나타내는 결과입니다.`);
    } else if (masterPct >= 60) {
      para2Parts.push(`치료 기간 동안 전체 ${totalTasks}개 과제 중 ${totalMastered}개(${masterPct}%)를 안정적으로 습득하였으며, 단계적 학습 진행이 확인되었습니다.`);
      para2Parts.push(`습득된 기술은 회기 내 수행에 그치지 않고 ${fn}의 일상 환경에서도 발현되어 일반화 양상이 관찰되었습니다.`);
    } else if (masterPct >= 30) {
      para2Parts.push(`치료 기간 동안 ${totalTasks}개 과제 중 ${totalMastered}개(${masterPct}%)에서 목표 수준에 도달하였으며, 나머지 과제도 단계적 진전을 보였습니다.`);
      para2Parts.push(`영역별 단계적 성취가 누적되어 학습 진행이 확인되었습니다.`);
    } else if (masterPct > 0) {
      para2Parts.push(`치료 기간 동안 ${totalTasks}개 과제 중 ${totalMastered}개에서 목표 수준에 도달하였으며, 나머지 과제도 단계적 진전을 보였습니다.`);
      para2Parts.push(`성취 비율 외에도 ${fn}의 매 회기 참여와 시도가 본 보고 기간의 학습 진행에 기반이 되었습니다.`);
    }
  } else if (totalTasks > 0) {
    para2Parts.push(`치료 기간 동안 ${totalTasks}개 과제를 단계적으로 진행하며 각 과제에서 학습 진행이 확인되었습니다.`);
  }
  if (avgChange >= 25) {
    para2Parts.push(`전반적으로 영역별 평균 정반응률이 약 ${avgChange}%p 향상되어, 치료 기간 동안 유의한 발달적 진전이 확인되었습니다.`);
  } else if (avgChange >= 15) {
    para2Parts.push(`전반적인 영역별 평균 정반응률이 약 ${avgChange}%p 향상되어, 학습 진행이 안정적으로 이루어졌음이 확인되었습니다.`);
  } else if (avgChange >= 5) {
    para2Parts.push(`영역별 평균 정반응률이 약 ${avgChange}%p 향상되어, 점진적 학습 변화가 관찰되었습니다.`);
  } else if (avgChange > 0) {
    para2Parts.push(`영역별 학습 수행이 점진적으로 향상되며 안정적인 학습 진행이 확인되었습니다.`);
  }
  const para2 = para2Parts.join(" ");

  let para3 = "";
  const para3pre1 = `${fn}${josa이가(fn)} 다양한 학습 영역에서 균형적 발달 양상을 보였음을 나타내며, 각 영역 간의 통합적 진행이 확인된 결과로 해석됩니다.`;
  if (topDomains.length >= 3) {
    const [t1, t2, t3] = topDomains;
    para3 = `${t1.domain} 영역에서는 ${t1.firstAvg}%에서 ${t1.lastAvg}%로 ${t1.change}%p의 향상이 확인되었으며, ${t2.domain} 영역 ${t2.change}%p, ${t3.domain} 영역 ${t3.change}%p의 향상이 동반 확인되었습니다. ` +
            `이러한 결과는 ${para3pre1}`;
  } else if (topDomains.length === 2) {
    const [t1, t2] = topDomains;
    para3 = `${t1.domain} 영역에서는 ${t1.firstAvg}%에서 ${t1.lastAvg}%로 ${t1.change}%p의 향상이 확인되었으며, ${t2.domain} 영역에서도 ${t2.change}%p의 향상이 동반되어 ${fn}의 강점 영역으로 확인되었습니다. ` +
            `이 영역의 변화는 정확도 향상에 그치지 않고 학습 참여도에도 영향을 미친 것으로 관찰되었습니다.`;
  } else if (topDomains.length === 1) {
    const t1 = topDomains[0];
    if (t1.change >= 20) {
      para3 = `${t1.domain} 영역에서는 ${t1.firstAvg}%에서 ${t1.lastAvg}%로 ${t1.change}%p의 유의한 향상이 확인되어, ${fn}의 강점 영역으로 확인되었습니다. ` +
              `해당 영역의 안정적 진행이 다른 영역의 학습에도 기반으로 작용하였습니다.`;
    } else {
      para3 = `${t1.domain} 영역에서는 시작 시점 대비 ${t1.change}%p 향상이 확인되었으며, 다른 영역도 단계적인 진전을 보였습니다.`;
    }
  }
  let para4 = "";
  if (totalPaused > 0) {
    para4 = `${totalPaused}개 과제는 ${fn}의 발달 흐름과 학습 동기를 고려하여 우선순위를 조정하거나 일시 중단하였습니다. 이는 단순 미달성이 아닌, ${fn}의 현재 발달 시점에 적합한 학습 경로 설정에 따른 임상적 판단이며, 향후 적절한 시기에 재구성하여 도입할 것을 권고드립니다.`;
  }

  let para5 = `${fn}의 본 치료 기간 동안의 학습 결과가 누적되어 발달적 진전이 확인되었으며, ` +
              `보호자의 일관된 가정 협력이 학습 안정성 유지에 기여하였습니다. ` +
              `본 종결 시점까지 형성된 학습 기반과 적응 능력은 ${fn}${josa이가(fn)} 향후 마주할 새로운 환경에서도 활용 가능한 자원이 될 것으로 판단됩니다.`;

  return [para1, para2, para3, para4, para5].filter(Boolean).join("\n\n");
}

function buildFinalGrowth(goals, info) {
  const fn = nameWithSuffix(stripSurname(info?.name || "")) || "아동";
  const i_ga = josa이가(fn) === "이" ? "이" : "가";

  let firstSessionDate = null;
  let lastSessionDate = null;
  const allRates = [];
  const masteredByMonth = {};  // YYYY-MM → [task, ...] 시간 흐름에 따른 숙달
  let totalMastered = 0;
  let totalPaused = 0;

  goals.forEach(g => {
    if (!g.includeInIep) return;
    (g.tasks || []).forEach(t => {
      const dates = Object.keys(t.daily || {}).sort();
      if (dates.length > 0) {
        if (!firstSessionDate || dates[0] < firstSessionDate) firstSessionDate = dates[0];
        if (!lastSessionDate || dates[dates.length - 1] > lastSessionDate) lastSessionDate = dates[dates.length - 1];
      }
      dates.forEach(date => {
        const rate = calcDayRateGlobal(t.daily[date], t.plannedTrials);
        if (rate !== null) allRates.push({ date, rate });
      });
      if ((t.listGroup || "1") === "2") {
        totalMastered++;
        const m = (t.masteredAt || dates[dates.length - 1] || "").slice(0, 7);
        if (m) {
          if (!masteredByMonth[m]) masteredByMonth[m] = [];
          masteredByMonth[m].push({ name: t.name, domain: g.domain });
        }
      }
      if ((t.listGroup || "1") === "paused") totalPaused++;
    });
  });

  const paragraphs = [];

  if (firstSessionDate) {
    const intro = `치료 시작 시점인 ${firstSessionDate} 무렵, ${fn}${josa은는(fn)} 새로운 환경과 평가 상황에 적응하는 과정에 있었습니다. ` +
                  `낯선 공간, 새로운 치료사, 신규 학습 도구 사이에서 ${fn}${josa은는(fn)} 단계적으로 환경을 탐색하였으며, ` +
                  `초기 회기의 신중한 양상은 학습 시작 전의 적응 단계로 확인됩니다.`;
    paragraphs.push(intro.replace(/\(가\)/g, i_ga));
  }

  if (allRates.length >= 6) {
    allRates.sort((a, b) => a.date.localeCompare(b.date));
    const third = Math.floor(allRates.length / 3);
    const earlyRates = allRates.slice(0, third);
    const midRates = allRates.slice(third, third * 2);
    const lateRates = allRates.slice(third * 2);
    const earlyAvg = Math.round(earlyRates.reduce((a, b) => a + b.rate, 0) / earlyRates.length);
    const midAvg = Math.round(midRates.reduce((a, b) => a + b.rate, 0) / midRates.length);
    const lateAvg = Math.round(lateRates.reduce((a, b) => a + b.rate, 0) / lateRates.length);

    let timeline = "";
    if (lateAvg - earlyAvg >= 25) {
      timeline = `학습 곡선 분석 결과, 초기 ${earlyAvg}% 수준에서 중반 ${midAvg}%, 종결 시점 ${lateAvg}%로 점진적이고 일관된 향상이 확인되었습니다. ` +
                 `이는 단기적 향상이 아닌 치료 기간 전반에 걸친 학습 동기 유지와 능동적 참여의 결과로 해석됩니다. ` +
                 `초기 시도가 누적되어 안정적인 수행 수준으로 도달하는 단계적 진행이 확인되었습니다.`;
    } else if (lateAvg - earlyAvg >= 10) {
      timeline = `학습 곡선 분석 결과, 초기 ${earlyAvg}% 수준에서 중반 ${midAvg}%, 종결 시점 ${lateAvg}%까지 안정적인 향상이 확인되었습니다. ` +
                 `회기 누적에 따른 점진적 변화 양상으로, 보호자의 지속적 지원이 학습 진행에 기여하였습니다.`;
    } else if (lateAvg >= 75) {
      timeline = `${fn}${josa은는(fn)} 치료 기간 전반에 걸쳐 평균 ${lateAvg}% 수준의 일관된 학습 수행을 유지하였습니다. ` +
                 `이는 학습 환경 적응이 신속히 이루어지고 안정적인 학습 수행 양상이 형성되었음을 나타냅니다.`;
    } else {
      timeline = `치료 기간 동안 평균 ${lateAvg}% 수준의 정반응률이 유지되었으며, 회기별 단계적 학습 진행이 확인되었습니다.`;
    }
    paragraphs.push(timeline.replace(/\(가\)/g, i_ga));
  }

  const monthKeys = Object.keys(masteredByMonth).sort();
  if (monthKeys.length >= 2) {
    const firstMonth = monthKeys[0];
    const peakMonth = monthKeys.reduce((max, m) => (masteredByMonth[m].length > masteredByMonth[max].length ? m : max), monthKeys[0]);
    const peakCount = masteredByMonth[peakMonth].length;
    const peakDomains = [...new Set(masteredByMonth[peakMonth].map(t => t.domain))].slice(0, 2).join("·");

    let milestone = `숙달 시기 분석 결과, ${firstMonth} 무렵 첫 과제가 안정적인 수행 수준에 도달한 이후 학습이 본격화되었습니다. `;
    if (peakCount >= 2) {
      milestone += `${peakMonth} 시기에 ${peakDomains} 영역을 중심으로 ${peakCount}개 과제가 집중적으로 숙달되어, ${fn}의 학습 진행 양상에서 주요 시점으로 확인됩니다. `;
    }
    milestone += `이러한 시간적 분포는 ${fn}의 학습이 단기적 성취가 아닌 지속적 학습 능력의 형성으로 진행되었음을 나타냅니다.`;
    paragraphs.push(milestone.replace(/\(가\)/g, i_ga));
  }

  const attitudeText = `정량 지표 외에 다음의 비계량적 변화도 관찰되었습니다. ` +
                       `${fn}${josa은는(fn)} 회기 누적에 따라 신규 과제 시도 빈도가 증가하였고, 오류 발생 시 재시도 양상이 안정적으로 관찰되었습니다. ` +
                       `치료사·또래와의 상호작용에서 표정 변화와 자기 표현 빈도의 증가도 확인되었습니다. ` +
                       `이러한 비계량적 변화는 ${fn}의 학습 환경 적응과 자기 효능감 형성을 나타내는 지표로 확인됩니다.`;
  paragraphs.push(attitudeText.replace(/\(가\)/g, i_ga));

  if (totalMastered > 0) {
    const homeText = `회기 내 변화는 가정과 일상 환경으로도 일반화되었습니다. ` +
                     `습득 기술 중 일부는 보호자의 관찰을 통해 가정에서도 발현이 확인되었으며, ` +
                     `이는 ${fn}의 학습이 회기 내 수행에 그치지 않고 일상 환경 내에서도 유지·확장되고 있음을 나타냅니다. ` +
                     `보호자의 일관된 가정 협력이 일반화 형성에 기여하였습니다.`;
    paragraphs.push(homeText.replace(/\(가\)/g, i_ga));
  }

  const closing = `이상의 결과는 ${fn}의 본 치료 기간 동안의 단계적 학습 진행을 종합한 내용입니다. ` +
                  `정량 지표 외에 회기별 시도와 보호자의 지원이 학습 안정성 유지에 기여하였습니다. ` +
                  `본 종결 시점까지 형성된 학습 경험과 적응 능력은 향후 ${fn}${josa이가(fn)} 마주할 새로운 환경에서도 활용 가능한 자원으로 작용할 것으로 판단됩니다.`;
  paragraphs.push(closing);

  return paragraphs.join("\n\n");
}

const IEP_OBSERVATION_PHRASES = {
  eyeContact: {
    full: {
      strength: "아동은 신체적·언어적 촉구가 주어진 상황에서 짧은 시간 시선을 맞추는 시도가 관찰되며, 익숙한 양육자와의 1:1 상호작용에서는 시선 접촉의 가능성이 확인됩니다. 익숙한 자극과 안정적인 환경에서는 양육자의 얼굴을 지향하는 행동이 간헐적으로 나타나며, 이는 사회적 자극에 대한 기초적 지향성이 형성되어 있음을 시사합니다. 다만 자발적 시선 접촉은 아직 관찰되지 않아, 강화 기반 시선 형성과 사회적 주의(social attention)의 토대를 단계적으로 구축할 필요가 있습니다.",
      improvement: "아동은 자발적인 눈맞춤이 관찰되지 않으며, 신체적·언어적 촉구를 통해서만 일시적인 시선 접촉이 유도됩니다. 호명 자극이나 사회적 단서에 대한 시선 지향이 거의 형성되지 않아, 사회적 자극과 비사회적 자극을 변별하는 초기 단계의 어려움이 시사됩니다. 사회적 주의 형성과 공동 주의(joint attention)의 선행 기술인 시선 지향 행동을 강화 기반으로 형성하기 위한 집중 중재가 요구됩니다."
    },
    partial: {
      strength: "아동은 이름을 불렀을 때 일시적으로 시선을 맞추며, 익숙한 놀이 상황이나 선호 활동 중에는 짧은 시간이라도 시선을 유지하려는 시도가 관찰됩니다. 양육자의 표정 변화나 강한 정서적 자극이 동반될 때 시선 접촉이 비교적 안정적으로 나타나며, 이는 사회적 보상에 대한 기초적 민감성이 형성되어 있음을 의미합니다. 향후 다양한 상호작용 맥락에서 시선 유지 시간을 점진적으로 확장하고, 공동 주의 행동으로 발전시키는 단계적 중재가 적합합니다.",
      improvement: "아동은 호명 시 간헐적으로 시선을 맞추나 지속 시간이 매우 짧고, 비선호 활동이나 학습 상황에서는 회피하는 모습이 관찰됩니다. 특히 새로운 환경이나 강한 자극이 동시에 제시되는 상황에서 시선 이탈이 빈번하게 나타나며, 이는 사회적 주의 형성과 공동 주의(joint attention)로의 발달이 더 필요한 단계임을 시사합니다. 시선 유지력 향상과 함께 비언어적 단서를 통한 사회적 참조 행동 형성을 위한 체계적 중재가 요구됩니다."
    },
    independent: {
      strength: "아동은 양육자나 교사를 향해 자발적으로 시선을 맞추며, 사회적 참조와 공동 주의 행동이 일관되게 관찰되어 안정적인 사회적 주의 기반이 확인됩니다. 새로운 자극이나 모호한 상황에서 양육자의 표정을 살피는 사회적 참조(social referencing) 행동이 자발적으로 나타나며, 이는 상호작용의 기초 능력이 충분히 형성되어 있음을 의미합니다. 향후에는 또래 및 다중 인물 환경으로의 일반화와 더 정교한 비언어적 의사소통 행동의 확장이 다음 발달 과제로 적합합니다.",
      improvement: "아동은 자발적 시선 접촉이 안정적으로 관찰되나, 다양한 또래 및 낯선 상호작용 상황으로의 일반화가 필요한 단계입니다. 익숙한 양육자와의 1:1 환경에서는 안정적인 시선 행동이 형성되어 있으나, 그룹 활동이나 새로운 환경에서는 시선 유지의 일관성이 다소 감소하는 모습이 관찰됩니다. 다양한 사회적 맥락에서의 시선 행동 일반화와 또래 상호작용 안에서의 사회적 참조 행동 확장을 위한 단계적 중재가 요구됩니다."
    }
  },
  requesting: {
    full: {
      strength: "아동은 양육자의 신체적 촉구가 동반될 때 선호 자극을 향해 손을 내미는 가능성을 보이며, 욕구가 있을 때 양육자에게 다가가는 모습이 관찰됩니다. 강력한 강화제(선호 음식, 좋아하는 장난감)에 대한 동기 수준이 확인되며, 이는 맨드(Mand) 형성을 위한 기초적 동기 조작 가능성이 존재함을 시사합니다. 향후 강화제 기반의 자발적 도움 요청 행동 형성을 시작점으로, 단순 음성·제스처 맨드로 확장하는 체계적 의사소통 중재가 적합합니다.",
      improvement: "아동은 자발적인 요구 표현이 관찰되지 않으며, 신체적 촉구가 있을 때만 비언어적 반응을 보입니다. 욕구 상황에서도 의사소통적 시도가 거의 나타나지 않아, 기능적 의사소통(functional communication)의 기초 형성이 가장 시급한 발달 과제로 확인됩니다. 강력한 강화제 기반의 동기 조작과 단순 맨드(Mand) 형성을 위한 집중 중재, 그리고 PECS 또는 AAC 보조 수단의 도입 검토가 요구됩니다."
    },
    partial: {
      strength: "아동은 필요한 물건이나 활동이 있을 때 주로 크레인 반응이나 손짓을 통해 요구를 표현하며, 간헐적으로 시선 맞춤이 동반되어 의사소통 의도가 관찰됩니다. 양육자에게 다가가 손을 잡아끌거나 원하는 물건을 가리키는 행동이 일관되게 나타나, 의사소통의 기능적 의도(communicative intent)가 명확히 형성되어 있음을 의미합니다. 향후 비언어적 표현을 음성 또는 제스처 기반의 자발적 맨드(Mand)로 확장하고, 다양한 강화제에 대한 표현 레퍼토리를 다각화하는 체계적 중재가 적합합니다.",
      improvement: "아동은 비언어적 요구 표현(손 잡아끌기, 손 내밀기)에 머물러 있어, 음성·제스처를 활용한 자발적 맨드(Mand) 형성이 다음 단계의 핵심 과제로 확인됩니다. 단어 모방이나 음성 표현은 제한적으로 나타나며, 비언어적 수단에 의존한 표현이 주를 이루어 의사소통 효율과 일반화에 한계가 관찰됩니다. 음성·제스처를 활용한 자발적 맨드 형성과 의사소통 기능 다양화를 위한 체계적·집중적 중재가 요구됩니다."
    },
    independent: {
      strength: "아동은 음성이나 단어를 활용해 자발적으로 요구를 표현하며, 다양한 강화제와 활동에 대한 맨드(Mand) 레퍼토리가 풍부하게 관찰됩니다. 단어 또는 짧은 구 단위의 자발적 요구가 일관되게 나타나며, 양육자뿐 아니라 새로운 사람에게도 의사소통을 시도하는 모습이 확인됩니다. 향후 평균발화길이(MLU) 확장, 정보 요청 맨드(\"어디?\", \"누가?\"), 도움 요청 등 고차원 맨드 기능으로의 확장이 다음 발달 과제로 적합합니다.",
      improvement: "아동은 단순 맨드는 자발적으로 가능하나, 평균발화길이(MLU) 확장과 다양한 상황에서의 일반화가 필요한 단계입니다. 1~2 단어 단위의 요구는 일관되게 나타나나, 정보 요청·도움 요청·사회적 의도 표현 등 더 복합적인 의사소통 기능으로의 확장이 제한적입니다. 다단어 구문 형성, 다양한 의사소통 기능(질문·도움 요청·거절) 확장, 그리고 또래 및 다양한 환경에서의 자발적 맨드 일반화를 위한 중재가 요구됩니다."
    }
  },
  following: {
    full: {
      strength: "아동은 신체적 촉구와 시각적 단서가 함께 제공될 때 단순 지시 동작을 수행하는 가능성을 보이며, 익숙한 일상 루틴 안에서 반응이 관찰됩니다. \"앉아\", \"이리와\" 등의 익숙한 단일 지시에 대해 양육자의 동작 모델링이 동반될 때 부분적인 수행이 나타나며, 이는 청자 반응(listener responding)의 기초가 형성되고 있음을 의미합니다. 향후 시각적 단서와 신체적 촉구를 점진적으로 페이딩하면서 자발적 단일 지시 수행으로 확장하는 단계적 중재가 적합합니다.",
      improvement: "아동은 음성 지시에 대한 반응이 거의 관찰되지 않으며, 신체적 촉구가 있을 때만 부분적으로 수행됩니다. 호명에 대한 일관된 반응도 형성되지 않아, 청자 반응의 기초인 사회적 자극에 대한 변별 학습이 우선 과제로 확인됩니다. 강화 기반 청자 반응 형성, 단일 지시 수용을 위한 시각적·신체적 촉구 체계 구축, 그리고 호명-반응의 변별 훈련을 위한 집중 중재가 요구됩니다."
    },
    partial: {
      strength: "아동은 \"이리와\", \"앉아\" 등의 익숙한 단일지시에 비교적 일관된 반응을 보이며, 시각적 단서가 함께 제공될 때 새로운 지시도 부분적으로 수용하는 모습이 관찰됩니다. 익숙한 일상 루틴 안에서는 양육자의 음성 지시만으로도 수행이 가능한 항목이 점차 증가하고 있어, 청자 어휘(listener vocabulary)가 안정적으로 확장되고 있음을 의미합니다. 향후 2단계 지시 수용, 새로운 지시 일반화, 그리고 다양한 지시자에 대한 청자 반응 확장이 다음 발달 과제로 적합합니다.",
      improvement: "아동은 익숙한 단일지시는 수용하나 2단계 지시 및 새로운 지시 수용에는 어려움을 보여, 청자 반응 레퍼토리 확장이 핵심 과제로 확인됩니다. 익숙한 환경과 양육자에 대한 단일 지시는 비교적 안정적이나, 낯선 지시자나 새로운 환경에서는 반응의 일관성이 감소하는 양상이 관찰됩니다. 2단계 지시·복합 지시 수용, 새로운 지시 일반화, 그리고 다양한 지시자·환경에 대한 청자 반응 일반화를 위한 체계적 중재가 요구됩니다."
    },
    independent: {
      strength: "아동은 단일·2단계 음성지시를 자발적으로 수행하며, 다양한 환경과 지시자에 대한 청자 반응이 안정적으로 관찰됩니다. 시각적 단서나 신체적 촉구 없이도 음성만으로 단계적 지시를 수행하는 능력이 확인되며, 이는 풍부한 청자 어휘와 작업 기억(working memory)의 기초가 안정적으로 형성되어 있음을 의미합니다. 향후 3단계 이상 복합 지시, 사회적 맥락 속 간접 지시, 그리고 또래 그룹 활동 안에서의 지시 수용으로의 확장이 다음 발달 과제로 적합합니다.",
      improvement: "아동은 단일·2단계 지시는 안정적으로 수행하나, 복합 지시 및 사회적 맥락 속 지시 수용으로의 확장이 필요합니다. 명시적이고 구체적인 지시에는 일관된 반응이 나타나나, 간접 지시(\"○○ 좀 도와줄래?\")나 다중 정보가 포함된 지시에서는 수행의 정확도가 감소하는 양상이 관찰됩니다. 3단계 이상 복합 지시, 간접·사회적 지시 이해, 그룹 활동 안에서의 청자 반응 일반화를 위한 중재가 요구됩니다."
    }
  },
  attention: {
    full: {
      strength: "아동은 강한 시각적 자극이나 선호 활동에서 짧은 시간 주의를 집중하는 모습을 보이며, 안정적인 환경에서는 주의 유지의 가능성이 관찰됩니다. 양육자의 정서적 반응이나 강화제가 동반될 때 주의 지속 시간이 일시적으로 확장되며, 이는 자극의 현저성에 따른 기초적 주의 조절 능력이 형성되어 있음을 의미합니다. 향후 학습 회기에서의 점진적 주의 지속 시간 확장과 활동 간 주의 전환 능력 형성을 위한 단계적 중재가 적합합니다.",
      improvement: "아동은 주의 지속 시간이 매우 짧고 외부 자극에 쉽게 분산되어, 학습 참여를 위한 주의 집중력 형성이 가장 시급한 과제로 확인됩니다. 강한 강화제가 동반된 상황에서도 1~2분 이상의 주의 유지가 어렵고, 자극 변경 시마다 주의 이탈이 빈번하게 나타나는 양상이 관찰됩니다. 강화 기반의 점진적 주의 지속 시간 형성, 환경 자극 통제, 시각적 일정표를 활용한 주의 조절 지원을 위한 집중 중재가 요구됩니다."
    },
    partial: {
      strength: "아동은 관심 있는 활동에는 비교적 잘 집중하며, 짧은 학습 회기 안에서는 교사의 안내와 함께 과제에 참여하는 모습이 관찰됩니다. 선호 활동 안에서는 5~10분 이상의 주의 유지가 가능하고, 강화제 기반의 회기 진행 시 학습 참여도가 안정적으로 형성되어 있어, 학습 기반으로서의 주의 능력이 점차 안정되고 있음을 의미합니다. 향후 비선호 활동에서의 주의 유지 확장, 활동 간 매끄러운 전환, 그리고 그룹 환경에서의 주의 일반화가 다음 발달 과제로 적합합니다.",
      improvement: "아동은 선호 활동에는 집중하나 비선호 활동에서는 주의 집중이 어렵고 회피 행동이 관찰되어, 선택적·지속적 주의력 향상이 핵심 과제로 확인됩니다. 강화제가 강력하거나 활동의 흥미도가 높은 상황에서는 안정적인 주의가 가능하나, 학습적 요구가 추가되거나 비선호 자극이 제시되면 주의 이탈과 회피가 동시에 나타나는 양상이 관찰됩니다. 비선호 활동에서의 주의 유지력 향상, 회피 행동에 대한 기능 분석 기반의 중재, 그리고 점진적 학습 회기 시간 확장을 위한 체계적 중재가 요구됩니다."
    },
    independent: {
      strength: "아동은 다양한 활동에서 자발적으로 주의를 집중하고 유지하며, 학습 회기 동안 안정적인 참여 태도가 관찰됩니다. 새로운 자극이나 도전적 과제에서도 주의 이탈 없이 지속적인 참여가 가능하며, 이는 학습 기반으로서의 주의 능력과 자기조절(self-regulation)의 토대가 견고하게 형성되어 있음을 의미합니다. 향후 그룹 환경, 외부 자극이 많은 상황, 또래 활동 안에서의 주의 유지로의 일반화가 다음 발달 과제로 적합합니다.",
      improvement: "아동은 1:1 상황에서는 안정적인 주의 집중이 가능하나, 그룹 상황 및 외부 자극이 많은 환경에서의 주의 유지로 일반화가 필요합니다. 단일 자극과 명확한 학습 구조 안에서는 충분한 주의 능력이 형성되어 있으나, 다중 자극이나 또래 활동 안에서는 주의 분산이 빈번하게 관찰됩니다. 그룹 환경에서의 선택적 주의력, 자극 통제 능력, 그리고 또래 활동 안에서의 주의 유지 일반화를 위한 단계적 중재가 요구됩니다."
    }
  },
  imitation: {
    full: {
      strength: "아동은 익숙한 동작(손 흔들기, 박수치기)에 시각적 주의를 보이며, 신체적 촉구와 함께 제시할 때 모방 반응의 가능성이 관찰됩니다. 양육자의 동작 모델링과 신체적 가이드가 동반될 때 부분적인 동작 모방이 유도되며, 이는 모방 학습(observational learning)의 가장 기초적인 단계가 형성되고 있음을 의미합니다. 향후 신체적 촉구의 점진적 페이딩, 자발적 단순 동작 모방 형성, 그리고 사물을 활용한 행동 모방으로의 확장을 위한 집중 중재가 적합합니다.",
      improvement: "아동은 자발적 모방이 거의 관찰되지 않으며, 신체적 촉구가 있을 때만 부분적인 동작 모방이 유도됩니다. 모방 행동은 사회적 학습과 언어 발달의 핵심 선행 기술이므로, 모방 기술 형성이 가장 우선되는 발달 과제로 확인됩니다. 강화 기반의 단순 동작 모방 형성, 시각적 주의 형성, 그리고 사물을 활용한 행동 모방 단계로의 점진적 확장을 위한 집중 중재가 요구됩니다."
    },
    partial: {
      strength: "아동은 노래나 게임 상황에서 익숙한 동작을 모방하며, 사물을 활용한 간단한 동작 모방이 관찰됩니다. 양육자의 모델링에 대한 자발적 모방 시도가 일관되게 나타나, 모방 레퍼토리가 점진적으로 확장되고 있음을 의미합니다. 향후 새로운 동작 모방, 구강·언어 모방, 그리고 또래 모방으로의 확장과 모방을 통한 사회적 학습 능력의 다각화가 다음 발달 과제로 적합합니다.",
      improvement: "아동은 익숙한 동작 모방은 가능하나, 새로운 동작·구강 움직임·언어 모방으로의 확장이 제한되어 모방 레퍼토리 확장이 핵심 과제로 확인됩니다. 반복적으로 노출된 동작에는 자발적 모방이 형성되어 있으나, 새로운 동작이나 구강·음성 움직임의 모방에서는 정확도와 일관성이 감소하는 양상이 관찰됩니다. 새로운 동작 모방, 구강 운동 모방, 음성·언어 모방 형성, 그리고 또래 모방을 위한 체계적 중재가 요구됩니다."
    },
    independent: {
      strength: "아동은 다양한 동작·언어·놀이 행동을 자발적으로 모방하며, 모방을 통한 사회적 학습이 안정적으로 관찰됩니다. 새로운 자극이나 모델링에 대한 자발적 모방이 즉각적으로 나타나며, 이는 모방을 매개로 한 학습 능력과 사회성 발달의 기반이 견고하게 형성되어 있음을 의미합니다. 향후 복합 동작 시퀀스, 또래 모방을 통한 사회적 놀이 확장, 그리고 가상놀이(pretend play)와 같은 상징적 모방으로의 확장이 다음 발달 과제로 적합합니다.",
      improvement: "아동은 단순 모방은 자발적으로 가능하나, 복합 동작·또래 모방·가상놀이로의 일반화가 필요한 단계입니다. 1:1 상황에서의 단일 동작 모방은 안정적이나, 시퀀스 동작이나 또래의 행동을 자발적으로 모방하는 능력은 아직 제한적인 양상이 관찰됩니다. 복합 동작 모방, 또래 모방을 통한 사회적 놀이 학습, 그리고 가상놀이와 상징적 표현 발달을 위한 중재가 요구됩니다."
    }
  },
  selfCare: {
    full: {
      strength: "아동은 일상 루틴(식사, 정리)에서 양육자의 도움과 함께 단순한 동작에 참여하며, 익숙한 환경에서는 협조적인 모습이 관찰됩니다. 신체적 촉구와 시각적 단서가 동반될 때 식사 도구 사용이나 간단한 정리 동작에 참여하는 모습이 나타나며, 이는 일상생활 안에서의 적응 행동(adaptive behavior) 기초가 형성되고 있음을 의미합니다. 향후 강화 기반의 단순 자조기술 형성, 행동 연쇄(behavior chaining) 도입, 그리고 익숙한 일상 루틴 안에서의 단계적 독립성 확장을 위한 중재가 적합합니다.",
      improvement: "아동은 기초적인 자조기술 수행이 제한적으로, 대부분의 일상 활동에서 성인의 전적인 도움이 필요합니다. 식사·옷 입기·위생 등 일상의 핵심 자조 영역에서 자발적 참여가 거의 관찰되지 않아, 기능적 적응 행동 형성이 우선 과제로 확인됩니다. 강화 기반의 단순 자조 동작 형성, 행동 연쇄 도입, 그리고 시각적 일정표를 활용한 일상 루틴 구조화를 위한 집중 중재가 요구됩니다."
    },
    partial: {
      strength: "아동은 시각적 단서나 부분적인 도움이 주어지면 식사·정리·전이 등 일상 활동에 협조적으로 참여하며, 일부 자조기술의 수행이 관찰됩니다. 익숙한 일상 루틴 안에서는 단계적 자조 동작에 자발적으로 참여하는 모습이 점차 증가하고 있어, 적응 행동 레퍼토리가 안정적으로 확장되고 있음을 의미합니다. 향후 자조기술의 독립적 수행 확장, 활동 전이 안정화, 그리고 새로운 환경·일상 변경 상황에서의 일반화가 다음 발달 과제로 적합합니다.",
      improvement: "아동은 일부 자조기술은 부분적 수행이 가능하나, 독립적 수행·전이 및 활동 변경 시 어려움을 보여 행동 연쇄와 일반화 형성이 핵심 과제로 확인됩니다. 익숙한 환경에서는 단계적 자조 동작에 협조적이나, 새로운 활동이나 일상 변화에 대한 적응에서는 도움 의존도가 다시 증가하는 양상이 관찰됩니다. 행동 연쇄를 통한 자조기술의 독립적 수행 강화, 활동 전이의 안정화, 그리고 새로운 환경에서의 자조기술 일반화를 위한 체계적 중재가 요구됩니다."
    },
    independent: {
      strength: "아동은 식사·정리·전이 등 기본적인 자조기술을 독립적으로 수행하며, 활동 전환과 규칙 수용 측면에서 안정적인 모습을 보입니다. 일상 루틴 전반에 걸친 독립성과 자기관리 능력이 견고하게 형성되어 있으며, 이는 학습과 사회 참여의 기반으로 작용하는 적응 행동의 토대가 충분히 확립되어 있음을 의미합니다. 향후 새로운 환경에서의 자조기술 일반화, 사회적 규칙 수용 확장, 그리고 또래 활동·집단 일정 안에서의 자기관리 능력 확장이 다음 발달 과제로 적합합니다.",
      improvement: "아동은 익숙한 환경에서의 자조기술은 안정적이나, 새로운 환경 적응과 사회적 규칙 수용으로의 일반화가 필요합니다. 가정·치료실 등 익숙한 환경에서는 자조기술 수행이 일관되나, 새로운 장소·집단 활동·일정 변경 상황에서는 적응의 유연성이 감소하는 양상이 관찰됩니다. 새로운 환경에서의 자조기술 일반화, 집단 규칙 수용, 그리고 또래 활동 안에서의 자기관리 능력 확장을 위한 중재가 요구됩니다."
    }
  }
};

const OBS_CATEGORY_LABELS = {
  eyeContact: "눈맞춤",
  requesting: "요구 표현",
  following: "지시 따르기",
  attention: "주의 집중",
  imitation: "모방 반응",
  selfCare: "자기관리"
};

const DOMAIN_CONTEXT = {
  // ELCAR (부모님 친화 설명)
  "선호물·강화제": "아동이 자발적으로 학습에 참여하도록 동기를 유발하는 강력한 보상물을 탐색하고 배치하는 영역입니다",
  "조건화된 강화": "본래 흥미 없던 활동이나 사회적 칭찬(눈맞춤, 미소 등)을 가치 있는 보상으로 느끼도록 학습시키는 영역입니다",
  "화자 언어 작동": "요구하기(Mand), 명명하기(Tact) 등 타인에게 자신의 의도를 말로 표현하는 언어 행동의 실제적 기능을 기르는 영역입니다",
  "교수 준비도": "자리에 앉기, 시선 맞추기, 지시 따르기 등 본격적인 학습을 시작하기 위해 필요한 기본 태도와 순응을 배우는 영역입니다",
  "자기관리": "스스로 자신의 행동을 모니터링하고 충동을 조절하며 일상생활을 독립적으로 수행하도록 돕는 영역입니다",
  "언어행동기초": "모방, 소리 내기, 시각적 대칭 맞추기 등 언어를 본격적으로 정교화하기 전 단계의 인지적·행동적 기반을 다지는 영역입니다",
  "청자": "타인의 말을 정확하게 이해하고, 그 지시나 상황에 알맞게 몸으로 반응하는 능력을 기르는 영역입니다",
  "화자": "상황과 대화 상대방의 맥락에 맞추어 적절한 단어와 문장으로 소통하는 종합적인 구어 표현력을 다듬는 영역입니다",
  // ESDM (부모님 친화 설명)
  "수용 언어": "일상적인 놀이와 상호작용 속에서 어른의 말이나 몸짓 신호의 의미를 알아듣고 이해하는 영역입니다",
  "표현 언어": "자연스러운 놀이 상황에서 말, 소리, 제스처를 사용해 자신의 욕구와 감정을 상대방에게 전달하는 영역입니다",
  "합동 주시 행동": "상대방과 같은 사물이나 사건을 동시에 바라보며 관심사와 즐거움을 공유하는 사회적 소통의 출발점이 되는 영역입니다",
  "사회기술: 어른/친구": "친밀한 성인 및 또래와의 눈맞춤, 주고받기 놀이, 규칙 준수를 통해 관계 맺는 법을 배우는 영역입니다",
  "사회기술": "친밀한 성인 및 또래와의 눈맞춤, 주고받기 놀이, 규칙 준수를 통해 관계 맺는 법을 배우는 영역입니다",
  "모방": "타인의 신체 움직임, 놀이 행동, 소리를 따라 하면서 세상의 규칙을 습득하고 사회적 유대감을 쌓는 영역입니다",
  "인지": "놀이 속에서 사물의 인과관계를 이해하고, 문제를 해결하며, 개념을 분류하는 기초 사고력을 기르는 영역입니다",
  // 기타 (VB-MAPP 잔여)
  "강화제군": "학교 환경에서 자연스럽게 작용하는 다양한 강화제에 대한 반응성을 평가하는 영역입니다",
  "학습능력": "매칭·범주·개념·읽기 전 기술·초기 수학 등 학업 준비도와 인지 능력을 통합적으로 다루는 영역입니다",
  "신체발달": "소근육·대근육 협응과 조작 능력을 평가하여 학습 및 일상 수행의 신체적 기반을 확인하는 영역입니다"
};

// 영역명에서 로마숫자·번호 접두어 제거 (DOMAIN_CONTEXT 매칭용)
function cleanDomainKey(domain) {
  if (!domain) return "";
  return domain.replace(/^[Ⅰ-Ⅺ\dIVX]+\s*[·.]?\s*/, "").trim();
}

// 받침 유무에 따라 은/는 조사를 붙임
function withTopicParticle(word) {
  if (!word) return word;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return word + "는"; // 한글 아니면 기본 '는'
  const hasJong = (last - 0xAC00) % 28 !== 0;
  return word + (hasJong ? "은" : "는");
}

function calcDayRateGlobal(day, plannedTrials) {
  if (!day) return null;
  if (Array.isArray(day.trials)) {
    if (plannedTrials != null) {
      const N = Math.max(1, Math.min(99, plannedTrials));
      let pluses = 0;
      for (let i = 0; i < N; i++) {
        if (day.trials[i] === "+") pluses++;
      }
      return Math.round((pluses / N) * 100);
    }
    const entered = day.trials.filter(x => x === "+" || x === "-");
    if (entered.length === 0) return null;
    const pluses = entered.filter(x => x === "+").length;
    return Math.round((pluses / entered.length) * 100);
  }
  if (day.mode === "pct") return typeof day.pct === "number" ? day.pct : null;
  const total = (day.c || 0) + (day.ic || 0);
  if (total === 0) return null;
  return Math.round((day.c / total) * 100);
}

function getCombinedDailySeries(goal) {
  const dateMap = {};  // date → { taskRates: [], oldRate: null }
  (goal.tasks || []).forEach(t => {
    const daily = t.daily || {};
    Object.keys(daily).forEach(d => {
      const r = calcDayRateGlobal(daily[d], t.plannedTrials);
      if (r === null) return;
      if (!dateMap[d]) dateMap[d] = { taskRates: [], oldRate: null };
      dateMap[d].taskRates.push(r);
    });
  });
  Object.keys(goal.daily || {}).forEach(d => {
    const r = calcDayRateGlobal(goal.daily[d]);
    if (r === null) return;
    if (!dateMap[d]) dateMap[d] = { taskRates: [], oldRate: null };
    dateMap[d].oldRate = r;
  });
  const result = [];
  Object.keys(dateMap).sort().forEach(d => {
    const { taskRates, oldRate } = dateMap[d];
    let rate;
    if (taskRates.length > 0 && oldRate !== null) {
      const taskAvg = Math.round(taskRates.reduce((a, b) => a + b, 0) / taskRates.length);
      rate = Math.round((taskAvg + oldRate) / 2);
    } else if (taskRates.length > 0) {
      rate = Math.round(taskRates.reduce((a, b) => a + b, 0) / taskRates.length);
    } else {
      rate = oldRate;
    }
    result.push({ date: d, rate });
  });
  return result;
}

function generateCurrentLevel(goal) {
  const { domain, subDomain, item, note, vbmapp, esdm, source } = goal;

  const rated = getCombinedDailySeries(goal);
  const sessions = rated.length;
  const latestRate = sessions > 0 ? rated[rated.length - 1].rate : null;
  const avgRate = sessions > 0 ? Math.round(rated.reduce((a, b) => a + b.rate, 0) / sessions) : null;
  const firstRate = sessions > 0 ? rated[0].rate : null;
  const change = (firstRate !== null && latestRate !== null) ? latestRate - firstRate : null;

  const lines = [];

  const ctx = DOMAIN_CONTEXT[cleanDomainKey(domain)] || DOMAIN_CONTEXT[domain];
  if (ctx && source === "ELCAR") {
    lines.push(`${cleanDomainKey(domain)} 영역은 ${ctx.replace(/영역입니다$/, "영역으로")}, 본 아동의 현행 수준을 평가하여 IEP에 포함하였습니다.`);
  } else if (source && source !== "ELCAR") {
    lines.push(`${source} ${domain} 영역의 목표로, ${subDomain !== "-" ? subDomain + "과 관련된 " : ""}학습자의 현재 기능 수준을 평가합니다.`);
  } else {
    lines.push(`${domain} 영역의 ${subDomain} 세부영역 목표에 대한 현행 수준을 평가합니다.`);
  }

  lines.push(`현재 '${item}' 항목을 중점 목표로 설정하여 체계적인 중재를 진행하고 있습니다.`);

  const linkage = [];
  if (vbmapp) linkage.push(`VB-MAPP의 ${vbmapp.v} 영역 레벨 ${vbmapp.lv}`);
  if (esdm) linkage.push(`ESDM ${esdm.lv}의 ${esdm.v} 발달 영역`);
  if (linkage.length > 0) {
    const linkageText = linkage.join(" 및 ");
    lines.push(`이는 ${linkageText}${withParticle(linkageText, "과", "와")} 연계된 핵심 선행 기술로, 후속 학습 목표의 기반이 됩니다.`);
  } else {
    lines.push(`이는 후속 학습 및 일반화 목표의 기반이 되는 핵심 선행 기술입니다.`);
  }

  if (latestRate === null) {
    lines.push(`현재 데일리 기록이 수집되지 않은 초기 관찰 단계이며, 기초선 측정이 진행 중입니다.`);
  } else if (latestRate >= 80) {
    lines.push(`총 ${sessions}회 세션 기준 최근 정반응률 ${latestRate}%, 평균 ${avgRate}%로 일관된 수행을 보이며 숙달 단계에 근접한 상태입니다.${change !== null && change > 0 ? ` (초기 대비 ${change}%p 향상)` : ""}`);
  } else if (latestRate >= 50) {
    lines.push(`총 ${sessions}회 세션 기준 최근 정반응률 ${latestRate}%, 평균 ${avgRate}%로 부분적 수행을 보이며 일관성 확보가 필요한 단계입니다.${change !== null && change !== 0 ? ` (초기 대비 ${change > 0 ? "+" : ""}${change}%p)` : ""}`);
  } else if (latestRate >= 20) {
    lines.push(`총 ${sessions}회 세션 기준 최근 정반응률 ${latestRate}%, 평균 ${avgRate}%로 촉구 제공이 필요한 수준이며 독립 수행 확대가 요구됩니다.`);
  } else {
    lines.push(`총 ${sessions}회 세션 기준 최근 정반응률 ${latestRate}%로 자발적 반응이 제한적이며, 집중적 선행 훈련이 필요한 단계입니다.`);
  }

  if (latestRate === null) {
    lines.push(`DTT/NET 교수법을 기반으로 체계적 촉구 체계를 적용하며 80% 이상 2회 연속 수행을 숙달 기준으로 설정합니다.`);
  } else if (latestRate >= 80) {
    lines.push(`현재 숙달 기준(80% 이상 2회 연속) 충족이 근접하여 유지·일반화 단계 진입과 새로운 후속 목표 도입을 계획합니다.`);
  } else if (latestRate >= 50) {
    lines.push(`점진적 촉구 감소(least-to-most) 전략과 다양한 자극 세트 도입을 통해 반응의 안정성과 일반화를 촉진합니다.`);
  } else {
    lines.push(`Errorless Teaching 기법과 집중 시도 교수(DTT)로 정확 반응을 형성하고, 성공 경험 축적을 통해 동기를 유지합니다.`);
  }

  let out = lines.join(" ");
  if (note && note.trim()) out += ` (관찰 메모: ${note.trim()})`;
  return out;
}

function getCurrentLevel(goal) {
  if (goal.currentLevelOverride !== null && goal.currentLevelOverride !== undefined && goal.currentLevelOverride.trim() !== "") {
    return goal.currentLevelOverride;
  }
  return generateCurrentLevel(goal);
}

function generateRationale(goal) {
  const { domain, item, vbmapp, esdm } = goal;
  let rationale = `'${item}'${withParticle(item, "은", "는")} ${domain} 영역의 핵심 선행 기술로, 후속 학습 목표의 기반이 되는 능력입니다. `;
  rationale += `사전 평가에서 본 아동의 현 단계에 적합한 출발점으로 도출되어 IEP 목표로 선정되었으며, `;
  if (vbmapp) rationale += `VB-MAPP의 ${vbmapp.v} 영역(레벨 ${vbmapp.lv})과 연계하여 `;
  if (esdm) rationale += `ESDM ${esdm.lv}의 ${esdm.v} 발달과 통합하여 `;
  rationale += `DTT/NET 교수법과 점진적 촉구 감소 전략으로 80% 이상 정확도 및 자발성·일반화 기준을 목표로 중재를 계획합니다.`;
  return rationale;
}

function generateCurriculumDescription(source, items) {
  if (!items || items.length === 0) return "";
  const domains = [...new Set(items.map(g => shortDomain(g.domain) || g.domain).filter(Boolean))];
  const domainCount = domains.length;
  const goalCount = items.length;

  const byDomain = {};
  items.forEach(g => {
    const k = shortDomain(g.domain) || g.domain || "(영역 없음)";
    if (!byDomain[k]) byDomain[k] = 0;
    byDomain[k]++;
  });
  const topDomains = Object.entries(byDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([_, n]) => n >= 2);   // 2개 이상 집중된 경우만

  if (source === "ELCAR") {
    const domainList = domains.slice(0, 5).join("·");
    let s = `본 아동은 ELCAR 커리큘럼 기반 평가를 통해 ${domainCount}개 영역에 걸쳐 ${goalCount}개의 세부 목표가 IEP에 포함되었습니다. `;
    if (topDomains.length > 0) {
      const topNames = topDomains.map(([n, c]) => `${n}(${c}개)`).join("·");
      s += `특히 ${topNames} 영역에 가장 많은 목표가 집중되어 우선 지도가 필요한 핵심 영역으로 선정되었습니다. `;
    } else {
      s += `${domainList} 영역을 중심으로 발달 단계의 핵심 선행 기술이 통합 지도되며, `;
    }
    s += `VB-MAPP·ESDM 평가 결과와 연계하여 단계적으로 학습 목표가 확장됩니다.`;
    return s;
  }

  if (source === "VB-MAPP") {
    const vbDomains = [...new Set(items.filter(g => g.vbmapp).map(g => g.vbmapp.v))];
    const vbLevels = items.filter(g => g.vbmapp).map(g => g.vbmapp.lv);
    const minLv = vbLevels.length > 0 ? Math.min(...vbLevels) : null;
    const maxLv = vbLevels.length > 0 ? Math.max(...vbLevels) : null;
    const lvRange = (minLv !== null && maxLv !== null)
      ? (minLv === maxLv ? `Level ${minLv}` : `Level ${minLv}~${maxLv}`)
      : "";
    const vbList = vbDomains.slice(0, 5).join("·");
    if (!vbList || !lvRange) {
      return `VB-MAPP 평가 기반으로 ${goalCount}개 목표가 본 아동의 출발점으로 도출되었습니다. 단계적 확장을 목표로 하며, 자발성과 일반화에 중점을 두어 지도합니다.`;
    }
    let s = `VB-MAPP 마일스톤 평가 결과 ${vbList} 영역의 ${lvRange}에 걸친 ${goalCount}개 목표가 본 아동의 출발점으로 도출되었습니다. `;
    if (minLv !== null && minLv === 1) {
      s += `특히 Level 1 수준으로 측정된 영역은 발달의 핵심 선행 기술이 형성되는 시점에 해당하므로, 자발성과 일반화에 중점을 두어 단계적으로 확장 지도합니다.`;
    } else if (minLv !== null) {
      s += `현 발달 단계에 적합한 출발점 기술을 토대로 단계적 확장을 목표로 하며, 자발성과 일반화에 중점을 두어 지도합니다.`;
    } else {
      s += `단계적 확장을 목표로 하며, 자발성과 일반화에 중점을 두어 지도합니다.`;
    }
    return s;
  }

  if (source === "ESDM") {
    const esdmDomains = [...new Set(items.filter(g => g.esdm).map(g => g.esdm.v))];
    const esdmList = esdmDomains.slice(0, 5).join("·");
    if (!esdmList) {
      return `ESDM 발달 평가 기반으로 ${goalCount}개 목표가 본 아동의 현 단계에 적합한 학습 목표로 도출되었습니다. 놀이 중심의 자연주의 교수법으로 일상 속 일반화를 강조하여 지도합니다.`;
    }
    let s = `ESDM 발달 평가에서 ${esdmList} 영역의 발달 항목 ${goalCount}개가 본 아동의 현 단계에 적합한 학습 목표로 도출되었습니다. `;
    if (topDomains.length > 0) {
      const topNames = topDomains.map(([n, c]) => `${n}(${c}개)`).join("·");
      s += `${topNames} 영역에 목표가 집중되어 해당 영역이 본 아동의 발달 우선 지도 대상으로 선정되었으며, `;
    }
    s += `놀이 중심의 자연주의 교수법으로 일상 속 일반화를 강조하여 지도합니다.`;
    return s;
  }

  const domainList = domains.slice(0, 5).join("·");
  let s = `본 아동의 발달 특성과 가정·학습 환경의 우선순위를 고려하여 ${domainList} 영역에 걸쳐 ${goalCount}개의 목표가 추가로 선정되었습니다. `;
  if (topDomains.length > 0) {
    const topNames = topDomains.map(([n, c]) => `${n}(${c}개)`).join("·");
    s += `특히 ${topNames} 영역의 비중이 높아 우선 중재 대상으로 선정되었으며, `;
  }
  s += `표준 커리큘럼 외에도 개별 아동의 필요에 부합하는 영역에 대해 체계적인 중재를 진행합니다.`;
  return s;
}

function generateObservationSummary(observations, levels) {
  if (!observations || !levels) return "";
  const CATEGORIES = [
    { key: "eyeContact", label: "눈맞춤" },
    { key: "requesting", label: "요구 표현" },
    { key: "following", label: "지시 따르기" },
    { key: "attention", label: "주의 집중" },
    { key: "imitation", label: "모방 반응" },
    { key: "selfCare", label: "자기관리" }
  ];
  const filledCategories = CATEGORIES.filter(c => (observations[c.key] || "").trim() !== "");
  if (filledCategories.length === 0) return "";

  const fullList = [];      // 전적 도움
  const partialList = [];   // 부분 도움
  const independentList = []; // 자발적 수행
  filledCategories.forEach(c => {
    const lv = levels[c.key];
    if (lv === "full") fullList.push(c.label);
    else if (lv === "partial") partialList.push(c.label);
    else if (lv === "independent") independentList.push(c.label);
  });

  const total = fullList.length + partialList.length + independentList.length;
  if (total === 0) {
    const labels = filledCategories.map(c => c.label).join("·");
    return `종합적으로 본 아동은 ${labels} 영역에 걸친 초기 관찰 결과를 바탕으로 IEP 목표가 설정되었으며, 영역별 출발점에 따른 단계적·통합적 중재가 진행됩니다. 각 영역의 현재 발달 수준과 강점·과제를 고려하여 개별화된 학습 목표가 수립되었으며, 데이터 기반의 정기적인 진척도 평가와 회기 단위 조정을 통해 학습의 일관성과 효율을 확보합니다. 가정과의 협력을 통한 일반화 단계까지 포함하는 통합적 중재 계획이 진행될 예정입니다.`;
  }

  const fullRatio = fullList.length / total;
  const independentRatio = independentList.length / total;
  const sentences = [];

  if (fullList.length >= 4 || fullRatio >= 0.6) {
    const list = fullList.slice(0, 4).join("·");
    sentences.push(`종합적으로 본 아동은 ${list} 등 주요 영역에서 전반적인 형성 초기 단계에 있으며, 신체적·언어적 촉구와 함께 제공될 때 부분적인 반응이 관찰됩니다.`);
    sentences.push(`현 시점의 관찰 결과는 사회적 자극에 대한 변별과 기능적 의사소통의 기초 형성이 우선되는 발달 단계에 해당하며, 강력한 강화제 기반의 동기 조작과 단순 행동 형성이 학습의 출발점이 됩니다.`);
    if (partialList.length > 0) {
      sentences.push(`${partialList.join("·")} 영역에서는 단서나 부분적 도움이 주어지면 수행이 가능하여, 강점 영역으로 활용 가능한 발달적 토대가 일부 확인됩니다.`);
    }
    if (independentList.length > 0) {
      sentences.push(`${independentList.join("·")} 영역의 자발적 수행은 학습 동기를 유도하는 매개로 활용할 수 있어 통합 중재 설계에 반영될 예정입니다.`);
    }
    sentences.push(`익숙한 환경에서는 협조적인 모습을 보이나 자발적 수행으로의 확장을 위해 전 영역에 걸친 집중적인 선행 학습, 체계적 촉구 페이딩, 그리고 일관된 강화 기반의 행동 형성 전략이 요구됩니다. 향후 데이터 기반의 진척도 추적을 통해 단계별 발달 양상을 모니터링하며, 가정과의 긴밀한 협력을 통한 일관성 확보가 핵심 전략이 됩니다.`);
  }
  else if (independentList.length >= 4 || independentRatio >= 0.6) {
    const list = independentList.slice(0, 5).join("·");
    sentences.push(`종합적으로 본 아동은 ${list} 등 대부분의 영역에서 자발적 수행이 관찰되며, 안정적인 학습 기반과 적응 행동의 토대가 견고하게 형성되어 있습니다.`);
    sentences.push(`현 시점의 관찰 결과는 핵심 발달 영역에서 자발적 행동 레퍼토리가 안정적으로 확립된 단계에 해당하며, 새로운 자극·환경에 대한 일반화와 더 정교한 사회적·인지적 기술로의 확장이 다음 발달 과제로 적합합니다.`);
    if (partialList.length > 0) {
      sentences.push(`${partialList.join("·")} 영역은 부분적인 지원과 함께 수행이 가능한 단계로, 안정화 및 다양한 맥락에서의 일반화가 단기 과제로 진행됩니다.`);
    }
    if (fullList.length > 0) {
      sentences.push(`${fullList.join("·")} 영역은 형성 초기 단계로, 강점 영역과 연계한 통합적 접근을 통해 균형 있는 발달이 도모됩니다.`);
    }
    sentences.push(`전반적으로 다양한 환경, 또래 상호작용, 그리고 그룹 활동 안에서의 일반화 단계로 진입할 준비가 갖추어진 상태이며, 향후 중재는 사회적 의사소통의 정교화·자기조절 능력의 확장·또래 관계 안에서의 자발성 형성에 초점을 맞추어 진행됩니다. 가정과 학습 환경이 일관된 강화 체계를 유지함으로써 안정적인 일반화가 이루어질 것으로 기대됩니다.`);
  }
  else {
    if (independentList.length > 0) {
      sentences.push(`종합적으로 본 아동은 ${independentList.join("·")} 영역에서 자발적 수행이 관찰되어 학습의 기반이 되는 강점으로 작용합니다.`);
    } else {
      sentences.push(`종합적으로 본 아동은 영역별로 상이한 발달 양상을 보이며, 강점과 과제가 공존하는 혼재형 발달 단계에 있습니다.`);
    }
    if (partialList.length > 0) {
      sentences.push(`${partialList.join("·")} 영역은 부분적인 도움과 함께 수행이 가능한 단계로, 일관성 확보와 자발성 확장이 단기 과제로 진행됩니다. 익숙한 자극에 대한 반응은 안정적이나 새로운 자극·환경에 대한 적응에서는 도움 의존도가 다시 증가하는 양상이 관찰되어, 점진적인 촉구 페이딩과 일반화 훈련이 핵심 중재 요소가 됩니다.`);
    }
    if (fullList.length > 0) {
      sentences.push(`${fullList.join("·")} 영역은 형성 초기 단계로, 강화 기반의 단순 행동 형성과 체계적 촉구 체계 구축을 통한 집중적인 선행 중재가 요구됩니다.`);
    }
    if (independentList.length > 0 && fullList.length > 0) {
      sentences.push(`강점 영역을 매개로 약점 영역의 학습 동기를 유도하는 통합적 접근이 핵심 전략이 되며, 영역 간 상호 작용을 활용한 자연주의적 중재와 구조화된 학습 회기를 균형 있게 운영함으로써 균형 있는 발달이 도모됩니다.`);
    }
    sentences.push(`향후 데이터 기반의 정기적 진척도 평가를 통해 영역별 발달 양상을 모니터링하며, 가정과의 협력을 통한 일관성 확보가 일반화 단계의 핵심 전략이 됩니다. 영역별 출발점이 상이한 만큼 단기·중기·장기 목표를 영역마다 차별화하여 수립하고, 회기 단위의 미세 조정을 통해 학습의 일관성과 효율을 극대화하는 통합적 중재 계획이 진행될 예정입니다.`);
  }

  return sentences.join(" ");
}

function generateDomainLevel(domain, goalsInDomain) {
  if (goalsInDomain.length === 0) return "";

  const list1Goals = goalsInDomain.filter(g => (g.listGroup || "1") === "1");
  const list2Goals = goalsInDomain.filter(g => (g.listGroup || "1") === "2");

  let totalSessions = 0, totalRateSum = 0, totalRateN = 0;
  let recentRates = [];
  goalsInDomain.forEach(g => {
    const series = getCombinedDailySeries(g);
    series.forEach(s => {
      totalSessions++;
      totalRateSum += s.rate;
      totalRateN++;
    });
    if (series.length > 0) recentRates.push(series[series.length - 1].rate);
  });
  const overallAvg = totalRateN > 0 ? Math.round(totalRateSum / totalRateN) : null;
  const recentAvg = recentRates.length > 0 ? Math.round(recentRates.reduce((a, b) => a + b, 0) / recentRates.length) : null;

  const vbmappDomains = [...new Set(goalsInDomain.filter(g => g.vbmapp).map(g => `${g.vbmapp.v}(L${g.vbmapp.lv})`))];
  const esdmDomains = [...new Set(goalsInDomain.filter(g => g.esdm).map(g => g.esdm.v))];

  const lines = [];

  const ctx = DOMAIN_CONTEXT[cleanDomainKey(domain)] || DOMAIN_CONTEXT[domain];
  if (ctx) {
    lines.push(`${withTopicParticle(cleanDomainKey(domain))} ${ctx}.`);
  } else {
    lines.push(`${domain} 영역에 대한 종합 평가를 진행하였습니다.`);
  }

  lines.push(`본 영역에서 총 ${goalsInDomain.length}개의 세부 목표가 설정되었으며${list1Goals.length > 0 ? `, 현재 ${list1Goals.length}개의 목표가 진행 중` : ""}${list2Goals.length > 0 ? `${list1Goals.length > 0 ? ", " : ", "}${list2Goals.length}개는 습득 완료` : ""}되어 있습니다.`);

  const linkage = [];
  if (vbmappDomains.length > 0) linkage.push(`VB-MAPP의 ${vbmappDomains.slice(0, 3).join(" · ")}`);
  if (esdmDomains.length > 0) linkage.push(`ESDM의 ${esdmDomains.slice(0, 3).join(" · ")}`);
  if (linkage.length > 0) {
    lines.push(`이는 ${linkage.join(" 및 ")} 영역과 연계된 선행 기술로, 후속 학습 목표의 토대가 됩니다.`);
  } else {
    lines.push(`본 영역의 기술 습득은 후속 학습·일반화 목표의 토대가 됩니다.`);
  }

  if (recentAvg === null) {
    lines.push(`현재 데일리 기록이 수집되지 않은 초기 관찰 단계이며, 기초선 측정이 진행 중입니다.`);
  } else if (recentAvg >= 80) {
    lines.push(`총 ${totalSessions}회 세션 기준 영역 전체 평균 ${overallAvg}%, 최근 평균 ${recentAvg}%로 일관된 수행을 보이며 숙달 단계에 근접한 상태입니다.`);
  } else if (recentAvg >= 50) {
    lines.push(`총 ${totalSessions}회 세션 기준 영역 전체 평균 ${overallAvg}%, 최근 평균 ${recentAvg}%로 부분적 수행을 보이며 일관성 확보 및 촉구 감소가 필요한 단계입니다.`);
  } else {
    lines.push(`총 ${totalSessions}회 세션 기준 영역 전체 평균 ${overallAvg}%, 최근 평균 ${recentAvg}%로 집중적 선행 훈련 및 체계적 촉구 체계 적용이 필요한 단계입니다.`);
  }

  if (recentAvg === null) {
    lines.push(`DTT/NET 교수법을 중심으로 체계적 촉구 체계를 적용하며, 80% 이상 2회 연속 수행을 숙달 기준으로 설정합니다.`);
  } else if (recentAvg >= 80) {
    lines.push(`숙달 도달 목표에 대해 유지·일반화 단계 진입을 계획하며, 후속 목표 도입을 단계적으로 진행합니다.`);
  } else if (recentAvg >= 50) {
    lines.push(`점진적 촉구 감소(least-to-most)와 다양한 자극 세트 도입으로 반응의 안정성과 일반화를 촉진합니다.`);
  } else {
    lines.push(`Errorless Teaching 기법과 집중 시도 교수(DTT)를 활용하여 정확 반응을 형성하고 성공 경험을 축적합니다.`);
  }

  return lines.join(" ");
}

function generatePLPText(domain, goalsInDomain) {
  if (!goalsInDomain || goalsInDomain.length === 0) return "";
  const list1 = goalsInDomain.filter(g => (g.listGroup || "1") === "1");
  const list2 = goalsInDomain.filter(g => (g.listGroup || "1") === "2");
  const recommended = goalsInDomain.filter(g => g.isRecommended);
  const vbmappList = goalsInDomain.filter(g => g.vbmapp);
  const esdmList = goalsInDomain.filter(g => g.esdm);
  const vbmappDomains = [...new Set(vbmappList.map(g => `${g.vbmapp.v}(L${g.vbmapp.lv})`))];
  const esdmDomains = [...new Set(esdmList.map(g => g.esdm.v))];
  const vbLevels = vbmappList.map(g => g.vbmapp.lv);
  const minLv = vbLevels.length > 0 ? Math.min(...vbLevels) : null;
  const maxLv = vbLevels.length > 0 ? Math.max(...vbLevels) : null;

  const lines = [];

  const ctx = DOMAIN_CONTEXT[cleanDomainKey(domain)] || DOMAIN_CONTEXT[domain];
  if (ctx) {
    lines.push(`${cleanDomainKey(domain)} 영역은 ${ctx.replace(/영역입니다$/, "영역으로")}, 본 아동의 발달 단계에서 우선적으로 다루어야 할 핵심 목표로 판단되어 IEP에 포함되었습니다.`);
  } else {
    lines.push(`${domain} 영역은 본 아동의 발달 단계에서 우선적으로 다루어야 할 핵심 영역으로 평가되어 IEP에 포함되었습니다.`);
  }

  if (vbmappDomains.length > 0 && minLv !== null) {
    const lvRange = minLv === maxLv ? `Level ${minLv}` : `Level ${minLv}~${maxLv}`;
    lines.push(`사전 평가 결과 VB-MAPP의 ${vbmappDomains.slice(0, 3).join(" · ")} 영역에서 ${lvRange} 수준의 마일스톤이 출발점으로 확인되었습니다.`);
  }
  if (esdmDomains.length > 0) {
    lines.push(`ESDM 발달 평가에서는 ${esdmDomains.slice(0, 3).join(" · ")} 영역의 발달 항목이 본 아동의 현 단계에 적합한 학습 목표로 도출되었습니다.`);
  }

  if (list2.length > 0 && list1.length > 0) {
    lines.push(`현재 본 영역에서는 ${list2.length}개의 선행 기술이 안정적으로 형성되어 있어 강점으로 작용하며, ${list1.length}개의 후속 기술은 체계적인 지도가 필요한 상태입니다.`);
  } else if (list2.length > 0) {
    lines.push(`본 영역의 기초 기술 ${list2.length}개가 안정권에 진입하여 강점으로 작용하며, 이를 토대로 다음 단계 목표 도입을 계획하고 있습니다.`);
  } else if (recommended.length > 0) {
    lines.push(`사전 평가에서 본 아동의 강점과 동기 수준에 부합하는 ${recommended.length}개 목표가 우선 선정되었으며, 단계적 도입을 통해 성공 경험을 누적할 예정입니다.`);
  } else {
    lines.push(`본 영역은 아직 기초 기술이 형성되기 전 단계로, 체계적인 선행 학습을 통해 기초 기반을 구축하는 것을 우선 과제로 합니다.`);
  }

  const closingVariants = [
    `총 ${goalsInDomain.length}개의 세부 목표를 80% 이상 2회 연속 정반응의 숙달 기준에 따라 단계적으로 지도하며, 본 아동의 강점과 선호를 반영한 개별화 접근으로 진전을 도모합니다.`,
    `세부 목표 ${goalsInDomain.length}개를 과제 분석을 통해 작은 단계로 나누어 지도하고, 80% 이상 2회 연속 정반응을 숙달 기준으로 삼아 안정적인 기술 습득을 목표로 합니다.`,
    `본 영역에서는 ${goalsInDomain.length}개의 세부 목표를 설정하였으며, 아동의 동기와 선호를 고려한 개별화된 지도를 통해 80% 이상 2회 연속 정반응의 숙달 기준 도달을 지향합니다.`,
    `${goalsInDomain.length}개의 세부 목표에 대해 단계를 잘게 나눈 체계적 지도를 적용하며, 80% 이상 2회 연속 정반응을 기준으로 숙달 여부를 판단하고 일반화로 확장해 나갈 계획입니다.`,
    `설정된 ${goalsInDomain.length}개 세부 목표는 아동의 현행 수준에 맞추어 점진적으로 지도하고, 80% 이상 2회 연속 정반응의 숙달 기준 충족 시 다음 단계로 진행합니다.`,
  ];
  // 영역명 기준으로 패턴을 고정 선택 → 같은 영역은 항상 같은 문장(일관성), 영역끼리는 다른 문장(다양성)
  let hash = 0;
  for (let k = 0; k < domain.length; k++) hash = (hash * 31 + domain.charCodeAt(k)) >>> 0;
  lines.push(closingVariants[hash % closingVariants.length]);

  return lines.join(" ");
}

function getDomainLevel(domain, goalsInDomain, overrides) {
  const override = overrides?.[domain];
  if (override !== undefined && override !== null && override.trim() !== "") {
    return override;
  }
  return generateDomainLevel(domain, goalsInDomain);
}

function buildReportDomainLevel(domain, goalsInDomain, cutoffDate) {
  if (!goalsInDomain || goalsInDomain.length === 0) {
    return "본 영역의 IEP 포함 목표는 아직 설정되어 있지 않습니다.";
  }

  let allTasks = [];
  goalsInDomain.forEach(g => {
    (g.tasks || []).forEach(t => {
      if (cutoffDate && t.listGroup === "2" && t.masteredAt && t.masteredAt <= cutoffDate) return;
      allTasks.push({ task: t, goal: g });
    });
  });

  if (allTasks.length === 0) {
    return `본 영역에 ${goalsInDomain.length}개의 IEP 목표가 설정되어 있으나, 아직 세부 과제가 등록되지 않아 데이터 기반 평가가 불가합니다.`;
  }

  const list1Tasks = allTasks.filter(({ task }) => (task.listGroup || "1") === "1");  // 진행 중
  const list2Tasks = allTasks.filter(({ task }) => task.listGroup === "2");           // 습득 완료
  const pausedTasks = allTasks.filter(({ task }) => task.listGroup === "paused");     // 중단
  const totalTasks = allTasks.length;

  let totalRateSum = 0, totalRateN = 0;
  let recentRates = [];
  const calcDayRate = calcDayRateGlobal;
  allTasks.forEach(({ task }) => {
    const daily = task.daily || {};
    const dates = Object.keys(daily).sort()
      .filter(d => !cutoffDate || d >= cutoffDate);
    dates.forEach(d => {
      const r = calcDayRate(daily[d], task.plannedTrials);
      if (r !== null) { totalRateSum += r; totalRateN++; }
    });
    for (let i = dates.length - 1; i >= 0; i--) {
      const r = calcDayRate(daily[dates[i]], task.plannedTrials);
      if (r !== null) { recentRates.push(r); break; }
    }
  });
  const overallAvg = totalRateN > 0 ? Math.round(totalRateSum / totalRateN) : null;
  const recentAvg = recentRates.length > 0 ? Math.round(recentRates.reduce((a, b) => a + b, 0) / recentRates.length) : null;

  const lines = [];
  const today = new Date();
  const reportMonth = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;

  let summary = `${reportMonth} 현재 본 영역에서는 총 ${totalTasks}개의 세부 과제가 운영 중이며, `;
  const parts = [];
  if (list1Tasks.length > 0) parts.push(`${list1Tasks.length}개가 진행 중`);
  if (list2Tasks.length > 0) parts.push(`${list2Tasks.length}개가 습득 완료`);
  if (pausedTasks.length > 0) parts.push(`${pausedTasks.length}개가 중단 상태`);
  summary += parts.join(", ") + "입니다.";
  lines.push(summary);

  if (totalRateN === 0) {
    lines.push(`아직 데이터 시트에 입력된 정반응 기록이 없어 정량적 평가는 어려운 상태입니다.`);
  } else {
    let perfLine = `누적 ${totalRateN}회의 평가 세션에서 평균 정반응률 ${overallAvg}%를 기록`;
    if (recentAvg !== null && recentRates.length > 0) {
      perfLine += `, 최근 평가 평균은 ${recentAvg}%로 나타났습니다.`;
    } else {
      perfLine += `하였습니다.`;
    }
    lines.push(perfLine);
  }

  if (overallAvg !== null) {
    if (overallAvg >= 80 && recentAvg !== null && recentAvg >= overallAvg) {
      lines.push(`전반적으로 안정적인 수행을 보이고 있어 일반화 단계 또는 다음 수준으로의 확장이 가능합니다.`);
    } else if (overallAvg >= 60) {
      lines.push(`기본 형성은 이루어지고 있으나 안정적 수행을 위해 추가 회기가 필요한 단계입니다.`);
    } else if (overallAvg >= 30) {
      lines.push(`반응의 형성 단계에 있으며 촉구 감소와 강화 일정 조정을 통한 정확도 향상이 우선 과제입니다.`);
    } else {
      lines.push(`반응 수립 초기 단계로, Errorless Teaching과 집중 시도 교수를 통한 정확 반응 형성이 진행 중입니다.`);
    }
  }

  if (pausedTasks.length > 0) {
    const reasons = [...new Set(pausedTasks.map(({ task }) => task.pauseReason).filter(Boolean))];
    if (reasons.length > 0) {
      lines.push(`중단된 ${pausedTasks.length}개 과제는 ${reasons.slice(0, 2).join(", ")} 등의 사유로 잠정 보류 중이며, 추후 재평가 예정입니다.`);
    } else {
      lines.push(`중단된 ${pausedTasks.length}개 과제는 추후 재평가를 거쳐 진행 여부를 결정할 예정입니다.`);
    }
  }

  return lines.join(" ");
}

function shortDomain(d) {
  if (!d) return "-";
  const map = {
    "Ⅰ 선호물·강화제": "선호", "Ⅱ 조건화된 강화": "강화",
    "Ⅲ 화자 언어 작동": "화자", "Ⅳ 교수 준비도": "준비",
    "Ⅴ 자기관리": "자기관리", "Ⅵ 언어행동기초": "언어기초",
    "Ⅶ 청자": "청자", "Ⅷ 화자": "화자심화",
    "Ⅸ 강화제군": "강화군", "Ⅹ 학습능력": "학습",
    "Ⅺ 신체발달": "신체"
  };
  return map[d] || d.replace(/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪ]\s*/, "").slice(0, 20);
}

const CURRICULUM_ORDER = { "ELCAR": 1, "VB-MAPP": 2, "ESDM": 3, "기타": 4 };
const ROMAN_ORDER = { "Ⅰ": 1, "Ⅱ": 2, "Ⅲ": 3, "Ⅳ": 4, "Ⅴ": 5, "Ⅵ": 6, "Ⅶ": 7, "Ⅷ": 8, "Ⅸ": 9, "Ⅹ": 10, "Ⅺ": 11 };

function getDomainOrderKey(domain) {
  if (!domain) return 999;
  const firstChar = domain.charAt(0);
  if (ROMAN_ORDER[firstChar]) return ROMAN_ORDER[firstChar];
  return 100 + domain.charCodeAt(0);
}

function sortGoals(goalsArray) {
  if (!Array.isArray(goalsArray)) return goalsArray;
  return [...goalsArray].sort((a, b) => {
    const aCur = CURRICULUM_ORDER[a.source || "ELCAR"] || 99;
    const bCur = CURRICULUM_ORDER[b.source || "ELCAR"] || 99;
    if (aCur !== bCur) return aCur - bCur;
    const aDom = getDomainOrderKey(a.domain);
    const bDom = getDomainOrderKey(b.domain);
    if (aDom !== bDom) return aDom - bDom;
    const aDomStr = a.domain || "";
    const bDomStr = b.domain || "";
    if (aDomStr !== bDomStr) return aDomStr.localeCompare(bDomStr);
    const aSub = a.subDomain || "";
    const bSub = b.subDomain || "";
    if (aSub !== bSub) return aSub.localeCompare(bSub);
    const aId = a.id || "";
    const bId = b.id || "";
    return aId.localeCompare(bId);
  });
}

const STORAGE_KEY_V1 = "gd-aba-iep-v1";        // 이전 버전 (단일 아동) — 마이그레이션용
const STORAGE_KEY = "gd-aba-v5-children";      // 아동 리스트
const ACTIVE_KEY = "gd-aba-v5-active";          // 현재 선택된 아동 ID
const FILE_KEY = "iep-data-backup";
const LAST_BACKUP_KEY = "gd-aba-last-backup-at";   // 마지막 💾 전체 백업 시각 (ISO)
const AUTO_BACKUP_ENABLED_KEY = "gd-aba-auto-backup-enabled";  // "1" | "0"
const AUTO_BACKUP_INTERVAL_KEY = "gd-aba-auto-backup-interval"; // 분 단위: "30" | "60" | "120" | "240"
const BACKUP_HISTORY_KEY = "gd-aba-backup-history";  // 최근 10개 백업 기록 (JSON 배열)

const AUTH_ADMIN_PW_KEY = "gd-aba-admin-pw";       // 관리자 비밀번호 (해시)
const AUTH_TEACHERS_KEY = "gd-aba-teachers";       // 선생님 목록 (JSON 배열)
const AUTH_CURRENT_USER_KEY = "gd-aba-current-user";  // 현재 로그인 정보 {role, name}

function simpleHash(str) {
  let hash = 0;
  if (!str || str.length === 0) return "0";
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;  // 32bit
  }
  return String(hash);
}

const ARCHIVE_INDEX_PREFIX = "gd-aba-archives:";  // + childId → 인덱스 배열
const ARCHIVE_ITEM_PREFIX = "gd-aba-archive:";    // + archiveId → 개별 스냅샷

function fmtArchivePeriod(start, end) {
  const s = start ? String(start).slice(0, 7).replace("-", ".") : "";
  const e = end ? String(end).slice(0, 7).replace("-", ".") : "";
  if (s && e) return `${s}~${e}`;
  if (s) return s;
  if (e) return e;
  return new Date().toISOString().slice(0, 7).replace("-", ".");
}

async function loadArchiveList(childId) {
  if (!childId) return [];
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(ARCHIVE_INDEX_PREFIX + childId);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
      }
    }
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(ARCHIVE_INDEX_PREFIX + childId);
      if (r?.value) {
        const list = JSON.parse(r.value);
        if (Array.isArray(list)) return list.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
      }
    }
  } catch (e) {}
  return [];
}

async function loadArchiveItem(archiveId) {
  if (!archiveId) return null;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(ARCHIVE_ITEM_PREFIX + archiveId);
      if (raw) return JSON.parse(raw);
    }
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(ARCHIVE_ITEM_PREFIX + archiveId);
      if (r?.value) return JSON.parse(r.value);
    }
  } catch (e) {}
  return null;
}

async function saveArchiveItem(snapshot, autoMode) {
  if (!snapshot || !snapshot.childId) return null;
  try {
    const childId = snapshot.childId;
    let list = await loadArchiveList(childId);
    if (autoMode) {
      const now = Date.now();
      const sameRecent = list.find(item =>
        item.auto === true &&
        item.period === snapshot.period &&
        (now - new Date(item.savedAt || 0).getTime() < 24 * 3600 * 1000)
      );
      if (sameRecent) {
        const fullId = sameRecent.id;
        const fullSnap = { ...snapshot, id: fullId, order: sameRecent.order, auto: true, savedAt: new Date().toISOString() };
        try {
          if (typeof localStorage !== "undefined") localStorage.setItem(ARCHIVE_ITEM_PREFIX + fullId, JSON.stringify(fullSnap));
        } catch (e) {}
        try {
          if (typeof window !== "undefined" && window.storage) {
            await window.storage.set(ARCHIVE_ITEM_PREFIX + fullId, JSON.stringify(fullSnap)).catch(() => {});
          }
        } catch (e) {}
        list = list.map(item => item.id === fullId ? { ...item, savedAt: fullSnap.savedAt } : item);
        try {
          if (typeof localStorage !== "undefined") localStorage.setItem(ARCHIVE_INDEX_PREFIX + childId, JSON.stringify(list));
        } catch (e) {}
        try {
          if (typeof window !== "undefined" && window.storage) {
            await window.storage.set(ARCHIVE_INDEX_PREFIX + childId, JSON.stringify(list)).catch(() => {});
          }
        } catch (e) {}
        return { id: fullId, overwrite: true, savedAt: fullSnap.savedAt };
      }
    }
    const id = "rpt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const order = (list.length || 0) + 1;
    const fullSnap = { ...snapshot, id, order, auto: !!autoMode, savedAt: new Date().toISOString() };
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(ARCHIVE_ITEM_PREFIX + id, JSON.stringify(fullSnap));
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.storage) {
        await window.storage.set(ARCHIVE_ITEM_PREFIX + id, JSON.stringify(fullSnap)).catch(() => {});
      }
    } catch (e) {}
    const indexEntry = { id, title: fullSnap.title, period: fullSnap.period, order, savedAt: fullSnap.savedAt, auto: fullSnap.auto, isFinal: fullSnap.isFinal || false, isIep: fullSnap.isIep || false, prevEvalStart: fullSnap.prevEvalStart || "", prevEvalEnd: fullSnap.prevEvalEnd || "" };
    const newList = [...list, indexEntry];
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(ARCHIVE_INDEX_PREFIX + childId, JSON.stringify(newList));
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.storage) {
        await window.storage.set(ARCHIVE_INDEX_PREFIX + childId, JSON.stringify(newList)).catch(() => {});
      }
    } catch (e) {}
    return { id, overwrite: false, savedAt: fullSnap.savedAt };
  } catch (e) {
    console.warn("[보관] 저장 실패:", e);
    return null;
  }
}

async function deleteArchiveItem(childId, archiveId) {
  if (!childId || !archiveId) return false;
  try {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(ARCHIVE_ITEM_PREFIX + archiveId);
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.storage) {
        await window.storage.delete(ARCHIVE_ITEM_PREFIX + archiveId).catch(() => {});
      }
    } catch (e) {}
    let list = await loadArchiveList(childId);
    const newList = list.filter(item => item.id !== archiveId);
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(ARCHIVE_INDEX_PREFIX + childId, JSON.stringify(newList));
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.storage) {
        await window.storage.set(ARCHIVE_INDEX_PREFIX + childId, JSON.stringify(newList)).catch(() => {});
      }
    } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

const blankChild = () => ({
  id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
  info: {
    name: "", birth: "", room: "개별 ABA",
    therapist: "", evalStart: "", evalEnd: "",
    startDate: new Date().toISOString().slice(0, 10),
    ownerName: "",  // 이 아동을 담당하는 선생님 이름 (빈 문자열 = 미지정)
    isPinned: false,
    sWeek: "", sMin: "", sTotal: "",  // 주 N회, N분, 총 세션
    fn: "",  // 보고서에 쓰일 아동 호칭 (기본 info.name 사용)
    pStart: "", pEnd: "",  // 보고 기간
    iepObservations: { eyeContact: "", requesting: "", following: "", attention: "", imitation: "", selfCare: "" },
    iepObservationLevels: { eyeContact: null, requesting: null, following: null, attention: null, imitation: null, selfCare: null },
    iepObservationSummaryOverride: null,
    iepObservationTone: "improvement",
    finalEndDate: "",      // 종결일 (사용자 입력)
    archivedAt: "",        // ★ [신규] 아카이브 일시 (YYYY-MM-DD HH:mm) — 비어있으면 활성, 값 있으면 보관함
    finalReferralReason: "",  // 의뢰 사유 (치료 시작 시 주호소)
    finalEndReason: "",    // 종결 사유 (목표 달성 / 가족 사정 / 다음 단계 이행)
    finalSummary: "",      // 종합 평가 (자동 생성 + 수정 가능)
    finalGrowth: "",       // 치료 기간 중 성장과 변화 (자동 생성 + 수정 가능)
    finalHomeMaintenance: "",  // 가정에서의 유지 방안 (수동 + 빠른 칩)
    finalRecommendations: "",  // 권고사항 (수동 + 빠른 칩)
    finalBehaviorChange: "",   // 문제행동 변화 (선택, 수동 입력)
    finalHandover: "",     // 다음 기관 인계 정보 (선택, 자동 생성 + 수정 가능)
    iepReferralReason: "",      // IEP 의뢰 사유 (자동 생성 + 수정)
    iepHomeCollab: "",          // 보호자 협력 방안 (자동 생성 + 수정)
    iepRecommendations: ""      // 권고사항 (자동 생성 + 수정)
  },
  goals: [],
  domainLevelOverrides: {},
  reportFields: ["", "", "", "", ""],  // 언어/사회성/문제행동/교수참여도/최근변화
  reportSelStrats: [],  // 중재 전략 선택
  reportSelStratsCustom: "",  // W-18: 중재 전략 직접입력 (콤마 구분)
  reportSelPrein: [],   // 1차 강화제
  reportSelSrein: [],   // 2차 강화제
  reportReinfSchedule: "",  // W-19: 강화 스케줄 (예: FR1 → VR3 thin)
  reportBehaviors: [],
  reportSections: {},   // 자동 생성된 섹션 본문 저장
  dailyMemos: {},   // { "2025-04-29": "메모 내용", ... }
  mediaList: [],  // [{ id, name, type, base64, uploadedAt }, ...]
  history: [],  // [{ id, childName, userName, action, timestamp, description, before, after }, ...]
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const migrateGoal = (g) => {
  const base = {
    status: "active",
    statusLocked: false,
    currentLevelOverride: null,
    daily: {},
    note: "",
    includeInIep: true,
    showInDaily: false,   // 데이터 시트 노출 기본값 — 저장된 값(...g)이 있으면 그 값이 유지됨
    isRecommended: !!(g.vbmapp || g.esdm),
    listGroup: "1",
    listName: "",
    listItems: "",
    tasks: [],
    startListNum: 1,
    promptLevel: "",          // 현재 촉구 단계: "PP" | "MP" | "MT" | "GP" | "IP" | ""
    promptFadingPlan: "",     // 용암 계획 자유 텍스트 (예: "2주 내 GP로 이행")
    generalizationPlan: "",   // 일반화 계획 자유 텍스트
    ...g
  };
  if (base.strategy === "DTT/NET") base.strategy = "";
  if (base.masteryCrit === "80% 이상 2회 연속") base.masteryCrit = "";
  if (Array.isArray(base.tasks)) {
    base.tasks = base.tasks.map(t => ({
      measureMode: "raw",   // 기본값 — t.measureMode가 있으면 아래 spread로 덮어씀
      plannedTrials: 10,    // 기본값 — t.plannedTrials가 있으면 덮어씀
      resumedAt: null,      // 재실시 날짜 (paused → 1로 갈 때 setTaskListGroup이 기록)
      ...t
    }));
    base.tasks = base.tasks.map(t =>
      t.measureMode === "pct" ? { ...t, measureMode: "raw" } : t
    );
  }
  if ((!base.tasks || base.tasks.length === 0) && base.listItems && base.listItems.trim()) {
    base.tasks = base.listItems.split(/[,\n]/).map(s => s.trim()).filter(Boolean).map((name, idx) => ({
      id: "t_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).slice(2, 6),
      name,
      listGroup: "1",
      listGroupLocked: false,
      daily: {},
      masteredAt: null,
      measureMode: "raw",   // listItems 변환분도 옛 데이터로 간주 → raw
      plannedTrials: 10
    }));
  }
  return base;
};

const migrateChild = (c) => ({
  ...blankChild(),
  ...c,
  info: { ...blankChild().info, ...(c.info || {}) },
  goals: (c.goals || []).map(migrateGoal),
  domainLevelOverrides: c.domainLevelOverrides || {},
  reportFields: Array.isArray(c.reportFields) && c.reportFields.length === 5 ? c.reportFields : ["", "", "", "", ""],
  reportSelStrats: c.reportSelStrats || [],
  reportSelStratsCustom: c.reportSelStratsCustom || "",
  reportSelPrein: c.reportSelPrein || [],
  reportSelSrein: c.reportSelSrein || [],
  reportReinfSchedule: c.reportReinfSchedule || "",
  reportBehaviors: (() => {
    if (Array.isArray(c.reportBehaviors)) return c.reportBehaviors;
    const hasOld = c.reportBName || c.reportBSeverity ||
      (Array.isArray(c.reportSelFuncs) && c.reportSelFuncs.length > 0) ||
      c.reportBInter || (Array.isArray(c.reportSelInterventions) && c.reportSelInterventions.length > 0);
    if (!hasOld) return [];
    const oldInterv = Array.isArray(c.reportSelInterventions) ? c.reportSelInterventions : [];
    const isCustom = oldInterv[0] === "__custom__";
    return [{
      name: c.reportBName || "",
      severity: c.reportBSeverity || "",
      funcs: Array.isArray(c.reportSelFuncs) ? c.reportSelFuncs : [],
      funcOther: c.reportSelFuncOther || "",
      intervention: oldInterv[0] || "",
      interventionCustom: isCustom ? (c.reportBInter || "") : ""
    }];
  })(),
  reportSections: c.reportSections || {},
  dailyMemos: c.dailyMemos && typeof c.dailyMemos === "object" ? c.dailyMemos : {}
});

function ManualModal({ onClose }) {
  const sec = (title, lines) => (
    <section style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, color: "#D4728A", margin: "0 0 8px", fontWeight: 700 }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: "#444" }}>
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </section>
  );
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10002,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 14, padding: "28px 26px",
        maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, color: "#D4728A", margin: 0, fontWeight: 800 }}>📖 사용설명서</h2>
          <button onClick={onClose} style={{
            border: "none", background: "#f3f3f3", borderRadius: 8,
            width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "#666"
          }}>✕</button>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#333", marginBottom: 16 }}>
          검단ABA 통합 시스템 사용설명서
        </div>
        {sec("1. 로그인", [
          "인터넷 주소창에 사이트 주소를 입력하면 로그인 화면이 나옵니다.",
          "관리자(센터장): 이름 칸에 '관리자' 입력 + 비밀번호",
          "선생님: 본인 이름 입력 + 비밀번호",
          "PC·태블릿·핸드폰 어디서든 같은 주소로 로그인할 수 있습니다."
        ])}
        {sec("2. 아동 등록", [
          "로그인 후 새 아동을 등록합니다. 이름·생년월일·소속반·담당 치료사를 입력합니다.",
          "선생님은 본인이 담당하는 아동만 보고 관리할 수 있습니다."
        ])}
        {sec("3. 평가 데이터 입력", [
          "ELCAR / VB-MAPP / ESDM 세 가지 커리큘럼을 선택해 평가합니다.",
          "각 영역의 현행 수준을 입력하면 기초선 그래프가 자동으로 그려집니다."
        ])}
        {sec("4. 보고서 자동 생성", [
          "IEP(개별화 교육 계획) / 중간보고서 / 종결보고서를 자동으로 생성합니다.",
          "각 영역 문장이 자동으로 채워지며, 필요하면 직접 수정할 수 있습니다.",
          "수정한 내용은 자동 저장됩니다."
        ])}
        {sec("5. 인쇄 (PDF)", [
          "완성된 보고서는 공문서 양식으로 인쇄하거나 PDF로 저장할 수 있습니다."
        ])}
        {sec("6. 데이터 저장", [
          "입력한 모든 데이터는 클라우드에 자동 저장됩니다.",
          "관리자는 모든 선생님의 아동을, 선생님은 본인 아동을 조회할 수 있습니다."
        ])}
        <div style={{
          marginTop: 8, paddingTop: 14, borderTop: "1px solid #eee",
          fontSize: 11, color: "#999", textAlign: "center"
        }}>
          © 검단ABA언어행동연구소 (민다혜). All rights reserved.
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ view, message, onSetupAdmin, onLogin }) {
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [name, setName] = useState("");
  const [showManual, setShowManual] = useState(false);

  const handleSubmit = () => {
    if (view === "setup") {
      if (pw !== pwConfirm) {
        alert("비밀번호와 확인이 일치하지 않습니다.");
        return;
      }
      onSetupAdmin(pw);
    } else {
      onLogin(name, pw);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#fdf8f9 0%,#fff 50%,#fdf8f9 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px"
    }}>
      <div style={{
        maxWidth: 420, width: "100%",
        background: "#fff", borderRadius: 16, padding: 32,
        boxShadow: "0 4px 24px rgba(212,114,138,0.12)",
        border: `2px solid ${PK}`
      }}>
        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, margin: "0 auto 14px",
            borderRadius: 16, background: PKL, border: `2px solid ${PK}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: PKD, letterSpacing: "-1px"
          }}>ABA</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#333", marginBottom: 4 }}>
            검단ABA언어행동연구소
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {view === "setup" ? "관리자 비밀번호 설정" : "통합 매니지먼트 시스템 로그인"}
          </div>
        </div>

        {/* 안내 */}
        {view === "setup" && (
          <div style={{
            padding: 12, marginBottom: 16,
            background: "#fdf8f9", borderRadius: 8,
            fontSize: 11.5, color: PKD, lineHeight: 1.6
          }}>
            🔒 <b>처음 사용</b>이시군요! 관리자(센터장) 비밀번호를 먼저 설정해주세요.<br />
            이 비밀번호로 선생님 계정을 추가·관리할 수 있습니다.
          </div>
        )}

        {/* 입력 폼 */}
        {view !== "setup" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: PKD, display: "block", marginBottom: 4 }}>이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="이름 입력 (관리자는 '관리자')"
              onKeyDown={e => { if (e.key === "Enter") document.getElementById("auth-pw-input")?.focus(); }}
              style={{
                width: "100%", padding: "10px 12px",
                border: `1px solid ${PK}`, borderRadius: 8,
                fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
                outline: "none"
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: view === "setup" ? 12 : 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: PKD, display: "block", marginBottom: 4 }}>
            {view === "setup" ? "새 관리자 비밀번호 (4자 이상)" : "비밀번호"}
          </label>
          <input
            id="auth-pw-input"
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="비밀번호 입력"
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (view === "setup") document.getElementById("auth-pw-confirm")?.focus();
                else handleSubmit();
              }
            }}
            style={{
              width: "100%", padding: "10px 12px",
              border: `1px solid ${PK}`, borderRadius: 8,
              fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
              outline: "none"
            }}
          />
        </div>

        {view === "setup" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: PKD, display: "block", marginBottom: 4 }}>비밀번호 확인</label>
            <input
              id="auth-pw-confirm"
              type="password"
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              placeholder="비밀번호 다시 입력"
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              style={{
                width: "100%", padding: "10px 12px",
                border: `1px solid ${PK}`, borderRadius: 8,
                fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
                outline: "none"
              }}
            />
          </div>
        )}

        {message && (
          <div style={{
            padding: 10, marginBottom: 14,
            background: "#fef0f0", border: "1px solid #f5b7b1", borderRadius: 8,
            fontSize: 11.5, color: "#c0392b"
          }}>
            {message}
          </div>
        )}

        <button
          onClick={handleSubmit}
          style={{
            width: "100%", padding: "12px",
            background: PKD, color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit"
          }}>
          {view === "setup" ? "✅ 관리자 설정 완료" : "🔓 로그인"}
        </button>

        <div style={{
          marginTop: 18, paddingTop: 14, borderTop: "1px dashed #e8d0d6",
          fontSize: 10, color: "#999", lineHeight: 1.6, textAlign: "center"
        }}>
          {view === "setup"
            ? "이 비밀번호는 클라우드에 안전하게 저장되며, 어느 기기에서든 로그인할 수 있습니다."
            : "관리자(센터장)는 이름 '관리자', 선생님은 본인 이름으로 로그인."}
        </div>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button onClick={() => setShowManual(true)} style={{
            border: "1px solid #F5A0B1", background: "#fff", color: "#D4728A",
            borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}>📖 사용설명서</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: "#bbb", textAlign: "center" }}>
          © 검단ABA언어행동연구소 (민다혜). All rights reserved.
        </div>
      </div>
      {showManual && <ManualModal onClose={() => setShowManual(false)} />}
    </div>
  );
}

function WelcomeModal({ teacherName, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 28,
        maxWidth: 520, width: "100%", maxHeight: "88vh", overflow: "auto",
        boxShadow: "0 10px 32px rgba(0,0,0,0.22)"
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>👋</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: PKD, marginBottom: 4 }}>
            {teacherName} 선생님, 환영합니다!
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            검단ABA언어행동연구소 IEP 보고서 시스템
          </div>
        </div>

        {/* 시스템 소개 */}
        <div style={{
          padding: 14, marginBottom: 14,
          background: "#fdf8f9", borderRadius: 10, border: `1px solid ${PKL}`,
          fontSize: 12, color: "#444", lineHeight: 1.7
        }}>
          ABA 치료 보고서(<b>IEP / 중간 / 종결</b>) 작성과<br />
          아동 관리를 한 곳에서 처리할 수 있는 통합 도구입니다.
        </div>

        {/* 첫 사용 가이드 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: PKD, marginBottom: 8 }}>
          📌 첫 사용 가이드
        </div>
        <div style={{
          padding: 14, marginBottom: 14,
          background: "#fff", borderRadius: 10, border: `1px solid ${PK}`,
          fontSize: 12, color: "#333", lineHeight: 1.9
        }}>
          <div><b>➊</b> 좌측 상단 <b style={{ color: PKD }}>"+ 새 아동 추가"</b>로 담당 아동 등록</div>
          <div><b>➋</b> 목표 입력 → 회기별 수행 데이터 입력</div>
          <div><b>➌</b> 보고서 자동 생성 (IEP / 중간 / 종결)</div>
          <div><b>➍</b> 인쇄 또는 PDF로 저장</div>
        </div>

        {/* 중요 안내 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: PKD, marginBottom: 8 }}>
          ⚠️ 꼭 알아두세요
        </div>
        <div style={{
          padding: 14, marginBottom: 18,
          background: "#fff8e7", borderRadius: 10, border: "1px solid #f5deb3",
          fontSize: 11.5, color: "#5c4a2a", lineHeight: 1.8
        }}>
          • 본인이 등록한 아동만 보입니다 (다른 선생님 아동은 ❌)<br />
          • 비밀번호 변경/계정 문의는 <b>민다혜 BCBA</b>에게<br />
          • 데이터는 클라우드에 자동 저장됩니다
        </div>

        {/* 확인 버튼 */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "12px",
            background: PKD, color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit"
          }}>
          ✅ 확인했어요
        </button>

        <div style={{
          marginTop: 10, fontSize: 10, color: "#aaa", textAlign: "center"
        }}>
          이 안내는 한 번만 표시됩니다.
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ onClose }) {
  const [teachers, setTeachers] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editPw, setEditPw] = useState("");

  const loadTeachers = async () => {
    try {
      let raw = null;
      if (typeof window !== "undefined" && window.storage) {
        try {
          const res = await window.storage.get(AUTH_TEACHERS_KEY, true);
          raw = res?.value;
        } catch (e) {}
      }
      if (!raw && typeof localStorage !== "undefined") {
        raw = localStorage.getItem(AUTH_TEACHERS_KEY);
        if (raw && typeof window !== "undefined" && window.storage) {
          try { await window.storage.set(AUTH_TEACHERS_KEY, raw, true); } catch (e) {}
        }
      }
      setTeachers(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setTeachers([]);
    }
  };

  useEffect(() => { loadTeachers(); }, []);

  const saveTeachers = async (list) => {
    try {
      const json = JSON.stringify(list);
      if (typeof window !== "undefined" && window.storage) {
        try { await window.storage.set(AUTH_TEACHERS_KEY, json, true); } catch (e) {}
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(AUTH_TEACHERS_KEY, json);
      }
      setTeachers(list);
    } catch (e) { alert("저장 실패: " + e?.message); }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPw) {
      alert("이름과 비밀번호를 모두 입력하세요.");
      return;
    }
    if (newPw.length < 4) {
      alert("비밀번호는 최소 4자 이상이어야 합니다.");
      return;
    }
    if (teachers.some(t => t.name === newName.trim())) {
      alert("이미 등록된 이름입니다.");
      return;
    }
    if (newName.trim() === SUPERVISOR_NAME || newName.trim() === "관리자" || newName.trim() === "센터장") {
      alert("이 이름은 관리자 전용입니다. 다른 이름을 사용하세요.");
      return;
    }
    const newTeacher = {
      id: "t_" + Date.now(),
      name: newName.trim(),
      pwHash: simpleHash(newPw),
      createdAt: new Date().toISOString()
    };
    await saveTeachers([...teachers, newTeacher]);
    setNewName(""); setNewPw("");
  };

  const handleDelete = async (id) => {
    const t = teachers.find(x => x.id === id);
    if (!confirm(`'${t?.name}' 선생님 계정을 삭제할까요?`)) return;
    await saveTeachers(teachers.filter(x => x.id !== id));
  };

  const handleChangePw = async (id) => {
    if (!editPw || editPw.length < 4) {
      alert("새 비밀번호는 최소 4자 이상이어야 합니다.");
      return;
    }
    const updated = teachers.map(t =>
      t.id === id ? { ...t, pwHash: simpleHash(editPw) } : t
    );
    await saveTeachers(updated);
    setEditingId(null); setEditPw("");
    alert("비밀번호가 변경되었습니다.");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20
    }}
      onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 24,
        maxWidth: 540, width: "100%", maxHeight: "85vh", overflow: "auto",
        boxShadow: "0 8px 28px rgba(0,0,0,0.2)"
      }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: PKD }}>👥 선생님 계정 관리</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, color: "#888", cursor: "pointer", padding: 0, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* 새 선생님 추가 */}
        <div style={{
          padding: 14, marginBottom: 18,
          background: "#fdf8f9", borderRadius: 10, border: `1px solid ${PK}`
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 10 }}>+ 새 선생님 추가</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="선생님 이름"
              style={{ padding: "8px 10px", border: `1px solid ${PK}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="초기 비밀번호 (4자 이상)"
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              style={{ padding: "8px 10px", border: `1px solid ${PK}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <button
              onClick={handleAdd}
              style={{ padding: "8px 12px", background: PKD, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              + 선생님 추가
            </button>
          </div>
        </div>

        {/* 선생님 목록 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 8 }}>
          📋 등록된 선생님 ({teachers.length}명)
        </div>
        {teachers.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#888" }}>
            아직 등록된 선생님이 없습니다.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teachers.map(t => (
              <div key={t.id} style={{
                padding: 12,
                background: "#fafafa", border: "1px solid #eee", borderRadius: 8
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                      등록: {t.createdAt ? new Date(t.createdAt).toLocaleDateString("ko-KR") : "-"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {editingId === t.id ? (
                      <>
                        <input
                          type="password"
                          value={editPw}
                          onChange={e => setEditPw(e.target.value)}
                          placeholder="새 비밀번호"
                          onKeyDown={e => { if (e.key === "Enter") handleChangePw(t.id); }}
                          style={{ padding: "5px 8px", border: `1px solid ${PK}`, borderRadius: 5, fontSize: 11, fontFamily: "inherit", width: 130 }}
                        />
                        <button
                          onClick={() => handleChangePw(t.id)}
                          style={{ padding: "5px 10px", background: PKD, color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                          저장
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditPw(""); }}
                          style={{ padding: "5px 8px", background: "#fff", border: "1px solid #ddd", borderRadius: 5, fontSize: 11, cursor: "pointer", color: "#888", fontFamily: "inherit" }}>
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(t.id); setEditPw(""); }}
                          style={{ padding: "5px 10px", background: "#fff", border: `1px solid ${PK}`, borderRadius: 5, fontSize: 11, cursor: "pointer", color: PKD, fontFamily: "inherit" }}>
                          🔑 비밀번호 변경
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          style={{ padding: "5px 10px", background: "#fff", border: "1px solid #f5b7b1", borderRadius: 5, fontSize: 11, cursor: "pointer", color: "#c0392b", fontFamily: "inherit" }}>
                          🗑 삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: 18, padding: "10px 12px",
          background: "#f8f8f8", borderRadius: 8,
          fontSize: 10.5, color: "#666", lineHeight: 1.7
        }}>
          💡 <b>참고:</b> 선생님 계정은 클라우드에 공유 저장되어 모든 기기에서 사용 가능합니다.<br />
          선생님은 본인 PC/태블릿/핸드폰 어디서든 같은 링크로 로그인할 수 있습니다.
        </div>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...BP, fontSize: 12 }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);  // {role: "admin"|"teacher", name: string} | null
  const [authView, setAuthView] = useState("login");     // "setup" | "login" | "admin-panel"
  const [authMessage, setAuthMessage] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);  // ★ [v19.3] 선생님 첫 로그인 환영 모달

  useEffect(() => {
    (async () => {
      try {
        let adminPwHash = null;
        
        if (typeof localStorage !== "undefined") {
          adminPwHash = localStorage.getItem(AUTH_ADMIN_PW_KEY);
        }
        
        if (!adminPwHash && typeof window !== "undefined" && window.storage) {
          try {
            const res = await window.storage.get(AUTH_ADMIN_PW_KEY, true);
            adminPwHash = res?.value;
          } catch (e) {
            console.warn("[window.storage 읽기 실패 - localStorage만 사용]", e);
          }
        }
        
        if (!adminPwHash) {
          setAuthView("setup");  // 처음 — 관리자 비밀번호 설정 필요
        } else {
          // ★ [수정] 로그인 정보는 브라우저별 독립 — localStorage만 사용 (공유 저장소 미사용)
          let userRaw = null;
          if (typeof localStorage !== "undefined") {
            userRaw = localStorage.getItem(AUTH_CURRENT_USER_KEY);
          }
          
          if (userRaw) {
            try {
              const user = JSON.parse(userRaw);
              if (user && user.role && user.name) {
                setCurrentUser(user);
              }
            } catch (e) {}
          }
          setAuthView("login");
        }
      } catch (e) {
        console.error("[AUTH 로드 실패]", e);
        setAuthView("login");
      }
    })();
  }, []);

  const [children, setChildren] = useState(() => [blankChild()]);
  const [activeChildId, setActiveChildId] = useState(null);  // 초기엔 null, 로드 후 설정
  const activeChildIdRef = useRef(null);
  useEffect(() => { activeChildIdRef.current = activeChildId; }, [activeChildId]);
  const [loaded, setLoaded] = useState(false);

  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" ? window.innerWidth < 700 : false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setIsNarrow(window.innerWidth < 700);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [lastChangeAt, setLastChangeAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);  // 기본 ON
  const [autoBackupInterval, setAutoBackupInterval] = useState(60);  // 분 단위, 기본 60분
  
  const defaultTemplates = [
    { id: "t_eye_contact", name: "👀 눈맞춤", domain: "발달 언어", description: "아동과 눈맞춤 유지하기", category: "기본" },
    { id: "t_requesting", name: "🗣️ 요구 표현", domain: "발달 언어", description: "원하는 것 요청하기", category: "기본" },
    { id: "t_following", name: "👂 지시 따르기", domain: "발달 언어", description: "1-2단계 지시 따르기", category: "기본" },
    { id: "t_imitation", name: "🎭 모방", domain: "발달 언어", description: "신체 및 음성 모방", category: "기본" },
    { id: "t_attention", name: "🎯 집중력", domain: "발달 언어", description: "과제에 주의 집중하기", category: "기본" },
    { id: "t_behavior", name: "🚫 문제행동 감소", domain: "행동 관리", description: "문제행동 빈도 감소", category: "행동" },
    { id: "t_selfcare", name: "🧼 자기관리", domain: "생활 기술", description: "손씻기, 이닦기 등", category: "생활" },
    { id: "t_social", name: "👫 사회적 상호작용", domain: "사회성", description: "또래와 상호작용하기", category: "사회" },
  ];
  
  const [templateLibrary, setTemplateLibrary] = useState(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("aba_template_library");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return defaultTemplates;
  });
  const [templateTab, setTemplateTab] = useState("popular");
  const [templateModal, setTemplateModal] = useState(null); // { name, description, domain } | null
  const [autoBackupToast, setAutoBackupToast] = useState(null);      // { message, type } | null
  const [showBackupHistory, setShowBackupHistory] = useState(false); // ★ [v19] 백업 히스토리 모달
  const [showBackupMenu, setShowBackupMenu] = useState(false); // 백업/복원 접기 메뉴 (관리자 전용, 평소엔 접힘)
  const [backupHistoryList, setBackupHistoryList] = useState([]); // ★ [v19 window.storage] 백업 히스토리 로드용

  const [obsEditUnlocked, setObsEditUnlocked] = useState({
    eyeContact: false, requesting: false, following: false,
    attention: false, imitation: false, selfCare: false,
    summary: false
  });

  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => {
    setConfirmDialog({ message, onConfirm });
  };

  // ★ [신규] 관리자가 아동 추가 시 담당 선생님 선택 모달
  const [assignOwnerDialog, setAssignOwnerDialog] = useState(null);

  // ★ [신규] 등록된 선생님 목록 (App 컴포넌트에서도 필요 — 담당자 드롭다운/모달용)
  const [teachers, setTeachers] = useState([]);
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        let raw = null;
        if (typeof window !== "undefined" && window.storage) {
          try {
            const res = await window.storage.get(AUTH_TEACHERS_KEY, true);
            raw = res?.value;
          } catch (e) {}
        }
        if (!raw && typeof localStorage !== "undefined") {
          raw = localStorage.getItem(AUTH_TEACHERS_KEY);
        }
        setTeachers(raw ? JSON.parse(raw) : []);
      } catch (e) {
        setTeachers([]);
      }
    };
    loadTeachers();
    // 관리자 패널이 닫힌 후에도 최신 목록을 반영하도록, 관리자 패널 닫힘 감지 시 재로드
  }, [showAdminPanel]);

  const [pauseReasonDialog, setPauseReasonDialog] = useState(null);
  const askPauseReason = (taskName, onSubmit) => {
    setPauseReasonDialog({ taskName, onSubmit });
  };

  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [newChildName, setNewChildName] = useState("");

  const [editingChildNameId, setEditingChildNameId] = useState(null);
  const [editingChildName, setEditingChildName] = useState("");
  const [childDropdownOpen, setChildDropdownOpen] = useState(false);
  const [childSearch, setChildSearch] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("");  // 담당치료사
  const [filterStatus, setFilterStatus] = useState("all");  // all | active | terminated
  const [filterSort, setFilterSort] = useState("name");  // name | recent | dataInput
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [iepSearchQuery, setIepSearchQuery] = useState("");
  const childDropdownRef = useRef(null);
  useEffect(() => {
    if (!childDropdownOpen) return;
    const handler = (e) => {
      if (childDropdownRef.current && !childDropdownRef.current.contains(e.target)) {
        setChildDropdownOpen(false);
        setChildSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [childDropdownOpen]);

  // ★ [신규] 보관함 토글 — true면 아카이브된 아동도 함께 표시
  const [showArchived, setShowArchived] = useState(false);

  const visibleChildren = useMemo(() => {
    // 1) 권한 필터링
    let list;
    if (currentUser?.role === "admin") {
      list = children;  // 관리자는 모든 아동 보임
    } else if (currentUser?.role === "teacher") {
      list = children.filter(c => (c.info?.ownerName || "") === currentUser.name);
    } else {
      return [];  // 인증 안 된 경우
    }
    // 2) 아카이브 필터링 — 기본은 아카이브된 아동 숨김
    if (!showArchived) {
      list = list.filter(c => !c.info?.archivedAt);
    }
    return list;
  }, [children, currentUser, showArchived]);

  // ★ [신규] 아카이브 후보 — 종결 후 3개월(=약 92일) 이상 지나고 아직 아카이브 안 된 아동
  const archiveCandidates = useMemo(() => {
    const now = new Date();
    const threshold = 90; // 3개월 기준 (90일)
    return children.filter(c => {
      if (c.info?.archivedAt) return false;          // 이미 아카이브됨
      const endDate = c.info?.finalEndDate;
      if (!endDate) return false;                     // 종결되지 않음
      const end = new Date(endDate);
      if (isNaN(end.getTime())) return false;
      const daysSince = Math.floor((now - end) / (1000 * 60 * 60 * 24));
      return daysSince >= threshold;
    });
  }, [children]);

  // ★ [신규] 아카이브 후보 알림 모달
  const [showArchiveCandidates, setShowArchiveCandidates] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== "teacher") return;
    
    if (visibleChildren.length === 0) {
      setActiveChildId(null);
    } else if (!visibleChildren.find(c => c.id === activeChildId)) {
      setActiveChildId(visibleChildren[0].id);
    }
  }, [visibleChildren, currentUser?.role]);

  const activeChild = useMemo(
    () => {
      if (!activeChildId) return null;
      const found = visibleChildren.find(c => c.id === activeChildId);
      return found || null;  // 없으면 null (자동 변경 금지!)
    },
    [visibleChildren, activeChildId]
  );
  const info = activeChild?.info || {};  // blankChild().info 말고 빈 객체
  const goals = activeChild?.goals || [];
  const domainLevelOverrides = activeChild?.domainLevelOverrides || {};
  const history = activeChild?.history || [];  // ★ [v19 이력 기록]

  const reportFields = activeChild?.reportFields || ["", "", "", "", ""];
  const reportSelStrats = activeChild?.reportSelStrats || [];
  const reportSelStratsCustom = activeChild?.reportSelStratsCustom || "";
  const reportSelPrein = activeChild?.reportSelPrein || [];
  const reportSelSrein = activeChild?.reportSelSrein || [];
  const reportReinfSchedule = activeChild?.reportReinfSchedule || "";
  const reportBehaviors = activeChild?.reportBehaviors || [];
  const reportSections = activeChild?.reportSections || {};
  const dailyMemos = activeChild?.dailyMemos || {};

  const validateChildrenBeforeSave = (newChildren) => {
    if (currentUser?.role === "teacher") {
      const modifiedIds = newChildren
        .filter((newC, i) => {
          const oldC = children[i];
          return JSON.stringify(newC) !== JSON.stringify(oldC);
        })
        .map(c => c.id);

      for (const id of modifiedIds) {
        const child = newChildren.find(c => c.id === id);
        if (child && child.info.ownerName !== currentUser.name) {
          console.warn(`⚠️ [권한 오류] 선생님 '${currentUser.name}'이 다른 선생님 아동을 수정하려 함:`, child.info.name, child.info.ownerName);
          alert("❌ 다른 선생님의 아동은 수정할 수 없습니다. 변경사항이 저장되지 않았습니다.");
          return false;  // 저장 금지
        }
      }
    }
    return true;  // 검증 통과
  };

  const updateActiveChild = (patch) => {
    setChildren(prev => {
      const targetId = activeChildIdRef.current || prev[0]?.id;
      if (!targetId) return prev;
      const newChildren = prev.map(c =>
        c.id === targetId
          ? { ...c, ...(typeof patch === "function" ? patch(c) : patch), updatedAt: new Date().toISOString() }
          : c
      );
      if (!validateChildrenBeforeSave(newChildren)) {
        return prev;  // 검증 실패 → 변경 안 함
      }
      return newChildren;
    });
  };

  const addHistory = (action, description, before = null, after = null, targetName = null) => {
    if (!currentUser) return;  // 인증 안 된 경우 기록 안 함
    const record = {
      id: "h_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      childId: activeChildId,
      childName: info?.name || "(이름없음)",
      userName: currentUser.name,
      action,  // "info_update", "goal_add", "goal_update", "daily_input", "report_save" 등
      targetName,  // 어떤 목표/필드를 수정했는지 (선택)
      before,  // 이전 값 (선택)
      after,   // 이후 값 (선택)
      timestamp: new Date().toISOString(),
      description  // 사람이 읽을 텍스트
    };
    updateActiveChild(c => ({
      history: [...(c.history || []), record]
    }));
  };

  const setInfo = (updater) => {
    updateActiveChild(c => ({ info: typeof updater === "function" ? updater(c.info) : updater }));
  };
  const setGoals = (updater) => {
    updateActiveChild(c => ({ goals: typeof updater === "function" ? updater(c.goals) : updater }));
  };
  const setDomainLevelOverrides = (updater) => {
    updateActiveChild(c => ({ domainLevelOverrides: typeof updater === "function" ? updater(c.domainLevelOverrides || {}) : updater }));
  };

  const setReportField = (idx, value) => {
    updateActiveChild(c => {
      const fields = [...(c.reportFields || ["", "", "", "", ""])];
      fields[idx] = value;
      return { reportFields: fields };
    });
  };
  const setReportPatch = (patch) => {
    updateActiveChild(() => patch);
  };

  const setDailyMemo = (date, memo) => {
    if (!date) return;
    updateActiveChild(c => {
      const memos = { ...(c.dailyMemos || {}) };
      const trimmed = (memo || "").trim();
      if (trimmed) memos[date] = trimmed;
      else delete memos[date];
      return { dailyMemos: memos };
    });
  };

  const addChild = (name) => {
    const trimmedName = (name || "").trim() || "새 아동";

    // 중복 이름 체크는 그대로 (관리자가 추가하기 전에 먼저 검사)
    const sameNameChildren = children.filter(c => c.info?.name === trimmedName);

    // 실제 아동 추가 처리 함수 (담당자 결정 후 호출)
    const doAdd = (ownerName) => {
      const nc = blankChild();
      nc.info.name = trimmedName;
      nc.info.ownerName = ownerName || "";
      setChildren(prev => [...prev, nc]);
      setActiveChildId(nc.id);
    };

    // 중복 이름이면 먼저 확인 모달
    const proceedAfterDupCheck = () => {
      // ★ 선생님 계정 → 자동으로 본인 이름
      if (currentUser?.role === "teacher") {
        doAdd(currentUser.name);
        return;
      }
      // ★ 관리자 계정 → 담당 선생님 선택 모달
      setAssignOwnerDialog({
        childName: trimmedName,
        onSelect: (ownerName) => {
          setAssignOwnerDialog(null);
          doAdd(ownerName);
        }
      });
    };

    if (sameNameChildren.length > 0) {
      const teacherInfo = sameNameChildren.map(c => `• ${c.info?.ownerName || "(미할당)"} 선생님 담당`).join("\n");
      askConfirm(
        `⚠️ 이미 같은 이름의 아동이 있습니다!\n\n` +
        `현재 "${trimmedName}" 아동 (${sameNameChildren.length}명):\n${teacherInfo}\n\n` +
        `그래도 추가하시겠습니까?\n` +
        `(데이터는 별도로 관리되므로 충돌 없음)`,
        proceedAfterDupCheck
      );
      return null;
    }

    proceedAfterDupCheck();
    return null;
  };

  const deleteChild = (id) => {
    const target = children.find(c => c.id === id);
    if (!target) return;
    if (currentUser?.role === "teacher" && target.info.ownerName !== currentUser.name) {
      alert("❌ 다른 선생님의 아동은 삭제할 수 없습니다.");
      return;
    }
    if (children.length === 1) {
      alert("최소 한 명의 아동 데이터는 유지되어야 합니다.\n완전 초기화를 원하시면 '아동 데이터 초기화' 버튼을 사용하세요.");
      return;
    }
    askConfirm(`'${target.info.name || "이름없음"}' 아동의 모든 데이터를 삭제하시겠습니까?\n(IEP, 데일리 기록, 보고서 전체 삭제 — 되돌릴 수 없음)`, () => {
      const filtered = children.filter(c => c.id !== id);
      if (validateChildrenBeforeSave(filtered)) {
        setChildren(filtered);
        if (id === activeChildId && filtered.length > 0) {
          setActiveChildId(filtered[0].id);
        }
      }
    });
  };

  const renameChild = (id, newName) => {
    if (!newName.trim()) return;
    const newChildren = children.map(c =>
      c.id === id ? { ...c, info: { ...c.info, name: newName.trim() }, updatedAt: new Date().toISOString() } : c
    );
    if (validateChildrenBeforeSave(newChildren)) {
      setChildren(newChildren);
    }
  };

  // ★ [신규] 아동 보관함으로 이동 (아카이브)
  const archiveChild = (id) => {
    const target = children.find(c => c.id === id);
    if (!target) return;
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newChildren = children.map(c =>
      c.id === id
        ? { ...c, info: { ...c.info, archivedAt: stamp }, updatedAt: new Date().toISOString() }
        : c
    );
    if (validateChildrenBeforeSave(newChildren)) {
      setChildren(newChildren);
      // 현재 보고 있던 아동이 아카이브되면 다른 활성 아동으로 전환
      if (id === activeChildId) {
        const remainingActive = newChildren.filter(c =>
          !c.info?.archivedAt &&
          (currentUser?.role === "admin" || (c.info?.ownerName || "") === currentUser?.name)
        );
        if (remainingActive.length > 0) {
          setActiveChildId(remainingActive[0].id);
        }
      }
    }
  };

  // ★ [신규] 보관함에서 복구
  const unarchiveChild = (id) => {
    const newChildren = children.map(c =>
      c.id === id
        ? { ...c, info: { ...c.info, archivedAt: "" }, updatedAt: new Date().toISOString() }
        : c
    );
    if (validateChildrenBeforeSave(newChildren)) {
      setChildren(newChildren);
    }
  };

  const [tab, setTab] = useState("dashboard"); // ★ [v19 신규] dashboard | info | iep | daily | report
  const [reportMode, setReportMode] = useState("interim");

  const [curriculum, setCurriculum] = useState("ELCAR"); // "ELCAR" | "VB-MAPP" | "ESDM"
  const [selDomainIdx, setSelDomainIdx] = useState(0);
  const [activeGoalId, setActiveGoalId] = useState(null);

  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));

  const [showExtForm, setShowExtForm] = useState(false);
  const [extForm, setExtForm] = useState({ source: "기타", domain: "", subDomain: "", item: "" });

  const [view, setView] = useState("edit"); // edit | print

  useEffect(() => {
    (async () => {
      try {

        let childrenList = null;
        let lastActive = null;

        if (typeof window !== "undefined" && window.storage) {
          try {
            const res = await window.storage.get(FILE_KEY, true);  // true = shared
            if (res?.value) {
              try {
                const d = JSON.parse(res.value);
                if (Array.isArray(d.children) && d.children.length > 0) {
                  childrenList = d.children.map(migrateChild);
                  lastActive = d.activeChildId;
                } else if (d.info) {
                  childrenList = [migrateChild({
                    info: d.info,
                    goals: Array.isArray(d.goals) ? d.goals : [],
                    domainLevelOverrides: d.domainLevelOverrides || {}
                  })];
                }
              } catch (e) { /* ignore */ }
            }
          } catch (e) { /* ignore */ }
        }

        if (!childrenList && typeof localStorage !== "undefined") {
          const rawChildren = localStorage.getItem(STORAGE_KEY);
          const rawActive = localStorage.getItem(ACTIVE_KEY);
          if (rawChildren) {
            try {
              const parsed = JSON.parse(rawChildren);
              if (Array.isArray(parsed) && parsed.length > 0) {
                childrenList = parsed.map(migrateChild);
                lastActive = rawActive;
              }
            } catch (e) { /* ignore */ }
          }
        }

        if (!childrenList && typeof localStorage !== "undefined") {
          const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
          if (rawV1) {
            try {
              const d = JSON.parse(rawV1);
              const ncRaw = {
                ...(d.info ? { info: d.info } : {}),
                goals: Array.isArray(d.goals) ? d.goals : [],
                domainLevelOverrides: d.domainLevelOverrides || {}
              };
              childrenList = [migrateChild(ncRaw)];
              localStorage.removeItem(STORAGE_KEY_V1);
            } catch (e) { /* ignore */ }
          }
        }

        if (childrenList && childrenList.length > 0) {
          setChildren(childrenList);
          const validActive = lastActive && childrenList.find(c => c.id === lastActive);
          setActiveChildId(validActive ? lastActive : childrenList[0].id);
        } else {
          const firstId = children[0]?.id;
          if (firstId) setActiveChildId(firstId);
        }
      } catch (e) { /* 무시 */ }
      setLoaded(true);
    })();
  }, []);

  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!loaded) return;  // 로드 완료 전에는 저장하지 않음
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(children));
          if (activeChildId) localStorage.setItem(ACTIVE_KEY, activeChildId);
        }
      } catch (e) {}
      try {
        if (typeof window !== "undefined" && window.storage) {
          window.storage.set(FILE_KEY, JSON.stringify({ 
            children, 
            activeChildId, 
            savedAt: new Date().toISOString(),
            lastEditor: currentUser?.name || "(unknown)",
            lastEditTime: Date.now()
          }), true).catch(() => {});
        }
      } catch (e) {}
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [children, activeChildId, loaded]);

  useEffect(() => {
    if (!loaded) return;
    let needsFix = false;
    const fixed = children.map(c => ({
      ...c,
      goals: (c.goals || []).map(g => ({
        ...g,
        tasks: (g.tasks || []).map(t => {
          if (t.measureMode === "pct") { needsFix = true; return { ...t, measureMode: "raw" }; }
          return t;
        })
      }))
    }));
    if (needsFix) setChildren(fixed);
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.storage) {
          const resLastBackup = await window.storage.get(LAST_BACKUP_KEY, true);
          if (resLastBackup?.value) {
            const ms = parseInt(resLastBackup.value, 10);
            if (!isNaN(ms)) setLastBackupAt(ms);
          }
          
          const resEnabled = await window.storage.get(AUTO_BACKUP_ENABLED_KEY, true);
          if (resEnabled?.value === "0") setAutoBackupEnabled(false);
          
          const resInterval = await window.storage.get(AUTO_BACKUP_INTERVAL_KEY, true);
          if (resInterval?.value) {
            const m = parseInt(resInterval.value, 10);
            if ([30, 60, 120, 240].includes(m)) setAutoBackupInterval(m);
          }
        } else if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(LAST_BACKUP_KEY);
          if (raw) {
            const ms = parseInt(raw, 10);
            if (!isNaN(ms)) setLastBackupAt(ms);
          }
          const enabledRaw = localStorage.getItem(AUTO_BACKUP_ENABLED_KEY);
          if (enabledRaw === "0") setAutoBackupEnabled(false);
          const intervalRaw = localStorage.getItem(AUTO_BACKUP_INTERVAL_KEY);
          if (intervalRaw) {
            const m = parseInt(intervalRaw, 10);
            if ([30, 60, 120, 240].includes(m)) setAutoBackupInterval(m);
          }
        }
      } catch (e) {}
    })();
  }, [loaded]);

  useEffect(() => {
    if (!showBackupHistory) return;
    (async () => {
      try {
        let histRaw = null;
        if (typeof window !== "undefined" && window.storage) {
          const res = await window.storage.get(BACKUP_HISTORY_KEY, true);
          histRaw = res?.value;
        } else if (typeof localStorage !== "undefined") {
          histRaw = localStorage.getItem(BACKUP_HISTORY_KEY);
        }
        setBackupHistoryList(histRaw ? JSON.parse(histRaw) : []);
      } catch (e) {
        setBackupHistoryList([]);
      }
    })();
  }, [showBackupHistory]);

  useEffect(() => {
    if (!loaded) return;
    setLastChangeAt(Date.now());
  }, [children, loaded]);

  useEffect(() => {
    const timerId = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timerId);
  }, []);

  const lastChangeAtRef = useRef(null);
  const lastBackupAtRef = useRef(null);
  useEffect(() => { lastChangeAtRef.current = lastChangeAt; }, [lastChangeAt]);
  useEffect(() => { lastBackupAtRef.current = lastBackupAt; }, [lastBackupAt]);
  useEffect(() => {
    if (!loaded) return;
    if (!autoBackupEnabled) return;
    const intervalMs = autoBackupInterval * 60 * 1000;
    const timerId = setInterval(() => {
      const lastChange = lastChangeAtRef.current;
      const lastBackup = lastBackupAtRef.current;
      const needsBackup = lastChange !== null && (lastBackup === null || lastBackup < lastChange);
      if (!needsBackup) return; // 변경 없으면 스킵
      try {
        exportAllChildren(true); // true = silent mode (alert 안 띄움)
        setAutoBackupToast({ message: `✓ 자동 백업 완료 (${autoBackupInterval}분 주기)`, type: "success" });
        setTimeout(() => setAutoBackupToast(null), 3500);
      } catch (e) {
        setAutoBackupToast({ message: `⚠ 자동 백업 실패: ${e.message || "알 수 없는 오류"}`, type: "error" });
        setTimeout(() => setAutoBackupToast(null), 5000);
      }
    }, intervalMs);
    return () => clearInterval(timerId);
  }, [loaded, autoBackupEnabled, autoBackupInterval]);

  const lastKnownEditTimeRef = useRef(0);
  const lastKnownEditorRef = useRef("");
  const isInitializedRef = useRef(false);  // ★ 초기 로드 완료 플래그
  const [collaboratorAlert, setCollaboratorAlert] = useState(null);  // {editor, timestamp}
  
  useEffect(() => {
    if (!loaded) return;
    if (!currentUser) return;
    
    const checkInterval = setInterval(async () => {
      try {
        if (typeof window !== "undefined" && window.storage) {
          const res = await window.storage.get(FILE_KEY, true);
          if (!res?.value) return;
          
          let parsed;
          try {
            parsed = JSON.parse(res.value);
          } catch (e) { return; }
          
          if (!parsed.lastEditTime || !parsed.lastEditor) return;
          
          if (!isInitializedRef.current) {
            lastKnownEditTimeRef.current = parsed.lastEditTime;
            lastKnownEditorRef.current = parsed.lastEditor;
            isInitializedRef.current = true;
            return;
          }
          
          const isOtherUser = parsed.lastEditor !== currentUser.name;
          const isNewer = parsed.lastEditTime > lastKnownEditTimeRef.current;
          const isRecent = Date.now() - parsed.lastEditTime < 30000;  // 30초 이내
          
          if (isOtherUser && isNewer && isRecent) {
            setCollaboratorAlert({
              editor: parsed.lastEditor,
              timestamp: parsed.lastEditTime
            });
            
            setTimeout(() => setCollaboratorAlert(null), 5000);
            
            const myLastChange = lastChangeAtRef.current ? new Date(lastChangeAtRef.current).getTime() : 0;
            const otherLastChange = parsed.lastEditTime;
            
            if (otherLastChange > myLastChange && (Date.now() - myLastChange > 5000)) {
              if (Array.isArray(parsed.children)) {
                const migratedChildren = parsed.children.map(migrateChild);
                setChildren(migratedChildren);
              }
            }
          }
          
          lastKnownEditTimeRef.current = parsed.lastEditTime;
          lastKnownEditorRef.current = parsed.lastEditor;
        }
      } catch (e) {
      }
    }, 5000);  // 5초마다
    
    return () => clearInterval(checkInterval);
  }, [loaded, currentUser]);

  useEffect(() => {
    const needsBackup = lastChangeAt !== null && (lastBackupAt === null || lastBackupAt < lastChangeAt);
    if (!needsBackup) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "백업하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [lastBackupAt, lastChangeAt]);

  useEffect(() => {
    setActiveGoalId(null);
    setSelDomainIdx(0);
    setEditingChildNameId(null);
    setView("edit");  // B-1: 인쇄 미리보기 중에 다른 아동으로 전환되면 잠기는 문제 방지
  }, [activeChildId]);

  useEffect(() => {
    setSelDomainIdx(0);
  }, [curriculum]);

  const currentCatalog = useMemo(() => {
    if (curriculum === "VB-MAPP") return VBMAPP_DOMAINS;
    if (curriculum === "ESDM") return ESDM_DOMAINS;
    return ELCAR;
  }, [curriculum]);

  const currentDomain = currentCatalog[selDomainIdx] || currentCatalog[0];

  const toggleCatalogInclude = (sourceType, domain, subDomain, item) => {
    if (!item || !domain || !subDomain) return;
    const existing = goals.find(g => g.domain === domain && g.subDomain === subDomain && g.item === item);
    if (existing) {
      setGoals(prev => prev.map(g => g.id === existing.id ? { ...g, includeInIep: !g.includeInIep } : g));
      return;
    }
    let vbmapp = null, esdm = null, isRecommended = false;
    if (sourceType === "ELCAR") {
      const m = findMapping(domain + " " + subDomain + " " + item);
      vbmapp = m.vbmapp;
      esdm = m.esdm;
      isRecommended = !!(m.vbmapp || m.esdm);
    } else if (sourceType === "VB-MAPP") {
      const vMatch = domain.match(/^([A-Za-z/]+)/);
      const lvMatch = subDomain.match(/L(\d)/);
      vbmapp = {
        v: vMatch ? vMatch[1] : domain.split(" ")[0],
        lv: lvMatch ? parseInt(lvMatch[1]) : 2
      };
      isRecommended = true;
    } else if (sourceType === "ESDM") {
      esdm = { v: domain, lv: subDomain };
      isRecommended = true;
    }
    const newGoal = {
      id: "g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      source: sourceType,
      domain, subDomain, item,
      note: "",
      vbmapp, esdm,
      strategy: "", masteryCrit: "",  // 빈값으로 두면 자동 함수가 영역별로 다른 텍스트 반환
      generalization: "",
      daily: {},
      status: "active",
      statusLocked: false,
      currentLevelOverride: null,
      includeInIep: true,
      showInDaily: false,  // 신규 goal은 데이터 시트 노출 OFF로 시작
      isRecommended,
      listGroup: "1",
      listName: "",
      listItems: "",
      tasks: []
    };
    setGoals(prev => [...prev, newGoal]);
    setActiveGoalId(newGoal.id);
  };

  const toggleElcarInclude = (domain, subDomain, item) =>
    toggleCatalogInclude("ELCAR", domain, subDomain, item);

  const toggleIepInclude = (id) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      const nowIncluded = !g.includeInIep;
      if (!nowIncluded) {
        return {
          ...g,
          includeInIep: false,
          showInDaily: false,
          tasks: (g.tasks || []).map(t => ({ ...t, isActive: false }))
        };
      }
      return { ...g, includeInIep: true };
    }));
  };

  const toggleShowInDaily = (id) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      if (!g.includeInIep) return g;  // 안전장치: IEP 미포함 goal은 변경 금지
      return { ...g, showInDaily: !g.showInDaily };
    }));
  };

  const addItemDirect = toggleElcarInclude;

  const addExternalGoal = ({ source, domain, subDomain, item }) => {
    if (!item?.trim() || !domain?.trim()) return;
    const newGoal = {
      id: "g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      source: source || "기타",
      domain: domain.trim(),
      subDomain: (subDomain || "").trim() || "-",
      item: item.trim(),
      note: "",
      vbmapp: null, esdm: null,
      strategy: "", masteryCrit: "",  // 빈값으로 두면 자동 함수가 영역별로 다른 텍스트 반환
      generalization: "",
      daily: {},
      status: "active",
      statusLocked: false,
      currentLevelOverride: null,
      includeInIep: true,  // 외부 추가는 기본 포함
      showInDaily: false,  // 데이터 시트 노출은 사용자가 명시적으로 선택
      isRecommended: false,
      listGroup: "1",
      listName: "",
      listItems: "",
      tasks: []
    };
    setGoals(prev => [...prev, newGoal]);
    setActiveGoalId(newGoal.id);
  };

  const removeGoal = (id) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (activeGoalId === id) setActiveGoalId(null);
  };

  const updateGoal = (id, patch) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  };

  const toggleStatus = (id) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      const nextStatus = g.status === "mastered" ? "active" : "mastered";
      return { ...g, status: nextStatus, statusLocked: true };
    }));
  };

  const saveCurrentLevel = (id, text) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      return { ...g, currentLevelOverride: text };
    }));
  };

  const resetCurrentLevel = (id) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      return { ...g, currentLevelOverride: null };
    }));
  };

  const saveGoalPromptLevel = (id, value) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, promptLevel: value } : g));
  };
  const saveGoalPromptFadingPlan = (id, text) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, promptFadingPlan: text } : g));
  };
  const saveGoalGeneralizationPlan = (id, text) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, generalizationPlan: text } : g));
  };

  const addTask = (goalId, name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      const tasks = g.tasks || [];
      const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
      const inheritedMode = lastTask?.measureMode || "raw";
      const inheritedTrials = lastTask?.plannedTrials || 10;
      const newTask = {
        id: "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        name: trimmed,
        listGroup: "1",
        listGroupLocked: false,
        daily: {},
        masteredAt: null,
        isActive: true,
        measureMode: inheritedMode,        // 이전 task에서 이어받음
        plannedTrials: inheritedTrials     // 이전 task에서 이어받음
      };
      return { ...g, tasks: [...(g.tasks || []), newTask] };
    }));
  };

  const toggleTaskActive = (goalId, taskId) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      if (!g.includeInIep) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          return { ...t, isActive: t.isActive === false ? true : false };
        })
      };
    }));
  };

  const removeTask = (goalId, taskId) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return { ...g, tasks: (g.tasks || []).filter(t => t.id !== taskId) };
    }));
  };

  const renameTask = (goalId, taskId, name) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return { ...g, tasks: (g.tasks || []).map(t => t.id === taskId ? { ...t, name } : t) };
    }));
  };

  const setTaskMeasureMode = (goalId, taskId, mode) => {
    if (mode !== "pct" && mode !== "raw" && mode !== "click") return;
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => t.id === taskId ? { ...t, measureMode: mode } : t)
      };
    }));
  };

  const setTaskPlannedTrials = (goalId, taskId, trials) => {
    const n = Math.max(1, Math.min(99, Math.round(Number(trials))));
    if (isNaN(n)) return;
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => t.id === taskId ? { ...t, plannedTrials: n } : t)
      };
    }));
  };

  const bumpTask = (goalId, taskId, date, type, delta) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          const daily = { ...(t.daily || {}) };
          const day = daily[date] || { c: 0, ic: 0 };
          const nextVal = Math.max(0, (day[type] || 0) + delta);
          daily[date] = { ...day, [type]: nextVal };
          return { ...t, daily };
        })
      };
    }));
  };

  const setTaskTrial = (goalId, taskId, date, index, value) => {
    if (index < 0 || index > 9) return;
    if (value !== "+" && value !== "-" && value !== "NA" && value !== null) return;
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          const daily = { ...(t.daily || {}) };
          const day = daily[date] || {};
          let trials = Array.isArray(day.trials) ? [...day.trials] : [null, null, null, null, null, null, null, null, null, null];
          while (trials.length < 10) trials.push(null);
          if (trials.length > 10) trials = trials.slice(0, 10);
          if (value !== null) {
            for (let i = 0; i < index; i++) {
              if (trials[i] === null) return t;  // 앞 칸 비었으므로 무시
            }
          }
          if (value === null) {
            for (let i = index; i < 10; i++) trials[i] = null;
          } else {
            trials[index] = value;
          }
          daily[date] = { trials };
          return { ...t, daily };
        })
      };
    }));
  };

  const resetTask = (goalId, taskId, date) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          const daily = { ...(t.daily || {}) };
          delete daily[date];
          return { ...t, daily };
        })
      };
    }));
  };

  const fillTaskTrials = (goalId, taskId, date, value) => {
    if (value !== "+" && value !== "NA") return;
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          const plannedN = Math.max(1, Math.min(99, t.plannedTrials || 10));
          const daily = { ...(t.daily || {}) };
          const day = daily[date] || {};
          let trials = Array.isArray(day.trials) ? [...day.trials] : [];
          while (trials.length < plannedN) trials.push(null);
          if (trials.length > plannedN) trials = trials.slice(0, plannedN);
          for (let i = 0; i < plannedN; i++) {
            if (trials[i] === null || trials[i] === undefined) {
              trials[i] = value;
            }
          }
          daily[date] = { trials };
          return { ...t, daily };
        })
      };
    }));
  };

  const setTaskListGroup = (goalId, taskId, newGroup, pauseReason) => {
    if (newGroup !== "1" && newGroup !== "2" && newGroup !== "paused") return;
    if (newGroup === "paused" && (!pauseReason || !pauseReason.trim())) return;  // 사유 필수
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        tasks: (g.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          const next = {
            ...t,
            listGroup: newGroup,
            listGroupLocked: true,
            masteredAt: newGroup === "2" ? (t.masteredAt || new Date().toISOString().slice(0, 10)) : null
          };
          if (newGroup === "paused") {
            next.pauseReason = pauseReason.trim();
            next.pausedAt = new Date().toISOString().slice(0, 10);
            next.resumedAt = null;
          } else if (newGroup === "1" && t.listGroup === "paused") {
            next.resumedAt = new Date().toISOString().slice(0, 10);
            next.pauseReason = null;
            next.pausedAt = null;
          } else {
            next.pauseReason = null;
            next.pausedAt = null;
          }
          return next;
        })
      };
    }));
  };

  const calcDayRate = calcDayRateGlobal;

  const autoMasterDepsKey = useMemo(
    () => goals.map(g => (g.tasks || []).map(t => JSON.stringify(t.daily) + t.listGroupLocked).join("/")).join("|"),
    [goals]
  );
  useEffect(() => {
    if (!loaded) return;
    const calcDayRateForMastery = (day, plannedTrials) => {
      if (!day) return null;
      if (Array.isArray(day.trials)) {
        const N = Math.max(1, Math.min(99, plannedTrials || 10));
        const minFilled = Math.ceil(N * 0.8);  // 유효 하루 기준 (10→8, 5→4, 7→6)
        let pluses = 0, filledCount = 0;
        for (let i = 0; i < N; i++) {
          const v = day.trials[i];
          if (v === "+") { pluses++; filledCount++; }
          else if (v === "-" || v === "NA") { filledCount++; }
        }
        if (filledCount < minFilled) return null;
        return Math.round((pluses / N) * 100);
      }
      if (day.mode === "pct") return typeof day.pct === "number" ? day.pct : null;
      const total = (day.c || 0) + (day.ic || 0);
      if (total === 0) return null;
      return Math.round((day.c / total) * 100);
    };
    let changed = false;
    const next = goals.map(g => {
      if (!g.tasks || g.tasks.length === 0) return g;
      let taskChanged = false;
      const nextTasks = g.tasks.map(t => {
        if (t.listGroupLocked) return t;
        const daily = t.daily || {};
        const dates = Object.keys(daily).sort();
        const rates = dates.map(d => ({ date: d, rate: calcDayRateForMastery(daily[d], t.plannedTrials) })).filter(x => x.rate !== null);
        let consecutiveHigh = 0;
        let achieved = false;
        let achievedDate = null;
        for (const r of rates) {
          if (r.rate >= 80) {
            consecutiveHigh++;
            if (consecutiveHigh >= 2) { achieved = true; achievedDate = r.date; break; }
          } else {
            consecutiveHigh = 0;
          }
        }
        const desiredGroup = achieved ? "2" : "1";
        if ((t.listGroup || "1") !== desiredGroup) {
          taskChanged = true;
          return {
            ...t,
            listGroup: desiredGroup,
            masteredAt: desiredGroup === "2" ? (achievedDate || new Date().toISOString().slice(0, 10)) : null
          };
        }
        return t;
      });
      if (taskChanged) {
        changed = true;
        const justMastered = nextTasks.some((t, i) =>
          (t.listGroup === "2") && ((g.tasks[i].listGroup || "1") === "1")
        );
        const remainingL1 = nextTasks.filter(t => (t.listGroup || "1") === "1").length;
        if (justMastered && remainingL1 === 0) {
          return { ...g, tasks: nextTasks, pendingNext: true };
        }
        return { ...g, tasks: nextTasks };
      }
      return g;
    });
    if (changed) setGoals(next);
  }, [autoMasterDepsKey, loaded]);

  const clearPendingNext = (goalId) => {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, pendingNext: false } : g));
  };

  const getTimeline = (goal) => {
    return getCombinedDailySeries(goal).map(s => ({
      date: s.date, c: 0, ic: 0, rate: s.rate
    }));
  };

  const includedGoals = useMemo(() => sortGoals(goals.filter(g => g.includeInIep)), [goals]);
  const dailyGoals = useMemo(
    () => includedGoals.filter(g => g.showInDaily),
    [includedGoals]
  );
  const activeIncludedGoals = useMemo(() => includedGoals.filter(g => g.status !== "mastered"), [includedGoals]);
  const masteredIncludedGoals = useMemo(() => includedGoals.filter(g => g.status === "mastered"), [includedGoals]);

  const [archiveList, setArchiveList] = useState([]);  // 현재 아동의 보관 목록
  
  const visibleArchiveList = useMemo(() => {
    if (!archiveList || archiveList.length === 0) return [];
    if (currentUser?.role === "admin") {
      return archiveList;  // 관리자는 모든 보관 보고서
    }
    if (currentUser?.role === "teacher") {
      if ((info?.ownerName || "") === currentUser.name) {  // 안전: undefined → ""
        return archiveList;
      } else {
        return [];
      }
    }
    return [];
  }, [archiveList, currentUser, info.ownerName]);

  const [cutoffDisabled, setCutoffDisabled] = useState(false);
  const effectiveArchiveList = (cutoffDisabled || reportMode === "final")
    ? []
    : archiveList.filter(item => !item.isFinal);
  const effectiveInfo = (() => {
    if (!cutoffDisabled || !archiveList || archiveList.length === 0) return info;
    const cutoffArchives = archiveList.filter(item => !item.isFinal);
    if (cutoffArchives.length === 0) return info;
    const archive0 = cutoffArchives[0];
    const prevStart = archive0.prevEvalStart || "";
    const prevEnd = archive0.prevEvalEnd || "";
    if (!prevStart && !prevEnd) return info;
    return {
      ...info,
      ...(prevStart ? { pStart: prevStart } : {}),
      ...(prevEnd ? { pEnd: prevEnd } : {})
    };
  })();
  const [viewingArchive, setViewingArchive] = useState(null);  // 미리보기 중인 스냅샷

  // ★ [성능 최적화] 보고서 탭/인쇄 화면일 때만 무거운 계산 실행 (lazy)
  // 데일리 입력 시 매번 차트 데이터를 재계산하지 않도록 가드
  const needsReportCalc = tab === "report" || view === "print" || view === "iep-print";

  const stosForReport = useMemo(() => {
    if (!needsReportCalc) return [];
    let cutoffDate = null;
    if (effectiveArchiveList && effectiveArchiveList.length > 0) {
      const latestArchive = effectiveArchiveList[0];
      if (latestArchive.savedAt) {
        cutoffDate = latestArchive.savedAt.slice(0, 10);
      }
    }
    const result = [];
    includedGoals.forEach(g => {
      (g.tasks || []).forEach(t => {
        if (cutoffDate && t.listGroup === "2" && t.masteredAt && t.masteredAt <= cutoffDate) {
          return;
        }
        if (cutoffDate && t.listGroup === "paused" && t.pausedAt && t.pausedAt <= cutoffDate) {
          return;
        }
        const points = Object.entries(t.daily || {}).map(([date, day]) => {
          const v = calcDayRateGlobal(day, t.plannedTrials);
          if (v === null) return null;
          if (cutoffDate && date <= cutoffDate) return null;
          return { date, value: v };
        }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
        const latestPoint = points.length > 0 ? points[points.length - 1] : null;
        const lg = t.listGroup || "1";
        const status = lg === "2" ? "완료" : lg === "paused" ? "중단" : "진행중";
        if ((status === "완료" || status === "중단") && points.length === 0) {
          return;
        }
        result.push({
          id: t.id,
          name: t.name,
          domain: g.domain,
          subDomain: g.subDomain,
          goalName: g.item,  // 상위 영역목표명
          source: g.source || "ELCAR",  // ★ 커리큘럼
          status,
          rate: latestPoint ? latestPoint.value : 0,
          masteryDate: t.masteredAt || null,
          pauseReason: t.pauseReason || null,   // F-3: 중단 사유 포함
          pausedAt: t.pausedAt || null,
          points,
          phases: [],  // v9 사용 호환
          vbmapp: g.vbmapp,
          esdm: g.esdm
        });
      });
    });
    return result;
  }, [includedGoals, effectiveArchiveList, needsReportCalc]);

  const firstDataDate = useMemo(() => {
    if (!needsReportCalc) return null;
    if (!stosForReport || stosForReport.length === 0) return null;
    const allDates = [];
    stosForReport.forEach(s => {
      (s.points || []).forEach(p => {
        if (p.date) allDates.push(p.date);
      });
    });
    if (allDates.length === 0) return null;
    return allDates.sort()[0];
  }, [stosForReport, needsReportCalc]);
  const effectivePStart = info.pStart || firstDataDate || info.evalStart || "";

  const goalsForReport = useMemo(() => {
    if (!needsReportCalc) return [];
    let cutoffDate = null;
    if (effectiveArchiveList && effectiveArchiveList.length > 0) {
      const latestArchive = effectiveArchiveList[0];
      if (latestArchive.savedAt) {
        cutoffDate = latestArchive.savedAt.slice(0, 10);
      }
    }
    return includedGoals
      .filter(g => {
        if (cutoffDate && g.status === "mastered") {
          const taskMastered = (g.tasks || []).map(t => t.masteredAt).filter(Boolean).sort();
          const realMasteredAt = taskMastered.length > 0 ? taskMastered[taskMastered.length - 1] : g.masteredAt;
          if (realMasteredAt && realMasteredAt <= cutoffDate) return false;
        }
        return true;
      })
      .map(g => {
      const allPoints = [];
      const listBoundaries = [];  // 각 task의 첫 point가 시작하는 인덱스 + 라벨
      const tasks = g.tasks || [];
      tasks.forEach((t, taskIdx) => {
        const taskPoints = Object.entries(t.daily || {}).map(([date, day]) => {
          const v = calcDayRateGlobal(day, t.plannedTrials);
          if (v === null) return null;
          if (cutoffDate && date <= cutoffDate) return null;
          return { date, value: v };
        }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
        if (taskPoints.length > 0) {
          const startNum = g.startListNum || 1;
          listBoundaries.push({
            atIndex: allPoints.length,
            listLabel: `L${taskIdx + startNum}`,
            taskName: t.name,
            taskListGroup: t.listGroup || "1"
          });
          taskPoints.forEach(p => {
            allPoints.push({
              ...p,
              taskIdx,
              taskName: t.name,
              taskListNum: taskIdx + startNum
            });
          });
        }
      });
      const status = g.status === "mastered" ? "완료" : "진행중";
      const masteryDate = g.masteredAt || null;
      const latestPoint = allPoints.length > 0 ? allPoints[allPoints.length - 1] : null;
      return {
        id: g.id,
        name: g.item,                    // 영역목표 이름
        domain: g.domain,
        subDomain: g.subDomain,
        status,
        rate: latestPoint ? latestPoint.value : 0,
        masteryDate,
        points: allPoints,
        listBoundaries,                  // ★ 핵심: list 경계 정보
        vbmapp: g.vbmapp,
        esdm: g.esdm,
        source: g.source
      };
    })
    .filter(g => {
      if (g.status === "완료" && g.points.length === 0) return false;
      return true;
    });
  }, [includedGoals, effectiveArchiveList, needsReportCalc]);

  const currentAvgs = useMemo(() => {
    if (!needsReportCalc) return [];
    let cutoffDate = null;
    if (effectiveArchiveList && effectiveArchiveList.length > 0) {
      const latestArchive = effectiveArchiveList[0];
      if (latestArchive.savedAt) {
        cutoffDate = latestArchive.savedAt.slice(0, 10);
      }
    }
    const grouped = {};
    includedGoals.forEach(g => {
      const taskLatests = [];
      (g.tasks || []).forEach(t => {
        const daily = t.daily || {};
        const dates = Object.keys(daily)
          .filter(d => !cutoffDate || d >= cutoffDate)
          .sort();
        for (let i = dates.length - 1; i >= 0; i--) {
          const r = calcDayRate(daily[dates[i]], t.plannedTrials);
          if (r !== null) { taskLatests.push(r); break; }
        }
      });
      let goalValue = null;
      if (taskLatests.length > 0) {
        goalValue = Math.round(taskLatests.reduce((a, b) => a + b, 0) / taskLatests.length);
      } else {
        const oldDaily = g.daily || {};
        const oldDates = Object.keys(oldDaily)
          .filter(d => !cutoffDate || d >= cutoffDate)
          .sort();
        for (let i = oldDates.length - 1; i >= 0; i--) {
          const r = calcDayRate(oldDaily[oldDates[i]]);
          if (r !== null) { goalValue = r; break; }
        }
      }
      if (goalValue === null) return;
      if (!grouped[g.domain]) grouped[g.domain] = { sum: 0, n: 0 };
      grouped[g.domain].sum += goalValue;
      grouped[g.domain].n += 1;
    });
    return Object.entries(grouped).map(([domain, v]) => ({
      domain, avg: v.n > 0 ? Math.round(v.sum / v.n) : 0, count: v.n,
      short: shortDomain(domain)
    }));
  }, [includedGoals, effectiveArchiveList, needsReportCalc]);

  const baselineAvgs = currentAvgs;
  const domainAvgs = currentAvgs;

  useEffect(() => {
    if (!activeChildId) { setArchiveList([]); return; }
    let cancelled = false;
    (async () => {
      const list = await loadArchiveList(activeChildId);
      if (!cancelled) setArchiveList(list);
    })();
    return () => { cancelled = true; };
  }, [activeChildId]);

  const archiveCurrentIep = async (autoMode = false) => {
    if (!activeChildId) return null;
    if (!info?.name?.trim()) return null;
    if (!includedGoals || includedGoals.length === 0) {
      return { skipped: true, reason: "empty" };
    }
    const periodStart = info.evalStart || "";
    const periodEnd = info.evalEnd || "";
    const period = fmtArchivePeriod(periodStart, periodEnd);
    const iepCount = (archiveList || []).filter(a => a.isIep).length;
    const order = iepCount + 1;
    const title = `📋 IEP 계획안 (${period}) - ${order}차`;
    const goalsSummary = (includedGoals || []).map(g => ({
      domain: g.domain,
      item: g.item,
      source: g.source,
      tasks: (g.tasks || []).map(t => ({
        name: t.name,
        listGroup: t.listGroup,
        plannedTrials: t.plannedTrials || 10,
      })),
    }));
    const snapshot = {
      childId: activeChildId,
      childName: info.name,
      title,
      period,
      info: { ...info },
      isIep: true,           // ★ IEP 표시
      isFinal: false,
      prevEvalStart: info.evalStart || "",
      prevEvalEnd: info.evalEnd || "",
      reportSections: {},    // IEP는 reportSections 사용 안 함
      reportSelStrats: [...(reportSelStrats || [])],
      reportSelStratsCustom: reportSelStratsCustom || "",
      reportSelPrein: [...(reportSelPrein || [])],
      reportSelSrein: [...(reportSelSrein || [])],
      reportReinfSchedule: reportReinfSchedule || "",
      reportBehaviors: JSON.parse(JSON.stringify(reportBehaviors || [])),
      reportFields: Array.isArray(reportFields) ? [...reportFields] : ["", "", "", "", ""],
      domainAvgs: [...(domainAvgs || [])],
      goalsSummary,
    };
    const result = await saveArchiveItem(snapshot, autoMode);
    const newList = await loadArchiveList(activeChildId);
    setArchiveList(newList);
    return result;
  };

  const archiveCurrentReport = async (autoMode = false, finalMode = false) => {
    if (!activeChildId) return null;
    if (!info?.name?.trim()) return null;
    const sections = reportSections || {};
    const hasContent = Object.values(sections).some(v => v && String(v).trim() !== "");
    if (!hasContent && !autoMode && !finalMode) {
      return { skipped: true, reason: "empty" };
    }
    const periodStart = info.evalStart || info.pStart || "";
    const periodEnd = finalMode ? (info.finalEndDate || info.evalEnd || info.pEnd || "") : (info.evalEnd || info.pEnd || "");
    const period = fmtArchivePeriod(periodStart, periodEnd);
    const interimCount = (archiveList || []).filter(a => !a.isFinal).length;
    const order = interimCount + 1;
    const title = finalMode ? `🎓 종결보고서 (${period})` : `${period} - ${order}차`;
    const goalsSummary = (includedGoals || []).map(g => ({
      domain: g.domain,
      item: g.item,
      source: g.source,
      tasks: (g.tasks || []).map(t => ({
        name: t.name,
        listGroup: t.listGroup,
        plannedTrials: t.plannedTrials || 10,
      })),
    }));
    const snapshot = {
      childId: activeChildId,
      childName: info.name,
      title,
      period,
      info: { ...info },
      isFinal: finalMode,
      prevEvalStart: info.pStart || info.evalStart || "",
      prevEvalEnd: info.pEnd || info.evalEnd || "",
      reportSections: { ...sections },
      reportSelStrats: [...(reportSelStrats || [])],
      reportSelStratsCustom: reportSelStratsCustom || "",
      reportSelPrein: [...(reportSelPrein || [])],
      reportSelSrein: [...(reportSelSrein || [])],
      reportReinfSchedule: reportReinfSchedule || "",
      reportBehaviors: JSON.parse(JSON.stringify(reportBehaviors || [])),
      reportFields: Array.isArray(reportFields) ? [...reportFields] : ["", "", "", "", ""],
      domainAvgs: [...(domainAvgs || [])],
      goalsSummary,
    };
    const result = await saveArchiveItem(snapshot, autoMode);
    const newList = await loadArchiveList(activeChildId);
    setArchiveList(newList);
    if (result && result.id && !result.overwrite && result.savedAt && !finalMode) {
      const cutoffDate = result.savedAt.slice(0, 10);
      const cutoffNext = (() => {
        const d = new Date(cutoffDate);
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
      })();
      setInfo(prev => {
        if (prev.pStart === cutoffNext) return prev;
        return {
          ...prev,
          pStart: cutoffNext
        };
      });
    }
    return result;
  };

  const handleDeleteArchive = async (archiveId) => {
    if (!activeChildId) return;
    const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
    const archiveItemFull = cutoffArchives[0]?.id === archiveId
      ? await loadArchiveItem(archiveId).catch(() => null)
      : null;
    await deleteArchiveItem(activeChildId, archiveId);
    const newList = await loadArchiveList(activeChildId);
    setArchiveList(newList);
    if (archiveItemFull && archiveItemFull.prevEvalStart) {
      setInfo(prev => ({
        ...prev,
        pStart: archiveItemFull.prevEvalStart,
        ...(archiveItemFull.prevEvalEnd ? { pEnd: archiveItemFull.prevEvalEnd } : {})
      }));
    }
  };

  const exportToDataEntry = () => {
    const stos = goals.map(g => {
      const timeline = {};
      getCombinedDailySeries(g).forEach(({ date, rate }) => {
        timeline[date] = String(rate);
      });
      return {
        key: `${g.source || "ELCAR"}|${g.domain}|${g.subDomain}|${g.item}`,
        domain: g.domain,
        name: g.item,
        phases: [{
          lc: "", status: "진행중",
          timeline, masteryDate: ""
        }],
        inputMode: "pct",
        iepMeta: {
          source: g.source || "ELCAR",
          subDomain: g.subDomain,
          note: g.note,
          vbmapp: g.vbmapp, esdm: g.esdm,
          strategy: g.strategy, generalization: g.generalization,
          dailyRaw: g.daily,  // 원본 +/- 데이터도 보존 (옛 구조)
          tasksRaw: g.tasks   // 신규 task 구조 원본도 보존
        }
      };
    });
    const payload = {
      info: {
        name: info.name, birth: info.birth, room: info.room,
        therapist: info.therapist, pStart: info.evalStart, pEnd: info.evalEnd,
        curriculum: ["elcar", "vbmapp", "esdm"]
      },
      stos
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IEP_데이터_${info.name || "아동"}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("IEP 데이터가 JSON 파일로 내보내졌습니다.\n이 파일을 중간보고서 시스템(v9)의 '데이터 복구'로 불러올 수 있습니다.");
  };

  const exportAllChildren = async (silent = false) => {
    try {
      const childCount = children.length;
      const goalCount = children.reduce((sum, c) => sum + (c.goals?.length || 0), 0);
      const archiveCount = children.reduce((sum, c) => sum + (Array.isArray(c.archiveList) ? c.archiveList.length : 0), 0);
      const payload = {
        type: "gd-aba-iep-backup",
        version: 1,
        savedAt: new Date().toISOString(),
        meta: {
          childCount,
          goalCount,
          archiveCount,
          childNames: children.map(c => c.info?.name || "(이름없음)").filter(Boolean)
        },
        activeChildId,
        children
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      const timestamp = silent ? `_auto_${new Date().toTimeString().slice(0, 5).replace(":", "")}` : "";
      const meta = `_${childCount}명_${goalCount}목표`;
      a.href = url;
      a.download = `검단ABA_전체백업_${today}${meta}${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const nowMs = Date.now();
      setLastBackupAt(nowMs);
      try {
        if (typeof window !== "undefined" && window.storage) {
          await window.storage.set(LAST_BACKUP_KEY, String(nowMs), true);
        } else if (typeof localStorage !== "undefined") {
          localStorage.setItem(LAST_BACKUP_KEY, String(nowMs));
        }
      } catch (e) {}
      try {
        let histRaw = null;
        if (typeof window !== "undefined" && window.storage) {
          const res = await window.storage.get(BACKUP_HISTORY_KEY, true);
          histRaw = res?.value;
        } else if (typeof localStorage !== "undefined") {
          histRaw = localStorage.getItem(BACKUP_HISTORY_KEY);
        }
        
        const hist = histRaw ? JSON.parse(histRaw) : [];
        const entry = {
          at: nowMs,
          mode: silent ? "auto" : "manual",
          childCount,
          goalCount,
          archiveCount,
          fileName: a.download
        };
        const newHist = [entry, ...hist].slice(0, 10);  // 최근 10개만
        
        if (typeof window !== "undefined" && window.storage) {
          await window.storage.set(BACKUP_HISTORY_KEY, JSON.stringify(newHist), true);
        } else if (typeof localStorage !== "undefined") {
          localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(newHist));
        }
      } catch (e) {}
      if (!silent) {
        alert(`✓ 전체 백업 완료\n아동 ${childCount}명 · 목표 ${goalCount}개 · 보관 ${archiveCount}건\n\n다운로드된 JSON 파일을 안전한 곳에 보관하세요.\n복원이 필요하면 [📂 복원] 버튼을 사용하세요.`);
      }
    } catch (e) {
      if (!silent) alert("백업 실패: " + (e?.message || "알 수 없는 오류"));
      else throw e; // 자동 백업의 catch에서 처리
    }
  };

  const backupFileInputRef = useRef(null);

  const handleBackupFileSelected = (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const data = JSON.parse(text);

        if (!data || typeof data !== "object") {
          alert("복원 실패: 유효하지 않은 파일입니다.");
          return;
        }
        if (data.type !== "gd-aba-iep-backup") {
          alert("복원 실패: 이 파일은 검단ABA 전체 백업 파일이 아닙니다.\n(유형: " + (data.type || "알 수 없음") + ")");
          return;
        }
        if (!Array.isArray(data.children) || data.children.length === 0) {
          alert("복원 실패: 파일에 아동 데이터가 없습니다.");
          return;
        }

        const importedChildCount = data.children.length;
        const importedGoalCount = data.children.reduce((sum, c) => sum + ((c.goals && c.goals.length) || 0), 0);
        const importedArchiveCount = data.children.reduce((sum, c) => sum + ((c.archiveList && c.archiveList.length) || 0), 0);
        const savedAtLabel = data.savedAt ? new Date(data.savedAt).toLocaleString("ko-KR") : "알 수 없음";
        const importedNames = data.children.map(c => c.info?.name || "(이름없음)").filter(Boolean);

        const currentChildCount = children.length;
        const currentGoalCount = children.reduce((sum, c) => sum + ((c.goals && c.goals.length) || 0), 0);
        const currentArchiveCount = children.reduce((sum, c) => sum + ((c.archiveList && c.archiveList.length) || 0), 0);
        const currentNames = children.map(c => c.info?.name || "(이름없음)").filter(Boolean);

        const childDiff = importedChildCount - currentChildCount;
        const goalDiff = importedGoalCount - currentGoalCount;
        const archiveDiff = importedArchiveCount - currentArchiveCount;
        const fmtDiff = (n) => n > 0 ? ` (+${n})` : n < 0 ? ` (${n})` : "";

        const addedNames = importedNames.filter(n => !currentNames.includes(n));
        const removedNames = currentNames.filter(n => !importedNames.includes(n));
        let nameDiffMsg = "";
        if (addedNames.length > 0) {
          nameDiffMsg += `\n  + 추가될 아동: ${addedNames.join(", ")}`;
        }
        if (removedNames.length > 0) {
          nameDiffMsg += `\n  - 사라질 아동: ${removedNames.join(", ")}`;
        }

        const confirmMsg =
          `⚠️ 백업 파일로 복원합니다 (현재 데이터 덮어쓰기)\n\n` +
          `📊 데이터 비교\n` +
          `  아동 수: ${currentChildCount}명 → ${importedChildCount}명${fmtDiff(childDiff)}\n` +
          `  목표 수: ${currentGoalCount}개 → ${importedGoalCount}개${fmtDiff(goalDiff)}\n` +
          `  보관 보고서: ${currentArchiveCount}건 → ${importedArchiveCount}건${fmtDiff(archiveDiff)}\n` +
          `  백업 시점: ${savedAtLabel}` +
          nameDiffMsg +
          `\n\n` +
          (removedNames.length > 0
            ? `🚨 ${removedNames.length}명의 아동 데이터가 영구히 사라집니다.\n   사라지는 아동의 데이터가 다른 백업 파일에 있는지 확인하세요.\n\n`
            : ``) +
          `현재 데이터는 모두 사라지고 백업 데이터로 교체됩니다.\n정말 진행할까요?`;

        askConfirm(confirmMsg, () => {
          const migratedChildren = data.children.map(migrateChild);
          setChildren(migratedChildren);
          const restoredActive = data.activeChildId && migratedChildren.find(c => c.id === data.activeChildId)
            ? data.activeChildId
            : migratedChildren[0].id;
          setActiveChildId(restoredActive);
          const nowMs = Date.now();
          setLastBackupAt(nowMs);
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(LAST_BACKUP_KEY, String(nowMs));
            }
          } catch (e) {}

          alert(`✓ 복원 완료\n아동 ${importedChildCount}명 · 목표 ${importedGoalCount}개가 복구되었습니다.`);
        });
      } catch (err) {
        alert("복원 실패: JSON 파일을 읽을 수 없습니다.\n" + (err?.message || ""));
      }
    };
    reader.onerror = () => {
      alert("복원 실패: 파일 읽기 오류");
    };
    reader.readAsText(file);
  };

  const triggerBackupRestore = () => {
    if (backupFileInputRef.current) backupFileInputRef.current.click();
  };

  if (view === "iep-print") {
    return <PrintView info={info} goals={includedGoals} domainAvgs={domainAvgs} domainLevelOverrides={domainLevelOverrides} reportSections={reportSections}
      reportSelStrats={reportSelStrats} reportSelStratsCustom={reportSelStratsCustom}
      reportSelPrein={reportSelPrein} reportSelSrein={reportSelSrein} reportReinfSchedule={reportReinfSchedule}
      reportBehaviors={reportBehaviors} stosForReport={stosForReport} goalsForReport={goalsForReport}
      archiveList={effectiveArchiveList} dailyMemos={dailyMemos}
      mode="iep" onBack={() => setView("edit")} />;
  }
  if (view === "print") {
    return <PrintView info={effectiveInfo} goals={includedGoals} domainAvgs={domainAvgs} domainLevelOverrides={domainLevelOverrides} reportSections={reportSections}
      reportSelStrats={reportSelStrats} reportSelStratsCustom={reportSelStratsCustom}
      reportSelPrein={reportSelPrein} reportSelSrein={reportSelSrein} reportReinfSchedule={reportReinfSchedule}
      reportBehaviors={reportBehaviors} stosForReport={stosForReport} goalsForReport={goalsForReport}
      archiveList={effectiveArchiveList} dailyMemos={dailyMemos}
      mode={reportMode === "final" ? "final" : "report"} onBack={() => setView("edit")} />;
  }

  if (!loaded) {
    return (
      <div style={{ fontFamily: "'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif", background: "linear-gradient(135deg,#fdf8f9 0%,#fff 50%,#fdf8f9 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: PKD }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 54, height: 54, margin: "0 auto 12px", borderRadius: 14, background: PKL, border: `2px solid ${PK}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: PKD }}>ABA</div>
          <div style={{ fontSize: 13, color: "#767676" }}>데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        view={authView}
        message={authMessage}
        onSetupAdmin={async (pw) => {
          if (!pw || pw.length < 4) {
            setAuthMessage("⚠️ 비밀번호는 최소 4자 이상이어야 합니다.");
            return;
          }
          try {
            const pwHash = simpleHash(pw);
            
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(AUTH_ADMIN_PW_KEY, pwHash);
            }
            
            if (typeof window !== "undefined" && window.storage) {
              try {
                await window.storage.set(AUTH_ADMIN_PW_KEY, pwHash, true);
              } catch (storageErr) {
                console.warn("[window.storage 저장 실패 - localStorage만 사용]", storageErr);
              }
            }
            
            const adminUser = { role: "admin", name: SUPERVISOR_NAME };
            
            // ★ [수정] 로그인 정보는 브라우저별 독립 — localStorage만 사용
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(AUTH_CURRENT_USER_KEY, JSON.stringify(adminUser));
            }
            
            setCurrentUser(adminUser);
            setAuthMessage("");
          } catch (e) {
            setAuthMessage("비밀번호 저장 실패: " + (e?.message || ""));
          }
        }}
        onLogin={async (name, pw) => {
          if (!name || !pw) {
            setAuthMessage("⚠️ 이름과 비밀번호를 모두 입력하세요.");
            return;
          }
          const pwHash = simpleHash(pw);
          
          try {
            if (name === SUPERVISOR_NAME || name === "관리자" || name === "센터장") {
              let adminPwHash = null;
              if (typeof localStorage !== "undefined") {
                adminPwHash = localStorage.getItem(AUTH_ADMIN_PW_KEY);
              }
              
              if (!adminPwHash && typeof window !== "undefined" && window.storage) {
                try {
                  const res = await window.storage.get(AUTH_ADMIN_PW_KEY, true);
                  adminPwHash = res?.value;
                } catch (e) {}
              }
              
              if (adminPwHash === pwHash) {
                const adminUser = { role: "admin", name: SUPERVISOR_NAME };
                
                // ★ [수정] 로그인 정보는 브라우저별 독립 — localStorage만 사용
                if (typeof localStorage !== "undefined") {
                  localStorage.setItem(AUTH_CURRENT_USER_KEY, JSON.stringify(adminUser));
                }
                
                setCurrentUser(adminUser);
                setAuthMessage("");
                return;
              } else {
                setAuthMessage("⚠️ 관리자 비밀번호가 틀렸습니다.");
                return;
              }
            }
            
            let teachersRaw = null;
            if (typeof window !== "undefined" && window.storage) {
              try {
                const res = await window.storage.get(AUTH_TEACHERS_KEY, true);
                teachersRaw = res?.value;
              } catch (e) {}
            }
            
            if (!teachersRaw && typeof localStorage !== "undefined") {
              teachersRaw = localStorage.getItem(AUTH_TEACHERS_KEY);
            }
            
            const teachers = teachersRaw ? JSON.parse(teachersRaw) : [];
            const teacher = teachers.find(t => t.name === name);
            if (!teacher) {
              setAuthMessage(`⚠️ '${name}' 선생님이 등록되어 있지 않습니다. 관리자에게 문의하세요.`);
              return;
            }
            if (teacher.pwHash !== pwHash) {
              setAuthMessage("⚠️ 비밀번호가 틀렸습니다.");
              return;
            }
            const teacherUser = { role: "teacher", name: teacher.name };
            
            // ★ [수정] 로그인 정보는 브라우저별 독립 — localStorage만 사용
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(AUTH_CURRENT_USER_KEY, JSON.stringify(teacherUser));
            }
            
            if (!teacher.welcomed) {
              setShowWelcome(true);
            }
            
            setCurrentUser(teacherUser);
            setAuthMessage("");
          } catch (e) {
            setAuthMessage("로그인 처리 실패: " + (e?.message || ""));
          }
        }}
      />
    );
  }

  return (
    <div style={{ fontFamily: "'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif", background: "linear-gradient(135deg,#fdf8f9 0%,#fff 50%,#fdf8f9 100%)", minHeight: "100vh", padding: "24px 16px", color: "#333" }}>
      {/* ★ [반응형] 좁은 화면 자동 1열 변환 + 폰트 크기 보정 */}
      <style>{`
        /* TaskRow: 중간 너비(태블릿·좁힌 창)에서 7열 grid가 찌그러져 겹치는 문제 방지 — 세로 전환 */
        @media (max-width: 960px) {
          .responsive-task-grid {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
            padding: 10px !important;
            background: rgba(255, 245, 246, 0.5) !important;
            border: 1px solid #f0e0e5 !important;
            border-radius: 8px !important;
          }
        }
        @media (max-width: 700px) {
          /* 2열·3열 grid → 1열 자동 전환 */
          .responsive-grid-2 { grid-template-columns: 1fr !important; }
          .responsive-grid-3 { grid-template-columns: 1fr !important; }
          /* 데일리 헤더 (auto 1fr auto) → 1열 */
          .responsive-daily-header { grid-template-columns: 1fr !important; gap: 10px !important; }
          /* 모바일에서 안내 텍스트 숨김 (공간 절약) */
          .hide-on-mobile { display: none !important; }
          /* 모바일에서 패딩 줄임 */
          .responsive-padding { padding-left: 8px !important; padding-right: 8px !important; }
          /* 폰트 자동 줌 방지 (input/textarea) — 16px */
          input, textarea, select { font-size: 16px !important; }
          /* trial 셀 터치 영역 확장 */
          [data-task-cell] { width: 40px !important; height: 40px !important; font-size: 17px !important; }
          /* TaskRow 7열 grid → 세로 (모바일) */
          .responsive-task-grid {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
            padding: 10px !important;
            background: rgba(255, 245, 246, 0.6) !important;
            border: 1px solid #f0e0e5 !important;
            border-radius: 8px !important;
          }
          /* 메인 탭 — 라벨 단축형으로 전환 */
          .responsive-tab-nav .tab-label-full { display: none !important; }
          .responsive-tab-nav .tab-label-short { display: inline !important; }
          /* 보고서·IEP의 grid는 이미 responsive-grid-2 처리됨 */
        }
        @media (max-width: 480px) {
          /* 매우 좁은 화면 (작은 폰) */
          [data-task-cell] { width: 36px !important; height: 36px !important; font-size: 15px !important; }
          /* 메인 컨테이너 패딩 줄임 */
          body > div, #root > div { padding-left: 12px !important; padding-right: 12px !important; }
        }
      `}</style>
      {autoBackupToast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          padding: "12px 18px",
          background: autoBackupToast.type === "success" ? "#fff" : "#fff5f5",
          border: `2px solid ${autoBackupToast.type === "success" ? "#4caf50" : "#e74c3c"}`,
          borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          fontSize: 12.5,
          fontWeight: 600,
          color: autoBackupToast.type === "success" ? "#2e7d32" : "#c0392b",
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 360,
          animation: "slideIn 0.3s ease-out"
        }}>
          <span>{autoBackupToast.message}</span>
        </div>
      )}

      {/* ★ [v19 신규] 동시 편집 알림 — 다른 사용자가 편집 중 */}
      {collaboratorAlert && (
        <div style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 9999,
          padding: "14px 20px",
          background: "#fff8e1",
          border: "2px solid #f59e0b",
          borderRadius: 10,
          boxShadow: "0 4px 16px rgba(245,158,11,0.25)",
          fontSize: 12.5,
          color: "#92400e",
          maxWidth: 380,
          animation: "slideIn 0.3s ease-out"
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>👀</span>
            <span>다른 사용자가 데이터를 수정했습니다</span>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            <b>{collaboratorAlert.editor}</b>님이 방금 데이터를 변경했습니다.<br/>
            변경 사항이 자동으로 반영되었습니다.
          </div>
          <button
            onClick={() => setCollaboratorAlert(null)}
            style={{
              marginTop: 8,
              padding: "4px 10px",
              background: "#f59e0b",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 10.5,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            확인
          </button>
        </div>
      )}

      {/* ★ [v19] 백업 히스토리 모달 — 최근 10회 백업 기록 */}
      {showBackupHistory && (() => {
        const history = backupHistoryList;
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20
          }}
            onClick={() => setShowBackupHistory(false)}>
            <div style={{
              background: "#fff", borderRadius: 14, padding: 24,
              maxWidth: 560, width: "100%", maxHeight: "80vh", overflow: "auto",
              boxShadow: "0 8px 28px rgba(0,0,0,0.2)"
            }}
              onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: PKD }}>📜 백업 기록</div>
                <button
                  onClick={() => setShowBackupHistory(false)}
                  style={{ background: "none", border: "none", fontSize: 20, color: "#888", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 14, lineHeight: 1.6 }}>
                최근 10회 백업 기록입니다. 이 목록은 <b>이 브라우저에서만</b> 확인할 수 있으며, 실제 백업 파일은 PC의 다운로드 폴더에 있습니다.
              </div>
              {history.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#888" }}>
                  아직 백업 기록이 없습니다.
                  <br />[💾 전체 백업] 버튼을 눌러 첫 백업을 만들어 보세요.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.map((h, i) => {
                    const dt = new Date(h.at);
                    const dateStr = dt.toLocaleString("ko-KR", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit"
                    });
                    const elapsedMin = Math.floor((Date.now() - h.at) / 60000);
                    const elapsedStr = elapsedMin < 60 ? `${elapsedMin}분 전`
                      : elapsedMin < 1440 ? `${Math.floor(elapsedMin / 60)}시간 전`
                      : `${Math.floor(elapsedMin / 1440)}일 전`;
                    return (
                      <div key={i} style={{
                        padding: "10px 14px",
                        background: i === 0 ? PKL : "#fafafa",
                        border: `1px solid ${i === 0 ? PK : "#eee"}`,
                        borderRadius: 8,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap"
                      }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? PKD : "#333", marginBottom: 3 }}>
                            {h.mode === "auto" ? "🔄 자동" : "✋ 수동"} · {dateStr}
                            {i === 0 && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", background: PKD, color: "#fff", borderRadius: 6 }}>최신</span>}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#666" }}>
                            아동 {h.childCount}명 · 목표 {h.goalCount}개 · 보관 {h.archiveCount || 0}건
                          </div>
                          {h.fileName && (
                            <div style={{ fontSize: 9.5, color: "#999", marginTop: 2, fontFamily: "monospace", wordBreak: "break-all" }}>
                              {h.fileName}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap" }}>{elapsedStr}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 18, padding: "10px 12px", background: "#f8f8f8", borderRadius: 8, fontSize: 10.5, color: "#666", lineHeight: 1.7 }}>
                💡 <b>주의:</b> 이 기록은 백업이 일어났다는 정보만 저장합니다. 실제 데이터 복원은 PC에 다운로드된 JSON 파일이 있어야 가능합니다.
              </div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      askConfirm("백업 기록을 모두 지우시겠습니까?\n(실제 백업 파일은 PC에 그대로 남습니다)", async () => {
                        try {
                          if (typeof window !== "undefined" && window.storage) {
                            await window.storage.delete(BACKUP_HISTORY_KEY, true);
                          } else if (typeof localStorage !== "undefined") {
                            localStorage.removeItem(BACKUP_HISTORY_KEY);
                          }
                        } catch (e) {}
                        setShowBackupHistory(false);
                      });
                    }}
                    style={{ ...BS, fontSize: 11, color: "#888", borderColor: "#ddd" }}>
                    🗑 기록 지우기
                  </button>
                )}
                <button onClick={() => setShowBackupHistory(false)} style={{ ...BP, fontSize: 12 }}>닫기</button>
              </div>
            </div>
          </div>
        );
      })()}
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottom: `2px solid ${PK}`, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: PKL, border: `2px solid ${PK}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: PKD, letterSpacing: "-1px" }}>ABA</div>
            <div>
              <div style={{ fontSize: 21, fontWeight: 700, color: "#333", letterSpacing: "-0.5px" }}>검단ABA 통합 매니지먼트 시스템</div>
              <div style={{ fontSize: 12, color: "#767676", marginTop: 2 }}>
                {/* ★ [v19] 로그인 사용자 표시 */}
                {currentUser?.role === "admin" ? (
                  <>👑 <b>{currentUser.name}</b> (관리자) — 모든 데이터 관리</>
                ) : (
                  <>👤 <b>{currentUser?.name}</b> 선생님 로그인 중</>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* ★ [v19] 관리자만 — 선생님 계정 관리 */}
            {currentUser?.role === "admin" && (
              <button
                style={{ ...BS, borderColor: PKD, color: PKD, fontWeight: 600 }}
                onClick={() => setShowAdminPanel(true)}
                title="선생님 계정 추가/삭제/비밀번호 변경">
                👥 선생님 관리
              </button>
            )}
            {/* ★ [신규] 관리자만 — 아카이브 후보 알림 (종결 후 3개월 지난 아동) */}
            {currentUser?.role === "admin" && archiveCandidates.length > 0 && (
              <button
                style={{ ...BS, borderColor: "#f59e0b", color: "#92400e", background: "#fff8e1", fontWeight: 600, position: "relative" }}
                onClick={() => setShowArchiveCandidates(true)}
                title={`종결 후 3개월 이상 지난 아동 ${archiveCandidates.length}명 — 보관함으로 이동할 수 있어요`}>
                🗄️ 보관 후보 {archiveCandidates.length}명
              </button>
            )}
            {currentUser?.role === "admin" && (
              <div style={{ position: "relative" }}>
                <button
                  style={{ ...BS, borderColor: "#bbb", color: "#777", fontSize: 11 }}
                  onClick={() => setShowBackupMenu(v => !v)}
                  title="데이터 백업 / 복원 (관리자 전용)">
                  ⚙️ 백업 관리 {showBackupMenu ? "▴" : "▾"}
                </button>
                {showBackupMenu && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
                    background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.12)", padding: 10,
                    display: "flex", flexDirection: "column", gap: 6, minWidth: 180
                  }}>
                    <div style={{ fontSize: 10, color: "#999", padding: "2px 4px 4px", borderBottom: "1px solid #f0f0f0", marginBottom: 2 }}>
                      데이터 백업 / 복원
                    </div>
                    <button style={{ ...BS, fontSize: 11, textAlign: "left" }} onClick={() => { exportToDataEntry(); setShowBackupMenu(false); }} title="중간보고서 시스템(v9) 연동용 JSON 내보내기">📤 JSON 백업 (v9 연동)</button>
                    <button style={{ ...BS, borderColor: GREEN, color: GREEN, fontSize: 11, textAlign: "left" }} onClick={() => { exportAllChildren(); setShowBackupMenu(false); }} title="전체 데이터를 PC에 JSON 파일로 저장">💾 전체 백업</button>
                    <button style={{ ...BS, borderColor: BLUE, color: BLUE, fontSize: 11, textAlign: "left" }} onClick={() => { triggerBackupRestore(); setShowBackupMenu(false); }} title="PC에 저장해둔 백업 JSON 파일을 불러와 데이터를 복구">📂 복원</button>
                  </div>
                )}
              </div>
            )}
            {false && (
            <button
              style={{ ...BS, borderColor: "#888", color: "#666" }}
              onClick={() => setShowBackupHistory(true)}
              title="최근 10회 백업 기록을 확인합니다">
              📜 기록
            </button>
            )}
            {/* ★ [v19] 로그아웃 — 샌드박스 confirm 차단 대응으로 자체 모달 사용 */}
            <button
              style={{ ...BS, borderColor: "#aaa", color: "#888" }}
              onClick={() => {
                setConfirmDialog({
                  message: "로그아웃 하시겠습니까?",
                  onConfirm: async () => {
                    // ★ [수정] 로그인 정보는 localStorage에만 저장하므로 거기서만 삭제
                    // (혹시 이전 버전에서 window.storage에 남아있을 수 있으니 함께 정리)
                    try {
                      if (typeof localStorage !== "undefined") {
                        localStorage.removeItem(AUTH_CURRENT_USER_KEY);
                      }
                    } catch (e) {}
                    try {
                      if (typeof window !== "undefined" && window.storage) {
                        await window.storage.delete(AUTH_CURRENT_USER_KEY, true);
                      }
                    } catch (e) {}
                    setCurrentUser(null);
                    setAuthView("login");
                  }
                });
              }}
              title="로그아웃">
              🔒 로그아웃
            </button>
            <input
              ref={backupFileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={handleBackupFileSelected}
            />
          </div>
        </div>

        {/* ★ [v19] 관리자 패널 모달 */}
        {showAdminPanel && currentUser?.role === "admin" && (
          <AdminPanel onClose={() => setShowAdminPanel(false)} />
        )}

        {/* ★ [v19.3] 환영 모달 — 선생님 첫 로그인 1회 */}
        {showWelcome && currentUser?.role === "teacher" && (
          <WelcomeModal
            teacherName={currentUser.name}
            onClose={async () => {
              try {
                let raw = null;
                if (typeof window !== "undefined" && window.storage) {
                  try {
                    const res = await window.storage.get(AUTH_TEACHERS_KEY, true);
                    raw = res?.value;
                  } catch (e) {}
                }
                if (!raw && typeof localStorage !== "undefined") {
                  raw = localStorage.getItem(AUTH_TEACHERS_KEY);
                }
                const list = raw ? JSON.parse(raw) : [];
                const updated = list.map(t =>
                  t.name === currentUser.name ? { ...t, welcomed: true } : t
                );
                const json = JSON.stringify(updated);
                if (typeof window !== "undefined" && window.storage) {
                  try { await window.storage.set(AUTH_TEACHERS_KEY, json, true); } catch (e) {}
                }
                if (typeof localStorage !== "undefined") {
                  localStorage.setItem(AUTH_TEACHERS_KEY, json);
                }
              } catch (e) {
                console.warn("환영 플래그 저장 실패:", e);
              }
              setShowWelcome(false);
            }}
          />
        )}

        {/* ═══ 백업 알림 배너 ═══ */}
        {(() => {
          return null; /* [숨김] 클라우드 자동저장 도입으로 백업 배너·자동백업·지금백업 버튼 숨김 (코드는 보존) */
          const needsBackup = lastChangeAt !== null && (lastBackupAt === null || lastBackupAt < lastChangeAt);
          if (!needsBackup) return null;
          const elapsedMs = now - lastChangeAt;
          const elapsedMin = Math.floor(elapsedMs / 60000);
          let bg, border, color, icon, msg;
          if (elapsedMin < 10) {
            bg = "#fdf8f9"; border = "#f0e0e5"; color = "#888"; icon = "💾";
            msg = `백업 권장 — 마지막 변경 ${elapsedMin < 1 ? "방금" : elapsedMin + "분 전"}`;
          } else if (elapsedMin < 30) {
            bg = "#fff8ec"; border = "#f5d182"; color = "#a87108"; icon = "⚠️";
            msg = `백업하지 않은 변경이 있습니다 (${elapsedMin}분 경과) — 지금 백업하세요`;
          } else {
            bg = "#fcebeb"; border = "#e88b8b"; color = "#b83838"; icon = "🚨";
            msg = `백업 안 된 지 ${elapsedMin}분 — 데이터 유실 위험! 즉시 백업하세요`;
          }
          return (
            <div style={{
              marginBottom: 14, padding: "10px 14px",
              background: bg, border: `1.5px solid ${border}`, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap"
            }}>
              <div style={{ fontSize: 12, color, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span>{msg}</span>
              </div>
              {/* ★ [자동 백업] 토글 + 주기 선택 */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "#fff", border: `1px solid ${color}`, borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, color, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoBackupEnabled}
                    onChange={e => {
                      const checked = e.target.checked;
                      setAutoBackupEnabled(checked);
                      (async () => {
                        try {
                          const val = checked ? "1" : "0";
                          if (typeof window !== "undefined" && window.storage) {
                            await window.storage.set(AUTO_BACKUP_ENABLED_KEY, val, true);
                          } else if (typeof localStorage !== "undefined") {
                            localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, val);
                          }
                        } catch (e) {}
                      })();
                    }}
                    style={{ cursor: "pointer", margin: 0 }}
                  />
                  <span>🔄 자동백업</span>
                </label>
                <select
                  value={autoBackupInterval}
                  onChange={e => {
                    const m = parseInt(e.target.value, 10);
                    setAutoBackupInterval(m);
                    (async () => {
                      try {
                        if (typeof window !== "undefined" && window.storage) {
                          await window.storage.set(AUTO_BACKUP_INTERVAL_KEY, String(m), true);
                        } else if (typeof localStorage !== "undefined") {
                          localStorage.setItem(AUTO_BACKUP_INTERVAL_KEY, String(m));
                        }
                      } catch (e) {}
                    })();
                  }}
                  disabled={!autoBackupEnabled}
                  style={{
                    fontSize: 10.5, padding: "2px 4px", borderRadius: 4,
                    border: `1px solid ${color}`,
                    background: autoBackupEnabled ? "#fff" : "#f5f5f5",
                    color: autoBackupEnabled ? color : "#999",
                    cursor: autoBackupEnabled ? "pointer" : "not-allowed",
                    fontFamily: "inherit"
                  }}
                  title="자동 백업 주기"
                >
                  <option value={30}>30분</option>
                  <option value={60}>1시간</option>
                  <option value={120}>2시간</option>
                  <option value={240}>4시간</option>
                </select>
              </div>
              <button
                onClick={exportAllChildren}
                style={{
                  fontSize: 11, padding: "6px 14px", fontWeight: 700,
                  border: `1.5px solid ${color}`, borderRadius: 8,
                  background: "#fff", color,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
                }}>
                💾 지금 백업
              </button>
            </div>
          );
        })()}

        {/* ═══ 아동 프로필 드롭다운 (최상단) ═══ */}
        <div style={{ marginBottom: 14, padding: "10px 12px", background: "#fff", border: `1.5px solid ${PK}`, borderRadius: 12, boxShadow: "0 2px 6px rgba(212,114,138,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: PKD, marginRight: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 14 }}>👥</span>
              <span>아동 프로필</span>
            </div>
            {/* ★ 드롭다운 트리거 + 패널 */}
            <div ref={childDropdownRef} style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 360 }}>
              <button
                onClick={() => setChildDropdownOpen(o => !o)}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  background: PK,
                  color: "#fff",
                  border: `1.5px solid ${PK}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  boxShadow: childDropdownOpen ? "0 0 0 3px rgba(212,114,138,0.2)" : "none",
                  transition: "box-shadow 0.15s"
                }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{activeChild?.info?.name || "이름없음"}</span>
                  {(activeChild?.goals?.length || 0) > 0 && (
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "rgba(255,255,255,0.28)", fontWeight: 700 }}>
                      {activeChild.goals.length}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{childDropdownOpen ? "▲" : "▼"}</span>
              </button>
              {childDropdownOpen && (() => {
                const q = childSearch.trim().toLowerCase();
                let filtered = q
                  ? visibleChildren.filter(c => (c.info?.name || "").toLowerCase().includes(q))
                  : visibleChildren;
                
                if (filterTherapist) {
                  filtered = filtered.filter(c => c.info?.therapist === filterTherapist);
                }
                
                if (filterStatus === "active") {
                  filtered = filtered.filter(c => !c.info?.finalEndDate);
                } else if (filterStatus === "terminated") {
                  filtered = filtered.filter(c => c.info?.finalEndDate);
                }
                
                if (filterSort === "name") {
                  filtered = [...filtered].sort((a, b) => (a.info?.name || "").localeCompare(b.info?.name || ""));
                } else if (filterSort === "recent") {
                  filtered = [...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
                } else if (filterSort === "dataInput") {
                  filtered = [...filtered].sort((a, b) => {
                    const getLastDate = (child) => {
                      const goals = child.goals || [];
                      let latest = "";
                      goals.forEach(g => {
                        (g.tasks || []).forEach(t => {
                          const dates = Object.keys(t.daily || {});
                          if (dates.length > 0) {
                            const max = dates[dates.length - 1];
                            if (max > latest) latest = max;
                          }
                        });
                      });
                      return latest;
                    };
                    return getLastDate(b).localeCompare(getLastDate(a));
                  });
                }
                
                filtered = [...filtered].sort((a, b) => {
                  if (a.info?.isPinned && !b.info?.isPinned) return -1;
                  if (!a.info?.isPinned && b.info?.isPinned) return 1;
                  return 0;
                });
                
                return (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    background: "#fff",
                    border: `1.5px solid ${PK}`,
                    borderRadius: 10,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                    zIndex: 100,
                    maxHeight: 360,
                    display: "flex",
                    flexDirection: "column"
                  }}>
                    {/* 검색창 + 고급 필터 토글 */}
                    {visibleChildren.length >= 4 && (
                      <div style={{ padding: 8, borderBottom: "1px solid #f0e0e5" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: showAdvancedFilters ? 8 : 0 }}>
                          <input
                            type="text"
                            autoFocus
                            value={childSearch}
                            onChange={e => setChildSearch(e.target.value)}
                            placeholder="🔍 아동 이름 검색"
                            style={{
                              flex: 1,
                              padding: "6px 10px",
                              border: "1px solid #e8d0d6",
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontFamily: "inherit",
                              outline: "none",
                              boxSizing: "border-box"
                            }}
                          />
                          <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            style={{
                              padding: "6px 10px",
                              fontSize: 11,
                              border: `1px solid ${PKL}`,
                              borderRadius: 6,
                              background: showAdvancedFilters ? PKD : "#fff",
                              color: showAdvancedFilters ? "#fff" : "#666",
                              cursor: "pointer",
                              fontWeight: 600,
                              whiteSpace: "nowrap"
                            }}
                            title="고급 필터"
                          >
                            ⚙️ 필터
                          </button>
                        </div>
                        
                        {/* ★ [v19 신규] 고급 필터 패널 */}
                        {showAdvancedFilters && (
                          <div style={{ padding: 10, background: "#fafafa", borderRadius: 6, border: "1px solid #f0e0e5", display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* 담당치료사 필터 */}
                            <div>
                              <label style={{ fontSize: 9.5, color: "#666", marginBottom: 3, display: "block", fontWeight: 600 }}>👨‍🏫 담당치료사</label>
                              <select
                                value={filterTherapist}
                                onChange={e => setFilterTherapist(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "5px 8px",
                                  fontSize: 11,
                                  border: "1px solid #e8d0d6",
                                  borderRadius: 4,
                                  background: "#fff",
                                  cursor: "pointer"
                                }}
                              >
                                <option value="">— 모든 치료사 —</option>
                                {[...new Set(visibleChildren.map(c => c.info?.therapist).filter(Boolean))].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* 상태 필터 */}
                            <div>
                              <label style={{ fontSize: 9.5, color: "#666", marginBottom: 3, display: "block", fontWeight: 600 }}>📋 상태</label>
                              <div style={{ display: "flex", gap: 4 }}>
                                {[
                                  { v: "all", label: "전체" },
                                  { v: "active", label: "활동 중" },
                                  { v: "terminated", label: "종료" }
                                ].map(s => (
                                  <button
                                    key={s.v}
                                    onClick={() => setFilterStatus(s.v)}
                                    style={{
                                      flex: 1,
                                      padding: "4px 6px",
                                      fontSize: 10,
                                      border: `1px solid ${filterStatus === s.v ? PKD : "#e8d0d6"}`,
                                      borderRadius: 4,
                                      background: filterStatus === s.v ? PKD : "#fff",
                                      color: filterStatus === s.v ? "#fff" : "#666",
                                      cursor: "pointer",
                                      fontWeight: 600
                                    }}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* 정렬 */}
                            <div>
                              <label style={{ fontSize: 9.5, color: "#666", marginBottom: 3, display: "block", fontWeight: 600 }}>🔢 정렬</label>
                              <select
                                value={filterSort}
                                onChange={e => setFilterSort(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "5px 8px",
                                  fontSize: 11,
                                  border: "1px solid #e8d0d6",
                                  borderRadius: 4,
                                  background: "#fff",
                                  cursor: "pointer"
                                }}
                              >
                                <option value="name">이름순</option>
                                <option value="recent">최근 추가순</option>
                                <option value="dataInput">최근 데이터 입력순</option>
                              </select>
                            </div>
                            
                            {/* ★ [신규] 보관 아동 보기 토글 */}
                            <div>
                              <label style={{ fontSize: 9.5, color: "#666", marginBottom: 3, display: "block", fontWeight: 600 }}>🗄️ 보관함</label>
                              <button
                                onClick={() => setShowArchived(v => !v)}
                                style={{
                                  width: "100%",
                                  padding: "5px 8px",
                                  fontSize: 10,
                                  border: `1px solid ${showArchived ? "#92400e" : "#e8d0d6"}`,
                                  borderRadius: 4,
                                  background: showArchived ? "#fff8e1" : "#fff",
                                  color: showArchived ? "#92400e" : "#666",
                                  cursor: "pointer",
                                  fontWeight: 600
                                }}>
                                {showArchived ? "✓ 보관 아동 표시 중" : "보관 아동 보기"}
                              </button>
                            </div>
                            
                            {/* 필터 초기화 */}
                            <button
                              onClick={() => {
                                setFilterTherapist("");
                                setFilterStatus("all");
                                setFilterSort("name");
                              }}
                              style={{
                                padding: "5px 8px",
                                fontSize: 10,
                                border: "1px solid #e8d0d6",
                                borderRadius: 4,
                                background: "#fff",
                                color: "#666",
                                cursor: "pointer",
                                fontWeight: 600
                              }}
                            >
                              ↺ 필터 초기화
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {/* 아동 목록 */}
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {filtered.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "#999" }}>
                          검색 결과 없음
                        </div>
                      ) : filtered.map(c => {
                        const isActive = c.id === activeChildId;
                        const isEditing = editingChildNameId === c.id;
                        const isArchived = !!c.info?.archivedAt;  // ★ [신규] 아카이브 여부
                        const baseName = c.info?.name || "이름없음";
                        
                        const sameNameChildren = filtered.filter(o => o.info?.name === baseName && o.id !== c.id);
                        const hasDuplicate = sameNameChildren.length > 0;
                        
                        let displayName = baseName;
                        let subInfo = "";
                        if (hasDuplicate) {
                          if (c.info?.therapist) {
                            subInfo = `${c.info.therapist} 선생님`;
                          }
                          else if (c.info?.birth) {
                            subInfo = c.info.birth;
                          }
                          else if (c.info?.classType) {
                            subInfo = c.info.classType;
                          }
                          else {
                            subInfo = `#${c.id.slice(-4)}`;
                          }
                        }
                        
                        const goalCount = c.goals?.length || 0;
                        return (
                          <div key={c.id}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "8px 12px",
                              background: isActive ? "#fff5f6" : "#fff",
                              borderBottom: "1px solid #fafafa",
                              cursor: isEditing ? "default" : "pointer",
                              transition: "background 0.1s"
                            }}
                            onClick={() => {
                              if (isEditing) return;
                              setActiveChildId(c.id);
                              setChildDropdownOpen(false);
                              setChildSearch("");
                            }}
                            onMouseEnter={e => { if (!isActive && !isEditing) e.currentTarget.style.background = "#fafafa"; }}
                            onMouseLeave={e => { if (!isActive && !isEditing) e.currentTarget.style.background = "#fff"; }}>
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editingChildName}
                                onChange={e => setEditingChildName(e.target.value)}
                                onBlur={() => {
                                  if (editingChildName.trim()) renameChild(c.id, editingChildName);
                                  setEditingChildNameId(null);
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    if (editingChildName.trim()) renameChild(c.id, editingChildName);
                                    setEditingChildNameId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingChildNameId(null);
                                  }
                                }}
                                onClick={e => e.stopPropagation()}
                                style={{ flex: 1, border: "1px solid #d0a0b0", outline: "none", background: "#fff", color: "#333", fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: "4px 8px", borderRadius: 4 }}
                              />
                            ) : (
                              <>
                                {/* ★ [v19 신규] 핀 버튼 (즐겨찾기) */}
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setChildren(prev => prev.map(child => 
                                      child.id === c.id 
                                        ? { ...child, info: { ...child.info, isPinned: !child.info?.isPinned } }
                                        : child
                                    ));
                                  }}
                                  title={c.info?.isPinned ? "핀 해제" : "즐겨찾기에 추가"}
                                  style={{ 
                                    background: "none", 
                                    border: "none", 
                                    cursor: "pointer", 
                                    fontSize: 14, 
                                    padding: "2px 4px",
                                    color: c.info?.isPinned ? "#f59e0b" : "#ccc",
                                    transition: "color 0.2s"
                                  }}>
                                  {c.info?.isPinned ? "⭐" : "☆"}
                                </button>
                                {isActive && <span style={{ fontSize: 11, color: PKD, fontWeight: 700 }}>✓</span>}
                                <div style={{ flex: 1, marginLeft: isActive ? 0 : 4, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isArchived ? "#92400e" : (isActive ? PKD : "#444"), display: "flex", alignItems: "center", gap: 4 }}>
                                    {isArchived && <span style={{ fontSize: 10 }}>🗄️</span>}
                                    {displayName}
                                  </span>
                                  {subInfo && (
                                    <span style={{ fontSize: 9, color: "#888", fontWeight: 400 }}>
                                      ({subInfo})
                                    </span>
                                  )}
                                  {isArchived && (
                                    <span style={{ fontSize: 8.5, color: "#92400e", fontWeight: 500 }}>
                                      보관일: {c.info.archivedAt}
                                    </span>
                                  )}
                                </div>
                                {goalCount > 0 && (
                                  <span style={{
                                    fontSize: 9.5, padding: "1px 7px", borderRadius: 8, fontWeight: 600,
                                    background: PKL, color: PKD
                                  }}>{goalCount}개</span>
                                )}
                                {/* ★ [신규] 보관/복구 버튼 (관리자만) */}
                                {currentUser?.role === "admin" && (
                                  isArchived ? (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        askConfirm(`'${displayName}' 아동을 보관함에서 복구하시겠습니까?\n복구 후 메인 목록에서 다시 보입니다.`, () => unarchiveChild(c.id));
                                      }}
                                      title="보관함에서 복구"
                                      style={{ background: "#e8f5e9", border: "1px solid #4caf50", color: "#2e7d32", cursor: "pointer", fontSize: 10, padding: "3px 8px", fontFamily: "inherit", fontWeight: 600, borderRadius: 4 }}>
                                      ↺ 복구
                                    </button>
                                  ) : (
                                    c.info?.finalEndDate && (
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          askConfirm(`'${displayName}' 아동을 보관함으로 이동하시겠습니까?\n메인 목록에서 숨겨지며, 데이터는 보존됩니다.\n('보관 아동 보기' 토글로 다시 볼 수 있어요)`, () => archiveChild(c.id));
                                        }}
                                        title="보관함으로 이동"
                                        style={{ background: "none", border: "1px solid #f59e0b", color: "#92400e", cursor: "pointer", fontSize: 10, padding: "3px 8px", fontFamily: "inherit", fontWeight: 600, borderRadius: 4 }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "#fff8e1"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                        🗄️ 보관
                                      </button>
                                    )
                                  )
                                )}
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingChildNameId(c.id);
                                    setEditingChildName(displayName);
                                  }}
                                  title="이름 수정"
                                  style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 12, padding: "2px 6px", fontFamily: "inherit", borderRadius: 4 }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "#f5f5f5"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                  ✎
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); deleteChild(c.id); }}
                                  title="아동 삭제"
                                  style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14, padding: "2px 6px", fontFamily: "inherit", fontWeight: 700, borderRadius: 4 }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#a85020"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#ccc"; }}>
                                  ×
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* 추가 버튼 (하단 고정) */}
                    <div style={{ padding: 8, borderTop: "1px solid #f0e0e5", background: "#fafafa" }}>
                      <button
                        onClick={() => {
                          setChildDropdownOpen(false);
                          setChildSearch("");
                          setNewChildName("");
                          setShowAddChildModal(true);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px",
                          background: "#fff",
                          color: PKD,
                          border: `1.5px dashed ${PK}`,
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit"
                        }}>
                        ＋ 아동 추가
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ fontSize: 10, color: "#aaa", marginLeft: "auto" }}>
              총 <b style={{ color: PKD }}>{visibleChildren.length}명</b> 등록
              {/* ★ [v19] 선생님용 안내 */}
              {currentUser?.role === "teacher" && visibleChildren.length < children.length && (
                <div style={{ fontSize: 9.5, color: "#999", marginTop: 4 }}>
                  💡 다른 선생님 {children.length - visibleChildren.length}명 아동은 보이지 않습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 탭 네비게이션 ═══ */}
        <div className="responsive-tab-nav" style={{ display: "flex", gap: 0, marginBottom: 18, background: "#fff", borderRadius: 12, padding: 5, border: `1px solid ${PKL}`, boxShadow: "0 1px 4px rgba(212,114,138,0.06)" }}>
          {[
            ...(currentUser?.role === "admin" ? [{ k: "dashboard", label: "센터 대시보드", labelShort: "대시보드", icon: "📊", badge: "" }] : []),
            { k: "info", label: "① 아동정보", labelShort: "아동", icon: "👶", badge: (info.name ? "✓" : "") },
            { k: "iep", label: "② IEP 설정", labelShort: "IEP", icon: "🎯", badge: includedGoals.length > 0 ? `${includedGoals.length}/${goals.length}` : (goals.length > 0 ? String(goals.length) : "") },
            { k: "daily", label: "③ 데일리 데이터", labelShort: "데일리", icon: "📅", badge: dailyGoals.length === 0 ? "" : (() => {
              const hasRecordOnDate = (g) => {
                if (g.daily && g.daily[dailyDate]) return true;
                return (g.tasks || []).some(t => t.daily && t.daily[dailyDate]);
              };
              const n = dailyGoals.filter(hasRecordOnDate).length;
              return n > 0 ? `${n}/${dailyGoals.length}` : String(dailyGoals.length);
            })() },
            { k: "report", label: "④ 중간/종결 보고서", labelShort: "보고서", icon: "📄", badge: masteredIncludedGoals.length > 0 ? `✓${masteredIncludedGoals.length}` : "" }
          ].map(t => {
            const isActive = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                style={{
                  flex: 1, padding: "12px 8px",
                  background: isActive ? PK : "transparent",
                  color: isActive ? "#fff" : "#666",
                  border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  fontFamily: "inherit", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "all 0.15s ease",
                  minWidth: 0
                }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span className="tab-label-full">{t.label}</span>
                <span className="tab-label-short" style={{ display: "none" }}>{t.labelShort}</span>
                {t.badge && <span style={{ fontSize: 10, padding: "2px 7px", background: isActive ? "rgba(255,255,255,0.28)" : PKL, color: isActive ? "#fff" : PKD, borderRadius: 10, fontWeight: 700 }}>{t.badge}</span>}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ★ [v19 신규] 대시보드 탭 (관리자만)                 */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "dashboard" && currentUser?.role === "admin" && (() => {
          // ★ [수정] 보관(아카이브)된 아동은 통계에서 제외 — 활동/종료만 카운트
          const visibleForStats = children.filter(c => !c.info?.archivedAt);
          const totalChildren = visibleForStats.length;
          const activeChildren = visibleForStats.filter(c => !c.info?.finalEndDate).length;
          const terminatedChildren = visibleForStats.filter(c => c.info?.finalEndDate).length;
          const archivedChildren = children.filter(c => c.info?.archivedAt).length;
          
          const teacherStats = {};
          visibleForStats.forEach(child => {
            const owner = child.info?.ownerName || "(미할당)";
            if (!teacherStats[owner]) {
              teacherStats[owner] = {
                name: owner,
                childCount: 0,
                children: [],
                totalGoals: 0,
                totalDataPoints: 0,
                lastDataDate: null
              };
            }
            teacherStats[owner].childCount++;
            teacherStats[owner].children.push(child);
            const goals = child.goals || [];
            teacherStats[owner].totalGoals += goals.length;
            
            const dailyGoals = goals.filter(g => (g.tasks || []).some(t => t.showInDaily && t.isActive) || g.includeInIep);
            let latestDate = null;
            dailyGoals.forEach(g => {
              if (g.tasks) {
                (g.tasks || []).forEach(t => {
                  const dates = Object.keys(t.daily || {});
                  if (dates.length > 0) {
                    const maxDate = dates[dates.length - 1];
                    if (!latestDate || maxDate > latestDate) latestDate = maxDate;
                  }
                });
              }
            });
            if (latestDate && (!teacherStats[owner].lastDataDate || latestDate > teacherStats[owner].lastDataDate)) {
              teacherStats[owner].lastDataDate = latestDate;
            }
          });
          
          return (
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: `1px solid ${PKL}` }}>
              {/* 전체 통계 */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: PKD }}>📊 센터 전체 현황</h3>
                  <button
                    onClick={() => {
                      const rows = [
                        ["아동 이름", "담당 선생님", "상태", "IEP 목표 수", "데이터 입력 횟수", "최근 입력일", "정반응률(%)"]
                      ];
                      
                      children.forEach(child => {
                        const goals = (child.goals || []).filter(g => g.includeInIep);
                        let totalRecords = 0, correctCount = 0, totalCount = 0, latestDate = "";
                        
                        goals.forEach(g => {
                          (g.tasks || []).forEach(t => {
                            Object.entries(t.daily || {}).forEach(([date, day]) => {
                              if (Array.isArray(day?.trials)) {
                                totalRecords++;
                                if (date > latestDate) latestDate = date;
                                day.trials.forEach(x => {
                                  if (x === "+") correctCount++;
                                  if (x === "+" || x === "-") totalCount++;
                                });
                              }
                            });
                          });
                        });
                        
                        const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : "";
                        
                        rows.push([
                          child.info?.name || "",
                          child.info?.ownerName || "(미할당)",
                          child.info?.finalEndDate ? "종료" : "활동중",
                          goals.length,
                          totalRecords,
                          latestDate || "(없음)",
                          percentage
                        ]);
                      });
                      
                      const csv = "\uFEFF" + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
                      
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `검단ABA_통계_${new Date().toISOString().slice(0, 10)}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      fontSize: 12,
                      padding: "8px 14px",
                      background: PK,
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontFamily: "inherit"
                    }}>
                    📥 CSV 다운로드
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                  <div style={{ background: "#fdf8f9", padding: 16, borderRadius: 10, border: `1px solid ${PKL}` }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>전체 아동</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: PKD }}>{totalChildren}명</div>
                  </div>
                  <div style={{ background: "#f0fff4", padding: 16, borderRadius: 10, border: "1px solid #d4f5e3" }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>활동 중</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{activeChildren}명</div>
                  </div>
                  <div style={{ background: "#fef3f2", padding: 16, borderRadius: 10, border: "1px solid #fed7d7" }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>종료</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>{terminatedChildren}명</div>
                  </div>
                  {/* ★ [신규] 보관 아동 카드 — 보관된 아동이 있을 때만 표시 */}
                  {archivedChildren > 0 && (
                    <div
                      onClick={() => setShowArchived(v => !v)}
                      style={{ background: "#fff8e1", padding: 16, borderRadius: 10, border: "1px solid #ffe0b2", cursor: "pointer", transition: "transform 0.1s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                      title="클릭하면 '보관 아동 보기' 토글이 켜져요">
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>🗄️ 보관 아동</span>
                        <span style={{ fontSize: 9.5, color: showArchived ? "#92400e" : "#aaa", fontWeight: 600 }}>
                          {showArchived ? "표시 중" : "숨김"}
                        </span>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#92400e" }}>{archivedChildren}명</div>
                    </div>
                  )}
                </div>
              </div>

              {/* 선생님별 현황 */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 14, color: PKD }}>👥 선생님별 현황</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Object.values(teacherStats).map(teacher => {
                    // ★ [신규] 선생님별 활동/종료 아동 카운트
                    const activeCount = teacher.children.filter(c => !c.info?.finalEndDate).length;
                    const terminatedCount = teacher.children.filter(c => c.info?.finalEndDate).length;
                    return (
                    <div key={teacher.name} style={{ background: "#fdf8f9", padding: 16, borderRadius: 10, border: `1px solid ${PKL}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#333" }}>👨‍🏫 {teacher.name}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span>아동 {teacher.childCount}명</span>
                            {activeCount > 0 && (
                              <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 8, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
                                활동 {activeCount}
                              </span>
                            )}
                            {terminatedCount > 0 && (
                              <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
                                종료 {terminatedCount}
                              </span>
                            )}
                            <span style={{ color: "#bbb" }}>·</span>
                            <span>목표 {teacher.totalGoals}개</span>
                          </div>
                        </div>
                        {teacher.lastDataDate && (
                          <div style={{ fontSize: 11, color: "#888", textAlign: "right" }}>
                            최근 입력<br/>{teacher.lastDataDate}
                          </div>
                        )}
                      </div>
                      
                      {/* 아동별 상세 */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${PKL}` }}>
                        {teacher.children.map(child => {
                          const goals = (child.goals || []).filter(g => g.includeInIep);
                          const dailyGoals = goals.filter(g => (g.tasks || []).some(t => t.showInDaily && t.isActive));
                          const isTerminated = !!child.info?.finalEndDate;  // ★ [신규] 종료 여부
                          
                          let latestDate = null;
                          let correctCount = 0;
                          let totalCount = 0;
                          dailyGoals.forEach(g => {
                            (g.tasks || []).forEach(t => {
                              const dates = Object.keys(t.daily || {});
                              if (dates.length > 0) {
                                const maxDate = dates[dates.length - 1];
                                if (!latestDate || maxDate > latestDate) latestDate = maxDate;
                                
                                const records = t.daily[maxDate] || [];
                                records.forEach(r => {
                                  totalCount++;
                                  if (r === "○") correctCount++;
                                });
                              }
                            });
                          });
                          
                          const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null;
                          
                          return (
                            <div key={child.id} style={{ background: isTerminated ? "#fafafa" : "#fff", padding: 10, borderRadius: 8, border: `1px solid ${isTerminated ? "#e5e5e5" : "#f0e0e5"}`, fontSize: 12, opacity: isTerminated ? 0.85 : 1 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, color: "#333", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span>🧒 {child.info?.name || "(이름없음)"}</span>
                                    {/* ★ [신규] 상태 배지 */}
                                    {isTerminated ? (
                                      <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 6, background: "#fee2e2", color: "#991b1b", fontWeight: 700 }}>
                                        종료
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontWeight: 700 }}>
                                        활동 중
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                    목표: {goals.length}개
                                    {isTerminated && child.info?.finalEndDate && (
                                      <span style={{ marginLeft: 6, color: "#991b1b" }}>· 종결일 {child.info.finalEndDate}</span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  {percentage !== null ? (
                                    <>
                                      <div style={{ fontWeight: 700, color: percentage >= 70 ? "#10b981" : percentage >= 50 ? "#f59e0b" : "#dc2626" }}>
                                        {percentage}%
                                      </div>
                                      <div style={{ fontSize: 10, color: "#888" }}>({correctCount}/{totalCount})</div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: 11, color: "#bbb" }}>데이터 없음</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 1: 아동정보                                      */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "info" && (
          <div>
            <div style={CS}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 14, color: PKD }}>아동 기본 정보</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                <div><label style={LS}>아동 이름</label><input style={IS} value={info.name} onChange={e => {
                  const newName = e.target.value;
                  const oldName = info.name;
                  setInfo(p => ({ ...p, name: newName }));
                  if (newName && oldName && newName !== oldName) {
                    addHistory("info_update", `아동 이름 변경: "${oldName}" → "${newName}"`, oldName, newName, "name");
                  }
                }} placeholder="예: 조은우" /></div>
                <div><label style={LS}>생년월일</label><input style={IS} value={info.birth} onChange={e => {
                  const newBirth = e.target.value;
                  const oldBirth = info.birth;
                  setInfo(p => ({ ...p, birth: newBirth }));
                  if (newBirth !== oldBirth) {
                    addHistory("info_update", `생년월일 변경: "${oldBirth}" → "${newBirth}"`, oldBirth, newBirth, "birth");
                  }
                }} placeholder="예: 2020년 04월 23일" /></div>
                <div><label style={LS}>소속반</label><input style={IS} value={info.room} onChange={e => {
                  const newRoom = e.target.value;
                  const oldRoom = info.room;
                  setInfo(p => ({ ...p, room: newRoom }));
                  if (newRoom !== oldRoom) {
                    addHistory("info_update", `소속반 변경: "${oldRoom}" → "${newRoom}"`, oldRoom, newRoom, "room");
                  }
                }} /></div>
                <div><label style={LS}>담당 치료사</label><input style={IS} value={info.therapist} onChange={e => {
                  const newTherapist = e.target.value;
                  const oldTherapist = info.therapist;
                  // ★ [신규] 담당 치료사 이름이 등록된 선생님(또는 관리자 본인)과 일치하면 ownerName 자동 배정
                  const trimmed = (newTherapist || "").trim();
                  const knownNames = [
                    ...(currentUser?.name ? [currentUser.name] : []),
                    ...(teachers || []).map(t => t.name)
                  ];
                  const matched = knownNames.find(n => n === trimmed);
                  const oldOwner = info.ownerName || "";
                  setInfo(p => ({
                    ...p,
                    therapist: newTherapist,
                    // 매칭되면 자동 배정. 매칭 안 되면 기존 ownerName 유지 (수동 설정 보존)
                    ownerName: matched ? matched : p.ownerName
                  }));
                  if (newTherapist !== oldTherapist) {
                    addHistory("info_update", `담당 치료사 변경: "${oldTherapist}" → "${newTherapist}"`, oldTherapist, newTherapist, "therapist");
                  }
                  if (matched && matched !== oldOwner) {
                    addHistory("info_update", `담당 선생님 자동 배정: "${oldOwner || "(미할당)"}" → "${matched}"`, oldOwner, matched, "ownerName");
                  }
                }} placeholder="담당 치료사" /></div>
                <div><label style={LS}>평가 시작일</label><input style={IS} type="date" value={info.evalStart} onChange={e => {
                  const newStart = e.target.value;
                  const oldStart = info.evalStart;
                  setInfo(p => ({ ...p, evalStart: newStart }));
                  if (newStart !== oldStart) {
                    addHistory("info_update", `평가 시작일 변경: ${oldStart} → ${newStart}`, oldStart, newStart, "evalStart");
                  }
                }} /></div>
                <div><label style={LS}>평가 종료일</label><input style={IS} type="date" value={info.evalEnd} onChange={e => {
                  const newEnd = e.target.value;
                  const oldEnd = info.evalEnd;
                  setInfo(p => ({ ...p, evalEnd: newEnd }));
                  if (newEnd !== oldEnd) {
                    addHistory("info_update", `평가 종료일 변경: ${oldEnd} → ${newEnd}`, oldEnd, newEnd, "evalEnd");
                  }
                }} /></div>
                {/* ★ [신규] 관리자 전용 — 담당 선생님(시스템) 변경 드롭다운 */}
                {currentUser?.role === "admin" && (
                  <div>
                    <label style={LS}>
                      담당 선생님 <span style={{ color: PK, fontSize: 10, fontWeight: 500 }}>(관리자만)</span>
                    </label>
                    <select
                      style={IS}
                      value={info.ownerName || ""}
                      onChange={e => {
                        const newOwner = e.target.value;
                        const oldOwner = info.ownerName || "";
                        setInfo(p => ({ ...p, ownerName: newOwner }));
                        if (newOwner !== oldOwner) {
                          addHistory("info_update", `담당 선생님 변경: "${oldOwner || "(미할당)"}" → "${newOwner || "(미할당)"}"`, oldOwner, newOwner, "ownerName");
                        }
                      }}>
                      <option value="">— (미할당) —</option>
                      {currentUser?.name && (
                        <option value={currentUser.name}>👑 {currentUser.name} (본인 · 관리자)</option>
                      )}
                      {(teachers || [])
                        .filter(t => t.name !== currentUser?.name)
                        .map(t => (
                          <option key={t.id} value={t.name}>👤 {t.name} 선생님</option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* ★ [신규] 종결 상태 경고 카드 — 현재 아동이 종결 상태일 때만 표시 */}
            {info.finalEndDate && (
              <div style={{ ...CS, background: "#fef3f2", border: "1.5px solid #dc2626" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16 }}>🔴</span>
                      <span>이 아동은 현재 <u>종결 상태</u>입니다</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#7f1d1d", lineHeight: 1.6 }}>
                      종결일: <b>{info.finalEndDate}</b><br/>
                      대시보드의 '종료' 카운트에 포함되며, 데일리 입력은 가능하지만 보고서가 종결 모드로 표시됩니다.<br/>
                      <span style={{ color: "#991b1b", fontWeight: 600 }}>실수로 종결됐다면 아래 버튼으로 해제하세요.</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      askConfirm(
                        `'${info.name || "이 아동"}'의 종결 상태를 해제하시겠습니까?\n\n종결일이 삭제되고 '활동 중' 상태로 돌아갑니다.`,
                        () => setInfo(prev => ({ ...prev, finalEndDate: "" }))
                      );
                    }}
                    style={{ padding: "8px 16px", background: "#fff", border: "1.5px solid #dc2626", color: "#dc2626", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    ↺ 종결 해제
                  </button>
                </div>
              </div>
            )}

            <div style={{ ...CS, background: "#fdf8f9", border: `1px solid ${PK}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: PKD, marginBottom: 10 }}>📋 통합 시스템 사용 순서</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, fontSize: 11, color: "#555", lineHeight: 1.7 }}>
                {[
                  { n: "①", t: "아동정보", d: "이름·생년월일·담당 치료사 등 기본 정보를 입력합니다." },
                  { n: "②", t: "IEP 설정", d: "커리큘럼에서 [IEP 포함] 스위치로 목표를 선정하고, 영역별 현행 수준을 편집합니다." },
                  { n: "③", t: "데일리 데이터", d: "매 세션마다 +/- 버튼으로 정·오반응 개수를 기록합니다." },
                  { n: "④", t: "중간보고서", d: "성장 그래프가 자동 생성되고 PDF 양식으로 인쇄합니다." }
                ].map(s => (
                  <div key={s.n} style={{ background: "#fff", padding: "10px 12px", borderRadius: 8, border: `1px solid ${PKL}` }}>
                    <div style={{ fontSize: 18, color: PK, fontWeight: 700, marginBottom: 4 }}>{s.n}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PKD, marginBottom: 4 }}>{s.t}</div>
                    <div>{s.d}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16, padding: "10px 14px", background: "#fff", borderRadius: 10, fontSize: 11, color: "#767676", lineHeight: 1.7, border: `1px solid ${PKL}` }}>
              💾 모든 데이터는 자동으로 저장되며, 새로고침이나 재시작 후에도 복원됩니다. 하나의 통합 데이터(`goals` 배열)로 IEP · 데일리 · 보고서가 유기적으로 연결됩니다.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button style={BP} onClick={() => setTab("iep")}>다음: IEP 설정 →</button>
            </div>

            {/* ★ [v19] 데이터 변경 이력 */}
            {false && history && history.length > 0 && (
              <div style={{ ...CS, background: "#f5f5f5", marginTop: 20, border: "1px solid #e0e0e0" }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, marginBottom: 12, color: "#555" }}>
                  📋 데이터 변경 이력 ({history.length}건)
                </h3>
                <div style={{ maxHeight: 300, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.slice().reverse().map((h, i) => (
                    <div key={i} style={{
                      padding: "8px 10px",
                      background: "#fff",
                      border: "1px solid #e8e8e8",
                      borderRadius: 6,
                      fontSize: 10.5,
                      color: "#333",
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 600, color: "#555", marginBottom: 2 }}>
                        {h.timestamp ? new Date(h.timestamp).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                        &nbsp;|&nbsp;
                        <span style={{ color: "#c0752b" }}>{h.userName}</span>
                      </div>
                      <div>{h.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 2: IEP 설정 (좌 ELCAR 리스트 + 우 목표 카드)    */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "iep" && (
          <div>
            {/* ★ [B] 보고서 발행 알림 배너 — IEP 영역 평균은 중간보고서 발행 이후 데이터 기준 */}
            {/* ★ [종결보관본 제외] 종결보고서는 cutoff 적용 안 되므로 배너 대상 아님 */}
            {(() => {
              const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
              if (cutoffArchives.length === 0 || !cutoffArchives[0].savedAt) return null;
              return (
                <div style={{ marginBottom: 12, padding: "10px 14px", background: "#eff5fc", borderLeft: "3px solid #2a6cb2", borderRadius: 6, fontSize: 11, color: "#1d4d80", lineHeight: 1.65 }}>
                  📌 <b>{cutoffArchives[0].savedAt.slice(0, 10)} 보고서 발행</b> — 영역별 현행 수준은 보고서 발행 이후 데이터 기준으로 계산됩니다.
                </div>
              );
            })()}

            {/* ★ [v19 일관성] IEP 인쇄 버튼은 화면 하단으로 이동 (중간/종결과 통일) */}

            {/* ★ [IEP 신규] 의뢰 사유 / 보호자 협력 / 권고사항 — 칩+자동 생성 3섹션 */}
            {(() => {
              const MARKER_RE = /\n*<!--SELECTED:([^>]*)-->\s*$/;
              const stripMarker = (s) => (s || "").replace(MARKER_RE, "").trim();

              const sections = [
                {
                  key: "iepReferralReason",
                  emoji: "📋",
                  title: "의뢰 사유",
                  hint: "발달적 어려움 키워드 선택",
                  buildFunc: buildIepReferralReason,
                  chips: [
                    ["표현 언어 지연", "lang"], ["수용 언어 지연", "lang"], ["비구어/제한된 발성", "lang"],
                    ["또래 상호작용 어려움", "social"], ["눈맞춤·공동주의 부족", "social"], ["사회적 단서 이해 부족", "social"],
                    ["도전 행동", "behav"], ["자기자극·상동 행동", "behav"], ["변화·전환 어려움", "behav"],
                    ["자조 기술 부족", "adapt"], ["학습 준비 부족", "adapt"], ["감각 처리 어려움", "adapt"]
                  ]
                },
                {
                  key: "iepHomeCollab",
                  emoji: "🏠",
                  title: "보호자 협력 방안",
                  hint: "센터·가정 일관성 키워드 선택",
                  buildFunc: buildIepHomeCollab,
                  chips: [
                    ["센터 학습 가정 연계", "reinforce"], ["긍정적 강화 일관성", "reinforce"],
                    ["일상 루틴 안에서 연습", "routine"], ["보호자 직접 시연 안내", "routine"],
                    ["주간 진행 상황 공유", "communication"], ["관찰 일지 활용", "communication"],
                    ["구조화된 환경 마련", "environment"], ["또래 만남 기회 확대", "environment"]
                  ]
                },
                {
                  key: "iepRecommendations",
                  emoji: "🎯",
                  title: "권고사항",
                  hint: "진행 점검·협력·교육 키워드 선택",
                  buildFunc: buildIepRecommendations,
                  chips: [
                    ["정기 진행 점검", "monitoring"], ["데이터 기반 진행도 평가", "monitoring"], ["마일스톤 재평가", "monitoring"],
                    ["타 영역 전문가 협력", "collab"], ["교육기관 연계", "collab"],
                    ["확장 목표 단계적 도입", "future"], ["자연 환경 일반화 단계", "future"],
                    ["보호자 교육 워크숍", "education"]
                  ]
                }
              ];

              return (
                <div style={{ ...CS, marginBottom: 14, background: "#fff" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PKD, marginBottom: 4 }}>
                    📝 IEP 추가 정보 <span style={{ fontSize: 10, fontWeight: 500, color: "#888", marginLeft: 6 }}>(선택 입력 · 비워두면 인쇄 생략)</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#888", marginBottom: 14, lineHeight: 1.6 }}>
                    의뢰 사유, 보호자 협력 방안, 권고사항을 칩 클릭으로 자동 생성할 수 있습니다.
                  </div>

                  {sections.map(sec => {
                    const currentValue = info[sec.key] || "";
                    const markerMatch = currentValue.match(MARKER_RE);
                    const selected = markerMatch ? markerMatch[1].split("|").filter(Boolean) : [];
                    const visibleText = stripMarker(currentValue);
                    const selectedSet = new Set(selected);

                    const toggle = (label) => {
                      const newSel = new Set(selectedSet);
                      if (newSel.has(label)) newSel.delete(label);
                      else newSel.add(label);
                      const arr = Array.from(newSel);
                      const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
                      setInfo(prev => ({ ...prev, [sec.key]: visibleText + marker }));
                    };

                    const generate = () => {
                      const arr = Array.from(selectedSet);
                      if (arr.length === 0) return;
                      const para = sec.buildFunc(arr, info);
                      const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
                      setInfo(prev => ({ ...prev, [sec.key]: para + marker }));
                    };

                    const clear = () => {
                      setInfo(prev => ({ ...prev, [sec.key]: "" }));
                    };

                    return (
                      <div key={sec.key} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px dashed #f0e0e5" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 6 }}>
                          {sec.emoji} {sec.title} <span style={{ fontSize: 9.5, fontWeight: 400, color: "#888" }}>({sec.hint})</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
                          {sec.chips.map(([label], i) => {
                            const isSel = selectedSet.has(label);
                            return (
                              <button key={i}
                                onClick={() => toggle(label)}
                                style={{
                                  padding: "3px 8px", fontSize: 10,
                                  border: isSel ? `1px solid ${PKD}` : `1px solid ${PK}`,
                                  borderRadius: 12,
                                  background: isSel ? PKD : PKL,
                                  color: isSel ? "#fff" : PKD,
                                  cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                                }}>
                                {isSel ? "✓" : "+"} {label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 5, marginBottom: 6, alignItems: "center" }}>
                          <button
                            onClick={generate}
                            disabled={selectedSet.size === 0}
                            style={{
                              padding: "5px 12px", fontSize: 10.5,
                              border: `1px solid ${PKD}`,
                              borderRadius: 6,
                              background: selectedSet.size === 0 ? "#f0f0f0" : PKD,
                              color: selectedSet.size === 0 ? "#aaa" : "#fff",
                              cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                              fontFamily: "inherit", fontWeight: 600
                            }}>
                            ✨ 자동 생성
                          </button>
                          <button
                            onClick={clear}
                            style={{
                              padding: "5px 10px", fontSize: 10,
                              border: "1px solid #ccc", borderRadius: 6,
                              background: "#fff", color: "#666",
                              cursor: "pointer", fontFamily: "inherit"
                            }}>
                            🗑 초기화
                          </button>
                          <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                            {selectedSet.size > 0 ? `선택 ${selectedSet.size}개` : "키워드 선택 후 [✨ 자동 생성]"}
                          </span>
                        </div>
                        <textarea
                          value={visibleText}
                          onChange={e => {
                            const marker = selected.length > 0 ? `\n\n<!--SELECTED:${selected.join("|")}-->` : "";
                            setInfo(prev => ({ ...prev, [sec.key]: e.target.value + marker }));
                          }}
                          placeholder={`${sec.title}을(를) 자유롭게 작성하거나 위 칩을 사용해 자동 생성하세요. 비워두면 인쇄 생략됩니다.`}
                          rows={Math.min(8, Math.max(3, (visibleText || "").split("\n").length + 1))}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e8d0d6", borderRadius: 6, fontSize: 11, fontFamily: "inherit", lineHeight: 1.7, resize: "vertical", boxSizing: "border-box" }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* W-30: IEP 설정 탭의 '영역별 현재 수행률 시각화' 제거 — 보고서 탭에 동일 차트 존재. IEP는 미래 계획 작성 탭이므로 진전도 그래프 부적합 */}

            {/* ★ [v19 신규] 커리큘럼 통합 검색 */}
            <div style={{ ...CS, marginBottom: 10, background: "#fdf8f9", border: `1px solid ${PKL}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: PKD }}>🔍 커리큘럼 검색</h3>
                <div style={{ fontSize: 10, color: "#888" }}>모든 커리큘럼에서 키워드로 검색</div>
              </div>
              <input
                type="text"
                value={iepSearchQuery}
                onChange={e => setIepSearchQuery(e.target.value)}
                placeholder="🔍 예: 눈맞춤, 요구, 모방, 색깔..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: 13,
                  border: `1.5px solid ${PKL}`,
                  borderRadius: 8,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  marginBottom: 12
                }}
                onFocus={e => { e.target.style.borderColor = PK; }}
                onBlur={e => { e.target.style.borderColor = PKL; }}
              />
              
              {/* 검색 결과 */}
              {iepSearchQuery.trim().length >= 2 && (() => {
                const q = iepSearchQuery.trim().toLowerCase();
                const results = [];
                
                ELCAR.forEach(domain => {
                  domain.s.forEach(section => {
                    section.i.forEach(item => {
                      if (item.toLowerCase().includes(q) || section.n.toLowerCase().includes(q) || domain.d.toLowerCase().includes(q)) {
                        results.push({
                          curriculum: "ELCAR",
                          domain: domain.d,
                          section: section.n,
                          item: item,
                          color: PK,
                          colorBg: PKL,
                          colorText: PKD
                        });
                      }
                    });
                  });
                });
                
                VBMAPP_DOMAINS.forEach(domain => {
                  domain.s.forEach(section => {
                    section.i.forEach(item => {
                      if (item.toLowerCase().includes(q) || section.n.toLowerCase().includes(q) || domain.d.toLowerCase().includes(q)) {
                        results.push({
                          curriculum: "VB-MAPP",
                          domain: domain.d,
                          section: section.n,
                          item: item,
                          color: "#2a6cb2",
                          colorBg: "#e6f1fb",
                          colorText: "#2a6cb2"
                        });
                      }
                    });
                  });
                });
                
                ESDM_DOMAINS.forEach(domain => {
                  domain.s.forEach(section => {
                    section.i.forEach(item => {
                      if (item.toLowerCase().includes(q) || section.n.toLowerCase().includes(q) || domain.d.toLowerCase().includes(q)) {
                        results.push({
                          curriculum: "ESDM",
                          domain: domain.d,
                          section: section.n,
                          item: item,
                          color: "#4a7316",
                          colorBg: "#eaf3de",
                          colorText: "#4a7316"
                        });
                      }
                    });
                  });
                });
                
                if (results.length === 0) {
                  return (
                    <div style={{ padding: 20, textAlign: "center", background: "#fff", borderRadius: 8, border: `1px solid ${PKL}` }}>
                      <div style={{ fontSize: 30, marginBottom: 6, opacity: 0.5 }}>🔍</div>
                      <div style={{ fontSize: 12, color: "#888" }}>"{iepSearchQuery}"에 대한 결과가 없습니다</div>
                    </div>
                  );
                }
                
                const grouped = {
                  "ELCAR": results.filter(r => r.curriculum === "ELCAR"),
                  "VB-MAPP": results.filter(r => r.curriculum === "VB-MAPP"),
                  "ESDM": results.filter(r => r.curriculum === "ESDM")
                };
                
                return (
                  <div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
                      🎯 <b style={{ color: PKD }}>{results.length}건</b>의 결과를 찾았습니다
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
                      {Object.entries(grouped).map(([curr, items]) => {
                        if (items.length === 0) return null;
                        const color = items[0].color;
                        const colorBg = items[0].colorBg;
                        const colorText = items[0].colorText;
                        return (
                          <div key={curr} style={{ background: "#fff", borderRadius: 8, border: `1px solid ${color}`, overflow: "hidden" }}>
                            <div style={{ padding: "8px 12px", background: colorBg, borderBottom: `1px solid ${color}` }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: colorText }}>📚 {curr}</span>
                              <span style={{ fontSize: 10, color: colorText, marginLeft: 8, opacity: 0.7 }}>({items.length}건)</span>
                            </div>
                            <div style={{ padding: "6px 0" }}>
                              {items.map((r, i) => {
                                const isIncluded = goals.some(g => g.source === r.curriculum && g.domain === r.domain && g.name === r.item && g.includeInIep);
                                return (
                                  <div
                                    key={`${curr}-${i}`}
                                    onClick={() => {
                                      setCurriculum(r.curriculum);
                                      setIepSearchQuery("");
                                      const existingGoal = goals.find(g => g.source === r.curriculum && g.domain === r.domain && g.name === r.item);
                                      if (existingGoal) {
                                        setGoals(prev => prev.map(g => g.id === existingGoal.id ? { ...g, includeInIep: !g.includeInIep } : g));
                                      } else {
                                        const newGoal = {
                                          id: "g_" + Date.now(),
                                          source: r.curriculum,
                                          domain: r.domain,
                                          section: r.section,
                                          name: r.item,
                                          description: "",
                                          includeInIep: true,
                                          tasks: [{
                                            id: "t_" + Date.now(),
                                            name: r.item,
                                            description: "",
                                            isActive: true,
                                            showInDaily: true,
                                            listGroup: "1"
                                          }]
                                        };
                                        setGoals(prev => [...prev, newGoal]);
                                      }
                                    }}
                                    style={{
                                      padding: "8px 14px",
                                      cursor: "pointer",
                                      borderBottom: i < items.length - 1 ? "1px solid #f5f5f5" : "none",
                                      transition: "background 0.1s",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = colorBg; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                                  >
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 2 }}>
                                        {r.item}
                                      </div>
                                      <div style={{ fontSize: 10, color: "#888" }}>
                                        {r.domain} › {r.section}
                                      </div>
                                    </div>
                                    {isIncluded ? (
                                      <span style={{ fontSize: 9, padding: "3px 8px", background: "#10b981", color: "#fff", borderRadius: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
                                        ✓ IEP 포함
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 9, padding: "3px 8px", background: color, color: "#fff", borderRadius: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
                                        + 추가
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              
              {iepSearchQuery.trim().length === 0 && (
                <div style={{ fontSize: 10.5, color: "#888", textAlign: "center", padding: "12px", background: "#fff", borderRadius: 8 }}>
                  💡 키워드를 2글자 이상 입력하세요. 예: "눈맞춤", "요구 표현", "모방"
                </div>
              )}
              {iepSearchQuery.trim().length === 1 && (
                <div style={{ fontSize: 10.5, color: "#888", textAlign: "center", padding: "12px", background: "#fff", borderRadius: 8 }}>
                  ⌨️ 한 글자 더 입력해주세요...
                </div>
              )}
            </div>

            {/* ═ 커리큘럼 카테고리 탭 (ELCAR / VB-MAPP / ESDM) ═ */}
            <div style={{ ...CS, paddingBottom: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: PKD }}>📚 커리큘럼 선택</h3>
                <div style={{ fontSize: 11, color: "#767676" }}>3가지 커리큘럼을 자유롭게 전환하며 목표를 선택할 수 있습니다</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { k: "ELCAR", label: "ELCAR", desc: "언어행동 커리큘럼", colorBg: PK, colorLight: PKL, colorText: PKD },
                  { k: "VB-MAPP", label: "VB-MAPP", desc: "언어행동 평가·배치", colorBg: "#2a6cb2", colorLight: "#e6f1fb", colorText: "#2a6cb2" },
                  { k: "ESDM", label: "ESDM", desc: "조기중재 발달모델", colorBg: "#4a7316", colorLight: "#eaf3de", colorText: "#4a7316" }
                ].map(c => {
                  const isActive = curriculum === c.k;
                  const catalog = c.k === "ELCAR" ? ELCAR : c.k === "VB-MAPP" ? VBMAPP_DOMAINS : ESDM_DOMAINS;
                  const totalInCatalog = catalog.reduce((sum, d) => sum + d.s.reduce((s2, sub) => s2 + sub.i.length, 0), 0);
                  const iepInCat = goals.filter(g => g.source === c.k && g.includeInIep).length;
                  return (
                    <button key={c.k} onClick={() => setCurriculum(c.k)}
                      style={{
                        flex: "1 1 180px",
                        padding: "12px 16px",
                        border: `2px solid ${isActive ? c.colorBg : "#e8d0d6"}`,
                        borderRadius: 12,
                        background: isActive ? c.colorBg : "#fff",
                        color: isActive ? "#fff" : c.colorText,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                        display: "flex", alignItems: "center", gap: 10
                      }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>{c.label}</div>
                        <div style={{ fontSize: 10, marginTop: 2, opacity: isActive ? 0.9 : 0.65 }}>{c.desc}</div>
                      </div>
                      <span
                        title={`IEP에 포함된 ${iepInCat}개 / ${c.label} 전체 ${totalInCatalog}개 항목`}
                        style={{
                          display: "inline-flex", alignItems: "baseline",
                          padding: "3px 10px", borderRadius: 10,
                          background: isActive ? "rgba(255,255,255,0.25)" : c.colorLight,
                          color: isActive ? "#fff" : c.colorText
                        }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{iepInCat}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.7, marginLeft: 1 }}>/{totalInCatalog}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 현재 선택된 커리큘럼의 영역 탭 */}
            <div style={{ ...CS, paddingBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: PKD }}>
                  {curriculum === "ELCAR" && "ELCAR 영역"}
                  {curriculum === "VB-MAPP" && "VB-MAPP 영역"}
                  {curriculum === "ESDM" && "ESDM 발달 영역"}
                </h3>
                <div style={{ fontSize: 11, color: "#767676" }}>💡 항목을 클릭하면 [IEP 포함]이 토글됩니다.</div>
              </div>
              <div className="responsive-tab-scroll" style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {currentCatalog.map((d, i) => {
                  const isActive = i === selDomainIdx;
                  const totalInDomain = d.s.reduce((s2, sub) => s2 + sub.i.length, 0);
                  const iepInDomain = goals.filter(g => g.domain === d.d && g.includeInIep).length;
                  return (
                    <button key={i} onClick={() => setSelDomainIdx(i)}
                      style={{ fontSize: 12, padding: "6px 12px", border: `1px solid ${isActive ? PK : "#e8d0d6"}`, borderRadius: 20, background: isActive ? PK : "#fff", color: isActive ? "#fff" : "#777", cursor: "pointer", fontFamily: "inherit", fontWeight: isActive ? 600 : 400, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {d.d}
                      <span
                        title={`IEP에 포함된 ${iepInDomain}개 / 이 영역 전체 ${totalInDomain}개 항목`}
                        style={{ display: "inline-flex", alignItems: "baseline", padding: "1px 6px", background: isActive ? "rgba(255,255,255,0.25)" : PKL, color: isActive ? "#fff" : PKD, borderRadius: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>{iepInDomain}</span>
                        <span style={{ fontSize: 8, fontWeight: 500, opacity: 0.75, marginLeft: 1 }}>/{totalInDomain}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ★ [옵션 A] 1단 세로 배열: 영역 탭 → 항목 리스트 (가로 폭 100%) → IEP 요약 */}
            {/* ★ [옵션 A] 1단 세로 배열: 영역 탭 → 항목 리스트 (가로 폭 100%) → IEP 요약 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start" }}>
              {/* 위쪽 — 전체 STO 리스트 (가로 폭 100%) */}
              <div style={{ ...CS, marginBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${PKL}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>{currentDomain.d}</div>
                    <div style={{ fontSize: 10, color: "#767676", marginTop: 2 }}>{currentDomain.s.length}개 세부영역 · 총 {currentDomain.s.reduce((a, s) => a + s.i.length, 0)}개 항목</div>
                  </div>
                  <div style={{ fontSize: 10, padding: "2px 8px", background: PKL, color: PKD, borderRadius: 10, fontWeight: 600 }}>클릭 = IEP 포함/제외</div>
                </div>

                {/* (⭐ 추천 STO 상단 섹션은 사용자 요청으로 제거됨 — 개별 항목의 ⭐ 뱃지는 유지) */}

                {/* 세부영역별 전체 리스트 */}
                {currentDomain.s.map(sub => {
                  const subIncluded = sub.i.filter(item => goals.some(g => g.domain === currentDomain.d && g.subDomain === sub.n && g.item === item && g.includeInIep)).length;
                  let headerBg = "#fdf8f9", headerColor = PKD;
                  if (curriculum === "VB-MAPP") {
                    if (/^L1\b/.test(sub.n))      { headerBg = "#e8f5d8"; headerColor = "#4a7316"; }
                    else if (/^L2\b/.test(sub.n)) { headerBg = "#e6f1fb"; headerColor = "#2a6cb2"; }
                    else if (/^L3\b/.test(sub.n)) { headerBg = "#f0e6f7"; headerColor = "#7b4ba1"; }
                  } else if (curriculum === "ESDM") {
                    if (/레벨\s*1\b/.test(sub.n))      { headerBg = "#e8f5d8"; headerColor = "#4a7316"; }
                    else if (/레벨\s*2\b/.test(sub.n)) { headerBg = "#e6f1fb"; headerColor = "#2a6cb2"; }
                    else if (/레벨\s*3\b/.test(sub.n)) { headerBg = "#f0e6f7"; headerColor = "#7b4ba1"; }
                    else if (/레벨\s*4\b/.test(sub.n)) { headerBg = "#fdecd4"; headerColor = "#b8651a"; }
                  }
                  return (
                    <div key={sub.n} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: headerColor, margin: "6px 0 5px", padding: "4px 8px", background: headerBg, borderRadius: 5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{sub.n}</span>
                        <span style={{ fontSize: 9, color: "#aaa" }}>{subIncluded > 0 ? `${subIncluded}/${sub.i.length}개 IEP 포함` : `${sub.i.length}개 항목`}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 5 }}>
                        {sub.i.map(item => {
                          const existing = goals.find(g => g.domain === currentDomain.d && g.subDomain === sub.n && g.item === item);
                          const included = !!(existing && existing.includeInIep);
                          const mapping = curriculum === "ELCAR" ? findMapping(currentDomain.d + " " + sub.n + " " + item) : { vbmapp: null, esdm: null };
                          const isRecommended = curriculum === "ELCAR" && !!(mapping.vbmapp || mapping.esdm);
                          return (
                            <button key={item} onClick={() => toggleCatalogInclude(curriculum, currentDomain.d, sub.n, item)}
                              style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "7px 9px", border: `1px solid ${included ? PK : "#f0e0e5"}`, borderRadius: 7, cursor: "pointer", background: included ? PKL : "#fff", fontFamily: "inherit", textAlign: "left", transition: "all 0.12s ease", position: "relative", minWidth: 0 }}
                              onMouseEnter={e => { if (!included) e.currentTarget.style.background = "#fcfafb"; }}
                              onMouseLeave={e => { if (!included) e.currentTarget.style.background = "#fff"; }}>
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${included ? PK : "#d8c0c8"}`, background: included ? PK : "#fff", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{included && "✓"}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: included ? PKD : "#444", lineHeight: 1.4, fontWeight: included ? 500 : 400, wordBreak: "keep-all", overflowWrap: "break-word" }}>{item}</div>
                                {/* ELCAR 매핑 뱃지 */}
                                {curriculum === "ELCAR" && (mapping.vbmapp || mapping.esdm) && (
                                  <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {mapping.vbmapp && <span style={{ fontSize: 8.5, padding: "1px 5px", background: "#e6f1fb", color: "#2a6cb2", borderRadius: 6, fontWeight: 700 }}>VB: {mapping.vbmapp.v} L{mapping.vbmapp.lv}</span>}
                                    {mapping.esdm && <span style={{ fontSize: 8.5, padding: "1px 5px", background: "#eaf3de", color: "#4a7316", borderRadius: 6, fontWeight: 700 }}>ESDM: {mapping.esdm.v}</span>}
                                  </div>
                                )}
                                {/* VB-MAPP 모드 뱃지 */}
                                {curriculum === "VB-MAPP" && (
                                  <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 8.5, padding: "1px 5px", background: headerBg, color: headerColor, borderRadius: 6, fontWeight: 700 }}>VB-MAPP · {sub.n}</span>
                                  </div>
                                )}
                                {/* ESDM 모드 뱃지 */}
                                {curriculum === "ESDM" && (
                                  <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 8.5, padding: "1px 5px", background: headerBg, color: headerColor, borderRadius: 6, fontWeight: 700 }}>ESDM · {sub.n}</span>
                                  </div>
                                )}
                              </div>
                              {/* ⭐ 추천 별표 제거 — 산만함 해소 */}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 아래쪽 — IEP 포함 요약 + 영역별 현행수준 편집 */}
              <div>
                {/* ═ 섹션 A: IEP 포함 목표 요약 ═ */}
                <div style={CS}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: PKD }}>IEP 포함 목표 ({includedGoals.length}개)</h3>
                      <div style={{ fontSize: 11, color: "#767676", marginTop: 3 }}>
                        전체 {goals.length}개 중 {includedGoals.length}개가 IEP·데이터 시트·보고서에 반영됩니다.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setShowExtForm(true)}
                        style={{ ...BS, fontSize: 11, padding: "5px 12px", background: PK, color: "#fff", fontWeight: 600, border: "none" }}>
                        + 기타 영역 추가
                      </button>
                      {goals.length > 0 && (
                        <button style={{ ...BS, fontSize: 11, padding: "5px 10px" }} onClick={() => askConfirm("모든 목표를 삭제하시겠습니까?\n데일리 기록도 함께 삭제됩니다.", () => setGoals([]))}>전체 삭제</button>
                      )}
                    </div>
                  </div>

                  {includedGoals.length === 0 && (
                    <div style={{ textAlign: "center", padding: "36px 20px", border: `2px dashed ${PKL}`, borderRadius: 12, background: "#fdfdfd" }}>
                      <div style={{ fontSize: 38, marginBottom: 8, opacity: 0.6 }}>📋</div>
                      <div style={{ fontSize: 13, color: "#888", marginBottom: 6, fontWeight: 500 }}>아직 IEP에 포함된 목표가 없습니다</div>
                      <div style={{ fontSize: 11, color: "#bbb", lineHeight: 1.7 }}>
                        왼쪽 리스트에서 항목을 <b style={{ color: PKD }}>클릭</b>하여 IEP에 포함시키거나<br/>
                        상단 <b style={{ color: PKD }}>[+ 기타 영역 추가]</b>로 커리큘럼에 없는 목표를 직접 입력하세요.
                      </div>
                    </div>
                  )}

                  {includedGoals.length > 0 && (
                    <div style={{ maxHeight: "55vh", overflowY: "auto", paddingRight: 2 }}>
                      {(() => {
                        const bySource = { "ELCAR": [], "VB-MAPP": [], "ESDM": [], "기타": [] };
                        includedGoals.forEach(g => {
                          const src = g.source || "ELCAR";
                          if (bySource[src]) bySource[src].push(g);
                          else bySource["기타"].push(g);
                        });
                        const curriculumMeta = [
                          { src: "ELCAR",   meta: CURR_COLORS.elcar  },
                          { src: "VB-MAPP", meta: CURR_COLORS.vbmapp },
                          { src: "ESDM",    meta: CURR_COLORS.esdm   },
                          { src: "기타",     meta: CURR_COLORS.other  }
                        ];
                        return curriculumMeta.map(({ src, meta }) => {
                          const items = bySource[src];
                          if (items.length === 0) return null;
                          const grouped = {};
                          items.forEach(g => {
                            const key = g.domain || "(영역 없음)";
                            if (!grouped[key]) grouped[key] = [];
                            grouped[key].push(g);
                          });
                          return (
                            <div key={src} style={{ marginBottom: 14, padding: 10, background: meta.bg, border: `2px solid ${meta.accent}`, borderRadius: 8 }}>
                              {/* 커리큘럼 헤더 */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingBottom: 6, borderBottom: `1.5px solid ${meta.accent}` }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: meta.deep }}>● {meta.label} 평가</span>
                                <span style={{ fontSize: 10, fontWeight: 500, color: meta.deep, opacity: 0.8 }}>{items.length}개 목표 · {Object.keys(grouped).length}개 영역</span>
                              </div>
                              {/* 영역별 카드 */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {Object.entries(grouped).map(([domain, domainGoals]) => (
                                  <div key={domain} style={{ background: "#fff", border: `1px solid ${meta.accent}`, borderRadius: 6, padding: "8px 10px" }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: meta.deep, marginBottom: 6 }}>{shortDomain(domain) || domain}</div>
                                    {domainGoals.map(goal => (
                                      <GoalCard key={goal.id} goal={goal} active={activeGoalId === goal.id}
                                        archiveList={effectiveArchiveList}
                                        onToggle={() => setActiveGoalId(activeGoalId === goal.id ? null : goal.id)}
                                        onRemove={() => toggleIepInclude(goal.id)}
                                        onUpdate={patch => updateGoal(goal.id, patch)}
                                        onToggleStatus={toggleStatus}
                                        onSaveCurrentLevel={saveCurrentLevel}
                                        onResetCurrentLevel={resetCurrentLevel}
                                        onSavePromptLevel={saveGoalPromptLevel}
                                        onSavePromptFadingPlan={saveGoalPromptFadingPlan}
                                        onSaveGeneralizationPlan={saveGoalGeneralizationPlan}
                                        onAddTask={addTask}
                                        onToggleTaskActive={toggleTaskActive}
                                        onToggleShowInDaily={toggleShowInDaily} />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                {/* 섹션 B: 영역별 현행수준 편집 — 제거 (IEP 인쇄에 사용되지 않음, 보고서는 자체 로직 사용) */}
                {/* DomainLevelEditor 컴포넌트 정의는 호환성을 위해 남겨둠 */}

                {/* ═ 섹션 C: 초기 관찰 기록 (IEP 평가 결과 및 현행 수준) ═ */}
                <div style={{ ...CS, marginTop: 14, padding: 18, border: `2px solid ${PK}`, borderRadius: 12, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 12, borderBottom: `2px dashed ${PK}` }}>
                    <div style={{ width: 5, height: 28, background: PKD, borderRadius: 3 }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: PKD, letterSpacing: "-0.3px" }}>
                        🔍 초기 관찰 기록 (IEP 평가 결과 및 현행 수준)
                      </h3>
                      <div style={{ fontSize: 12, color: "#777", marginTop: 4, lineHeight: 1.6 }}>
                        평가 회기에서 관찰한 아동의 현재 수행을 6개 카테고리로 작성합니다. <b style={{ color: PKD }}>3단계 버튼 클릭 시 예시 문구가 자동 입력</b>되며, 직접 수정도 가능합니다.
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const categories = [
                      { key: "eyeContact", label: "눈맞춤" },
                      { key: "requesting", label: "요구 표현" },
                      { key: "following", label: "지시 따르기" },
                      { key: "attention", label: "주의 집중" },
                      { key: "imitation", label: "모방 반응" },
                      { key: "selfCare", label: "자기관리" }
                    ];
                    const obs = info.iepObservations || {};
                    const tone = info.iepObservationTone || "improvement";

                    const updateObs = (key, value) => {
                      setInfo(prev => ({
                        ...prev,
                        iepObservations: { ...(prev.iepObservations || {}), [key]: value }
                      }));
                    };
                    const updateTone = (newTone) => {
                      setInfo(prev => ({ ...prev, iepObservationTone: newTone }));
                    };
                    const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
                    const applyPhrase = (key, level) => {
                      const phrase = IEP_OBSERVATION_PHRASES[key]?.[level]?.[tone] || "";
                      if (phrase) {
                        const personalized = personalizeText(phrase, childName);
                        setInfo(prev => ({
                          ...prev,
                          iepObservations: { ...(prev.iepObservations || {}), [key]: personalized },
                          iepObservationLevels: { ...(prev.iepObservationLevels || {}), [key]: level }
                        }));
                      }
                    };

                    return (
                      <>
                        {/* 톤 토글 */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>문장 성격:</span>
                          <button
                            onClick={() => updateTone("strength")}
                            style={{
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 600,
                              border: tone === "strength" ? `2px solid ${PKD}` : "1px solid #ccc",
                              borderRadius: 6,
                              background: tone === "strength" ? PK : "#fff",
                              color: tone === "strength" ? "#fff" : "#666",
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                          >
                            강점 중심
                          </button>
                          <button
                            onClick={() => updateTone("improvement")}
                            style={{
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 600,
                              border: tone === "improvement" ? `2px solid ${PKD}` : "1px solid #ccc",
                              borderRadius: 6,
                              background: tone === "improvement" ? PK : "#fff",
                              color: tone === "improvement" ? "#fff" : "#666",
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                          >
                            보완점 중심
                          </button>
                        </div>

                        {/* 6개 카테고리 카드 (2x3) */}
                        <div className="responsive-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          {categories.map(c => {
                            const value = obs[c.key] || "";
                            const filled = value.trim() !== "";
                            const unlocked = obsEditUnlocked[c.key];
                            return (
                              <div key={c.key} style={{ border: `1px solid ${filled ? PK : "#e8d0d6"}`, borderRadius: 8, overflow: "hidden", background: filled ? "#fff" : "#fafafa" }}>
                                {/* 카테고리 헤더 */}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: filled ? PKL : "#f5f5f5", borderBottom: `1px solid ${filled ? PK : "#e8d0d6"}` }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: filled ? PKD : "#888" }}>{c.label}</span>
                                  {filled && <span style={{ fontSize: 9, padding: "1px 6px", background: PK, color: "#fff", borderRadius: 8, fontWeight: 600 }}>✓ 입력됨</span>}
                                  <button
                                    onClick={() => setObsEditUnlocked(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                                    style={{
                                      fontSize: 9.5, padding: "3px 8px", marginLeft: "auto",
                                      border: `1px solid ${unlocked ? "#4caf50" : PK}`, borderRadius: 6,
                                      background: unlocked ? "#e8f5e9" : "#fff",
                                      color: unlocked ? "#2e7d32" : PKD,
                                      cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                                    }}
                                    title={unlocked ? "수정 완료 (잠금)" : "직접 수정하려면 클릭"}
                                  >
                                    {unlocked ? "✓ 완료" : "✏️ 클릭하여 수정"}
                                  </button>
                                </div>
                                {/* 3단계 버튼 */}
                                <div style={{ display: "flex", gap: 4, padding: "6px 8px", background: "#fafafa", borderBottom: "1px solid #e8d0d6" }}>
                                  {[
                                    { lv: "full", label: "전적 도움" },
                                    { lv: "partial", label: "부분 도움" },
                                    { lv: "independent", label: "자발적 수행" }
                                  ].map(b => (
                                    <button
                                      key={b.lv}
                                      onClick={() => applyPhrase(c.key, b.lv)}
                                      style={{
                                        flex: 1,
                                        padding: "5px 6px",
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        border: `1px solid ${PK}`,
                                        borderRadius: 4,
                                        background: "#fff",
                                        color: PKD,
                                        cursor: "pointer",
                                        transition: "all 0.15s"
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = PKL; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                                      title={`${c.label} - ${b.label} 단계 예시 문구 입력`}
                                    >
                                      {b.label}
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  value={value}
                                  onChange={e => updateObs(c.key, e.target.value)}
                                  readOnly={!unlocked}
                                  placeholder="3단계 버튼을 누르면 예시 문구가 자동 입력됩니다. 직접 입력·수정은 [✏️ 클릭하여 수정] 버튼을 눌러주세요."
                                  rows={5}
                                  style={{
                                    width: "100%",
                                    border: "none",
                                    padding: "10px 12px",
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                    fontFamily: "inherit",
                                    resize: "vertical",
                                    outline: "none",
                                    background: unlocked ? "#fff" : "#fafafa",
                                    color: unlocked ? "#333" : "#555",
                                    cursor: unlocked ? "text" : "default",
                                    boxSizing: "border-box"
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* 종합 결과 - textarea로 직접 수정 가능 + 자동 생성 / 재생성 / 잠금 */}
                        {(() => {
                          const filledCats = categories.filter(c => (obs[c.key] || "").trim() !== "");
                          if (filledCats.length === 0) return null;
                          const levels = info.iepObservationLevels || {};
                          const autoSummary = personalizeText(generateObservationSummary(obs, levels), childName);
                          const override = info.iepObservationSummaryOverride;
                          const hasOverride = override !== null && override !== undefined && override !== "";
                          const displayValue = hasOverride ? override : autoSummary;
                          const hasLevelData = Object.values(levels).some(lv => lv !== null && lv !== "");
                          const summaryUnlocked = obsEditUnlocked.summary;
                          return (
                            <div style={{ marginTop: 14, border: `1.5px solid ${hasOverride ? "#f5b942" : PK}`, borderRadius: 10, overflow: "hidden" }}>
                              <div style={{ padding: "8px 12px", background: hasOverride ? "#fff8ec" : PKL, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: hasOverride ? "#c7860d" : PKD }}>📋 종합 요약</span>
                                {hasOverride
                                  ? <span style={{ fontSize: 9, padding: "2px 6px", background: "#f5b942", color: "#fff", borderRadius: 8, fontWeight: 700 }}>편집됨</span>
                                  : <span style={{ fontSize: 9, padding: "2px 6px", background: PK, color: "#fff", borderRadius: 8, fontWeight: 600 }}>자동 생성</span>
                                }
                                <span style={{ fontSize: 10, padding: "1px 8px", background: "#fff", border: `1px solid ${PK}`, color: PKD, borderRadius: 8, fontWeight: 600, marginLeft: "auto" }}>{filledCats.length}/{categories.length} 작성됨</span>
                                {hasOverride && (
                                  <button onClick={() => {
                                    setInfo(prev => ({ ...prev, iepObservationSummaryOverride: null }));
                                  }}
                                    title="자동 생성 문장으로 되돌리기"
                                    style={{ fontSize: 10, padding: "3px 9px", border: `1px solid #e8d0d6`, borderRadius: 6, background: "#fff", color: "#666", cursor: "pointer", fontFamily: "inherit" }}>
                                    ↺ 자동 재생성
                                  </button>
                                )}
                                <button
                                  onClick={() => setObsEditUnlocked(prev => ({ ...prev, summary: !prev.summary }))}
                                  style={{
                                    fontSize: 10, padding: "3px 10px",
                                    border: `1px solid ${summaryUnlocked ? "#4caf50" : PK}`, borderRadius: 6,
                                    background: summaryUnlocked ? "#e8f5e9" : "#fff",
                                    color: summaryUnlocked ? "#2e7d32" : PKD,
                                    cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                                  }}
                                  title={summaryUnlocked ? "수정 완료 (잠금)" : "직접 수정하려면 클릭"}
                                >
                                  {summaryUnlocked ? "✓ 완료" : "✏️ 클릭하여 수정"}
                                </button>
                              </div>
                              {hasLevelData || hasOverride ? (
                                <textarea
                                  value={displayValue}
                                  onChange={e => setInfo(prev => ({ ...prev, iepObservationSummaryOverride: e.target.value }))}
                                  readOnly={!summaryUnlocked}
                                  rows={5}
                                  style={{
                                    width: "100%", border: "none", padding: "12px 14px",
                                    fontSize: 12, lineHeight: 1.85,
                                    color: summaryUnlocked ? "#333" : "#555",
                                    fontFamily: "inherit", outline: "none", resize: "vertical",
                                    boxSizing: "border-box",
                                    background: summaryUnlocked ? "#fff" : "#fafafa",
                                    cursor: summaryUnlocked ? "text" : "default",
                                    textAlign: "justify"
                                  }}
                                  placeholder="종합 요약을 자유롭게 작성/수정하세요. 인쇄 시 4번 섹션 표 아래에 표시됩니다."
                                />
                              ) : (
                                <div style={{ fontSize: 11, color: "#888", padding: "12px 14px", lineHeight: 1.6, background: "#fafafa" }}>
                                  💡 자동 요약은 [전적 도움 / 부분 도움 / 자발적 수행] 버튼을 눌러 단계 정보를 입력하면 생성됩니다.<br/>
                                  textarea만 직접 편집하신 경우, 요약 생성을 위해 각 영역의 단계 버튼을 한 번 눌러주세요.
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}

                  <div style={{ fontSize: 10, color: "#888", marginTop: 10, padding: "8px 12px", background: "#fdf8f9", borderRadius: 6, borderLeft: `3px solid ${PK}` }}>
                    💡 6개 카테고리는 표준 양식입니다. 톤 토글 변경 후 3단계 버튼 클릭 시 새 문구로 덮어씌워지며, 직접 수정한 내용은 유지됩니다. 빈 칸은 IEP 인쇄물에 "(미입력)"으로 표시됩니다.
                  </div>
                </div>
              </div>
            </div>

            {/* ★ [v19 일관성] IEP 계획안 출력 — 미리보기 + 인쇄 (중간/종결과 동일 패턴) */}
            <div style={{ ...CS, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "linear-gradient(135deg, #fff 0%, #fdf8f9 100%)", border: `2px solid ${PK}`, marginTop: 18, marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: PKD, marginBottom: 3 }}>📄 IEP 계획안 출력</div>
                <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.6 }}>
                  위에서 설정한 IEP 계획안을 출력합니다. 미리보기는 보관 없이 양식만 확인합니다.
                </div>
              </div>
              <button style={{ ...BS, padding: "10px 16px", fontSize: 12, fontWeight: 600 }}
                onClick={() => setView("iep-print")}
                disabled={includedGoals.length === 0}>
                👁 미리보기
              </button>
              <button style={{ ...BP, padding: "10px 22px", fontSize: 13, fontWeight: 700 }}
                onClick={() => {
                  if (includedGoals.length === 0) return;
                  const confirmIepMsg = `📋 IEP 계획안 인쇄하기\n\n다음 작업이 자동으로 진행됩니다:\n  ✓ IEP 계획안이 보관함에 저장됨\n  ✓ 인쇄 미리보기 화면으로 이동\n\n진행하시겠습니까?\n\n(보관 없이 양식만 보려면 [👁 미리보기]를 사용하세요)`;
                  askConfirm(confirmIepMsg, async () => {
                    try {
                      if (!activeChildId || !info?.name?.trim()) {
                        console.warn("[IEP 보관 건너뜀] activeChildId/info.name 없음");
                      } else {
                        const result = await archiveCurrentIep(false);
                        if (!result || (result && result.skipped)) {
                          console.warn("[IEP 보관 건너뜀]", result?.reason || "unknown");
                        }
                      }
                    } catch (e) {
                      console.error("[IEP 보관 오류 - 인쇄는 진행]", e);
                    }
                    setView("iep-print");
                  });
                }}
                disabled={includedGoals.length === 0}>
                🖨 IEP 계획안 인쇄
              </button>
            </div>

            {/* ★ [IEP 신규] IEP 보관함 — 이전 IEP 계획안 비교 */}
            <ArchiveListCard
              list={(visibleArchiveList || []).filter(a => a.isIep)}
              onSave={async () => {
                const result = await archiveCurrentIep(false);
                if (result && result.skipped) {
                  return { skipped: true, reason: result.reason };
                }
                return result;
              }}
              onDelete={async (id) => {
                await handleDeleteArchive(id);
              }}
              onView={(item) => setViewingArchive(item)}
              cutoffDisabled={true}
              setCutoffDisabled={() => {}}
            />

            {/* ★ [v19 신규] 목표 템플릿 라이브러리 */}
            <div style={{ ...CS, background: "#f9f5f7", marginTop: 18, border: `1px solid ${PKL}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: PKD, marginBottom: 12 }}>📋 목표 템플릿 라이브러리</div>
              
              {/* 템플릿 탭 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: `1px solid ${PKL}`, paddingBottom: 10 }}>
                <button
                  onClick={() => setTemplateTab("popular")}
                  style={{
                    fontSize: 11,
                    padding: "6px 12px",
                    background: templateTab === "popular" ? "#fff" : "transparent",
                    border: templateTab === "popular" ? `1px solid ${PKL}` : "none",
                    borderRadius: 6,
                    fontWeight: templateTab === "popular" ? 600 : 500,
                    color: templateTab === "popular" ? PKD : "#888",
                    cursor: "pointer"
                  }}
                >
                  ⭐ 자주 쓰는 목표
                </button>
                <button
                  onClick={() => setTemplateTab("my")}
                  style={{
                    fontSize: 11,
                    padding: "6px 12px",
                    background: templateTab === "my" ? "#fff" : "transparent",
                    border: templateTab === "my" ? `1px solid ${PKL}` : "none",
                    borderRadius: 6,
                    fontWeight: templateTab === "my" ? 600 : 500,
                    color: templateTab === "my" ? PKD : "#888",
                    cursor: "pointer"
                  }}
                >
                  🏷️ 마이 템플릿
                </button>
              </div>

              {/* 템플릿 그리드 */}
              {(() => {
                const popularCategories = ["기본", "행동", "생활", "사회"];
                const filtered = templateTab === "popular"
                  ? templateLibrary.filter(t => popularCategories.includes(t.category))
                  : templateLibrary.filter(t => t.category === "마이");

                if (templateTab === "my" && filtered.length === 0) {
                  return (
                    <div style={{ padding: "32px 14px", textAlign: "center", border: `1px dashed ${PKL}`, borderRadius: 6, background: "#fff", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>🏷️ 마이 템플릿이 비어있습니다</div>
                      <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.6 }}>
                        자주 사용하는 목표를 마이 템플릿에 저장해 두면<br/>
                        다음 아동의 IEP 작성 시 빠르게 재사용할 수 있습니다.
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTemplateModal({ name: "", description: "", domain: "발달 언어" });
                        }}
                        style={{
                          marginTop: 14,
                          fontSize: 11,
                          padding: "8px 16px",
                          background: PK,
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                      >
                        + 새 템플릿 만들기
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
                      {filtered.map(template => (
                        <div key={template.id} style={{
                          background: "#fff",
                          padding: 12,
                          borderRadius: 8,
                          border: `1px solid ${PKL}`,
                          transition: "all 0.2s",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(212,114,138,0.2)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>
                            {template.name}
                          </div>
                          <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>
                            {template.description}
                          </div>
                          <div style={{ fontSize: 9, color: "#aaa", marginTop: "auto" }}>
                            {template.domain}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newGoal = {
                                id: "g_" + Date.now(),
                                domain: template.domain,
                                name: template.name,
                                description: template.description,
                                includeInIep: true,
                                tasks: [{
                                  id: "t_" + Date.now(),
                                  name: template.name,
                                  description: template.description,
                                  isActive: true,
                                  showInDaily: true,
                                  listGroup: "1"
                                }]
                              };
                              setGoals(prev => [...(prev || []), newGoal]);
                              setAutoBackupToast({ message: `✓ "${template.name}" 목표가 추가되었습니다`, type: "success" });
                              setTimeout(() => setAutoBackupToast(null), 2500);
                            }}
                            style={{
                              fontSize: 10,
                              padding: "6px 10px",
                              background: PK,
                              color: "#fff",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontWeight: 600,
                              transition: "opacity 0.2s"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                          >
                            + 추가
                          </button>
                          {/* 마이 템플릿일 때만 삭제 버튼 표시 */}
                          {templateTab === "my" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                askConfirm(`"${template.name}" 마이 템플릿을 삭제할까요?`, () => {
                                  const next = templateLibrary.filter(t => t.id !== template.id);
                                  setTemplateLibrary(next);
                                  try { localStorage.setItem("aba_template_library", JSON.stringify(next)); } catch (e) {}
                                  setAutoBackupToast({ message: `✓ 마이 템플릿이 삭제되었습니다`, type: "success" });
                                  setTimeout(() => setAutoBackupToast(null), 2500);
                                });
                              }}
                              style={{
                                fontSize: 9,
                                padding: "4px 8px",
                                background: "transparent",
                                color: "#aaa",
                                border: `1px solid ${PKL}`,
                                borderRadius: 4,
                                cursor: "pointer",
                                marginTop: 4
                              }}
                            >
                              🗑 삭제
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* 마이 템플릿 탭일 때 추가 버튼 */}
                    {templateTab === "my" && filtered.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTemplateModal({ name: "", description: "", domain: "발달 언어" });
                        }}
                        style={{
                          fontSize: 11,
                          padding: "6px 12px",
                          background: "#fff",
                          color: PKD,
                          border: `1px dashed ${PK}`,
                          borderRadius: 6,
                          cursor: "pointer",
                          fontWeight: 600,
                          marginBottom: 12
                        }}
                      >
                        + 새 마이 템플릿 추가
                      </button>
                    )}
                  </>
                );
              })()}

              <div style={{ fontSize: 10, color: "#888", fontStyle: "italic", padding: "10px", background: "#fff", borderRadius: 6, border: `1px solid ${PKL}` }}>
                💡 자주 쓰는 목표를 한 번에 추가할 수 있습니다. 추가 후 필요에 따라 편집하세요.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
              <button style={BS} onClick={() => setTab("info")}>← 아동정보</button>
              <button style={BP} onClick={() => setTab("daily")} disabled={includedGoals.length === 0}>다음: 데일리 데이터 →</button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 3: 데일리 데이터 (+/- 버튼, 실시간 계산)        */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "daily" && (
          <DailyTab goals={dailyGoals} dailyDate={dailyDate} setDailyDate={setDailyDate}
            calcDayRate={calcDayRate}
            addTask={addTask} removeTask={removeTask} renameTask={renameTask}
            bumpTask={bumpTask} resetTask={resetTask}
            setTaskListGroup={setTaskListGroup}
            setTaskMeasureMode={setTaskMeasureMode}
            setTaskPlannedTrials={setTaskPlannedTrials}
            setTaskTrial={setTaskTrial}
            fillTaskTrials={fillTaskTrials}
            askConfirm={askConfirm}
            askPauseReason={askPauseReason}
            clearPendingNext={clearPendingNext}
            updateGoal={updateGoal}
            dailyMemos={dailyMemos} setDailyMemo={setDailyMemo}
            archiveList={effectiveArchiveList}
            mediaList={info?.mediaList || []}
            setInfo={setInfo}
            addHistory={addHistory}
            onPrev={() => setTab("iep")} onNext={() => setTab("report")} />
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 4: 중간/종결 보고서                              */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "report" && (
          <ReportTab 
            currentUser={currentUser}
            info={effectiveInfo} goals={includedGoals} currentAvgs={currentAvgs} baselineAvgs={baselineAvgs}
            domainLevelOverrides={domainLevelOverrides}
            getTimeline={getTimeline}
            stosForReport={stosForReport}
            goalsForReport={goalsForReport}
            askConfirm={askConfirm}
            reportFields={reportFields}
            reportSelStrats={reportSelStrats}
            reportSelStratsCustom={reportSelStratsCustom}
            reportSelPrein={reportSelPrein}
            reportSelSrein={reportSelSrein}
            reportReinfSchedule={reportReinfSchedule}
            reportBehaviors={reportBehaviors}
            reportSections={reportSections}
            dailyMemos={dailyMemos}
            setReportField={setReportField}
            setReportPatch={setReportPatch}
            setInfo={setInfo}
            archiveList={archiveList}
            cutoffDisabled={cutoffDisabled}
            setCutoffDisabled={setCutoffDisabled}
            reportMode={reportMode}
            setReportMode={setReportMode}
            onArchiveSave={() => archiveCurrentReport(false)}
            onArchiveDelete={handleDeleteArchive}
            onArchiveView={(item) => setViewingArchive(item)}
            onPrev={() => setTab("daily")}
            onPreview={() => {
              setView("print");
            }}
            onPrint={() => {
              if (reportMode === "final") {
                const confirmFinalMsg = `🎓 종결보고서 양식으로 인쇄하기\n\n다음 작업이 자동으로 진행됩니다:\n  ✓ 종결보고서가 보관함에 저장됨\n  ✓ 그래프 컷오프는 적용되지 않음 (전체 기간 데이터 유지)\n  ✓ 다음 차수 시작일은 그대로 유지\n\n진행하시겠습니까?\n\n(보관 없이 양식만 보려면 [👁 미리보기]를 사용하세요)`;
                askConfirm(confirmFinalMsg, async () => {
                  try {
                    if (!activeChildId || !info?.name?.trim()) {
                      console.warn("[종결보관 건너뜀] activeChildId/info.name 없음");
                    } else {
                      const result = await archiveCurrentReport(false, true);
                      if (result && result.id) {
                        alert("✅ 종결보고서가 보관함에 저장되었습니다.");
                      }
                    }
                  } catch (e) {
                    console.error("[종결보관 오류 - 인쇄는 진행]", e);
                    alert("보관 중 오류가 있었지만 인쇄는 계속 진행됩니다.\n오류: " + (e?.message || String(e)));
                  }
                  setView("print");
                });
                return;
              }
              const confirmMsg = `📄 중간보고서 양식으로 인쇄하기\n\n다음 작업이 자동으로 진행됩니다:\n  ✓ 현재 보고서가 보관함에 저장됨\n  ✓ 그래프에 컷오프 적용 (이전 데이터는 보관함에서 확인)\n  ✓ 다음 차수 시작일이 자동 갱신됨 (오늘+1)\n\n진행하시겠습니까?\n\n(보관 없이 양식만 보려면 [👁 미리보기]를 사용하세요)`;
              askConfirm(confirmMsg, async () => {
                try {
                  if (!activeChildId || !info?.name?.trim()) {
                    console.warn("[보관 건너뜀] activeChildId/info.name 없음");
                  } else {
                    const result = await archiveCurrentReport(true);
                    if (result && result.id) {
                      if (result.overwrite) {
                      } else {
                        alert("✅ 보고서가 보관함에 저장되었습니다.");
                      }
                    } else if (result === null) {
                      console.warn("[보관 실패] saveArchiveItem이 null 반환 (storage 쓰기 실패 가능)");
                    }
                  }
                } catch (e) {
                  console.error("[보관 오류 - 인쇄는 진행]", e);
                  alert("보관 중 오류가 있었지만 인쇄는 계속 진행됩니다.\n오류: " + (e?.message || String(e)));
                }
                setView("print");
              });
            }} />
        )}
      </div>

      {/* ═══ 외부 목표 추가 모달 ═══ */}
      {showExtForm && (
        <ExternalGoalModal
          extForm={extForm}
          setExtForm={setExtForm}
          onClose={() => setShowExtForm(false)}
          onSubmit={() => {
            addExternalGoal(extForm);
            setExtForm({ source: extForm.source, domain: extForm.domain, subDomain: "", item: "" });
          }}
          onSubmitAndClose={() => {
            addExternalGoal(extForm);
            setExtForm({ source: "기타", domain: "", subDomain: "", item: "" });
            setShowExtForm(false);
          }}
        />
      )}

      {/* ═══ W-35: 보관된 보고서 미리보기 모달 ═══ */}
      {viewingArchive && (
        <ArchiveViewModal
          item={viewingArchive}
          onClose={() => setViewingArchive(null)}
        />
      )}

      {/* ═══ 아동 추가 모달 ═══ */}
      {showAddChildModal && (
        <AddChildModal
          name={newChildName}
          setName={setNewChildName}
          onClose={() => setShowAddChildModal(false)}
          onSubmit={() => {
            const trimmed = (newChildName || "").trim();
            if (!trimmed) return;
            addChild(trimmed);
            setNewChildName("");
            setShowAddChildModal(false);
            setTab("info");  // 새 아동은 아동정보 탭부터 시작
          }}
        />
      )}

      {/* ═══ 자체 확인 모달 (window.confirm 차단 환경 대응) ═══ */}
      {confirmDialog && (
        <div
          onClick={() => setConfirmDialog(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, maxWidth: 420, width: "100%", padding: "22px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: `2px solid ${PK}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: PKD, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span>확인</span>
            </div>
            <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 18, whiteSpace: "pre-line" }}>
              {confirmDialog.message}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ padding: "8px 18px", border: "1.5px solid #ddd", background: "#fff", color: "#666", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                취소
              </button>
              <button
                onClick={() => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  if (typeof cb === "function") cb();
                }}
                style={{ padding: "8px 18px", border: "none", background: PK, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 중단 사유 입력 모달 (R-2) ═══ */}
      {pauseReasonDialog && <PauseReasonModalInline dialog={pauseReasonDialog} setDialog={setPauseReasonDialog} />}

      {/* ═══ [신규] 담당 선생님 선택 모달 (관리자가 아동 추가 시) ═══ */}
      {assignOwnerDialog && (
        <div
          onClick={() => setAssignOwnerDialog(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, maxWidth: 440, width: "100%", padding: "22px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: `2px solid ${PK}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PKD, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>👥</span>
              <span>담당 선생님 선택</span>
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
              <b style={{ color: PKD }}>{assignOwnerDialog.childName}</b> 아동을 누가 담당하시나요?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
              {/* 1. 본인(관리자) */}
              <button
                onClick={() => assignOwnerDialog.onSelect(currentUser?.name || "")}
                style={{ padding: "10px 14px", border: `2px solid ${PK}`, background: PKL, color: PKD, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>👑</span>
                <span>{currentUser?.name} (본인 · 관리자)</span>
              </button>

              {/* 2. 등록된 선생님 목록 */}
              {teachers && teachers.length > 0 && teachers
                .filter(t => t.name !== currentUser?.name)  // 본인 중복 제외
                .map(t => (
                  <button
                    key={t.id}
                    onClick={() => assignOwnerDialog.onSelect(t.name)}
                    style={{ padding: "10px 14px", border: "1.5px solid #ddd", background: "#fff", color: "#444", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = PK; e.currentTarget.style.background = PKL; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#ddd"; e.currentTarget.style.background = "#fff"; }}>
                    <span style={{ fontSize: 16 }}>👤</span>
                    <span>{t.name} 선생님</span>
                  </button>
                ))
              }

              {/* 3. 미할당 옵션 */}
              <button
                onClick={() => assignOwnerDialog.onSelect("")}
                style={{ padding: "10px 14px", border: "1.5px dashed #bbb", background: "#fafafa", color: "#888", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>❓</span>
                <span>나중에 지정 (미할당)</span>
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setAssignOwnerDialog(null)}
                style={{ padding: "8px 18px", border: "1.5px solid #ddd", background: "#fff", color: "#666", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ [신규] 아카이브 후보 모달 (관리자만) ═══ */}
      {showArchiveCandidates && (
        <div
          onClick={() => setShowArchiveCandidates(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, maxWidth: 560, width: "100%", maxHeight: "85vh", overflow: "auto", padding: "22px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: "2px solid #f59e0b" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🗄️</span>
              <span>보관 후보 아동 ({archiveCandidates.length}명)</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#666", marginBottom: 14, lineHeight: 1.6, padding: "8px 10px", background: "#fff8e1", borderRadius: 6 }}>
              종결 후 <b>3개월 이상</b> 경과한 아동입니다. 보관함으로 이동하면 메인 목록에서 숨겨지고, 데이터는 그대로 보존됩니다.<br/>
              "보관 아동 보기" 토글로 언제든 다시 확인할 수 있어요.
            </div>

            {archiveCandidates.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 12 }}>
                현재 보관 후보 아동이 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {archiveCandidates.map(c => {
                  const endDate = c.info?.finalEndDate;
                  const end = endDate ? new Date(endDate) : null;
                  const daysSince = end && !isNaN(end.getTime())
                    ? Math.floor((new Date() - end) / (1000 * 60 * 60 * 24))
                    : 0;
                  return (
                    <div key={c.id}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "1px solid #ffe0b2", borderRadius: 8, background: "#fff" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>
                          {c.info?.name || "이름없음"}
                          {c.info?.ownerName && (
                            <span style={{ fontSize: 10.5, color: "#888", fontWeight: 500, marginLeft: 6 }}>
                              · {c.info.ownerName} 선생님 담당
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#92400e", marginTop: 2 }}>
                          종결일: {endDate} · <b>{daysSince}일 경과</b>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          askConfirm(`'${c.info?.name || "이름없음"}' 아동을 보관함으로 이동하시겠습니까?`, () => archiveChild(c.id));
                        }}
                        style={{ padding: "7px 14px", border: "1.5px solid #f59e0b", background: "#fff8e1", color: "#92400e", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        🗄️ 보관
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "#888" }}>
                💡 보관 후에도 "보관 아동 보기"에서 복구 가능합니다
              </div>
              <button
                onClick={() => setShowArchiveCandidates(false)}
                style={{ padding: "8px 18px", border: "1.5px solid #ddd", background: "#fff", color: "#666", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 마이 템플릿 생성 모달 (v19) ═══ */}
      {templateModal && (
        <div
          onClick={() => setTemplateModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, maxWidth: 460, width: "100%", padding: "22px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: `2px solid ${PK}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PKD, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🏷️</span>
              <span>새 마이 템플릿 만들기</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>이름 <span style={{ color: PKD }}>*</span></label>
              <input
                type="text"
                autoFocus
                value={templateModal.name}
                onChange={(e) => setTemplateModal({ ...templateModal, name: e.target.value })}
                placeholder="예: 🎯 우리 센터 표준 모방"
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${PKL}`, borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>설명</label>
              <input
                type="text"
                value={templateModal.description}
                onChange={(e) => setTemplateModal({ ...templateModal, description: e.target.value })}
                placeholder="예: 신체 모방 5종 학습"
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${PKL}`, borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>영역</label>
              <select
                value={templateModal.domain}
                onChange={(e) => setTemplateModal({ ...templateModal, domain: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${PKL}`, borderRadius: 6, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}
              >
                <option value="발달 언어">발달 언어</option>
                <option value="행동 관리">행동 관리</option>
                <option value="생활 기술">생활 기술</option>
                <option value="사회성">사회성</option>
                <option value="학습">학습</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setTemplateModal(null)}
                style={{ padding: "8px 18px", border: "1.5px solid #ddd", background: "#fff", color: "#666", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmedName = (templateModal.name || "").trim();
                  if (!trimmedName) {
                    setAutoBackupToast({ message: "⚠️ 이름을 입력해주세요", type: "error" });
                    setTimeout(() => setAutoBackupToast(null), 2500);
                    return;
                  }
                  const newTpl = {
                    id: "t_my_" + Date.now(),
                    name: trimmedName,
                    description: (templateModal.description || "").trim(),
                    domain: (templateModal.domain || "발달 언어").trim(),
                    category: "마이"
                  };
                  const next = [...templateLibrary, newTpl];
                  setTemplateLibrary(next);
                  try { localStorage.setItem("aba_template_library", JSON.stringify(next)); } catch (e) {}
                  setTemplateModal(null);
                  setTemplateTab("my");  // 마이 템플릿 탭으로 전환
                  setAutoBackupToast({ message: `✓ "${trimmedName}" 마이 템플릿이 추가되었습니다`, type: "success" });
                  setTimeout(() => setAutoBackupToast(null), 2500);
                }}
                style={{ padding: "8px 18px", border: "none", background: PK, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PauseReasonModalInline({ dialog, setDialog }) {
  const [reason, setReason] = useState("");
  const QUICK_REASONS = [
    "일반화 어려움",
    "선행 기술 부족",
    "아동 컨디션 변화",
    "가정 환경 변화",
    "우선순위 조정",
    "도구·자료 부족"
  ];
  const PK_LOCAL = "#e88baa";
  const PKD_LOCAL = "#b85878";

  const handleQuickClick = (text) => {
    if (reason.includes(text)) return;
    setReason(prev => prev ? `${prev}, ${text}` : text);
  };

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    const cb = dialog.onSubmit;
    setDialog(null);
    if (typeof cb === "function") cb(trimmed);
  };

  const handleClose = () => {
    setDialog(null);
  };

  return (
    <div
      onClick={handleClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, maxWidth: 480, width: "100%", padding: "22px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: `2px solid #f5b942` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#a87108", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>⏸</span>
          <span>과제 중단 — 사유 입력</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#888", marginBottom: 14 }}>
          <b style={{ color: "#666" }}>'{dialog.taskName}'</b>{withParticle(dialog.taskName, "을", "를")} 중단합니다. 사유는 중간보고서에 자동 반영됩니다.
        </div>

        {/* 자주 쓰는 사유 퀵 버튼 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#767676", marginBottom: 5, fontWeight: 600 }}>빠른 선택 (클릭하여 추가)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {QUICK_REASONS.map(q => (
              <button
                key={q}
                onClick={() => handleQuickClick(q)}
                style={{ fontSize: 10.5, padding: "4px 9px", border: "1px solid #e0c060", borderRadius: 14, background: "#fffaee", color: "#8a6020", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                + {q}
              </button>
            ))}
          </div>
        </div>

        {/* 사유 textarea */}
        {/* U-B: autoFocus 추가 — 모달 열리면 즉시 입력 가능 (마우스 클릭 불필요) */}
        {/* U-A: label 추가 + htmlFor 연결 */}
        <label htmlFor="pause-reason-text" style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8a6020", marginBottom: 4 }}>
          중단 사유 <span style={{ color: RED }}>*</span>
        </label>
        <textarea
          id="pause-reason-text"
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="중단 사유를 입력하세요 (필수). 예: 일반화 어려움 — 가정에서는 수행하지 못함"
          rows={3}
          style={{
            width: "100%", padding: "8px 10px",
            border: "1.5px solid #e0c060", borderRadius: 8,
            fontSize: 12, fontFamily: "inherit", color: "#333",
            resize: "vertical", outline: "none", boxSizing: "border-box"
          }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={handleClose}
            style={{ padding: "8px 18px", border: "1.5px solid #ddd", background: "#fff", color: "#666", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim()}
            style={{
              padding: "8px 18px", border: "none",
              background: reason.trim() ? "#d4a740" : "#eee",
              color: reason.trim() ? "#fff" : "#aaa",
              borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: reason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit"
            }}>
            중단 확정
          </button>
        </div>
      </div>
    </div>
  );
}

function AddChildModal({ name, setName, onClose, onSubmit }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const canSubmit = (name || "").trim().length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(40, 20, 30, 0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
        animation: "fadeIn 0.15s ease"
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 440,
          boxShadow: "0 20px 60px rgba(212, 114, 138, 0.3), 0 0 0 1px rgba(245,160,177,0.2)",
          animation: "slideUp 0.2s ease",
          fontFamily: "'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif"
        }}>
        {/* 헤더 */}
        <div style={{
          background: `linear-gradient(135deg, ${PK} 0%, ${PKD} 100%)`,
          color: "#fff", padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderRadius: "16px 16px 0 0"
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" }}>👶 새 아동 등록</div>
            <div style={{ fontSize: 11, opacity: 0.88, marginTop: 3 }}>별도의 IEP · 데이터 시트 · 보고서가 새로 생성됩니다</div>
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 8, fontSize: 16, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
            title="닫기 (ESC)">✕</button>
        </div>

        {/* 바디 */}
        <div style={{ padding: "22px 24px" }}>
          {/* U-A: label-input 연결로 스크린리더 매칭 */}
          <label htmlFor="addchild-name" style={{ ...LS, fontSize: 11, fontWeight: 600, color: "#555" }}>
            아동 이름 <span style={{ color: RED }}>*</span>
          </label>
          <input
            id="addchild-name"
            style={{ ...IS, padding: "10px 14px", fontSize: 14 }}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && canSubmit) onSubmit(); }}
            placeholder="예: 조은우, 김민준"
            autoFocus />
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 6, lineHeight: 1.6 }}>
            💡 생년월일·담당 치료사 등 자세한 정보는 등록 후 <b style={{ color: PKD }}>[① 아동정보]</b> 탭에서 편집할 수 있습니다.
          </div>

          <div style={{ padding: "10px 14px", background: "#fdf8f9", borderRadius: 8, border: `1px solid ${PKL}`, marginTop: 14, fontSize: 10.5, color: "#666", lineHeight: 1.7 }}>
            <b style={{ color: PKD }}>아동별 독립 데이터:</b> 각 아동은 <b>IEP 목표 · 데일리 기록 · 현행수준 · 보고서</b>를 별도로 저장하며, 상단 탭을 클릭해 즉시 전환할 수 있습니다.
          </div>

          {/* 푸터 */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button onClick={onClose} style={{ ...BS, fontSize: 12, padding: "8px 16px" }}>취소</button>
            <button onClick={onSubmit} disabled={!canSubmit}
              style={{ ...BP, fontSize: 12, padding: "8px 18px", opacity: canSubmit ? 1 : 0.4, fontWeight: 600 }}>
              + 등록하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExternalGoalModal({ extForm, setExtForm, onClose, onSubmit, onSubmitAndClose }) {
  const canSubmit = extForm.item.trim() && extForm.domain.trim();

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sourceColor = { bg: "#f0f0f0", fg: "#666" };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(40, 20, 30, 0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
        padding: 20,
        animation: "fadeIn 0.15s ease"
      }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(212, 114, 138, 0.3), 0 0 0 1px rgba(245,160,177,0.2)",
          animation: "slideUp 0.2s ease",
          fontFamily: "'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif"
        }}>
        {/* 헤더 */}
        <div style={{
          background: `linear-gradient(135deg, ${PK} 0%, ${PKD} 100%)`,
          color: "#fff", padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderRadius: "16px 16px 0 0"
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" }}>기타 영역 추가</div>
            <div style={{ fontSize: 11, opacity: 0.88, marginTop: 3 }}>커리큘럼에 없는 목표를 직접 입력해 통합 바구니에 담습니다</div>
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 8, fontSize: 16, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
            title="닫기 (ESC)">✕</button>
        </div>

        {/* 바디 */}
        <div style={{ padding: "22px 24px" }}>

          {/* 영역 + 세부영역 */}
          {/* U-A: 3개 input 모두 label-id 연결 */}
          <div className="responsive-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label htmlFor="extgoal-domain" style={{ ...LS, fontSize: 11, fontWeight: 600, color: "#555" }}>
                영역 <span style={{ color: RED }}>*</span>
              </label>
              <input
                id="extgoal-domain"
                style={{ ...IS, padding: "9px 12px", fontSize: 13 }}
                value={extForm.domain}
                onChange={e => setExtForm(f => ({ ...f, domain: e.target.value }))}
                placeholder="예: 언어 영역, 사회성 영역" />
            </div>
            <div>
              <label htmlFor="extgoal-subdomain" style={{ ...LS, fontSize: 11, fontWeight: 600, color: "#555" }}>세부영역 (선택)</label>
              <input
                id="extgoal-subdomain"
                style={{ ...IS, padding: "9px 12px", fontSize: 13 }}
                value={extForm.subDomain}
                onChange={e => setExtForm(f => ({ ...f, subDomain: e.target.value }))}
                placeholder="예: 레벨 2, 단계 1" />
            </div>
          </div>

          {/* 목표 내용 */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="extgoal-item" style={{ ...LS, fontSize: 11, fontWeight: 600, color: "#555" }}>
              목표 내용 <span style={{ color: RED }}>*</span>
            </label>
            <input
              id="extgoal-item"
              style={{ ...IS, padding: "10px 14px", fontSize: 14 }}
              value={extForm.item}
              onChange={e => setExtForm(f => ({ ...f, item: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "Enter" && canSubmit) {
                  if (e.shiftKey) { onSubmit(); } else { onSubmitAndClose(); }
                }
              }}
              placeholder="예: 형용사 포함 Mand 10가지 자발"
              autoFocus />
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 6, lineHeight: 1.5 }}>
              💡 <kbd style={{ padding: "1px 5px", background: "#f5f5f5", borderRadius: 3, fontSize: 9.5, border: "1px solid #ddd" }}>Enter</kbd> 추가 후 닫기 &nbsp;·&nbsp;
              <kbd style={{ padding: "1px 5px", background: "#f5f5f5", borderRadius: 3, fontSize: 9.5, border: "1px solid #ddd" }}>Shift</kbd> + <kbd style={{ padding: "1px 5px", background: "#f5f5f5", borderRadius: 3, fontSize: 9.5, border: "1px solid #ddd" }}>Enter</kbd> 추가하고 계속 입력
            </div>
          </div>

          {/* 미리보기 */}
          {(extForm.item.trim() || extForm.domain.trim()) && (
            <div style={{ padding: "10px 14px", background: "#fdf8f9", borderRadius: 8, border: `1px dashed ${PK}`, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: PKD, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>👁 미리보기</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, padding: "2px 6px", background: sourceColor.bg, color: sourceColor.fg, borderRadius: 8, fontWeight: 600 }}>{extForm.source}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", background: PK, color: "#fff", borderRadius: 10, fontWeight: 500 }}>{extForm.domain.trim() || "영역?"}</span>
                {extForm.subDomain.trim() && <span style={{ fontSize: 10, color: "#767676" }}>{extForm.subDomain.trim()}</span>}
                <span style={{ fontSize: 12, color: "#333", fontWeight: 500 }}>{extForm.item.trim() || "목표 내용을 입력하세요..."}</span>
              </div>
            </div>
          )}

          {/* 푸터 - 액션 버튼 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 6, borderTop: `1px solid ${PKL}`, marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "#aaa" }}>
              ESC로 닫기
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ ...BS, fontSize: 12, padding: "8px 16px" }}>취소</button>
              <button onClick={onSubmit} disabled={!canSubmit}
                style={{ ...BS, fontSize: 12, padding: "8px 16px", opacity: canSubmit ? 1 : 0.4 }}>
                + 추가 후 계속
              </button>
              <button onClick={onSubmitAndClose} disabled={!canSubmit}
                style={{ ...BP, fontSize: 12, padding: "8px 18px", opacity: canSubmit ? 1 : 0.4, fontWeight: 600 }}>
                추가하고 닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchiveViewModal({ item, onClose }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!item?.id) { setLoading(false); return; }
    setLoading(true);
    loadArchiveItem(item.id).then(s => {
      if (!cancelled) {
        setSnapshot(s);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [item?.id]);

  const sections = snapshot?.reportSections || {};
  const has4 = sections["종합 현황"] || sections["이번 기간의 성장과 변화"] || sections["가정에서 함께 하기"] || sections["다음 목표"];
  const sectionOrder = has4
    ? ["종합 현황", "이번 기간의 성장과 변화", "가정에서 함께 하기", "다음 목표"]
    : ["아동의 현행 상황 – 언어", "아동의 현행 상황 – 사회성", "아동의 현행 상황 – 문제행동 / 주의 집중", "아동의 현행 상황 – 교수 참여도 및 반응성", "아동의 현행 상황 – 최근 변화", "총괄 요약 및 권고사항", "일반화 계획 및 가정 협력 방안", "다음 목표 제안"];

  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("ko-KR");
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 0, maxWidth: 800, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
        {/* 헤더 */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #f0e0e5", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: PKD, marginBottom: 4 }}>📁 {item.title || `${item.period} - ${item.order}차`}</div>
            <div style={{ fontSize: 11, color: "#888" }}>
              {snapshot?.childName} · 저장: {fmtTime(item.savedAt)}
              {item.auto && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "#e6f1fb", color: "#185fa5" }}>자동 보관</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "#bbb", cursor: "pointer", padding: 0, lineHeight: 1, marginLeft: 12 }}>×</button>
        </div>
        {/* 본문 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {loading && <div style={{ padding: 30, textAlign: "center", color: "#999" }}>불러오는 중...</div>}
          {!loading && !snapshot && <div style={{ padding: 30, textAlign: "center", color: "#a85020" }}>스냅샷을 불러올 수 없습니다.</div>}
          {!loading && snapshot && (
            <>
              {/* 기본 정보 요약 */}
              {snapshot.info && (
                <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fdf8f9", borderRadius: 8, fontSize: 11, color: "#555", lineHeight: 1.7 }}>
                  <b style={{ color: PKD }}>아동:</b> {snapshot.info.name || "—"}{snapshot.info.birth ? ` (${snapshot.info.birth})` : ""}
                  {snapshot.info.therapist && <> · <b style={{ color: PKD }}>치료사:</b> {snapshot.info.therapist}</>}
                  {(() => {
                    const ps = snapshot.info.evalStart || snapshot.info.pStart || "";
                    const pe = snapshot.info.evalEnd || snapshot.info.pEnd || "";
                    if (!ps && !pe) return null;
                    return <><br /><b style={{ color: PKD }}>기간:</b> {ps || "—"} ~ {pe || "—"}</>;
                  })()}
                  {snapshot.info.sWeek && <> · <b style={{ color: PKD }}>치료 강도:</b> 주 {snapshot.info.sWeek}회 × {snapshot.info.sMin || "—"}분 (총 {snapshot.info.sTotal || "—"}세션)</>}
                </div>
              )}
              {/* 영역별 평균 */}
              {Array.isArray(snapshot.domainAvgs) && snapshot.domainAvgs.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: PKD, marginBottom: 6 }}>📊 영역별 평균 (당시)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {snapshot.domainAvgs.map((d, i) => (
                      <div key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "#fdf8f9", border: "1px solid #f0e0e5", color: "#666" }}>
                        {d.short || d.domain}: <b style={{ color: d.avg >= 80 ? "#27500a" : d.avg >= 50 ? "#185fa5" : "#a85020" }}>{d.avg}%</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 본문 섹션들 */}
              {(() => {
                const snapInfo = snapshot?.info || {};
                const snapChildName = snapInfo.fn || nameWithSuffix(stripSurname(snapInfo.name || "")) || "아동";
                return sectionOrder.map(key => {
                  const body = sections[key];
                  if (!body || !String(body).trim()) return null;
                  const personalized = personalizeText(String(body), snapChildName);
                  const personalizedKey = personalizeText(key, snapChildName);
                  return (
                    <div key={key} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: "1px dashed #e8d8de" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: PKD, marginBottom: 6 }}>{personalizedKey}</div>
                      <div style={{ fontSize: 11.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-wrap" }}>{personalized}</div>
                    </div>
                  );
                });
              })()}
              {/* 보고서가 비어있을 때 */}
              {!sectionOrder.some(k => sections[k] && String(sections[k]).trim()) && (
                <div style={{ padding: 30, textAlign: "center", color: "#999", fontSize: 12 }}>저장된 본문이 비어있습니다.</div>
              )}
              {/* FBA + 중재 전략 + 강화제 (있으면) */}
              {Array.isArray(snapshot.reportBehaviors) && snapshot.reportBehaviors.length > 0 && snapshot.reportBehaviors.some(b => b.name) && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "#fdf8f9", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: PKD, marginBottom: 6 }}>⚠️ 문제행동 (당시)</div>
                  {snapshot.reportBehaviors.filter(b => b.name).map((b, i) => (
                    <div key={i} style={{ fontSize: 10.5, color: "#555", marginBottom: 3 }}>
                      <b>{b.name}</b>{b.severity ? ` · ${b.severity}` : ""}{b.intervention ? ` · 중재: ${b.intervention === "__custom__" ? b.interventionCustom : b.intervention}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {/* 푸터 */}
        <div style={{ padding: "12px 22px", borderTop: "1px solid #f0e0e5", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={BS}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function DomainLevelEditor({ includedGoals, overrides, setOverrides }) {
  const grouped = useMemo(() => {
    const m = {};
    includedGoals.forEach(g => {
      if (!m[g.domain]) m[g.domain] = [];
      m[g.domain].push(g);
    });
    return m;
  }, [includedGoals]);

  return (
    <div style={{
      ...CS,
      marginTop: 18,
      padding: "20px 22px",
      background: "linear-gradient(135deg, #fdf8f9 0%, #fff 50%, #fff8ec 100%)",
      border: `2.5px solid ${PK}`,
      borderRadius: 16
    }}>
      {/* 강조 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 12, borderBottom: `2px dashed ${PK}` }}>
        <div style={{ width: 5, height: 28, background: PKD, borderRadius: 3 }} />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: PKD, letterSpacing: "-0.3px" }}>
            📝 영역별 현행 수준 편집
          </h3>
          <div style={{ fontSize: 12, color: "#777", marginTop: 4, lineHeight: 1.6 }}>
            각 영역의 초안이 자동 생성되어 있습니다. <b style={{ color: PKD }}>textarea에 수정하면 타이핑 멈춘 뒤 자동 저장</b>되며, <b>IEP 계획안 인쇄물과 중간보고서에 즉시 반영</b>됩니다.
          </div>
        </div>
        <div style={{ padding: "6px 12px", background: PKL, color: PKD, borderRadius: 8, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
          {Object.keys(grouped).length}개 영역
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div style={{ padding: "30px 20px", textAlign: "center", fontSize: 12, color: "#aaa", border: `1px dashed ${PK}`, borderRadius: 10, background: "#fff" }}>
          아직 IEP에 포함된 목표가 없어 영역별 현행 수준을 생성할 수 없습니다.<br/>
          위에서 <b style={{ color: PKD }}>"+ IEP에 추가"</b>로 목표를 먼저 편입시켜 주세요.
        </div>
      )}

      {Object.entries(grouped).map(([domain, items]) => {
        const hasOverride = overrides[domain] !== undefined && overrides[domain] !== null && overrides[domain] !== "";
        const autoText = generatePLPText(domain, items);
        return (
          <div key={domain} style={{
            border: `2px solid ${hasOverride ? "#f5b942" : "#f0e0e5"}`,
            borderRadius: 12,
            marginBottom: 14,
            overflow: "hidden",
            boxShadow: hasOverride ? "0 3px 10px rgba(245,185,66,0.12)" : "0 2px 6px rgba(0,0,0,0.03)",
            background: "#fff"
          }}>
            {/* 영역 이름 헤더 (기본 펼침, 접기 기능 없음) */}
            <div style={{
              padding: "12px 16px",
              background: hasOverride ? "linear-gradient(90deg, #fff8ec 0%, #fff 100%)" : "linear-gradient(90deg, #fdf8f9 0%, #fff 100%)",
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              borderBottom: `1px solid ${hasOverride ? "#f5d182" : "#f0e0e5"}`
            }}>
              <div style={{ width: 6, height: 24, background: hasOverride ? "#f5b942" : PK, borderRadius: 3 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: hasOverride ? "#c7860d" : PKD, letterSpacing: "-0.2px" }}>
                {domain}
              </span>
              <span style={{ fontSize: 10, padding: "3px 9px", background: PK, color: "#fff", borderRadius: 10, fontWeight: 700 }}>
                {items.length}개 목표
              </span>
              {hasOverride
                ? <span style={{ fontSize: 10, padding: "3px 10px", background: "#f5b942", color: "#fff", borderRadius: 10, fontWeight: 700 }}>✏️ 편집됨</span>
                : <span style={{ fontSize: 10, padding: "3px 10px", background: PKL, color: PKD, borderRadius: 10, fontWeight: 700 }}>🤖 자동 생성</span>}
              {!hasOverride && <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>✏️ 클릭하여 수정</span>}
            </div>

            {/* 편집 영역 (항상 펼침) */}
            <DomainLevelEditInline
              domain={domain}
              autoText={autoText}
              override={overrides[domain]}
              onSave={(text) => setOverrides(prev => ({ ...prev, [domain]: text }))}
              onReset={() => setOverrides(prev => {
                const next = { ...prev };
                delete next[domain];
                return next;
              })} />
          </div>
        );
      })}
    </div>
  );
}

function DomainLevelEditInline({ domain, autoText, override, onSave, onReset }) {
  const hasOverride = override !== undefined && override !== null && override !== "";
  const [text, setText] = useState(hasOverride ? override : autoText);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const saveTimerRef = useRef(null);
  const savedJustNowTimerRef = useRef(null);

  useEffect(() => {
    if (!hasOverride) setText(autoText);
  }, [autoText, domain]);

  useEffect(() => {
    if (hasOverride) setText(override);
  }, [override]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedJustNowTimerRef.current) clearTimeout(savedJustNowTimerRef.current);
    };
  }, []);

  const handleChange = (newText) => {
    setText(newText);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (newText === autoText) {
        onReset && onReset();
      } else {
        onSave(newText);
      }
      setSavedJustNow(true);
      if (savedJustNowTimerRef.current) clearTimeout(savedJustNowTimerRef.current);
      savedJustNowTimerRef.current = setTimeout(() => setSavedJustNow(false), 1800);
    }, 600);
  };

  return (
    <div style={{ background: "#fff" }}>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={9}
        placeholder="이 영역의 현행 수준을 자유롭게 작성하세요. 타이핑 멈추면 자동 저장됩니다."
        style={{
          width: "100%", border: "none",
          padding: "16px 20px",
          fontSize: 13.5, lineHeight: 1.9, color: "#333",
          fontFamily: "inherit", outline: "none", resize: "vertical",
          boxSizing: "border-box", background: "#fff",
          minHeight: 200
        }}
      />
      <div style={{
        padding: "10px 16px",
        background: savedJustNow ? "#eaf3de" : "#fafafa",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
        borderTop: `1px solid ${savedJustNow ? "#cde0b2" : "#f0e0e5"}`,
        fontSize: 11,
        transition: "background 0.3s ease"
      }}>
        <div style={{ color: "#777", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500 }}>💡 타이핑 후 자동 저장 · IEP 계획안·중간보고서에 즉시 반영</span>
          {savedJustNow && (
            <span style={{ padding: "3px 10px", background: GREEN, color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 10.5 }}>
              ✓ 저장됨
            </span>
          )}
          {hasOverride && !savedJustNow && (
            <span style={{ padding: "3px 10px", background: "#fff8ec", color: "#a87108", border: "1px solid #f5d182", borderRadius: 12, fontWeight: 700, fontSize: 10.5 }}>
              ✏️ 편집됨 (저장 완료)
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {hasOverride && (
            <button onClick={() => { onReset(); setText(autoText); }}
              style={{ fontSize: 10.5, padding: "5px 12px", border: `1px solid #e8d0d6`, borderRadius: 7, background: "#fff", color: "#666", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              ↺ 자동 재생성으로 복원
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ListGroupSegment({ value, onChange }) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        display: "inline-flex", alignItems: "center",
        background: "#fff", border: `1.5px solid ${PK}`,
        borderRadius: 14, padding: 2, fontFamily: "inherit"
      }}>
      {["1", "2"].map(v => (
        <button key={v}
          onClick={e => { e.stopPropagation(); onChange(v); }}
          title={v === "1" ? "현재 진행 과제로 분류" : "습득 완료로 분류"}
          style={{
            padding: "3px 10px",
            border: "none",
            borderRadius: 10,
            background: value === v ? PK : "transparent",
            color: value === v ? "#fff" : PKD,
            fontSize: 10, fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit"
          }}>
          L{v}
        </button>
      ))}
    </div>
  );
}

function StatusToggle({ status, locked, onToggle }) {
  const isMastered = status === "mastered";
  return (
    <div
      role="switch"
      tabIndex={0}
      aria-checked={isMastered}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      onClick={onToggle}
      title={locked ? "수동 설정됨 — 자동 전환되지 않음" : "자동 판정 모드 — '2일 연속 80% 이상' 시 자동 전환"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        cursor: "pointer",
        userSelect: "none",
        background: isMastered ? "#e6f3d8" : "#fdf1f3",
        border: `1.5px solid ${isMastered ? GREEN : PK}`,
        borderRadius: 20,
        padding: "2px",
        position: "relative",
        width: 96,
        fontFamily: "inherit"
      }}>
      <span style={{
        position: "absolute",
        top: 2, left: isMastered ? "calc(100% - 48px - 2px)" : 2,
        width: 48, height: 22,
        background: isMastered ? GREEN : PK,
        borderRadius: 14,
        transition: "left 0.2s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", width: "100%",
        fontSize: 9.5, fontWeight: 700
      }}>
        <div style={{ flex: 1, textAlign: "center", padding: "5px 0", color: !isMastered ? "#fff" : "#aaa" }}>
          진행{!isMastered && locked && " 🔒"}
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: "5px 0", color: isMastered ? "#fff" : "#aaa" }}>
          습득{isMastered && locked && " 🔒"}
        </div>
      </div>
    </div>
  );
}

function AddTaskInline({ goalId, onAdd }) {
  const [name, setName] = useState("");
  const handleAdd = () => {
    const n = name.trim();
    if (!n || !onAdd) return;
    onAdd(goalId, n);
    setName("");
  };
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "4px 0" }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        placeholder="새 세부 과제 입력 (예: 사과)"
        style={{ flex: 1, padding: "6px 10px", border: `1px dashed ${PK}`, borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", outline: "none", background: "#fff" }}
      />
      <button
        onClick={handleAdd}
        disabled={!name.trim()}
        style={{ padding: "6px 14px", background: name.trim() ? PK : "#eee", color: name.trim() ? "#fff" : "#999", border: "none", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: name.trim() ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        ＋ 추가
      </button>
    </div>
  );
}

function GoalCard({ goal, active, onToggle, onRemove, onUpdate, onToggleStatus, onSaveCurrentLevel, onResetCurrentLevel, onSavePromptLevel, onSavePromptFadingPlan, onSaveGeneralizationPlan, onAddTask, onToggleTaskActive, onToggleShowInDaily, archiveList }) {
  const { vbmapp, esdm, source } = goal;

  const recommendedVbList = useMemo(() => {
    if (!vbmapp) return [];
    const recs = VBMAPP_RECOMMEND[vbmapp.v];
    if (!recs) return [];
    return recs[vbmapp.lv] || recs[1] || recs[2] || recs[3] || [];
  }, [vbmapp]);

  const recommendedEsdmList = useMemo(() => {
    if (!esdm) return [];
    return ESDM_GOALS[esdm.v] || [];
  }, [esdm]);

  const autoCurrentLevel = useMemo(() => generateCurrentLevel(goal), [goal]);
  const rationaleText = useMemo(() => generateRationale(goal), [goal]);

  const hasOverride = goal.currentLevelOverride !== null && goal.currentLevelOverride !== undefined && goal.currentLevelOverride !== "";
  const [editingLevel, setEditingLevel] = useState(hasOverride ? goal.currentLevelOverride : autoCurrentLevel);

  useEffect(() => {
    setEditingLevel(hasOverride ? goal.currentLevelOverride : autoCurrentLevel);
  }, [goal.id, goal.currentLevelOverride]);

  useEffect(() => {
    if (!hasOverride) setEditingLevel(autoCurrentLevel);
  }, [autoCurrentLevel]);

  const latestRate = useMemo(() => {
    const calcDayRate = calcDayRateGlobal;
    const taskLatests = [];
    (goal.tasks || []).forEach(t => {
      const daily = t.daily || {};
      const dates = Object.keys(daily).sort();
      for (let i = dates.length - 1; i >= 0; i--) {
        const r = calcDayRate(daily[dates[i]], t.plannedTrials);
        if (r !== null) { taskLatests.push(r); break; }
      }
    });
    if (taskLatests.length > 0) {
      return Math.round(taskLatests.reduce((a, b) => a + b, 0) / taskLatests.length);
    }
    const oldDaily = goal.daily || {};
    const oldDates = Object.keys(oldDaily).sort();
    for (let i = oldDates.length - 1; i >= 0; i--) {
      const r = calcDayRate(oldDaily[oldDates[i]]);
      if (r !== null) return r;
    }
    return null;
  }, [goal.daily, goal.tasks]);

  const rateColor = latestRate === null ? "#ccc"
    : latestRate >= 80 ? GREEN
    : latestRate >= 50 ? BLUE
    : latestRate >= 20 ? ORANGE : RED;

  const sourceBadge = source === "VB-MAPP" ? { bg: "#e6f1fb", fg: "#2a6cb2" }
    : source === "ESDM" ? { bg: "#eaf3de", fg: "#4a7316" }
    : source === "기타" ? { bg: "#f0f0f0", fg: "#666" }
    : { bg: PKL, fg: PKD };  // ELCAR 기본

  return (
    <div style={{ border: `1px solid ${active ? PK : "#f0e0e5"}`, borderRadius: 12, marginBottom: 10, overflow: "hidden", background: active ? "#fefafb" : "#fff" }}>
      {/* 헤더 — U-C-1: 키보드 접근 가능 (role=button + Enter/Space) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={active}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        onClick={onToggle}
        style={{ display: "grid", gridTemplateColumns: "auto minmax(180px, 1fr) auto auto", gap: 10, padding: "10px 14px", alignItems: "center", cursor: "pointer", background: active ? PKL : "#fff" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {/* 커리큘럼 뱃지 제거 — 박스 헤더 "● {커리큘럼} 평가"와 정보 중복 */}
          <span style={{ fontSize: 10, padding: "3px 8px", background: PK, color: "#fff", borderRadius: 10, whiteSpace: "nowrap", fontWeight: 500 }}>{shortDomain(goal.domain)}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#333", textDecoration: goal.status === "mastered" ? "line-through" : "none", textDecorationColor: GREEN, textDecorationThickness: 1.5, wordBreak: "keep-all", overflowWrap: "break-word" }}>{goal.item}</span>
            {goal.status === "mastered" && (
              <span style={{ fontSize: 9, padding: "2px 7px", background: GREEN, color: "#fff", borderRadius: 8, fontWeight: 700, whiteSpace: "nowrap" }}>✓ 습득 완료</span>
            )}
            {/* ★ 보고서 발행 표시 — 마스터된 영역목표가 보관본에 포함되었으면 라벨 추가 */}
            {goal.status === "mastered" && (() => {
              const taskDates = (goal.tasks || []).map(t => t.masteredAt).filter(Boolean).sort();
              const completedAt = (taskDates.length > 0 ? taskDates[taskDates.length - 1] : null) || goal.masteredAt;
              const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
              if (!completedAt || cutoffArchives.length === 0) return null;
              const sorted = [...cutoffArchives].sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));
              let publishedAt = null;
              for (const arch of sorted) {
                if (arch.savedAt && arch.savedAt.slice(0, 10) >= completedAt) {
                  publishedAt = arch.savedAt.slice(0, 10);
                  break;
                }
              }
              if (!publishedAt) return null;
              return (
                <span style={{ fontSize: 9, padding: "2px 7px", background: "#eff5fc", color: "#1d4d80", borderRadius: 8, fontWeight: 600, border: "1px solid #b9d4ee", whiteSpace: "nowrap" }} title={`이 영역목표는 ${publishedAt} 발행 보고서에 포함되었습니다`}>
                  📤 {publishedAt} 보고서 발행
                </span>
              );
            })()}
            {goal.status !== "mastered" && (() => {
              const pausedTaskCount = (goal.tasks || []).filter(t => t.listGroup === "paused").length;
              if (pausedTaskCount === 0) return null;
              return (
                <span style={{ fontSize: 9, padding: "2px 7px", background: "#a87108", color: "#fff", borderRadius: 8, fontWeight: 700, whiteSpace: "nowrap" }}>⏸ 중단 {pausedTaskCount}개</span>
              );
            })()}
            {/* ★ 중단 영역목표에도 보고서 발행 표시 — 가장 늦은 pausedAt이 보관본보다 이전 */}
            {goal.status !== "mastered" && (() => {
              const pausedTasks = (goal.tasks || []).filter(t => t.listGroup === "paused");
              if (pausedTasks.length === 0) return null;
              const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
              if (cutoffArchives.length === 0) return null;
              const pausedDates = pausedTasks.map(t => t.pausedAt).filter(Boolean).sort();
              if (pausedDates.length === 0) return null;
              const earliestPausedAt = pausedDates[0]; // 가장 빨리 중단된 것
              const sorted = [...cutoffArchives].sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));
              let publishedAt = null;
              for (const arch of sorted) {
                if (arch.savedAt && arch.savedAt.slice(0, 10) >= earliestPausedAt) {
                  publishedAt = arch.savedAt.slice(0, 10);
                  break;
                }
              }
              if (!publishedAt) return null;
              return (
                <span style={{ fontSize: 9, padding: "2px 7px", background: "#eff5fc", color: "#1d4d80", borderRadius: 8, fontWeight: 600, border: "1px solid #b9d4ee", whiteSpace: "nowrap" }} title={`이 영역목표의 중단된 과제는 ${publishedAt} 발행 보고서에 포함되었습니다`}>
                  📤 {publishedAt} 보고서 발행
                </span>
              );
            })()}
            {/* ★ 재실시 표시 — 재실시(resumedAt)이 가장 최근 보관본 이후면 */}
            {goal.status !== "mastered" && (() => {
              const resumedTasks = (goal.tasks || []).filter(t => t.resumedAt && (t.listGroup || "1") === "1");
              if (resumedTasks.length === 0) return null;
              const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
              if (cutoffArchives.length === 0) return null;
              const latestArchive = cutoffArchives[0];
              if (!latestArchive.savedAt) return null;
              const archiveDate = latestArchive.savedAt.slice(0, 10);
              const recentResumed = resumedTasks.filter(t => t.resumedAt > archiveDate);
              if (recentResumed.length === 0) return null;
              const earliestResume = recentResumed.map(t => t.resumedAt).sort()[0];
              return (
                <span style={{ fontSize: 9, padding: "2px 7px", background: "#fef0e0", color: "#a85020", borderRadius: 8, fontWeight: 600, border: "1px solid #f5c08a", whiteSpace: "nowrap" }} title={`${archiveDate} 보고서 발행 후 ${earliestResume}에 재실시됨 (${recentResumed.length}개 과제)`}>
                  🔄 {earliestResume} 재실시
                </span>
              );
            })()}
          </div>
          {/* W-24: VB/ESDM 뱃지를 제목 아래 영역으로 이동 (이전엔 별도 grid 컬럼) — 시트 버튼 위치 통일 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#aaa" }}>
              {goal.subDomain}
              {goal.listName && <span style={{ marginLeft: 6, color: PKD, fontWeight: 500 }}>· {goal.listName}</span>}
            </span>
            {vbmapp && <span style={{ fontSize: 9, padding: "2px 6px", background: "#e6f1fb", color: "#2a6cb2", borderRadius: 8, fontWeight: 500, whiteSpace: "nowrap" }}>VB: {vbmapp.v} L{vbmapp.lv}</span>}
            {esdm && <span style={{ fontSize: 9, padding: "2px 6px", background: "#eaf3de", color: "#4a7316", borderRadius: 8, fontWeight: 500, whiteSpace: "nowrap" }}>ESDM: {esdm.v}</span>}
          </div>
          {/* 중단 사유 표시 — paused task가 있으면 사유 콤마로 나열 */}
          {goal.status !== "mastered" && (() => {
            const reasons = (goal.tasks || [])
              .filter(t => t.listGroup === "paused" && t.pauseReason && t.pauseReason.trim())
              .map(t => t.pauseReason.trim());
            const uniqueReasons = [...new Set(reasons)];
            if (uniqueReasons.length === 0) return null;
            return (
              <div style={{ fontSize: 9.5, color: "#8a6020", marginTop: 3, lineHeight: 1.45 }}>
                <span style={{ fontWeight: 700 }}>중단 사유:</span> {uniqueReasons.join(" · ")}
              </div>
            );
          })()}
        </div>
        {/* "최근 N%" 표시 — 제거 (교사용 IEP, 진행률은 ③ 데일리 탭에서 확인) */}
        {/* (과제 개수 뱃지는 Step 2에서 제거됨 — 세부 과제 관리는 [③ 데일리] 탭에서) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={e => { e.stopPropagation(); onToggleShowInDaily && onToggleShowInDaily(goal.id); }}
            title={goal.showInDaily ? "데이터 시트에서 제외" : "데이터 시트에 추가 — ③ 데일리 탭에 표시됨"}
            style={{
              fontSize: 9.5, padding: "3px 8px",
              background: goal.showInDaily ? "#eaf3de" : "#fff",
              color: goal.showInDaily ? "#4a7316" : "#999",
              border: `1.5px solid ${goal.showInDaily ? "#9bc26b" : "#e0e0e0"}`,
              borderRadius: 8, fontWeight: 700, whiteSpace: "nowrap",
              cursor: "pointer", fontFamily: "inherit"
            }}>
            {goal.showInDaily ? "📋 시트 ON" : "📋 시트 OFF"}
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(); }} title="IEP에서 제외 (목표 자체는 유지됨)" style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
        </div>
      </div>

      {/* 상세 */}
      {active && (
        <div style={{ padding: "14px 16px", borderTop: "1px solid #f0e0e5" }}>

          {/* (데이터 시트 추가 스위치는 헤더 우측으로 이동됨) */}

          {/* (세부 과제 목록 박스는 Step 2에서 제거됨 — 과제 추가·편집은 [③ 데일리] 탭에서만) */}

          {/* (현행 수준 메모 input은 사용자 요청으로 UI만 제거됨 — note 필드는 유지, 기존 메모는 자동 문장에 괄호로 덧붙어 표시됨) */}

          {/* "현행 수준 문장" 박스 — 제거 (IEP 인쇄에 사용되지 않음 — currentLevelOverride 데이터 필드는 호환성 위해 남겨둠) */}

          {/* 추천 영역 — VB-MAPP/ESDM 매핑이 있을 때만 렌더 (둘 다 없으면 영역 통째 안 뜸) */}
          {(vbmapp || esdm) && (
            <div style={{ display: "grid", gridTemplateColumns: vbmapp && esdm ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
              {/* VB-MAPP 추천 (매핑 있을 때만) */}
              {vbmapp && (
                <div style={{ background: "#f5f9fc", border: "1px solid #d8e4ef", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#2a6cb2", marginBottom: 6 }}>🧠 VB-MAPP 추천 마일스톤</div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>영역: <b>{vbmapp.v}</b> · 레벨 <b>{vbmapp.lv}</b></div>
                  {recommendedVbList.length === 0 ? <div style={{ fontSize: 11, color: "#aaa" }}>추천 항목 없음</div>
                    : <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#555", lineHeight: 1.7 }}>
                        {recommendedVbList.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>}
                </div>
              )}

              {/* ESDM 추천 (매핑 있을 때만) */}
              {esdm && (
                <div style={{ background: "#f7faf1", border: "1px solid #d9e5c4", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#4a7316", marginBottom: 6 }}>🌱 ESDM 추천 발달 목표</div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>발달 영역: <b>{esdm.v}</b> · {esdm.lv}</div>
                  {recommendedEsdmList.length === 0 ? <div style={{ fontSize: 11, color: "#aaa" }}>추천 항목 없음</div>
                    : <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#555", lineHeight: 1.7 }}>
                        {recommendedEsdmList.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>}
                </div>
              )}
            </div>
          )}

          {/* (교수방법 / 숙달기준 / 일반화 전략 UI는 Step 2에서 제거됨 — 데이터 필드는 기본값 유지, 인쇄물엔 기본값으로 계속 표시. 교수방법 선택은 [④ 중간보고서]의 전략 체크로 일원화) */}

          {/* "목표 설정 사유" 자동 생성 박스 — 제거 (IEP 인쇄 6번 섹션 제거 후 화면에만 표시되어 시각적 잡음) */}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// 영역별 진전도 추이 차트 (시간축 다중 꺾은선)
// series: [{ domain, color, points: [{date, rate}] }]
// ───────────────────────────────────────────────
function DomainTrendChart({ series }) {
  if (!series || series.length === 0) return null;
  const allDates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))].sort();
  if (allDates.length < 2) {
    return (
      <div style={{ padding: "28px 20px", textAlign: "center", color: "#9a9a9a", fontSize: 12.5, lineHeight: 1.7, background: "#fafafa", borderRadius: 10 }}>
        추이를 그리려면 최소 2개 이상의 날짜에 데이터가 필요합니다.<br />
        <span style={{ color: "#bbb" }}>데일리 데이터를 더 입력하면 영역별 변화가 선으로 표시됩니다.</span>
      </div>
    );
  }
  // 넉넉한 여백
  const W = 600, H = 300, padL = 44, padR = 18, padT = 24, padB = 52;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xFor = (i) => padL + (allDates.length === 1 ? plotW / 2 : (i / (allDates.length - 1)) * plotW);
  const yFor = (rate) => padT + plotH - (Math.max(0, Math.min(100, rate)) / 100) * plotH;
  const dateIndex = Object.fromEntries(allDates.map((d, i) => [d, i]));
  const fmtDate = (d) => { const p = (d || "").split("-"); return p.length >= 3 ? `${Number(p[1])}/${Number(p[2])}` : d; };
  const labelStep = Math.max(1, Math.ceil(allDates.length / 6));

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto", display: "block", margin: "0 auto" }}>
        {/* 가로 기준선 — 아주 연하게, 100/50/0만 살짝 진하게 */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line
              x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)}
              stroke={v === 0 ? "#e3e3e3" : "#f2f2f2"} strokeWidth="1"
            />
            <text x={padL - 9} y={yFor(v) + 3.5} fontSize="9.5" fill="#bcbcbc" textAnchor="end" fontFamily="inherit">{v}</text>
          </g>
        ))}
        {/* x축 날짜 라벨 — 솎아내고 연하게 */}
        {allDates.map((d, i) => (i % labelStep === 0 || i === allDates.length - 1) && (
          <text key={d} x={xFor(i)} y={H - padB + 18} fontSize="9.5" fill="#aeaeae" textAnchor="middle" fontFamily="inherit">{fmtDate(d)}</text>
        ))}
        {/* 각 영역의 꺾은선 — 선이 주인공 */}
        {series.map((s, si) => {
          const pts = s.points
            .filter(p => p.date in dateIndex)
            .sort((a, b) => dateIndex[a.date] - dateIndex[b.date]);
          if (pts.length === 0) return null;
          const path = pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${xFor(dateIndex[p.date]).toFixed(1)} ${yFor(p.rate).toFixed(1)}`).join(" ");
          return (
            <g key={si}>
              <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
              {pts.map((p, idx) => (
                <circle key={idx} cx={xFor(dateIndex[p.date])} cy={yFor(p.rate)} r="2.2" fill="#fff" stroke={s.color} strokeWidth="1.6" />
              ))}
            </g>
          );
        })}
      </svg>
      {/* 범례 — 정돈된 칩 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", marginTop: 12 }}>
        {series.map((s, si) => (
          <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#6b6b6b" }}>
            <span style={{ width: 9, height: 9, background: s.color, borderRadius: "50%", display: "inline-block" }} />
            {s.domain}
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ data }) {
  if (data.length === 0) return <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#aaa" }}>데이터 없음</div>;
  const splitLabel = (lbl) => {
    if (!lbl) return [""];
    if (lbl.length <= 10) return [lbl];
    const spIdx = lbl.indexOf(" ", 6);
    const brIdx = lbl.indexOf("(", 4);
    const splitIdx = brIdx > 0 && brIdx < 12 ? brIdx : spIdx > 0 ? spIdx : -1;
    if (splitIdx > 0) return [lbl.substring(0, splitIdx).trim(), lbl.substring(splitIdx).trim()];
    const mid = Math.ceil(lbl.length / 2);
    return [lbl.substring(0, mid), lbl.substring(mid)];
  };
  const W = 1000, H = 560, cx = W / 2, cy = H / 2, r = 180, n = data.length;
  const pts = data.map((d, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const ratio = d.avg / 100;
    return {
      x: cx + r * ratio * Math.cos(a),
      y: cy + r * ratio * Math.sin(a),
      lx: cx + (r + 45) * Math.cos(a),
      ly: cy + (r + 45) * Math.sin(a),
      label: d.domain,
      angle: a
    };
  });
  const poly = pts.map(p => `${p.x},${p.y}`).join(" ");
  const target = data.map((_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${cx + r * .8 * Math.cos(a)},${cy + r * .8 * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
      {[.25, .5, .75, 1].map(sc => (
        <polygon key={sc} points={data.map((_, i) => {
          const a = (Math.PI * 2 * i) / n - Math.PI / 2;
          return `${cx + r * sc * Math.cos(a)},${cy + r * sc * Math.sin(a)}`;
        }).join(" ")} fill="none" stroke="#e8e8e8" strokeWidth="0.6" />
      ))}
      <polygon points={target} fill="none" stroke="#639922" strokeWidth="1.2" strokeDasharray="4,4" opacity=".5" />
      <polygon points={poly} fill="rgba(245,160,177,0.14)" stroke={PK} strokeWidth="2" />
      {pts.map((p, i) => {
        const deg = (p.angle * 180 / Math.PI + 360) % 360;
        const anchor = deg > 90 && deg < 270 ? "end" : deg === 90 || deg === 270 ? "middle" : "start";
        const textAnchor = anchor === "middle" ? "middle" : anchor;
        const lines = splitLabel(p.label);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke={PK} strokeWidth="2.5" />
            {lines.length === 1 ? (
              <text x={p.lx} y={p.ly} textAnchor={textAnchor} dominantBaseline="middle" fontSize="19" fill="#444" fontWeight="500">{lines[0]}</text>
            ) : (
              <g>
                <text x={p.lx} y={p.ly - 11} textAnchor={textAnchor} dominantBaseline="middle" fontSize="17" fill="#444" fontWeight="500">{lines[0]}</text>
                <text x={p.lx} y={p.ly + 11} textAnchor={textAnchor} dominantBaseline="middle" fontSize="17" fill="#444" fontWeight="500">{lines[1]}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function BarChart({ data }) {
  if (data.length === 0) return <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#aaa" }}>데이터 없음</div>;
  const W = 780, labelW = 280, barAreaW = W - labelW - 60, rowH = 26, gap = 5;
  const H = data.length * (rowH + gap) + 20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
      {data.map((d, i) => {
        const y = 10 + i * (rowH + gap);
        const w = (d.avg / 100) * barAreaW;
        const c = d.avg >= 80 ? "#7BA05B" : d.avg >= 60 ? "#6E97B8" : "#D6A45C";
        return (
          <g key={i}>
            {/* 영역명 라벨 (왼쪽 280px) - 28글자까지 풀 표시 */}
            <text x={labelW - 12} y={y + rowH / 2 + 4} textAnchor="end" fontSize="12" fill="#333" fontWeight="500">
              {d.domain.length > 28 ? d.domain.substring(0, 27) + "…" : d.domain}
            </text>
            {/* 배경 막대 (회색 트랙) */}
            <rect x={labelW} y={y + 4} width={barAreaW} height={rowH - 8} fill="#F5F5F5" rx="4" />
            {/* 실제 막대 */}
            <rect x={labelW} y={y + 4} width={w} height={rowH - 8} fill={c} rx="4" opacity=".88" />
            {/* 퍼센트 텍스트 (막대 끝) */}
            <text x={labelW + w + 8} y={y + rowH / 2 + 4} fontSize="12" fill="#333" fontWeight="700">{d.avg}%</text>
          </g>
        );
      })}
    </svg>
  );
}

function VbmappGrid({ goals }) {
  const domainNames = VBMAPP_GRID_DATA.domains;
  if (!domainNames || domainNames.length === 0) {
    return <div style={{ padding: 14, textAlign: "center", fontSize: 12, color: "#aaa" }}>VB-MAPP 데이터 없음</div>;
  }
  const filled = {};
  domainNames.forEach(d => { filled[d] = { 1: new Set(), 2: new Set(), 3: new Set() }; });
  (goals || []).forEach(g => {
    const tasks = g.tasks || [];
    tasks.forEach(t => {
      const isMastered = t.listGroup === "2";
      if (!isMastered) return;
      const domClean = (g.domain || "").replace(/^[Ⅰ-Ⅺ]\s*/, "").trim();
      let directMatch = null;
      for (const dn of domainNames) {
        if (domClean.includes(dn)) { directMatch = dn; break; }
      }
      if (directMatch && filled[directMatch]) {
        let lv = 1;
        const nm = t.name || "";
        if (/L1|레벨\s*1|Level\s*1/i.test(nm) || /\(0-18/.test(nm)) lv = 1;
        else if (/L2|레벨\s*2|Level\s*2/i.test(nm) || /\(18-30/.test(nm)) lv = 2;
        else if (/L3|레벨\s*3|Level\s*3/i.test(nm) || /\(30-48/.test(nm)) lv = 3;
        const slots = filled[directMatch][lv];
        const base = (lv - 1) * 5;
        for (let n = base + 1; n <= base + 5; n++) {
          if (!slots.has(n)) { slots.add(n); break; }
        }
        return;
      }
      const mapping = findVbmappGridMapping(domClean, t.name, t.id || g.id);
      if (mapping && filled[mapping.domain]) {
        const slots = filled[mapping.domain][mapping.lv];
        const base = (mapping.lv - 1) * 5;
        for (let n = base + 1; n <= base + 5; n++) {
          if (!slots.has(n)) { slots.add(n); break; }
        }
      }
    });
  });
  const hasData = domainNames.some(d => filled[d][1].size > 0 || filled[d][2].size > 0 || filled[d][3].size > 0);
  if (!hasData) {
    return <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: "#aaa" }}>
      VB-MAPP 격자에 표시할 완료 마일스톤이 없습니다.<br />
      <span style={{ fontSize: 10 }}>(IEP 목표를 '습득 완료'로 이동하면 자동 반영됩니다)</span>
    </div>;
  }
  const lvBg = [
    { bg: "#FEFAF6", dot: "#C28258", border: "#FBDBC6" },  // L1 살구
    { bg: "#FCF9FE", dot: "#9B7BBF", border: "#E8D7F2" },  // L2 라벤더
    { bg: "#FEFAF0", dot: "#B8924B", border: "#F7DDB0" },  // L3 머스타드
  ];
  const lvHeaderBg = ["#FBDBC6", "#E8D7F2", "#F7DDB0"];
  const cellSz = 22;
  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table className="vbmapp-grid" style={{ borderCollapse: "collapse", fontSize: 10, border: "1.5px solid #b8a8b0", margin: "0 auto" }}>
        <thead>
          <tr>
            <th style={{ padding: "4px 8px", border: "1px solid #e0d0d6", background: "#fdf8f9", textAlign: "left", fontSize: 9, minWidth: 140, position: "sticky", left: 0, zIndex: 1 }}>영역</th>
            <th colSpan={5} style={{ padding: 3, border: "1px solid #e0d0d6", background: lvHeaderBg[0], textAlign: "center", fontSize: 8, color: "#8B5A2B" }}>Level 1 (1-5)</th>
            <th colSpan={5} style={{ padding: 3, border: "1px solid #e0d0d6", background: lvHeaderBg[1], textAlign: "center", fontSize: 8, color: "#7A5BA0" }}>Level 2 (6-10)</th>
            <th colSpan={5} style={{ padding: 3, border: "1px solid #e0d0d6", background: lvHeaderBg[2], textAlign: "center", fontSize: 8, color: "#9E7836" }}>Level 3 (11-15)</th>
          </tr>
        </thead>
        <tbody>
          {domainNames.map(d => (
            <tr key={d}>
              <td style={{ padding: "2px 8px", border: "1px solid #e0d0d6", fontSize: 9, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", position: "sticky", left: 0, background: "#fff", zIndex: 1, width: 140, minWidth: 140, maxWidth: 140 }}>
                {d}
              </td>
              {[0, 1, 2].map(li => [1, 2, 3, 4, 5].map(n => {
                const num = li * 5 + n;
                const isFilled = filled[d][li + 1].has(num);
                return (
                  <td key={`v${li + 1}_${n}`} style={{
                    padding: 0, border: "1px solid #e0d0d6", textAlign: "center",
                    background: isFilled ? lvBg[li].bg : "#fff",
                    width: cellSz, height: cellSz, minWidth: cellSz, maxWidth: cellSz,
                  }}>
                    {isFilled ? <span style={{ fontSize: 12, color: lvBg[li].dot, fontWeight: 700 }}>●</span> : ""}
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#888", flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
        <span><span style={{ display: "inline-block", width: 12, height: 10, background: lvHeaderBg[0], borderRadius: 2, marginRight: 3, border: "1px solid #ead8a0" }} />Level 1 (0-18개월)</span>
        <span><span style={{ display: "inline-block", width: 12, height: 10, background: lvHeaderBg[1], borderRadius: 2, marginRight: 3, border: "1px solid #c4b0d6" }} />Level 2 (18-30개월)</span>
        <span><span style={{ display: "inline-block", width: 12, height: 10, background: lvHeaderBg[2], borderRadius: 2, marginRight: 3, border: "1px solid #d4b888" }} />Level 3 (30-48개월)</span>
        <span style={{ color: "#C28258" }}>● 마일스톤 달성</span>
      </div>
    </div>
  );
}

function PrintView({ info, goals, domainAvgs, domainLevelOverrides, reportSections, reportSelStrats, reportSelStratsCustom, reportSelPrein, reportSelSrein, reportReinfSchedule, reportBehaviors, stosForReport, goalsForReport, archiveList, dailyMemos, mode, onBack }) {
  const isIepMode = mode === "iep";
  const isFinalMode = mode === "final";  // ★ 종결보고서 모드
  const grouped = useMemo(() => {
    const m = {};
    goals.forEach(g => {
      if (!m[g.domain]) m[g.domain] = [];
      m[g.domain].push(g);
    });
    return m;
  }, [goals]);

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const year = new Date().getFullYear();

  let _sectionCounter = 0;
  const nextSn = () => String(++_sectionCounter);

  return (
    <div style={{ fontFamily: "'Malgun Gothic','Noto Sans KR','Pretendard',sans-serif", background: "#f5f5f5", minHeight: "100vh", padding: "20px 0" }}>
      {/* 화면 상단 컨트롤 바 (인쇄 시 숨김) */}
      <div className="no-print" style={{ maxWidth: 860, margin: "0 auto 16px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fff", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", flexWrap: "wrap", gap: 8 }}>
        <button style={BS} onClick={onBack}>← 편집 화면으로</button>
        <div className="hide-on-mobile" style={{ fontSize: 12, color: "#888" }}>A4 세로 · PDF 공문서 양식</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={BP} onClick={() => {
            try {
              const el = document.getElementById("printable-report");
              if (!el) { alert("인쇄 영역을 찾을 수 없습니다."); return; }

              const cloned = el.cloneNode(true);

              cloned.querySelectorAll(".no-print").forEach(n => n.remove());

              cloned.querySelectorAll("[contenteditable]").forEach(n => n.removeAttribute("contenteditable"));

              cloned.querySelectorAll("svg").forEach(svg => {
                if (svg.classList.contains("dashboard-sparkline")) {
                  svg.style.setProperty("width", "72px", "important");
                  svg.style.setProperty("height", "22px", "important");
                  svg.style.setProperty("min-width", "72px", "important");
                  svg.style.setProperty("max-width", "72px", "important");
                  svg.style.setProperty("display", "inline-block", "important");
                  return;
                }
                if (svg.classList.contains("dashboard-bigchart")) {
                  svg.style.setProperty("width", "290px", "important");
                  svg.style.setProperty("height", "80px", "important");
                  svg.style.setProperty("max-width", "100%", "important");
                  svg.style.setProperty("display", "block", "important");
                  svg.style.setProperty("margin", "0 auto", "important");
                  return;
                }
                svg.style.minWidth = "0";
                svg.style.width = "100%";
                svg.style.maxWidth = "100%";
              });

              cloned.querySelectorAll("div").forEach(div => {
                if (div.style.overflowX === "auto" || div.style.overflowX === "scroll") {
                  div.style.overflowX = "visible";
                  div.style.overflow = "visible";
                }
              });

              cloned.querySelectorAll("table").forEach(tbl => {
                tbl.querySelectorAll("td,th").forEach(cell => {
                  const w = cell.style.width;
                  if (w === "20px" || w === "20") {
                    cell.style.width = "12px";
                    cell.style.height = "16px";
                    cell.style.minWidth = "12px";
                    cell.style.maxWidth = "12px";
                    cell.style.padding = "0";
                    cell.style.fontSize = "7pt";
                  }
                });
                const rows = tbl.querySelectorAll("tbody tr");
                if (rows.length >= 10) {
                  tbl.classList.add("vbmapp-grid");
                  tbl.style.setProperty("border", "1.5px solid #666", "important");
                  tbl.style.setProperty("border-collapse", "collapse", "important");
                  tbl.style.setProperty("-webkit-print-color-adjust", "exact", "important");
                  tbl.style.setProperty("print-color-adjust", "exact", "important");
                  tbl.querySelectorAll("td,th").forEach(c => {
                    c.style.setProperty("border-top", "1px solid #888", "important");
                    c.style.setProperty("border-right", "1px solid #888", "important");
                    c.style.setProperty("border-bottom", "1px solid #888", "important");
                    c.style.setProperty("border-left", "1px solid #888", "important");
                    c.style.setProperty("-webkit-print-color-adjust", "exact", "important");
                    c.style.setProperty("print-color-adjust", "exact", "important");
                  });
                  rows.forEach(row => {
                    const firstTd = row.querySelector("td");
                    if (firstTd && firstTd.style.minWidth === "140px") {
                      firstTd.style.width = "200px";
                      firstTd.style.maxWidth = "200px";
                      firstTd.style.minWidth = "200px";
                      firstTd.style.whiteSpace = "nowrap";
                      firstTd.style.overflow = "hidden";
                      firstTd.style.textOverflow = "ellipsis";
                      firstTd.style.wordBreak = "normal";
                      firstTd.style.fontSize = "9pt";
                      firstTd.style.padding = "3px 8px";
                      firstTd.style.setProperty("border-right", "1.5px solid #555", "important");
                    }
                  });
                  const headerThs = tbl.querySelectorAll("thead th[colspan='5']");
                  headerThs.forEach(th => {
                    th.style.fontSize = "8pt";
                    th.style.padding = "3px";
                  });
                  const firstHeaderTh = tbl.querySelector("thead tr:last-child th:first-child") || tbl.querySelector("thead th:first-child");
                  if (firstHeaderTh) {
                    firstHeaderTh.style.width = "200px";
                    firstHeaderTh.style.minWidth = "200px";
                    firstHeaderTh.style.maxWidth = "200px";
                    firstHeaderTh.style.fontSize = "9pt";
                    firstHeaderTh.style.padding = "3px 8px";
                    firstHeaderTh.style.setProperty("border-right", "1.5px solid #555", "important");
                  }
                  tbl.querySelectorAll("thead th").forEach(th => {
                    th.style.setProperty("border-bottom", "1.5px solid #555", "important");
                  });
                }
              });

              const cleanedHTML = cloned.innerHTML;
              const dt = new Date().toISOString().slice(0, 10);
              const cn = (info && info.name ? info.name : "아동").replace(/[\\/:*?"<>|]/g, "");
              const tg = isIepMode ? "IEP_계획안" : "중간보고서";
              const fileName = "검단ABA_" + tg + "_" + cn + "_" + dt + ".html";
              const docTitle = "검단ABA " + tg + " - " + cn;

              const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + docTitle + '</title>\n<style>\n' +
'*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}\n' +
'html,body{margin:0;padding:0}\n' +
'body>*,body>*>*,body>*>*>*{max-width:100%!important;width:auto!important}\n' +
'#printable-report,#printable-report>div{max-width:100%!important;width:100%!important;margin-left:0!important;margin-right:0!important;padding-left:0!important;padding-right:0!important}\n' +
'#printable-report div[style*="maxWidth"],#printable-report div[style*="max-width"]{max-width:100%!important}\n' +
'#printable-report svg{display:block!important;margin-left:auto!important;margin-right:auto!important}\n' +
'body{font-family:\'Malgun Gothic\',\'Noto Sans KR\',sans-serif;font-size:10.5pt;line-height:1.75;color:#333;word-break:keep-all;overflow-wrap:break-word;-webkit-hyphens:none;hyphens:none;orphans:3;widows:3}\n' +
'*{word-break:keep-all;overflow-wrap:break-word}\n' +
'@page{size:A4 portrait;margin:22mm 14mm 20mm 14mm;@top-center{content:"검단ABA언어행동연구소";font-family:\'Pretendard\',\'Malgun Gothic\',sans-serif;font-size:8.5pt;color:#D4728A;font-weight:600;letter-spacing:0.5px}@bottom-left{content:"검단ABA언어행동연구소";font-family:\'Pretendard\',\'Malgun Gothic\',sans-serif;font-size:7.5pt;color:#999}@bottom-right{content:"Page " counter(page) " / " counter(pages);font-family:\'Pretendard\',\'Malgun Gothic\',sans-serif;font-size:7.5pt;color:#999}}\n' +
'/* 본문 배경 워터마크 - 복제 방지 */\n' +
'#printable-report{position:relative}\n' +
'#printable-report::before{content:"검단ABA";position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100pt;font-weight:900;color:rgba(212,114,138,0.05);z-index:0;pointer-events:none;letter-spacing:8px;font-family:\'Malgun Gothic\',\'Noto Sans KR\',sans-serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}\n' +
'#printable-report>*{position:relative;z-index:1}\n' +
'.no-print{display:none!important}\n' +
'/* 본문 박스 — 좌측 핑크 라인 + 옅은 핑크 배경 */\n' +
'[contenteditable],div[style*="background: rgb(253, 248, 249)"],div[style*="background:#fdf8f9"],.print-section-accent-body{padding:12px 16px!important;line-height:1.85!important;background:#FDFBFC!important;border:none!important;border-left:3px solid #F5A0B1!important;border-radius:4px!important;margin-bottom:8pt!important;page-break-inside:avoid!important;break-inside:avoid!important}\n' +
'/* 테이블 */\n' +
'table{border-collapse:collapse;width:100%;margin-bottom:10pt;table-layout:fixed;page-break-inside:auto}\n' +
'/* 표지 정보표는 고정폭 90mm 유지 (페이지 우측 잘림 방지) */\n' +
'table.iep-cover-info-table{width:90mm!important;max-width:90%!important;table-layout:auto!important;margin:0 auto!important}\n' +
'thead{display:table-header-group}\n' +
'tr{page-break-inside:avoid;break-inside:avoid}\n' +
'td,th{padding:7px 10px;border:none;border-bottom:1px solid #F0E5EA;font-size:10pt;word-break:keep-all;overflow-wrap:break-word;white-space:normal}\n' +
'th{background:transparent!important;border-bottom:2px solid #F5A0B1!important;color:#D4728A;font-weight:600;font-size:10pt;text-align:left}\n' +
'/* VB-MAPP 표 */\n' +
'.vbmapp-grid{border:1.5px solid #666!important;border-collapse:collapse!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;page-break-inside:avoid!important;break-inside:avoid!important}\n' +
'.vbmapp-grid td,.vbmapp-grid th{border:1px solid #888!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;background:inherit!important;color:#333!important}\n' +
'.vbmapp-grid td:first-child,.vbmapp-grid th:first-child{border-right:1.5px solid #555!important}\n' +
'.vbmapp-grid thead th{border-bottom:1.5px solid #555!important}\n' +
'/* 차트 */\n' +
'div[style*="overflow-x"],div[style*="overflowX"]{overflow:visible!important;overflow-x:visible!important;max-width:100%!important;page-break-inside:avoid!important;break-inside:avoid!important}\n' +
'svg{max-width:100%!important;width:auto!important;height:auto!important;max-height:300pt!important;min-width:0!important;page-break-inside:avoid!important;break-inside:avoid!important;display:block;margin:0 auto!important}\n' +
'.pdf-chart-section svg{max-height:280pt!important;width:100%!important}\n' +
'/* h3 제목 */\n' +
'h3{color:#D4728A;font-size:11.5pt;margin:14pt 0 6pt;border-left:3px solid #F5A0B1;padding-left:8px;page-break-after:avoid!important;break-after:avoid!important;word-break:keep-all;font-weight:600}\n' +
'/* ★ 섹션 블록 통째 묶기 — 검정 제목이 외롭게 페이지 끝에 남지 않게 */\n' +
'.print-section-block{page-break-inside:avoid!important;break-inside:avoid!important}\n' +
'.print-section-block.allow-split{page-break-inside:auto!important;break-inside:auto!important}\n' +
'.print-section-block .print-section-title{page-break-after:avoid!important;break-after:avoid!important}\n' +
'p,div{word-break:keep-all;overflow-wrap:break-word}\n' +
'/* 푸터 — 핑크 박스 */\n' +
'.footer{margin-top:18pt;padding:14px 18px;background:#FFF0F3;border-radius:8px;font-size:9pt;text-align:center;color:#D4728A;line-height:1.6;page-break-inside:avoid;break-inside:avoid}\n' +
'/* 워터마크 */\n' +
'.print-watermark-line{display:block!important;width:100%!important;height:4px!important;background:linear-gradient(to right,#F5A0B1 0%,#D4728A 50%,#F5A0B1 100%)!important;margin-top:12pt!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}\n' +
'.print-watermark{display:block!important;text-align:center!important;font-size:8pt!important;font-weight:500!important;color:rgba(212,114,138,0.5)!important;letter-spacing:1.2px!important;margin-top:6pt!important;padding-bottom:4pt!important}\n' +
'/* 차트 섹션 */\n' +
'.pdf-chart-section{page-break-before:auto!important;break-before:auto!important;page-break-inside:avoid!important;break-inside:avoid!important;margin-top:10pt!important;margin-bottom:10pt!important}\n' +
'.pdf-chart-section.pdf-page-break{page-break-before:always!important;break-before:page!important}\n' +
'/* 표 셀 패딩 */\n' +
'table tbody tr td{padding:6px 10px!important;font-size:9.5pt!important}\n' +
'table thead th{padding:7px 10px!important;font-size:10pt!important}\n' +
'/* 대시보드 */\n' +
'.dashboard-wrap{page-break-inside:auto}\n' +
'.dashboard-card{page-break-inside:avoid!important;break-inside:avoid!important;-webkit-column-break-inside:avoid!important;margin-bottom:6pt!important}\n' +
'.dashboard-domain{page-break-inside:auto;margin-bottom:10pt!important}\n' +
'.dashboard-domain-header{page-break-after:avoid!important;break-after:avoid!important}\n' +
'.dashboard-phase{page-break-inside:avoid!important;break-inside:avoid!important}\n' +
'.dashboard-card.pdf-card-break{page-break-before:always!important;break-before:page!important}\n' +
'.dashboard-curriculum.pdf-curr-break{page-break-before:always!important;break-before:page!important}\n' +
'/* 미니 스파크라인 */\n' +
'svg.dashboard-sparkline{width:72px!important;height:22px!important;max-width:72px!important;min-width:72px!important;max-height:22px!important;display:inline-block!important;flex-shrink:0!important;margin:0!important}\n' +
'/* 미니 라인 차트 - 290x80 고정 (영역별 세부 학습 목표) */\n' +
'svg.dashboard-bigchart{width:290px!important;height:80px!important;max-width:100%!important;display:block!important;margin:0 auto!important}\n' +
'/* Info 표 */\n' +
'.info-table-main{font-size:12pt!important;margin-bottom:12pt!important;border:1px solid #eee!important}\n' +
'.info-table-main td{padding:9pt 12pt!important;line-height:1.6!important;font-size:11pt!important;border:1px solid #eee!important;background:#fff!important;vertical-align:middle!important}\n' +
'.info-table-main td:nth-child(odd){font-weight:600!important;width:16%!important;color:#555!important}\n' +
'.info-table-main td:nth-child(even){color:#222!important}\n' +
'/* 마지막 자식 마진 정리 */\n' +
'#printable-report>*:last-child{margin-bottom:0!important}\n' +
'.dashboard-card:last-child,.dashboard-domain:last-child{margin-bottom:0!important}\n' +
'/* 안내 박스, 중단 사유 박스 */\n' +
'div[style*="border-left"][style*="background"]{page-break-inside:avoid!important;break-inside:avoid!important}\n' +
'tbody tr{page-break-inside:avoid!important;break-inside:avoid!important;page-break-after:auto}\n' +
'tbody tr td{page-break-inside:avoid!important;break-inside:avoid!important}\n' +
'p{page-break-inside:avoid!important;break-inside:avoid!important;orphans:3!important;widows:3!important}\n' +
'/* 서명란 */\n' +
'.signature-section{page-break-inside:avoid!important;break-inside:avoid!important;text-align:center!important}\n' +
'.signature-table{width:75%!important;margin:0 auto!important}\n' +
'</style></head><body>\n' +
cleanedHTML + '\n' +
'<script>window.onload=function(){window["pr"+"int"]()}<\/script>\n' +
'</body></html>';

              const blob = new Blob([html], { type: "text/html;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const win = window.open(url, "_blank");
              if (!win) {
                // 팝업이 막힌 경우: 기존 다운로드 방식으로 폴백
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                alert("팝업이 차단되어 HTML 파일로 다운로드했습니다.\n파일을 열면 인쇄 대화상자가 뜹니다. 'PDF로 저장'을 선택하세요.\n\n(다음부터 바로 인쇄하려면 주소창 옆 팝업 차단을 해제해주세요.)");
              } else {
                // 새 창에서 자동으로 인쇄 대화상자가 열립니다 (HTML 내 onload print 스크립트)
                setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
              }
            } catch (err) {
              console.error("[PDF 저장]", err);
              alert("저장 실패: " + (err && err.message ? err.message : err));
            }
          }}>📄 PDF로 저장하기</button>
        </div>
      </div>

      {/* 인쇄 페이지 */}
      <div id="printable-report" style={{ maxWidth: 800, margin: "0 auto", background: "#fff", padding: "30mm 20mm", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", fontSize: 11, lineHeight: 1.65, color: "#222" }}>

        {/* PDF-16: USER_APP과 100% 동일한 표지 구조 — 표지 div 전체에 borderBottom 핑크 라인 */}
        {/* IEP는 표지 안에 정보표가 포함되어 있어 강제 페이지 분리. 중간/종결은 표지 다음 정보표가 이어지도록 자유 흐름 */}
        <div style={{
          textAlign: "center",
          marginBottom: isIepMode ? 0 : 20,
          paddingBottom: isIepMode ? 0 : 16,
          borderBottom: isIepMode ? "none" : `2.5px solid ${PK}`,
          pageBreakAfter: isIepMode ? "always" : "auto",
          breakAfter: isIepMode ? "page" : "auto"
        }}>
          {/* 헤더 row — 보고유형/보고기간만 인쇄 (문서번호/작성일자는 화면용) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "#999", textAlign: "left", lineHeight: 1.7 }}>
              <div><span style={{ fontWeight: 500, color: "#777" }}>보고유형</span> {isIepMode ? "개별화 교육 계획안 (IEP)" : isFinalMode ? "종결보고서" : "중간보고서"}</div>
              <div><span style={{ fontWeight: 500, color: "#777" }}>보고기간</span> {(() => {
                const firstDataDate = (() => {
                  if (!stosForReport || stosForReport.length === 0) return null;
                  const dates = [];
                  stosForReport.forEach(s => (s.points || []).forEach(p => { if (p.date) dates.push(p.date); }));
                  return dates.length > 0 ? dates.sort()[0] : null;
                })();
                const startDate = (isFinalMode || isIepMode) ? info.evalStart : (info.pStart || firstDataDate || info.evalStart);
                const endDate = isFinalMode ? (info.finalEndDate || info.evalEnd) : (isIepMode ? info.evalEnd : (info.pEnd || info.evalEnd));
                return (startDate && endDate) ? `${startDate} ~ ${endDate}` : (startDate || endDate || "—");
              })()}</div>
            </div>
            <div className="no-print" style={{ fontSize: 10, color: "#999", textAlign: "right", lineHeight: 1.7 }}>
              <div><span style={{ fontWeight: 500, color: "#777" }}>문서번호</span> GD-ABA-{year}-{String(new Date().getMonth() + 1).padStart(2, "0")}{String(new Date().getDate()).padStart(2, "0")}</div>
              <div><span style={{ fontWeight: 500, color: "#777" }}>작성일자</span> {today}</div>
            </div>
          </div>

          {/* 로고 + 검단ABA + 부제 — 세로 배치 (로고 크게) */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <img src={LOGO_B64} alt="검단ABA언어행동연구소 로고" style={{ width: 110, height: 110, objectFit: "contain" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 17, color: PKD, fontWeight: 700, letterSpacing: "1px" }}>검단ABA언어행동연구소</div>
              <div style={{ fontSize: 10, color: "#bbb", letterSpacing: "0.5px", marginTop: 2 }}>개별화된 데이터 기반 중재 · 언어/행동 통합적 접근</div>
            </div>
          </div>

          {/* "중간 보고서" 제목 */}
          <div style={{
            fontSize: isIepMode ? 32 : 24,
            fontWeight: 700,
            color: isIepMode ? "#222" : "#333",
            letterSpacing: isIepMode ? "-1px" : "3px",
            marginTop: 4
          }}>
            {isIepMode ? "개별화 교육 계획안" : isFinalMode ? "종결 보고서" : "중간 보고서"}
          </div>

          {/* 부제: 이름 아동 · 치료사 */}
          {!isIepMode && (
            <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
              {info.name || "—"} 아동 · {info.therapist || "—"} 치료사
            </div>
          )}
          {isIepMode && (
            <div style={{ fontSize: 20, fontWeight: 400, color: "#444", marginTop: 12, marginBottom: 72 }}>
              (IEP, Individualized Educational Plan)
            </div>
          )}

          {/* IEP 표지 정보표 — 표지와 같은 페이지에 포함 */}
          {isIepMode && (
            <div style={{ paddingTop: 24 }}>
              <table className="iep-cover-info-table" style={{
                margin: "0 auto",
                borderCollapse: "collapse",
                width: "90mm",
                maxWidth: "90%",
                fontSize: 13,
                tableLayout: "auto",
                boxSizing: "border-box"
              }}>
                <tbody>
                  {[
                    ["아 동 명", info.name || "—"],
                    ["생 년 월 일", info.birth || "—"],
                    ["소 속 반", info.room || "개별 ABA"],
                    ["치 료 사", info.therapist || "—"],
                    ["평가 진행일", (info.evalStart && info.evalEnd) ? `${info.evalStart} ~ ${info.evalEnd}` : (info.evalStart || info.evalEnd || "—")],
                    ["수업 시작일", info.startDate || today]
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: "10px 14px", border: `1.5px solid ${PK}`, background: PKL, fontWeight: 600, color: "#555", textAlign: "center", letterSpacing: "1px", boxSizing: "border-box", whiteSpace: "nowrap" }}>{k}</td>
                      <td style={{ padding: "10px 14px", border: `1.5px solid ${PK}`, background: "#fff", textAlign: "center", color: "#333", boxSizing: "border-box" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 기존 별도 페이지 정보표는 제거됨 (표지 내부로 이동) */}

        {/* 보고서 모드: 정보표 — 캡처 2 스타일 (흰 배경 + 가벼운 테두리 + 출석률 뱃지) */}
        {!isIepMode && (() => {
          const computeAutoTotal = () => {
            const start = info.evalStart || info.pStart;
            const end = info.evalEnd || info.pEnd;
            const week = parseInt(info.sWeek || info.weeklyFreq, 10);
            if (!start || !end || isNaN(week) || week <= 0) return null;
            const ds = new Date(start), de = new Date(end);
            if (isNaN(ds.getTime()) || isNaN(de.getTime())) return null;
            const diffDays = Math.floor((de - ds) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return null;
            return Math.round((diffDays / 7) * week);
          };
          const userTotal = info.sTotal || info.totalSessions;
          const autoTotal = computeAutoTotal();
          const effectiveTotal = userTotal || (autoTotal !== null ? String(autoTotal) : "");

          const sessionCellContent = (() => {
            const totalVal = effectiveTotal;
            const minVal = info.sMin || info.sessionMin;
            let mainText;
            if (totalVal && minVal) mainText = `${totalVal}세션 / ${minVal}분`;
            else if (totalVal) mainText = `${totalVal}세션`;
            else if (minVal) mainText = `${minVal}분`;
            else mainText = "—";
            return <span>{mainText}</span>;
          })();
          return (
            <table className="info-table-main" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
              <tbody>
                {[
                  ["아동명", info.name || "—", "생년월일", info.birth || "—"],
                  ["소속반", info.room || "개별 ABA", "담당 치료사", info.therapist || "—"],
                  ["치료기간", (() => {
                    if (isFinalMode) {
                      const e = info.finalEndDate || info.evalEnd || "";
                      return (info.evalStart && e) ? `${info.evalStart} ~ ${e}` : (info.evalStart || e || "—");
                    }
                    if (isIepMode) {
                      return (info.evalStart && info.evalEnd) ? `${info.evalStart} ~ ${info.evalEnd}` : (info.evalStart || info.evalEnd || "—");
                    }
                    const firstDataDate = (() => {
                      if (!stosForReport || stosForReport.length === 0) return null;
                      const dates = [];
                      stosForReport.forEach(s => (s.points || []).forEach(p => { if (p.date) dates.push(p.date); }));
                      return dates.length > 0 ? dates.sort()[0] : null;
                    })();
                    const reportStart = info.pStart || firstDataDate || info.evalStart || "";
                    const reportEnd = info.pEnd || info.evalEnd || "";
                    return (reportStart && reportEnd) ? `${reportStart} ~ ${reportEnd}` : (reportStart || reportEnd || "—");
                  })(), "프로그램", (() => {
                    const sources = [...new Set((goals || []).map(g => g.source || "ELCAR"))];
                    return sources.join(", ") || "—";
                  })()],
                  ["주 횟수", (info.sWeek || info.weeklyFreq) ? `주 ${info.sWeek || info.weeklyFreq}회` : "—", "총 세션/시간", sessionCellContent]
                ].map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{
                        padding: "10px 14px",
                        border: `1px solid ${PKL}`,
                        verticalAlign: "middle",
                        ...(j % 2 === 0
                          ? { background: PKL, fontWeight: 600, color: PKD, width: "15%", letterSpacing: "0.5px" }
                          : { background: "#fff", color: "#222", width: "35%" })
                      }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}

        {/* PDF-2: SUMMARY · 핵심 한 줄 요약 (보고서 모드만) — USER_APP 원본 디자인 */}
        {!isIepMode && (() => {
          const summary = buildSummary(stosForReport, info);
          if (!summary) return null;
          return (
            <div style={{
              background: "linear-gradient(135deg,#FFF8FA 0%,#FFFAFB 100%)",
              border: `1px solid ${PK}`,
              borderLeft: `4px solid ${PKD}`,
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 16,
              marginTop: 16
            }}>
              <div style={{ fontSize: 9, color: PKD, fontWeight: 600, letterSpacing: "1px", marginBottom: 4 }}>
                SUMMARY · 핵심 요약
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#333", lineHeight: 1.7 }}>
                {summary}
              </div>
            </div>
          );
        })()}

        {/* PDF-11: 주요 성과 박스 제거 (사용자 요청) */}

        {/* ★ [IEP 신규] 의뢰 사유 — 맨 앞 (선택 입력 · 비워두면 생략) */}
        {isIepMode && (() => {
          const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
          const referralClean = stripMarker(info.iepReferralReason);
          if (!referralClean) return null;
          const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
          const personalize = (text) => personalizeText(text || "", childName);
          return (
            <PrintSection num={nextSn()} title="의뢰 사유" accent>
              <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                {personalize(referralClean).split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "0 0 6px 0" }}>{line}</p>
                ))}
              </div>
            </PrintSection>
          );
        })()}

        {/* ═══ 1. 커리큘럼 평가 (IEP 계획안 전용 — 보고서는 SUMMARY+서술형으로 대체) ═══ */}
        {/* W-21: 선택된 IEP 목표가 속한 커리큘럼만 표시 (전체 3종 무조건 표시 X) */}
        {isIepMode && (
        <PrintSection num={nextSn()} title="커리큘럼 평가">
          {(() => {
            const usedSources = new Set((goals || []).map(g => g.source || "ELCAR"));
            const showElcar = usedSources.has("ELCAR");
            const showVbmapp = usedSources.has("VB-MAPP");
            const showEsdm = usedSources.has("ESDM");
            const noneSelected = !showElcar && !showVbmapp && !showEsdm;
            if (noneSelected) {
              return (
                <div style={{ fontSize: 10.5, color: "#888", padding: "10px 14px", border: "1px dashed #ddd", borderRadius: 4 }}>
                  선택된 IEP 목표가 없어 커리큘럼 평가를 표시할 수 없습니다.
                </div>
              );
            }
            return (
              <>
                {showElcar && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 4 }}>● ELCAR (Early Learner Curriculum and Achievement Record)</div>
                    <div style={{ border: `1px solid ${PK}`, borderRadius: 4, padding: "10px 14px", background: "#fdf8f9", fontSize: 10.5, lineHeight: 1.75 }}>
                      ELCAR는 유치원과 초등학년에서 필요한 능력군을 가르치기 위한 커리큘럼 목표로 이루어졌으며 목표하는 능력군은 신체적, 사회적, 학습, 언어발달과 강화를 위한 영역에 걸쳐 포함되어 있습니다. 또한 커리큘럼-기반 능력군 목록이며 준거 지향 평가 도구이기도 합니다. "아동이 이미 학습하여 알고 있는 목록과 학습해야 하는 목록"을 제공하며, 이것을 통해 아동의 언어 행동 능력 및 발달점을 형성시킬 수 있습니다.
                    </div>
                  </div>
                )}
                {showVbmapp && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 4 }}>● VB-MAPP (Verbal Behavior Milestones Assessment and Placement Program)</div>
                    <div style={{ border: `1px solid ${PK}`, borderRadius: 4, padding: "10px 14px", background: "#fdf8f9", fontSize: 10.5, lineHeight: 1.75 }}>
                      VB-MAPP은 B.F. Skinner의 언어 행동 분석(Verbal Behavior) 이론에 기반한 언어·학습 능력 평가 도구로, 자폐스펙트럼 및 기타 언어 지연 아동의 현행 수준을 측정하고 개별화된 교수 목표를 설정하는 데 사용됩니다. 평가는 크게 <b>마일스톤(Milestones)</b>, <b>장벽(Barriers)</b>, <b>전이(Transition)</b>의 세 영역으로 구성되며, 마일스톤은 총 <b>3단계(Level 1: 0~18개월, Level 2: 18~30개월, Level 3: 30~48개월)</b>에 걸쳐 Mand(요구), Tact(명명), Listener Responding(청자반응), VP/MTS(시각적 수행·매칭), Play(놀이), Social(사회성), Motor Imitation(운동모방), Echoic(에코익), LRFFC(기능·특성·범주 청자반응), Intraverbal(인트라버벌) 등 16개 영역의 170개 마일스톤을 평가합니다. 본 IEP에서는 ELCAR 목표와 VB-MAPP 마일스톤을 연계하여 학습자의 언어 행동 능력을 종합적으로 분석합니다.
                    </div>
                  </div>
                )}
                {showEsdm && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 4 }}>● ESDM (Early Start Denver Model)</div>
                    <div style={{ border: `1px solid ${PK}`, borderRadius: 4, padding: "10px 14px", background: "#fdf8f9", fontSize: 10.5, lineHeight: 1.75 }}>
                      ESDM은 자폐스펙트럼 아동(12~48개월)을 위한 조기중재 모델로, 발달적 접근과 ABA를 통합한 자연주의 교수법입니다. 놀이 중심의 상호작용을 통해 언어, 사회성, 인지, 운동, 자조기술 등을 지도하며, ESDM 체크리스트를 통해 아동의 현재 수준과 교수 목표를 설정합니다. 치료자-아동의 긍정적 상호작용과 일상 속 일반화를 강조합니다.
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </PrintSection>
        )}

        {/* ═══ 2. 목표 달성 기준 및 측정 방법 (IEP 계획안 전용) ═══ */}
        {isIepMode && (
        <PrintSection num={nextSn()} title="목표 달성 기준 및 측정 방법">
          {(() => {
            const grouped = {};
            goals.forEach(g => {
              const key = shortDomain(g.domain) || g.domain || "(영역 없음)";
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(g);
            });
            const entries = Object.entries(grouped);
            const briefStrategy = (cat) => {
              switch (cat) {
                case "reinforcer":   return "선호도 평가와 강화제 다양화";
                case "mand":         return "동기조작 활용 자연 환경 교수(NET)와 시간 지연";
                case "tact":         return "분리 시도 교수(DTT)와 시각 단서 페이딩";
                case "echoic":       return "즉각 강화 기반 음성 모방 훈련";
                case "intraverbal":  return "맥락 단서를 통한 점진적 페이딩";
                case "listener":     return "수용 변별과 점진적 난이도 증가";
                case "imitation":    return "무오류 교수와 즉각 시범";
                case "visual":       return "매칭 변별과 시각 단서 활용";
                case "play":         return "또래 시범과 자연 환경 교수(NET)";
                case "social":       return "또래 매개 학습과 비디오 모델링";
                case "self_help":    return "역방향 연쇄와 시각 스케줄";
                case "academic":     return "선행 행동 형성과 정적 강화";
                case "cognitive":    return "시각 단서와 점진적 난이도 조정";
                case "motor":        return "신체 형성(shaping)과 시각 시범";
                case "behavior":     return "기능평가 기반 대체 행동 강화(FCT·DRA)";
                default:             return "분리 시도 교수(DTT)와 자연 환경 교수(NET) 통합";
              }
            };
            const usedCats = new Set();
            entries.forEach(([area, items]) => {
              const first = items[0];
              usedCats.add(classifyDomain(first.domain, first.item));
            });
            const groupedCats = {
              language: [],   // mand, tact, echoic, intraverbal, listener
              social: [],     // social, play
              imitation: [],  // imitation, motor
              selfCare: [],   // self_help, behavior
              cognitive: [],  // visual, cognitive, academic
              reinforcer: []  // reinforcer
            };
            usedCats.forEach(c => {
              if (["mand","tact","echoic","intraverbal","listener"].includes(c)) groupedCats.language.push(c);
              else if (["social","play"].includes(c)) groupedCats.social.push(c);
              else if (["imitation","motor"].includes(c)) groupedCats.imitation.push(c);
              else if (["self_help","behavior"].includes(c)) groupedCats.selfCare.push(c);
              else if (["visual","cognitive","academic"].includes(c)) groupedCats.cognitive.push(c);
              else if (c === "reinforcer") groupedCats.reinforcer.push(c);
            });
            const groupPhrases = [];
            if (groupedCats.reinforcer.length > 0) {
              groupPhrases.push("강화제 영역에는 선호도 평가(MSWO·PSPA)와 강화제 체계 정교화");
            }
            if (groupedCats.language.length > 0) {
              groupPhrases.push("언어 영역(요구·명명·청자 반응 등)에는 분리 시도 교수(DTT)와 자연 환경 교수(NET), 시간 지연");
            }
            if (groupedCats.social.length > 0) {
              groupPhrases.push("사회·놀이 영역에는 또래 매개 학습과 비디오 모델링");
            }
            if (groupedCats.imitation.length > 0) {
              groupPhrases.push("모방·운동 영역에는 무오류 교수(Errorless Teaching)와 즉각 시범, 신체 형성(shaping)");
            }
            if (groupedCats.selfCare.length > 0) {
              groupPhrases.push("자조·행동 영역에는 역방향 연쇄와 시각 스케줄, 기능평가 기반 대체 행동 강화(FCT·DRA)");
            }
            if (groupedCats.cognitive.length > 0) {
              groupPhrases.push("시각·인지·학습 영역에는 시각 단서를 활용한 매칭 변별과 점진적 난이도 조정");
            }
            const joined = groupPhrases.length === 0
              ? ""
              : groupPhrases.length === 1
                ? `${groupPhrases[0]}${josa을를(groupPhrases[0])}`
                : groupPhrases.slice(0, -1).map(p => `${p}${josa을를(p)},`).join(" ") + " " + groupPhrases[groupPhrases.length - 1] + josa을를(groupPhrases[groupPhrases.length - 1]);
            return (
              <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#444" }}>
                <p style={{ margin: "0 0 10px" }}>
                  각 세부 목표는 <b>80% 이상의 정확도로 2회 연속 수행 시 '달성'</b>으로 간주하며, 정확도뿐 아니라 <b>일관성·자발성·일반화</b> 여부를 함께 고려하여 판단합니다.
                </p>
                {groupPhrases.length > 0 && (
                  <p style={{ margin: 0 }}>
                    본 IEP에서는 {joined} 적용하여 단계적으로 지도하며, 모든 영역에서 가정·외부 환경 등 다양한 맥락으로의 일반화를 추진합니다.
                  </p>
                )}
              </div>
            );
          })()}
        </PrintSection>
        )}

        {/* ═══ 3. 현재 수행률 시각화 (IEP 모드는 사용 안 함, 보고서 모드는 4섹션 뒤로 이동) ═══ */}
        {/* PDF-10: 보고서 모드에서는 본문 4섹션 뒤로 이동시킴 (PDF 순서 일치) */}

        {/* PDF-10: 보고서 모드 — VB-MAPP 마일스톤 + 영역별 균형 분석 + 영역별 세부 학습 목표는 본문 4섹션 뒤로 이동 */}

        {/* ═══ 4. 평가 결과 및 현행 수준 (영역별) ═══ */}
        {/* ═══ 평가 결과 및 현행 수준 — 보고서 모드 전용 (수치 기반이라 IEP에 부적합, W-32) ═══ */}

        {/* 3번 세부 목표 및 중재 전략 — 제거 (5번 개별화 프로그램 계획안과 정보 중복) */}
        {/* 영역/세부목표는 5번 표에서 이미 표시되고, 사유는 6번 섹션에서 자세히 다룸 */}

        {/* ═══ 새 3. 평가 결과 및 현행 수준 (초기 관찰 기반) ═══ */}
        {/* 6 표준 카테고리 — 치료사가 직접 입력한 관찰 기록 표시 */}
        {isIepMode && (
          <PrintSection num={nextSn()} title="평가 결과 및 현행 수준 (초기 관찰 기반)">
            {(() => {
              const obs = info.iepObservations || {};
              const categories = [
                { key: "eyeContact", label: "눈맞춤" },
                { key: "requesting", label: "요구 표현" },
                { key: "following", label: "지시 따르기" },
                { key: "attention", label: "주의 집중" },
                { key: "imitation", label: "모방 반응" },
                { key: "selfCare", label: "자기관리" }
              ];
              const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
              const personalize = (text) => personalizeText(text || "", childName);
              const hasAny = categories.some(c => (obs[c.key] || "").trim() !== "");
              if (!hasAny) {
                return (
                  <div style={{ fontSize: 10.5, color: "#888", padding: "16px 14px", textAlign: "center", border: "1px dashed #e0c8d0", borderRadius: 4, background: "#fafafa" }}>
                    아직 초기 관찰 기록이 입력되지 않았습니다.<br/>
                    <span style={{ fontSize: 9.5, color: "#aaa" }}>[② IEP 설정] 화면 하단의 "초기 관찰 기록" 섹션에서 6개 카테고리에 직접 입력해 주세요.</span>
                  </div>
                );
              }
              return (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                    <tbody>
                      {categories.map(c => (
                        <tr key={c.key} style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                          <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", background: PKL, color: PKD, fontWeight: 600, width: "16%", textAlign: "center", verticalAlign: "middle", pageBreakInside: "avoid", breakInside: "avoid" }}>{c.label}</td>
                          <td style={{ padding: "10px 14px", border: "1px solid #e8d0d6", color: "#333", lineHeight: 1.75, verticalAlign: "top", whiteSpace: "pre-line", pageBreakInside: "avoid", breakInside: "avoid" }}>
                            {personalize((obs[c.key] || "").trim()) || <span style={{ color: "#bbb", fontSize: 10 }}>(미입력)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* ★ [자동 요약] 표 아래 종합 요약 — 직접 수정본(override) 우선, 없으면 자동 생성 */}
                  {(() => {
                    const levels = info.iepObservationLevels || {};
                    const override = info.iepObservationSummaryOverride;
                    const hasOverride = override !== null && override !== undefined && override !== "";
                    const summary = hasOverride
                      ? personalizeText(override, childName)  // ★ override도 호칭 치환 (사용자가 "본 아동" 입력했을 수 있음)
                      : personalizeText(generateObservationSummary(obs, levels), childName);
                    if (!summary) return null;
                    return (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: "#fdf8f9", border: `1px solid ${PK}`, borderRadius: 4, fontSize: 10.5, lineHeight: 1.85, color: "#333", pageBreakInside: "avoid", breakInside: "avoid" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: PKD, marginBottom: 4, pageBreakAfter: "avoid", breakAfter: "avoid" }}>● 종합 요약</div>
                        {summary}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </PrintSection>
        )}

        {/* ═══ 새 5. 개별화 프로그램 계획안 (IEP 영역별 큰 표) ═══ */}
        {/* ★ [정밀화] 커리큘럼별로 분리 - ELCAR / VB-MAPP / ESDM / 기타 각각 별도 표 */}
        {isIepMode && (
          <PrintSection num={nextSn()} title="개별화 프로그램 계획안 (IEP)">
            {(() => {
              if (goals.length === 0) {
                return <div style={{ fontSize: 10.5, color: "#767676", padding: "12px 14px", textAlign: "center", border: "1px dashed #e0c8d0", borderRadius: 4 }}>IEP에 포함된 목표가 없습니다.</div>;
              }
              const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
              const bySource = { "ELCAR": [], "VB-MAPP": [], "ESDM": [], "기타": [] };
              goals.forEach(g => {
                const src = g.source || "ELCAR";
                if (bySource[src]) bySource[src].push(g);
                else bySource["기타"].push(g);
              });
              const curriculumMeta = [
                { src: "ELCAR",   meta: CURR_COLORS.elcar  },
                { src: "VB-MAPP", meta: CURR_COLORS.vbmapp },
                { src: "ESDM",    meta: CURR_COLORS.esdm   },
                { src: "기타",     meta: CURR_COLORS.other  }
              ];
              return curriculumMeta.map(({ src, meta }) => {
                const items = bySource[src];
                if (items.length === 0) return null;
                const grouped = {};
                items.forEach(g => {
                  const key = shortDomain(g.domain) || g.domain || "(영역 없음)";
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(g);
                });
                return (
                  <div key={src} style={{ marginBottom: 16, padding: 12, background: meta.bg, border: `2px solid ${meta.accent}`, borderRadius: 8, pageBreakInside: "avoid", breakInside: "avoid" }}>
                    {/* 커리큘럼 헤더 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingBottom: 6, borderBottom: `1.5px solid ${meta.accent}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: meta.deep }}>● {meta.label} 평가</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: meta.deep, opacity: 0.8 }}>{items.length}개 목표 · {Object.keys(grouped).length}개 영역</span>
                    </div>
                    {/* ★ [정밀화] 커리큘럼 단위 설명 단락 — 자동 생성 + 이름 자동 치환 */}
                    <div style={{ fontSize: 10.5, lineHeight: 1.75, color: "#333", marginBottom: 10, padding: "0 4px" }}>
                      {personalizeText(generateCurriculumDescription(src, items), childName)}
                    </div>
                    {/* 영역별 작은 카드들 */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {Object.entries(grouped).map(([cat, gItems]) => (
                        <div key={cat} style={{ background: "#fff", border: `1px solid ${meta.accent}`, borderRadius: 6, padding: "8px 12px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: meta.deep, marginBottom: 4 }}>{cat}</div>
                          <div style={{ fontSize: 10.5, color: "#333", lineHeight: 1.85 }}>
                            {gItems.map((g, i) => (
                              <div key={g.id} style={{ marginBottom: i < gItems.length - 1 ? 4 : 0 }}>
                                <span style={{ color: "#888", marginRight: 4 }}>-</span>
                                <span>{g.item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </PrintSection>
        )}

        {/* 6번 세부 목표별 설정 사유 — 제거 (5번 개별화 프로그램 계획안과 정보 중복) */}
        {/* 모범 IEP 양식에도 없음. 5번 커리큘럼 설명 단락에서 이미 영역/맥락 충분히 다룸 */}

        {/* 6. 습득 완료 과제 — IEP에서 제거 (IEP는 시작 시점 문서이므로 부적합) */}

        {/* ★ [IEP 신규] 보호자 협력 방안 — IEP 계획안 직후 (선택) */}
        {isIepMode && (() => {
          const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
          const collabClean = stripMarker(info.iepHomeCollab);
          if (!collabClean) return null;
          const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
          const personalize = (text) => personalizeText(text || "", childName);
          return (
            <PrintSection num={nextSn()} title="보호자 협력 방안" accent>
              <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                {personalize(collabClean).split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "0 0 6px 0" }}>{line}</p>
                ))}
              </div>
            </PrintSection>
          );
        })()}

        {/* ★ [IEP 신규] 권고사항 — 마지막 (선택) */}
        {isIepMode && (() => {
          const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
          const recsClean = stripMarker(info.iepRecommendations);
          if (!recsClean) return null;
          const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
          const personalize = (text) => personalizeText(text || "", childName);
          return (
            <PrintSection num={nextSn()} title="권고사항" accent>
              <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                {personalize(recsClean).split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "0 0 6px 0" }}>{line}</p>
                ))}
              </div>
            </PrintSection>
          );
        })()}

        {/* PDF-6: 보고서 4섹션 본문 (PDF의 종합현황/이번기간/가정에서함께/다음목표 4섹션) */}
        {!isIepMode && (() => {
          const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
          const personalize = (text) => personalizeText(text || "", childName);
          return (
          <>
            {/* ★ [종결보고서 전용] 치료 개요 — 의뢰 사유, 종결 사유 */}
            {isFinalMode && (info.finalReferralReason || info.finalEndReason) && (
              <PrintSection num={nextSn()} title="치료 개요" accent>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, lineHeight: 1.7 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "8px 12px", background: "#f5f7f0", fontWeight: 600, color: "#3d6014", border: "1px solid #d4e5ba", width: "20%", verticalAlign: "top" }}>치료 기간</td>
                      <td style={{ padding: "8px 12px", border: "1px solid #d4e5ba" }}>
                        {info.evalStart || "—"} ~ {info.finalEndDate || info.evalEnd || "—"}
                      </td>
                    </tr>
                    {(() => {
                      const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
                      const refClean = stripMarker(info.finalReferralReason);
                      const endClean = stripMarker(info.finalEndReason);
                      return (
                        <>
                          {refClean && (
                            <tr>
                              <td style={{ padding: "8px 12px", background: "#f5f7f0", fontWeight: 600, color: "#3d6014", border: "1px solid #d4e5ba", verticalAlign: "top" }}>의뢰 사유</td>
                              <td style={{ padding: "8px 12px", border: "1px solid #d4e5ba", whiteSpace: "pre-line" }}>
                                {personalize(refClean)}
                              </td>
                            </tr>
                          )}
                          {endClean && (
                            <tr>
                              <td style={{ padding: "8px 12px", background: "#f5f7f0", fontWeight: 600, color: "#3d6014", border: "1px solid #d4e5ba", verticalAlign: "top" }}>종결 사유</td>
                              <td style={{ padding: "8px 12px", border: "1px solid #d4e5ba", whiteSpace: "pre-line" }}>
                                {personalize(endClean)}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </PrintSection>
            )}

            {/* ★ [종결보고서 전용] 시작 vs 종결 비교 — 영역별 % 변화 + 마스터 진척 */}

          </>
          );
        })()}

        {!isIepMode && (
          <>
            {/* PDF-10: 본문 4섹션 다음 → VB-MAPP 마일스톤 (PDF 4페이지) */}
            {(() => {
              const hasVbmapp = (goals || []).some(g =>
                g.source === "VB-MAPP" || classifyCurriculum(g.domain || "") === "vbmapp"
              );
              if (!hasVbmapp) return null;
              return (
                <PrintSection num={nextSn()} title="VB-MAPP 마일스톤 현황">
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>
                    ※ VB-MAPP은 자폐 아동의 언어/사회성 발달을 16개 영역, 3단계(Level 1~3)로 평가하는 표준 도구입니다.<br />
                    ※ 각 영역의 색깔이 채워진 동그라미(●)는 해당 마일스톤이 달성되었음을 의미합니다.
                  </div>
                  <VbmappGrid goals={goals} />
                </PrintSection>
              );
            })()}

            {/* PDF-10: 영역별 균형 분석 (= 레이더 + 막대) (PDF 5페이지) */}
            {domainAvgs.length > 0 && (
              <PrintSection num={nextSn()} title="영역별 균형 분석">
                <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>
                  ※ 영역별 학습 목표의 최종 달성률을 한눈에 비교한 그래프입니다. (녹색: 80%↑ 숙달, 파랑: 60~79% 진전, 빨강: 60%↓ 추가 지원 필요)
                </div>
                <div style={{ marginBottom: 14, pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textAlign: "center", fontWeight: 500 }}>레이더 차트 (영역별 균형)</div>
                  <RadarChart data={domainAvgs} />
                </div>
                <div style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textAlign: "center", fontWeight: 500 }}>평균 달성률(%)</div>
                  <BarChart data={domainAvgs} />
                </div>
              </PrintSection>
            )}

            {/* ★ [신규] 성장 추이 - 보고 기간 동안 평균 정반응률 변화 (라인 차트) */}
            {(() => {
              let cutoffDate = null;
              const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
              if (cutoffArchives.length > 0 && cutoffArchives[0].savedAt) {
                cutoffDate = cutoffArchives[0].savedAt.slice(0, 10);
              }
              const dateSet = new Set();
              goals.forEach(g => {
                (g.tasks || []).forEach(t => {
                  Object.keys(t.daily || {}).forEach(d => {
                    if (!cutoffDate || d >= cutoffDate) dateSet.add(d);
                  });
                });
                Object.keys(g.daily || {}).forEach(d => {
                  if (!cutoffDate || d >= cutoffDate) dateSet.add(d);
                });
              });
              const allDates = [...dateSet].sort();
              if (allDates.length < 2) return null;
              return (
                <PrintSection num={nextSn()} title="성장 추이 (전체 목표 평균)">
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>
                    ※ 보고 기간 동안 날짜별 전체 목표의 평균 정반응률 추이입니다.<br/>
                    ※ 우상향 = 전반적 성장, 평탄 = 숙달 안정기.
                  </div>
                  <div style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                    <GrowthLineChart goals={goals} dates={allDates} getTimeline={null} />
                  </div>
                </PrintSection>
              );
            })()}

            {/* ★ [중복 제거] '영역별 현행 수준' 섹션 제거 — 영역별 균형 분석(레이더), 영역별 세부 학습 목표(그래프)와 중복 */}
            {/* ★ [중복 제거] '현재 진행 과제' 섹션 제거 — 영역별 세부 학습 목표 카드에 같은 task 정보 있음 */}
            {/* ★ [중복 제거] '습득 완료 과제' 섹션 제거 — 영역별 세부 학습 목표 그래프에 마스터된 task 정보 시각화됨 */}

            {/* PDF-10: 영역별 세부 학습 목표 */}
            {/* 중간보고서: 목표별 미니 라인 차트 (자세함) */}
            {/* 종결보고서: 영역별 평균 라인 차트 (큰 그림) */}
            {isFinalMode ? (
              goals && goals.length > 0 && (
                <PrintSection num={nextSn()} title="영역별 완료 현황">
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>
                    ※ 종결 시점에 각 영역에서 마스터된 과제 수와 진행 상황을 한눈에 보여줍니다.
                  </div>
                  <DomainCompletionSection goals={goals} />
                </PrintSection>
              )
            ) : (
              stosForReport && stosForReport.length > 0 && (
                <PrintSection num={nextSn()} title="영역별 세부 학습 목표">
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>
                    ※ 각 목표는 영역별로 그룹화되어 있으며, 진행률과 최근 데이터 추이를 함께 표시합니다.<br />
                    ※ 미니 추이선은 학습 시작부터 현재까지의 평가 데이터 흐름을 보여줍니다.
                  </div>
                  <GoalDashboard stos={goalsForReport} />
                </PrintSection>
              )
            )}

            {/* ★ [v19 통일] 옛 중간모드 reportBehaviors 표 제거 */}
            {/* 중간모드도 종결과 동일하게 finalBehaviorChange 단락 사용 */}

            {/* ★ [v19 흐름 개선] 중간모드 문제행동 변화 — 차트 영역 끝 (사실 데이터와 함께) */}
            {!isFinalMode && !isIepMode && (() => {
              const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
              const behaviorClean = stripMarker(info.finalBehaviorChange);
              if (!behaviorClean) return null;
              const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
              const personalize = (text) => personalizeText(text || "", childName);
              return (
                <PrintSection num={nextSn()} title="문제행동 변화">
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>
                    ※ 본 보고 기간 동안 관찰된 문제행동 변화 양상입니다.
                  </div>
                  <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                    {personalize(behaviorClean).split("\n").map((line, i) => (
                      <p key={i} style={{ margin: line.trim() === "" ? "4px 0" : "0 0 6px 0" }}>
                        {line || "\u00A0"}
                      </p>
                    ))}
                  </div>
                </PrintSection>
              );
            })()}

            {/* 중단된 목표 (있을 때만) — 중간모드만 표시 (종결모드는 종합평가 4단락에 통합됨) */}
            {!isFinalMode && (() => {
              const pausedItems = [];
              const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
              (goals || []).forEach(g => {
                (g.tasks || []).forEach(t => {
                  if (t.listGroup === "paused") {
                    pausedItems.push({
                      name: t.name || "(이름 없음)",
                      domain: g.domain || "",
                      rawReason: t.pauseReason || "",
                      softReason: personalizeText(softenPauseReason(t.pauseReason || ""), childName)
                    });
                  }
                });
              });
              if (pausedItems.length === 0) return null;
              return (
                <PrintSection num="" title={`중단된 목표 (${pausedItems.length}개)`}>
                  {/* ★ 연한 베이지 파스텔 박스 — 묶어서 시각적 구분 */}
                  <div style={{
                    background: "#fbf6e8",
                    border: "1px solid #e5d8a8",
                    borderLeft: "3px solid #c9a85a",
                    borderRadius: 6,
                    padding: "14px 16px",
                    pageBreakInside: "avoid",
                    breakInside: "avoid"
                  }}>
                    <div style={{ fontSize: 10.5, color: "#7a6235", marginBottom: 14, lineHeight: 1.7, paddingBottom: 10, borderBottom: "1px dashed #e5d8a8" }}>
                      ⏸ 아래 목표는 임상적 판단에 따라 본 회기 중 중단되었습니다. 향후 회기에서 재구성 또는 우선순위 조정 후 재개 여부를 검토할 예정입니다.
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 10.5, lineHeight: 1.7, color: "#333" }}>
                      {pausedItems.map((item, idx) => (
                        <li key={idx} style={{
                          marginBottom: idx === pausedItems.length - 1 ? 0 : 12,
                          pageBreakInside: "avoid", breakInside: "avoid",
                          paddingLeft: 12, position: "relative"
                        }}>
                          <div>
                            <span style={{ position: "absolute", left: 0, color: "#c9a85a", fontWeight: 700 }}>•</span>
                            <b style={{ color: "#7a6235" }}>{item.name}</b>
                            {item.domain && (
                              <span style={{ color: "#a89570", marginLeft: 6, fontSize: 10 }}>({item.domain})</span>
                            )}
                          </div>
                          {item.softReason && (
                            <div style={{ fontSize: 10.5, color: "#7a6235", marginTop: 4, paddingLeft: 14, lineHeight: 1.65 }}>
                              └ <b style={{ color: "#c9a85a" }}>중단 사유:</b> {item.softReason}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </PrintSection>
              );
            })()}

            {/* ★ [중복 제거] '부록: STO별 시계열 데이터' 제거 — 영역별 세부 학습 목표 그래프와 같은 데이터 */}
            {/* 화면(중간보고서 탭)에서는 유지 — 슈퍼바이저 정확한 % 점검용 */}

            {/* ★ [본문 4섹션] 종결글 + 중간모드 reportSections — personalize 함수 사용을 위해 IIFE로 감쌈 */}
            {(() => {
              const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
              const personalize = (text) => personalizeText(text || "", childName);
              return (
                <>
            {/* ★ [종결보고서 흐름 개선] 치료 기간 중 성장과 변화 — 종합 평가 앞으로 (회고 → 평가 → 정리) */}
            {isFinalMode && info.finalGrowth && info.finalGrowth.trim() && (
              <PrintSection num={nextSn()} title="치료 기간 중 성장과 변화" accent>
                <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                  {personalize(info.finalGrowth)}
                </div>
              </PrintSection>
            )}

            {/* ★ [종결보고서 전용] 종합 평가 — 자동 생성 + 사용자 수정 */}
            {isFinalMode && info.finalSummary && info.finalSummary.trim() && (
              <PrintSection num={nextSn()} title="종합 평가" accent>
                <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                  {personalize(info.finalSummary)}
                </div>
              </PrintSection>
            )}

            {/* ★ [v19] 영역별 관찰 현황 인쇄 섹션 제거 — 4섹션 칩+✨ 자동생성으로 대체 */}

            {/* 1. 종합 현황 */}
            {reportSections && (() => {
              const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
              const overviewClean = stripMarker(reportSections["종합 현황"]);
              const summaryClean = stripMarker(reportSections["총괄 요약 및 권고사항"]);
              if (overviewClean) {
                return (
                  <PrintSection num={nextSn()} title="종합 현황" accent>
                    <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                      {personalize(overviewClean)}
                    </div>
                  </PrintSection>
                );
              }
              if (summaryClean) {
                return (
                  <PrintSection num={nextSn()} title="총괄 요약 및 권고사항" accent>
                    <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                      {personalize(summaryClean)}
                    </div>
                  </PrintSection>
                );
              }
              return null;
            })()}

            {/* ★ [v19 통합] 강점과 변화 — 강점 발견 + 이번 기간 의미 있는 변화 */}
            {!isFinalMode && !isIepMode && (() => {
              const strengthsText = buildInterimStrengths(domainAvgs || [], stosForReport || [], info);
              const highlightsText = buildInterimHighlights(domainAvgs || [], stosForReport || [], info, dailyMemos || {});
              if (!strengthsText && !highlightsText) return null;
              return (
                <PrintSection num={nextSn()} title="이번 기간의 강점과 주요 변화" accent>
                  <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                    {/* 강점 (전반적 패턴) - 먼저 큰 그림 */}
                    {strengthsText && (
                      <div style={{ marginBottom: highlightsText ? 14 : 0 }}>
                        {personalize(strengthsText).split("\n").map((line, i) => (
                          <p key={`s-${i}`} style={{ margin: line.trim() === "" ? "4px 0" : "0 0 6px 0" }}>
                            {line || "\u00A0"}
                          </p>
                        ))}
                      </div>
                    )}
                    {/* 구체적 변화 사건 - 강점 다음 */}
                    {highlightsText && (
                      <div>
                        {strengthsText && (
                          <div style={{ paddingTop: 10, borderTop: "0.5pt solid #f0e0e5", marginBottom: 8 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: PKD }}>구체적인 변화의 순간들</div>
                          </div>
                        )}
                        {personalize(highlightsText).split("\n").map((line, i) => (
                          <p key={`h-${i}`} style={{ margin: line.trim() === "" ? "4px 0" : "0 0 6px 0" }}>
                            {line || "\u00A0"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </PrintSection>
              );
            })()}

            {/* 2. 치료사 종합 소견 (중간 모드 - 종결은 위에서 처리됨) */}
            {!isFinalMode && !isIepMode && reportSections && (() => {
              const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
              const growthClean = stripMarker(reportSections["이번 기간의 성장과 변화"]);
              if (!growthClean) return null;
              return (
                <PrintSection num={nextSn()} title="치료사 종합 소견" accent>
                  <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                    {personalize(growthClean)}
                  </div>
                </PrintSection>
              );
            })()}

            {/* ★ [종결보고서 전용] 습득 완료 목표 모음 — 영역별 그룹화 (성장과 변화 다음) */}

            {/* ★ [v19 흐름 개선] 종결모드 문제행동 변화 — 성장과 변화 직후 (회고 흐름) */}
            {/* 중간모드는 위 차트 영역 끝에서 표시됨 */}
            {isFinalMode && (() => {
              const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
              const behaviorClean = stripMarker(info.finalBehaviorChange);
              if (!behaviorClean) return null;
              return (
                <PrintSection num={nextSn()} title="문제행동 변화">
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>
                    ※ 치료 시작 시점부터 종결까지의 문제행동 변화 양상입니다.
                  </div>
                  <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                    {personalize(behaviorClean).split("\n").map((line, i) => (
                      <p key={i} style={{ margin: line.trim() === "" ? "4px 0" : "0 0 6px 0" }}>
                        {line || "\u00A0"}
                      </p>
                    ))}
                  </div>
                </PrintSection>
              );
            })()}

            {/* 3. 가정에서 함께 하기 (종결모드는 finalHomeMaintenance, 아니면 reportSections) */}
            {isFinalMode ? (() => {
              const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
              const homeClean = stripMarker(info.finalHomeMaintenance);
              if (!homeClean) return null;
              return (
                <PrintSection num={nextSn()} title="가정에서의 유지 방안" accent>
                  <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                    {personalize(homeClean)}
                  </div>
                </PrintSection>
              );
            })() : (
              reportSections && (() => {
                const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
                const homeCoop = stripMarker(reportSections["가정에서 함께 하기"]);
                const fallback = stripMarker(reportSections["일반화 계획 및 가정 협력 방안"]);
                if (homeCoop) {
                  return (
                    <PrintSection num={nextSn()} title="가정에서 함께 하기" accent>
                      <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                        {personalize(homeCoop)}
                      </div>
                    </PrintSection>
                  );
                }
                if (fallback) {
                  return (
                    <PrintSection num={nextSn()} title="일반화 계획 및 가정 협력 방안" accent>
                      <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                        {personalize(fallback)}
                      </div>
                    </PrintSection>
                  );
                }
                return null;
              })()
            )}

            {/* 4. 다음 목표 (중간모드 전용) — 종결모드는 별도 권고사항 섹션 */}
            {!isFinalMode && reportSections && (() => {
              const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
              const nextGoal = stripMarker(reportSections["다음 목표"]);
              const fallback = stripMarker(reportSections["다음 목표 제안"]);
              if (nextGoal) {
                return (
                  <PrintSection num={nextSn()} title="다음 목표" accent>
                    <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                      {personalize(nextGoal)}
                    </div>
                  </PrintSection>
                );
              }
              if (fallback) {
                return (
                  <PrintSection num={nextSn()} title="다음 목표 제안" accent>
                    <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333", whiteSpace: "pre-line" }}>
                      {personalize(fallback)}
                    </div>
                  </PrintSection>
                );
              }
              return null;
            })()}

            {/* ★ [v19 통합] 종결보고서 끝부분 — 앞으로의 방향 (권고사항 + 다음 기관 인계) */}
            {isFinalMode && (() => {
              const stripMarker = (s) => (s || "").replace(/\n*<!--SELECTED:[^>]*-->\s*$/g, "").trim();
              const recClean = stripMarker(info.finalRecommendations);
              const handoverClean = stripMarker(info.finalHandover);
              if (!recClean && !handoverClean) return null;
              return (
                <PrintSection num={nextSn()} title="앞으로의 방향" accent>
                  {/* 권고사항 - 가족·교육진을 위한 권고 (먼저) */}
                  {recClean && (
                    <div style={{ marginBottom: handoverClean ? 14 : 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: PKD, marginBottom: 6 }}>▸ 권고사항</div>
                      <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                        {personalize(recClean).split("\n").map((line, i) => (
                          <p key={`r-${i}`} style={{ margin: line.trim() === "" ? "4px 0" : "0 0 6px 0" }}>
                            {line || "\u00A0"}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 다른 기관 인계 정보 - 외부 이동 시 참고 (다음) */}
                  {handoverClean && (
                    <div style={{ paddingTop: recClean ? 10 : 0, borderTop: recClean ? "0.5pt solid #f0e0e5" : "none" }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: PKD, marginBottom: 6 }}>▸ 다른 기관 이동 시 참고</div>
                      <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7, marginBottom: 8 }}>
                        ※ 유치원·학교·후속 치료 기관 등으로 이동 시 다음 정보가 도움이 됩니다.
                      </div>
                      <div style={{ fontSize: 10.5, lineHeight: 1.85, color: "#333" }}>
                        {personalize(handoverClean).split("\n").map((line, i) => (
                          <p key={`h-${i}`} style={{ margin: line.trim() === "" ? "4px 0" : "0 0 6px 0" }}>
                            {line || "\u00A0"}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </PrintSection>
              );
            })()}

            {/* ★ [종결보고서 전용] 9. 문제행동 변화 (선택) — finalBehaviorChange가 있을 때만 표시 */}
            {/* ★ [중복 제거] 옛 문제행동 표 제거 — 아래 7086번 '주요 문제행동 및 중재' 표가 더 풍부함 (기능 컬럼 포함) */}
                </>
              );
            })()}
          </>
        )}

        {/* ═══ 교수 방법 · 전략 총괄 (IEP 계획안 전용 — PDF 보고서에 없음) ═══ */}
        {/* 7번 교수 방법·전략 총괄 — 새 3번 4열 표에 통합되어 제거 */}
        {/* 8번 세부 목표별 설정 사유 — 모범 IEP 양식에 없으므로 제거 */}

        {/* ═══ 10. 승인서 / 확인 및 서명 ═══ */}
        {/* 두 모드 모두 동일한 디자인 (중간보고서 스타일로 통일) — IEP는 동의 본문만 추가 */}
        {isIepMode ? (
          <div style={{ marginTop: 32, borderTop: `2px solid ${PK}`, paddingTop: 18, pageBreakBefore: "always", breakBefore: "page", pageBreakInside: "avoid", breakInside: "avoid" }} className="signature-section">
            <div style={{ fontSize: 12, fontWeight: 600, color: PKD, marginBottom: 12, letterSpacing: "0.5px", textAlign: "center" }}>개별화 중재 계획안 작성 확인</div>
            {/* IEP 고유: 작성 확인 본문 */}
            <div style={{ textAlign: "center", padding: "10px 0 16px", fontSize: 11, lineHeight: 1.85, color: "#555" }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: "#333" }}>{info.name || "본"} 아동의 {year}년 개별화 교육(IEP)에 대한 계획을 다음과 같이 확인합니다.</div>
              {(() => {
                const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
                return (
                  <div style={{ marginTop: 6 }}>{personalizeText("본 계획안은 아동의 현재 발달 수준과 강점 영역을 토대로 단계적 목표를 설정하여 작성되었습니다.", childName)}</div>
                );
              })()}
            </div>
            {/* 서명 표 (중간보고서와 동일 양식) */}
            <table style={{ width: "75%", margin: "0 auto", borderCollapse: "collapse", fontSize: 11 }} className="signature-table">
              <thead><tr>
                {["구 분", "성 명", "서 명", "일 자"].map(h => <th key={h} style={{ padding: "7px 10px", background: PKL, border: "1px solid #e8d0d6", fontWeight: 600, color: PKD, fontSize: 10, textAlign: "center", letterSpacing: "1px" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[["담당 치료사", info.therapist || "", false], ["기관장", SUPERVISOR_NAME, true]].map(([role, name, isSupervisor], i) => (
                  <tr key={i}>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", fontWeight: 500, background: "#fdf8f9", width: "20%", fontSize: 10 }}>{role}</td>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", width: "25%", color: "#333", fontSize: 11 }}>
                      {name || "(                    )"}
                      {isSupervisor && <div style={{ fontSize: 9, color: "#888", marginTop: 2, fontWeight: 400 }}>BCBA 1-21-55036</div>}
                    </td>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", width: "30%", color: "#ddd", height: 48, fontSize: 10 }}>(인)</td>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", width: "25%", color: "#666", fontSize: 10 }}>{new Date().toLocaleDateString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: "center", fontSize: 10, color: "#aaa", marginTop: 14, lineHeight: 1.6 }}>
              {(() => {
                const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || info.name || "아동";
                return (
                  <>
                    본 계획안은 {info.name} 아동의 현재 발달 수준과 강점 영역을 토대로 작성되었으며,<br/>
                    검단ABA언어행동연구소는 {childName}의 단계적 발달 진전을 위해 체계적 중재를 진행합니다.
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          /* ═══ 서명란 — USER_APP 4076~4097줄 그대로 ═══ */
          <div style={{ marginTop: 32, borderTop: `2px solid ${PK}`, paddingTop: 18, pageBreakBefore: "always", breakBefore: "page", pageBreakInside: "avoid", breakInside: "avoid" }} className="signature-section">
            <div style={{ fontSize: 12, fontWeight: 600, color: PKD, marginBottom: 12, letterSpacing: "0.5px", textAlign: "center" }}>확인 및 서명</div>
            <table style={{ width: "75%", margin: "0 auto", borderCollapse: "collapse", fontSize: 11 }} className="signature-table">
              <thead><tr>
                {["구 분", "성 명", "서 명", "일 자"].map(h => <th key={h} style={{ padding: "7px 10px", background: PKL, border: "1px solid #e8d0d6", fontWeight: 600, color: PKD, fontSize: 10, textAlign: "center", letterSpacing: "1px" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[["담당 치료사", info.therapist || "", false], ["기관장", SUPERVISOR_NAME, true]].map(([role, name, isSupervisor], i) => (
                  <tr key={i}>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", fontWeight: 500, background: "#fdf8f9", width: "20%", fontSize: 10 }}>{role}</td>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", width: "25%", color: "#333", fontSize: 11 }}>
                      {name || "(                    )"}
                      {isSupervisor && <div style={{ fontSize: 9, color: "#888", marginTop: 2, fontWeight: 400 }}>BCBA 1-21-55036</div>}
                    </td>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", width: "30%", color: "#ddd", height: 48, fontSize: 10 }}>(인)</td>
                    <td style={{ padding: "10px 12px", border: "1px solid #e8d0d6", textAlign: "center", width: "25%", color: "#666", fontSize: 10 }}>{new Date().toLocaleDateString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: "center", fontSize: 10, color: "#aaa", marginTop: 14, lineHeight: 1.6 }}>
              {isFinalMode ? (
                <>
                  본 보고서는 {info.name} 아동의 본 센터 치료 전 과정을 종합·정리한 종결 보고서이며,<br/>
                  검단ABA언어행동연구소의 데이터 기반 중재 철학에 따라 분석·기술되었습니다.
                </>
              ) : (() => {
                const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || info.name || "아동";
                return (
                  <>
                    본 보고서는 {info.name} 아동의 IEP에 따라 작성되었으며, 데이터 기반 분석을 통해 {childName}의 강점 영역과 진행 양상을 정리하였습니다.<br/>
                    검단ABA언어행동연구소는 {childName}의 다음 단계 학습을 위한 체계적 중재를 진행합니다.
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* 푸터 - IEP/중간/종결 3가지 모드별 다른 메시지 */}
        <div style={{ marginTop: 20, padding: "14px 16px", background: "#fff", borderRadius: 10, fontSize: 11, lineHeight: 1.7, color: PKD, textAlign: "center", border: `1px solid ${PK}`, pageBreakBefore: "avoid", breakBefore: "avoid", pageBreakInside: "avoid", breakInside: "avoid" }}>
          {isIepMode ? (() => {
            const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
            return `${childName}의 본 IEP는 데이터 기반의 체계적 중재를 통해 단계적으로 진행됩니다.`;
          })() : isFinalMode ? (() => {
            const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
            return `검단ABA언어행동연구소. 본 보고서에 포함된 데이터 기반 분석은 ${childName}의 본 치료 전 과정의 강점 영역과 진행 양상을 정리하여, 다음 단계에서의 활용을 지원합니다.`;
          })() : (() => {
            const childName = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
            return `${childName}의 본 보고 기간 동안 확인된 진행 양상을 토대로, 다음 단계의 중재를 진행합니다.`;
          })()}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: "#999", textAlign: "center", letterSpacing: "0.5px" }}>
          © {SUPERVISOR_TITLE}
        </div>
      </div>

      {/* 인쇄 전용 CSS — USER_APP과 100% 동일 (4140~4207줄) */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-shadow: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; font-size: 10.5pt !important; line-height: 1.65 !important; font-family: 'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif !important; background: #fff !important; orphans: 3 !important; widows: 3 !important; }
          /* ★ [브랜딩] @page에 헤더 + 푸터 자동 추가 */
          @page {
            size: A4 portrait;
            margin: 22mm 14mm 20mm 14mm;
            @top-center {
              content: "검단ABA언어행동연구소";
              font-family: 'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;
              font-size: 8.5pt;
              color: #D4728A;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            @bottom-left {
              content: "검단ABA언어행동연구소";
              font-family: 'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;
              font-size: 7.5pt;
              color: #999;
            }
            @bottom-right {
              content: "Page " counter(page) " / " counter(pages);
              font-family: 'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;
              font-size: 7.5pt;
              color: #999;
            }
          }
          /* ★ [브랜딩] 본문 배경 워터마크 — 흐릿한 대각선 로고 */
          #printable-report::before {
            content: "검단ABA";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 100pt;
            font-weight: 900;
            color: rgba(212, 114, 138, 0.05);
            z-index: 0;
            pointer-events: none;
            letter-spacing: 8px;
            font-family: 'Malgun Gothic','Noto Sans KR',sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-report > * { position: relative; z-index: 1; }
          .no-print { display: none !important; }
          body > div, body > div > div { max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
          #printable-report div { max-width: 100% !important; }
          #printable-report svg { margin-left: auto !important; margin-right: auto !important; }
          #printable-report { padding: 0 !important; margin: 0 !important; border: none !important; border-radius: 0 !important; background: #fff !important; }
          #printable-report > div:first-child { margin-bottom: 12pt !important; padding-bottom: 10pt !important; }
          /* 기본 정보 테이블 */
          #printable-report table:first-of-type { font-size: 11pt !important; margin-bottom: 10pt !important; width: 100% !important; }
          #printable-report table:first-of-type td { padding: 6pt 9pt !important; border: 0.5pt solid #c8b0b8 !important; line-height: 1.6 !important; }
          #printable-report table:first-of-type td:nth-child(odd) { background: #fff !important; font-weight: 600 !important; width: 16% !important; color: #555 !important; font-size: 10.5pt !important; }
          /* Info 표 명시적 규칙 — 캡처 2 스타일 (흰 배경 + 가벼운 회색 테두리) */
          .info-table-main { font-size: 11pt !important; border: 1px solid #eee !important; }
          .info-table-main td { padding: 9pt 12pt !important; font-size: 11pt !important; line-height: 1.6 !important; border: 1px solid #eee !important; background: #fff !important; vertical-align: middle !important; }
          .info-table-main td:nth-child(odd) { font-weight: 600 !important; color: #555 !important; }
          .info-table-main td:nth-child(even) { color: #222 !important; }
          /* 보고서 섹션 컨테이너 — borderTop 있는 div = 본문 4섹션 */
          #printable-report > div[style*="borderTop"], #printable-report > .print-section-accent { border-top: 0.75pt solid #e0c8d0 !important; padding-top: 7pt !important; margin-top: 7pt !important; }
          #printable-report > div[style*="borderTop"] > div:first-child, .print-section-accent-title { font-size: 10.5pt !important; font-weight: 700 !important; color: #8B3A5E !important; margin-bottom: 3pt !important; padding-left: 6pt !important; border-left: 3pt solid #F5A0B1 !important; page-break-after: avoid !important; break-after: avoid !important; }
          /* ★ [페이지 분리 수정] 본문 박스 - 외곽 테두리 제거 + 왼쪽 핑크 라인만 + 페이지 분리 허용 (USER_APP과 동일) */
          #printable-report > div[style*="borderTop"] > div:last-child, .print-section-accent-body { font-size: 9.5pt !important; line-height: 1.8 !important; padding: 7pt 9pt !important; background: #fdf8f9 !important; color: #333 !important; border: none !important; border-left: 3pt solid #F5A0B1 !important; border-radius: 3pt !important; page-break-inside: avoid !important; break-inside: avoid !important; }
          /* SVG */
          svg { max-width: 100% !important; width: auto !important; height: auto !important; max-height: 300pt !important; page-break-inside: avoid !important; break-inside: avoid !important; margin: 0 auto !important; }
          .pdf-chart-section svg { max-height: 280pt !important; width: 100% !important; }
          /* 테이블 */
          table { width: 100% !important; }
          thead { display: table-header-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          /* 차트 섹션 */
          .pdf-chart-section { page-break-before: auto !important; break-before: auto !important; page-break-inside: avoid !important; break-inside: avoid !important; margin-top: 10pt !important; margin-bottom: 10pt !important; }
          .vbmapp-grid { page-break-inside: avoid !important; break-inside: avoid !important; }
          /* 본문 박스 자손 */
          div[style*="border-left"][style*="background"] { page-break-inside: avoid !important; break-inside: avoid !important; }
          tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          p { page-break-inside: avoid !important; break-inside: avoid !important; orphans: 3 !important; widows: 3 !important; }
          /* 표 셀 - USER_APP 4169~4172줄 */
          #printable-report table[style*="borderCollapse"] { font-size: 7.5pt !important; width: 100% !important; table-layout: fixed !important; }
          #printable-report table td, #printable-report table th { padding: 2pt 2.5pt !important; border: 0.5pt solid #c8b0b8 !important; overflow: hidden !important; text-overflow: ellipsis !important; }
          #printable-report table td[style*="width: 2"] { width: 16pt !important; min-width: 16pt !important; max-width: 16pt !important; }
          #printable-report table td[style*="sticky"], #printable-report table th[style*="sticky"] { position: static !important; }
          /* 그리드 레이아웃 - USER_APP 4174~4181줄 */
          div[style*="repeat(4"] { grid-template-columns: repeat(4, 1fr) !important; gap: 5pt !important; }
          div[style*="repeat(4"] > div { padding: 5pt 6pt !important; border-radius: 4pt !important; }
          div[style*="repeat(4"] > div > div:first-child { font-size: 7.5pt !important; }
          div[style*="repeat(4"] > div > div:nth-child(2) { font-size: 13pt !important; }
          div[style*="repeat(4"] > div > div:last-child { font-size: 7.5pt !important; }
          div[style*="1fr 1fr"] { grid-template-columns: 1fr 1fr !important; gap: 8pt !important; }
          div[style*="flexWrap"][style*="fontSize: 11"] { font-size: 7.5pt !important; gap: 5pt !important; }
          div[style*="overflowX"] { overflow: visible !important; max-width: 100% !important; page-break-inside: avoid !important; break-inside: avoid !important; }
          /* 영역별 세부 학습 목표 표 - USER_APP 4183줄 */
          #printable-report > div:last-of-type table td, #printable-report > div:last-of-type table th { font-size: 9pt !important; padding: 3pt 6pt !important; }
          /* 미니 스파크라인 - USER_APP 4190줄 (flex-shrink 보강) */
          svg.dashboard-sparkline { width: 72px !important; height: 22px !important; max-width: 72px !important; min-width: 72px !important; max-height: 22px !important; display: inline-block !important; flex-shrink: 0 !important; }
          /* 미니 라인 차트 - 290x80 고정 (영역별 세부 학습 목표) */
          svg.dashboard-bigchart { width: 290px !important; height: 80px !important; max-width: 100% !important; display: block !important; margin: 0 auto !important; }
          /* dashboard-card 새 페이지 - USER_APP 4199줄 */
          .dashboard-card.pdf-card-break { page-break-before: always !important; break-before: page !important; }
          .dashboard-curriculum.pdf-curr-break { page-break-before: always !important; break-before: page !important; }
          /* 워터마크 - USER_APP 4205~4206줄 */
          .print-watermark-line { display: block !important; width: 100% !important; height: 4px !important; background: linear-gradient(to right, #F5A0B1 0%, #D4728A 50%, #F5A0B1 100%) !important; margin-top: 12pt !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-watermark { display: block !important; text-align: center !important; font-size: 8pt !important; font-weight: 500 !important; color: rgba(212, 114, 138, 0.5) !important; letter-spacing: 1.2px !important; margin-top: 6pt !important; padding-bottom: 4pt !important; }
          /* 전체 최대 너비 */
          #printable-report, #printable-report * { max-width: 100% !important; box-sizing: border-box !important; }
          h3, .print-section-title { page-break-after: avoid !important; break-after: avoid !important; }
          
          /* ★★★ [v19 신규] PDF 인쇄 들쑥날쑥 종합 해결 ★★★ */
          
          /* 1. 제목과 다음 내용이 같은 페이지에 (제목만 외롭게 떨어지지 않게) */
          h1, h2, h3, h4, h5, h6 { 
            page-break-after: avoid !important; 
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          h1 + *, h2 + *, h3 + *, h4 + * { 
            page-break-before: avoid !important; 
            break-before: avoid !important;
          }
          /* ★ [v19+] 섹션 제목(.print-section-title) 다음 형제도 절대 분리 안 됨 */
          .print-section-title + * {
            page-break-before: avoid !important;
            break-before: avoid !important;
          }
          /* 섹션 블록 안에서, 제목 자체는 자식과 떨어질 수 없게 — 첫 자식도 같은 페이지 */
          .print-section-block .print-section-title {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* ★ 섹션 블록 통째 묶기 — 작은 섹션은 통째 다음 페이지로 이동 (제목+본문 분리 방지) */
          .print-section-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* 큰 콘텐츠를 가진 섹션은 분리 허용 (제목만은 본문과 함께 가도록 page-break-after: avoid가 작동) */
          .print-section-block.allow-split {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          /* 제목 + 표 첫 행이 떨어지지 않게 */
          .print-section-title + div table tbody tr:first-child {
            page-break-before: avoid !important;
            break-before: avoid !important;
          }
          
          /* 2. 표 전체가 한 페이지에 (가능하면) */
          table { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important;
          }
          /* 표가 너무 크면 행 단위로 분리 */
          table.allow-break { 
            page-break-inside: auto !important; 
            break-inside: auto !important;
          }
          tr { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important;
            page-break-after: auto !important;
          }
          
          /* 3. 차트는 절대 잘리지 않게 */
          .pdf-chart-section, 
          [class*="chart"],
          [class*="Chart"],
          svg { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important;
          }
          
          /* ★★★ [v19 신규] 차트 잘림 강력 방지 ★★★ */
          /* 모든 차트 컨테이너 - 한 페이지에 강제 */
          .dashboard-card,
          .dashboard-curriculum,
          .dashboard-domain,
          .pdf-chart-section,
          div[class*="chart"],
          div[class*="Chart"],
          svg,
          .recharts-wrapper,
          .recharts-surface {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
          }
          
          /* 차트 + 제목 묶음 — 한 세트로 처리 */
          h3 + .dashboard-card,
          h3 + .pdf-chart-section,
          h4 + .dashboard-card,
          h4 + .pdf-chart-section,
          .print-section-title + .dashboard-card,
          .print-section-title + .pdf-chart-section {
            page-break-before: avoid !important;
            break-before: avoid !important;
          }
          
          /* 차트 컨테이너의 부모도 보호 */
          div:has(> svg.dashboard-bigchart),
          div:has(> svg.dashboard-sparkline),
          div:has(> .recharts-wrapper) {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          /* SVG 자체 - 절대 분리 안 됨 */
          svg.dashboard-bigchart,
          svg.dashboard-sparkline {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
          }
          
          /* 차트 영역 위에 충분한 공간 (잘림 방지) */
          .pdf-chart-section {
            margin-top: 12pt !important;
            margin-bottom: 12pt !important;
          }
          
          /* 4. 섹션 (boxShadow 있는 카드) 가능하면 한 페이지에 */
          div[style*="borderTop"],
          div[style*="border-radius"][style*="padding"],
          .print-section-accent {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          
          /* 5. 짧은 단락은 잘리지 않게 (3줄 이상이면 분리 허용) */
          p, li {
            orphans: 3 !important;
            widows: 3 !important;
          }
          
          /* 6. 첫 페이지 시작 부분 여백 줄이기 */
          #printable-report > *:first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          
          /* 7. 마지막 요소 후 빈 페이지 방지 */
          #printable-report > *:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }
          
          /* 8. 강제 페이지 나눔 (필요한 곳만) */
          .force-page-break { 
            page-break-before: always !important; 
            break-before: page !important; 
          }
          .avoid-page-break { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
          }
          
          /* 9. 이미지/사진 잘림 방지 */
          img { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important;
            max-width: 100% !important;
            height: auto !important;
          }
          
          /* 10. 그리드 컨테이너 - 항목 잘리면 다음 페이지로 */
          div[style*="grid-template-columns"] > * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
        @media screen {
          body { margin: 0; }
          #printable-report { position: relative; }
        }
      `}</style>
    </div>
  );
}

function PrintSection({ num, title, children, boxed, accent, allowSplit }) {
  if (boxed) {
    return (
      <div className="print-section-block" style={{
        marginBottom: 16,
        background: "#FFFAFB",
        borderLeft: `4px solid ${PKD}`,
        borderRadius: 8,
        padding: "14px 18px 16px",
        pageBreakInside: "auto",
        breakInside: "auto"
      }}>
        <div className="print-section-title" style={{ fontSize: 14, fontWeight: 700, color: PKD, marginBottom: 10, letterSpacing: "-0.3px", pageBreakAfter: "avoid", breakAfter: "avoid" }}>
          {title}
        </div>
        <div style={{ pageBreakBefore: "avoid", breakBefore: "avoid" }}>{children}</div>
      </div>
    );
  }
  if (accent) {
    return (
      <div className="print-section-accent print-section-block" style={{ borderTop: "1px solid #f0e0e5", paddingTop: 14, marginTop: 14 }}>
        <div className="print-section-accent-title print-section-title" style={{ fontSize: 13, fontWeight: 600, color: PKD, marginBottom: 8, pageBreakAfter: "avoid", breakAfter: "avoid" }}>
          {title}
        </div>
        <div className="print-section-accent-body" style={{ background: "#fdf8f9", borderRadius: 8, padding: "18px 22px", fontSize: 13, lineHeight: 1.85, whiteSpace: "pre-wrap", pageBreakBefore: "avoid", breakBefore: "avoid" }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className={`print-section-block${allowSplit ? " allow-split" : ""}`} style={{ marginBottom: 18 }}>
      <div className="print-section-title" style={{ fontSize: 14, fontWeight: 700, color: "#222", marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${PK}`, letterSpacing: "-0.3px", pageBreakAfter: "avoid", breakAfter: "avoid" }}>
        {title}
      </div>
      {/* 제목 + 첫 자식이 절대 분리되지 않게 wrap. 본문이 너무 크면 본문 안에서만 분리됨 */}
      <div style={{ pageBreakBefore: "avoid", breakBefore: "avoid" }}>{children}</div>
    </div>
  );
}

const thIep = { padding: "6px 8px", border: `1px solid ${PK}`, background: PKL, color: PKD, fontWeight: 600, fontSize: 10, textAlign: "center", letterSpacing: "0.3px" };
const tdIep = { padding: "6px 8px", border: "1px solid #e0c8d0", fontSize: 10.5, verticalAlign: "top", lineHeight: 1.6 };
const tdIepLabel = { ...tdIep, background: "#fdf8f9", width: "18%" };

const STRATEGY_DESC = {
  "DTT/NET": "구조화된 집중 시도 교수(DTT)와 자연적 환경 교수(NET)를 통합 적용합니다.",
  "DTT": "분리된 교수 단위로 집중적 시도 훈련을 제공합니다 (Discrete Trial Teaching).",
  "NET": "자연스러운 일상 맥락에서 학습 기회를 제공합니다 (Natural Environment Teaching).",
  "에코익 → 맨드 지도 / DTT": "에코익(따라 말하기)을 기초로 맨드(요구) 능력으로 확장합니다.",
  "모방 유도 → 음성 지시 + 시각 촉구": "모방 반응을 유도한 뒤 음성 지시와 시각적 촉구를 단계적으로 결합합니다.",
  "행동 연쇄 세분화 → 시범 제공 → 점진적 독립": "복합 행동을 단계별로 세분화하여 시범·촉구·독립 수행으로 진행합니다.",
  "Shaping": "목표 행동에 근접하는 반응을 점진적으로 강화하여 최종 행동을 형성합니다.",
  "Chaining": "행동 연쇄의 각 단계를 순차적(또는 역순)으로 지도합니다.",
  "PECS": "그림교환 의사소통 체계(Picture Exchange Communication System)로 기능적 의사소통을 지도합니다.",
  "Errorless Teaching": "오류를 최소화하는 촉구 체계로 정확 반응을 형성하고 성공 경험을 축적합니다."
};

function classifyDomain(domain, item) {
  const d = (domain || "") + " " + (item || "");
  if (/선호물|강화제|조건화|reinforcer/i.test(d)) return "reinforcer";
  if (/맨드|Mand|요구|요청/i.test(d)) return "mand";
  if (/택트|Tact|명명|레이블|이름대기/i.test(d)) return "tact";
  if (/에코|Echoic|음성\s*모방|구강|구음|자발\s*발성|spontaneous\s*vocal/i.test(d)) return "echoic";
  if (/인트라|Intra|대화|질문|문답/i.test(d)) return "intraverbal";
  if (/청자|Listener|수용|지시\s*따르기|이해|LRFFC/i.test(d)) return "listener";
  if (/모방|Imitation|동작\s*모방/i.test(d)) return "imitation";
  if (/시각|VP-?MTS|VP\/MTS|매칭|변별/i.test(d)) return "visual";
  if (/놀이|Play|독립\s*놀이/i.test(d)) return "play";
  if (/사회|또래|상호작용|공동주|Joint|합동\s*주시|사회기술/i.test(d)) return "social";
  if (/자조|Self|식사|배변|착의|위생|일상/i.test(d)) return "self_help";
  if (/학습|착석|준비도|학교|규칙|Classroom|Group\s*Skills|Reading|읽기|Writing|쓰기|Math|수학/i.test(d)) return "academic";
  if (/인지|Cognitive|개념|문제\s*해결|논리/i.test(d)) return "cognitive";
  if (/신체|소근육|대근육|운동|motor|신체발달|체력/i.test(d)) return "motor";
  if (/문제\s*행동|행동\s*감소|상동|방해|자기\s*관리|자기관리/i.test(d)) return "behavior";
  return "general";
}

function autoStrategyForDomain(domain, item) {
  const cat = classifyDomain(domain, item);
  switch (cat) {
    case "reinforcer":   return "선호도 평가 (MSWO·PSPA)·조건화·강화제 다양화";
    case "mand":         return "MO 활용 NET·체계적 촉구·시간지연·자발성 강화";
    case "tact":         return "DTT 다중 자극·차이 강화·시각 단서 페이딩";
    case "echoic":       return "Echoic-Mand 전이·즉각 강화·유관 모방";
    case "intraverbal":  return "Intraverbal Web·산문 단서·점진적 페이딩";
    case "listener":     return "수용 변별·점진적 어려움 증가·시각·청각 결합";
    case "imitation":    return "Errorless Teaching·즉각 시범·신체 촉구 페이딩";
    case "visual":       return "VP-MTS·PEAK 대응·시각 단서·차이 강화";
    case "play":         return "NET·또래 시범·자연 강화·놀이 스크립트 페이딩";
    case "social":       return "NET·또래 매개·Video Modeling·자연 강화";
    case "self_help":    return "역방향 연쇄(BC)·시각 스케줄·일상 루틴 통합";
    case "academic":     return "선행 행동 형성·DRO·시각 타이머·정적 강화";
    case "cognitive":    return "DTT·시각 단서·점진적 어려움·논리 구조화";
    case "motor":        return "신체 형성(shaping)·시각 시범·점진적 강도 증가";
    case "behavior":     return "기능평가 기반 FCT·DRA·환경 수정·NCR";
    default:             return "DTT·NET 혼합·체계적 촉구 페이딩";
  }
}

function autoMasteryForDomain(domain, item) {
  const cat = classifyDomain(domain, item);
  switch (cat) {
    case "mand":         return "80%↑ 3회 연속·자발 발생";
    case "tact":         return "80%↑ 2회 연속·다중 자극";
    case "echoic":       return "90%↑ 2회 연속";
    case "intraverbal":  return "80%↑ 2회 연속·다양 단서";
    case "listener":     return "80%↑ 2회 연속·일반화 검증";
    case "imitation":    return "90%↑ 2회 연속·즉시";
    case "visual":       return "85%↑ 2회 연속";
    case "social":       return "70%↑ 3회 연속·또래 다수";
    case "self_help":    return "독립 수행 80%↑ 2회 연속";
    case "academic":     return "80%↑ 2회 연속·구조화";
    case "behavior":     return "기저 대비 50% 감소·2주 유지";
    default:             return "80%↑ 2회 연속";
  }
}

function autoGeneralizationForDomain(domain, item) {
  const cat = classifyDomain(domain, item);
  switch (cat) {
    case "reinforcer":   return "다양한 강화제·자연 환경·자발 사용";
    case "mand":         return "다양한 강화제·여러 양육자·자연 환경에서 자발 사용";
    case "tact":         return "비훈련 자극·실제 사물·다양 각도·다양한 사람";
    case "echoic":       return "다양한 단어·억양 변형·자연 발화 통합";
    case "intraverbal":  return "다양한 화자·새 주제·일상 대화 통합";
    case "listener":     return "비훈련 자극·다양한 환경·다중 인물 지시";
    case "imitation":    return "비훈련 동작·시간차 모방·또래 모방";
    case "visual":       return "비훈련 그림·다양한 매체·실제 사물 매칭";
    case "play":         return "또래 다수·다양 활동·자유놀이·가정 일반화";
    case "social":       return "또래 3명 이상·자유놀이·다양한 활동·가정 일반화";
    case "self_help":    return "가정·외부 환경·다양한 도구·시간 일반화";
    case "academic":     return "그룹 환경·다양한 자료·교사 변화";
    case "cognitive":    return "비훈련 자극·다양한 매체·일상 적용";
    case "motor":        return "다양한 환경·다양한 자료·일상 활동 통합";
    case "behavior":     return "여러 환경·다양 양육자·유지 점검 (1주·1개월)";
    default:             return "가정·또래·다양한 상황에서 일반화 연습";
  }
}

function PrintGoalTaskTable({ goals, listGroup, color, emptyMsg }) {
  const filtered = useMemo(() => goals.filter(g => (g.tasks || []).some(t => (t.listGroup || "1") === listGroup)), [goals, listGroup]);

  const grouped = useMemo(() => {
    const m = {};
    filtered.forEach(g => { if (!m[g.domain]) m[g.domain] = []; m[g.domain].push(g); });
    return m;
  }, [filtered]);

  if (filtered.length === 0) {
    return <div style={{ fontSize: 10.5, color: "#767676", padding: "12px 14px", border: `1px dashed ${color}`, borderRadius: 4, background: "#fafafa", textAlign: "center" }}>{emptyMsg || "항목 없음"}</div>;
  }

  const mastered = listGroup === "2";

  return (
    <>
      {Object.entries(grouped).map(([domain, domainGoals]) => {
        const strategies = [...new Set(domainGoals.map(g => g.strategy || autoStrategyForDomain(g.domain, g.item)))];
        const masteryCrits = [...new Set(domainGoals.map(g => g.masteryCrit || "80% 이상 2회 연속"))];
        const unifiedStrategy = strategies.length === 1 ? strategies[0] : null;
        const unifiedMastery = masteryCrits.length === 1 ? masteryCrits[0] : null;

        return (
          <div key={domain} style={{ marginBottom: 14, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: color, padding: "5px 12px", borderRadius: "4px 4px 0 0", letterSpacing: "0.5px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span>{domain}</span>
              <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.95 }}>
                {unifiedStrategy && <span>교수: {unifiedStrategy}</span>}
                {unifiedStrategy && unifiedMastery && <span style={{ margin: "0 6px", opacity: 0.6 }}>|</span>}
                {unifiedMastery && <span>숙달: {unifiedMastery}</span>}
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
              <thead>
                <tr>
                  <th style={{ ...thIep, width: "28%" }}>영역 목표 (LTO) · 커리큘럼 연계</th>
                  <th style={{ ...thIep, width: "32%" }}>세부 과제 (STO)</th>
                  {!unifiedStrategy && <th style={{ ...thIep, width: "14%" }}>교수 방법</th>}
                  {!unifiedMastery && <th style={{ ...thIep, width: "10%" }}>숙달 기준</th>}
                  <th style={{ ...thIep, width: unifiedStrategy && unifiedMastery ? "40%" : (unifiedStrategy || unifiedMastery ? "26%" : "16%") }}>일반화 전략</th>
                </tr>
              </thead>
              <tbody>
                {domainGoals.map(g => {
                  const tasks = (g.tasks || []).filter(t => (t.listGroup || "1") === listGroup);
                  if (tasks.length === 0) return null;
                  return tasks.map((t, idx) => (
                    <tr key={t.id}>
                      {idx === 0 && (
                        <td rowSpan={tasks.length} style={{ ...tdIep, verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600, marginBottom: 3 }}>{g.item}</div>
                          <div style={{ fontSize: 9, color: "#888", marginBottom: 3 }}>{g.subDomain}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {g.vbmapp && (
                              <span style={{ fontSize: 8.5, padding: "1px 6px", background: "#e6f1fb", color: "#2a6cb2", borderRadius: 4, fontWeight: 700, border: "1px solid #c8dcec" }}>
                                VB-MAPP · {g.vbmapp.v} · L{g.vbmapp.lv}
                              </span>
                            )}
                            {g.esdm && (
                              <span style={{ fontSize: 8.5, padding: "1px 6px", background: "#eaf3de", color: "#4a7316", borderRadius: 4, fontWeight: 700, border: "1px solid #cde0b2" }}>
                                ESDM · {g.esdm.v}
                              </span>
                            )}
                            {g.source && g.source !== "ELCAR" && !g.vbmapp && !g.esdm && (
                              <span style={{ fontSize: 8.5, padding: "1px 6px", background: "#f0f0f0", color: "#555", borderRadius: 4, fontWeight: 600 }}>
                                {g.source}
                              </span>
                            )}
                            {g.listName && (
                              <span style={{ fontSize: 8.5, padding: "1px 6px", background: "#fff5d6", color: "#a87108", borderRadius: 4, fontWeight: 600 }}>
                                {g.listName}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      <td style={{ ...tdIep, fontSize: 10.5 }}>
                        <div style={{ fontWeight: 500, textDecoration: mastered ? "line-through" : "none", textDecorationColor: GREEN }}>{t.name}</div>
                        {mastered && t.masteredAt && (
                          <div style={{ fontSize: 9, color: "#7c9947", marginTop: 2 }}>달성일: {t.masteredAt}</div>
                        )}
                      </td>
                      {idx === 0 && !unifiedStrategy && (
                        <td rowSpan={tasks.length} style={{ ...tdIep, verticalAlign: "top" }}>{g.strategy || autoStrategyForDomain(g.domain, g.item)}</td>
                      )}
                      {idx === 0 && !unifiedMastery && (
                        <td rowSpan={tasks.length} style={{ ...tdIep, fontSize: 9.5, color: "#555", verticalAlign: "top" }}>{g.masteryCrit || "80% 이상 2회 연속"}</td>
                      )}
                      {idx === 0 && (
                        <td rowSpan={tasks.length} style={{ ...tdIep, fontSize: 9.5, verticalAlign: "top" }}>{g.generalization || autoGeneralizationForDomain(g.domain, g.item)}</td>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

function GoalDomainTables() { return null; }

function StrategyConsolidatedTable({ goals }) {
  const byStrategy = useMemo(() => {
    const m = {};
    goals.forEach(g => {
      const s = g.strategy || autoStrategyForDomain(g.domain, g.item);
      if (!m[s]) m[s] = [];
      m[s].push(g);
    });
    return m;
  }, [goals]);

  const strategies = Object.keys(byStrategy);
  if (strategies.length === 0) {
    return <div style={{ fontSize: 10.5, color: "#767676", padding: "12px 14px", border: "1px dashed #e0c8d0", borderRadius: 4, background: "#fafafa", textAlign: "center" }}>교수 방법 정보 없음</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
      <thead>
        <tr>
          <th style={{ ...thIep, width: "28%" }}>교수 방법 · 전략</th>
          <th style={{ ...thIep, width: "22%" }}>적용 영역</th>
          <th style={{ ...thIep, width: "10%" }}>목표 수</th>
          <th style={{ ...thIep, width: "40%" }}>핵심 설명</th>
        </tr>
      </thead>
      <tbody>
        {strategies.map(s => {
          const items = byStrategy[s];
          const domains = [...new Set(items.map(g => g.domain))];
          return (
            <tr key={s}>
              <td style={{ ...tdIep, fontWeight: 600, color: PKD }}>{s}</td>
              <td style={{ ...tdIep, fontSize: 10 }}>
                {domains.map((d, i) => (
                  <div key={d} style={{ fontSize: 9.5, marginBottom: i < domains.length - 1 ? 2 : 0 }}>• {shortDomain(d)}</div>
                ))}
              </td>
              <td style={{ ...tdIep, textAlign: "center", fontWeight: 600 }}>{items.length}개</td>
              <td style={{ ...tdIep, fontSize: 10, lineHeight: 1.6 }}>{STRATEGY_DESC[s] || "목표 특성에 맞는 체계적 중재 기법을 적용합니다."}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DailyTab({ goals, dailyDate, setDailyDate, calcDayRate, addTask, removeTask, renameTask, bumpTask, resetTask, setTaskListGroup, setTaskMeasureMode, setTaskPlannedTrials, setTaskTrial, fillTaskTrials, askConfirm, askPauseReason, clearPendingNext, updateGoal, dailyMemos, setDailyMemo, archiveList, mediaList, setInfo, addHistory, onPrev, onNext }) {
  const [hideMastered, setHideMastered] = useState({ "ELCAR": true, "VB-MAPP": true, "ESDM": true, "기타": true });
  const [hidePaused, setHidePaused] = useState({ "ELCAR": true, "VB-MAPP": true, "ESDM": true, "기타": true });
  const currentMemo = (dailyMemos && dailyMemos[dailyDate]) || "";
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoDraft, setMemoDraft] = useState(currentMemo);
  const [showAllMemos, setShowAllMemos] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const lastSyncedKeyRef = useRef(`${dailyDate}::${currentMemo}`);
  useEffect(() => {
    const externalValue = (dailyMemos && dailyMemos[dailyDate]) || "";
    const key = `${dailyDate}::${externalValue}`;
    if (key !== lastSyncedKeyRef.current && externalValue !== memoDraft) {
      setMemoDraft(externalValue);
      if (externalValue) setMemoOpen(true);
      lastSyncedKeyRef.current = key;
    }
  }, [dailyDate, dailyMemos, memoDraft]);
  const grouped = useMemo(() => {
    const m = {};
    goals.forEach(g => { if (!m[g.domain]) m[g.domain] = []; m[g.domain].push(g); });
    return m;
  }, [goals]);

  const todaySummary = useMemo(() => {
    let recorded = 0, totalRate = 0, rateCount = 0, totalTasks = 0;
    goals.forEach(g => {
      (g.tasks || []).forEach(t => {
        if ((t.listGroup || "1") !== "1") return; // 진행 중만 집계
        totalTasks++;
        const day = t.daily?.[dailyDate];
        const hasTrialData = day && Array.isArray(day.trials) && day.trials.some(x => x === "+" || x === "-");
        const hasLegacyData = day && (day.c > 0 || day.ic > 0);
        if (hasTrialData || hasLegacyData) {
          recorded++;
          const r = calcDayRate(day, t.plannedTrials);
          if (r !== null) { totalRate += r; rateCount++; }
        }
      });
    });
    return {
      recorded, total: totalTasks,
      avgRate: rateCount > 0 ? Math.round(totalRate / rateCount) : null
    };
  }, [goals, dailyDate, calcDayRate]);

  const masteredCount = useMemo(() => {
    let cutoffDate = null;
    const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
    if (cutoffArchives.length > 0 && cutoffArchives[0].savedAt) {
      cutoffDate = cutoffArchives[0].savedAt.slice(0, 10);
    }
    let n = 0;
    goals.forEach(g => (g.tasks || []).forEach(t => {
      if ((t.listGroup || "1") !== "2") return;
      if (cutoffDate && t.masteredAt && t.masteredAt <= cutoffDate) return;
      n++;
    }));
    return n;
  }, [goals, archiveList]);

  const alerts = useMemo(() => {
    const result = [];
    let cutoffDate = null;
    const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
    if (cutoffArchives.length > 0 && cutoffArchives[0].savedAt) {
      cutoffDate = cutoffArchives[0].savedAt.slice(0, 10);
    }
    const findMemos = (dates) => {
      if (!dailyMemos) return [];
      return dates
        .map(d => ({ date: d, memo: dailyMemos[d] }))
        .filter(x => x.memo && x.memo.trim());
    };
    goals.forEach(g => {
      (g.tasks || []).forEach(t => {
        if ((t.listGroup || "1") !== "1") return; // 진행 중만 분석
        const dailyEntries = Object.entries(t.daily || {})
          .filter(([d]) => !cutoffDate || d >= cutoffDate)
          .map(([d, day]) => ({ date: d, rate: calcDayRate(day, t.plannedTrials) }))
          .filter(x => x.rate !== null)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (dailyEntries.length < 3) return; // 데이터 너무 적으면 분석 보류
        const rates = dailyEntries.map(x => x.rate);
        const totalAvg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
        const recentRates = rates.slice(-4); // 최근 4회
        const recentAvg = Math.round(recentRates.reduce((a, b) => a + b, 0) / recentRates.length);
        const last3 = rates.slice(-3); // 가장 최근 3회
        const last3Dates = dailyEntries.slice(-3).map(x => x.date);
        const last4Dates = dailyEntries.slice(-4).map(x => x.date);
        const last6Dates = dailyEntries.slice(-6).map(x => x.date);

        if (last3.length === 3 && last3.every(r => r >= 80)) {
          result.push({
            type: "soonMaster",
            goalId: g.id, taskId: t.id,
            goalName: g.item, taskName: t.name,
            domain: g.domain,
            message: `최근 3회 연속 ${last3.join("·")}%`,
            action: "다음 단계 준비 또는 일반화 검토 권장",
            relatedMemos: findMemos(last3Dates)
          });
        }
        else if (rates.length >= 6) {
          const earlier = rates.slice(-6, -3);
          const earlierAvg = Math.round(earlier.reduce((a, b) => a + b, 0) / earlier.length);
          const latestAvg = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length);
          if (earlierAvg - latestAvg >= 30) {
            result.push({
              type: "suddenDrop",
              goalId: g.id, taskId: t.id,
              goalName: g.item, taskName: t.name,
              domain: g.domain,
              message: `이전 평균 ${earlierAvg}% → 최근 ${latestAvg}% (${earlierAvg - latestAvg}%p 하락)`,
              action: "긴급 점검: 강화 체계·촉구 수준·환경 변화 확인 권장",
              relatedMemos: findMemos(last3Dates)  // 하락한 최근 3일 메모만
            });
          }
          else if (recentRates.length >= 4 && recentAvg < 50) {
            result.push({
              type: "noProgress",
              goalId: g.id, taskId: t.id,
              goalName: g.item, taskName: t.name,
              domain: g.domain,
              message: `최근 ${recentRates.length}회 평균 ${recentAvg}%`,
              action: "중재 전략 재검토 또는 STO 분할 권장",
              relatedMemos: findMemos(last4Dates)
            });
          }
        }
        else if (recentRates.length >= 4 && recentAvg < 50) {
          result.push({
            type: "noProgress",
            goalId: g.id, taskId: t.id,
            goalName: g.item, taskName: t.name,
            domain: g.domain,
            message: `최근 ${recentRates.length}회 평균 ${recentAvg}%`,
            action: "중재 전략 재검토 또는 STO 분할 권장",
            relatedMemos: findMemos(last4Dates)
          });
        }
      });
    });
    return result;
  }, [goals, calcDayRate, dailyMemos, archiveList]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  if (goals.length === 0) {
    return (
      <div style={{ ...CS, textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 44, marginBottom: 10, opacity: 0.6 }}>📊</div>
        <div style={{ fontSize: 15, color: "#888", marginBottom: 6, fontWeight: 500 }}>IEP 목표가 아직 없습니다</div>
        <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.7 }}>
          [② IEP 설정] 탭에서 영역 목표를 먼저 추가해야<br/>이곳에 데일리 데이터 시트가 나타납니다.
        </div>
        <button style={{ ...BP, marginTop: 18 }} onClick={onPrev}>← IEP 설정으로 이동</button>
      </div>
    );
  }

  return (
    <div>
      {/* 날짜 선택 + 요약 + 증거물 */}
      <div className="responsive-daily-header" style={{ ...CS, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center" }}>
        <div>
          <label style={LS}>기록 날짜</label>
          <input type="date" style={{ ...IS, width: 170, fontWeight: 600, color: PKD }} value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 18, justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#767676", marginBottom: 3 }}>오늘 기록한 과제 (진행 중)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: PKD }}>{todaySummary.recorded} <span style={{ fontSize: 14, color: "#aaa", fontWeight: 400 }}>/ {todaySummary.total}</span></div>
          </div>
          <div style={{ width: 1, background: "#e8d0d6" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#767676", marginBottom: 3 }}>평균 정반응률</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: todaySummary.avgRate === null ? "#ccc" : todaySummary.avgRate >= 80 ? GREEN : todaySummary.avgRate >= 50 ? BLUE : ORANGE }}>
              {todaySummary.avgRate === null ? "—" : `${todaySummary.avgRate}%`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <div className="hide-on-mobile" style={{ fontSize: 9.5, color: "#767676", textAlign: "right", lineHeight: 1.5 }}>
            💡 셀: <b style={{ color: GREEN }}>＋</b> → <b style={{ color: RED }}>－</b> → <b style={{ color: "#777" }}>NA</b> → 빈칸
          </div>
          
          {/* ★ [v19 신규] 증거물 진행도 (4개월 기반) — 클릭하면 갤러리 펼침 */}
          {(() => {
            const list = mediaList || [];
            const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const recentMedia = list.filter(m => m.uploadedAt >= fourMonthsAgo);
            const filledCount = recentMedia.length;
            const maxCount = 20;
            const percentage = Math.round((filledCount / maxCount) * 100);
            
            return (
              <button
                onClick={() => setShowMediaGallery(!showMediaGallery)}
                style={{ 
                  fontSize: 9, color: "#666", padding: "6px 10px", 
                  background: "#fdf8f9", borderRadius: 6, 
                  border: `1px solid ${PKL}`, 
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: 140
                }}>
                <div style={{ marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>📸 증거물: {filledCount}/{maxCount}</span>
                  <span style={{ fontSize: 8 }}>{showMediaGallery ? "▲" : "▼"}</span>
                </div>
                <div style={{ width: "100%", height: 6, background: "#e8d0d6", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${percentage}%`, height: "100%", background: percentage >= 80 ? "#10b981" : percentage >= 50 ? "#f59e0b" : "#dc2626", transition: "width 0.3s" }} />
                </div>
                <div style={{ marginTop: 2, fontSize: 8, color: "#aaa" }}>{percentage}% (클릭하여 관리)</div>
              </button>
            );
          })()}
        </div>
      </div>

      {/* ★ [v19 신규] 증거물 갤러리 (펼침/접힘) */}
      {showMediaGallery && (
        <div style={{ ...CS, marginBottom: 18, background: "#f9f5f7", border: `1px solid ${PKL}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: PKD }}>📸 평가 증거물 첨부</h3>
            <button
              onClick={() => setShowMediaGallery(false)}
              style={{ fontSize: 10, padding: "4px 10px", background: "#fff", border: `1px solid ${PKL}`, borderRadius: 4, color: "#666", cursor: "pointer" }}>
              ✕ 닫기
            </button>
          </div>
          
          {/* 파일 첨부 */}
          <div style={{ marginBottom: 16 }}>
            <input 
              type="file" 
              accept="image/*,video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                if (file.size > 2 * 1024 * 1024) {
                  alert("❌ 파일 크기는 2MB 이하여야 합니다.");
                  return;
                }
                
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const base64 = ev.target?.result;
                  const list = mediaList || [];
                  const newMedia = {
                    id: "m_" + Date.now(),
                    name: file.name,
                    type: file.type.startsWith("image") ? "image" : "video",
                    base64: base64,
                    uploadedAt: dailyDate  // ★ 데일리 탭의 현재 날짜로 저장!
                  };
                  
                  const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                  
                  let updated = [newMedia, ...list]
                    .filter(m => m.uploadedAt >= fourMonthsAgo)
                    .slice(0, 20);
                  
                  setInfo(p => ({ ...p, mediaList: updated }));
                  if (addHistory) addHistory("media_upload", `증거물 추가 (${dailyDate}): ${file.name}`, null, file.name, "mediaList");
                  e.target.value = "";  // input 초기화
                };
                reader.readAsDataURL(file);
              }}
              style={{ width: "100%", padding: "10px", fontSize: 12, border: `1px solid ${PKL}`, borderRadius: 6, background: "#fff" }}
            />
            <div style={{ fontSize: 10, color: "#888", marginTop: 6 }}>
              💡 회기 사진/영상 첨부 (최대 2MB, 최근 20개, 4개월 후 자동 삭제) · 첨부 날짜: <b style={{ color: PKD }}>{dailyDate}</b>
            </div>
          </div>

          {/* 첨부된 파일 목록 */}
          {(mediaList && mediaList.length > 0) ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 10 }}>
                첨부된 파일 ({mediaList.length}개)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                {mediaList.map((media) => (
                  <div key={media.id} style={{
                    background: "#fff",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: `1px solid ${PKL}`,
                    transition: "transform 0.2s"
                  }}>
                    {media.type === "image" ? (
                      <img src={media.base64} alt={media.name} style={{ width: "100%", height: 100, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: 100, background: "#f0e0e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>
                        🎥
                      </div>
                    )}
                    <div style={{ padding: 8, borderTop: `1px solid ${PKL}` }}>
                      <div style={{ fontSize: 10, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                        {media.name}
                      </div>
                      <div style={{ fontSize: 9, color: "#aaa", marginBottom: 6 }}>
                        📅 {media.uploadedAt}
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm(`${media.name}를 삭제하시겠습니까?`)) {
                            const updated = (mediaList || []).filter((m) => m.id !== media.id);
                            setInfo(p => ({ ...p, mediaList: updated }));
                            if (addHistory) addHistory("media_delete", `증거물 삭제: ${media.name}`, media.name, null, "mediaList");
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "4px 6px",
                          fontSize: 10,
                          background: "#ffe8e8",
                          border: "none",
                          borderRadius: 4,
                          color: "#c41e1e",
                          cursor: "pointer",
                          fontWeight: 600
                        }}>
                        🗑 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: "center", background: "#fff", borderRadius: 8, border: `1px solid ${PKL}` }}>
              <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.5 }}>📷</div>
              <div style={{ fontSize: 12, color: "#888" }}>아직 증거물이 없습니다. 회기 중 사진/영상을 첨부해보세요!</div>
            </div>
          )}
        </div>
      )}

      {/* ★ [v19 신규] 고급 분석: 추세선 + 예측 + 통계 */}
      <div style={{ marginBottom: 18, padding: 16, background: "#f9f5f7", borderRadius: 10, border: `1px solid ${PKL}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: PKD, marginBottom: 12 }}>📈 목표별 진행 분석</div>
        
        {/* 통계 표시 */}
        {(() => {
          const allData = [];
          goals.forEach(g => {
            (g.tasks || []).filter(t => t.showInDaily && t.isActive).forEach(t => {
              Object.entries(t.daily || {}).forEach(([date, trials]) => {
                if (!Array.isArray(trials)) return;
                const correct = trials.filter(x => x === "○").length;
                const total = trials.filter(x => x === "○" || x === "×").length;
                if (total > 0) {
                  allData.push({ date, correct, total, rate: Math.round((correct / total) * 100) });
                }
              });
            });
          });
          
          allData.sort((a, b) => a.date.localeCompare(b.date));
          const recent30 = allData.slice(-30);
          
          const stats = {
            total: recent30.length,
            average: recent30.length > 0 ? Math.round(recent30.reduce((s, d) => s + d.rate, 0) / recent30.length) : 0,
            max: recent30.length > 0 ? Math.max(...recent30.map(d => d.rate)) : 0,
            min: recent30.length > 0 ? Math.min(...recent30.map(d => d.rate)) : 0,
            trend: recent30.length >= 2 ? (recent30[recent30.length - 1].rate - recent30[0].rate) : 0
          };
          
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
                <div style={{ background: "#fff", padding: 10, borderRadius: 8, textAlign: "center", border: "1px solid #f0e0e5" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>최근 30일</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: PKD }}>{stats.total}회</div>
                </div>
                <div style={{ background: "#fff", padding: 10, borderRadius: 8, textAlign: "center", border: "1px solid #f0e0e5" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>평균 정반응률</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stats.average >= 70 ? "#10b981" : stats.average >= 50 ? "#f59e0b" : "#dc2626" }}>{stats.average}%</div>
                </div>
                <div style={{ background: "#fff", padding: 10, borderRadius: 8, textAlign: "center", border: "1px solid #f0e0e5" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>최고 / 최저</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{stats.max}% / {stats.min}%</div>
                </div>
                <div style={{ background: "#fff", padding: 10, borderRadius: 8, textAlign: "center", border: "1px solid #f0e0e5" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>추세</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stats.trend > 0 ? "#10b981" : stats.trend < 0 ? "#dc2626" : "#888" }}>
                    {stats.trend > 0 ? "↑" : stats.trend < 0 ? "↓" : "→"} {Math.abs(stats.trend)}%
                  </div>
                </div>
              </div>

              {/* 미니 그래프 (ASCII) */}
              <div style={{ fontSize: 10, color: "#666", fontFamily: "monospace", lineHeight: 1.4, padding: 10, background: "#fff", borderRadius: 6, overflow: "auto" }}>
                {(() => {
                  const recent14Data = [];
                  goals.forEach(g => {
                    (g.tasks || []).filter(t => t.showInDaily && t.isActive).forEach(t => {
                      Object.entries(t.daily || {}).forEach(([date, trials]) => {
                        if (!Array.isArray(trials)) return;
                        const correct = trials.filter(x => x === "○").length;
                        const total = trials.filter(x => x === "○" || x === "×").length;
                        if (total > 0) {
                          recent14Data.push({ date, rate: Math.round((correct / total) * 100) });
                        }
                      });
                    });
                  });
                  
                  recent14Data.sort((a, b) => a.date.localeCompare(b.date));
                  const recent14 = recent14Data.slice(-14);
                  
                  if (recent14.length === 0) {
                    return "📊 아직 데이터가 없습니다. 데이터를 입력하면 그래프가 표시됩니다.";
                  }
                  
                  return (
                    <>
                      <div style={{ marginBottom: 8 }}>최근 14일 추세 (각 █ = 10%)</div>
                      {recent14.map((d, i) => (
                        <div key={i}>
                          {d.date} {i === recent14.length - 1 ? "→" : "  "} 
                          {"█".repeat(Math.round(d.rate / 10))}
                          {"░".repeat(10 - Math.round(d.rate / 10))} {d.rate}%
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>

              <div style={{ fontSize: 10, color: "#888", marginTop: 8, fontStyle: "italic" }}>
                💡 팁: 추세선이 우상향(↑)이면 진전이 있는 것입니다. 70% 이상 2일 연속 달성 시 자동 습득 완료!
              </div>
            </>
          );
        })()}
      </div>

      {/* ★ [A] 보고서 발행 알림 배너 — 가장 최근 보관본의 시점 알림 */}
      {/* ★ [종결보관본 제외] isFinal=true는 cutoff 기준에 사용하지 않음 */}
      {(() => {
        const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
        if (cutoffArchives.length === 0 || !cutoffArchives[0].savedAt) return null;
        const cutoff = cutoffArchives[0].savedAt.slice(0, 10);
        const isPast = dailyDate <= cutoff;
        return isPast ? (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#f5f0e6", borderLeft: "3px solid #a87108", borderRadius: 6, fontSize: 11, color: "#604515", lineHeight: 1.65 }}>
            ⚠ <b>지난 차수 데이터 ({dailyDate})</b> — 이 날짜는 {cutoff} 보고서 발행 <b>이전</b>입니다. 입력은 가능하지만 다음 보고서의 그래프에 반영되지 않습니다.
          </div>
        ) : (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#eff5fc", borderLeft: "3px solid #2a6cb2", borderRadius: 6, fontSize: 11, color: "#1d4d80", lineHeight: 1.65 }}>
            📌 <b>{cutoff} 보고서 발행</b> — 이후 입력 데이터는 다음 차수의 보고서 그래프에 반영됩니다.
          </div>
        );
      })()}

      {/* ★ 오늘의 메모 토글 — 날짜별 자유 텍스트 메모 (예: 컨디션, 특이사항) */}
      <div style={{ marginBottom: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setMemoOpen(o => !o)}
          style={{
            background: currentMemo ? "#fff5f6" : "#fff",
            border: `1px solid ${currentMemo ? PK : "#e0d0d4"}`,
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 11.5,
            fontWeight: 600,
            color: currentMemo ? PKD : "#888",
            cursor: "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }}>
          📝 오늘의 메모
          {currentMemo && (
            <span style={{ fontSize: 9, padding: "1px 6px", background: PK, color: "#fff", borderRadius: 8, fontWeight: 700 }}>작성됨</span>
          )}
          <span style={{ fontSize: 10, color: "#aaa" }}>{memoOpen ? "▲" : "▼"}</span>
        </button>
        {/* ★ [신규] 전체 메모 보기 버튼 */}
        {(() => {
          const allDates = Object.keys(dailyMemos || {}).filter(d => (dailyMemos[d] || "").trim()).sort().reverse();
          if (allDates.length === 0) return null;
          return (
            <button
              onClick={() => setShowAllMemos(true)}
              style={{
                background: "#fff",
                border: "1px solid #e0d0d4",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 11.5,
                fontWeight: 500,
                color: "#666",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}>
              📋 전체 메모 ({allDates.length})
            </button>
          );
        })()}
        {memoOpen && (
          <div style={{ marginTop: 6, background: "#fff", border: "1px solid #e8d0d6", borderRadius: 10, padding: "10px 12px" }}>
            {/* ★ [신규] 빠른 칩 — 자주 쓰는 키워드 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8, paddingBottom: 8, borderBottom: "1px dashed #f0e0e3" }}>
              <span style={{ fontSize: 9.5, color: "#888", padding: "3px 6px 0 0" }}>빠른 입력:</span>
              {[
                "✓ 컨디션 좋음",
                "✗ 컨디션 저조",
                "🌟 적극 참여",
                "😴 졸림",
                "💢 정서 불안정",
                "🔄 강화제 변경",
                "🌧 날씨·환경 영향",
                "👨‍👩 보호자 동반",
                "🎯 새 목표 시작",
                "📚 새 학습 자료"
              ].map((label, i) => (
                <button key={i}
                  onClick={() => {
                    const newDraft = memoDraft ? `${memoDraft.trim()}\n${label}` : label;
                    setMemoDraft(newDraft);
                    setDailyMemo(dailyDate, newDraft);
                  }}
                  style={{
                    padding: "2px 8px", fontSize: 10,
                    border: "1px solid #f0d0d6",
                    borderRadius: 12,
                    background: "#fff5f6",
                    color: PKD,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={memoDraft}
              onChange={e => setMemoDraft(e.target.value)}
              onBlur={() => setDailyMemo(dailyDate, memoDraft)}
              placeholder={`오늘 ${dailyDate}의 메모 — 칩 클릭 또는 자유 입력 (자동 저장)`}
              style={{
                width: "100%",
                minHeight: 60,
                padding: "8px 10px",
                fontSize: 12,
                fontFamily: "inherit",
                lineHeight: 1.55,
                color: "#444",
                border: "1px solid #f0e0e3",
                borderRadius: 6,
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box"
              }}
            />
            <div style={{ marginTop: 4, fontSize: 9.5, color: "#aaa", textAlign: "right" }}>
              ✦ 입력 후 다른 곳을 클릭하면 자동 저장됩니다
            </div>
          </div>
        )}
      </div>

      {/* ★ [신규] 전체 메모 보기 모달 */}
      {showAllMemos && (() => {
        const allDates = Object.keys(dailyMemos || {})
          .filter(d => (dailyMemos[d] || "").trim())
          .sort()
          .reverse();
        return (
          <div
            onClick={() => setShowAllMemos(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: 20
            }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 12,
                maxWidth: 600,
                width: "100%",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 8px 30px rgba(0,0,0,0.2)"
              }}>
              <div style={{
                padding: "16px 20px",
                background: `linear-gradient(135deg, ${PK} 0%, ${PKD} 100%)`,
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>📋 전체 회기 메모</div>
                  <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>{allDates.length}개 메모 · 최신순</div>
                </div>
                <button
                  onClick={() => setShowAllMemos(false)}
                  style={{
                    background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
                    width: 30, height: 30, borderRadius: 8,
                    fontSize: 16, cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                  }}
                  title="닫기">✕</button>
              </div>
              <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
                {allDates.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#888", fontSize: 12 }}>
                    아직 작성된 메모가 없습니다.
                  </div>
                ) : (
                  allDates.map(d => {
                    const memo = dailyMemos[d];
                    const isCurrent = d === dailyDate;
                    return (
                      <div key={d} style={{
                        marginBottom: 10,
                        padding: 12,
                        background: isCurrent ? "#fff5f6" : "#fafafa",
                        border: `1px solid ${isCurrent ? PK : "#eee"}`,
                        borderRadius: 8,
                        cursor: "pointer"
                      }}
                      onClick={() => {
                        setDailyDate(d);
                        setShowAllMemos(false);
                      }}
                      title="클릭하면 그 날짜로 이동">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: isCurrent ? PKD : "#555" }}>
                            {d} {isCurrent && <span style={{ fontSize: 9, padding: "1px 6px", background: PK, color: "#fff", borderRadius: 6, marginLeft: 4 }}>오늘</span>}
                          </div>
                          <div style={{ fontSize: 9.5, color: "#aaa" }}>클릭 → 이동</div>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#444", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                          {memo}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 습득 완료 자동 이동 알림 */}
      {masteredCount > 0 && (
        <div style={{ background: "linear-gradient(135deg, #eaf3de 0%, #dde9c5 100%)", border: `1.5px solid ${GREEN}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>✓</div>
          <div style={{ flex: 1, fontSize: 11.5, color: "#4a7316", lineHeight: 1.6 }}>
            <div><b>{masteredCount}개 세부 과제가 습득 완료로 이동</b>되었습니다.</div>
            <div style={{ marginTop: 6 }}>영역목표 카드의 🎉 배너에서 <b>다음 List를 입력</b>하거나, 더 진행하지 않으면 <b>완료</b>를 눌러 영역목표를 종료할 수 있습니다.</div>
          </div>
        </div>
      )}

      {/* ★ [자동 알림] 진전없음/곧숙달/갑작스런하락 패턴 감지 */}
      {alerts.length > 0 && (() => {
        const noProg = alerts.filter(a => a.type === "noProgress");
        const drop = alerts.filter(a => a.type === "suddenDrop");
        const soonM = alerts.filter(a => a.type === "soonMaster");
        const counts = [];
        if (drop.length) counts.push(`긴급 점검 ${drop.length}`);
        if (noProg.length) counts.push(`진전 없음 ${noProg.length}`);
        if (soonM.length) counts.push(`곧 숙달 ${soonM.length}`);
        return (
          <div style={{ background: "#fff8ec", border: `1.5px solid #f5b942`, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setAlertsExpanded(v => !v)}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5b942", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>📋</div>
              <div style={{ flex: 1, fontSize: 11.5, color: "#7c5a08", lineHeight: 1.6 }}>
                <b>케이스 검토 알림 {alerts.length}건</b> — {counts.join(" · ")}
              </div>
              <button style={{ fontSize: 11, padding: "4px 10px", border: `1px solid #f5b942`, background: "#fff", color: "#7c5a08", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                {alertsExpanded ? "접기 ▲" : "자세히 ▼"}
              </button>
            </div>
            {alertsExpanded && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #f5b942", display: "flex", flexDirection: "column", gap: 8 }}>
                {alerts.map((a, i) => {
                  const meta = a.type === "suddenDrop"
                    ? { icon: "⚠", color: "#c0392b", bg: "#fff5f5", border: "#e7b3b3", label: "긴급 점검" }
                    : a.type === "noProgress"
                      ? { icon: "📋", color: "#7c5a08", bg: "#fffbf0", border: "#e8cf8a", label: "진전 없음" }
                      : { icon: "🎯", color: "#2e7d32", bg: "#f0f9f0", border: "#b6d8b6", label: "곧 숙달" };
                  return (
                    <div key={i} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 9.5, padding: "1px 7px", background: meta.color, color: "#fff", borderRadius: 8, fontWeight: 700 }}>{meta.icon} {meta.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{shortDomain(a.domain)} · {a.goalName}</span>
                        <span style={{ fontSize: 10, color: "#888" }}>— {a.taskName}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: meta.color, marginBottom: 2 }}>{a.message}</div>
                      <div style={{ fontSize: 10.5, color: "#555", fontStyle: "italic" }}>→ {a.action}</div>
                      {/* ★ 관련 날짜의 메모 자동 매칭 표시 */}
                      {a.relatedMemos && a.relatedMemos.length > 0 && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${meta.border}`, fontSize: 10, color: "#666", lineHeight: 1.5 }}>
                          {a.relatedMemos.map((m, mi) => (
                            <div key={mi} style={{ marginBottom: mi < a.relatedMemos.length - 1 ? 3 : 0 }}>
                              <span style={{ color: meta.color, fontWeight: 700 }}>❧ {m.date.slice(5).replace("-", "/")}</span>
                              <span style={{ color: "#888", margin: "0 5px" }}>—</span>
                              <span style={{ color: "#444" }}>{m.memo}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* 영역목표 카드들 — 커리큘럼 → 영역 2단계 그룹화 */}
      {(() => {
        const bySource = { "ELCAR": [], "VB-MAPP": [], "ESDM": [], "기타": [] };
        goals.forEach(g => {
          const src = g.source || "ELCAR";
          if (bySource[src]) bySource[src].push(g);
          else bySource["기타"].push(g);
        });
        const curriculumMeta = [
          { src: "ELCAR",   meta: CURR_COLORS.elcar  },
          { src: "VB-MAPP", meta: CURR_COLORS.vbmapp },
          { src: "ESDM",    meta: CURR_COLORS.esdm   },
          { src: "기타",     meta: CURR_COLORS.other  }
        ];
        return curriculumMeta.map(({ src, meta }) => {
          const items = bySource[src];
          if (items.length === 0) return null;
          const masteredCount = items.filter(g => g.status === "mastered").length;
          const isHidden = hideMastered[src] !== false;  // 기본 true
          const pausedTasksList = [];
          items.forEach(g => {
            if (g.status === "mastered") return;
            (g.tasks || []).forEach(t => {
              if (t.listGroup === "paused") pausedTasksList.push({ goal: g, task: t });
            });
          });
          const pausedCount = pausedTasksList.length;
          const isPausedHidden = hidePaused[src] !== false;  // 기본 true
          const visibleItems = items.filter(g => g.status !== "mastered");
          const groupedByDomain = {};
          visibleItems.forEach(g => {
            const key = g.domain || "(영역 없음)";
            if (!groupedByDomain[key]) groupedByDomain[key] = [];
            groupedByDomain[key].push(g);
          });
          return (
            <div key={src} style={{ marginBottom: 16, padding: 12, background: meta.bg, border: `2px solid ${meta.accent}`, borderRadius: 8 }}>
              {/* 커리큘럼 헤더 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 6, borderBottom: `1.5px solid ${meta.accent}`, gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: meta.deep }}>● {meta.label} 평가</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: meta.deep, opacity: 0.8 }}>
                    {visibleItems.length}개 목표 · {Object.keys(groupedByDomain).length}개 영역
                    {masteredCount > 0 && isHidden && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: meta.deep, opacity: 0.7 }}>
                        (완료 {masteredCount}개 숨김)
                      </span>
                    )}
                    {pausedCount > 0 && isPausedHidden && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#a87108", opacity: 0.85 }}>
                        (중단 {pausedCount}개 숨김)
                      </span>
                    )}
                  </span>
                  {masteredCount > 0 && (
                    <button
                      onClick={() => setHideMastered(prev => ({ ...prev, [src]: !isHidden }))}
                      title={isHidden ? "완료된 목표를 펼쳐서 보기" : "완료된 목표 숨기기"}
                      style={{
                        padding: "3px 9px",
                        background: isHidden ? "#fff" : meta.deep,
                        color: isHidden ? meta.deep : "#fff",
                        border: `1.5px solid ${meta.deep}`,
                        borderRadius: 5,
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap"
                      }}>
                      {isHidden ? `✅ 완료 ${masteredCount} 숨김` : `❌ 완료 ${masteredCount} 펼침`}
                    </button>
                  )}
                  {pausedCount > 0 && (
                    <button
                      onClick={() => setHidePaused(prev => ({ ...prev, [src]: !isPausedHidden }))}
                      title={isPausedHidden ? "중단된 과제를 펼쳐서 보기" : "중단된 과제 숨기기"}
                      style={{
                        padding: "3px 9px",
                        background: isPausedHidden ? "#fff" : "#a87108",
                        color: isPausedHidden ? "#a87108" : "#fff",
                        border: `1.5px solid #a87108`,
                        borderRadius: 5,
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap"
                      }}>
                      {isPausedHidden ? `⏸ 중단 ${pausedCount} 숨김` : `❌ 중단 ${pausedCount} 펼침`}
                    </button>
                  )}
                </div>
              </div>
              {/* ★ [중단된 과제 모음] — 토글 OFF일 때만 펼쳐짐 (커리큘럼 박스 맨 위, 완료 모음보다 먼저) */}
              {pausedCount > 0 && !isPausedHidden && (() => {
                const sorted = [...pausedTasksList].sort((a, b) => {
                  const aDomKey = getDomainOrderKey(a.goal.domain);
                  const bDomKey = getDomainOrderKey(b.goal.domain);
                  if (aDomKey !== bDomKey) return aDomKey - bDomKey;
                  const aDom = a.goal.domain || "";
                  const bDom = b.goal.domain || "";
                  if (aDom !== bDom) return aDom.localeCompare(bDom);
                  const aSub = a.goal.subDomain || "";
                  const bSub = b.goal.subDomain || "";
                  if (aSub !== bSub) return aSub.localeCompare(bSub);
                  const aGid = a.goal.id || "";
                  const bGid = b.goal.id || "";
                  if (aGid !== bGid) return aGid.localeCompare(bGid);
                  return (a.task.name || "").localeCompare(b.task.name || "");
                });
                const pausedByDomain = {};
                sorted.forEach(({ goal: pg, task: pt }) => {
                  const key = pg.domain || "(영역 없음)";
                  if (!pausedByDomain[key]) pausedByDomain[key] = [];
                  pausedByDomain[key].push({ goal: pg, task: pt });
                });
                return (
                  <div style={{ marginBottom: 12, padding: 10, background: "#fcf9ee", border: `1.5px solid #e5d8a8`, borderRadius: 6 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#a87108", marginBottom: 8, paddingBottom: 4, borderBottom: "1px dashed #e5d8a8" }}>
                      ⏸ 중단된 과제 ({pausedCount}개)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(pausedByDomain).map(([domain, entries]) => (
                        <div key={domain} style={{ background: "#fff", border: "1px solid #e5d8a8", borderRadius: 5, padding: "6px 10px" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a87108", marginBottom: 4 }}>{shortDomain(domain) || domain}</div>
                          {entries.map(({ goal: pg, task: pt }) => (
                            <div key={pt.id} style={{ marginBottom: 6, paddingLeft: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10.5, color: "#888" }}>{pg.item}</span>
                                <span style={{ fontSize: 10.5, color: "#999" }}>›</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{pt.name}</span>
                                <span style={{ fontSize: 9, padding: "1px 5px", background: "#a87108", color: "#fff", borderRadius: 8, fontWeight: 700 }}>중단</span>
                                <button
                                  onClick={() => setTaskListGroup && setTaskListGroup(pg.id, pt.id, "1")}
                                  title="이 과제를 다시 진행 중으로 되돌리기"
                                  style={{
                                    marginLeft: "auto", padding: "2px 7px",
                                    background: "#fff", color: "#666",
                                    border: "1px solid #ccc", borderRadius: 5,
                                    fontSize: 9.5, fontWeight: 500,
                                    cursor: "pointer", fontFamily: "inherit"
                                  }}>
                                  ↩ 재개
                                </button>
                              </div>
                              {pt.pauseReason && (
                                <div style={{ fontSize: 9.5, color: "#8a6020", paddingLeft: 4, lineHeight: 1.55 }}>
                                  <span style={{ fontWeight: 700 }}>사유:</span> {pt.pauseReason}
                                  {pt.pausedAt && <span style={{ marginLeft: 6, color: "#aa9968", fontSize: 9 }}>· {pt.pausedAt}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* ★ [완료된 목표 모음] — 토글 OFF일 때만 펼쳐짐 (커리큘럼 박스 맨 위) */}
              {masteredCount > 0 && !isHidden && (() => {
                let cutoffDate = null;
                const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
                if (cutoffArchives.length > 0 && cutoffArchives[0].savedAt) {
                  cutoffDate = cutoffArchives[0].savedAt.slice(0, 10);
                }
                const masteredGoals = sortGoals(items.filter(g => {
                  if (g.status !== "mastered") return false;
                  if (cutoffDate && g.masteredAt && g.masteredAt <= cutoffDate) return false;
                  return true;
                }));
                if (masteredGoals.length === 0) return null;
                const masteredByDomain = {};
                masteredGoals.forEach(g => {
                  const key = g.domain || "(영역 없음)";
                  if (!masteredByDomain[key]) masteredByDomain[key] = [];
                  masteredByDomain[key].push(g);
                });
                return (
                  <div style={{ marginBottom: 12, padding: 10, background: "#f9fcf5", border: `1.5px solid #c5d99c`, borderRadius: 6 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4a7316", marginBottom: 8, paddingBottom: 4, borderBottom: "1px dashed #c5d99c" }}>
                      ✅ 습득 완료된 영역목표 ({masteredGoals.length}개)
                      {cutoffDate && <span style={{ fontSize: 9.5, color: "#7a9968", fontWeight: 500, marginLeft: 6 }}>· {cutoffDate} 보고서 발행 이후</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(masteredByDomain).map(([domain, mGoals]) => (
                        <div key={domain} style={{ background: "#fff", border: "1px solid #d4e5ba", borderRadius: 5, padding: "6px 10px" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#4a7316", marginBottom: 4 }}>{shortDomain(domain) || domain}</div>
                          {mGoals.map(g => {
                            const list2 = (g.tasks || []).filter(t => (t.listGroup || "1") === "2");
                            const taskDates = list2.map(t => t.masteredAt).filter(Boolean).sort();
                            const completedAt = (taskDates.length > 0 ? taskDates[taskDates.length - 1] : null) || g.masteredAt;
                            let publishedAt = null;
                            if (completedAt && archiveList && archiveList.length > 0) {
                              const cutoffArchives = archiveList.filter(item => !item.isFinal);
                              const sorted = [...cutoffArchives].sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));
                              for (const arch of sorted) {
                                if (arch.savedAt && arch.savedAt.slice(0, 10) >= completedAt) {
                                  publishedAt = arch.savedAt.slice(0, 10);
                                  break;
                                }
                              }
                            }
                            return (
                              <div key={g.id} style={{ marginBottom: 6, paddingLeft: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: publishedAt ? "#5a6f8a" : "#333" }}>{g.item}</span>
                                  <span style={{ fontSize: 9, padding: "1px 5px", background: publishedAt ? "#5a6f8a" : "#4a7316", color: "#fff", borderRadius: 8, fontWeight: 700 }}>완료</span>
                                  {completedAt && (
                                    <span style={{ fontSize: 9, color: publishedAt ? "#5a6f8a" : "#7a9968" }}>· {completedAt}</span>
                                  )}
                                  {/* ★ 보고서 발행 표시 */}
                                  {publishedAt && (
                                    <span style={{ fontSize: 9, padding: "1px 6px", background: "#eff5fc", color: "#1d4d80", borderRadius: 8, fontWeight: 600, border: "1px solid #b9d4ee" }} title={`이 영역목표는 ${publishedAt} 발행 보고서에 포함되었습니다`}>
                                      📤 {publishedAt} 보고서 발행
                                    </span>
                                  )}
                                  <button
                                    onClick={() => updateGoal && updateGoal(g.id, { status: "active", masteredAt: null })}
                                    title="다시 진행 중으로 되돌리기"
                                    style={{
                                      marginLeft: "auto", padding: "2px 7px",
                                      background: "#fff", color: "#666",
                                      border: "1px solid #ccc", borderRadius: 5,
                                      fontSize: 9.5, fontWeight: 500,
                                      cursor: "pointer", fontFamily: "inherit"
                                    }}>
                                    ↩ 되돌리기
                                  </button>
                                </div>
                                {list2.length > 0 && (
                                  <div style={{ fontSize: 9.5, color: "#777", paddingLeft: 4, lineHeight: 1.65 }}>
                                    {list2.map((t, i) => (
                                      <span key={t.id}>
                                        {i > 0 && " · "}
                                        <span style={{ color: "#4a7316" }}>{t.name}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* 영역별 카드 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(groupedByDomain).map(([domain, domainGoals]) => (
                  <div key={domain} style={{ background: "#fff", border: `1px solid ${meta.accent}`, borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: meta.deep, marginBottom: 8, paddingBottom: 4, borderBottom: `1px dashed ${meta.accent}` }}>{shortDomain(domain) || domain}</div>
                    {domainGoals.map(g => (
                      <GoalTaskCard
                        key={g.id}
                        goal={g}
                        date={dailyDate}
                        calcDayRate={calcDayRate}
                        addTask={addTask}
                        removeTask={removeTask}
                        renameTask={renameTask}
                        bumpTask={bumpTask}
                        resetTask={resetTask}
                        setTaskListGroup={setTaskListGroup}
                        setTaskMeasureMode={setTaskMeasureMode}
                        setTaskPlannedTrials={setTaskPlannedTrials}
                        setTaskTrial={setTaskTrial}
                        fillTaskTrials={fillTaskTrials}
                        askConfirm={askConfirm}
                        askPauseReason={askPauseReason}
                        clearPendingNext={clearPendingNext}
                        updateGoal={updateGoal}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        });
      })()}

      {/* 네비게이션 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <button style={BS} onClick={onPrev}>← IEP 설정</button>
        <button style={BP} onClick={onNext}>다음: 중간보고서 →</button>
      </div>
    </div>
  );
}

function GoalTaskCard({ goal, date, calcDayRate, addTask, removeTask, renameTask, bumpTask, resetTask, setTaskListGroup, setTaskMeasureMode, setTaskPlannedTrials, setTaskTrial, fillTaskTrials, askConfirm, askPauseReason, clearPendingNext, updateGoal }) {
  const [newTaskName, setNewTaskName] = useState("");
  const [showMastered, setShowMastered] = useState(false);
  const [showPaused, setShowPaused] = useState(true);  // paused는 기본 펼침 (확인 필요한 항목)
  const [pendingInput, setPendingInput] = useState("");

  const tasks = goal.tasks || [];
  const list1 = tasks.filter(t => (t.listGroup || "1") === "1" && t.isActive !== false);
  const list2 = tasks.filter(t => (t.listGroup || "1") === "2");
  const listPaused = tasks.filter(t => t.listGroup === "paused");  // D-1: 중단됨
  const isPendingNext = goal.pendingNext === true;

  const lastMastered = list2
    .filter(t => t.masteredAt)
    .sort((a, b) => (b.masteredAt || "").localeCompare(a.masteredAt || ""))[0];

  const handleAdd = () => {
    if (!newTaskName.trim()) return;
    addTask(goal.id, newTaskName);
    setNewTaskName("");
  };

  const handleAddNext = () => {
    const n = pendingInput.trim();
    if (!n) return;
    addTask(goal.id, n);
    clearPendingNext && clearPendingNext(goal.id);
    setPendingInput("");
  };

  const handleDismissPending = () => {
    clearPendingNext && clearPendingNext(goal.id);
    setPendingInput("");
  };

  const handleMarkComplete = () => {
    clearPendingNext && clearPendingNext(goal.id);
    setPendingInput("");
    if (updateGoal) {
      updateGoal(goal.id, { status: "mastered", masteredAt: new Date().toISOString().slice(0, 10) });
    }
  };

  const todayAvgRate = useMemo(() => {
    let sum = 0, n = 0;
    list1.forEach(t => {
      const day = t.daily?.[date];
      const r = day ? calcDayRate(day, t.plannedTrials) : null;
      if (r !== null) { sum += r; n++; }
    });
    return n > 0 ? Math.round(sum / n) : null;
  }, [list1, date, calcDayRate]);

  return (
    <div style={{ border: `1px solid #f0e0e5`, borderRadius: 10, marginBottom: 8, overflow: "hidden", background: "#fff" }}>
      {/* 영역 목표 헤더 */}
      <div style={{ padding: "10px 14px", background: "#fdf8f9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid #f0e0e5" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#333", lineHeight: 1.4 }}>{goal.item}</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>{goal.subDomain}</div>
        </div>
        <div style={{ textAlign: "center", padding: "4px 10px", background: todayAvgRate === null ? "#fafafa" : (todayAvgRate >= 80 ? GREEN : todayAvgRate >= 50 ? BLUE : ORANGE) + "15", border: `1.5px solid ${todayAvgRate === null ? "#ddd" : todayAvgRate >= 80 ? GREEN : todayAvgRate >= 50 ? BLUE : ORANGE}`, borderRadius: 8, minWidth: 70 }}>
          <div style={{ fontSize: 9, color: "#888", fontWeight: 500 }}>영역 목표 평균</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: todayAvgRate === null ? "#ccc" : (todayAvgRate >= 80 ? GREEN : todayAvgRate >= 50 ? BLUE : ORANGE) }}>
            {todayAvgRate === null ? "—" : `${todayAvgRate}%`}
          </div>
        </div>
      </div>

      {/* 🎉 습득 완료 축하 · 다음 과제 입력 배너 (pendingNext = true 시) */}
      {isPendingNext && (
        <div style={{
          padding: "12px 14px",
          background: "linear-gradient(90deg, #e6f7ec 0%, #f0fbf4 100%)",
          borderBottom: `2px solid ${GREEN}`,
          borderTop: `2px solid ${GREEN}`
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 22 }}>🎉</div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2a7a3a", marginBottom: 3 }}>
                {lastMastered
                  ? <>축하합니다! <b>"{lastMastered.name}"</b>{withParticle(lastMastered.name, "이", "가")} 습득 완료되었습니다.</>
                  : "진행 과제가 습득 완료되었습니다!"}
              </div>
              <div style={{ fontSize: 11, color: "#4a7a56", lineHeight: 1.6 }}>
                다음 List <b style={{ color: "#2a7a3a" }}>(L{(goal.tasks || []).length + (goal.startListNum || 1)})</b>를 입력하시겠습니까?
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  value={pendingInput}
                  onChange={e => setPendingInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddNext(); } }}
                  placeholder={`L${(goal.tasks || []).length + (goal.startListNum || 1)}의 과제 이름 (예: 배 요구하기)`}
                  autoFocus
                  style={{
                    flex: 1, minWidth: 180,
                    padding: "7px 11px",
                    border: `1.5px solid ${GREEN}`, borderRadius: 7,
                    fontSize: 12, fontFamily: "inherit", outline: "none", background: "#fff"
                  }}
                />
                <button
                  onClick={handleAddNext}
                  disabled={!pendingInput.trim()}
                  style={{
                    padding: "7px 16px",
                    background: pendingInput.trim() ? GREEN : "#ccc",
                    color: "#fff", border: "none", borderRadius: 7,
                    fontSize: 12, fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: pendingInput.trim() ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap"
                  }}>
                  ＋ 투입
                </button>
                <button
                  onClick={handleMarkComplete}
                  title="이 영역목표를 완료 처리합니다 (데이터 시트에서 사라지고 완료 모음으로 이동)"
                  style={{
                    padding: "7px 12px",
                    background: "#fff", color: "#666",
                    border: "1px solid #ccc", borderRadius: 7,
                    fontSize: 11, fontWeight: 500,
                    fontFamily: "inherit", cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}>
                  완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리스트 1 — 진행 중 task들 */}
      <div style={{ padding: "8px 10px", background: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: PKD, padding: "4px 8px", background: PKL, borderRadius: 6, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span>현재 진행 과제</span>
          <span style={{ fontSize: 9, padding: "1px 5px", background: PK, color: "#fff", borderRadius: 8, fontWeight: 700 }}>{list1.length}</span>
        </div>
        {list1.length === 0 ? (
          <div style={{ fontSize: 11, color: "#aaa", padding: "10px 8px", fontStyle: "italic" }}>
            노출된 진행 과제가 없습니다.
            {tasks.some(t => (t.listGroup || "1") === "1" && t.isActive === false)
              ? <> [② IEP 설정]에서 과제를 <b>활성화(✓)</b>하거나 아래에 새 과제를 추가하세요.</>
              : <> 아래에 새 과제를 추가하세요.</>}
          </div>
        ) : list1.map(t => {
          const absIdx = (goal.tasks || []).findIndex(x => x.id === t.id);
          return (
            <TaskRow key={t.id} goal={goal} task={t} date={date} calcDayRate={calcDayRate}
              taskIndex={absIdx + (goal.startListNum || 1)}
              bumpTask={bumpTask} resetTask={resetTask}
              setTaskListGroup={setTaskListGroup}
              setTaskMeasureMode={setTaskMeasureMode}
              setTaskPlannedTrials={setTaskPlannedTrials}
              setTaskTrial={setTaskTrial}
              fillTaskTrials={fillTaskTrials}
              askConfirm={askConfirm}
              askPauseReason={askPauseReason}
              removeTask={removeTask} renameTask={renameTask} />
          );
        })}

        {/* task 추가 입력 */}
        {/* ★ [중간 투입 아동] 첫 task 추가 직전에만 시작 L차수 입력 표시 */}
        {(goal.tasks || []).length === 0 && updateGoal && (
          <div style={{ marginTop: 6, padding: "8px 10px", background: "#fef0e0", border: "1px dashed #d68b3a", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10.5, color: "#a85020", fontWeight: 500 }}>시작 L차수</span>
            <input
              type="number"
              min="1"
              max="50"
              value={goal.startListNum || 1}
              onChange={e => {
                const n = parseInt(e.target.value, 10);
                if (n >= 1 && n <= 50) updateGoal(goal.id, { startListNum: n });
              }}
              style={{ width: 50, padding: "3px 6px", border: "1px solid #d68b3a", borderRadius: 4, fontSize: 11.5, fontFamily: "inherit", textAlign: "center", background: "#fff" }}
            />
            <span style={{ fontSize: 10, color: "#a85020", lineHeight: 1.4 }}>
              {(goal.startListNum || 1) === 1
                ? "첫 task = L1 (일반)"
                : `첫 task = L${goal.startListNum} (중간 투입 아동)`}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 6, padding: "6px 4px" }}>
          <input
            value={newTaskName}
            onChange={e => setNewTaskName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder={(goal.tasks || []).length === 0
              ? `+ 첫 과제 (L${goal.startListNum || 1}) 입력`
              : "+ 새 과제 추가 (예: 사과, 배, 포도)"}
            style={{ flex: 1, padding: "6px 10px", border: "1px dashed #d8c0c8", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", outline: "none", background: "#fdfdfd" }}
          />
          <button onClick={handleAdd} disabled={!newTaskName.trim()}
            style={{ padding: "6px 14px", background: newTaskName.trim() ? PK : "#eee", color: newTaskName.trim() ? "#fff" : "#999", border: "none", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: newTaskName.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
            추가
          </button>
        </div>
      </div>

      {/* 리스트 2(습득 완료)는 카드 안에 표시하지 않음 — 커리큘럼 박스 하단 '완료된 목표' 모음 섹션으로 이동 */}

      {/* 중단된 과제는 카드 안에 표시하지 않음 — 커리큘럼 박스 맨 위 '중단된 과제' 모음 섹션으로 이동 */}
    </div>
  );
}

function TaskRow({ goal, task, date, calcDayRate, bumpTask, resetTask, setTaskListGroup, setTaskMeasureMode, setTaskPlannedTrials, setTaskTrial, fillTaskTrials, askConfirm, askPauseReason, removeTask, renameTask, isMastered, taskIndex }) {
  const day = task.daily?.[date] || {};
  const total = Array.isArray(day.trials)
    ? Math.max(1, Math.min(99, task.plannedTrials || 10))
    : (day.c || 0) + (day.ic || 0);
  const correctCount = Array.isArray(day.trials)
    ? day.trials.filter(x => x === "+").length
    : (day.c || 0);
  const rate = calcDayRate(day, task.plannedTrials);
  const rateColor = rate === null ? "#ccc" : rate >= 80 ? GREEN : rate >= 50 ? BLUE : rate >= 20 ? ORANGE : RED;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(task.name);
  const [editingTrials, setEditingTrials] = useState(false);
  const [trialsInput, setTrialsInput] = useState(String(task.plannedTrials || 10));
  const [showCustomDropdown, setShowCustomDropdown] = useState(false);
  const customDropdownRef = useRef(null);
  const customTriggerRef = useRef(null);  // 트리거 버튼 ref (드롭다운 fixed 위치 계산용)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!showCustomDropdown) return;
    const handler = (e) => {
      if (
        customDropdownRef.current && !customDropdownRef.current.contains(e.target) &&
        customTriggerRef.current && !customTriggerRef.current.contains(e.target)
      ) {
        setShowCustomDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCustomDropdown]);
  useEffect(() => {
    if (showCustomDropdown && customTriggerRef.current) {
      const rect = customTriggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 3, left: rect.left });
    }
  }, [showCustomDropdown]);

  const recentDays = useMemo(() => {
    const daily = task.daily || {};
    return Object.keys(daily).sort().slice(-5).map(d => ({ date: d, rate: calcDayRate(daily[d], task.plannedTrials) })).filter(x => x.rate !== null);
  }, [task.daily, task.plannedTrials, calcDayRate]);

  const consecutiveHighDays = useMemo(() => {
    const daily = task.daily || {};
    const dates = Object.keys(daily).sort();
    const rates = dates.map(d => calcDayRate(daily[d], task.plannedTrials)).filter(r => r !== null);
    let count = 0, max = 0;
    for (const r of rates) {
      if (r >= 80) { count++; max = Math.max(max, count); } else { count = 0; }
    }
    return max;
  }, [task.daily, task.plannedTrials, calcDayRate]);

  const handleSaveName = () => {
    if (editName.trim() && editName !== task.name) {
      renameTask(goal.id, task.id, editName.trim());
    }
    setEditing(false);
  };

  return (
    <div className="responsive-task-grid" style={{
      display: "grid",
      gridTemplateColumns: "auto minmax(150px, 2fr) auto auto auto auto auto",
      gap: 8, alignItems: "center",
      padding: "6px 8px",
      borderRadius: 7,
      background: isMastered ? "rgba(99,153,34,0.06)" : "transparent",
      marginBottom: 3
    }}>
      {/* 과제 번호 · 상태 아이콘 */}
      <div style={{ fontSize: 10, color: isMastered ? GREEN : "#bbb", fontWeight: 700, width: 18, textAlign: "center" }}>
        {isMastered ? "✓" : "•"}
      </div>

      {/* 과제명 (인라인 편집 가능) */}
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditName(task.name); setEditing(false); } }}
            style={{ width: "100%", padding: "3px 8px", border: `1px solid ${PK}`, borderRadius: 5, fontSize: 12, fontFamily: "inherit", outline: "none" }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); } }}
              onClick={() => setEditing(true)}
              style={{ fontSize: 12.5, fontWeight: 500, color: isMastered ? "#5a7330" : "#333", cursor: "pointer", textDecoration: isMastered ? "line-through" : "none", textDecorationColor: GREEN, wordBreak: "keep-all", overflowWrap: "break-word" }}
              title="클릭하여 수정">
              {task.name}
            </span>
            {/* W-3/W-6: 측정 모드 + 시도 수 토글 — 2x2 그리드 (위치 고정) */}
            {!isMastered && setTaskPlannedTrials && setTaskMeasureMode && (() => {
              const cur = task.plannedTrials || 10;
              const isPreset = cur === 10 || cur === 5;
              const mode = task.measureMode || "raw";
              const isClickMode = mode === "click";  // 시도 모드일 때 — 정해진 칸 수가 의미 없으니 raw 버튼들 회색
              const btnBase = { fontSize: 12, padding: "4px 0", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.2, width: 60, textAlign: "center" };
              const rawOnStyle = isClickMode
                ? { background: "#e0e0e0", color: "#aaa", border: "1px solid #d0d0d0" }
                : { background: PK, color: "#fff", border: `1px solid ${PK}` };
              const rawOffStyle = isClickMode
                ? { background: "#f0f0f0", color: "#bbb", border: "1px solid #e0e0e0" }
                : { background: "#f0f0f0", color: "#888", border: "1px solid #ddd" };
              const clickStyle = isClickMode
                ? { background: PK, color: "#fff", border: `1px solid ${PK}` }
                : { background: "#f0f0f0", color: "#888", border: "1px solid #ddd" };
              const ensureRawMode = () => {
                if (isClickMode) setTaskMeasureMode(goal.id, task.id, "raw");
              };
              return (
                <span style={{ display: "inline-grid", gridTemplateColumns: "60px 60px", gap: 3, marginLeft: 4 }} title={isClickMode ? "시도 모드 — 정해진 칸 수가 의미 없습니다" : "측정 방식 + 시도 수"}>
                  {/* 1행 1열: 10회 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); ensureRawMode(); setTaskPlannedTrials(goal.id, task.id, 10); setEditingTrials(false); setShowCustomDropdown(false); }}
                    style={{ ...btnBase, ...((cur === 10 && !showCustomDropdown) ? rawOnStyle : rawOffStyle), opacity: isClickMode ? 0.65 : 1 }}>
                    10회
                  </button>
                  {/* 1행 2열: 5회 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); ensureRawMode(); setTaskPlannedTrials(goal.id, task.id, 5); setEditingTrials(false); setShowCustomDropdown(false); }}
                    style={{ ...btnBase, ...((cur === 5 && !showCustomDropdown) ? rawOnStyle : rawOffStyle), opacity: isClickMode ? 0.65 : 1 }}>
                    5회
                  </button>
                  {/* 2행 1열: 직접 — 클릭 시 드롭다운 [15회][20회][직접 입력] 또는 input 모드 */}
                  {editingTrials ? (
                    <span style={{ display: "inline-flex", gap: 1, alignItems: "center", width: 60 }}>
                      <input
                        autoFocus
                        type="number"
                        min={1} max={99}
                        value={trialsInput}
                        onChange={(e) => setTrialsInput(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            const n = Math.max(1, Math.min(99, Math.round(Number(trialsInput))));
                            if (!isNaN(n)) { ensureRawMode(); setTaskPlannedTrials(goal.id, task.id, n); }
                            setEditingTrials(false);
                          } else if (e.key === "Escape") {
                            setTrialsInput(String(task.plannedTrials || 10));
                            setEditingTrials(false);
                          }
                        }}
                        onBlur={() => {
                          const n = Math.max(1, Math.min(99, Math.round(Number(trialsInput))));
                          if (!isNaN(n)) { ensureRawMode(); setTaskPlannedTrials(goal.id, task.id, n); }
                          setEditingTrials(false);
                        }}
                        style={{ width: 42, fontSize: 12, padding: "4px 4px", border: `1px solid ${PK}`, borderRadius: 6, fontFamily: "inherit", outline: "none", textAlign: "center" }}
                      />
                      <span style={{ fontSize: 11, color: "#888" }}>회</span>
                    </span>
                  ) : (
                    <span style={{ position: "relative", display: "inline-block" }}>
                      <button
                        ref={customTriggerRef}
                        onClick={(e) => { e.stopPropagation(); ensureRawMode(); setShowCustomDropdown(s => !s); }}
                        style={{ ...btnBase, ...((!isPreset || showCustomDropdown) ? rawOnStyle : rawOffStyle), opacity: isClickMode ? 0.65 : 1 }}>
                        {!isPreset ? `${cur}회 ▾` : "직접 ▾"}
                      </button>
                      {showCustomDropdown && (
                        <div ref={customDropdownRef} style={{
                          position: "fixed",
                          top: dropdownPos.top,
                          left: dropdownPos.left,
                          background: "#fff",
                          border: `1.5px solid ${PK}`,
                          borderRadius: 7,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                          padding: 4,
                          zIndex: 9999,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          minWidth: 90
                        }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); ensureRawMode(); setTaskPlannedTrials(goal.id, task.id, 15); setShowCustomDropdown(false); }}
                            style={{
                              padding: "5px 10px", fontSize: 12, fontWeight: 700,
                              background: cur === 15 ? PK : "#fff",
                              color: cur === 15 ? "#fff" : "#444",
                              border: `1px solid ${cur === 15 ? PK : "#e0e0e0"}`,
                              borderRadius: 5,
                              cursor: "pointer", fontFamily: "inherit",
                              textAlign: "left"
                            }}>
                            15회
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); ensureRawMode(); setTaskPlannedTrials(goal.id, task.id, 20); setShowCustomDropdown(false); }}
                            style={{
                              padding: "5px 10px", fontSize: 12, fontWeight: 700,
                              background: cur === 20 ? PK : "#fff",
                              color: cur === 20 ? "#fff" : "#444",
                              border: `1px solid ${cur === 20 ? PK : "#e0e0e0"}`,
                              borderRadius: 5,
                              cursor: "pointer", fontFamily: "inherit",
                              textAlign: "left"
                            }}>
                            20회
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); ensureRawMode(); setTrialsInput(String(cur)); setEditingTrials(true); setShowCustomDropdown(false); }}
                            style={{
                              padding: "5px 10px", fontSize: 12, fontWeight: 700,
                              background: (!isPreset && cur !== 15 && cur !== 20) ? PK : "#fff",
                              color: (!isPreset && cur !== 15 && cur !== 20) ? "#fff" : "#444",
                              border: `1px solid ${(!isPreset && cur !== 15 && cur !== 20) ? PK : "#e0e0e0"}`,
                              borderRadius: 5,
                              cursor: "pointer", fontFamily: "inherit",
                              textAlign: "left"
                            }}>
                            직접 입력 ✎
                          </button>
                        </div>
                      )}
                    </span>
                  )}
                  {/* 2행 2열: 시도 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setTaskMeasureMode(goal.id, task.id, mode === "click" ? "raw" : "click"); }}
                    style={{ ...btnBase, ...clickStyle }}>
                    시도
                  </button>
                </span>
              );
            })()}
            {!isMastered && consecutiveHighDays >= 1 && consecutiveHighDays < 2 && (
              <span style={{ fontSize: 8.5, padding: "1px 5px", background: "#fff5d6", color: "#a87108", borderRadius: 6, fontWeight: 700 }}>🔥 1일 80%+</span>
            )}
            {isMastered && task.masteredAt && (
              <span style={{ fontSize: 9, color: "#7c9947" }}>· {task.masteredAt}</span>
            )}
          </div>
        )}
      </div>

      {/* 최근 5일 미니 차트 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 22, width: 50 }}>
        {recentDays.length === 0 ? (
          <div style={{ fontSize: 8.5, color: "#ccc", alignSelf: "center" }}>—</div>
        ) : recentDays.map((d, i) => (
          <div key={i} title={`${d.date}: ${d.rate}%`}
            style={{ width: 7, height: Math.max(2, (d.rate / 100) * 22), background: d.rate >= 80 ? GREEN : d.rate >= 50 ? BLUE : d.rate >= 20 ? ORANGE : RED, borderRadius: "2px 2px 0 0", opacity: 0.75 }} />
        ))}
      </div>

      {/* 모드별 입력 UI — raw: 10칸 세션 / pct: 퍼센트 직접 입력 / click: 원클릭 정·오 */}
      {/* ★ 고정 너비 컨테이너 — 모드 전환 시 옆 요소들이 밀리지 않도록 */}
      <div style={{ minWidth: 200, display: "inline-flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
      {(() => {
        const mode = task.measureMode || "raw";

        if (mode === "click") {
          return (
            <div style={{ display: "inline-flex", gap: 6 }}>
              <button
                onClick={() => !isMastered && bumpTask(goal.id, task.id, date, "c", +1)}
                disabled={isMastered}
                title="정반응 원클릭 — 클릭 시 +1"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: isMastered ? "#f0f0f0" : "#f4f9ed", borderRadius: 6, padding: "3px 9px", border: `1.5px solid ${isMastered ? "#ddd" : GREEN + "60"}`, cursor: isMastered ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: GREEN }}>정</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: GREEN, minWidth: 12, textAlign: "right" }}>{day.c || 0}</span>
              </button>
              <button
                onClick={() => !isMastered && bumpTask(goal.id, task.id, date, "ic", +1)}
                disabled={isMastered}
                title="오반응 원클릭 — 클릭 시 +1"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: isMastered ? "#f0f0f0" : "#fdecec", borderRadius: 6, padding: "3px 9px", border: `1.5px solid ${isMastered ? "#ddd" : RED + "60"}`, cursor: isMastered ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: RED }}>오</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: RED, minWidth: 12, textAlign: "right" }}>{day.ic || 0}</span>
              </button>
            </div>
          );
        }

        const plannedN = Math.max(1, Math.min(99, task.plannedTrials || 10));
        const trials = Array.isArray(day.trials) ? day.trials : [];
        const cells = [];
        for (let i = 0; i < plannedN; i++) cells.push(trials[i] !== undefined ? trials[i] : null);
        const canEnter = (idx) => {
          if (idx === 0) return true;
          for (let i = 0; i < idx; i++) {
            if (cells[i] === null) return false;
          }
          return true;
        };
        const handleCellClick = (idx) => {
          if (isMastered || !setTaskTrial) return;
          if (!canEnter(idx)) return;
          const current = cells[idx];
          const next =
            current === null ? "+" :
            current === "+" ? "-" :
            current === "-" ? "NA" :
            null;  // current === "NA" → null
          setTaskTrial(goal.id, task.id, date, idx, next);
        };
        const handleCellKeyDown = (idx, e) => {
          if (isMastered || !setTaskTrial) return;
          if (!canEnter(idx)) return;
          let next = null;
          if (e.key === "1" || e.key === "+") next = "+";
          else if (e.key === "2" || e.key === "-") next = "-";
          else if (e.key === "3" || e.key.toLowerCase() === "n") next = "NA";
          else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") next = null;
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCellClick(idx); return; }
          else return; // 다른 키는 무시 (Tab은 기본 동작)
          e.preventDefault();
          setTaskTrial(goal.id, task.id, date, idx, next);
          setTimeout(() => {
            const nextBtn = document.querySelector(`[data-task-cell="${task.id}-${idx + 1}"]`);
            if (nextBtn) nextBtn.focus();
          }, 0);
        };
        const cellStyle = (val, enabled) => {
          const bg =
            val === "+" ? GREEN :
            val === "-" ? RED :
            val === "NA" ? "#e6e6e6" :
            enabled ? "#fff" : "#f5f5f5";
          const color =
            val === "+" || val === "-" ? "#fff" :
            val === "NA" ? "#777" :
            enabled ? "#bbb" : "#ddd";
          const border =
            val === "+" ? GREEN :
            val === "-" ? RED :
            val === "NA" ? "#bbb" :
            enabled ? "#d0d0d0" : "#e8e8e8";
          return {
            width: 36, height: 36,
            border: `2px solid ${border}`,
            borderRadius: 6,
            background: bg,
            color: color,
            fontSize: val === "NA" ? 11 : 16,
            fontWeight: 700,
            cursor: enabled && !isMastered ? "pointer" : "default",
            fontFamily: "inherit",
            padding: 0, lineHeight: 1,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            userSelect: "none",
            opacity: isMastered ? 0.6 : 1,
            transition: "transform 0.08s ease",
          };
        };
        const renderCell = (idx) => {
          const val = cells[idx];
          const enabled = canEnter(idx);
          const label =
            val === "+" ? "＋" :
            val === "-" ? "－" :
            val === "NA" ? "NA" :
            (idx + 1);
          return (
            <button key={idx} onClick={() => handleCellClick(idx)}
              onKeyDown={(e) => handleCellKeyDown(idx, e)}
              data-task-cell={`${task.id}-${idx}`}
              disabled={!enabled || isMastered}
              title={isMastered ? "습득 완료 과제는 수정 불가" : enabled ? `${idx + 1}번 시도 — 클릭 또는 키보드: 1=＋, 2=－, 3=NA, 0=취소` : `앞 칸을 먼저 입력해주세요`}
              style={cellStyle(val, enabled)}>
              {label}
            </button>
          );
        };
        const rows = [];
        for (let i = 0; i < plannedN; i += 5) {
          const rowIdx = [];
          for (let j = i; j < Math.min(i + 5, plannedN); j++) rowIdx.push(j);
          rows.push(rowIdx);
        }
        const hasEmpty = cells.some(c => c === null || c === undefined);
        const hasAny = cells.some(c => c !== null && c !== undefined);
        return (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "inline-flex", flexDirection: "column", gap: 5 }}>
              {rows.map((rowIdx, rIdx) => (
                <div key={rIdx} style={{ display: "inline-flex", gap: 5 }}>
                  {rowIdx.map(renderCell)}
                </div>
              ))}
            </div>
            {/* ★ [신규] 일괄 입력 버튼 3개 — 빈 칸 채우기 + 모두 NA + 초기화 */}
            {!isMastered && (
              <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, paddingLeft: 8, borderLeft: "1px dashed #d8d8d8" }}>
                <button
                  onClick={() => fillTaskTrials && fillTaskTrials(goal.id, task.id, date, "+")}
                  disabled={!hasEmpty}
                  title={hasEmpty ? "빈 칸을 모두 +로 채우기 (이미 입력된 칸은 유지)" : "이미 모든 칸 입력됨"}
                  style={{
                    padding: "3px 8px", fontSize: 10,
                    border: `1px solid ${hasEmpty ? GREEN : "#ddd"}`,
                    borderRadius: 5,
                    background: hasEmpty ? "#f4f9ed" : "#f5f5f5",
                    color: hasEmpty ? "#3d6014" : "#aaa",
                    cursor: hasEmpty ? "pointer" : "not-allowed",
                    fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap"
                  }}>
                  ＋ 전체
                </button>
                <button
                  onClick={() => fillTaskTrials && fillTaskTrials(goal.id, task.id, date, "NA")}
                  disabled={!hasEmpty}
                  title={hasEmpty ? "빈 칸을 모두 NA로 채우기 (시간 부족·미시도 회기 마무리)" : "이미 모든 칸 입력됨"}
                  style={{
                    padding: "3px 8px", fontSize: 10,
                    border: `1px solid ${hasEmpty ? "#888" : "#ddd"}`,
                    borderRadius: 5,
                    background: hasEmpty ? "#f0f0f0" : "#f5f5f5",
                    color: hasEmpty ? "#555" : "#aaa",
                    cursor: hasEmpty ? "pointer" : "not-allowed",
                    fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap"
                  }}>
                  NA 전체
                </button>
                <button
                  onClick={() => {
                    if (!hasAny) return;
                    askConfirm("이 task의 오늘 입력을 모두 지울까요?", () => resetTask(goal.id, task.id, date));
                  }}
                  disabled={!hasAny}
                  title={hasAny ? "오늘 이 task 입력 모두 지우기" : "지울 입력 없음"}
                  style={{
                    padding: "3px 8px", fontSize: 10,
                    border: `1px solid ${hasAny ? RED : "#ddd"}`,
                    borderRadius: 5,
                    background: hasAny ? "#fdecec" : "#f5f5f5",
                    color: hasAny ? "#8a2424" : "#aaa",
                    cursor: hasAny ? "pointer" : "not-allowed",
                    fontFamily: "inherit", fontWeight: 600
                  }}>
                  🗑
                </button>
              </div>
            )}
          </div>
        );
      })()}
      </div>

      {/* 오늘 정반응률 */}
      <div style={{ minWidth: 58, textAlign: "center", padding: "3px 8px", background: rate === null ? "#fafafa" : rateColor + "15", border: `1.5px solid ${rateColor}`, borderRadius: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: rateColor, lineHeight: 1 }}>
          {rate === null ? "—" : `${rate}%`}
        </div>
        {total > 0 && <div style={{ fontSize: 8.5, color: "#aaa", marginTop: 1 }}>{correctCount}/{total}</div>}
      </div>

      {/* 차수 라벨 (L1, L2, L3...) — 자동 계산, 수동 변경 불가 */}
      {(() => {
        const isPaused = task.listGroup === "paused";
        const isMast = task.listGroup === "2";
        const labelColor = isMast ? GREEN : isPaused ? "#a87108" : PKD;
        const labelBg = isMast ? "#f4f9ed" : isPaused ? "#fcf9ee" : "#fff";
        const labelBorder = isMast ? GREEN : isPaused ? "#f5b942" : PK;
        const labelText = isMast
          ? "✓ 완료"
          : isPaused
          ? "⏸ 중단"
          : taskIndex
          ? `L${taskIndex}`
          : "L1";
        return (
          <span
            title={isMast ? "습득 완료된 과제" : isPaused ? "중단된 과제" : `${taskIndex || 1}번째 차수의 진행 과제`}
            style={{
              padding: "4px 9px",
              background: labelBg,
              color: labelColor,
              border: `1.5px solid ${labelBorder}`,
              borderRadius: 6,
              fontSize: 11, fontWeight: 700,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              minWidth: 50,
              textAlign: "center",
              display: "inline-block"
            }}>
            {labelText}
          </span>
        );
      })()}
      {/* 액션 버튼 — 완료/재개/중단 (상태별로 표시되는 버튼이 다름) */}
      {!isMastered && setTaskListGroup && (() => {
        const isPaused = task.listGroup === "paused";
        if (isPaused) {
          return (
            <button
              onClick={() => setTaskListGroup(goal.id, task.id, "1")}
              title="이 과제를 다시 진행 중으로 되돌립니다"
              style={{
                padding: "3px 8px",
                background: "#fff", color: PKD,
                border: `1px solid ${PK}`, borderRadius: 6,
                fontSize: 10, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
              }}>
              ↩ 재개
            </button>
          );
        }
        return (
          <button
            onClick={() => {
              if (askPauseReason) {
                askPauseReason(task.name, (reason) => {
                  setTaskListGroup(goal.id, task.id, "paused", reason);
                });
              }
            }}
            title="이 과제를 중단 처리 (사유 입력 필요)"
            style={{
              padding: "3px 8px",
              background: "#fff", color: "#a87108",
              border: `1px solid #f5b942`, borderRadius: 6,
              fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
            }}>
            ⏸ 중단
          </button>
        );
      })()}

      {/* 리셋 / 중단 / 삭제 */}
      <div style={{ display: "flex", gap: 2 }}>
        <button onClick={() => { if (total > 0) askConfirm(`'${task.name}'의 ${date} 기록을 삭제하시겠습니까?`, () => resetTask(goal.id, task.id, date)); }}
          title="오늘 기록 삭제"
          style={{ background: "none", border: "none", color: total > 0 ? "#ccc" : "#eee", cursor: total > 0 ? "pointer" : "default", fontSize: 14, padding: "2px 4px" }}>
          ↺
        </button>
        {/* (⏸ 중단 버튼은 위 상태 드롭다운으로 통합됨) */}
        <button onClick={() => { askConfirm(`과제 '${task.name}'${withParticle(task.name, "을", "를")} 완전히 삭제하시겠습니까?\n모든 기록이 함께 삭제됩니다.`, () => removeTask(goal.id, task.id)); }}
          title="과제 삭제"
          style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>
          ×
        </button>
      </div>
    </div>
  );
}

function buildLocalReport({ info, stos, curFields, selFuncs, selStrats, bName, bInter, domAvgs, reinfSchedule, dailyMemos, archiveList }) {
  const fn = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";
  const jEunNeun = (n) => josa은는(n);
  const jIGa = (n) => josa이가(n);
  const jEulReul = (n) => josa을를(n);
  const jGwaWa = (n) => josa과와(n);

  const done = stos.filter(s => s.status === "완료");
  const prog = stos.filter(s => s.status === "진행중");
  const paused = stos.filter(s => s.status === "중단");
  const active = stos.filter(s => s.status !== "중단");
  const total = active.length;
  const allCompleted = total > 0 && done.length === total;

  const langK = ["맨드","택트","에코","인트라버벌","화자","청자","LRFFC","언어","Mand","Tact","Echoic","수용","표현"];
  const socK = ["사회","상호작용","눈맞춤","또래","인사","공유","차례","놀이","Social","공동"];
  const match = (s, kw) => kw.some(k => (s.name||"").includes(k) || (s.domain||"").includes(k) || (s.goalName||"").includes(k));

  const calcCV = (points) => {
    if (!points || points.length < 3) return null;
    const vals = points.map(p => p.value);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (mean === 0) return null;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
    const stddev = Math.sqrt(variance);
    return Math.round((stddev / mean) * 100);  // %로 반환
  };
  const calcSpontaneityTrend = (points) => {
    if (!points || points.length < 4) return 0;
    const half = Math.floor(points.length / 2);
    const first = points.slice(0, half);
    const last = points.slice(-half);
    const firstAvg = first.reduce((a, b) => a + b.value, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b.value, 0) / last.length;
    return Math.round(lastAvg - firstAvg);
  };
  const reportWeeks = (() => {
    const dateSet = new Set();
    stos.forEach(s => (s.points || []).forEach(p => p.date && dateSet.add(p.date)));
    const dates = [...dateSet].sort();
    if (dates.length < 2) return 0;
    const start = new Date(dates[0]), end = new Date(dates[dates.length - 1]);
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
  })();
  const classifyArea = (s) => {
    const n = (s.name || "") + " " + (s.domain || "") + " " + (s.goalName || "");
    if (/맨드|Mand|요구/i.test(n)) return "Mand(요구 행동)";
    if (/택트|Tact|명명|레이블/i.test(n)) return "Tact(명명)";
    if (/에코|Echoic|모방|음성/i.test(n)) return "에코익(음성 모방)";
    if (/인트라|intra|대화|질문/i.test(n)) return "인트라버벌(대화)";
    if (/청자|Listener|수용|지시|이해/i.test(n)) return "청자 기술";
    if (/모방|Imitation|동작/i.test(n)) return "동작 모방";
    if (/사회|또래|상호|놀이|Social|공동주/i.test(n)) return "사회성";
    if (/자조|Self|식사|배변|착의|위생/i.test(n)) return "자조 기술";
    return null;
  };
  const generateRecommendation = (s) => {
    const points = s.points || [];
    if (points.length < 3) return null;
    const recent = points.slice(-3);
    const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
    const cv = calcCV(points);
    if (s.status === "완료" || (recentAvg >= 80 && recent.every(p => p.value >= 75))) {
      return { type: "generalization", text: `'${s.name}' → 일반화(generalization) 단계 도입 권고 (자연 환경/다양한 자극에서 자발 사용 검증)` };
    }
    if (points.length >= 6) {
      const earlier = points.slice(-6, -3);
      const earlierAvg = earlier.reduce((a, b) => a + b.value, 0) / earlier.length;
      if (earlierAvg - recentAvg >= 25) {
        return { type: "drop", text: `'${s.name}' → 강화 체계·prompt 수준 점검 권고 (${Math.round(earlierAvg)}%→${Math.round(recentAvg)}%, ${Math.round(earlierAvg - recentAvg)}%p 하락)` };
      }
    }
    if (recentAvg < 50 && points.length >= 4) {
      return { type: "noProgress", text: `'${s.name}' → task analysis 재검토 또는 STO 분할 권고 (최근 ${Math.round(recentAvg)}%, ${points.length}회기)` };
    }
    if (cv !== null && cv >= 30 && recentAvg >= 50 && recentAvg < 80) {
      return { type: "variability", text: `'${s.name}' → 회기 간 변동성 큼 (CV ${cv}%) — 환경 변수 통제 및 변별 강화 비율 점검 권고` };
    }
    if (recent.length === 3 && recent.every(p => p.value >= 70 && p.value < 80)) {
      return { type: "soonMaster", text: `'${s.name}' → 준거 임박 (최근 3회 ${recent.map(p => p.value).join("·")}%) — 다음 단계 사전 준비 권고` };
    }
    return null;
  };

  const growthMap = {};
  stos.forEach(s => {
    if (!s.points || s.points.length < 2) return;
    const first = s.points[0], last = s.points[s.points.length - 1];
    const diff = last.value - first.value;
    const masteredFromStart = first.value >= 80 && last.value >= 80;
    const meaningfulGrowth = first.value < 80 && last.value >= 80;
    growthMap[s.name] = { domain: s.domain, first: first.value, last: last.value, diff, masteredFromStart, meaningfulGrowth };
  });
  const meaningfulGrowthList = Object.values(growthMap).filter(g => g.meaningfulGrowth).sort((a,b) => b.diff - a.diff);
  const stableMasteredList = Object.values(growthMap).filter(g => g.masteredFromStart);
  const topGrowth = [...meaningfulGrowthList, ...stableMasteredList];
  const recentMastery = done.filter(s => s.masteryDate).sort((a,b) => (b.masteryDate||"").localeCompare(a.masteryDate||"")).slice(0, 5);

  const best = domAvgs.length > 0 ? domAvgs.reduce((a,b) => a.avg > b.avg ? a : b, { domain: "—", avg: 0 }) : { domain: "—", avg: 0 };
  const worst = domAvgs.length > 0 ? domAvgs.reduce((a,b) => a.avg < b.avg ? a : b, { domain: "—", avg: 999 }) : { domain: "—", avg: 0 };
  const funcs = selFuncs || [];
  const funcTxt = REPORT_FUNCS.filter(f => funcs.includes(f.k)).map(f => f.l).join(", ");
  const stratTxt = (selStrats || []).slice(0, 3).join(", ") || "DTT, NET";

  let lastSum = 0, lastCnt = 0, firstSum = 0, firstCnt = 0;
  active.forEach(s => {
    if (!s.points || s.points.length === 0) return;
    const lastV = s.points[s.points.length - 1].value;
    const firstV = s.points[0].value;
    if (!isNaN(lastV) && lastV > 0) { lastSum += lastV; lastCnt++; }
    if (!isNaN(firstV) && firstV > 0) { firstSum += firstV; firstCnt++; }
  });
  const lastAvg = lastCnt > 0 ? Math.round(lastSum / lastCnt) : 0;
  const firstAvg = firstCnt > 0 ? Math.round(firstSum / firstCnt) : 0;
  const overallDiff = lastAvg - firstAvg;

  const highRate = active.filter(s => {
    const pts = s.points || [];
    if (pts.length < 2) return false;
    const lastTwo = pts.slice(-2);
    return lastTwo.every(p => p.value >= 80);
  });
  const masteredDomains = (domAvgs || []).filter(d => d.avg >= 80);
  const acceleratingTrend = active.some(s => {
    const pts = s.points || [];
    if (pts.length < 3) return false;
    const recent = pts.slice(-3);
    return (recent[recent.length - 1].value - recent[0].value) > 10;
  });

  let _vi = 0, _ai = 0, _gi = 0;
  const PV = [
    "관찰됩니다",
    "확인되었습니다",
    "유지되고 있습니다",
    "지속적으로 관찰됩니다",
    "안정적으로 관찰됩니다"
  ];
  const PA = [
    "지속적인",
    "양호한",
    "긍정적인",
    "유의한",
    "안정적인",
    "일관된"
  ];
  const PG = [
    "단계적으로 향상되고 있습니다",
    "지속적으로 향상되고 있습니다",
    "점진적으로 증가하고 있습니다",
    "안정 수준으로 진행되고 있습니다",
    "안정 단계에 진입하였습니다"
  ];
  const pv = () => PV[_vi++ % PV.length];
  const pa = () => PA[_ai++ % PA.length];
  const pg = () => PG[_gi++ % PG.length];

  const lvl = (avg) =>
    avg >= 90 ? "숙달 수준으로 수행하며" :
    avg >= 80 ? "안정적으로 수행하고 있으며" :
    avg >= 60 ? "수행이 단계적으로 진행되고 있으며" :
    avg >= 40 ? "수행이 점진적으로 형성되고 있으며" :
    "기초 수준의 수행이 관찰되며";

  const langStos = active.filter(s => match(s, langK));
  const socStos = active.filter(s => match(s, socK));
  const langDoneCount = langStos.filter(s => s.status === "완료").length;
  const socDoneCount = socStos.filter(s => s.status === "완료").length;

  const sessionInfo = (() => {
    const total = info?.sTotal || info?.totalSessions;
    const sMin = info?.sMin || info?.sessionMin;
    const sWeek = info?.sWeek || info?.weeklyFreq;
    const minPart = sMin ? `${sMin}분` : "";
    const wkPart = sWeek ? `주 ${sWeek}회` : "";
    const totPart = total ? `총 ${total}회기` : "";
    const parts = [wkPart, minPart, totPart].filter(Boolean);
    if (parts.length === 0) return "";
    return parts.join(" · ");
  })();

  const allDates = (() => {
    const dateSet = new Set();
    active.forEach(s => (s.points || []).forEach(p => p.date && dateSet.add(p.date)));
    return [...dateSet].sort();
  })();
  const firstEvalDate = allDates[0] || "";
  const lastEvalDate = allDates[allDates.length - 1] || "";
  const evalSpanText = firstEvalDate && lastEvalDate && firstEvalDate !== lastEvalDate
    ? `${firstEvalDate.replace(/-/g, ".")}부터 ${lastEvalDate.replace(/-/g, ".")}까지`
    : "";

  const weeklyTrend = (() => {
    if (!firstEvalDate || !lastEvalDate || firstEvalDate === lastEvalDate) return null;
    const d1 = new Date(firstEvalDate);
    const d2 = new Date(lastEvalDate);
    if (isNaN(d1) || isNaN(d2)) return null;
    const weeks = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24 * 7)));
    if (weeks < 1) return null;
    const domainDeltas = {};
    active.forEach(s => {
      const pts = s.points || [];
      if (pts.length < 2) return;
      const dom = s.domain || "기타";
      const delta = pts[pts.length - 1].value - pts[0].value;
      if (!domainDeltas[dom]) domainDeltas[dom] = [];
      domainDeltas[dom].push(delta);
    });
    const result = Object.entries(domainDeltas).map(([dom, deltas]) => {
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const perWeek = avgDelta / weeks;
      return { domain: dom, perWeek: Math.round(perWeek * 10) / 10, totalDelta: Math.round(avgDelta) };
    }).filter(d => Math.abs(d.perWeek) >= 1)  // 주당 ±1%p 미만은 노이즈로 제외
      .sort((a, b) => b.perWeek - a.perWeek);
    return { weeks, byDomain: result };
  })();

  const reinfStage = (() => {
    const s = (reinfSchedule || "").toLowerCase().replace(/\s/g, "");
    if (!s) return "default";
    if (s.includes("자연") || s.includes("natural")) return "natural";
    if (/(vr|vi|fr[2-9]|fr1[0-9]|thin)/.test(s)) return "variable";
    if (/(fr1|crf|연속|매번)/.test(s)) return "continuous";
    return "default";
  })();

  const pauseRecommendation = (() => {
    if (paused.length === 0) return null;
    const RESUME_WEEKS = 4;
    const recent = paused
      .filter(s => s.pausedAt)
      .sort((a, b) => (b.pausedAt || "").localeCompare(a.pausedAt || ""));
    if (recent.length === 0) {
      return { weeksUntilReview: RESUME_WEEKS, hasDate: false };
    }
    const latestPauseDate = new Date(recent[0].pausedAt);
    if (isNaN(latestPauseDate)) return { weeksUntilReview: RESUME_WEEKS, hasDate: false };
    const today = new Date();
    const weeksSincePause = Math.max(0, Math.round((today - latestPauseDate) / (1000 * 60 * 60 * 24 * 7)));
    const weeksLeft = Math.max(0, RESUME_WEEKS - weeksSincePause);  // ★ [버그수정] 0 허용 - "재평가 시점 도달" 분기에 도달 가능하도록
    return {
      weeksUntilReview: weeksLeft,
      weeksSincePause,
      hasDate: true,
      pausedAt: recent[0].pausedAt
    };
  })();

  const r = {};

  const sec1Parts = [];

  const lgD = Object.entries(growthMap).filter(([n]) => langK.some(k => n.includes(k))).map(([,v]) => v).sort((a,b) => b.diff - a.diff);
  const lgDone = done.filter(s => match(s, langK));
  const lgProg = prog.filter(s => match(s, langK));
  const langCountText = langStos.length > 0 && langDoneCount > 0
    ? ` 언어 영역 ${langStos.length}개 단기 목표 중 ${langDoneCount}개에서 준거를 달성하였으며,`
    : "";
  if (curFields[0] && curFields[0].trim()) {
    sec1Parts.push(curFields[0]);
  } else if (lgD.length > 0) {
    const g = lgD[0];
    const lgSto = active.find(s => s.name === Object.keys(growthMap).find(k => growthMap[k] === g));
    const lgPts = lgSto?.points || [];
    const lgRecent = lgPts.slice(-3);
    const isAccelerating = lgRecent.length >= 2 && (lgRecent[lgRecent.length - 1].value - lgRecent[0].value) > 10;
    if (g.masteredFromStart) {
      sec1Parts.push(`${fn}${jEunNeun(fn)} 언어 영역에서 안정적으로 수행하고 있습니다. 요구하기(Mand)와 따라말하기(Echoic) 모두 일관되게 나오고 있고,${langCountText}${lgDone.length > 0 ? ` '${lgDone[0].name}' 등 핵심 목표에서 준거를 달성했습니다.` : ""} 일반화 단계로 넘어갈 수 있는 수준입니다.`);
    } else if (isAccelerating) {
      sec1Parts.push(`${fn}${jEunNeun(fn)} 언어 영역 점수가 ${g.first}%에서 ${g.last}%로 +${g.diff}%p 올랐습니다. 요구하기(Mand)와 따라말하기(Echoic) 반응이 늘었고,${langCountText}${lgDone.length > 0 ? ` '${lgDone[0].name}'에서 준거를 달성했습니다.` : ""} 수용·표현 언어 전반에서 변화가 ${pv()}`);
    } else {
      sec1Parts.push(`${fn}${jEunNeun(fn)} 언어 영역 점수가 ${g.first}%에서 ${g.last}%로 ${g.diff > 0 ? `+${g.diff}%p 올랐고,` : `유지되고 있고,`}${langCountText}${lgDone.length > 0 ? ` '${lgDone[0].name}' 등 ${lgDone.length}개 목표에서 준거를 달성했습니다.` : ""} 요구하기(Mand)와 따라말하기(Echoic)가 ${pg()}`);
    }
  } else if (lgDone.length > 0) {
    sec1Parts.push(`${fn}${jEunNeun(fn)} 언어 영역에서 '${lgDone[0].name}'의 준거를 달성했습니다.${langCountText} 따라말하기(Echoic) 정확도와 요구하기(Mand) 빈도가 ${pv()} 택트(Tact)와 인트라버벌(Intraverbal) 기초가 늘고 있습니다.`);
  } else if (total > 0) {
    sec1Parts.push(`${fn}${jEunNeun(fn)} 지금은 언어 기능의 초기 평가 단계입니다. 요구하기(Mand)와 따라말하기(Echoic) 반응이 조금씩 ${pv()}`);
  }

  const scD = Object.entries(growthMap).filter(([n]) => socK.some(k => n.includes(k))).map(([,v]) => v).sort((a,b) => b.diff - a.diff);
  const scDone = done.filter(s => match(s, socK));
  const socCountText = socStos.length > 0 && socDoneCount > 0
    ? ` 사회성 영역 ${socStos.length}개 단기 목표 중 ${socDoneCount}개를 달성하여,`
    : "";
  if (curFields[1] && curFields[1].trim()) {
    sec1Parts.push(curFields[1]);
  } else if (scD.length > 0) {
    const g = scD[0];
    if (g.masteredFromStart) {
      sec1Parts.push(`사회성 영역도 안정적입니다. 또래 공동주의 반응과 눈맞춤이 ${pv()}${socCountText} 다양한 상황에서의 일반화가 다음 과제입니다.`);
    } else if (g.diff > 0 && g.last >= 80) {
      sec1Parts.push(`사회성 영역 점수가 ${g.first}%에서 ${g.last}%(+${g.diff}%p)로 올랐습니다.${socCountText} 또래 공동주의와 눈맞춤이 늘고 있고, 일반화 단계로 넘어갈 수 있는 수준입니다.`);
    } else {
      sec1Parts.push(`사회성 영역 점수는 ${g.first}%에서 ${g.last}%로 ${g.diff > 0 ? `+${g.diff}%p 올랐고,` : `유지되고 있고,`}${socCountText} 또래 공동주의와 눈맞춤이 ${pg()}`);
    }
  } else if (scDone.length > 0) {
    sec1Parts.push(`사회성 영역에서 '${scDone[0].name}'의 준거를 달성했습니다.${socCountText} 자유놀이 상황에서도 차례 지키기(Turn-taking)와 공유 행동이 자발적으로 ${pv()}`);
  }

  if (curFields[2] && curFields[2].trim()) {
    sec1Parts.push(curFields[2]);
  } else if (bName && bName.trim()) {
    const it = bInter && bInter.trim() ? bInter : "기능적 의사소통 훈련(FCT)";
    sec1Parts.push(`${bName}의 빈도는 중재 시작 이후 줄고 있습니다. ${it}${josa을를(it)} 적용한 뒤 대체 행동이 자발적으로 늘었습니다.${funcTxt ? ` 행동 기능은 ${funcTxt}으로 확인되었고, 그에 맞춰 환경과 강화 전략을 조정하고 있습니다.` : ""}`);
  } else {
    sec1Parts.push(`문제행동은 낮은 수준으로 유지되고 있습니다. 교수 상황에서 주의 집중 시간이 늘었고, 활동 전환 시 안정적인 모습입니다.`);
  }

  if (curFields[3] && curFields[3].trim()) {
    sec1Parts.push(curFields[3]);
  } else if (done.length > 0 && highRate.length > 0) {
    const exemplar = done[0]?.name || done[0]?.goalName || "주요 목표";
    sec1Parts.push(`교수 참여도는 안정적입니다. '${exemplar}' 등 ${done.length}개 목표에서 촉구(prompt) 수준을 줄였고(prompt fading), 리스트도 상향했습니다. ${highRate.length}개 STO에서 80% 이상이 연속으로 나오고 있고, DTT와 NET 모두에서 독립 반응 비율이 늘었습니다.`);
  } else if (lastAvg > 0) {
    if (lastAvg >= 80) {
      sec1Parts.push(`교수 참여도가 안정적입니다. 진행 중인 ${prog.length}개 목표에서 평균 ${lastAvg}%의 정반응률을 보이고 있습니다. ${stratTxt}이 ${fn}에게 잘 맞습니다.`);
    } else if (lastAvg >= 60) {
      sec1Parts.push(`교수 참여도는 ${lastAvg}% 수준이고 조금씩 올라가고 있습니다. 촉구(prompt) 의존도가 줄어 학습 효율이 좋아지고 있습니다.`);
    } else {
      sec1Parts.push(`지금은 ${fn}의 학습 출발점을 확인하고 기초선을 잡는 단계입니다. ${stratTxt} 등을 통해 단계적으로 진행하고 있습니다.`);
    }
  } else {
    sec1Parts.push(`교수 참여의 기초선을 잡는 단계입니다. ${fn}의 학습 특성과 선호 강화제를 파악하면서 진행하고 있습니다.`);
  }

  const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
  if (cutoffArchives.length >= 2) {
    const prevArchive = cutoffArchives[1];  // 이전 차수 보고서
    const prevDate = prevArchive.savedAt ? prevArchive.savedAt.slice(0, 10) : null;
    const currentArchiveDate = cutoffArchives[0].savedAt ? cutoffArchives[0].savedAt.slice(0, 10) : null;
    if (prevDate) {
      const prevSnapStos = prevArchive.snapshot?.stosForReport || prevArchive.snapshot?.stos || [];
      const prevDoneCount = prevSnapStos.filter(s => s.status === "완료").length;
      const prevTotalCount = prevSnapStos.length;
      const newMasteredThisCycle = done.length;  // 이번 차수 컷오프 후 완료된 것
      if (prevDoneCount > 0 || newMasteredThisCycle > 0) {
        sec1Parts.push(`이전 ${prevDate} 보고서 시점과 비교하면, 이번 차수에 ${newMasteredThisCycle}개 과제를 새로 습득했습니다.`);
      }
      if (lastAvg !== null && newMasteredThisCycle > 0) {
        sec1Parts.push(`이번 차수의 평균 정반응률은 ${lastAvg}%입니다.`);
      } else if (newMasteredThisCycle === 0 && prog.length > 0) {
        sec1Parts.push(`이번 차수에 새로 시작한 목표는 진행 중이고, 다음 보고 시점까지 데이터가 더 누적될 예정입니다.`);
      }
    }
  }

  r["종합 현황"] = sec1Parts.join(" ");

  if (curFields[0] && curFields[0].trim()) r["아동의 현행 상황 – 언어"] = curFields[0];
  if (curFields[1] && curFields[1].trim()) r["아동의 현행 상황 – 사회성"] = curFields[1];
  if (curFields[2] && curFields[2].trim()) r["아동의 현행 상황 – 문제행동 / 주의 집중"] = curFields[2];
  if (curFields[3] && curFields[3].trim()) r["아동의 현행 상황 – 교수 참여도 및 반응성"] = curFields[3];
  if (curFields[4] && curFields[4].trim()) r["아동의 현행 상황 – 최근 변화"] = curFields[4];

  const sec2Parts = [];

  const periodLead = (() => {
    const parts = [];
    if (evalSpanText) parts.push(`${evalSpanText} 진행된 평가 데이터를 종합한 결과,`);
    else if (allDates.length > 0) parts.push(`이번 기간 누적된 평가 데이터를 분석한 결과,`);
    if (sessionInfo && allDates.length > 0) parts.push(`총 ${allDates.length}회의 평가 회기(${sessionInfo})에서`);
    else if (sessionInfo) parts.push(`${sessionInfo}의 중재 일정으로`);
    return parts.join(" ");
  })();
  if (periodLead) sec2Parts.push(periodLead + " 결과는 다음과 같습니다.");

  if (allCompleted) {
    const masteredText = masteredDomains.length > 0
      ? ` 특히 ${masteredDomains.slice(0, 2).map(d => `'${cleanDomainKey(d.domain)}'`).join(", ")} 영역이 숙달 수준입니다.`
      : (best.domain !== "—" ? ` '${cleanDomainKey(best.domain)}' 영역은 평균 ${best.avg}%로 숙달 수준입니다.` : "");
    sec2Parts.push(`${fn}${jEunNeun(fn)} 이번 기간에 설정된 ${total}개 단기 목표(STO) 전체에서 '2회 연속 80% 이상' 준거를 달성했습니다. 학습한 기술이 안정적으로 유지되고 있습니다.${masteredText} 일반화 단계로 넘어갈 차례입니다.`);
  } else if (topGrowth.length >= 2) {
    const g1 = topGrowth[0], g2 = topGrowth[1];
    const desc1 = g1.masteredFromStart ? `'${g1.domain}' 영역은 안정적으로 수행되고 있고` : `'${g1.domain}' 영역이 +${g1.diff}%p 올랐고`;
    const desc2 = g2.masteredFromStart ? `'${g2.domain}' 영역은 일관되게 수행되고 있습니다` : `'${g2.domain}' 영역도 +${g2.diff}%p 올랐습니다`;
    const doneText = done.length > 0 ? ` 전체 ${total}개 STO 중 ${done.length}개에서 준거를 달성했습니다.` : "";
    const accelText = acceleratingTrend ? " 최근 회기에서 더 빠르게 올라가고 있습니다." : "";
    const masteredTail = masteredDomains.length > 0
      ? ` ${masteredDomains.map(d => `'${cleanDomainKey(d.domain)}'`).join(", ")} 영역은 숙달 수준이라 일반화 단계로 넘어갈 차례입니다.`
      : "";
    sec2Parts.push(`이번 기간에 ${desc1}, ${desc2}.${doneText}${accelText}${masteredTail}`);
  } else if (overallDiff >= 10) {
    const masteredTail = masteredDomains.length > 0
      ? ` ${masteredDomains.slice(0, 2).map(d => `'${cleanDomainKey(d.domain)}'`).join(", ")} 영역은 숙달 수준이라 일반화 단계로 넘어갈 차례입니다.`
      : "";
    sec2Parts.push(`${fn}${jEunNeun(fn)} 이번 기간에 평균 점수가 ${firstAvg}%에서 ${lastAvg}%로 +${overallDiff}%p 올랐습니다.${done.length > 0 ? ` ${done.length}개 목표에서 준거를 달성했습니다.` : ""}${masteredTail}`);
  } else if (recentMastery.length > 0) {
    sec2Parts.push(`최근 '${recentMastery[0].name}'에서 준거를 달성했습니다. 전체 ${total}개 STO 중 ${done.length}개가 완료되었습니다. 반응 속도와 정확도가 같이 올라가고 있습니다.`);
  } else if (total > 0) {
    sec2Parts.push(`현재 ${total}개 단기 목표 중 ${prog.length}개가 진행 중입니다. 반응 정확도와 자발성이 조금씩 올라가고 있습니다.`);
  } else {
    sec2Parts.push(`초기 평가와 기초선 데이터를 수집하는 단계입니다. ${fn}의 학습 특성과 선호 강화제를 파악하면서 개별화 중재 계획을 잡고 있습니다.`);
  }

  if (curFields[4] && curFields[4].trim()) {
    sec2Parts.push(curFields[4]);
  }

  if (weeklyTrend && weeklyTrend.byDomain.length > 0) {
    const top = weeklyTrend.byDomain.slice(0, 3);
    const positiveTrends = top.filter(d => d.perWeek > 0);
    if (positiveTrends.length > 0) {
      const trendTxt = positiveTrends
        .map(d => `'${cleanDomainKey(d.domain)}' 주당 평균 ${d.perWeek > 0 ? "+" : ""}${d.perWeek}%p`)
        .join(", ");
      sec2Parts.push(`주간 변화율을 보면 ${weeklyTrend.weeks}주 동안 ${trendTxt}으로 올라갔습니다.`);
    }
  }

  let memoInsights = [];
  if (dailyMemos && Object.keys(dailyMemos).length > 0) {
    active.forEach(s => {
      const points = (s.points || []).filter(p => p.value !== null);
      if (points.length < 4) return;
      const recent = points.slice(-3);
      const prev = points.slice(-6, -3);
      if (recent.length < 3 || prev.length < 3) return;
      const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
      const prevAvg = prev.reduce((a, b) => a + b.value, 0) / prev.length;
      if (prevAvg - recentAvg < 25) return; // 좋은 하락만
      const dropDates = recent.map(p => p.date);
      const dropMemos = dropDates.map(d => dailyMemos[d]).filter(Boolean);
      if (dropMemos.length > 0) {
        memoInsights.push({
          taskName: s.name,
          domain: s.domain,
          memos: dropMemos.slice(0, 1)  // 첫 메모만 인용 (간결함)
        });
      }
    });
    if (memoInsights.length > 0) {
      const top = memoInsights[0];
      sec2Parts.push(`일부 회기에서 ${fn}의 컨디션이나 환경 요인이 수행에 영향을 준 적이 있습니다 (예: "${top.memos[0]}"). 그 뒤 다시 회복되는 모습도 관찰되었습니다.`);
    }

    if (memoInsights.length === 0) {
      const allMemos = Object.values(dailyMemos).filter(m => m && m.trim());
      if (allMemos.length >= 3) {
        const positivePatterns = [
          { kw: /컨디션\s*좋|적극\s*참여|기분\s*좋|즐거|🌟|✓\s*컨디션/, label: "컨디션 양호" },
          { kw: /집중|몰입/, label: "집중력 향상" },
          { kw: /자발|스스로|먼저/, label: "자발적 시도" }
        ];
        const negativePatterns = [
          { kw: /컨디션\s*저조|졸림|피곤|기분\s*안\s*좋|😴|✗\s*컨디션/, label: "컨디션 저조" },
          { kw: /불안|짜증|울음|💢|정서\s*불안/, label: "정서적 어려움" },
          { kw: /환경\s*변화|새|날씨|🌧/, label: "환경 변화" }
        ];

        const matchedPositive = positivePatterns.filter(p =>
          allMemos.some(m => p.kw.test(m))
        );
        const matchedNegative = negativePatterns.filter(p =>
          allMemos.some(m => p.kw.test(m))
        );

        if (matchedPositive.length > 0 || matchedNegative.length > 0) {
          const parts = [];
          if (matchedPositive.length > 0) {
            const labels = matchedPositive.slice(0, 2).map(p => p.label).join(", ");
            parts.push(`${labels}이 자주 관찰된 회기에서는 학습 참여도가 높았으며`);
          }
          if (matchedNegative.length > 0) {
            const labels = matchedNegative.slice(0, 2).map(p => p.label).join(", ");
            parts.push(`${labels} 같은 외부 요인이 있는 회기에서는 일시적인 수행 변동이 관찰되기도 하였습니다`);
          }
          if (parts.length > 0) {
            sec2Parts.push(`회기 메모를 보면, ${parts.join(", ")}.`);
          }
        }
      }
    }
  }

  if (active.length >= 2 && reportWeeks >= 2) {
    const cvList = active.map(s => calcCV(s.points)).filter(v => v !== null);
    const meanCV = cvList.length > 0 ? Math.round(cvList.reduce((a, b) => a + b, 0) / cvList.length) : null;
    const spontPositive = active.filter(s => calcSpontaneityTrend(s.points) >= 8).length;
    const fadingCount = done.length;

    const profParts = [];
    if (fadingCount > 0) {
      profParts.push(`${fadingCount}개 STO에서 준거(2회 연속 80%↑)를 충족해 촉구 용암(prompt fading) 단계로 넘어갔고`);
    }
    if (meanCV !== null) {
      const cvDesc = meanCV < 15 ? "회기 간 안정성이 좋습니다" :
                     meanCV < 25 ? "회기 간 안정성이 양호합니다" :
                     "회기 간 변동이 있어 환경 요인을 살펴볼 필요가 있습니다";
      profParts.push(`회기 간 안정성(across-session stability)은 변동계수 평균 ${meanCV}%로 ${cvDesc}`);
    }
    if (spontPositive > 0) {
      profParts.push(`${spontPositive}개 영역에서 자발성(spontaneity) 비율이 보고 기간 후반부에 늘었습니다`);
    }
    if (profParts.length > 0) {
      sec2Parts.push(`전문 지표를 보면, ${profParts.join("; ")}.`);
    }
  }

  r["이번 기간의 성장과 변화"] = sec2Parts.join(" ");
  r["총괄 요약 및 권고사항"] = sec2Parts.join(" "); // 호환용

  const homeMissions = [];
  if (best.domain !== "—" && best.avg >= 70) {
    homeMissions.push(`${fn}의 강점 영역인 '${cleanDomainKey(best.domain)}'${josa을를(best.domain)} 가정에서도 활용하기. ${fn}${jIGa(fn)} 좋아하는 간식이나 장난감을 줄 때 바로 주지 마시고, 눈을 보며 3초 기다려 주세요. 시선, 손짓, 말로 표현이 나오면 그때 주시면 됩니다. 요구하기(Mand)가 자연스럽게 강화됩니다.`);
  }
  if (worst.domain !== "—" && worst.avg < 60 && worst.avg !== 0) {
    homeMissions.push(`'${cleanDomainKey(worst.domain)}' 영역의 기초 다지기를 가정에서도 함께. 짧은 지시(앉아, 와, 줘)를 일상에서 써 주세요. 잘 따라했을 때 바로 칭찬하시고, ${fn}${jIGa(fn)} 좋아하는 활동으로 강화해 주시면 됩니다.`);
  }
  if (homeMissions.length === 0) {
    homeMissions.push(`${fn}${josa이가(fn)} 스스로 표현할 기회를 늘려 주세요. 좋아하는 물건이나 활동을 바로 주지 마시고, 잠깐 기다려 시선이나 몸짓, 소리, 말 어떤 형태든 표현이 나오면 그때 반응해 주세요.`);
  }

  const dailyTips = [
    `식사 시간 — 음식을 주기 전에 음식 이름을 한 번 말해 주세요. 일상에서 청자(Listener) 기술과 어휘가 함께 늘어납니다.`,
    `놀이 시간 — 좋아하는 활동 중에 잠깐 멈춰 주세요. '더?' 표시가 나오면 다시 시작해 주시면 됩니다. 요구하기(Mand)가 강화됩니다.`,
    `잠자리 전 — 그림책을 같이 보며 ${fn}${jIGa(fn)} 가리키는 것을 따라 말해 주세요. 청자 반응과 어휘가 같이 늘어납니다.`
  ];

  const cautions = [];
  if (bName && bName.trim()) {
    const bn = bName.trim();
    if (funcs.includes("escape")) {
      cautions.push(`${fn}${josa이가(fn)} '${bn}' 행동을 할 때 과제를 바로 중단하시면 회피(escape) 기능이 강화돼서 행동이 더 자주 나옵니다. 과제를 더 작게 나눠 짧게라도 끝낸 다음 휴식을 주세요. "다 했어, 잘했어"라고 짧게 칭찬하시고 휴식 시간을 주시면 됩니다.`);
    }
    if (funcs.includes("attention")) {
      cautions.push(`${fn}${josa이가(fn)} '${bn}' 행동을 할 때 바로 반응(혼내기, 달래기, 시선 주기)하시면 관심 획득(attention) 기능이 강화됩니다. 안전한 상황이라면 그 행동에는 시선과 말을 줄이시고, 적절한 방법(이름 부르기, 손 들기, 어깨 두드리기 등)으로 관심을 요청할 때 바로 반응해 주세요.`);
    }
    if (funcs.includes("sensory")) {
      cautions.push(`'${bn}' 행동이 자기자극(감각) 기능일 때는 못 하게 막는 것보다 같은 감각을 채워줄 수 있는 대체 활동을 주는 게 효과적입니다. 손으로 두드리는 행동이면 촉감 장난감이나 찰흙, 몸을 흔드는 행동이면 그네나 트램펄린을 일과 중에 넣어 주세요.`);
    }
    if (funcs.includes("access")) {
      cautions.push(`${fn}${josa이가(fn)} 원하는 걸 얻으려고 '${bn}' 행동을 할 때 그걸 들어주시면 그 행동이 의사소통 수단으로 학습됩니다. 적절한 표현(가리키기, 사인, 그림 카드, 단어 등)을 사용할 때 바로 원하는 걸 주시면 됩니다.`);
    }
    if (funcs.length === 0) {
      cautions.push(`${fn}${josa이가(fn)} '${bn}' 행동을 할 때 바로 반응(들어주기, 혼내기, 달래기)하시면 의도와 다르게 그 행동이 강화될 수 있습니다. 적절한 표현이 나올 때만 반응하시고, '${bn}' 행동에는 중립적으로 대해 주세요.`);
    }
  } else {
    cautions.push(`강화제는 ${fn}${josa이가(fn)} 적절한 행동을 한 직후(3초 이내)에 주셔야 효과적입니다. 늦으면 어떤 행동이 강화되는지 ${fn}${josa이가(fn)} 연결하기 어렵습니다.`);
  }
  if (reinfStage === "continuous") {
    cautions.push(`지금 ${fn}의 강화 스케줄은 연속 강화(매번 강화) 단계입니다. 가정에서도 적절한 행동을 할 때마다 강화해 주세요. 학습이 안정되기 전에 띄엄띄엄 강화하면 행동 빈도가 줄어듭니다.`);
  } else if (reinfStage === "variable") {
    cautions.push(`지금 ${fn}의 강화 스케줄은 가변 비율(점진적 fading) 단계입니다. 가정에서는 매번 강화하지 마시고, 적절한 행동을 여러 번 한 다음 그 중 한두 번만 강화하시면 행동이 더 오래 유지됩니다. 단, 어려운 과제를 처음 시도할 때는 초반 몇 번은 매번 강화해 주시고, 익숙해지면 줄여 주세요.`);
  } else if (reinfStage === "natural") {
    cautions.push(`지금 ${fn}의 강화 스케줄은 자연 강화 단계입니다. 가정에서는 인위적인 강화제(과자, 스티커 등)보다 ${fn}의 행동이 만들어내는 자연스러운 결과(또래의 반응, 원하는 활동 시작, 칭찬)에 집중해 주세요. 이 단계는 일반화가 핵심이라 다양한 환경과 사람과의 상호작용 기회를 늘려 주시는 게 중요합니다.`);
  }
  cautions.push(`가정에서도 같은 방식으로 일관되게 해 주시는 게 중요합니다. ABA의 핵심은 일관성이라, 가정과 센터에서 같게 대응할 때 행동이 안정적으로 유지됩니다. 가정에서 관찰한 점이나 어려운 점은 담당 치료사에게 편하게 말씀해 주세요.`);

  r["가정 협력 방안"] = `[이번 보고 기간 핵심 방향]\n${homeMissions.map((m,i) => `${i+1}. ${m}`).join("\n")}\n\n[일상에서 실천 방안]\n${dailyTips.map((t,i) => `${i+1}. ${t}`).join("\n")}\n\n[주의사항]\n${cautions.map((c,i) => `${i+1}. ${c}`).join("\n")}`;
  r["가정에서 함께 하기"] = r["가정 협력 방안"]; // 호환용
  r["일반화 계획 및 가정 협력 방안"] = r["가정 협력 방안"]; // 호환용

  const sentences = [];

  const bestSto = stableMasteredList[0] || recentMastery[0];
  const bestDomain = best.domain !== "—" && best.avg >= 70 ? best.domain : null;
  if (bestSto || bestDomain) {
    const refName = bestSto ? (bestSto.name || cleanDomainKey(bestSto.domain) || "강점 영역") : cleanDomainKey(bestDomain);
    const refSuffix = bestDomain && best.avg > 0 ? `(평균 ${best.avg}%)` : "";
    const refFull = `'${refName}' 영역${refSuffix}`;
    const lastChar = refSuffix ? refSuffix.slice(-1) : refName.slice(-1);
    const particle = withParticle(lastChar, "을", "를");
    sentences.push(`${fn}${josa이가(fn)} 잘하는 ${refFull}${particle} 동기 유발 도구로 활용해 학습을 통합적으로 진행할 계획입니다.`);
  } else {
    sentences.push(`${fn}의 현재 발달 단계에 맞춰 개별화된 학습 목표를 운영하고, 데이터를 보면서 효과를 확인할 예정입니다.`);
  }

  const focusList = domAvgs.filter(d => d.avg >= 60 && d.avg < 80).slice(0, 1);
  const emerging = domAvgs.filter(d => d.avg >= 40 && d.avg < 60);
  if (focusList.length > 0) {
    const tgt = focusList[0];
    sentences.push(`'${cleanDomainKey(tgt.domain)}' 영역(${tgt.avg}%)은 ${lvl(tgt.avg)} 촉구(prompt)를 단계적으로 줄이고 시도 횟수를 조정해서 숙달 수준에 닿게 할 예정입니다.`);
  } else if (emerging.length > 0) {
    const tgt = emerging[0];
    sentences.push(`'${cleanDomainKey(tgt.domain)}' 영역은 ${lvl(tgt.avg)} 시도 횟수를 늘리고 촉구(prompt)를 조정해 숙달 수준까지 끌어올릴 계획입니다.`);
  }

  if (worst.domain !== "—" && worst.avg < 60 && worst.avg !== 0) {
    const linkPhrase = bestSto || bestDomain ? `강점 영역의 동기를 활용해서, ` : "";
    sentences.push(`${linkPhrase}'${cleanDomainKey(worst.domain)}' 영역은 ${fn}의 발달 단계에 맞춰 과제를 더 작게 나누고, 행동 형성(Shaping)으로 단계적으로 올리겠습니다.`);
    sentences.push(`VB-MAPP 장벽 평가(Barriers Assessment)로 학습을 막는 요인을 점검하고 단계별로 다루겠습니다.`);
  }

  if (paused.length > 0) {
    if (pauseRecommendation && pauseRecommendation.hasDate) {
      const pr = pauseRecommendation;
      const pausedDateText = pr.pausedAt ? pr.pausedAt.replace(/-/g, ".") : "";
      if (pr.weeksUntilReview > 0) {
        sentences.push(`보류 중인 ${paused.length}개 목표는 ${pausedDateText} 중단 이후 ${pr.weeksSincePause}주가 지났고, ${pr.weeksUntilReview}주 후에 ${fn}의 컨디션과 학습 상황을 보고 재평가한 다음 재개하겠습니다.`);
      } else {
        sentences.push(`보류 중인 ${paused.length}개 목표는 중단 이후 ${pr.weeksSincePause}주가 지나 재평가 시점이 됐습니다. 다음 회기에서 ${fn}의 현재 상태를 확인하고 우선순위를 조정한 뒤 재개를 검토하겠습니다.`);
      }
    } else if (pauseRecommendation) {
      sentences.push(`보류 중인 ${paused.length}개 목표는 약 ${pauseRecommendation.weeksUntilReview}주 후 ${fn}의 컨디션이 돌아오면 재평가하고 재개하겠습니다.`);
    } else {
      sentences.push(`보류 중인 ${paused.length}개 목표는 ${fn}의 컨디션이 돌아오면 재개하겠습니다.`);
    }
  }

  sentences.push(`강점 영역은 활용하고 약한 영역은 보완하면서, 가정과 센터가 같은 방식으로 가도록 진행하겠습니다.`);

  r["다음 목표"] = sentences.join(" ");
  r["다음 목표 제안"] = sentences.join(" "); // 호환용

  const totalMemoCount = dailyMemos ? Object.keys(dailyMemos).length : 0;
  const citedMemoCount = memoInsights.length;
  r.__meta = {
    totalMemoCount,
    citedMemoCount,
    referencedMemoCount: Math.max(0, totalMemoCount - citedMemoCount)
  };

  return r;
}

function ReportTab({ currentUser, info, goals, currentAvgs, baselineAvgs, domainLevelOverrides, getTimeline, stosForReport, goalsForReport, askConfirm, reportFields, reportSelStrats, reportSelStratsCustom, reportSelPrein, reportSelSrein, reportReinfSchedule, reportBehaviors, reportSections, dailyMemos, setReportField, setReportPatch, setInfo, archiveList, cutoffDisabled, setCutoffDisabled, reportMode, setReportMode, onArchiveSave, onArchiveDelete, onArchiveView, onPrev, onPreview, onPrint }) {
  const visibleArchiveList = useMemo(() => {
    if (!archiveList || archiveList.length === 0) return [];
    if (currentUser?.role === "admin") {
      return archiveList;  // 관리자는 모든 보관 보고서
    }
    if (currentUser?.role === "teacher") {
      if ((info?.ownerName || "") === currentUser.name) {  // 안전: undefined → ""
        return archiveList;  // 자기 아동이면 모든 보관본 보기
      } else {
        return [];  // 다른 아동이면 보이지 않음 (어차피 다른 아동 자체가 보이지 않지만, 안전장치)
      }
    }
    return [];
  }, [archiveList, currentUser, info.ownerName]);

  const isFinalMode = reportMode === "final";
  const effectiveArchiveList = (cutoffDisabled || isFinalMode) ? [] : (visibleArchiveList || []).filter(item => !item.isFinal);
  const allDates = useMemo(() => {
    let cutoffDate = null;
    if (effectiveArchiveList && effectiveArchiveList.length > 0 && effectiveArchiveList[0].savedAt) {
      cutoffDate = effectiveArchiveList[0].savedAt.slice(0, 10);
    }
    const hasAnyData = (day) => {
      if (!day) return false;
      if (Array.isArray(day.trials)) return day.trials.some(x => x === "+" || x === "-");
      if (day.mode === "pct") return typeof day.pct === "number";
      return ((day.c || 0) + (day.ic || 0)) > 0;
    };
    const set = new Set();
    goals.forEach(g => {
      (g.tasks || []).forEach(t => {
        Object.keys(t.daily || {}).forEach(d => {
          if (cutoffDate && d <= cutoffDate) return;  // 컷오프 이전 제외
          if (hasAnyData(t.daily[d])) set.add(d);
        });
      });
      Object.keys(g.daily || {}).forEach(d => {
        if (cutoffDate && d <= cutoffDate) return;  // 컷오프 이전 제외
        if (hasAnyData(g.daily[d])) set.add(d);
      });
    });
    return [...set].sort();
  }, [goals, effectiveArchiveList]);

  const goalsWithStats = useMemo(() => goals.map(g => {
    const tl = getTimeline(g);
    const latest = tl.length > 0 ? tl[tl.length - 1] : null;
    const first = tl.length > 0 ? tl[0] : null;
    return {
      ...g,
      latestRate: latest?.rate ?? null,
      firstRate: first?.rate ?? null,
      sessions: tl.length,
      change: (latest && first) ? latest.rate - first.rate : null
    };
  }), [goals, getTimeline]);

  const summary = useMemo(() => {
    const recorded = goalsWithStats.filter(g => g.latestRate !== null);
    const avg = recorded.length > 0 ? Math.round(recorded.reduce((a, b) => a + b.latestRate, 0) / recorded.length) : null;
    const mastered = recorded.filter(g => g.latestRate >= 80).length;
    const improving = goalsWithStats.filter(g => g.change !== null && g.change > 0).length;
    return { recorded: recorded.length, total: goals.length, avg, mastered, improving, sessions: allDates.length };
  }, [goalsWithStats, goals.length, allDates.length]);

  if (goals.length === 0) {
    return (
      <div style={{ ...CS, textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 44, marginBottom: 10, opacity: 0.6 }}>📄</div>
        <div style={{ fontSize: 15, color: "#888", marginBottom: 6, fontWeight: 500 }}>보고할 IEP 목표가 없습니다</div>
        <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.7 }}>IEP 설정과 데일리 데이터를 먼저 기록해주세요.</div>
      </div>
    );
  }

  return (
    <div>
      {/* ★ [보고서 모드 토글] 중간보고서 vs 종결보고서 */}
      <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fff", borderRadius: 8, border: `1px solid ${PKL}`, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PKD }}>📋 보고서 종류</span>
        <button onClick={() => setReportMode && setReportMode("interim")}
          style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: !isFinalMode ? PK : "#fff",
            color: !isFinalMode ? "#fff" : "#888",
            border: `1px solid ${!isFinalMode ? PK : "#ddd"}`,
          }}>📄 중간보고서</button>
        <button onClick={() => setReportMode && setReportMode("final")}
          style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: isFinalMode ? "#5a8c1f" : "#fff",
            color: isFinalMode ? "#fff" : "#888",
            border: `1px solid ${isFinalMode ? "#5a8c1f" : "#ddd"}`,
          }}>🎓 종결보고서</button>
        <span style={{ fontSize: 10, color: "#888", marginLeft: 6, lineHeight: 1.5 }}>
          {isFinalMode
            ? "전체 기간 데이터 표시 · 인쇄 시 보관 (cutoff 미적용) · 권고사항 섹션"
            : "현재 차수 데이터 표시 · 인쇄 시 보관 · 다음 목표 섹션"}
        </span>
      </div>

      {/* ★ 보고서 모드별 안내 — [📄 인쇄] 동작 명확하게 */}
      {!isFinalMode ? (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef0e0", borderLeft: "3px solid #d68b3a", borderRadius: 6, fontSize: 11, color: "#a85020", lineHeight: 1.7 }}>
          📅 <b>다음 보고 종료일을 선택하세요.</b> 보고 종료일까지의 데이터로 본 보고서가 작성됩니다.<br />
          <br />
          <b>[📄 인쇄] 클릭 시 자동으로</b>:<br />
          &nbsp;&nbsp;✓ 현재 보고서가 보관함에 저장됨<br />
          &nbsp;&nbsp;✓ 그래프에 컷오프 적용 (이전 데이터는 보관함에서 확인)<br />
          &nbsp;&nbsp;✓ 다음 차수 시작일이 자동 갱신됨 (보관일 + 1)<br />
          <br />
          💡 보관 없이 양식만 확인하려면 <b>[👁 미리보기]</b> 버튼을 사용하세요.
        </div>
      ) : (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#eaf3de", borderLeft: "3px solid #5a8c1f", borderRadius: 6, fontSize: 11, color: "#3d6014", lineHeight: 1.7 }}>
          🎓 <b>종결보고서 작성 모드</b>입니다.<br />
          <br />
          종결보고서는 치료 종료 시 작성하는 최종 보고서입니다:<br />
          &nbsp;&nbsp;✓ <b>전체 치료 기간</b>의 데이터를 모두 표시 (이전 차수 cutoff 무시)<br />
          &nbsp;&nbsp;✓ '다음 목표' 대신 '<b>권고사항</b>' 섹션<br />
          <br />
          <b>[🎓 종결보고서 인쇄] 클릭 시 자동으로</b>:<br />
          &nbsp;&nbsp;✓ 종결보고서가 보관함에 저장됨 (별도 표시)<br />
          &nbsp;&nbsp;✓ 그래프 컷오프는 <b>적용되지 않음</b> (전체 데이터 유지)<br />
          &nbsp;&nbsp;✓ 다음 차수 시작일은 <b>그대로 유지</b><br />
          <br />
          💡 보관 없이 양식만 확인하려면 <b>[👁 미리보기]</b> 버튼을 사용하세요.
        </div>
      )}

      {/* PDF-2: SUMMARY · 핵심 한 줄 요약 (부모님이 펴자마자 결론 파악) */}
      {(() => {
        const summary = buildSummary(stosForReport, info);
        if (!summary) return null;
        return (
          <div style={{
            background: "linear-gradient(135deg,#FFF8FA 0%,#FFFAFB 100%)",
            border: `1px solid ${PK}`,
            borderLeft: `4px solid ${PKD}`,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 12
          }}>
            <div style={{ fontSize: 9, color: PKD, fontWeight: 600, letterSpacing: "1px", marginBottom: 4 }}>
              SUMMARY · 핵심 요약
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#333", lineHeight: 1.7 }}>
              {summary}
            </div>
          </div>
        );
      })()}

      {/* ★ [v19 신규] 증거물 갤러리 (중간/종결 보고서) */}
      {(() => {
        const mediaList = info.mediaList || [];
        const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const recentMedia = mediaList.filter(m => m.uploadedAt >= fourMonthsAgo);
        
        if (recentMedia.length === 0) return null;
        
        return (
          <div style={{ ...CS, background: "#f9f5f7", marginBottom: 18, border: `1px solid ${PKL}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 12, color: PKD }}>📸 평가 증거물 ({recentMedia.length}개)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
              {recentMedia.map((media) => (
                <div key={media.id} style={{
                  background: "#fff",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: `1px solid ${PKL}`,
                  position: "relative"
                }}>
                  {media.type === "image" ? (
                    <img src={media.base64} alt={media.name} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: 120, background: "#f0e0e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
                      🎥
                    </div>
                  )}
                  <div style={{ padding: 8, borderTop: `1px solid ${PKL}` }}>
                    <div style={{ fontSize: 9, color: "#666", truncate: "true", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                      {media.name}
                    </div>
                    <div style={{ fontSize: 8, color: "#aaa" }}>
                      {media.uploadedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: "#888", marginTop: 10, fontStyle: "italic" }}>
              💡 최근 4개월 동안 수집된 평가 증거물입니다. 부모 상담 및 다음 기관 인계 시 참고하세요.
            </div>
          </div>
        );
      })()}

      {/* PDF-11: 주요 성과 박스 제거 (사용자 요청) */}
      {/* ★ 안내 박스는 ReturnTab 시작 부분에 모드별로 표시됨 (interim/final) */}

      {/* 요약 카드 */}
      <div style={{ ...CS, padding: 0, overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg, ${PK} 0%, ${PKD} 100%)`, padding: "16px 20px", color: "#fff" }}>
          <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 3 }}>{isFinalMode ? "종결보고서" : "중간보고서"} · {info.name || "아동"}</div>
          <div style={{ fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* 종결모드: evalStart ~ finalEndDate (전체 치료 기간) / 중간모드: pStart ~ pEnd (보고 기간) */}
            {/* ★ pStart 우선순위: 사용자 입력 > 첫 데이터 입력일 > evalStart */}
            {(() => {
              const firstDataDate = (() => {
                if (!stosForReport || stosForReport.length === 0) return null;
                const dates = [];
                stosForReport.forEach(s => (s.points || []).forEach(p => { if (p.date) dates.push(p.date); }));
                return dates.length > 0 ? dates.sort()[0] : null;
              })();
              const start = isFinalMode
                ? (info.evalStart || "—")
                : (info.pStart || firstDataDate || info.evalStart || "—");

              if (isFinalMode) {
                return (
                  <>
                    <span>{start}</span>
                    <span style={{ opacity: 0.7 }}>~</span>
                    <input
                      type="date"
                      value={info.finalEndDate || ""}
                      onChange={e => {
                        const newDate = e.target.value;
                        const oldDate = info.finalEndDate || "";
                        // ★ [신규] 빈 값 → 날짜 입력: 종결 처리 확인
                        if (!oldDate && newDate) {
                          askConfirm(
                            `'${info.name || "이 아동"}'을(를) 종결 상태로 변경하시겠습니까?\n\n` +
                            `종결일: ${newDate}\n\n` +
                            `종결 상태가 되면 대시보드의 '종료' 카운트에 포함됩니다.\n` +
                            `(언제든 날짜를 지워서 다시 활동중으로 되돌릴 수 있어요)`,
                            () => setInfo(prev => ({ ...prev, finalEndDate: newDate }))
                          );
                          return;
                        }
                        // 날짜 변경 또는 삭제는 바로 적용
                        setInfo(prev => ({ ...prev, finalEndDate: newDate }));
                      }}
                      style={{
                        fontSize: 17, fontWeight: 700,
                        background: "rgba(255,255,255,0.2)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.4)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontFamily: "inherit",
                        colorScheme: "dark",
                        cursor: "pointer"
                      }}
                      title="종결일 (클릭해서 변경)"
                    />
                    {!info.finalEndDate && (
                      <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 400, fontStyle: "italic" }}>← 종결일 입력 (입력 시 종결 처리)</span>
                    )}
                    {info.finalEndDate && (
                      <button
                        onClick={() => {
                          askConfirm(
                            `'${info.name || "이 아동"}'의 종결 상태를 해제하시겠습니까?\n\n종결일이 삭제되고 '활동 중' 상태로 돌아갑니다.`,
                            () => setInfo(prev => ({ ...prev, finalEndDate: "" }))
                          );
                        }}
                        style={{
                          fontSize: 10.5, fontWeight: 600,
                          background: "rgba(255,255,255,0.25)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.5)",
                          borderRadius: 6,
                          padding: "3px 10px",
                          cursor: "pointer",
                          fontFamily: "inherit"
                        }}
                        title="종결 해제 — 다시 활동 중 상태로">
                        ↺ 종결 해제
                      </button>
                    )}
                  </>
                );
              } else {
                const end = info.pEnd || new Date().toISOString().slice(0, 10);
                return <span>{start} ~ {end}</span>;
              }
            })()}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 0, padding: "14px 0" }}>
          {[
            { label: "총 목표", val: `${goals.length}개`, color: PKD },
            { label: "기록된 목표", val: `${summary.recorded}/${summary.total}`, color: BLUE },
            { label: "평균 수행률", val: summary.avg === null ? "—" : `${summary.avg}%`, color: summary.avg === null ? "#ccc" : summary.avg >= 80 ? GREEN : summary.avg >= 50 ? BLUE : ORANGE },
            { label: "숙달 근접 (80%+)", val: `${summary.mastered}개`, color: GREEN },
            { label: "세션 수", val: `${summary.sessions}회`, color: "#555" }
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "6px 10px", borderRight: i < 4 ? "1px solid #f0e0e5" : "none" }}>
              <div style={{ fontSize: 10, color: "#767676", marginBottom: 4, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 영역별 평균 비교 */}
      {currentAvgs.length > 0 && (
        <div style={CS}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 12, color: PKD }}>영역별 수행 현황</h3>
          <div className="responsive-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textAlign: "center" }}>현재 수행률 (최근 데일리 기록 평균)</div>
              <RadarChart data={currentAvgs} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textAlign: "center" }}>영역별 현재 수행률 (%)</div>
              <BarChart data={currentAvgs} />
            </div>
          </div>
          <div style={{ marginTop: 10, padding: "8px 12px", background: PKL, borderRadius: 8, fontSize: 11, color: PKD, lineHeight: 1.6 }}>
            💡 이 그래프는 [③ 데일리 데이터]에서 기록한 <b>정반응률의 최근 수치</b>를 영역별로 평균한 것입니다. 데일리 기록이 없는 목표는 기초선 값이 사용됩니다.
          </div>
        </div>
      )}

      {/* 영역별 진전도 추이 (시간축 다중 꺾은선) */}
      {(() => {
        const TREND_COLORS = ["#C97B92", "#B5895F", "#8E7BB0", "#7089A0", "#7BA05B", "#5A9AAA", "#C99A5B", "#A87088"];
        // 영역별로 목표를 묶고, 날짜별 평균 정반응률 계산
        const domainMap = {};  // domain -> { date -> [rate들] }
        (goals || []).filter(g => g.includeInIep).forEach(g => {
          const dom = g.domain || "(영역 없음)";
          const series = (typeof getTimeline === "function") ? getTimeline(g) : [];
          series.forEach(pt => {
            if (pt.rate == null || isNaN(pt.rate)) return;
            if (!domainMap[dom]) domainMap[dom] = {};
            if (!domainMap[dom][pt.date]) domainMap[dom][pt.date] = [];
            domainMap[dom][pt.date].push(Number(pt.rate));
          });
        });
        const trendSeries = Object.keys(domainMap).map((dom, i) => ({
          domain: dom,
          color: TREND_COLORS[i % TREND_COLORS.length],
          points: Object.keys(domainMap[dom]).sort().map(date => {
            const arr = domainMap[dom][date];
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            return { date, rate: Math.round(avg) };
          })
        })).filter(s => s.points.length > 0);

        if (trendSeries.length === 0) return null;

        return (
          <div style={CS}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 4, color: PKD }}>📈 영역별 진전도 추이</h3>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
              데일리 기록 날짜에 따라 각 영역의 평균 정반응률이 어떻게 변해왔는지 보여줍니다.
            </div>
            <DomainTrendChart series={trendSeries} />
          </div>
        );
      })()}

      {/* W-34: VB-MAPP 마일스톤 격자 (보고서 탭에도 표시 — 인쇄에는 별도 섹션) */}
      {(() => {
        const hasVbmapp = (goals || []).some(g =>
          g.source === "VB-MAPP" || classifyCurriculum(g.domain || "") === "vbmapp"
        );
        if (!hasVbmapp) return null;
        return (
          <div style={CS}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 12, color: PKD }}>VB-MAPP 마일스톤 현황</h3>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7, padding: "8px 12px", background: "#FEFAF6", borderLeft: "2px solid #FBDBC6", borderRadius: 4, marginBottom: 12 }}>
              ※ VB-MAPP은 자폐 아동의 언어/사회성 발달을 16개 영역, 3단계(Level 1~3)로 평가하는 표준 도구입니다.<br />
              ※ 색깔 동그라미(●)는 해당 마일스톤이 달성(리스트 2 이동)되었음을 의미합니다.
            </div>
            <VbmappGrid goals={goals} />
          </div>
        );
      })()}

      {/* 성장 추이 (시계열) */}
      {allDates.length > 1 && (
        <div style={CS}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 12, color: PKD }}>성장 추이 (전체 목표 평균)</h3>
          <GrowthLineChart goals={goals} dates={allDates} getTimeline={getTimeline} />
          <div style={{ marginTop: 10, padding: "8px 12px", background: PKL, borderRadius: 8, fontSize: 11, color: PKD, lineHeight: 1.6 }}>
            💡 날짜별 전체 목표의 평균 정반응률 추이입니다. 우상향 = 전반적 성장, 평탄 = 숙달 안정기.
          </div>
        </div>
      )}

      {/* PDF-1: 목표별 세부 학습 카드 + 미니 라인 차트 (종결모드면 영역별 평균만) */}
      {isFinalMode ? (
        goals && goals.length > 0 && (
          <div style={CS}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 8, color: "#3d6014" }}>📊 영역별 완료 현황</h3>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7, padding: "8px 12px", background: "#f5f7f0", borderLeft: "3px solid #5a8c1f", borderRadius: 4, marginBottom: 12 }}>
              ※ 종결 시점에 각 영역에서 마스터된 과제 수와 진행 상황을 한눈에 보여줍니다.
            </div>
            <DomainCompletionSection goals={goals} />
          </div>
        )
      ) : (
        stosForReport && stosForReport.length > 0 && (
          <div style={CS}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 8, color: PKD }}>📊 영역별 세부 학습 목표</h3>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7, padding: "8px 12px", background: "#FFFAFB", borderLeft: "2px solid #F5A0B1", borderRadius: 4, marginBottom: 12 }}>
              ※ 각 목표는 영역별로 그룹화되어 있으며, 진행률과 최근 데이터 추이를 함께 표시합니다.<br />
              ※ 미니 추이선은 학습 시작부터 현재까지의 평가 데이터 흐름을 보여줍니다.
            </div>
            {/* ★ 컷오프 알림 — 이전 보고서 보관 후 그래프 새로 그리는 중 */}
            {effectiveArchiveList && effectiveArchiveList.length > 0 && effectiveArchiveList[0].savedAt && (
              <div style={{ fontSize: 11, color: "#1d4d80", lineHeight: 1.6, padding: "8px 12px", background: "#e8f4ff", borderLeft: "3px solid #2a6cb2", borderRadius: 4, marginBottom: 12 }}>
                💡 <b>그래프 컷오프 적용 중</b> — 가장 최근 보관된 보고서({effectiveArchiveList[0].savedAt.slice(0, 10)}) 이후 데이터만 표시되고 있습니다. 이전 데이터를 다시 보려면 아래 보관함에서 해당 보고서를 삭제하세요.
              </div>
            )}
            <GoalDashboard stos={goalsForReport} />
          </div>
        )
      )}

      {/* ★ [중복 제거] '영역별 현행 수준' 섹션 제거 — 영역별 수행 현황(레이더), 영역별 세부 학습 목표(그래프)에 동일 정보 */}
      {/* ★ [중복 제거] '현재 진행 과제' 표 제거 — 영역별 세부 학습 목표 카드에 같은 task 정보 있음 */}
      {/* ★ [중복 제거] '습득 완료 과제' 표 제거 — 영역별 세부 학습 목표 그래프에 마스터된 task 정보 시각화됨 */}

      {/* ★ [종결보고서 전용] 치료 개요 입력 박스 — 의뢰 사유, 종결 사유, 종결일 */}
      {isFinalMode && (
        <div style={{ ...CS, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 12, color: "#3d6014" }}>
            🎓 치료 개요
            <span style={{ fontSize: 10, fontWeight: 500, color: "#767676", marginLeft: 8 }}>
              (의뢰 사유 · 종결 사유 · 치료 빈도)
            </span>
          </h3>
          {/* ★ 치료 시작일·종결일은 요약 카드 헤더로 이동 (중복 제거) */}

          {/* ★ 치료 빈도 (주 N회 × N분) */}
          <div className="responsive-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14, padding: 10, background: "#f9f7f0", border: "1px solid #e5d8a8", borderRadius: 6 }}>
            <div>
              <label style={{ fontSize: 10.5, color: "#5a8c1f", fontWeight: 500, display: "block", marginBottom: 4 }}>주 회수</label>
              <select
                value={info.sWeek || ""}
                onChange={e => setInfo(prev => ({ ...prev, sWeek: e.target.value }))}
                style={{ width: "100%", padding: "5px 8px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", background: "#fff" }}>
                <option value="">선택</option>
                <option value="1">주 1회</option>
                <option value="2">주 2회</option>
                <option value="3">주 3회</option>
                <option value="4">주 4회</option>
                <option value="5">주 5회</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10.5, color: "#5a8c1f", fontWeight: 500, display: "block", marginBottom: 4 }}>회기 시간 (분)</label>
              <input
                type="number"
                placeholder="예: 50"
                value={info.sMin || ""}
                onChange={e => setInfo(prev => ({ ...prev, sMin: e.target.value }))}
                style={{ width: "100%", padding: "5px 8px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10.5, color: "#5a8c1f", fontWeight: 500, display: "block", marginBottom: 4 }}>총 예정 회기</label>
              <input
                type="number"
                placeholder="자동 계산"
                value={info.sTotal || ""}
                onChange={e => setInfo(prev => ({ ...prev, sTotal: e.target.value }))}
                style={{ width: "100%", padding: "5px 8px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* ★ 의뢰 사유 — 칩 클릭(키워드 ON/OFF) + [✨ 자동 생성] 버튼 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10.5, color: "#5a8c1f", fontWeight: 500, display: "block", marginBottom: 4 }}>의뢰 사유 <span style={{ fontSize: 9, color: "#888", fontWeight: 400 }}>(키워드 선택 후 [✨ 자동 생성] 버튼 클릭)</span></label>
            {(() => {
              const REFERRAL_CHIPS = [
                ["표현 언어 지연", "lang"],
                ["수용 언어 지연", "lang"],
                ["비구어/제한된 발성", "lang"],
                ["또래 상호작용 어려움", "social"],
                ["눈맞춤·공동주의 부족", "social"],
                ["사회적 단서 이해 부족", "social"],
                ["도전 행동", "behav"],
                ["자기자극·상동 행동", "behav"],
                ["변화·전환 어려움", "behav"],
                ["자조 기술 부족", "adapt"],
                ["학습 준비 부족", "adapt"],
                ["감각 처리 어려움", "adapt"]
              ];

              const MARKER_RE = /\n*<!--SELECTED:([^>]*)-->\s*$/;
              const currentValue = info.finalReferralReason || "";
              const markerMatch = currentValue.match(MARKER_RE);
              const selected = markerMatch ? markerMatch[1].split("|").filter(Boolean) : [];
              const visibleText = currentValue.replace(MARKER_RE, "").trim();
              const selectedSet = new Set(selected);

              const toggle = (label) => {
                const newSel = new Set(selectedSet);
                if (newSel.has(label)) newSel.delete(label);
                else newSel.add(label);
                const arr = Array.from(newSel);
                const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
                setInfo(prev => ({ ...prev, finalReferralReason: visibleText + marker }));
              };

              const generate = () => {
                const arr = Array.from(selectedSet);
                if (arr.length === 0) return;
                const para = buildReferralReason(arr, info);
                const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
                setInfo(prev => ({ ...prev, finalReferralReason: para + marker }));
              };

              const clear = () => {
                setInfo(prev => ({ ...prev, finalReferralReason: "" }));
              };

              return (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {REFERRAL_CHIPS.map(([label], i) => {
                      const isSelected = selectedSet.has(label);
                      return (
                        <button key={i}
                          onClick={() => toggle(label)}
                          style={{
                            padding: "3px 9px", fontSize: 10,
                            border: isSelected ? "1px solid #5a8c1f" : "1px solid #c5d99c",
                            borderRadius: 12,
                            background: isSelected ? "#5a8c1f" : "#f5f7f0",
                            color: isSelected ? "#fff" : "#3d6014",
                            cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                          }}>
                          {isSelected ? "✓" : "+"} {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <button
                      onClick={generate}
                      disabled={selectedSet.size === 0}
                      style={{
                        padding: "6px 14px", fontSize: 11,
                        border: "1px solid #5a8c1f",
                        borderRadius: 6,
                        background: selectedSet.size === 0 ? "#f0f0f0" : "#5a8c1f",
                        color: selectedSet.size === 0 ? "#aaa" : "#fff",
                        cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                        fontFamily: "inherit", fontWeight: 600
                      }}>
                      ✨ 자동 생성
                    </button>
                    <button
                      onClick={clear}
                      style={{
                        padding: "6px 12px", fontSize: 10.5,
                        border: "1px solid #ccc", borderRadius: 6,
                        background: "#fff", color: "#666",
                        cursor: "pointer", fontFamily: "inherit"
                      }}>
                      🗑 초기화
                    </button>
                    <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                      {selectedSet.size > 0 ? `선택: ${selectedSet.size}개 — [✨ 자동 생성] 누르면 단락 작성됩니다` : "키워드를 먼저 선택하세요"}
                    </span>
                  </div>
                  <textarea
                    value={visibleText}
                    onChange={e => {
                      const marker = selected.length > 0 ? `\n\n<!--SELECTED:${selected.join("|")}-->` : "";
                      setInfo(prev => ({ ...prev, finalReferralReason: e.target.value + marker }));
                    }}
                    placeholder="키워드 선택 후 [✨ 자동 생성]을 누르면 자연스러운 단락이 들어갑니다. 직접 입력·수정도 가능합니다."
                    rows={6}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", lineHeight: 1.75, resize: "vertical", boxSizing: "border-box" }}
                  />
                </>
              );
            })()}
          </div>

          {/* ★ 종결 사유 — 칩 클릭(키워드 ON/OFF) + [✨ 자동 생성] 버튼 */}
          <div>
            <label style={{ fontSize: 10.5, color: "#5a8c1f", fontWeight: 500, display: "block", marginBottom: 4 }}>종결 사유 <span style={{ fontSize: 9, color: "#888", fontWeight: 400 }}>(키워드 선택 후 [✨ 자동 생성] 버튼 클릭)</span></label>
            {(() => {
              const END_CHIPS = ["IEP 목표 달성", "일반화 안정화", "다음 단계 이행", "보호자 의사", "가족 사정", "치료 기간 만료"];

              const MARKER_RE_END = /\n*<!--SELECTED:([^>]*)-->\s*$/;
              const currentValueEnd = info.finalEndReason || "";
              const markerMatchEnd = currentValueEnd.match(MARKER_RE_END);
              const selectedEnd = markerMatchEnd ? markerMatchEnd[1].split("|").filter(Boolean) : [];
              const visibleTextEnd = currentValueEnd.replace(MARKER_RE_END, "").trim();
              const selectedSetEnd = new Set(selectedEnd);

              const toggleEnd = (label) => {
                const newSel = new Set(selectedSetEnd);
                if (newSel.has(label)) newSel.delete(label);
                else newSel.add(label);
                const arr = Array.from(newSel);
                const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
                setInfo(prev => ({ ...prev, finalEndReason: visibleTextEnd + marker }));
              };

              const generateEnd = () => {
                const arr = Array.from(selectedSetEnd);
                if (arr.length === 0) return;
                const para = buildEndReason(arr, info);
                const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
                setInfo(prev => ({ ...prev, finalEndReason: para + marker }));
              };

              const clearEnd = () => {
                setInfo(prev => ({ ...prev, finalEndReason: "" }));
              };

              return (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {END_CHIPS.map((label, i) => {
                      const isSelected = selectedSetEnd.has(label);
                      return (
                        <button key={i}
                          onClick={() => toggleEnd(label)}
                          style={{
                            padding: "3px 9px", fontSize: 10,
                            border: isSelected ? "1px solid #5a8c1f" : "1px solid #c5d99c",
                            borderRadius: 12,
                            background: isSelected ? "#5a8c1f" : "#f5f7f0",
                            color: isSelected ? "#fff" : "#3d6014",
                            cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                          }}>
                          {isSelected ? "✓" : "+"} {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <button
                      onClick={generateEnd}
                      disabled={selectedSetEnd.size === 0}
                      style={{
                        padding: "6px 14px", fontSize: 11,
                        border: "1px solid #5a8c1f",
                        borderRadius: 6,
                        background: selectedSetEnd.size === 0 ? "#f0f0f0" : "#5a8c1f",
                        color: selectedSetEnd.size === 0 ? "#aaa" : "#fff",
                        cursor: selectedSetEnd.size === 0 ? "not-allowed" : "pointer",
                        fontFamily: "inherit", fontWeight: 600
                      }}>
                      ✨ 자동 생성
                    </button>
                    <button
                      onClick={clearEnd}
                      style={{
                        padding: "6px 12px", fontSize: 10.5,
                        border: "1px solid #ccc", borderRadius: 6,
                        background: "#fff", color: "#666",
                        cursor: "pointer", fontFamily: "inherit"
                      }}>
                      🗑 초기화
                    </button>
                    <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                      {selectedSetEnd.size > 0 ? `선택: ${selectedSetEnd.size}개 — [✨ 자동 생성] 누르면 단락 작성됩니다` : "키워드를 먼저 선택하세요"}
                    </span>
                  </div>
                  <textarea
                    value={visibleTextEnd}
                    onChange={e => {
                      const marker = selectedEnd.length > 0 ? `\n\n<!--SELECTED:${selectedEnd.join("|")}-->` : "";
                      setInfo(prev => ({ ...prev, finalEndReason: e.target.value + marker }));
                    }}
                    placeholder="키워드 선택 후 [✨ 자동 생성]을 누르면 자연스러운 단락이 들어갑니다. 직접 입력·수정도 가능합니다."
                    rows={5}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", lineHeight: 1.75, resize: "vertical", boxSizing: "border-box" }}
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ★ [종결보고서 전용] 시작 vs 종결 비교 — 영역별 % 변화 + 마스터 진척 */}

      {/* ★ [종결보고서 전용] 종합 평가 — 자동 생성 + 사용자 수정 */}
      {isFinalMode && (
        <div style={{ ...CS, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#3d6014", flex: 1 }}>
              📋 종합 평가
              <span style={{ fontSize: 10, fontWeight: 500, color: "#767676", marginLeft: 8 }}>
                (전체 치료의 큰 그림 · 자동 생성 후 자유 수정)
              </span>
            </h3>
            <button
              onClick={() => {
                const auto = buildFinalSummary(goals, info);
                setInfo(prev => ({ ...prev, finalSummary: auto }));
              }}
              style={{ padding: "5px 12px", fontSize: 10.5, border: "1px solid #5a8c1f", borderRadius: 6, background: "#f5f7f0", color: "#3d6014", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
              title="현재 데이터로 자동 생성된 문장으로 덮어씁니다 (수동 편집 내용 사라짐)">
              ✨ 자동 생성
            </button>
          </div>
          <textarea
            value={info.finalSummary || ""}
            onChange={e => setInfo(prev => ({ ...prev, finalSummary: e.target.value }))}
            placeholder="[✨ 자동 생성] 버튼을 눌러 시작하거나 직접 작성하세요"
            rows={8}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 12, fontFamily: "inherit", lineHeight: 1.8, resize: "vertical", boxSizing: "border-box" }}
          />
        </div>
      )}

      {/* ★ [종결보고서 전용] 치료 기간 중 성장과 변화 — 자동 생성 + 사용자 수정 */}
      {isFinalMode && (
        <div style={{ ...CS, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#3d6014", flex: 1 }}>
              📈 치료 기간 중 성장과 변화
              <span style={{ fontSize: 10, fontWeight: 500, color: "#767676", marginLeft: 8 }}>
                (시간 흐름과 성취 · 자동 생성 후 자유 수정)
              </span>
            </h3>
            <button
              onClick={() => {
                const auto = buildFinalGrowth(goals, info);
                setInfo(prev => ({ ...prev, finalGrowth: auto }));
              }}
              style={{ padding: "5px 12px", fontSize: 10.5, border: "1px solid #5a8c1f", borderRadius: 6, background: "#f5f7f0", color: "#3d6014", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
              title="현재 데이터로 자동 생성된 문장으로 덮어씁니다 (수동 편집 내용 사라짐)">
              ✨ 자동 생성
            </button>
          </div>
          <textarea
            value={info.finalGrowth || ""}
            onChange={e => setInfo(prev => ({ ...prev, finalGrowth: e.target.value }))}
            placeholder="[✨ 자동 생성] 버튼을 눌러 시작하거나 직접 작성하세요"
            rows={8}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 12, fontFamily: "inherit", lineHeight: 1.8, resize: "vertical", boxSizing: "border-box" }}
          />
        </div>
      )}

      {/* ★ [중간/종결 통일] 문제행동 변화 — 칩 클릭 + [✨ 자동 생성] */}
      {/* ReportTab은 보고서 탭 (④) — IEP 모드 자체 없음. 항상 표시 */}
      <div style={{ ...CS, marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 8, color: "#3d6014" }}>
          문제행동 변화
          <span style={{ fontSize: 10, fontWeight: 500, color: "#767676", marginLeft: 8 }}>
            (선택 · 키워드 선택 후 [✨ 자동 생성])
          </span>
        </h3>
          {(() => {
            const BEHAVIOR_CHIPS = [
              "떼쓰기 감소",
              "공격·자해 행동 감소",
              "자기자극 행동 감소",
              "정서 표현 안정화",
              "전환 상황 적응 향상",
              "수면·식사 패턴 안정",
              "언어로 의사 표현 시도 증가",
              "특이 문제행동 없음"
            ];

            const MARKER_RE = /\n*<!--SELECTED:([^>]*)-->\s*$/;
            const currentValue = info.finalBehaviorChange || "";
            const markerMatch = currentValue.match(MARKER_RE);
            const selected = markerMatch ? markerMatch[1].split("|").filter(Boolean) : [];
            const visibleText = currentValue.replace(MARKER_RE, "").trim();
            const selectedSet = new Set(selected);

            const toggle = (label) => {
              const newSel = new Set(selectedSet);
              if (newSel.has(label)) newSel.delete(label);
              else newSel.add(label);
              const arr = Array.from(newSel);
              const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
              setInfo(prev => ({ ...prev, finalBehaviorChange: visibleText + marker }));
            };

            const generate = () => {
              const arr = Array.from(selectedSet);
              if (arr.length === 0) return;
              const para = buildBehaviorChange(arr, info);
              const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
              setInfo(prev => ({ ...prev, finalBehaviorChange: para + marker }));
            };

            const clear = () => {
              setInfo(prev => ({ ...prev, finalBehaviorChange: "" }));
            };

            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {BEHAVIOR_CHIPS.map((label, i) => {
                    const isSelected = selectedSet.has(label);
                    return (
                      <button key={i}
                        onClick={() => toggle(label)}
                        style={{
                          padding: "3px 9px", fontSize: 10,
                          border: isSelected ? "1px solid #5a8c1f" : "1px solid #c5d99c",
                          borderRadius: 12,
                          background: isSelected ? "#5a8c1f" : "#f5f7f0",
                          color: isSelected ? "#fff" : "#3d6014",
                          cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                        }}>
                        {isSelected ? "✓" : "+"} {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <button
                    onClick={generate}
                    disabled={selectedSet.size === 0}
                    style={{
                      padding: "6px 14px", fontSize: 11,
                      border: "1px solid #5a8c1f",
                      borderRadius: 6,
                      background: selectedSet.size === 0 ? "#f0f0f0" : "#5a8c1f",
                      color: selectedSet.size === 0 ? "#aaa" : "#fff",
                      cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                      fontFamily: "inherit", fontWeight: 600
                    }}>
                    ✨ 자동 생성
                  </button>
                  <button
                    onClick={clear}
                    style={{
                      padding: "6px 12px", fontSize: 10.5,
                      border: "1px solid #ccc", borderRadius: 6,
                      background: "#fff", color: "#666",
                      cursor: "pointer", fontFamily: "inherit"
                    }}>
                    🗑 초기화
                  </button>
                  <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                    {selectedSet.size > 0 ? `선택: ${selectedSet.size}개 — [✨ 자동 생성] 누르면 변화 양상이 작성됩니다` : "특이 문제행동 없으면 비워두셔도 됩니다"}
                  </span>
                </div>
                <textarea
                  value={visibleText}
                  onChange={e => {
                    const marker = selected.length > 0 ? `\n\n<!--SELECTED:${selected.join("|")}-->` : "";
                    setInfo(prev => ({ ...prev, finalBehaviorChange: e.target.value + marker }));
                  }}
                  placeholder="치료 시작 시 보였던 문제행동의 변화를 작성하세요. 비워두면 인쇄에서 자동 생략됩니다."
                  rows={6}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 12, fontFamily: "inherit", lineHeight: 1.85, resize: "vertical", boxSizing: "border-box" }}
                />
              </>
            );
          })()}
        </div>

      {/* ★ [종결보고서 전용] 습득 완료 목표 모음 — 영역별 그룹화 */}

      {/* ★ [종결보고서 전용] 가정에서의 유지 방안 — 칩 클릭 + [✨ 자동 생성] */}
      {isFinalMode && (
        <div style={{ ...CS, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 8, color: "#3d6014" }}>
            🏠 가정에서의 유지 방안
            <span style={{ fontSize: 10, fontWeight: 500, color: "#767676", marginLeft: 8 }}>
              (키워드 선택 후 [✨ 자동 생성] 버튼 클릭)
            </span>
          </h3>
          {(() => {
            const HOME_CHIPS = [
              "일관된 강화 유지",
              "일상 루틴에 통합",
              "가족 모두 같은 방식 적용",
              "선호 활동을 활용",
              "일반화 환경 다양화",
              "도전 행동 발생 시 무관심 후 대안 행동 강화",
              "정기적 부모 모니터링",
              "퇴행 시 즉시 ABA 치료 재개 검토",
              "또래 상호작용 기회 정기 마련",
              "시각적 일정표·사진 단서 활용"
            ];

            const MARKER_RE = /\n*<!--SELECTED:([^>]*)-->\s*$/;
            const currentValue = info.finalHomeMaintenance || "";
            const markerMatch = currentValue.match(MARKER_RE);
            const selected = markerMatch ? markerMatch[1].split("|").filter(Boolean) : [];
            const visibleText = currentValue.replace(MARKER_RE, "").trim();
            const selectedSet = new Set(selected);

            const toggle = (label) => {
              const newSel = new Set(selectedSet);
              if (newSel.has(label)) newSel.delete(label);
              else newSel.add(label);
              const arr = Array.from(newSel);
              const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
              setInfo(prev => ({ ...prev, finalHomeMaintenance: visibleText + marker }));
            };

            const generate = () => {
              const arr = Array.from(selectedSet);
              if (arr.length === 0) return;
              const para = buildHomeMaintenance(arr, info);
              const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
              setInfo(prev => ({ ...prev, finalHomeMaintenance: para + marker }));
            };

            const clear = () => {
              setInfo(prev => ({ ...prev, finalHomeMaintenance: "" }));
            };

            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {HOME_CHIPS.map((label, i) => {
                    const isSelected = selectedSet.has(label);
                    return (
                      <button key={i}
                        onClick={() => toggle(label)}
                        style={{
                          padding: "3px 9px", fontSize: 10,
                          border: isSelected ? "1px solid #5a8c1f" : "1px solid #c5d99c",
                          borderRadius: 12,
                          background: isSelected ? "#5a8c1f" : "#f5f7f0",
                          color: isSelected ? "#fff" : "#3d6014",
                          cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                        }}>
                        {isSelected ? "✓" : "+"} {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <button
                    onClick={generate}
                    disabled={selectedSet.size === 0}
                    style={{
                      padding: "6px 14px", fontSize: 11,
                      border: "1px solid #5a8c1f",
                      borderRadius: 6,
                      background: selectedSet.size === 0 ? "#f0f0f0" : "#5a8c1f",
                      color: selectedSet.size === 0 ? "#aaa" : "#fff",
                      cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                      fontFamily: "inherit", fontWeight: 600
                    }}>
                    ✨ 자동 생성
                  </button>
                  <button
                    onClick={clear}
                    style={{
                      padding: "6px 12px", fontSize: 10.5,
                      border: "1px solid #ccc", borderRadius: 6,
                      background: "#fff", color: "#666",
                      cursor: "pointer", fontFamily: "inherit"
                    }}>
                    🗑 초기화
                  </button>
                  <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                    {selectedSet.size > 0 ? `선택: ${selectedSet.size}개 — [✨ 자동 생성] 누르면 가정 유지방안이 작성됩니다` : "키워드를 먼저 선택하세요"}
                  </span>
                </div>
                <textarea
                  value={visibleText}
                  onChange={e => {
                    const marker = selected.length > 0 ? `\n\n<!--SELECTED:${selected.join("|")}-->` : "";
                    setInfo(prev => ({ ...prev, finalHomeMaintenance: e.target.value + marker }));
                  }}
                  placeholder="키워드 선택 후 [✨ 자동 생성]을 누르면 자연스러운 가정 유지방안이 들어갑니다. 직접 입력·수정도 가능합니다."
                  rows={10}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 12, fontFamily: "inherit", lineHeight: 1.85, resize: "vertical", boxSizing: "border-box" }}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* ★ [종결보고서 전용] 다음 기관 인계 정보 — 칩 클릭 + [✨ 자동 생성] */}
      {isFinalMode && (
        <div style={{ ...CS, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 8, color: "#3d6014" }}>
            🤝 다음 기관 인계 정보
            <span style={{ fontSize: 10, fontWeight: 500, color: "#767676", marginLeft: 8 }}>
              (선택 · 효과적인 강화제·선호 활동·주의사항 등)
            </span>
          </h3>
          {(() => {
            const HANDOVER_CHIPS = [
              "사회적 강화에 잘 반응",
              "선호 간식 효과적",
              "토큰 시스템 활용",
              "캐릭터·스티커 선호",
              "음악·노래 활동 선호",
              "신체 활동 좋아함",
              "구조화된 환경 필요",
              "전환 시 사전 예고 필요",
              "특정 자극에 민감",
              "낯가림·새 환경 적응 시간 필요",
              "공동 주의 단서 효과적",
              "촉구 단계적 소거 효과"
            ];

            const MARKER_RE = /\n*<!--SELECTED:([^>]*)-->\s*$/;
            const currentValue = info.finalHandover || "";
            const markerMatch = currentValue.match(MARKER_RE);
            const selected = markerMatch ? markerMatch[1].split("|").filter(Boolean) : [];
            const visibleText = currentValue.replace(MARKER_RE, "").trim();
            const selectedSet = new Set(selected);

            const toggle = (label) => {
              const newSel = new Set(selectedSet);
              if (newSel.has(label)) newSel.delete(label);
              else newSel.add(label);
              const arr = Array.from(newSel);
              const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
              setInfo(prev => ({ ...prev, finalHandover: visibleText + marker }));
            };

            const generate = () => {
              const arr = Array.from(selectedSet);
              if (arr.length === 0) return;
              const para = buildHandover(arr, info);
              const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
              setInfo(prev => ({ ...prev, finalHandover: para + marker }));
            };

            const clear = () => {
              setInfo(prev => ({ ...prev, finalHandover: "" }));
            };

            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {HANDOVER_CHIPS.map((label, i) => {
                    const isSelected = selectedSet.has(label);
                    return (
                      <button key={i}
                        onClick={() => toggle(label)}
                        style={{
                          padding: "3px 9px", fontSize: 10,
                          border: isSelected ? "1px solid #5a8c1f" : "1px solid #c5d99c",
                          borderRadius: 12,
                          background: isSelected ? "#5a8c1f" : "#f5f7f0",
                          color: isSelected ? "#fff" : "#3d6014",
                          cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                        }}>
                        {isSelected ? "✓" : "+"} {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <button
                    onClick={generate}
                    disabled={selectedSet.size === 0}
                    style={{
                      padding: "6px 14px", fontSize: 11,
                      border: "1px solid #5a8c1f",
                      borderRadius: 6,
                      background: selectedSet.size === 0 ? "#f0f0f0" : "#5a8c1f",
                      color: selectedSet.size === 0 ? "#aaa" : "#fff",
                      cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                      fontFamily: "inherit", fontWeight: 600
                    }}>
                    ✨ 자동 생성
                  </button>
                  <button
                    onClick={clear}
                    style={{
                      padding: "6px 12px", fontSize: 10.5,
                      border: "1px solid #ccc", borderRadius: 6,
                      background: "#fff", color: "#666",
                      cursor: "pointer", fontFamily: "inherit"
                    }}>
                    🗑 초기화
                  </button>
                  <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                    {selectedSet.size > 0 ? `선택: ${selectedSet.size}개 — 다른 기관 이동 시 참고용` : "다른 기관으로 이동 예정 시에만 작성하세요"}
                  </span>
                </div>
                <textarea
                  value={visibleText}
                  onChange={e => {
                    const marker = selected.length > 0 ? `\n\n<!--SELECTED:${selected.join("|")}-->` : "";
                    setInfo(prev => ({ ...prev, finalHandover: e.target.value + marker }));
                  }}
                  placeholder="다른 기관으로 이동할 경우, 효과적이었던 강화제·선호 활동·주의사항 등을 작성합니다. 비워두면 인쇄 시 자동 생략됩니다."
                  rows={8}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 12, fontFamily: "inherit", lineHeight: 1.85, resize: "vertical", boxSizing: "border-box" }}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* ★ [종결보고서 전용] 7. 권고사항 — 칩 클릭 + [✨ 자동 생성] */}
      {isFinalMode && (
        <div style={{ ...CS, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 8, color: "#3d6014" }}>
            🎯 권고사항
            <span style={{ fontSize: 10, fontWeight: 500, color: "#767676", marginLeft: 8 }}>
              (키워드 선택 후 [✨ 자동 생성] 버튼 클릭)
            </span>
          </h3>
          {(() => {
            const REC_CHIPS = [
              "후속 ABA 치료 권고",
              "언어치료 병행 권고",
              "감각통합치료 병행 권고",
              "유치원·학교 입학 후 적응 모니터링",
              "일반화·유지 위한 재평가",
              "가정 내 행동지원 지속",
              "또래 상호작용 기회 확대 권고",
              "필요 시 BCBA 컨설팅 재개"
            ];

            const MARKER_RE = /\n*<!--SELECTED:([^>]*)-->\s*$/;
            const currentValue = info.finalRecommendations || "";
            const markerMatch = currentValue.match(MARKER_RE);
            const selected = markerMatch ? markerMatch[1].split("|").filter(Boolean) : [];
            const visibleText = currentValue.replace(MARKER_RE, "").trim();
            const selectedSet = new Set(selected);

            const toggle = (label) => {
              const newSel = new Set(selectedSet);
              if (newSel.has(label)) newSel.delete(label);
              else newSel.add(label);
              const arr = Array.from(newSel);
              const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
              setInfo(prev => ({ ...prev, finalRecommendations: visibleText + marker }));
            };

            const generate = () => {
              const arr = Array.from(selectedSet);
              if (arr.length === 0) return;
              const para = buildRecommendations(arr, info);
              const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
              setInfo(prev => ({ ...prev, finalRecommendations: para + marker }));
            };

            const clear = () => {
              setInfo(prev => ({ ...prev, finalRecommendations: "" }));
            };

            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {REC_CHIPS.map((label, i) => {
                    const isSelected = selectedSet.has(label);
                    return (
                      <button key={i}
                        onClick={() => toggle(label)}
                        style={{
                          padding: "3px 9px", fontSize: 10,
                          border: isSelected ? "1px solid #5a8c1f" : "1px solid #c5d99c",
                          borderRadius: 12,
                          background: isSelected ? "#5a8c1f" : "#f5f7f0",
                          color: isSelected ? "#fff" : "#3d6014",
                          cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                        }}>
                        {isSelected ? "✓" : "+"} {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <button
                    onClick={generate}
                    disabled={selectedSet.size === 0}
                    style={{
                      padding: "6px 14px", fontSize: 11,
                      border: "1px solid #5a8c1f",
                      borderRadius: 6,
                      background: selectedSet.size === 0 ? "#f0f0f0" : "#5a8c1f",
                      color: selectedSet.size === 0 ? "#aaa" : "#fff",
                      cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                      fontFamily: "inherit", fontWeight: 600
                    }}>
                    ✨ 자동 생성
                  </button>
                  <button
                    onClick={clear}
                    style={{
                      padding: "6px 12px", fontSize: 10.5,
                      border: "1px solid #ccc", borderRadius: 6,
                      background: "#fff", color: "#666",
                      cursor: "pointer", fontFamily: "inherit"
                    }}>
                    🗑 초기화
                  </button>
                  <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                    {selectedSet.size > 0 ? `선택: ${selectedSet.size}개 — [✨ 자동 생성] 누르면 권고사항이 작성됩니다` : "키워드를 먼저 선택하세요"}
                  </span>
                </div>
                <textarea
                  value={visibleText}
                  onChange={e => {
                    const marker = selected.length > 0 ? `\n\n<!--SELECTED:${selected.join("|")}-->` : "";
                    setInfo(prev => ({ ...prev, finalRecommendations: e.target.value + marker }));
                  }}
                  placeholder="키워드 선택 후 [✨ 자동 생성]을 누르면 자연스러운 권고사항이 들어갑니다. 직접 입력·수정도 가능합니다."
                  rows={8}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4e5ba", borderRadius: 6, fontSize: 12, fontFamily: "inherit", lineHeight: 1.85, resize: "vertical", boxSizing: "border-box" }}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* ★ [종결보고서 전용] 9. 문제행동 변화 (선택) — 수동 입력 (자동 데이터 없을 때 빈 칸으로 둘 수 있음) */}
      {/* 🆕 AI 서술형 중간보고서 생성 섹션 (중간모드 전용 — 종결모드는 별도 자동 생성 섹션 사용) */}
      {!isFinalMode && (
        <ReportGeneratorSection
          info={info}
          stos={stosForReport}
          domAvgs={currentAvgs}
          reportFields={reportFields}
          reportSelStrats={reportSelStrats}
          reportSelStratsCustom={reportSelStratsCustom}
          reportSelPrein={reportSelPrein}
          reportSelSrein={reportSelSrein}
          reportReinfSchedule={reportReinfSchedule}
          reportBehaviors={reportBehaviors}
          reportSections={reportSections}
          setReportField={setReportField}
          setReportPatch={setReportPatch}
          setInfo={setInfo}
          dailyMemos={dailyMemos}
          archiveList={effectiveArchiveList}
        />
      )}

      {/* ═ W-35: 보관된 이전 보고서 (IEP 보관본 제외 — IEP 보관함은 별도) ═ */}
      <ArchiveListCard
        list={(visibleArchiveList || []).filter(a => !a.isIep)}
        onSave={onArchiveSave}
        onDelete={onArchiveDelete}
        onView={onArchiveView}
        cutoffDisabled={cutoffDisabled}
        setCutoffDisabled={setCutoffDisabled}
      />

      {/* 액션 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, gap: 8 }}>
        <button style={BS} onClick={onPrev}>← 데일리 데이터</button>
        <div style={{ display: "flex", gap: 8 }}>
          {onPreview && (
            <button style={{ ...BS, background: "#fff", border: "1px solid #b9d4ee", color: "#1d4d80", fontWeight: 600 }} onClick={onPreview} title="보관 없이 인쇄 양식만 미리보기 (데이터에 영향 없음)">👁 미리보기 (보관 안 함)</button>
          )}
          <button style={isFinalMode ? { ...BP, background: "#5a8c1f" } : BP} onClick={onPrint}>
            {isFinalMode ? "🎓 종결보고서 양식으로 인쇄하기" : "📄 중간보고서 양식으로 인쇄하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchiveListCard({ list, onSave, onDelete, onView, cutoffDisabled, setCutoffDisabled }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmSave, setConfirmSave] = useState(false);  // ★ 보관 확인 모드
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");  // "all" / "interim" / "final" / "auto" / "manual"
  const [sortMode, setSortMode] = useState("recent");  // "recent" / "old" / "order"
  const count = (list || []).length;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setConfirmSave(false);  // 확인 모드 종료
    try {
      const res = await onSave();
      if (res?.skipped && res.reason === "empty") {
        alert("보관할 보고서 내용이 없습니다. 먼저 [보고서 생성]을 눌러 본문을 작성해 주세요.");
      } else if (res) {
        alert(res.overwrite ? "✅ 같은 기간의 자동 보관본을 업데이트했습니다." : "✅ 현재 보고서를 보관함에 저장했습니다.\n\n다음 보고서부터는 보관 시점 이후 데이터만 그래프에 표시됩니다.");
      }
    } catch (e) {
      alert("보관 실패: " + String(e));
    }
    setSaving(false);
  };

  const fmtSavedAt = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ ...CS, marginTop: 16 }} className="no-print">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 10 : 0, gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: PKD, padding: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          <span>📁 보관된 이전 보고서</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: PKL, color: PKD, fontWeight: 500 }}>{count}개</span>
          <span style={{ fontSize: 12, color: "#999" }}>{open ? "▼" : "▶"}</span>
        </button>
        {confirmSave ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, color: "#a85020", fontWeight: 600 }}>보관 후 그래프가 새로 그려집니다.</span>
            <button onClick={handleSave} disabled={saving}
              style={{ ...BS, fontSize: 11, padding: "5px 12px", background: "#eaf3de", borderColor: "#c0dd97", color: "#27500a", fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "저장 중..." : "확인"}
            </button>
            <button onClick={() => setConfirmSave(false)} disabled={saving}
              style={{ ...BS, fontSize: 11, padding: "5px 12px" }}>
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmSave(true)}
            disabled={saving}
            style={{ ...BS, fontSize: 11, padding: "5px 12px", background: saving ? "#f0f0f0" : "#eaf3de", borderColor: "#c0dd97", color: "#27500a", fontWeight: 600, cursor: saving ? "wait" : "pointer" }}
            title="현재 작성 중인 보고서를 보관함에 저장 — 클릭 후 한 번 더 확인합니다"
          >
            {saving ? "저장 중..." : "💾 현재 보고서 보관"}
          </button>
        )}
      </div>
      {open && (
        <>
          {count === 0 ? (
            <div style={{ padding: "16px 14px", textAlign: "center", color: "#999", fontSize: 12, background: "#fafafa", borderRadius: 8, border: "1px dashed #e0e0e0" }}>
              아직 보관된 보고서가 없습니다.<br />
              <span style={{ fontSize: 10 }}>인쇄 시 자동 보관되거나, 위 버튼으로 직접 보관할 수 있습니다.</span>
            </div>
          ) : (() => {
            const q = search.trim().toLowerCase();
            let filtered = (list || []).filter(item => {
              if (filter === "interim" && item.isFinal) return false;
              if (filter === "final" && !item.isFinal) return false;
              if (filter === "auto" && !item.auto) return false;
              if (filter === "manual" && item.auto) return false;
              if (q) {
                const titleMatch = (item.title || "").toLowerCase().includes(q);
                const periodMatch = (item.period || "").toLowerCase().includes(q);
                if (!titleMatch && !periodMatch) return false;
              }
              return true;
            });
            if (sortMode === "recent") {
              filtered = [...filtered].sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
            } else if (sortMode === "old") {
              filtered = [...filtered].sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));
            } else if (sortMode === "order") {
              filtered = [...filtered].sort((a, b) => (a.order || 0) - (b.order || 0));
            }
            return (
              <div>
                {/* ★ [신규] 검색 + 필터 + 정렬 바 (보관본 4개 이상일 때만 표시) */}
                {count >= 4 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center", padding: 10, background: "#fafafa", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="🔍 제목·기간 검색"
                      style={{
                        flex: 1, minWidth: 140,
                        padding: "5px 10px",
                        border: "1px solid #e8d0d6", borderRadius: 6,
                        fontSize: 11, fontFamily: "inherit", outline: "none",
                        boxSizing: "border-box"
                      }}
                    />
                    <select value={filter} onChange={e => setFilter(e.target.value)}
                      style={{ padding: "5px 8px", border: "1px solid #e8d0d6", borderRadius: 6, fontSize: 10.5, fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                      <option value="all">전체</option>
                      <option value="interim">중간만</option>
                      <option value="final">종결만</option>
                      <option value="auto">자동만</option>
                      <option value="manual">수동만</option>
                    </select>
                    <select value={sortMode} onChange={e => setSortMode(e.target.value)}
                      style={{ padding: "5px 8px", border: "1px solid #e8d0d6", borderRadius: 6, fontSize: 10.5, fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                      <option value="recent">최신순</option>
                      <option value="old">오래된순</option>
                      <option value="order">차수순</option>
                    </select>
                    {(search || filter !== "all" || sortMode !== "recent") && (
                      <button
                        onClick={() => { setSearch(""); setFilter("all"); setSortMode("recent"); }}
                        title="검색·필터·정렬 초기화"
                        style={{ padding: "5px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 10, fontFamily: "inherit", background: "#fff", cursor: "pointer", color: "#666" }}>
                        ↺ 초기화
                      </button>
                    )}
                    <span style={{ fontSize: 10, color: "#888", marginLeft: "auto" }}>
                      {filtered.length}/{count}개 표시
                    </span>
                  </div>
                )}

                {/* W-36: 차수별 비교 차트 (중간보고서 보관본 2개 이상일 때만) */}
                {/* ★ [종결제외] 종결보관본은 차수 비교에 포함 안 함 */}
                {(list || []).filter(item => !item.isFinal).length >= 2 && (
                  <GrowthHistoryChart list={list} />
                )}
                {filtered.length === 0 ? (
                  <div style={{ padding: "16px 14px", textAlign: "center", color: "#999", fontSize: 11, background: "#fafafa", borderRadius: 8, border: "1px dashed #e0e0e0" }}>
                    검색 결과가 없습니다.
                  </div>
                ) : filtered.map((item, idx) => {
                  const origIdx = (list || []).findIndex(x => x.id === item.id);
                  const isLatest = origIdx === 0;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: item.isFinal ? "#fdf6ed" : "#fdf8f9", border: `1px solid ${item.isFinal ? "#f0e0c0" : "#f0e0e5"}`, borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#333", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{item.title || `${item.period} - ${item.order}차`}</span>
                          {item.isFinal && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "#fef3e0", color: "#a06010", fontWeight: 600 }}>🎓 종결</span>}
                          {item.auto && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "#e6f1fb", color: "#185fa5", fontWeight: 500 }}>자동</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>저장: {fmtSavedAt(item.savedAt)}</div>
                      </div>
                      <button onClick={() => onView(item)} style={{ ...BS, fontSize: 10, padding: "4px 10px" }} title="이 시점의 보고서 보기">👁 보기</button>
                      {confirmDelete === item.id ? (
                        <>
                          <button onClick={async () => { await onDelete(item.id); setConfirmDelete(null); }} style={{ ...BS, fontSize: 10, padding: "4px 10px", background: "#fef2f2", borderColor: "#fca5a5", color: "#991b1b", fontWeight: 600 }}>확인</button>
                          <button onClick={() => setConfirmDelete(null)} style={{ ...BS, fontSize: 10, padding: "4px 10px" }}>취소</button>
                        </>
                      ) : isLatest ? (
                        <>
                          {setCutoffDisabled && (
                            cutoffDisabled ? (
                              <button onClick={() => setCutoffDisabled(false)} style={{ ...BS, fontSize: 10, padding: "4px 10px", color: "#1d4d80", borderColor: "#9bc4e8", background: "#eff5fc", fontWeight: 600 }} title="컷오프를 다시 적용해 그래프를 보관 이후 데이터만 표시">🔒 컷오프 적용</button>
                            ) : (
                              <button onClick={() => setCutoffDisabled(true)} style={{ ...BS, fontSize: 10, padding: "4px 10px", color: "#1d4d80", borderColor: "#9bc4e8", background: "#eff5fc", fontWeight: 600 }} title="보관본은 유지하면서 컷오프만 일시 해제 — 그래프에 모든 데이터 표시">↩ 그래프 복원</button>
                            )
                          )}
                          <button onClick={() => setConfirmDelete(item.id)} style={{ ...BS, fontSize: 10, padding: "4px 10px", color: "#a85020", borderColor: "#fca5a5" }} title="이 보관본을 영구 삭제 (실수로 보관한 경우 되돌리기)">🗑 삭제</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(item.id)} style={{ ...BS, fontSize: 10, padding: "4px 10px", color: "#a85020", borderColor: "#fca5a5" }} title="이 보관본 삭제 (그래프 컷오프 영향 없음)">🗑 삭제</button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ marginTop: 8, padding: "8px 12px", background: "#fafafa", borderRadius: 6, fontSize: 10, color: "#888", lineHeight: 1.6 }}>
            💡 [👁 미리보기]는 인쇄 양식만 확인하며 <b>보관되지 않습니다</b> (데이터에 영향 없음).<br />
            💡 [📄 중간보고서 양식으로 인쇄하기] 버튼을 누르면 <b>자동으로 보관됩니다</b> (같은 기간의 자동 보관본은 24시간 이내에 한 번만 저장).<br />
            💡 [💾 현재 보고서 보관] 버튼은 명시적으로 새 차수로 저장합니다.
          </div>
        </>
      )}
    </div>
  );
}

function GrowthHistoryChart({ list }) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);  // 로딩된 스냅샷들
  const [loading, setLoading] = useState(false);

  const interimList = useMemo(() => (list || []).filter(item => !item.isFinal), [list]);

  useEffect(() => {
    if (!open) return;
    if (snapshots.length === interimList.length) return;  // 이미 로드됨
    let cancelled = false;
    setLoading(true);
    (async () => {
      const items = await Promise.all(
        interimList.map(async (it) => {
          const snap = await loadArchiveItem(it.id);
          return snap ? { ...snap, _indexEntry: it } : null;
        })
      );
      if (!cancelled) {
        const valid = items.filter(Boolean).sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));
        setSnapshots(valid);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, interimList]);

  const allDomains = useMemo(() => {
    const set = new Map();  // shortName → fullName
    snapshots.forEach(s => {
      (s.domainAvgs || []).forEach(d => {
        const key = d.short || d.domain;
        if (!set.has(key)) set.set(key, d.domain || key);
      });
    });
    return [...set.entries()].map(([short, full]) => ({ short, full }));
  }, [snapshots]);

  const matrix = useMemo(() => {
    return allDomains.map(({ short, full }) => {
      const values = snapshots.map(s => {
        const found = (s.domainAvgs || []).find(d => (d.short || d.domain) === short);
        return found ? found.avg : null;
      });
      return { short, full, values };
    });
  }, [allDomains, snapshots]);

  const SESSION_COLORS = ["#FBDBC6", "#E8D7F2", "#F7DDB0", "#D4E8C4", "#C4DCEA", "#EFE7DA", "#F0BCC0"];

  return (
    <div style={{ marginBottom: 10, padding: "10px 12px", background: "linear-gradient(180deg,#fdfaf6,#fff)", border: `1px solid ${PK}`, borderRadius: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: PKD, padding: 0, display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "space-between" }}
      >
        <span>📈 차수별 영역 평균 추이 비교 ({interimList.length}개 차수)</span>
        <span style={{ fontSize: 11, color: "#999" }}>{open ? "▼ 접기" : "▶ 펼치기"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ padding: 20, textAlign: "center", color: "#999", fontSize: 11 }}>불러오는 중...</div>}
          {!loading && snapshots.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#999", fontSize: 11 }}>표시할 데이터가 없습니다.</div>}
          {!loading && snapshots.length >= 1 && allDomains.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#999", fontSize: 11 }}>저장된 영역 평균 데이터가 없어 비교할 수 없습니다.</div>
          )}
          {!loading && snapshots.length >= 2 && allDomains.length > 0 && (
            <>
              {/* 범례 (차수별) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, fontSize: 10 }}>
                {snapshots.map((s, i) => {
                  const c = SESSION_COLORS[i % SESSION_COLORS.length];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 10, background: c, color: "#555" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: "#fff", border: "1px solid #00000020" }} />
                      <b>{s._indexEntry?.title || `${s.period} ${s._indexEntry?.order}차`}</b>
                    </div>
                  );
                })}
              </div>
              {/* 영역별 그룹 막대 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {matrix.map(({ short, values }) => (
                  <div key={short}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 4 }}>{short}</div>
                    <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 64, padding: "4px 0", borderBottom: "1px solid #e8d8de" }}>
                      {values.map((v, i) => {
                        const c = SESSION_COLORS[i % SESSION_COLORS.length];
                        const h = v == null ? 0 : Math.max(2, (v / 100) * 56);
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }} title={`${i + 1}차: ${v == null ? "—" : v + "%"}`}>
                            {v != null && (
                              <div style={{ fontSize: 9, color: "#555", fontWeight: 600, marginBottom: 1 }}>{v}%</div>
                            )}
                            {v == null ? (
                              <div style={{ width: "100%", height: 1, background: "#e0e0e0" }} />
                            ) : (
                              <div style={{ width: "100%", height: h, background: c, borderRadius: "3px 3px 0 0", border: "1px solid rgba(0,0,0,0.05)", borderBottom: "none" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* 추이 요약 */}
                    {(() => {
                      const valid = values.filter(v => v != null);
                      if (valid.length < 2) return null;
                      const first = valid[0], last = valid[valid.length - 1];
                      const diff = last - first;
                      const symbol = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
                      const color = diff > 0 ? "#27500a" : diff < 0 ? "#a85020" : "#888";
                      return (
                        <div style={{ fontSize: 9, color, marginTop: 2, textAlign: "right" }}>
                          {symbol} {first}% → {last}% ({diff > 0 ? "+" : ""}{diff}%p)
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
              {/* 안내 */}
              <div style={{ marginTop: 12, padding: "8px 10px", background: "#fafafa", borderRadius: 6, fontSize: 10, color: "#888", lineHeight: 1.6 }}>
                💡 각 영역의 차수별 평균 정반응률(%) 변화입니다. ▲ 상승 / ▼ 하락 / — 동일.<br />
                💡 일부 차수에 데이터가 없는 영역은 빈 칸으로 표시됩니다.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReportGeneratorSection({
  info, stos, domAvgs,
  reportFields, reportSelStrats, reportSelStratsCustom, reportSelPrein, reportSelSrein, reportReinfSchedule,
  reportBehaviors, reportSections,
  setReportField, setReportPatch, setInfo,
  dailyMemos, archiveList
}) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [memoAlert, setMemoAlert] = useState(null);
  const reportRef = useRef(null);
  const generateTimerRef = useRef(null);
  const scrollTimerRef = useRef(null);

  const fn = info.fn || nameWithSuffix(stripSurname(info.name)) || "아동";

  useEffect(() => {
    return () => {
      if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const handleGenerate = () => {
    setLoading(true);
    if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    generateTimerRef.current = setTimeout(() => {
      const firstB = (reportBehaviors && reportBehaviors[0]) || {};
      const firstBInter = firstB.intervention === "__custom__"
        ? (firstB.interventionCustom || "")
        : (firstB.intervention || "");
      const result = buildLocalReport({
        info,
        stos,
        curFields: reportFields,
        selFuncs: firstB.funcs || [],
        selStrats: reportSelStrats,
        bName: firstB.name || "",
        bInter: firstBInter,
        domAvgs: domAvgs || [],
        reinfSchedule: reportReinfSchedule || "",
        dailyMemos: dailyMemos || {},
        archiveList: archiveList || []
      });
      const meta = result.__meta;
      const sectionsOnly = { ...result };
      delete sectionsOnly.__meta;
      setReportPatch({ reportSections: sectionsOnly });
      if (meta && meta.totalMemoCount > 0) {
        setMemoAlert(meta);
      }
      setLoading(false);
      setExpanded(true);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }, 300);
  };

  const updateSection = (key, value) => {
    setReportPatch({ reportSections: { ...reportSections, [key]: value } });
  };

  const handleDownloadHtml = (mode = "download") => {
    const sections = reportSections;
    if (!sections || Object.keys(sections).length === 0) {
      alert("먼저 [보고서 자동 생성] 버튼을 눌러 섹션을 만들어주세요.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const sectionOrder = [
      "종합 현황",
      "이번 기간의 성장과 변화",
      "가정에서 함께 하기",
      "다음 목표"
    ];

    const childName = info.fn || nameWithSuffix(stripSurname(info.name || "")) || "아동";
    const sectionsHtml = sectionOrder.map(key => {
      const rawContent = sections[key] || "";
      const personalized = personalizeText(rawContent, childName);
      const content = personalized.replace(/\n/g, "<br/>");
      const labelMap = { "이번 기간의 성장과 변화": "치료사 종합 소견" };
      const displayKey = labelMap[key] || key;
      return `
        <section style="margin: 28px 0; page-break-inside: avoid;">
          <h3 style="font-size: 14px; color: #D4728A; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1.5px solid #F5A0B1;">${displayKey}</h3>
          <div style="font-size: 12.5px; line-height: 1.9; color: #333; white-space: pre-wrap;">${content}</div>
        </section>
      `;
    }).join("");

    const statRows = (stos || []).slice(0, 30).map(s => `
      <tr>
        <td style="padding: 5px 8px; border: 1px solid #e8d0d6;">${s.domain || "—"}</td>
        <td style="padding: 5px 8px; border: 1px solid #e8d0d6;">${s.name || "—"}</td>
        <td style="padding: 5px 8px; border: 1px solid #e8d0d6; text-align: center; background: ${s.status === "완료" ? "#eaf3de" : "#e6f1fb"};">${s.status}</td>
        <td style="padding: 5px 8px; border: 1px solid #e8d0d6; text-align: center;">${s.rate || 0}%</td>
        <td style="padding: 5px 8px; border: 1px solid #e8d0d6; text-align: center; font-size: 10px; color: #888;">${s.masteryDate || "—"}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>검단ABA 중간보고서 - ${info.name || "아동"}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: "Malgun Gothic", -apple-system, sans-serif; max-width: 760px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #D4728A; font-size: 22px; border-bottom: 3px solid #F5A0B1; padding-bottom: 10px; }
  .meta { background: #FFF0F3; padding: 12px 16px; border-radius: 8px; margin: 14px 0; font-size: 12px; line-height: 1.8; }
  .meta strong { color: #D4728A; }
  table { border-collapse: collapse; margin: 14px 0; width: 100%; font-size: 11px; }
  th { background: #FFF0F3; color: #D4728A; padding: 6px 8px; border: 1px solid #e8d0d6; text-align: center; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8d0d6; font-size: 10px; color: #888; text-align: center; line-height: 1.7; }
  @media print { body { max-width: none; } }
</style>
</head>
<body>
  <h1>검단ABA언어행동연구소 · 중간보고서</h1>
  <div class="meta">
    <strong>아동:</strong> ${info.name || "—"} &nbsp;&nbsp;
    <strong>생년월일:</strong> ${info.birth || "—"} &nbsp;&nbsp;
    <strong>치료사:</strong> ${info.therapist || "—"}<br/>
    <strong>보고 기간:</strong> ${info.pStart || "—"} ~ ${info.pEnd || "—"} &nbsp;&nbsp;
    <strong>치료 강도:</strong> 주 ${info.sWeek || "—"}회 / ${info.sMin || "—"}분 / 총 ${info.sTotal || "—"}세션<br/>
    <strong>발행일:</strong> ${today} &nbsp;&nbsp;
    <strong>슈퍼바이저:</strong> ${SUPERVISOR_NAME} (${SUPERVISOR_CERT})
  </div>
  ${sectionsHtml}
  <section style="margin: 28px 0;">
    <h3 style="font-size: 14px; color: #D4728A; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1.5px solid #F5A0B1;">데이터 요약 (세부 과제 · 최대 30개)</h3>
    <table>
      <thead>
        <tr><th>영역</th><th>과제</th><th>상태</th><th>최근 정반응률</th><th>달성일</th></tr>
      </thead>
      <tbody>${statRows}</tbody>
    </table>
  </section>
  <div class="footer">${REPORT_FOOTER}</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    if (mode === "print") {
      // 🖨️ 새 창에 보고서를 띄우고 인쇄 대화상자를 자동으로 엽니다.
      const win = window.open(url, "_blank");
      if (!win) {
        alert("팝업이 차단되어 있습니다. 브라우저의 팝업 차단을 해제한 뒤 다시 시도하거나,\n[💾 HTML 다운로드]로 저장 후 인쇄해주세요.");
        URL.revokeObjectURL(url);
        return;
      }
      const timer = setInterval(() => {
        try {
          if (win.document && win.document.readyState === "complete") {
            clearInterval(timer);
            setTimeout(() => { try { win.print(); } catch (e) {} }, 400);
          }
        } catch (e) { clearInterval(timer); }
      }, 200);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = `검단ABA_중간보고서_${info.name || "아동"}_${today}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleArr = (arr, key, item) => {
    const next = arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
    setReportPatch({ [key]: next });
  };

  const sectionKeys = [
    "종합 현황",
    "이번 기간의 성장과 변화",
    "가정에서 함께 하기",
    "다음 목표"
  ];

  const displayLabel = (key) => {
    const map = {
      "이번 기간의 성장과 변화": "치료사 종합 소견"
    };
    return map[key] || key;
  };

  const hasReport = reportSections && Object.keys(reportSections).length > 0;

  return (
    <div style={{ ...CS, background: "linear-gradient(180deg, #ffffff 0%, #fefbfc 100%)", border: "2px solid #f5c5d0", marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ width: 4, height: 22, background: PKD, borderRadius: 2 }} />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: PKD }}>📝 중간보고서 자동 생성</h2>
        <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>데이터 시트 · IEP 정보와 실시간 미러링</span>
      </div>
      <div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.7, marginBottom: 14, padding: "9px 13px", background: PKL, borderRadius: 8 }}>
        💡 아래 정보를 입력하거나 비워두세요. <b>[보고서 자동 생성]</b>을 누르면 [③ 데일리 데이터]의 task 기록과 성장 추이를 분석해 총 8개 섹션의 보고서 본문이 자동으로 작성됩니다. 생성 후 각 섹션을 수정·편집할 수 있습니다.
      </div>

      {/* ═ 치료 강도 · 보고 기간 ═ */}
      <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #f0e0e5" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 8 }}>📅 보고 기간 · 치료 강도</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ ...LS, fontSize: 10 }}>보고 시작일 <span style={{ fontSize: 8.5, color: "#767676", fontWeight: 400 }}>(첫 데이터 입력일 자동, 수정 가능)</span></label>
            {/* ★ pStart 우선순위: 사용자 입력 > 첫 데이터 입력일(stos에서 추출) > IEP 평가 시작일 fallback */}
            {(() => {
              const firstDataDate = (() => {
                if (!stos || stos.length === 0) return null;
                const dates = [];
                stos.forEach(s => (s.points || []).forEach(p => { if (p.date) dates.push(p.date); }));
                return dates.length > 0 ? dates.sort()[0] : null;
              })();
              return (
                <>
                  <input type="date" style={{ ...IS, padding: "5px 8px", fontSize: 11.5 }}
                    value={info.pStart || firstDataDate || info.evalStart || ""}
                    onChange={e => setInfo(prev => ({ ...prev, pStart: e.target.value }))}
                    title="보고 시작일은 IEP 평가 시작일과 별도입니다. 비워두면 첫 데이터 입력일로 자동 설정되며, 보관 후에는 다음 차수 시작일(보관일+1)로 자동 갱신됩니다." />
                  {!info.pStart && firstDataDate && (
                    <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                      💡 첫 데이터 입력일 자동 적용 ({firstDataDate})
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div>
            <label style={{ ...LS, fontSize: 10 }}>보고 종료일</label>
            <input type="date" style={{ ...IS, padding: "5px 8px", fontSize: 11.5 }}
              value={info.pEnd || ""} onChange={e => setInfo(prev => ({ ...prev, pEnd: e.target.value }))} />
          </div>
          <div>
            <label style={{ ...LS, fontSize: 10 }}>주 N회</label>
            {/* W-12: 드롭다운(1/2/3/4/직접입력) — 직접입력 선택 시 숫자 입력란으로 전환 */}
            {(() => {
              const v = info.sWeek || "";
              const isPreset = v === "1" || v === "2" || v === "3" || v === "4";
              const isCustom = v !== "" && !isPreset;
              const selectValue = isPreset ? v : (isCustom ? "custom" : "");
              return (
                <div style={{ display: "flex", gap: 4 }}>
                  <select
                    style={{ ...IS, padding: "5px 6px", fontSize: 11.5, flex: isCustom ? "0 0 64px" : 1 }}
                    value={selectValue}
                    onChange={e => {
                      const next = e.target.value;
                      if (next === "custom") {
                        setInfo(prev => ({ ...prev, sWeek: "" }));
                      } else {
                        setInfo(prev => ({ ...prev, sWeek: next }));
                      }
                    }}>
                    <option value="">선택</option>
                    <option value="1">1회</option>
                    <option value="2">2회</option>
                    <option value="3">3회</option>
                    <option value="4">4회</option>
                    <option value="custom">직접입력</option>
                  </select>
                  {(isCustom || selectValue === "custom") && (
                    <input type="text" placeholder="예: 5" autoFocus={selectValue === "custom" && !isCustom}
                      style={{ ...IS, padding: "5px 8px", fontSize: 11.5, flex: 1 }}
                      value={v}
                      onChange={e => setInfo(prev => ({ ...prev, sWeek: e.target.value }))} />
                  )}
                </div>
              );
            })()}
          </div>
          <div>
            <label style={{ ...LS, fontSize: 10 }}>회당 N분</label>
            {/* W-13: 드롭다운(50분/100분/직접입력) — 직접입력 선택 시 숫자 입력란으로 전환 */}
            {(() => {
              const v = info.sMin || "";
              const isPreset = v === "50" || v === "100";
              const isCustom = v !== "" && !isPreset;
              const selectValue = isPreset ? v : (isCustom ? "custom" : "");
              return (
                <div style={{ display: "flex", gap: 4 }}>
                  <select
                    style={{ ...IS, padding: "5px 6px", fontSize: 11.5, flex: isCustom ? "0 0 64px" : 1 }}
                    value={selectValue}
                    onChange={e => {
                      const next = e.target.value;
                      if (next === "custom") {
                        setInfo(prev => ({ ...prev, sMin: "" }));
                      } else {
                        setInfo(prev => ({ ...prev, sMin: next }));
                      }
                    }}>
                    <option value="">선택</option>
                    <option value="50">50분</option>
                    <option value="100">100분</option>
                    <option value="custom">직접입력</option>
                  </select>
                  {(isCustom || selectValue === "custom") && (
                    <input type="text" placeholder="예: 40" autoFocus={selectValue === "custom" && !isCustom}
                      style={{ ...IS, padding: "5px 8px", fontSize: 11.5, flex: 1 }}
                      value={v}
                      onChange={e => setInfo(prev => ({ ...prev, sMin: e.target.value }))} />
                  )}
                </div>
              );
            })()}
          </div>
          <div>
            <label style={{ ...LS, fontSize: 10 }}>총 세션수 <span style={{ fontSize: 8.5, color: "#767676", fontWeight: 400 }}>(자동 계산)</span></label>
            {/* W-14: 보고 시작일/종료일/주N회로부터 자동 계산. 사용자가 직접 입력하면 그 값 유지 */}
            {(() => {
              const computeAuto = () => {
                const start = info.evalStart;
                const end = info.pEnd;
                const week = parseInt(info.sWeek, 10);
                if (!start || !end || isNaN(week) || week <= 0) return null;
                const ds = new Date(start), de = new Date(end);
                if (isNaN(ds.getTime()) || isNaN(de.getTime())) return null;
                const diffDays = Math.floor((de - ds) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return null;
                const weeks = diffDays / 7;
                return Math.round(weeks * week);
              };
              const autoVal = computeAuto();
              const userVal = info.sTotal || "";
              const isAuto = userVal === "" && autoVal !== null;
              return (
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder={autoVal !== null ? `자동: ${autoVal}` : "예: 24"}
                    style={{
                      ...IS, padding: "5px 8px", fontSize: 11.5,
                      ...(isAuto ? { color: "#a87108", background: "#fffaf0" } : {})
                    }}
                    value={isAuto ? String(autoVal) : userVal}
                    onChange={e => setInfo(prev => ({ ...prev, sTotal: e.target.value }))}
                    title={isAuto ? "자동 계산값 (보고 시작/종료일과 주 N회로부터 산출). 직접 수정하면 그 값이 유지됩니다." : ""}
                  />
                  {!isAuto && userVal !== "" && autoVal !== null && Number(userVal) !== autoVal && (
                    <button
                      onClick={() => setInfo(prev => ({ ...prev, sTotal: "" }))}
                      title={`자동값(${autoVal})으로 되돌리기`}
                      style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#a87108", fontSize: 10, cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}>
                      ↺
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ═ [v19] 영역별 현황 5개 textarea 제거 — 4섹션 칩+✨ 자동생성으로 대체 */}

      {/* ═ 문제행동 · 중재전략 · 강화제 ═ */}
      <div className="responsive-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {/* W-20: 다중 문제행동 — 각 행동마다 별도 카드, [+ 추가] / [× 삭제] 가능 */}
        <div style={{ padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #f0e0e5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: PKD }}>⚠️ 주요 문제행동</div>
            <button
              onClick={() => {
                const next = [...reportBehaviors, { name: "", severity: "", funcs: [], funcOther: "", intervention: "", interventionCustom: "" }];
                setReportPatch({ reportBehaviors: next });
              }}
              style={{ fontSize: 10, padding: "3px 8px", background: PKL, color: PKD, border: `1px solid ${PK}`, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              + 추가
            </button>
          </div>

          {reportBehaviors.length === 0 && (
            <div style={{ fontSize: 11, color: "#888", padding: "12px 8px", textAlign: "center", border: "1px dashed #ddd", borderRadius: 6 }}>
              [+ 추가]를 눌러 문제행동을 등록하세요
            </div>
          )}

          {reportBehaviors.map((b, idx) => {
            const updateB = (patch) => {
              const next = reportBehaviors.map((x, i) => i === idx ? { ...x, ...patch } : x);
              setReportPatch({ reportBehaviors: next });
            };
            const removeB = () => {
              const next = reportBehaviors.filter((_, i) => i !== idx);
              setReportPatch({ reportBehaviors: next });
            };
            const toggleFunc = (k) => {
              const fs = b.funcs || [];
              const nextFs = fs.includes(k) ? fs.filter(x => x !== k) : [...fs, k];
              updateB({ funcs: nextFs });
            };
            const isInterCustom = b.intervention === "__custom__";
            const interSelectValue = INTERVENTION_PRESETS.includes(b.intervention) ? b.intervention : (isInterCustom ? "__custom__" : "");

            return (
              <div key={idx} style={{ padding: 10, background: "#fdf8f9", borderRadius: 8, border: "1px solid #f0e0e5", marginBottom: 8 }}>
                {/* 카드 헤더 — 번호 + 삭제 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: PKD }}>행동 {idx + 1}</div>
                  <button
                    onClick={removeB}
                    title="이 행동 삭제"
                    style={{ fontSize: 10, padding: "2px 6px", background: "transparent", color: "#999", border: "1px solid #ddd", borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                    × 삭제
                  </button>
                </div>

                {/* 행동명 */}
                <input type="text" placeholder="예: 자리 이탈, 또래 방해 등"
                  style={{ ...IS, padding: "5px 8px", fontSize: 11.5, marginBottom: 6 }}
                  value={b.name} onChange={e => updateB({ name: e.target.value })} />

                {/* 행동 기능 (다중 토글) */}
                <div style={{ fontSize: 10, color: "#767676", marginBottom: 4 }}>행동 기능 (FBA)</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                  {REPORT_FUNCS.map(f => {
                    const on = (b.funcs || []).includes(f.k);
                    return (
                      <button key={f.k}
                        onClick={() => toggleFunc(f.k)}
                        style={{
                          padding: "3px 9px", fontSize: 10, fontFamily: "inherit",
                          border: `1px solid ${on ? "#555" : f.c}`,
                          background: on ? f.c : "#fff",
                          color: on ? "#333" : "#888",
                          borderRadius: 10, cursor: "pointer", fontWeight: on ? 700 : 500
                        }}>
                        {f.l}
                      </button>
                    );
                  })}
                </div>
                {(b.funcs || []).includes("other") && (
                  <input type="text" placeholder="기타 행동 기능 직접 입력"
                    style={{ ...IS, padding: "5px 8px", fontSize: 11, marginBottom: 6 }}
                    value={b.funcOther || ""}
                    onChange={e => updateB({ funcOther: e.target.value })} />
                )}

                {/* 빈도/강도 (드롭다운) */}
                <div style={{ fontSize: 10, color: "#767676", marginBottom: 4, marginTop: 4 }}>빈도 / 강도</div>
                <select
                  value={b.severity || ""}
                  onChange={e => updateB({ severity: e.target.value })}
                  style={{ ...IS, padding: "5px 8px", fontSize: 11.5, marginBottom: 6 }}>
                  <option value="">선택</option>
                  <option value="낮음">낮음</option>
                  <option value="중간">중간</option>
                  <option value="높음">높음</option>
                </select>

                {/* 사용 중인 중재 기법 (드롭다운 + 직접입력) */}
                <div style={{ fontSize: 10, color: "#767676", marginBottom: 4 }}>사용 중인 중재 기법</div>
                <select
                  value={interSelectValue}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "") {
                      updateB({ intervention: "", interventionCustom: "" });
                    } else if (v === "__custom__") {
                      updateB({ intervention: "__custom__" });
                    } else {
                      updateB({ intervention: v, interventionCustom: "" });
                    }
                  }}
                  style={{ ...IS, padding: "5px 8px", fontSize: 11.5, marginBottom: isInterCustom ? 6 : 0 }}>
                  <option value="">선택</option>
                  {INTERVENTION_PRESETS.map(iv => (
                    <option key={iv} value={iv}>{iv}</option>
                  ))}
                  <option value="__custom__">직접입력</option>
                </select>
                {isInterCustom && (
                  <input type="text" autoFocus placeholder="기법 직접 입력 (예: 토큰경제, 시각스케줄 등)"
                    style={{ ...IS, padding: "5px 8px", fontSize: 11 }}
                    value={b.interventionCustom || ""}
                    onChange={e => updateB({ interventionCustom: e.target.value })} />
                )}
              </div>
            );
          })}
        </div>

        {/* 중재 전략 */}
        <div style={{ padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #f0e0e5" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 8 }}>🎯 사용 중인 중재 전략</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 130, overflowY: "auto", marginBottom: 8 }}>
            {REPORT_STRATS.map(s => {
              const on = reportSelStrats.includes(s);
              return (
                <button key={s}
                  onClick={() => toggleArr(reportSelStrats, "reportSelStrats", s)}
                  style={{
                    padding: "3px 8px", fontSize: 10, fontFamily: "inherit",
                    border: `1px solid ${on ? PK : "#ddd"}`,
                    background: on ? PKL : "#fff",
                    color: on ? PKD : "#777",
                    borderRadius: 8, cursor: "pointer", fontWeight: on ? 700 : 500
                  }}>
                  {s}
                </button>
              );
            })}
          </div>
          {/* W-18: 직접입력란 — 위 16개에 없는 다른 전략은 콤마로 구분해서 자유 입력 */}
          <div style={{ fontSize: 10, color: "#767676", marginBottom: 4 }}>다른 전략 직접 입력 (콤마로 구분)</div>
          <input type="text" placeholder="예: PRT, EIBI, JASPER"
            style={{ ...IS, padding: "5px 8px", fontSize: 11 }}
            value={reportSelStratsCustom}
            onChange={e => setReportPatch({ reportSelStratsCustom: e.target.value })} />
        </div>
      </div>

      {/* ═ 강화제 ═ */}
      <div className="responsive-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: "1px solid #f0e0e5" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: PKD, marginBottom: 6 }}>1차 강화제</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {REPORT_PREIN.map(p => {
              const on = reportSelPrein.includes(p);
              return (
                <button key={p} onClick={() => toggleArr(reportSelPrein, "reportSelPrein", p)}
                  style={{ padding: "2px 7px", fontSize: 10, fontFamily: "inherit", border: `1px solid ${on ? PK : "#ddd"}`, background: on ? PKL : "#fff", color: on ? PKD : "#888", borderRadius: 8, cursor: "pointer", fontWeight: on ? 700 : 500 }}>{p}</button>
              );
            })}
          </div>
        </div>
        <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: "1px solid #f0e0e5" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: PKD, marginBottom: 6 }}>2차 강화제</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {REPORT_SREIN.map(p => {
              const on = reportSelSrein.includes(p);
              return (
                <button key={p} onClick={() => toggleArr(reportSelSrein, "reportSelSrein", p)}
                  style={{ padding: "2px 7px", fontSize: 10, fontFamily: "inherit", border: `1px solid ${on ? PK : "#ddd"}`, background: on ? PKL : "#fff", color: on ? PKD : "#888", borderRadius: 8, cursor: "pointer", fontWeight: on ? 700 : 500 }}>{p}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* W-19: 강화 스케줄 */}
      <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: "1px solid #f0e0e5", marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: PKD, marginBottom: 6 }}>강화 스케줄</div>
        <textarea
          placeholder="예: FR1 → VR3 thin"
          rows={2}
          style={{ ...IS, padding: "6px 10px", fontSize: 11.5, fontFamily: "inherit", resize: "vertical" }}
          value={reportReinfSchedule}
          onChange={e => setReportPatch({ reportReinfSchedule: e.target.value })} />
      </div>

      {/* ═ 미러링 상태 요약 ═ */}
      <div style={{ padding: "8px 12px", background: "#f8f6fc", borderRadius: 8, border: "1px dashed #d4c5e8", marginBottom: 14, fontSize: 11, color: "#555", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span>🔗 <b>미러링 상태:</b></span>
        <span>세부 과제 총 <b style={{ color: PKD }}>{stos.length}개</b></span>
        <span>· 진행 중 <b style={{ color: BLUE }}>{stos.filter(s => s.status === "진행중").length}</b></span>
        <span>· 습득 완료 <b style={{ color: GREEN }}>{stos.filter(s => s.status === "완료").length}</b></span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#888" }}>데이터 변경 시 자동 반영됩니다</span>
      </div>

      {/* ═ 보고서 생성 버튼 ═ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button style={{ ...BP, flex: 1, padding: "10px 18px", fontSize: 13, fontWeight: 700, minWidth: 200 }}
          onClick={handleGenerate} disabled={loading}>
          {loading ? "⏳ 생성 중..." : (hasReport ? "🔄 보고서 다시 생성" : "📝 보고서 자동 생성")}
        </button>
        {hasReport && (
          <button style={{ ...BP, padding: "10px 18px", fontSize: 12, fontWeight: 700, background: "#5a8c1f" }}
            onClick={() => handleDownloadHtml("print")}>
            🖨️ 바로 인쇄
          </button>
        )}
        {hasReport && (
          <button style={{ ...BS, padding: "10px 18px", fontSize: 12, fontWeight: 600 }}
            onClick={() => handleDownloadHtml("download")}>
            💾 HTML 다운로드
          </button>
        )}
        {hasReport && (
          <button style={{ ...BS, padding: "10px 14px", fontSize: 12 }}
            onClick={() => setExpanded(e => !e)}>
            {expanded ? "접기 ▴" : "펼치기 ▾"}
          </button>
        )}
      </div>

      {/* ★ 메모 활용 알림 — 보고서 자동 생성 후 일시 표시 */}
      {memoAlert && (
        <div style={{
          background: "#e8f4ff",
          border: "1.5px solid #2a6cb2",
          borderLeft: "4px solid #2a6cb2",
          borderRadius: 6,
          padding: "10px 14px",
          marginBottom: 14,
          display: "flex",
          alignItems: "flex-start",
          gap: 10
        }}>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>💡</span>
          <div style={{ flex: 1, fontSize: 11.5, color: "#1d4d80", lineHeight: 1.65 }}>
            <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 12 }}>회기 관찰 메모 분석 결과</div>
            {memoAlert.totalMemoCount > 0 && memoAlert.citedMemoCount > 0 && (
              <>이번 보고 기간에 작성된 회기 메모 <b>{memoAlert.totalMemoCount}개</b>가 분석되었습니다. 그 중 <b>{memoAlert.citedMemoCount}개</b>가 데이터 변동 시점과 연관되어 본문에 인용되었으며{memoAlert.referencedMemoCount > 0 ? <>, 나머지 <b>{memoAlert.referencedMemoCount}개</b>는 인용 조건(25%p 이상 하락)에 해당하지 않아 본문에는 포함되지 않았습니다.</> : "."}</>
            )}
            {memoAlert.totalMemoCount > 0 && memoAlert.citedMemoCount === 0 && (
              <>이번 보고 기간에 작성된 회기 메모 <b>{memoAlert.totalMemoCount}개</b>가 분석되었으나, 데이터 변동 시점(25%p 이상 하락)과 연관된 메모가 없어 본문에 인용되지는 않았습니다. 메모는 분석에 참조되었습니다.</>
            )}
          </div>
          <button onClick={() => setMemoAlert(null)} style={{
            background: "transparent",
            border: "none",
            color: "#1d4d80",
            cursor: "pointer",
            fontSize: 14,
            padding: "0 4px",
            fontFamily: "inherit",
            opacity: 0.6,
            lineHeight: 1
          }} title="알림 닫기">✕</button>
        </div>
      )}

      {/* ═ 생성된 보고서 섹션 (편집 가능) ═ */}
      {hasReport && expanded && (
        <div ref={reportRef} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${PK}`, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: PKD, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${PKL}` }}>
            📄 생성된 보고서 본문 (각 섹션을 수정할 수 있습니다)
          </div>
          {sectionKeys.map(key => {
            const useChips = (key === "종합 현황" || key === "이번 기간의 성장과 변화" || key === "가정에서 함께 하기" || key === "다음 목표");

            if (useChips) {
              let CHIPS_DATA = [];
              let buildFunc = null;
              let placeholderText = "";

              if (key === "종합 현황") {
                CHIPS_DATA = [
                  ["표현 언어 향상", "lang"],
                  ["수용 언어 안정", "lang"],
                  ["발성 다양화", "lang"],
                  ["비구어 → 구어 전환", "lang"],
                  ["또래 관심 증가", "social"],
                  ["공동주의 형성", "social"],
                  ["차례 지키기 습득", "social"],
                  ["눈맞춤 안정", "social"],
                  ["도전 행동 감소", "behav"],
                  ["정서 안정", "behav"],
                  ["전환 적응 향상", "behav"],
                  ["지시 따르기 안정", "learn"],
                  ["학습 참여 시간 증가", "learn"],
                  ["선호 활동 다양화", "learn"],
                  ["촉구 단계 감소", "learn"]
                ];
                buildFunc = buildInterimSummary;
                placeholderText = "키워드 선택 후 [✨ 자동 생성]을 누르면 자연스러운 단락이 들어갑니다.";
              } else if (key === "이번 기간의 성장과 변화") {
                CHIPS_DATA = [
                  ["초기 대비 큰 폭 향상", "achievement"],
                  ["마일스톤 달성", "achievement"],
                  ["꾸준한 점진적 성장", "achievement"],
                  ["강점 영역 확장", "strength"],
                  ["새로운 관심사 등장", "strength"],
                  ["자발적 시도 증가", "strength"],
                  ["도전 영역 진전", "challenge"],
                  ["변화·전환 적응 향상", "challenge"],
                  ["정서·행동 자기조절 향상", "challenge"],
                  ["가정·기관 연계 강화", "context"],
                  ["또래 관계 발전", "context"]
                ];
                buildFunc = buildInterimGrowth;
                placeholderText = "변화 양상을 선택하고 [✨ 자동 생성]을 누르세요.";
              } else if (key === "가정에서 함께 하기") {
                CHIPS_DATA = [
                  ["센터 학습 기술 가정 적용", "reinforce"],
                  ["긍정적 강화 일관성", "reinforce"],
                  ["일상 루틴 안에서 연습", "routine"],
                  ["사진·시각 단서 활용", "routine"],
                  ["주간 진행 상황 공유", "communication"],
                  ["행동 일지 기록", "communication"],
                  ["구조화된 환경 제공", "environment"],
                  ["또래 만남 기회 마련", "environment"],
                  ["도전 행동 시 차분한 대응", "challenge"],
                  ["전환 시 사전 예고", "challenge"]
                ];
                buildFunc = buildInterimHomeCoop;
                placeholderText = "가정에서 함께 진행할 협력 방안 키워드를 선택하세요.";
              } else if (key === "다음 목표") {
                CHIPS_DATA = [
                  ["표현 언어 확장", "lang"],
                  ["수용 언어 정교화", "lang"],
                  ["사회적 상호작용 확장", "social"],
                  ["공동 활동 참여 향상", "social"],
                  ["다양한 환경 일반화", "general"],
                  ["다른 사람과의 일반화", "general"],
                  ["자발적 시도 강화", "autonomy"],
                  ["선택·결정 기회 확대", "autonomy"],
                  ["도전 행동 안정화", "challenge"],
                  ["전환·변화 적응 강화", "challenge"],
                  ["학습 준비 기술 강화", "school"],
                  ["또래 환경 적응", "school"]
                ];
                buildFunc = buildInterimNextGoal;
                placeholderText = "다음 회기 목표 방향을 선택하세요.";
              }

              const MARKER_RE = /\n*<!--SELECTED:([^>]*)-->\s*$/;
              const currentValue = reportSections[key] || "";
              const markerMatch = currentValue.match(MARKER_RE);
              const selected = markerMatch ? markerMatch[1].split("|").filter(Boolean) : [];
              const visibleText = currentValue.replace(MARKER_RE, "").trim();
              const selectedSet = new Set(selected);

              const toggle = (label) => {
                const newSel = new Set(selectedSet);
                if (newSel.has(label)) newSel.delete(label);
                else newSel.add(label);
                const arr = Array.from(newSel);
                const marker = arr.length > 0 ? `\n\n<!--SELECTED:${arr.join("|")}-->` : "";
                updateSection(key, visibleText + marker);
              };

              const generate = () => {
                const arr = Array.from(selectedSet);
                if (arr.length === 0) return;
                const para = buildFunc(arr, info);
                const marker = `\n\n<!--SELECTED:${arr.join("|")}-->`;
                updateSection(key, para + marker);
              };

              const clear = () => {
                updateSection(key, "");
              };

              return (
                <div key={key} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 6 }}>
                    {displayLabel(key)} <span style={{ fontSize: 10, fontWeight: 400, color: "#888" }}>(키워드 선택 후 [✨ 자동 생성])</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {CHIPS_DATA.map(([label], i) => {
                      const isSel = selectedSet.has(label);
                      return (
                        <button key={i}
                          onClick={() => toggle(label)}
                          style={{
                            padding: "3px 9px", fontSize: 10,
                            border: isSel ? `1px solid ${PKD}` : `1px solid ${PK}`,
                            borderRadius: 12,
                            background: isSel ? PKD : PKL,
                            color: isSel ? "#fff" : PKD,
                            cursor: "pointer", fontFamily: "inherit", fontWeight: 500
                          }}>
                          {isSel ? "✓" : "+"} {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <button
                      onClick={generate}
                      disabled={selectedSet.size === 0}
                      style={{
                        padding: "6px 14px", fontSize: 11,
                        border: `1px solid ${PKD}`,
                        borderRadius: 6,
                        background: selectedSet.size === 0 ? "#f0f0f0" : PKD,
                        color: selectedSet.size === 0 ? "#aaa" : "#fff",
                        cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                        fontFamily: "inherit", fontWeight: 600
                      }}>
                      ✨ 자동 생성
                    </button>
                    <button
                      onClick={clear}
                      style={{
                        padding: "6px 12px", fontSize: 10.5,
                        border: "1px solid #ccc", borderRadius: 6,
                        background: "#fff", color: "#666",
                        cursor: "pointer", fontFamily: "inherit"
                      }}>
                      🗑 초기화
                    </button>
                    <span style={{ fontSize: 9.5, color: "#888", marginLeft: 4 }}>
                      {selectedSet.size > 0 ? `선택: ${selectedSet.size}개` : "키워드를 먼저 선택하세요"}
                    </span>
                  </div>
                  <textarea
                    value={visibleText}
                    onChange={e => {
                      const marker = selected.length > 0 ? `\n\n<!--SELECTED:${selected.join("|")}-->` : "";
                      updateSection(key, e.target.value + marker);
                    }}
                    rows={Math.min(10, (visibleText || "").split("\n").length + 2)}
                    placeholder={placeholderText}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e8d0d6", borderRadius: 8,
                      fontSize: 12, lineHeight: 1.8, color: "#333",
                      fontFamily: "inherit", outline: "none", resize: "vertical",
                      boxSizing: "border-box", background: "#fafbfc"
                    }}
                  />
                </div>
              );
            }

            return (
              <div key={key} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: PKD, marginBottom: 6 }}>{displayLabel(key)}</div>
                <textarea
                  value={reportSections[key] || ""}
                  onChange={e => updateSection(key, e.target.value)}
                  rows={Math.min(10, (reportSections[key] || "").split("\n").length + 2)}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e8d0d6", borderRadius: 8,
                    fontSize: 12, lineHeight: 1.8, color: "#333",
                    fontFamily: "inherit", outline: "none", resize: "vertical",
                    boxSizing: "border-box", background: "#fafbfc"
                  }}
                />
              </div>
            );
          })}
          <div style={{ marginTop: 14, padding: "10px 14px", background: PKL, borderRadius: 8, fontSize: 10.5, color: PKD, lineHeight: 1.6 }}>
            ✨ 모든 편집은 <b>아동 프로필에 자동 저장</b>됩니다. 브라우저를 닫았다 열어도 편집 내용이 유지됩니다.
          </div>
        </div>
      )}
    </div>
  );
}

function TaskProgressTable({ goals, calcDayRate, listGroup, title, color, archiveList }) {
  const rows = useMemo(() => {
    let cutoffDate = null;
    const cutoffArchives = (archiveList || []).filter(item => !item.isFinal);
    if (cutoffArchives.length > 0 && cutoffArchives[0].savedAt) {
      cutoffDate = cutoffArchives[0].savedAt.slice(0, 10);
    }
    const result = [];
    goals.forEach(g => {
      (g.tasks || []).forEach(t => {
        if ((t.listGroup || "1") !== listGroup) return;
        if (listGroup === "2" && cutoffDate && t.masteredAt && t.masteredAt <= cutoffDate) return;
        const dates = Object.keys(t.daily || {}).sort()
          .filter(d => !cutoffDate || d >= cutoffDate);
        const rates = dates.map(d => ({ date: d, rate: calcDayRate(t.daily[d], t.plannedTrials) })).filter(x => x.rate !== null);
        const firstRate = rates.length > 0 ? rates[0].rate : null;
        const latestRate = rates.length > 0 ? rates[rates.length - 1].rate : null;
        const change = (firstRate !== null && latestRate !== null) ? latestRate - firstRate : null;
        result.push({ goal: g, task: t, firstRate, latestRate, change, sessions: rates.length });
      });
    });
    return result;
  }, [goals, listGroup, calcDayRate, archiveList]);

  const isMastered = listGroup === "2";

  if (rows.length === 0) {
    return (
      <div style={CS}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color }}>{title} <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>(0개)</span></h3>
        </div>
        <div style={{ textAlign: "center", padding: "26px 20px", fontSize: 11.5, color: "#bbb", border: "1px dashed #eee", borderRadius: 8 }}>
          {isMastered
            ? "아직 습득 완료된 과제가 없습니다. 연속 2일 80% 이상 달성 시 자동으로 이동되며, [③ 데일리] 탭의 수동 L2 버튼으로도 전환할 수 있습니다."
            : "진행 중 과제가 없습니다. [③ 데일리 데이터] 탭에서 각 영역목표에 세부 과제를 추가하세요."}
        </div>
      </div>
    );
  }

  const grouped = {};
  rows.forEach(r => {
    const key = r.goal.id;
    if (!grouped[key]) grouped[key] = { goal: r.goal, items: [] };
    grouped[key].items.push(r);
  });

  return (
    <div style={CS}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color }}>
          {title} <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>({rows.length}개)</span>
        </h3>
      </div>
      {isMastered && (
        <div style={{ padding: "8px 12px", background: "#f4f9ed", borderRadius: 8, border: "1px solid #d4e5ba", marginBottom: 10, fontSize: 11, color: "#4a7316", lineHeight: 1.6 }}>
          💡 아래 과제들은 연속 2일 80% 이상 달성하여 자동으로 습득 완료 처리되었거나 선생님이 수동 전환한 과제입니다. 데이터 시트의 진행 중 섹션에서 자동 제외되었습니다.
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr>
              {["영역목표 / 커리큘럼", "세부 과제", "첫 측정", "최근", "변화", "세션", isMastered ? "달성일" : ""].filter(Boolean).map(h => (
                <th key={h} style={{ padding: "8px 10px", background: isMastered ? "#eef6e5" : PKL, border: `1px solid ${isMastered ? "#d4e5ba" : "#e8d0d6"}`, color: isMastered ? "#4a7316" : PKD, fontWeight: 600, fontSize: 10.5, textAlign: "center" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.values(grouped).map(({ goal, items }) => (
              items.map((r, idx) => {
                const changeColor = r.change === null ? "#ccc" : r.change > 0 ? GREEN : r.change < 0 ? RED : "#999";
                return (
                  <tr key={r.task.id}>
                    {/* 영역목표 (그룹의 첫 줄에만 표시 · rowspan) */}
                    {idx === 0 && (
                      <td rowSpan={items.length} style={{ padding: "8px 10px", border: `1px solid ${isMastered ? "#d4e5ba" : "#f0e0e5"}`, background: isMastered ? "#f9fcf5" : "#fdf8f9", width: "28%", verticalAlign: "top" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: isMastered ? "#4a7316" : PKD, lineHeight: 1.4 }}>{goal.item}</div>
                        <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{shortDomain(goal.domain)}{goal.subDomain ? ` · ${goal.subDomain}` : ""}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                          {goal.vbmapp && <span style={{ fontSize: 8.5, padding: "1px 5px", background: "#e6f1fb", color: "#2a6cb2", borderRadius: 5, fontWeight: 600 }}>VB: {goal.vbmapp.v} L{goal.vbmapp.lv}</span>}
                          {goal.esdm && <span style={{ fontSize: 8.5, padding: "1px 5px", background: "#eaf3de", color: "#4a7316", borderRadius: 5, fontWeight: 600 }}>ESDM: {goal.esdm.v}</span>}
                          {goal.listName && <span style={{ fontSize: 8.5, padding: "1px 5px", background: "#fff5d6", color: "#a87108", borderRadius: 5, fontWeight: 600 }}>{goal.listName}</span>}
                        </div>
                      </td>
                    )}
                    <td style={{ padding: "7px 10px", border: `1px solid ${isMastered ? "#d4e5ba" : "#f0e0e5"}`, fontSize: 11.5, fontWeight: 500, textDecoration: isMastered ? "line-through" : "none", textDecorationColor: GREEN, textDecorationThickness: 1 }}>{r.task.name}</td>
                    <td style={{ padding: "7px 10px", border: `1px solid ${isMastered ? "#d4e5ba" : "#f0e0e5"}`, textAlign: "center", color: "#888", fontSize: 11 }}>{r.firstRate === null ? "—" : `${r.firstRate}%`}</td>
                    <td style={{ padding: "7px 10px", border: `1px solid ${isMastered ? "#d4e5ba" : "#f0e0e5"}`, textAlign: "center", fontWeight: 700, fontSize: 12.5, color: r.latestRate === null ? "#ccc" : r.latestRate >= 80 ? GREEN : r.latestRate >= 50 ? BLUE : ORANGE }}>
                      {r.latestRate === null ? "—" : `${r.latestRate}%`}
                    </td>
                    <td style={{ padding: "7px 10px", border: `1px solid ${isMastered ? "#d4e5ba" : "#f0e0e5"}`, textAlign: "center", fontWeight: 600, color: changeColor, fontSize: 11 }}>
                      {r.change === null ? "—" : r.change > 0 ? `↑ +${r.change}%` : r.change < 0 ? `↓ ${r.change}%` : "→ 0%"}
                    </td>
                    <td style={{ padding: "7px 10px", border: `1px solid ${isMastered ? "#d4e5ba" : "#f0e0e5"}`, textAlign: "center", color: "#888", fontSize: 10.5 }}>{r.sessions}회</td>
                    {isMastered && (
                      <td style={{ padding: "7px 10px", border: "1px solid #d4e5ba", textAlign: "center", color: "#7c9947", fontSize: 10.5, fontWeight: 600 }}>
                        {r.task.masteredAt || "—"}
                      </td>
                    )}
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MasteredTable({ goals }) {
  if (goals.length === 0) {
    return (
      <div style={CS}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 4, height: 18, background: GREEN, borderRadius: 2 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: GREEN }}>✅ 습득 완료 프로그램 <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>(0개)</span></h3>
        </div>
        <div style={{ textAlign: "center", padding: "26px 20px", fontSize: 11.5, color: "#bbb", border: "1px dashed #d4e5ba", borderRadius: 8, background: "#fafcf5" }}>
          아직 습득 완료된 목표가 없습니다.<br/>
          <span style={{ fontSize: 10.5, color: "#aaa" }}>연속 2일 80% 이상 달성 시 자동으로 이동되며, [③ 데일리] 탭의 수동 스위치로도 전환할 수 있습니다.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={CS}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 4, height: 18, background: GREEN, borderRadius: 2 }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: GREEN }}>
          ✅ 습득 완료 프로그램 <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>({goals.length}개)</span>
        </h3>
      </div>
      <div style={{ padding: "8px 12px", background: "#f4f9ed", borderRadius: 8, border: "1px solid #d4e5ba", marginBottom: 10, fontSize: 11, color: "#4a7316", lineHeight: 1.6 }}>
        💡 아래 목표들은 연속 2일 80% 이상 달성하여 자동으로 습득 완료 처리되었거나 선생님이 수동으로 전환한 프로그램입니다. 데이터 시트에서는 자동 제외되었습니다.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr>
              {["영역", "세부 목표 / 커리큘럼 연계", "리스트", "첫 측정", "달성 시점", "총 세션"].map(h => (
                <th key={h} style={{ padding: "8px 10px", background: "#eef6e5", border: "1px solid #d4e5ba", color: "#4a7316", fontWeight: 600, fontSize: 10.5, textAlign: "center" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map(g => (
              <tr key={g.id}>
                <td style={{ padding: "7px 10px", border: "1px solid #d4e5ba", background: "#f9fcf5", width: "12%" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: "#4a7316" }}>{shortDomain(g.domain)}</div>
                  <div style={{ fontSize: 8.5, color: "#aaa" }}>{g.subDomain}</div>
                </td>
                <td style={{ padding: "7px 10px", border: "1px solid #d4e5ba", fontSize: 11 }}>
                  <div style={{ textDecoration: "line-through", textDecorationColor: GREEN, textDecorationThickness: 1 }}>{g.item}</div>
                  <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {g.vbmapp && <span style={{ fontSize: 9, padding: "1px 6px", background: "#e6f1fb", color: "#2a6cb2", borderRadius: 6, fontWeight: 600 }}>VB: {g.vbmapp.v} L{g.vbmapp.lv}</span>}
                    {g.esdm && <span style={{ fontSize: 9, padding: "1px 6px", background: "#eaf3de", color: "#4a7316", borderRadius: 6, fontWeight: 600 }}>ESDM: {g.esdm.v}</span>}
                    {g.source && g.source !== "ELCAR" && <span style={{ fontSize: 9, padding: "1px 6px", background: "#f0f0f0", color: "#666", borderRadius: 6, fontWeight: 600 }}>{g.source}</span>}
                  </div>
                </td>
                <td style={{ padding: "7px 10px", border: "1px solid #d4e5ba", textAlign: "center", fontSize: 10.5 }}>
                  <span style={{ padding: "2px 7px", background: (g.listGroup || "1") === "1" ? PK : BLUE, color: "#fff", borderRadius: 8, fontSize: 9.5, fontWeight: 700 }}>L{g.listGroup || "1"}</span>
                </td>
                <td style={{ padding: "7px 10px", border: "1px solid #d4e5ba", textAlign: "center", color: "#888", fontSize: 11 }}>{g.firstRate === null ? "—" : `${g.firstRate}%`}</td>
                <td style={{ padding: "7px 10px", border: "1px solid #d4e5ba", textAlign: "center", fontWeight: 700, fontSize: 12.5, color: GREEN }}>
                  {g.latestRate === null ? "✓" : `${g.latestRate}%`}
                </td>
                <td style={{ padding: "7px 10px", border: "1px solid #d4e5ba", textAlign: "center", color: "#4a7316", fontSize: 10.5, fontWeight: 600 }}>{g.sessions}회</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GoalStatusTable({ goals, listGroup, title, color }) {
  const filtered = goals.filter(g => (g.listGroup || "1") === listGroup);

  if (filtered.length === 0) {
    return (
      <div style={CS}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: color === PK ? PKD : color }}>{title} <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>(0개)</span></h3>
        </div>
        <div style={{ textAlign: "center", padding: "26px 20px", fontSize: 11.5, color: "#bbb", border: "1px dashed #eee", borderRadius: 8 }}>
          이 리스트로 분류된 목표가 없습니다. [② IEP 설정] 탭의 각 목표 카드에서 <b>L{listGroup}</b> 버튼을 선택하세요.
        </div>
      </div>
    );
  }

  return (
    <div style={CS}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color }}>
          {title} <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>({filtered.length}개)</span>
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr>
              {["영역", "세부 목표 / 커리큘럼 연계", "리스트 / 과제", "첫 측정", "최근", "변화", "세션"].map(h => (
                <th key={h} style={{ padding: "8px 10px", background: listGroup === "1" ? PKL : "#e6f0fb", border: `1px solid ${listGroup === "1" ? "#e8d0d6" : "#c8dcec"}`, color: listGroup === "1" ? PKD : "#2a6cb2", fontWeight: 600, fontSize: 10.5, textAlign: "center" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => {
              const changeColor = g.change === null ? "#ccc" : g.change > 0 ? GREEN : g.change < 0 ? RED : "#999";
              return (
                <tr key={g.id}>
                  <td style={{ padding: "7px 10px", border: "1px solid #f0e0e5", background: listGroup === "1" ? "#fdf8f9" : "#f4f8fc", width: "12%" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: listGroup === "1" ? PKD : "#2a6cb2" }}>{shortDomain(g.domain)}</div>
                    <div style={{ fontSize: 8.5, color: "#aaa" }}>{g.subDomain}</div>
                  </td>
                  <td style={{ padding: "7px 10px", border: "1px solid #f0e0e5", fontSize: 11 }}>
                    <div>{g.item}</div>
                    <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {g.vbmapp && <span style={{ fontSize: 9, padding: "1px 6px", background: "#e6f1fb", color: "#2a6cb2", borderRadius: 6, fontWeight: 600 }}>VB: {g.vbmapp.v} L{g.vbmapp.lv}</span>}
                      {g.esdm && <span style={{ fontSize: 9, padding: "1px 6px", background: "#eaf3de", color: "#4a7316", borderRadius: 6, fontWeight: 600 }}>ESDM: {g.esdm.v}</span>}
                      {g.source && g.source !== "ELCAR" && <span style={{ fontSize: 9, padding: "1px 6px", background: "#f0f0f0", color: "#666", borderRadius: 6, fontWeight: 600 }}>{g.source}</span>}
                    </div>
                  </td>
                  <td style={{ padding: "7px 10px", border: "1px solid #f0e0e5", fontSize: 10.5, color: "#555" }}>
                    {g.listName && <div style={{ fontWeight: 600, color: listGroup === "1" ? PKD : "#2a6cb2", marginBottom: 2 }}>{g.listName}</div>}
                    {g.listItems ? <div style={{ fontSize: 10, color: "#666", lineHeight: 1.5 }}>{g.listItems}</div> : <div style={{ color: "#ccc", fontStyle: "italic" }}>—</div>}
                  </td>
                  <td style={{ padding: "7px 10px", border: "1px solid #f0e0e5", textAlign: "center", color: "#888", fontSize: 11 }}>{g.firstRate === null ? "—" : `${g.firstRate}%`}</td>
                  <td style={{ padding: "7px 10px", border: "1px solid #f0e0e5", textAlign: "center", fontWeight: 700, fontSize: 12.5, color: g.latestRate === null ? "#ccc" : g.latestRate >= 80 ? GREEN : g.latestRate >= 50 ? BLUE : ORANGE }}>
                    {g.latestRate === null ? "—" : `${g.latestRate}%`}
                  </td>
                  <td style={{ padding: "7px 10px", border: "1px solid #f0e0e5", textAlign: "center", fontWeight: 600, color: changeColor, fontSize: 11 }}>
                    {g.change === null ? "—" : g.change > 0 ? `↑ +${g.change}%` : g.change < 0 ? `↓ ${g.change}%` : "→ 0%"}
                  </td>
                  <td style={{ padding: "7px 10px", border: "1px solid #f0e0e5", textAlign: "center", color: "#888", fontSize: 10.5 }}>{g.sessions}회</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GrowthLineChart({ goals, dates, getTimeline }) {
  const calcDayRate = calcDayRateGlobal;
  const points = useMemo(() => {
    return dates.map(date => {
      let sum = 0, n = 0;
      goals.forEach(g => {
        const taskRates = [];
        (g.tasks || []).forEach(t => {
          const r = calcDayRate(t.daily?.[date], t.plannedTrials);
          if (r !== null) taskRates.push(r);
        });
        let goalValue = null;
        if (taskRates.length > 0) {
          goalValue = Math.round(taskRates.reduce((a, b) => a + b, 0) / taskRates.length);
        } else {
          const r = calcDayRate(g.daily?.[date]);
          if (r !== null) goalValue = r;
        }
        if (goalValue === null) return;
        sum += goalValue;
        n++;
      });
      return { date, avg: n > 0 ? Math.round(sum / n) : null, n };
    }).filter(p => p.avg !== null);
  }, [goals, dates]);

  if (points.length === 0) return <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#aaa" }}>데이터 없음</div>;

  const W = 700, H = 235, padL = 40, padR = 24, padT = 34, padB = 40;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const xStep = points.length > 1 ? chartW / (points.length - 1) : 0;
  const pts = points.map((p, i) => ({ x: padL + i * xStep, y: padT + (1 - p.avg / 100) * chartH, avg: p.avg, date: p.date }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: "100%", display: "block" }}>
      {/* 수평 grid */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = padT + (1 - v / 100) * chartH;
        return <g key={v}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={v === 80 ? GREEN : "#eee"} strokeWidth={v === 80 ? 1 : 0.5} strokeDasharray={v === 80 ? "4,3" : "none"} />
          <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#999">{v}%</text>
        </g>;
      })}
      <text x={W - padR} y={padT - 10} fontSize="8.5" fill={GREEN} textAnchor="end" fontWeight="600">― 숙달 기준선 80%</text>

      {/* 라인 */}
      <path d={path} fill="none" stroke={PK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* 영역 채우기 */}
      <path d={`${path} L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`} fill={`${PK}12`} />

      {/* 포인트 + 값 */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={PK} strokeWidth="2" />
          <text
            x={i === 0 ? p.x + 6 : (i === pts.length - 1 ? p.x - 6 : p.x)}
            y={p.y < padT + 18 ? p.y + 16 : p.y - 9}
            fontSize="10" fill={PKD}
            textAnchor={i === 0 ? "start" : (i === pts.length - 1 ? "end" : "middle")}
            fontWeight="700">{p.avg}%</text>
          <text x={p.x} y={H - padB + 14} fontSize="9" fill="#888" textAnchor="middle">{p.date.slice(5)}</text>
        </g>
      ))}
    </svg>
  );
}

function GoalDashboard({ stos }) {
  if (!stos || stos.length === 0) return null;
  const SC_DASH = { 완료: "#639922", 진행중: "#378ADD", 진행예정: "#EF9F27", 중단: "#B4B2A9" };

  const CURR_COLOR = {
    vbmapp: { accent: CURR_COLORS.vbmapp.accent, bg: CURR_COLORS.vbmapp.bg, label: CURR_COLORS.vbmapp.label + " 평가", chartLine: CURR_COLORS.vbmapp.line, deep: CURR_COLORS.vbmapp.deep },
    elcar:  { accent: CURR_COLORS.elcar.accent,  bg: CURR_COLORS.elcar.bg,  label: CURR_COLORS.elcar.label + " 평가",  chartLine: CURR_COLORS.elcar.line,  deep: CURR_COLORS.elcar.deep },
    esdm:   { accent: CURR_COLORS.esdm.accent,   bg: CURR_COLORS.esdm.bg,   label: CURR_COLORS.esdm.label + " 평가",   chartLine: CURR_COLORS.esdm.line,   deep: CURR_COLORS.esdm.deep },
    other:  { accent: CURR_COLORS.other.accent,  bg: CURR_COLORS.other.bg,  label: "기타 목표",                          chartLine: CURR_COLORS.other.line,  deep: CURR_COLORS.other.deep },
  };

  const currGroups = { vbmapp: {}, elcar: {}, esdm: {}, other: {} };
  const currOrder = { vbmapp: [], elcar: [], esdm: [], other: [] };
  stos.forEach(s => {
    if (s.status === "중단") return;
    const dom = (s.domain || "기타").replace(/^[Ⅰ-Ⅺ]\s*/, "");
    const curr = classifyCurriculum(dom);
    if (!currGroups[curr][dom]) {
      currGroups[curr][dom] = [];
      currOrder[curr].push(dom);
    }
    currGroups[curr][dom].push(s);
  });

  const BigChart = ({ points, color, listBoundaries }) => {
    if (!points || points.length < 1) return null;
    const W = 290, H = 80, padX = 8, padTop = 18, padBottom = 18;
    const innerH = H - padTop - padBottom;
    const yOf = v => padTop + (1 - v / 100) * innerH;
    const y80 = yOf(80);
    if (points.length === 1) {
      const p = points[0];
      const cx = W / 2, cy = yOf(p.value);
      return (
        <svg className="dashboard-bigchart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto", width: `${W}px`, height: `${H}px`, maxWidth: "100%" }}>
          <line x1={padX} y1={y80} x2={W - padX} y2={y80} stroke="#3D7A0F" strokeWidth="1.2" strokeDasharray="4,3" opacity="0.85" />
          <text x={W - padX - 2} y={y80 - 3} fontSize="9" fill="#3D7A0F" textAnchor="end" fontWeight="800">숙달 80%</text>
          <circle cx={cx} cy={cy} r="5" fill={color} stroke="#fff" strokeWidth="2" />
          <text x={cx} y={cy - 10} fontSize="9" fill={color} textAnchor="middle" fontWeight="700">{p.value}%</text>
          <text x={cx} y={H - padBottom + 12} fontSize="8" fill="#999" textAnchor="middle">시작 데이터</text>
          {/* L1 라벨 (단일 포인트일 때도 표시) */}
          {listBoundaries && listBoundaries.length > 0 && (
            <text x={padX + 2} y={padTop - 6} fontSize="8.5" fill="#888" fontWeight="700">{listBoundaries[0].listLabel}</text>
          )}
        </svg>
      );
    }
    const stepX = (W - padX * 2) / (points.length - 1);
    const coords = points.map((p, i) => ({ x: padX + i * stepX, y: yOf(p.value), value: p.value, date: p.date }));
    const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const fillD = pathD + ` L${coords[coords.length - 1].x.toFixed(1)},${(H - padBottom).toFixed(1)} L${coords[0].x.toFixed(1)},${(H - padBottom).toFixed(1)} Z`;
    const gradId = `grad-${color.replace("#", "")}-${Math.random().toString(36).substr(2, 5)}`;
    return (
      <svg className="dashboard-bigchart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto", width: `${W}px`, height: `${H}px`, maxWidth: "100%" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={y80} x2={W - padX} y2={y80} stroke="#3D7A0F" strokeWidth="1.2" strokeDasharray="4,3" opacity="0.85" />
        <text x={W - padX - 2} y={y80 - 3} fontSize="9" fill="#3D7A0F" textAnchor="end" fontWeight="800">숙달 80%</text>
        <path d={fillD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => {
          const isLast = i === coords.length - 1;
          return <circle key={i} cx={c.x} cy={c.y} r={isLast ? 3.8 : 2.6} fill={color} stroke={isLast ? "#fff" : "none"} strokeWidth={isLast ? 1.5 : 0} />;
        })}
        {/* ★ list 경계선 + L1/L2/L3 라벨 */}
        {listBoundaries && listBoundaries.map((b, i) => {
          const x = coords[b.atIndex] ? coords[b.atIndex].x : padX;
          // 라벨이 오른쪽 끝에 너무 가까우면 끝 정렬(안쪽으로), 아니면 시작 정렬
          const nearRight = x > W - padX - 16;
          const isFirst = i === 0;
          return (
            <g key={i}>
              {i > 0 && (
                <line x1={x} y1={padTop} x2={x} y2={H - padBottom} stroke="#bbb" strokeWidth="1" strokeDasharray="3,2" opacity="0.7" />
              )}
              <text
                x={isFirst ? padX + 2 : (nearRight ? x - 2 : x + 2)}
                y={padTop - 6}
                fontSize="8.5"
                fill="#888"
                fontWeight="700"
                textAnchor={isFirst ? "start" : (nearRight ? "end" : "start")}>
                {b.listLabel}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const fmtDate = d => {
    if (!d) return "";
    const m = String(d).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return d;
    return `${m[1]}.${parseInt(m[2])}.${parseInt(m[3])}`;
  };

  const currCategoryOrder = ["vbmapp", "elcar", "esdm", "other"];

  return (
    <div className="dashboard-wrap" style={{ marginTop: 8 }}>
      {(() => {
        let renderedCurrCount = 0;
        return currCategoryOrder.map(curr => {
          const domains = currOrder[curr];
          if (domains.length === 0) return null;
          const meta = CURR_COLOR[curr];
          let pdfCardIdx = 0;
          const isPdfCurrBreak = renderedCurrCount > 0;
          renderedCurrCount++;
          const currBreakStyle = isPdfCurrBreak ? { pageBreakBefore: "always", breakBefore: "page" } : {};
          return (
            <div key={curr} className={"dashboard-curriculum" + (isPdfCurrBreak ? " pdf-curr-break" : "")} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 12, borderLeft: `5px solid ${meta.accent}`, backgroundImage: `linear-gradient(to right, ${meta.bg} 0%, #fff 8%)`, border: "1px solid #f0e0e5", ...currBreakStyle }}>
              <h3 className="dashboard-domain-header" style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, marginTop: 0, color: meta.deep, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: meta.accent }}></span>
                <span>{meta.label}</span>
              </h3>
              {domains.map((dom, di) => (
                <div key={di} className="dashboard-domain" style={{ marginBottom: 10 }}>
                  {currGroups[curr][dom].map((s, si) => {
                    const status = s.status || "진행중";
                  const statusColor = SC_DASH[status] || "#888";
                  const isCompleted = status === "완료";
                  const points = s.points || [];
                  let growthInfo = null;
                  if (points.length >= 1) {
                    const first = points[0].value;
                    const last = points[points.length - 1].value;
                    const diff = last - first;
                    const startDate = points[0].date;
                    const endDate = points[points.length - 1].date;
                    const hasMultiplePoints = points.length >= 2;
                    const vals = points.map(p => p.value);
                    const minVal = Math.min(...vals);
                    const maxVal = Math.max(...vals);
                    const variance = maxVal - minVal;
                    let reachedMastery = false;
                    for (let i = 0; i < vals.length - 1; i++) {
                      if (vals[i] >= 80 && vals[i + 1] >= 80) { reachedMastery = true; break; }
                    }
                    const lastVal = vals[vals.length - 1];
                    const isCurrentlyHigh = lastVal >= 80;
                    let milestoneMsg = "", milestoneIcon = "·", milestoneColor = "#888";
                    if (reachedMastery) {
                      milestoneMsg = "2회 연속 80% 이상 · 숙달 기준 도달";
                      milestoneIcon = "✓";
                      milestoneColor = "#639922";
                    } else if (isCurrentlyHigh && hasMultiplePoints) {
                      milestoneMsg = "현재 80% 이상 · 연속 안정화 단계 중";
                      milestoneIcon = "↗";
                      milestoneColor = "#378ADD";
                    } else if (diff >= 10) {
                      if (lastVal >= 60) { milestoneMsg = "꾸준한 성장세 · 숙달 단계 향해 진행 중"; milestoneIcon = "↗"; milestoneColor = "#639922"; }
                      else if (lastVal >= 40) { milestoneMsg = "초기 성장 단계 · 기초를 다지는 중"; milestoneIcon = "↗"; milestoneColor = "#378ADD"; }
                      else { milestoneMsg = "기초선 형성 중 · 학습 적응 단계"; milestoneIcon = "↗"; milestoneColor = "#888"; }
                    } else if (diff >= -5 && diff <= 5 && hasMultiplePoints) {
                      if (lastVal >= 60) milestoneMsg = "안정적 유지 · 다음 단계 도전 준비 중";
                      else if (lastVal >= 40) milestoneMsg = "안정적 적응 중 · 단계적 접근 진행";
                      else milestoneMsg = "학습 적응 단계 · 기초 형성 중";
                      milestoneIcon = "→";
                      milestoneColor = "#888";
                    } else if (diff < -5) {
                      milestoneMsg = "현재 적응 단계 · 학습 전략 재조정 중";
                      milestoneIcon = "↘";
                      milestoneColor = "#888";
                    } else if (!hasMultiplePoints) {
                      milestoneMsg = "기초선(Baseline) 평가 단계 · 본격 중재 시작";
                      milestoneIcon = "·";
                      milestoneColor = "#888";
                    } else {
                      milestoneMsg = "학습 진행 중";
                      milestoneIcon = "·";
                      milestoneColor = "#888";
                    }
                    let rangeMsg = "";
                    if (hasMultiplePoints) {
                      if (variance >= 20) rangeMsg = "학습 과정 자연스러운 변동 후 안정화";
                      else if (variance >= 10) rangeMsg = "안정적 상승";
                      else rangeMsg = "일정한 수행 유지";
                    }
                    growthInfo = { first, last, diff, startDate, endDate, hasMultiplePoints, minVal, maxVal, variance, milestoneMsg, milestoneIcon, milestoneColor, rangeMsg };
                  }
                  pdfCardIdx++;
                  const isPdfBreak = pdfCardIdx > 1 && pdfCardIdx % 2 === 1;
                  const cardBreakStyle = isPdfBreak ? { pageBreakBefore: "always", breakBefore: "page" } : {};
                  return (
                    <div key={si} className={"dashboard-card" + (isPdfBreak ? " pdf-card-break" : "")} style={{ background: "#fff", border: "1px solid #E5E5E5", borderLeft: `5px solid ${meta.accent}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10, ...cardBreakStyle }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#222", lineHeight: 1.4, flex: 1 }}>
                          {s.name}
                        </div>
                        <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 10, background: statusColor, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                          {status}{isCompleted ? " 🎉" : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 12 }}>{dom}</div>
                      {growthInfo && (
                        <div style={{ background: "#FAFAFA", borderRadius: 10, padding: "10px 8px 6px", marginBottom: 10 }}>
                          <BigChart points={points} color={meta.chartLine} listBoundaries={s.listBoundaries} />
                        </div>
                      )}
                      {growthInfo && (
                        <div style={{ padding: "10px 12px", background: "#FAFAFA", borderRadius: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "#888", fontWeight: 500, marginBottom: 5 }}>
                            {fmtDate(growthInfo.startDate)}{growthInfo.hasMultiplePoints ? ` ~ ${fmtDate(growthInfo.endDate)}` : ""}
                          </div>
                          {growthInfo.hasMultiplePoints ? (
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#333" }}>
                              시작 {growthInfo.first}% <span style={{ color: meta.chartLine, fontWeight: 800, margin: "0 8px" }}>→</span> 현재 {growthInfo.last}%
                            </div>
                          ) : (
                            <div style={{ fontSize: 16, fontWeight: 700, color: meta.chartLine }}>현재 {growthInfo.last}%</div>
                          )}
                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #E5E5E5", fontSize: 11, color: growthInfo.milestoneColor, fontWeight: 600, lineHeight: 1.5 }}>
                            <span style={{ marginRight: 4 }}>{growthInfo.milestoneIcon}</span>{growthInfo.milestoneMsg}
                          </div>
                          {growthInfo.hasMultiplePoints && growthInfo.variance >= 10 && (
                            <div style={{ marginTop: 4, fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                              측정 범위 <b style={{ color: "#555" }}>{growthInfo.minVal}%~{growthInfo.maxVal}%</b> · {growthInfo.rangeMsg}
                            </div>
                          )}
                        </div>
                      )}
                      {/* 학습 내용 박스 — list별 task 정보 (L1, L2, L3 각각) */}
                      {s.listBoundaries && s.listBoundaries.length > 0 && (
                        <div style={{
                          marginTop: 10,
                          background: "#FAFAFA",
                          borderRadius: 10,
                          padding: "10px 12px",
                          borderLeft: `3px solid ${meta.accent}`
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#666", marginBottom: 6, letterSpacing: "0.3px" }}>
                            학습 내용
                          </div>
                          {s.listBoundaries.map((b, bi) => (
                            <div key={bi} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: bi < s.listBoundaries.length - 1 ? 5 : 0 }}>
                              <span style={{
                                display: "inline-block",
                                flexShrink: 0,
                                padding: "2px 8px",
                                background: "#fff",
                                border: `1px solid ${meta.accent}40`,
                                borderRadius: 8,
                                fontSize: 9,
                                fontWeight: 700,
                                color: meta.chartLine,
                                lineHeight: 1.4,
                                minWidth: 26,
                                textAlign: "center"
                              }}>{b.listLabel}</span>
                              <span style={{
                                fontSize: 11,
                                color: "#444",
                                lineHeight: 1.5,
                                flex: 1,
                                fontWeight: 500,
                                wordBreak: "keep-all",
                                overflowWrap: "break-word"
                              }}>{b.taskName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      });
      })()}
    </div>
  );
}

function DomainCompletionSection({ goals }) {
  if (!goals || goals.length === 0) return null;

  const byDomain = {};
  goals.forEach(g => {
    if (!g.includeInIep) return;
    const dom = g.domain || "(영역 없음)";
    if (!byDomain[dom]) byDomain[dom] = { total: 0, mastered: 0, paused: 0, ongoing: 0 };
    (g.tasks || []).forEach(t => {
      const lg = t.listGroup || "1";
      byDomain[dom].total++;
      if (lg === "2") byDomain[dom].mastered++;
      else if (lg === "paused") byDomain[dom].paused++;
      else byDomain[dom].ongoing++;
    });
  });

  const domains = Object.entries(byDomain)
    .filter(([, d]) => d.total > 0)
    .sort(([, a], [, b]) => (b.mastered / b.total) - (a.mastered / a.total));

  if (domains.length === 0) return null;

  const totalAll = domains.reduce((s, [, d]) => s + d.total, 0);
  const masteredAll = domains.reduce((s, [, d]) => s + d.mastered, 0);
  const pausedAll = domains.reduce((s, [, d]) => s + d.paused, 0);

  return (
    <div>
      {/* 전체 요약 */}
      <div style={{
        background: "#f5f7f0",
        border: "1px solid #d4e5ba",
        borderLeft: "4px solid #5a8c1f",
        borderRadius: 6,
        padding: "10px 14px",
        marginBottom: 12,
        fontSize: 11,
        color: "#3d6014"
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          📊 전체 종결 시점 — {domains.length}개 영역, 총 {totalAll}개 과제 중 <span style={{ color: "#3a6014", fontSize: 13 }}>{masteredAll}개 마스터</span>
          {pausedAll > 0 && <span style={{ color: "#a87108", marginLeft: 6 }}>· {pausedAll}개 중단</span>}
        </div>
        <div style={{ fontSize: 10, color: "#5a8c1f" }}>
          마스터율: {Math.round((masteredAll / totalAll) * 100)}%
        </div>
      </div>

      {/* 영역별 막대 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {domains.map(([dom, d]) => {
          const masterPct = (d.mastered / d.total) * 100;
          const ongoingPct = (d.ongoing / d.total) * 100;
          const pausedPct = (d.paused / d.total) * 100;
          return (
            <div key={dom}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#333" }}>{dom}</div>
                <div style={{ fontSize: 11, color: "#5a8c1f", fontWeight: 600 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{d.mastered}</span>
                  <span style={{ color: "#888" }}> / {d.total}</span>
                  <span style={{ color: "#888", marginLeft: 6, fontSize: 10 }}>마스터 ({Math.round(masterPct)}%)</span>
                </div>
              </div>
              {/* 스택 막대 */}
              <div style={{ display: "flex", height: 22, background: "#f0e0e5", borderRadius: 4, overflow: "hidden", border: "1px solid #e8d8dd" }}>
                {d.mastered > 0 && (
                  <div style={{
                    width: `${masterPct}%`,
                    background: "#5a8c1f",
                    color: "#fff",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600
                  }}>
                    {masterPct >= 12 && `${d.mastered}`}
                  </div>
                )}
                {d.ongoing > 0 && (
                  <div style={{
                    width: `${ongoingPct}%`,
                    background: "#f5b942",
                    color: "#604515",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600
                  }}>
                    {ongoingPct >= 12 && `${d.ongoing}`}
                  </div>
                )}
                {d.paused > 0 && (
                  <div style={{
                    width: `${pausedPct}%`,
                    background: "#c9a85a",
                    color: "#fff",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600
                  }}>
                    {pausedPct >= 12 && `${d.paused}`}
                  </div>
                )}
              </div>
              {/* 세부 분류 (작은 글씨) */}
              <div style={{ fontSize: 9.5, color: "#888", marginTop: 3, display: "flex", gap: 10 }}>
                {d.mastered > 0 && <span style={{ color: "#5a8c1f" }}>✓ 마스터 {d.mastered}</span>}
                {d.ongoing > 0 && <span style={{ color: "#a87108" }}>● 진행중 {d.ongoing}</span>}
                {d.paused > 0 && <span style={{ color: "#967040" }}>⏸ 중단 {d.paused}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

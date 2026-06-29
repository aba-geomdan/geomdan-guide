import React, { useState, useEffect, useRef } from 'react';
import {
  supabaseConfigured,
  dbGetUser, dbListUsers, dbCreateUser, dbUpdatePassword, dbDeleteUser,
  dbListGuides, dbInsertGuide, dbDeleteGuide, dbUpdateGuide,
  dbGetFavorites, dbSetFavorites,
  dbGetCustomTemplates, dbSetCustomTemplates,
  verifyPassword,
} from './supabase.js';

// ───────── 스토리지 키 (사용자별 분리 v3) ─────────
const STORAGE_KEY_FAVORITES_BASE = 'gd_aba_parent_guide_favorites_v3';
const STORAGE_KEY_HISTORY_BASE = 'gd_aba_parent_guide_history_v3';

// 사용자별 스토리지 키 생성 (예: gd_aba_parent_guide_history_v3__user_abc123)
function favoritesKey(userId) {
  return `${STORAGE_KEY_FAVORITES_BASE}__${userId}`;
}
function historyKey(userId) {
  return `${STORAGE_KEY_HISTORY_BASE}__${userId}`;
}

// 사용자 목록 / 세션
const STORAGE_KEY_USERS = 'gd_aba_users_v1';
const STORAGE_KEY_SESSION = 'gd_aba_session_v1';

// 호환성용 (마이그레이션에 사용)
const STORAGE_KEY_FAVORITES_V2 = 'gd_aba_parent_guide_favorites_v2';
const STORAGE_KEY_HISTORY_V2 = 'gd_aba_parent_guide_history_v2';

// 관리자 기본 계정 (첫 실행 시 자동 생성)
// 비밀번호는 빌드 시점 환경변수(.env)에서 주입 — 공개 소스에 평문을 남기지 않음
const DEFAULT_ADMIN = {
  id: '민다혜',
  name: '민다혜 원장님',
  password: import.meta.env.VITE_ADMIN_PASSWORD || 'changeme',
  role: 'admin',
  createdAt: 0, // 첫 실행 시 채워짐
};

const LOGO_DATA_URI = 'data:image/png;base64,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';

const DEFAULT_FAVORITES = [
  '포크로 간식 찍어 먹기',
  '소리지르는 행동',
  '신발 스스로 신기',
  '눈맞춤 늘리기',
  '차례 기다리기',
  '이름 부르면 대답하기',
  '장난감 정리하기',
  '양치질 거부 줄이기',
];

// 행동 기능 4가지
const FUNCTIONS = [
  {
    id: 'attention',
    label: '관심끌기',
    desc: '엄마/아빠/주변 사람의 시선이나 반응을 얻기 위함',
    example: '예) 어머님이 통화 중일 때 소리지르기, 손님 왔을 때 떼쓰기',
    color: '#e07187',
  },
  {
    id: 'escape',
    label: '회피',
    desc: '하기 싫은 과제나 불편한 상황에서 벗어나기 위함',
    example: '예) 양치 시간에 도망가기, 학습지 보면 짜증내기',
    color: '#c95a78',
  },
  {
    id: 'tangible',
    label: '요구',
    desc: '원하는 물건·간식·활동을 얻기 위함',
    example: '예) 과자 달라고 보채기, 영상 틀어달라고 울기',
    color: '#a84960',
  },
  {
    id: 'sensory',
    label: '자기자극',
    desc: '특정 감각이 즐겁거나 안정되어 스스로 반복함',
    example: '예) 손 흔들기, 같은 소리 반복, 빙글빙글 돌기',
    color: '#d97a92',
  },
  {
    id: 'other',
    label: '기타 / 복합',
    desc: '위 4가지에 딱 맞지 않거나 여러 기능이 섞여 있을 때',
    example: '예) 기능 파악이 어려운 경우, 상황별로 기능이 바뀌는 경우',
    color: '#7a3a52',
  },
];

// (SYSTEM_PROMPT 제거됨 — AI 호출을 로컬 템플릿으로 대체)

const LOADING_STAGES = [
  { at: 0,  text: '예상 행동 기능을 살펴보고 있습니다',     percent: 12 },
  { at: 4,  text: '측정 가능한 목표를 설정하고 있습니다',   percent: 30 },
  { at: 9,  text: '기능에 맞는 개입 절차를 설계하고 있습니다', percent: 52 },
  { at: 15, text: '강화 계획을 다듬고 있습니다',           percent: 74 },
  { at: 22, text: '주간 체크표를 준비하고 있습니다',       percent: 90 },
  { at: 30, text: '조금만 더 기다려주세요',                percent: 96 },
];

// 한국어 받침 판별: 마지막 글자에 받침이 있으면 true
function hasJongseong(str) {
  if (!str) return false;
  const lastChar = str.trim().slice(-1);
  const code = lastChar.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false; // 한글 범위 밖
  return (code - 0xAC00) % 28 !== 0;
}

// 아동 이름 + 호칭화 ("민준" -> "민준이", "다혜" -> "다혜")
function nameWithSuffix(name) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return hasJongseong(trimmed) ? `${trimmed}이` : trimmed;
}

// "을/를" 자동 선택 ("민준" -> "민준이를", "다혜" -> "다혜를")
function namePlusReul(name) {
  if (!name) return '';
  const callName = nameWithSuffix(name); // 호칭형
  if (!callName) return ''; // 공백만 입력된 경우 빈 문자열 반환
  return hasJongseong(callName) ? `${callName}을` : `${callName}를`;
}

// 주격 조사 "이/가" 자동 선택 (호칭형 기준)
function namePlusGa(name) {
  const callName = nameWithSuffix(name);
  if (!callName) return '아이가';
  return hasJongseong(callName) ? `${callName}이` : `${callName}가`;
}

// 보조사 "은/는" 자동 선택 (호칭형 기준)
function namePlusNeun(name) {
  const callName = nameWithSuffix(name);
  if (!callName) return '아이는';
  return hasJongseong(callName) ? `${callName}은` : `${callName}는`;
}

// 가이드 본문에서 부를 이름 (이름 없으면 "아이")
function callNameOr(name) {
  return nameWithSuffix(name) || '아이';
}

// ──────────────────────────────────────────────
// 영역(domain) 정의
// 주제를 키워드로 분류해서, 실천 내용이 영역마다 달라지게 한다.
// (기능=왜 그러는지 / 영역=무엇을 어떻게 연습하는지)
// ──────────────────────────────────────────────
const DOMAINS = [
  {
    id: 'language',
    label: '언어·요구하기',
    keywords: ['말', '단어', '발화', '요구', '요청', '의사소통', '이름', '대답', '호명', '문장', '언어', '표현', '카드', 'aac', '맨드', '따라말하기', '모방발성', '소리'],
  },
  {
    id: 'selfcare',
    label: '자조·일상생활',
    keywords: ['양치', '신발', '옷', '입기', '벗기', '단추', '지퍼', '손씻기', '세수', '화장실', '배변', '식사', '숟가락', '포크', '젓가락', '정리', '치우기', '자조', '일상', '먹기', '컵', '양말'],
  },
  {
    id: 'social',
    label: '사회성·상호작용',
    keywords: ['눈맞춤', '눈 맞춤', '차례', '기다리', '순서', '주고받기', '함께', '같이', '친구', '또래', '인사', '상호작용', '사회성', '놀이', '공유', '나누기', '모방', '따라하기', '관심공유', '가리키기'],
  },
  {
    id: 'cognition',
    label: '학습·인지',
    keywords: ['색', '색깔', '모양', '숫자', '수', '글자', '한글', '분류', '맞추기', '퍼즐', '짝짓기', '변별', '인지', '학습', '개념', '크기', '비교', '기억', '주의집중', '앉아있기', '과제'],
  },
  {
    id: 'behavior',
    label: '도전행동 줄이기',
    keywords: ['소리지르', '소리 지르', '떼', '울기', '때리기', '물기', '던지기', '자해', '공격', '거부', '도망', '드러눕기', '문제행동', '도전행동', '짜증', '고집', '멈추기', '줄이기'],
  },
];

// 주제 텍스트로 영역 자동 판별 (키워드 매칭 점수 최댓값)
function detectDomain(topic) {
  if (!topic) return 'social';
  const t = topic.toLowerCase().replace(/\s+/g, '');
  let best = null;
  let bestScore = 0;
  for (const d of DOMAINS) {
    let score = 0;
    for (const kw of d.keywords) {
      if (t.includes(kw.toLowerCase().replace(/\s+/g, ''))) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = d.id; }
  }
  return best || 'social'; // 매칭 없으면 사회성 기본
}

// ──────────────────────────────────────────────
// 영역별 실천 내용 (goal/materials/practice/weekly_focus)
// 이 4개 필드는 영역에 따라 기능 템플릿 위에 덮어쓴다.
// ──────────────────────────────────────────────
const DOMAIN_FIELDS = {
  language: {
    goal: '{topic}와 관련해 {name_ga} 원하는 것을 말·단어·카드 중 하나로 표현하는 것을 봅니다. 5번 중 2~3번 자발적으로 나오면 충분합니다. 발음이 완벽하지 않아도 시도 자체를 봐주세요.',
    materials: '{name}가 좋아하는 물건이나 간식 하나(요청할 동기가 되는 것).\n\n표현을 도울 그림카드나 사진, 또는 짧은 단어 목록.',
    practice: '1단계 (1분) - {name_ga} 원하는 것을 살짝 보이되 바로 주지 마세요. 표현할 이유를 만들어 줍니다.\n\n2단계 (2분) - 어머님이 먼저 단어나 카드를 짧게 보여주세요(\"주세요\", \"열어\"). 그대로 따라 하거나 카드를 짚으면 됩니다.\n\n3단계 (2분) - 시도가 나오면 그 자리에서 바로 들어주세요. 표현 → 얻음의 연결을 빠르게 만들어 줍니다.',
    weekly_focus: '{name_ga} 말·단어·카드로 표현을 시도한 횟수',
  },
  selfcare: {
    goal: '{topic} 과정을 작은 단계로 나눠, {name_ga} 마지막 한 단계라도 스스로 하는 것을 봅니다. 5번 중 2~3번 나오면 충분합니다. 전부가 아니라 한 단계부터입니다.',
    materials: '{topic}에 필요한 실제 도구(칫솔, 신발, 옷 등).\n\n순서를 보여줄 간단한 그림이나 사진(선택).',
    practice: '1단계 (1분) - 어머님이 대부분을 도와주시고, 맨 마지막 한 동작만 {name}에게 남겨주세요(예: 신발 마지막으로 당기기).\n\n2단계 (2분) - 그 마지막 동작을 {name_ga} 스스로 하게 두세요. 손을 살짝 받쳐주셔도 됩니다.\n\n3단계 (2분) - 익숙해지면 도와주는 양을 조금씩 줄여, 마지막에서 두 번째 단계도 맡겨보세요.',
    weekly_focus: '{name_ga} {topic}에서 스스로 한 단계를 해낸 횟수',
  },
  social: {
    goal: '{topic}와 관련해 {name_ga} 짧게라도 상대와 주고받는 순간을 봅니다. 5번 중 2~3번 나오면 충분합니다. 길게가 아니라 한 번의 주고받음부터입니다.',
    materials: '둘이 주고받을 수 있는 물건 하나(공, 블록, 좋아하는 장난감).\n\n마주 앉을 수 있는 조용한 공간.',
    practice: '1단계 (1분) - {name}와 마주 앉으세요. 좋아하는 물건을 어머님이 들고, {name_ga} 쳐다보는 순간을 기다립니다.\n\n2단계 (2분) - 눈이 마주치거나 손을 내밀면 바로 건네주세요. 그 주고받음이 핵심입니다.\n\n3단계 (2분) - \"주고-받고\"를 짧게 반복하세요. 차례를 기다리는 연습도 자연스럽게 됩니다.',
    weekly_focus: '{name_ga} 상대와 주고받기(눈맞춤·차례)를 한 횟수',
  },
  cognition: {
    goal: '{topic}와 관련해 {name_ga} 한 번에 맞히거나 분류하는 것을 봅니다. 5번 중 2~3번 나오면 충분합니다. 처음엔 보기를 2개로 줄여 쉽게 시작하세요.',
    materials: '{topic}에 맞는 카드·물건 2~3개(보기 수를 적게).\n\n맞췄을 때 줄 작은 보상(좋아하는 것).',
    practice: '1단계 (1분) - 보기를 2개만 놓고 시작하세요. \"○○ 어디 있어?\" 한 가지만 물어봅니다.\n\n2단계 (2분) - {name_ga} 망설이면 정답 쪽을 살짝 가리켜 도와주세요. 맞으면 바로 다음으로 넘어갑니다.\n\n3단계 (2분) - 익숙해지면 보기를 하나 더 늘리거나, 도움을 줄여보세요. 한 번에 하나만 올립니다.',
    weekly_focus: '{name_ga} {topic}을(를) 스스로 맞힌 횟수',
  },
  behavior: {
    goal: '{topic} 행동 대신 할 수 있는 다른 행동 하나를 정해, {name_ga} 그쪽을 택하는 것을 봅니다. 하루에 1~2번이라도 나오면 충분합니다. 없애기보다 바꿔주기입니다.',
    materials: '{name_ga} {topic} 행동을 보이기 직전 신호를 적을 메모.\n\n대신할 행동을 도울 도구(예: \"그만\" 카드, 진정용 물건).',
    practice: '1단계 (1분) - {topic} 행동이 나오기 직전의 신호를 살펴보세요. 그 순간이 개입 시점입니다.\n\n2단계 (2분) - 행동이 커지기 전에, 미리 정한 대체 행동을 하도록 도와주세요(예: \"그만\" 카드 짚기, 자리 옮기기).\n\n3단계 (2분) - 대체 행동이 나오면 바로 들어주세요. 도전행동보다 그쪽이 빠르게 통한다는 걸 경험하게 합니다.',
    weekly_focus: '{name_ga} {topic} 대신 대체 행동을 택한 횟수',
  },
};

// ──────────────────────────────────────────────
// 로컬 가이드 템플릿 (AI 없이 생성)
// 각 기능(function)별로 9개 필드를 채운다.
// {name}=호칭형 이름, {name_ga}=이/가, {name_neun}=은/는,
// {topic}=주제 가 치환된다.
// 담백한 임상 메모체 톤을 따른다.
// ──────────────────────────────────────────────
const GUIDE_TEMPLATES = {
  attention: {
    function_analysis:
      '{name_ga} {topic} 상황에서 보이는 행동은 어머님이나 주변 사람의 반응을 얻으려는 것일 가능성이 큽니다. 다만 관심을 적절히 요청하는 다른 방법을 아직 못 배운 경우가 많습니다. 이번 주는 그 대체 방법을 같이 가르치는 쪽으로 살펴보겠습니다.',
    goal:
      '{topic}와 관련해 {name_ga} 적절한 방법으로 관심을 요청하는 시도를 봅니다. 하루에 5번 중 2~3번 자발적으로 나오면 충분합니다. 처음부터 많이 기대하지 않으셔도 됩니다.',
    materials:
      '특별한 준비물은 없습니다. 다만 어머님이 잠깐 손을 멈추고 반응해 주실 수 있는 5분이 필요합니다.\n\n{name}가 좋아하는 활동이나 장난감 하나.',
    practice:
      '1단계 (1분) - {name_ga} 적절하지 않은 방법으로 관심을 끌 때는 잠시 반응을 미루세요. 혼내지 않으셔도 됩니다.\n\n2단계 (2분) - {name_ga} 어머님을 부르거나 손을 끌거나, 더 나은 방법을 보이면 그때 바로 눈을 맞추고 반응해 주세요.\n\n3단계 (2분) - 적절한 요청이 나온 직후에 충분히 관심을 주세요. 무엇 때문에 반응해 주는지 {name_ga} 느끼게 하는 게 중요합니다.',
    waiting:
      '{name_ga} 소리를 지르거나 떼를 쓸 때, 바로 달래주고 싶을 수 있습니다. 그럴 때는 잠깐 멈추고 더 나은 방법이 나오는지 기다려 주세요. 여기서 바로 반응하시면 그 방법이 굳어집니다.',
    reinforcement:
      '{name_ga} 어머님을 적절히 부르면 → "불렀구나" 하고 바로 봐주세요.\n\n손을 끌거나 가리키면 → "이거 보여주고 싶었구나" 하고 같이 봐주세요.\n\n칭찬은 행동 직후 바로. 늦으면 무엇 때문인지 모릅니다.',
    weekly_focus: '{name_ga} 적절한 방법으로 관심을 요청한 횟수',
    next_priority:
      '이번 주가 관심끌기 쪽이었다면, 다음 주는 같은 행동이 다른 상황에서도 나오는지 봐주세요. 특정 사람 앞에서만 유독 자주 일어난다면 다른 이야기일 수 있습니다.',
  },
  escape: {
    function_analysis:
      '{name_ga} {topic} 상황에서 보이는 행동은 그 과제나 상황이 불편해서일 가능성이 큽니다. "싫다", "그만"을 말할 다른 방법을 아직 못 배운 거라, 그걸 같이 가르치는 게 이번 주 방향입니다.',
    goal:
      '{topic} 과제를 아주 작게 나눠서, {name_ga} 한 부분이라도 끝내는 것을 봅니다. 5회 중 2회 정도 끝까지 가면 충분합니다. 양보다 "끝냈다"는 경험이 중요합니다.',
    materials:
      '{topic}와 관련된 과제를 평소보다 짧게 나눈 것.\n\n"그만" 또는 "쉬고 싶어요"를 표현할 카드나 몸짓 하나.',
    practice:
      '1단계 (1분) - 과제를 평소의 절반, 혹은 그보다 더 작게 줄여서 시작하세요. 처음엔 쉬워도 됩니다.\n\n2단계 (2분) - {name_ga} 힘들어하면 도망가기 전에 "그만" 카드를 짚게 도와주세요. 표현으로 쉬는 경험을 만들어 줍니다.\n\n3단계 (2분) - 작은 부분이라도 끝내면 바로 쉬게 해주세요. 끝냈더니 쉴 수 있었다, 이 연결이 핵심입니다.',
    waiting:
      '{name_ga} 과제 앞에서 멈춰 있을 때, 빨리 시키고 싶을 수 있습니다. 그럴 때는 속으로 다섯을 세어 주세요. 그 5초 동안 {name_neun} 할지 말지 고민하는 중입니다.',
    reinforcement:
      '작은 부분이라도 끝내면 → "끝냈네" 하고 바로 쉬게 해주세요.\n\n"그만"을 표현으로 알리면 → 그 자리에서 바로 멈춰 주세요. 표현이 통한다는 걸 알려주는 겁니다.\n\n도망가서 쉬는 것과, 표현해서 쉬는 것을 구분해 주세요.',
    weekly_focus: '{name_ga} 도망가지 않고 과제를 한 부분이라도 끝낸 횟수',
    next_priority:
      '이번 주가 회피 쪽이었다면, 다음 주는 같은 행동이 관심끌기로 보이는 때가 있는지 봐주세요. 사람이 봐줄 때 유독 자주 일어난다면 기능이 다를 수 있습니다.',
  },
  tangible: {
    function_analysis:
      '{name_ga} {topic} 상황에서 보이는 행동은 원하는 물건이나 활동을 얻으려는 것일 가능성이 큽니다. 원하는 걸 말로 또는 카드로 요청하는 방법을 가르치면, 떼쓰기 대신 요청이 자리잡습니다.',
    goal:
      '{topic}와 관련해 {name_ga} 원하는 것을 적절한 방법(말·카드·몸짓)으로 요청하는 것을 봅니다. 5회 중 3회 정도 나오면 충분합니다.',
    materials:
      '{name}가 지금 가장 원하는 물건이나 간식 하나.\n\n요청을 표현할 카드나 단어, 몸짓 하나.',
    practice:
      '1단계 (1분) - {name_ga} 원하는 물건을 보이는 곳에, 손이 바로 닿지는 않는 곳에 두세요.\n\n2단계 (2분) - {name_ga} 그걸 보면, 요청하는 방법(이름 말하기·카드 짚기·가리키기)을 손을 받쳐서 도와주세요.\n\n3단계 (2분) - 요청이 나오면 그 자리에서 바로 들어주세요. 요청하면 얻을 수 있다는 걸 빠르게 연결해 줍니다.',
    waiting:
      '{name_ga} 울거나 보채면 바로 주고 싶을 수 있습니다. 그럴 때는 잠깐 기다리고, 더 나은 요청 방법이 나오는지 보세요. 보채서 얻는 경험이 쌓이면 그 방법이 굳어집니다.',
    reinforcement:
      '카드를 짚거나 이름을 말하면 → 그 자리에서 바로 물건을 주세요.\n\n가리키기라도 하면 → "이거 줄까" 하고 바로 들어주세요.\n\n"잘했어"보다 원하는 걸 바로 주는 것이 더 정확한 보상입니다.',
    weekly_focus: '{name_ga} 적절한 방법으로 요청한 횟수',
    next_priority:
      '이번 주가 요구 쪽이었다면, 다음 주는 요청 방법을 한 단계 늘려 보세요. 가리키기가 되면 단어로, 단어가 되면 짧은 문장으로. 한 번에 하나씩만 늘립니다.',
  },
  sensory: {
    function_analysis:
      '{name_ga} {topic} 상황에서 보이는 행동은 특정 감각이 즐겁거나 안정되어 스스로 반복하는 것일 수 있습니다. 이런 경우는 무작정 막기보다, 비슷한 감각을 주는 다른 활동을 같이 찾아보는 쪽으로 살펴보겠습니다.',
    goal:
      '{topic}와 관련해 {name_ga} 대체 감각 활동에 참여하는 시간을 조금씩 봅니다. 하루 5분 안에서 한두 번이라도 참여하면 충분합니다.',
    materials:
      '{name}가 좋아하는 감각과 비슷한 활동거리 하나(예: 촉감 장난감, 흔들기, 누르기 등).\n\n조용하고 자극이 적은 공간.',
    practice:
      '1단계 (1분) - {name_ga} 반복 행동을 보일 때, 비슷한 감각을 주는 대체 활동을 옆에 놓아두세요.\n\n2단계 (2분) - 그 활동을 같이 해보세요. 억지로 멈추게 하기보다 자연스럽게 옮겨가는 게 좋습니다.\n\n3단계 (2분) - 대체 활동에 참여하면 그 시간을 충분히 누리게 해주세요. 환경에서 자극 요소를 조금 줄여주셔도 됩니다.',
    waiting:
      '{name_ga} 반복 행동을 할 때 바로 멈추게 하고 싶을 수 있습니다. 그럴 때는 잠깐 지켜보고, 대체 활동으로 자연스럽게 유도해 주세요. 갑자기 막으면 더 강해지는 경우가 많습니다.',
    reinforcement:
      '대체 활동에 참여하면 → 그 활동을 더 즐기게 해주세요.\n\n스스로 옮겨가면 → "이것도 재밌네" 하고 같이 해주세요.\n\n반복 행동 자체를 혼내기보다, 대체 활동 쪽을 즐겁게 만들어 주는 게 핵심입니다.',
    weekly_focus: '{name_ga} 대체 감각 활동에 참여한 횟수',
    next_priority:
      '이번 주가 자기자극 쪽이었다면, 다음 주는 그 행동이 주로 언제 늘어나는지 봐주세요. 피곤할 때나 자극이 많을 때 늘어난다면 환경 쪽을 먼저 살펴보는 게 좋습니다.',
  },
  other: {
    function_analysis:
      '{name_ga} {topic} 상황에서 보이는 행동은 한 가지 기능으로 딱 떨어지지 않거나, 상황마다 이유가 달라 보일 수 있습니다. 이런 경우는 단정하지 않고, 언제·어떤 상황에서 행동이 나오는지 관찰부터 시작하는 게 정확합니다.',
    goal:
      '{topic}와 관련해 행동이 나오는 상황을 적어보는 것이 이번 주 목표입니다. 정해진 횟수보다, 어떤 때 행동이 나오는지 기록이 쌓이는 게 중요합니다.',
    materials:
      '간단히 적을 수 있는 메모지나 휴대폰 메모.\n\n언제(A) - 무슨 행동(B) - 그 다음 어떻게 됐는지(C)를 적을 칸.',
    practice:
      '1단계 (1분) - 행동이 나오기 직전에 무슨 일이 있었는지 적어두세요(A, 선행 상황).\n\n2단계 (2분) - 어떤 행동이 나왔는지 짧게 적으세요(B, 행동).\n\n3단계 (2분) - 그 행동 다음에 어떻게 됐는지 적으세요(C, 결과). 이 세 가지가 모이면 이유가 보입니다.',
    waiting:
      '행동의 이유를 빨리 판단하고 싶을 수 있습니다. 그럴 때는 한 주만 관찰에 집중해 주세요. 며칠치 기록이 모이면 어머님 눈에도 패턴이 보이기 시작합니다.',
    reinforcement:
      '{name_ga} 적절한 행동을 보이면 → 그 자리에서 바로 반응해 주세요.\n\n기록을 남기신 것 자체가 이번 주의 가장 중요한 일입니다.\n\n패턴이 보이기 전까지는 섣불리 막거나 바꾸지 않으셔도 됩니다.',
    weekly_focus: '{name_ga} {topic} 행동을 보인 상황(언제·무엇 다음에)',
    next_priority:
      '이번 주에 모은 기록을 다음 센터 방문 때 같이 보겠습니다. 어떤 상황에서 자주 나오는지가 보이면, 거기에 맞춰 다음 주 방향을 정확히 잡을 수 있습니다.',
  },
};

// 템플릿 문자열의 {name}, {topic} 등을 실제 값으로 치환
function fillTemplate(str, vars) {
  if (!str) return '';
  return str
    .replace(/\{name_ga\}/g, vars.name_ga)
    .replace(/\{name_neun\}/g, vars.name_neun)
    .replace(/\{name\}/g, vars.name)
    .replace(/\{topic\}/g, vars.topic);
}

// 관리자(선생님)가 추가한 커스텀 템플릿 저장 키 (localStorage 폴백용)
const STORAGE_KEY_CUSTOM_TEMPLATES = 'gd_aba_custom_templates_v1';

// 커스텀 템플릿 메모리 캐시 (앱 시작 시 1회 로드 후 동기 접근)
let _customTemplatesCache = null;

// 캐시를 Supabase(또는 localStorage)에서 채운다. 앱 시작 시 호출.
async function refreshCustomTemplates() {
  if (supabaseConfigured()) {
    try {
      _customTemplatesCache = await dbGetCustomTemplates();
    } catch (e) {
      _customTemplatesCache = {};
    }
  } else {
    try {
      const raw = safeGetLS(STORAGE_KEY_CUSTOM_TEMPLATES);
      _customTemplatesCache = raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) {
      _customTemplatesCache = {};
    }
  }
  return _customTemplatesCache;
}

// 동기 접근: 캐시 반환 (가이드 생성 중 사용)
function loadCustomTemplates() {
  if (_customTemplatesCache) return _customTemplatesCache;
  // 캐시 미초기화 시 localStorage 폴백 시도
  try {
    const raw = safeGetLS(STORAGE_KEY_CUSTOM_TEMPLATES);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (e) { return {}; }
}

// 저장: 캐시 갱신 + Supabase/localStorage 기록
async function saveCustomTemplates(obj) {
  _customTemplatesCache = obj;
  if (supabaseConfigured()) {
    try { await dbSetCustomTemplates(obj); return true; }
    catch (e) { return false; }
  }
  try {
    safeSetLS(STORAGE_KEY_CUSTOM_TEMPLATES, JSON.stringify(obj));
    return true;
  } catch (e) { return false; }
}

const GUIDE_FIELDS = ['function_analysis', 'goal', 'materials', 'practice', 'waiting', 'reinforcement', 'weekly_focus', 'next_priority'];

// AI 없이 로컬 템플릿으로 가이드 본문(9필드) 생성
// domainId: 영역(없으면 주제에서 자동 판별)
function buildLocalGuide(topic, fn, childName, otherDetail, domainId) {
  const baseFn = GUIDE_TEMPLATES[fn.id] || GUIDE_TEMPLATES.other;
  const dom = domainId || detectDomain(topic);
  const domFields = DOMAIN_FIELDS[dom] || {};
  const custom = loadCustomTemplates();
  const customKey = `${fn.id}__${dom}`;
  const customTpl = custom[customKey] || {};

  const vars = {
    name: callNameOr(childName),
    name_ga: namePlusGa(childName),
    name_neun: namePlusNeun(childName),
    topic: topic,
  };

  // 도입부: 센터에서의 구체적 장면은 지어내지 않는다.
  const nm = callNameOr(childName);
  let intro = `어머님, 오늘 ${nm}가 센터에서 열심히 노력했습니다. `;
  intro += `이번 주는 ${topic}를 집에서도 같이 짧게 연습해 보시려고 합니다.`;

  // 우선순위: 커스텀 > 영역 > 기능
  const fields = {};
  GUIDE_FIELDS.forEach((k) => {
    const src = customTpl[k] || domFields[k] || baseFn[k] || '';
    fields[k] = fillTemplate(src, vars);
  });

  // 기타/복합이고 어머님이 상황을 적어주신 경우, 기능 분석 앞에 반영
  if (fn.id === 'other' && otherDetail) {
    fields.function_analysis =
      `어머님이 적어주신 상황(${otherDetail})을 먼저 살펴보겠습니다. ` + fields.function_analysis;
  }

  return { intro, ...fields, domainId: dom };
}

function extractJSON(text) {
  if (!text) return null;
  let cleaned = String(text).trim();

  // 1) 마크다운 코드블록 제거
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  // 2) 첫 { 위치 찾기
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return null;
  cleaned = cleaned.substring(firstBrace);

  // 3) 마지막 } 위치를 정확히 찾기 (중첩 고려)
  let depth = 0;
  let lastValidEnd = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { lastValidEnd = i; break; }
    }
  }

  // 정상적으로 닫힌 JSON이 있으면 사용
  if (lastValidEnd !== -1) {
    const jsonStr = cleaned.substring(0, lastValidEnd + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      try {
        return JSON.parse(jsonStr.replace(/[\u0000-\u001F]+/g, ' '));
      } catch (e2) {}
    }
  }

  // 4) JSON이 잘린 경우 복구 시도 (응답이 max_tokens로 잘림)
  //    마지막 완전한 "field": "value" 쌍까지만 살리고 닫기
  try {
    // 마지막 큰따옴표 짝이 맞는 위치 찾기
    let quoteCount = 0;
    let lastSafeEnd = -1;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '\\') { i++; continue; }
      if (cleaned[i] === '"') quoteCount++;
      // 짝수개의 따옴표 + 쉼표 또는 } 직전이면 안전 위치
      if (quoteCount % 2 === 0 && (cleaned[i] === ',' || cleaned[i] === '}')) {
        lastSafeEnd = i;
      }
    }
    if (lastSafeEnd > 0) {
      let salvage = cleaned.substring(0, lastSafeEnd);
      // 끝의 쉼표 제거
      salvage = salvage.replace(/,\s*$/, '');
      salvage += '}';
      const parsed = JSON.parse(salvage.replace(/[\u0000-\u001F]+/g, ' '));
      return parsed;
    }
  } catch (e) {}

  return null;
}

// ─────────────────────────────────────────────
// 사용자/세션 관리 유틸 (localStorage 임시 단계)
// 나중에 Supabase 연동 시 이 부분만 교체하면 됨
// ─────────────────────────────────────────────

function safeGetLS(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (e) { return null; }
}
function safeSetLS(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch (e) {}
}
function safeRemoveLS(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch (e) {}
}

// admin 기본 계정이 DB에 없으면 생성 (Supabase 모드)
async function ensureAdminDB() {
  try {
    const existing = await dbGetUser(DEFAULT_ADMIN.id);
    if (!existing) {
      await dbCreateUser({
        id: DEFAULT_ADMIN.id,
        name: DEFAULT_ADMIN.name,
        role: 'admin',
        password: DEFAULT_ADMIN.password,
      });
    }
  } catch (e) {
    // 네트워크 등 실패 시 조용히 무시 (로그인 시 다시 시도)
  }
}

// 사용자 목록 가져오기 (없으면 admin 기본 계정 생성)
async function loadUsers() {
  if (supabaseConfigured()) {
    await ensureAdminDB();
    try {
      const users = await dbListUsers();
      return users.map(u => ({
        id: u.id, name: u.name, role: u.role,
        createdAt: u.created_at ? new Date(u.created_at).getTime() : 0,
        is_active: u.is_active,
      }));
    } catch (e) {
      return [];
    }
  }
  // ── localStorage 폴백 ──
  const raw = safeGetLS(STORAGE_KEY_USERS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!parsed.find(u => u.id === DEFAULT_ADMIN.id)) {
          parsed.unshift({ ...DEFAULT_ADMIN, createdAt: Date.now() });
          safeSetLS(STORAGE_KEY_USERS, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {}
  }
  const initial = [{ ...DEFAULT_ADMIN, createdAt: Date.now() }];
  safeSetLS(STORAGE_KEY_USERS, JSON.stringify(initial));
  return initial;
}

function saveUsers(users) {
  // localStorage 폴백 전용 (Supabase 모드에서는 개별 DB 함수 사용)
  safeSetLS(STORAGE_KEY_USERS, JSON.stringify(users));
}

// 로그인: ID/비번 검증 후 세션 저장
async function authenticate(id, password) {
  const trimmedId = (id || '').trim();
  if (!trimmedId) return { ok: false, error: '아이디를 입력해주세요' };

  if (supabaseConfigured()) {
    await ensureAdminDB();
    let user;
    try {
      user = await dbGetUser(trimmedId);
    } catch (e) {
      return { ok: false, error: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' };
    }
    if (!user) return { ok: false, error: '존재하지 않는 아이디입니다' };
    if (user.is_active === false) return { ok: false, error: '비활성화된 계정입니다' };
    const ok = await verifyPassword(password, user.pw_salt, user.pw_hash);
    if (!ok) return { ok: false, error: '비밀번호가 일치하지 않습니다' };
    const session = { id: user.id, name: user.name, role: user.role, loginAt: Date.now() };
    safeSetLS(STORAGE_KEY_SESSION, JSON.stringify(session));
    return { ok: true, user: session };
  }

  // ── localStorage 폴백 (평문 비교) ──
  const users = await loadUsers();
  const user = users.find(u => u.id === trimmedId);
  if (!user) return { ok: false, error: '존재하지 않는 아이디입니다' };
  if (user.password !== password) return { ok: false, error: '비밀번호가 일치하지 않습니다' };
  const session = { id: user.id, name: user.name, role: user.role, loginAt: Date.now() };
  safeSetLS(STORAGE_KEY_SESSION, JSON.stringify(session));
  return { ok: true, user: session };
}

// 현재 세션 가져오기 (세션 자체는 기기 로컬에 보관 — 로그인 상태 유지용)
async function loadSession() {
  const raw = safeGetLS(STORAGE_KEY_SESSION);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session || !session.id) return null;
    // 계정이 여전히 존재하는지 확인
    if (supabaseConfigured()) {
      try {
        const u = await dbGetUser(session.id);
        if (!u || u.is_active === false) { safeRemoveLS(STORAGE_KEY_SESSION); return null; }
      } catch (e) {
        // 서버 확인 실패 시 일단 세션 유지 (오프라인 대비)
        return session;
      }
      return session;
    }
    const users = await loadUsers();
    const stillExists = users.find(u => u.id === session.id);
    if (!stillExists) { safeRemoveLS(STORAGE_KEY_SESSION); return null; }
    return session;
  } catch (e) {
    return null;
  }
}

function logout() {
  safeRemoveLS(STORAGE_KEY_SESSION);
}

// 선생님 계정 추가
async function createTeacher(id, name, password) {
  const tId = (id || '').trim();
  let tName = (name || '').trim();
  if (!tId) return { ok: false, error: '아이디를 입력해주세요' };
  if (!password || password.length < 4) return { ok: false, error: '비밀번호는 4자 이상' };
  // 아이디: 공백과 일부 특수문자만 금지 (한글/영문/숫자 허용)
  if (/[\s/\\'"]/.test(tId)) return { ok: false, error: '아이디에 공백이나 특수문자는 쓸 수 없습니다' };
  // 이름을 비우면 아이디를 이름으로 사용
  if (!tName) tName = tId;

  if (supabaseConfigured()) {
    try {
      const existing = await dbGetUser(tId);
      if (existing) return { ok: false, error: '이미 존재하는 아이디입니다' };
      const u = await dbCreateUser({ id: tId, name: tName, role: 'teacher', password });
      return { ok: true, user: u };
    } catch (e) {
      return { ok: false, error: e.message || '계정 생성 실패' };
    }
  }

  const users = await loadUsers();
  if (users.find(u => u.id === tId)) return { ok: false, error: '이미 존재하는 아이디입니다' };
  const newUser = { id: tId, name: tName, password, role: 'teacher', createdAt: Date.now() };
  users.push(newUser);
  saveUsers(users);
  return { ok: true, user: newUser };
}

// 선생님 삭제
async function deleteTeacher(userId) {
  if (userId === DEFAULT_ADMIN.id) return { ok: false, error: '관리자는 삭제할 수 없습니다' };
  if (supabaseConfigured()) {
    try {
      await dbDeleteUser(userId); // 가이드/즐겨찾기는 FK on delete cascade로 함께 삭제
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || '삭제 실패' };
    }
  }
  const users = (await loadUsers()).filter(u => u.id !== userId);
  saveUsers(users);
  safeRemoveLS(favoritesKey(userId));
  safeRemoveLS(historyKey(userId));
  return { ok: true };
}

// 비밀번호 변경
async function changePassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 4) return { ok: false, error: '비밀번호는 4자 이상' };
  if (supabaseConfigured()) {
    try {
      await dbUpdatePassword(userId, newPassword);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || '비밀번호 변경 실패' };
    }
  }
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return { ok: false, error: '사용자를 찾을 수 없습니다' };
  users[idx].password = newPassword;
  saveUsers(users);
  return { ok: true };
}

// 특정 사용자의 history 불러오기 (관리자가 다른 선생님 보관함 조회 시)
async function loadUserHistory(userId) {
  if (supabaseConfigured()) {
    try {
      const rows = await dbListGuides(userId);
      return rows.map(r => ({ ...r.payload, guide_id: r.guide_id, createdAt: r.created_at }));
    } catch (e) { return []; }
  }
  const raw = safeGetLS(historyKey(userId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 내용에 따라 높이 자동 조절되는 textarea (컴포넌트 외부에 정의 - 리렌더링 시 포커스 유지)
function AutoTextarea({ value, onChange, style, minRows = 2 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.max(ref.current.scrollHeight, minRows * 24) + 'px';
    }
  }, [value, minRows]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      style={{ ...style, overflow: 'hidden', resize: 'none' }}
    />
  );
}

// ───────────────────────────────────────
// 로그인 화면
// ───────────────────────────────────────
function LoginView({ onLogin }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // 첫 마운트 시 admin 자동 생성 보장
  useEffect(() => { loadUsers(); }, []);

  const submit = async () => {
    if (loading) return;
    setErr('');
    setLoading(true);
    try {
      const result = await authenticate(id, pw);
      if (!result.ok) {
        setErr(result.error);
        setLoading(false);
        return;
      }
      onLogin(result.user);
    } catch (e) {
      setErr('로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div style={loginStyles.container}>
      <div style={loginStyles.card}>
        <div style={loginStyles.brand}>
          <div style={loginStyles.brandName}>검단ABA언어행동연구소</div>
          <div style={loginStyles.brandSub}>ABA 기반 가정 연계 5분 가이드</div>
        </div>

        <div style={loginStyles.field}>
          <label style={loginStyles.label}>아이디</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="예: admin, kim, lee"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            name="gd-login-id"
            style={loginStyles.input}
          />
        </div>

        <div style={loginStyles.field}>
          <label style={loginStyles.label}>비밀번호</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="비밀번호"
            autoComplete="new-password"
            name="gd-login-pw"
            style={loginStyles.input}
          />
        </div>

        {err && <div style={loginStyles.error}>{err}</div>}

        <button onClick={submit} disabled={loading} style={loginStyles.submitBtn}>
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <div style={loginStyles.hint}>
          처음 사용하시면 원장님(관리자) 계정으로 로그인 후<br />
          관리자 페이지에서 선생님 계정을 추가해 주세요.<br />
          관리자 계정 정보는 원장님께 문의하세요.
        </div>

        <div style={loginStyles.copyright}>
          © 검단ABA 언어행동연구소 · 민다혜 (BCBA)<br />
          본 자료는 검단ABA언어행동연구소의 지적재산입니다.<br />
          무단 복제·배포·재판매·온라인 게시를 엄격히 금지합니다.
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// 가이드 템플릿 관리 (관리자)
// 기능 × 영역 조합별로 9개 필드 문구를 직접 편집·저장
// ───────────────────────────────────────
const TEMPLATE_FIELD_LABELS = [
  { key: 'function_analysis', label: '예상 기능 살펴보기' },
  { key: 'goal', label: '이번 주 목표' },
  { key: 'materials', label: '준비물' },
  { key: 'practice', label: '5분 실천법' },
  { key: 'waiting', label: '기다림의 포인트' },
  { key: 'reinforcement', label: '강화(칭찬) 타이밍' },
  { key: 'weekly_focus', label: '이번 주 집중 관찰' },
  { key: 'next_priority', label: '다음 주 우선순위' },
];

// 기능id+영역id 로 기본(빌트인) 문구를 계산: 영역 > 기능 순
function getBuiltinTemplate(fnId, domId) {
  const baseFn = GUIDE_TEMPLATES[fnId] || GUIDE_TEMPLATES.other;
  const domFields = DOMAIN_FIELDS[domId] || {};
  const out = {};
  TEMPLATE_FIELD_LABELS.forEach(({ key }) => {
    out[key] = domFields[key] || baseFn[key] || '';
  });
  return out;
}

function TemplateAdminView({ onClose, onLogout }) {
  const [fnId, setFnId] = useState(FUNCTIONS[0].id);
  const [domId, setDomId] = useState(DOMAINS[0].id);
  const [draft, setDraft] = useState({});
  const [custom, setCustom] = useState({});
  const [savedFlash, setSavedFlash] = useState(false);

  const keyOf = (f, d) => `${f}__${d}`;

  // 선택이 바뀌면 draft 를 (커스텀 있으면 커스텀, 없으면 빌트인)으로 채움
  useEffect(() => {
    (async () => {
      const all = await refreshCustomTemplates();
      setCustom(all || {});
    })();
  }, []);

  useEffect(() => {
    const k = keyOf(fnId, domId);
    const builtin = getBuiltinTemplate(fnId, domId);
    const saved = custom[k];
    const next = {};
    TEMPLATE_FIELD_LABELS.forEach(({ key }) => {
      next[key] = (saved && saved[key] != null) ? saved[key] : builtin[key];
    });
    setDraft(next);
  }, [fnId, domId, custom]);

  const isCustomized = !!custom[keyOf(fnId, domId)];

  const handleSave = async () => {
    const k = keyOf(fnId, domId);
    const next = { ...custom, [k]: { ...draft } };
    setCustom(next);
    await saveCustomTemplates(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleReset = async () => {
    const k = keyOf(fnId, domId);
    const next = { ...custom };
    delete next[k];
    setCustom(next);
    await saveCustomTemplates(next);
    // draft 는 useEffect 가 빌트인으로 다시 채움
  };

  const fnObj = FUNCTIONS.find(f => f.id === fnId);
  const domObj = DOMAINS.find(d => d.id === domId);
  const customizedCount = Object.keys(custom).length;

  return (
    <div style={loginStyles.container}>
      <div style={adminStyles.wrapper}>
        <div style={adminStyles.header}>
          <div>
            <div style={adminStyles.title}>가이드 템플릿 관리</div>
            <div style={adminStyles.subtitle}>
              기능 × 영역별 문구를 직접 수정 · 저장 {customizedCount > 0 ? `· 수정된 조합 ${customizedCount}개` : ''}
            </div>
          </div>
          <div style={adminStyles.headerActions}>
            <button onClick={onClose} style={adminStyles.backBtn}>← 관리자 페이지로</button>
            <button onClick={onLogout} style={adminStyles.logoutBtn}>로그아웃</button>
          </div>
        </div>

        <div style={adminStyles.section}>
          <div style={tplStyles.note}>
            아래에서 <strong>행동 기능</strong>과 <strong>연습 영역</strong>을 고른 뒤 문구를 수정하면, 그 조합으로 가이드를 만들 때 이 문구가 쓰입니다.
            <br />
            <code style={tplStyles.code}>{'{name}'}</code> 아이 이름, <code style={tplStyles.code}>{'{name_ga}'}</code> 이름+이/가, <code style={tplStyles.code}>{'{name_neun}'}</code> 이름+은/는, <code style={tplStyles.code}>{'{topic}'}</code> 주제 로 자동 치환됩니다.
          </div>

          <div style={tplStyles.selectRow}>
            <div style={tplStyles.selectGroup}>
              <label style={tplStyles.selectLabel}>행동 기능</label>
              <select value={fnId} onChange={(e) => setFnId(e.target.value)} style={styles.domainSelect}>
                {FUNCTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div style={tplStyles.selectGroup}>
              <label style={tplStyles.selectLabel}>연습 영역</label>
              <select value={domId} onChange={(e) => setDomId(e.target.value)} style={styles.domainSelect}>
                {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div style={tplStyles.statusRow}>
            <span style={tplStyles.comboTag}>{fnObj?.label} × {domObj?.label}</span>
            {isCustomized
              ? <span style={tplStyles.customBadge}>수정됨</span>
              : <span style={tplStyles.builtinBadge}>기본값</span>}
          </div>

          {TEMPLATE_FIELD_LABELS.map(({ key, label }) => (
            <div key={key} style={tplStyles.fieldBlock}>
              <label style={tplStyles.fieldLabel}>{label}</label>
              <AutoTextarea
                value={draft[key] || ''}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                style={tplStyles.fieldTextarea}
                minRows={2}
              />
            </div>
          ))}

          <div style={tplStyles.actionRow}>
            <button onClick={handleSave} style={tplStyles.saveBtn}>
              {savedFlash ? '저장되었습니다' : '이 조합 저장'}
            </button>
            {isCustomized && (
              <button onClick={handleReset} style={tplStyles.resetBtn}>기본값으로 되돌리기</button>
            )}
          </div>
        </div>

        <div style={loginStyles.copyright}>
          © 검단ABA 언어행동연구소 · 민다혜 (BCBA)
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// 관리자 페이지
// ───────────────────────────────────────
function AdminView({ currentUser, onClose, onLogout, onViewTeacherHistory }) {
  const [users, setUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPw, setNewPw] = useState('');
  const [addErr, setAddErr] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }
  const [pwChangeFor, setPwChangeFor] = useState(null); // userId
  const [newPwForReset, setNewPwForReset] = useState('');
  const [pwResetErr, setPwResetErr] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [historyCounts, setHistoryCounts] = useState({});

  const refresh = async () => {
    const list = await loadUsers();
    setUsers(list);
    const counts = {};
    await Promise.all(list.map(async (u) => {
      try { counts[u.id] = (await loadUserHistory(u.id)).length; }
      catch (e) { counts[u.id] = 0; }
    }));
    setHistoryCounts(counts);
  };
  useEffect(() => { refresh(); }, []);

  const handleAdd = async () => {
    setAddErr('');
    const result = await createTeacher(newId, newName, newPw);
    if (!result.ok) { setAddErr(result.error); return; }
    setNewId(''); setNewName(''); setNewPw('');
    setShowAddForm(false);
    await refresh();
  };

  const handleDelete = (user) => {
    setConfirmAction({
      message: `${user.name} (${user.id}) 선생님 계정과 보관함을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        await deleteTeacher(user.id);
        await refresh();
        setConfirmAction(null);
      },
    });
  };

  const handlePwReset = async () => {
    setPwResetErr('');
    const result = await changePassword(pwChangeFor, newPwForReset);
    if (!result.ok) { setPwResetErr(result.error); return; }
    setPwChangeFor(null);
    setNewPwForReset('');
    await refresh();
  };

  const teachers = users.filter(u => u.role !== 'admin');
  const admin = users.find(u => u.role === 'admin');

  // 각 선생님의 보관함 개수 (미리 로드된 상태 사용)
  const getHistoryCount = (userId) => historyCounts[userId] ?? 0;

  if (showTemplates) {
    return <TemplateAdminView onClose={() => setShowTemplates(false)} onLogout={onLogout} />;
  }

  return (
    <div style={loginStyles.container}>
      <div style={adminStyles.wrapper}>
        <div style={adminStyles.header}>
          <div>
            <div style={adminStyles.title}>관리자 페이지</div>
            <div style={adminStyles.subtitle}>선생님 계정 관리 · 보관함 조회</div>
          </div>
          <div style={adminStyles.headerActions}>
            <button onClick={() => setShowTemplates(true)} style={adminStyles.templateBtn}>가이드 템플릿 관리</button>
            <button onClick={onClose} style={adminStyles.backBtn}>← 가이드 작성으로</button>
            <button onClick={onLogout} style={adminStyles.logoutBtn}>로그아웃</button>
          </div>
        </div>

        {/* 관리자 본인 정보 */}
        {admin && (
          <div style={adminStyles.section}>
            <div style={adminStyles.sectionTitle}>관리자 계정</div>
            <div style={adminStyles.adminCard}>
              <div>
                <div style={adminStyles.userName}>{admin.name}</div>
                <div style={adminStyles.userId}>{admin.id}</div>
              </div>
              <button onClick={() => { setPwChangeFor(admin.id); setNewPwForReset(''); setPwResetErr(''); }} style={adminStyles.smallBtn}>
                비밀번호 변경
              </button>
            </div>
          </div>
        )}

        {/* 선생님 목록 */}
        <div style={adminStyles.section}>
          <div style={adminStyles.sectionHeader}>
            <div style={adminStyles.sectionTitle}>선생님 계정 ({teachers.length}명)</div>
            <button onClick={() => setShowAddForm(!showAddForm)} style={adminStyles.addBtn}>
              {showAddForm ? '취소' : '+ 선생님 추가'}
            </button>
          </div>

          {showAddForm && (
            <div style={adminStyles.addForm}>
              <div style={adminStyles.formRow}>
                <input
                  type="text"
                  placeholder="아이디 (예: 민다솔)"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  autoComplete="off"
                  name="gd-new-id"
                  style={adminStyles.formInput}
                />
                <input
                  type="text"
                  placeholder="이름 (선택, 비우면 아이디 사용)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoComplete="off"
                  name="gd-new-name"
                  style={adminStyles.formInput}
                />
                <input
                  type="text"
                  placeholder="비밀번호 (4자 이상)"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="off"
                  name="gd-new-pw"
                  style={adminStyles.formInput}
                />
              </div>
              {addErr && <div style={adminStyles.errorMsg}>{addErr}</div>}
              <button onClick={handleAdd} style={adminStyles.submitBtn}>계정 만들기</button>
            </div>
          )}

          {teachers.length === 0 ? (
            <div style={adminStyles.emptyMsg}>등록된 선생님이 없습니다. 위 버튼으로 추가해주세요.</div>
          ) : (
            <>
              <button
                onClick={() => onViewTeacherHistory('__ALL__')}
                style={adminStyles.unifiedBtn}
              >
                📂 전체 통합 보기 — 모든 선생님 가이드 한눈에
              </button>
              <div style={adminStyles.teacherList}>
              {teachers.map((t) => (
                <div key={t.id} style={adminStyles.teacherCard}>
                  <div style={adminStyles.teacherInfo}>
                    <div style={adminStyles.userName}>{t.name}</div>
                    <div style={adminStyles.userId}>아이디: {t.id} · 보관함 {getHistoryCount(t.id)}개</div>
                  </div>
                  <div style={adminStyles.teacherActions}>
                    <button onClick={() => onViewTeacherHistory(t.id)} style={adminStyles.smallBtn}>
                      보관함 보기
                    </button>
                    <button onClick={() => { setPwChangeFor(t.id); setNewPwForReset(''); setPwResetErr(''); }} style={adminStyles.smallBtn}>
                      비번 변경
                    </button>
                    <button onClick={() => handleDelete(t)} style={adminStyles.dangerBtn}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </div>

        {/* 비밀번호 변경 모달 */}
        {pwChangeFor && (
          <>
            <div onClick={() => setPwChangeFor(null)} style={adminStyles.modalOverlay} />
            <div style={adminStyles.modal}>
              <div style={adminStyles.modalTitle}>비밀번호 변경 ({pwChangeFor})</div>
              <input
                type="text"
                placeholder="새 비밀번호 (4자 이상)"
                value={newPwForReset}
                onChange={(e) => setNewPwForReset(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePwReset(); }}
                autoComplete="off"
                name="gd-reset-pw"
                style={adminStyles.modalInput}
                autoFocus
              />
              {pwResetErr && <div style={adminStyles.errorMsg}>{pwResetErr}</div>}
              <div style={adminStyles.modalActions}>
                <button onClick={() => setPwChangeFor(null)} style={adminStyles.cancelModalBtn}>취소</button>
                <button onClick={handlePwReset} style={adminStyles.submitBtn}>변경</button>
              </div>
            </div>
          </>
        )}

        {/* 삭제 확인 모달 */}
        {confirmAction && (
          <>
            <div onClick={() => setConfirmAction(null)} style={adminStyles.modalOverlay} />
            <div style={adminStyles.modal}>
              <div style={adminStyles.modalTitle}>확인</div>
              <div style={adminStyles.modalMessage}>{confirmAction.message}</div>
              <div style={adminStyles.modalActions}>
                <button onClick={() => setConfirmAction(null)} style={adminStyles.cancelModalBtn}>취소</button>
                <button onClick={confirmAction.onConfirm} style={adminStyles.deleteModalBtn}>삭제</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const loginStyles = {
  container: {
    minHeight: '100vh',
    background: '#fdf5f5',
    fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", -apple-system, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    color: '#3d2530',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: '#fff',
    borderRadius: '14px',
    padding: '32px 26px',
    border: '1px solid #f4d4dc',
    boxShadow: '0 8px 30px rgba(168, 73, 96, 0.08)',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1px solid #fae8ee',
  },
  brandName: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#3d2530',
    marginBottom: '4px',
  },
  brandSub: {
    fontSize: '12px',
    color: '#8a6571',
  },
  field: {
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#a84960',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #f4d4dc',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#3d2530',
    background: '#fff',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
  },
  error: {
    padding: '10px 12px',
    background: '#fbe8ec',
    color: '#a85a3e',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: '#e07187',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '6px',
  },
  hint: {
    marginTop: '18px',
    padding: '12px',
    background: '#fef7f9',
    borderRadius: '6px',
    fontSize: '11.5px',
    color: '#8a6571',
    lineHeight: 1.65,
    textAlign: 'center',
  },
  copyright: {
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px solid #fae8ee',
    fontSize: '10.5px',
    color: '#a89098',
    lineHeight: 1.7,
    textAlign: 'center',
  },
};

const adminStyles = {
  wrapper: {
    width: '100%',
    maxWidth: '880px',
    padding: '20px 16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    padding: '20px 22px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #f4d4dc',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#a84960',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8a6571',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  backBtn: {
    padding: '8px 14px',
    background: '#fce4ea',
    color: '#a84960',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  templateBtn: {
    padding: '8px 14px',
    background: '#a84960',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  logoutBtn: {
    padding: '8px 14px',
    background: '#fff',
    color: '#a85a3e',
    border: '1px solid #f4d4dc',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  section: {
    marginBottom: '20px',
    padding: '20px 22px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #f4d4dc',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#a84960',
  },
  addBtn: {
    padding: '8px 14px',
    background: '#e07187',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  addForm: {
    padding: '16px',
    background: '#fef7f9',
    borderRadius: '8px',
    marginBottom: '14px',
    border: '1px solid #fae8ee',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px',
    marginBottom: '10px',
  },
  formInput: {
    padding: '10px 12px',
    border: '1px solid #f4d4dc',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
  },
  submitBtn: {
    padding: '10px 18px',
    background: '#e07187',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  errorMsg: {
    padding: '8px 12px',
    background: '#fbe8ec',
    color: '#a85a3e',
    borderRadius: '6px',
    fontSize: '12px',
    marginBottom: '10px',
  },
  emptyMsg: {
    padding: '24px',
    textAlign: 'center',
    color: '#8a6571',
    fontSize: '13px',
    background: '#fef7f9',
    borderRadius: '8px',
  },
  adminCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    background: '#fce4ea',
    borderRadius: '8px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  teacherList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  teacherCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    background: '#fef7f9',
    borderRadius: '8px',
    border: '1px solid #fae8ee',
    flexWrap: 'wrap',
    gap: '10px',
  },
  teacherInfo: { flex: 1, minWidth: 0 },
  teacherActions: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#3d2530',
    marginBottom: '3px',
  },
  userId: {
    fontSize: '12px',
    color: '#8a6571',
  },
  smallBtn: {
    padding: '7px 12px',
    background: '#fff',
    color: '#a84960',
    border: '1px solid #f4d4dc',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  unifiedBtn: {
    width: '100%',
    padding: '14px',
    marginBottom: '12px',
    background: 'linear-gradient(135deg, #a84960, #d4728a)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dangerBtn: {
    padding: '7px 12px',
    background: '#fff',
    color: '#a85a3e',
    border: '1px solid #f0c8c0',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 200,
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'calc(100vw - 32px)',
    maxWidth: '360px',
    background: '#fff',
    borderRadius: '12px',
    padding: '22px',
    zIndex: 201,
    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#a84960',
    marginBottom: '12px',
  },
  modalMessage: {
    fontSize: '13px',
    color: '#3d2530',
    lineHeight: 1.7,
    marginBottom: '16px',
    whiteSpace: 'pre-line',
  },
  modalInput: {
    width: '100%',
    padding: '11px 13px',
    border: '1px solid #f4d4dc',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: '12px',
  },
  modalActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  cancelModalBtn: {
    padding: '10px 16px',
    background: '#fff',
    color: '#3d2530',
    border: '1px solid #f4d4dc',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  deleteModalBtn: {
    padding: '10px 16px',
    background: '#a85a3e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const tplStyles = {
  note: {
    fontSize: '12.5px',
    color: '#7a5560',
    lineHeight: 1.7,
    marginBottom: '16px',
    padding: '12px 14px',
    background: '#fdf3f6',
    borderRadius: '8px',
  },
  code: {
    background: '#fce4ea',
    color: '#a84960',
    padding: '1px 5px',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontFamily: 'monospace',
  },
  selectRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  selectGroup: {
    flex: '1 1 160px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  selectLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#a84960',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '18px',
  },
  comboTag: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#3a2e32',
  },
  customBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    background: '#a84960',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  builtinBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8a8a8a',
    background: '#eee',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  fieldBlock: {
    marginBottom: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '12.5px',
    fontWeight: 600,
    color: '#a84960',
  },
  fieldTextarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13.5px',
    border: '1px solid #f4d4dc',
    borderRadius: '8px',
    background: '#fff',
    color: '#3a2e32',
    fontFamily: 'inherit',
    lineHeight: 1.65,
    boxSizing: 'border-box',
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '18px',
    flexWrap: 'wrap',
  },
  saveBtn: {
    padding: '11px 20px',
    background: '#a84960',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resetBtn: {
    padding: '11px 18px',
    background: '#fff',
    color: '#a85a3e',
    border: '1px solid #f4d4dc',
    borderRadius: '8px',
    fontSize: '13.5px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function App() {
  // ── 인증 state ──
  const [session, setSession] = useState(null); // { id, name, role }
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [viewingTeacherId, setViewingTeacherId] = useState(null); // 관리자가 특정 선생님 보관함 조회 중

  const [topic, setTopic] = useState('');
  const [childName, setChildName] = useState('');
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('auto'); // 'auto' 또는 영역 id
  const [otherDetail, setOtherDetail] = useState('');
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState(DEFAULT_FAVORITES);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }
  const [historyFilter, setHistoryFilter] = useState(''); // 아동 이름 필터
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [checkTable, setCheckTable] = useState(
    Array(7).fill(null).map(() => ({ attempts: '', success: '' }))
  );
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // 첫 마운트: 세션 복원 + 커스텀 템플릿 캐시 로드
  useEffect(() => {
    (async () => {
      await refreshCustomTemplates();
      const s = await loadSession();
      if (s) setSession(s);
    })();
  }, []);

  // 세션이 바뀔 때마다 그 사용자의 favorites/history 로드
  // (관리자가 특정 선생님 보관함 보는 중이면 그쪽 데이터 로드)
  useEffect(() => {
    if (!session) {
      setFavorites(DEFAULT_FAVORITES);
      setHistory([]);
      return;
    }
    const dataUserId = viewingTeacherId || session.id;

    if (supabaseConfigured()) {
      let cancelled = false;
      (async () => {
        // 즐겨찾기는 항상 본인 것
        try {
          const favs = await dbGetFavorites(session.id);
          if (!cancelled) setFavorites(Array.isArray(favs) && favs.length ? favs : DEFAULT_FAVORITES);
        } catch (e) { if (!cancelled) setFavorites(DEFAULT_FAVORITES); }
        // 보관함: 통합('__ALL__')이면 전체, 아니면 해당 사용자
        try {
          const ownerArg = dataUserId === '__ALL__' ? null : dataUserId;
          const rows = await dbListGuides(ownerArg);
          const guides = rows.map(r => ({
            ...r.payload,
            guide_id: r.guide_id,
            owner_id: r.owner_id,
            createdAt: r.payload?.createdAt || r.created_at,
          }));
          if (!cancelled) setHistory(guides);
        } catch (e) { if (!cancelled) setHistory([]); }
      })();
      return () => { cancelled = true; };
    }

    // ── localStorage 폴백 ──
    try {
      const favRaw = safeGetLS(favoritesKey(session.id));
      if (favRaw) {
        try { setFavorites(JSON.parse(favRaw)); } catch (e) { setFavorites(DEFAULT_FAVORITES); }
      } else {
        const v2 = safeGetLS(STORAGE_KEY_FAVORITES_V2);
        if (v2 && session.id === DEFAULT_ADMIN.id) {
          safeSetLS(favoritesKey(session.id), v2);
          try { setFavorites(JSON.parse(v2)); } catch (e) { setFavorites(DEFAULT_FAVORITES); }
        } else {
          setFavorites(DEFAULT_FAVORITES);
        }
      }
      const histRaw = safeGetLS(historyKey(dataUserId));
      if (histRaw) {
        try { setHistory(JSON.parse(histRaw)); } catch (e) { setHistory([]); }
      } else {
        const v2 = safeGetLS(STORAGE_KEY_HISTORY_V2);
        if (v2 && dataUserId === DEFAULT_ADMIN.id) {
          safeSetLS(historyKey(dataUserId), v2);
          try { setHistory(JSON.parse(v2)); } catch (e) { setHistory([]); }
        } else {
          setHistory([]);
        }
      }
    } catch (e) {
      console.error('Storage load error:', e);
    }
  }, [session, viewingTeacherId]);

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 200);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  const saveFavorites = (next) => {
    setFavorites(next);
    if (!session) return;
    if (supabaseConfigured()) {
      dbSetFavorites(session.id, next).catch(() => {});
      return;
    }
    safeSetLS(favoritesKey(session.id), JSON.stringify(next));
  };

  const saveHistory = (next) => {
    setHistory(next);
    if (!session) return;
    if (supabaseConfigured()) return; // Supabase 모드: 개별 DB 함수로 처리(아래 호출부)
    const dataUserId = viewingTeacherId || session.id;
    safeSetLS(historyKey(dataUserId), JSON.stringify(next));
  };

  const addToFavorites = () => {
    const t = topic.trim();
    if (!t || favorites.includes(t)) return;
    saveFavorites([t, ...favorites].slice(0, 20));
  };

  const selectFavorite = (f) => {
    setTopic(f);
    setError('');
    try {
      if (inputRef.current && typeof inputRef.current.focus === 'function') {
        inputRef.current.focus();
      }
    } catch (e) {}
  };

  const removeFavorite = (item) => {
    saveFavorites(favorites.filter(f => f !== item));
  };

  const generateGuide = async (overrideTopic, overrideFunction) => {
    const t = (overrideTopic ?? topic).trim();
    const fn = overrideFunction ?? selectedFunction;
    if (!t) { setError('주제를 입력해주세요.'); return; }
    if (!fn) { setError('예상 행동 기능을 선택해주세요.'); return; }
    setTopic(t);
    setSelectedFunction(fn);
    setLoading(true);
    setError('');
    setGuide(null);
    setIsEditing(false);
    setEditDraft(null);

    try {
      const domId = (selectedDomain && selectedDomain !== 'auto') ? selectedDomain : detectDomain(t);
      const required = ['intro','goal','function_analysis','materials','practice','waiting','reinforcement','weekly_focus','next_priority'];

      // 항상 템플릿 결과를 먼저 준비 (AI 실패 시 폴백 + AI 누락 필드 보강)
      const fallback = buildLocalGuide(t, fn, childName.trim(), otherDetail.trim(), domId);

      let parsed = fallback;
      let usedAI = false;

      const endpoint = import.meta.env.VITE_AI_ENDPOINT;
      if (endpoint) {
        // AI 먼저 시도. 실패하면 조용히 템플릿으로 넘어간다.
        try {
          let userMessage = `오늘의 주제: ${t}\n행동 기능(function): ${fn.label} - ${fn.desc}`;
          if (childName.trim()) userMessage += `\n아동 이름: ${childName.trim()}`;
          if (fn.id === 'other' && otherDetail.trim()) userMessage += `\n어머님/치료사가 관찰한 상황: ${otherDetail.trim()}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: t, message: userMessage }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const text = (data && (data.text || (Array.isArray(data.content) ? data.content.map(b => b.text || '').join('') : ''))) || '';
            const aiParsed = extractJSON(text);
            if (aiParsed) {
              // AI가 채운 필드는 AI 것, 빠진 필드는 템플릿으로 보강
              const merged = { ...fallback };
              required.forEach((k) => { if (aiParsed[k]) merged[k] = aiParsed[k]; });
              parsed = merged;
              usedAI = true;
            }
          }
        } catch (aiErr) {
          // 네트워크/타임아웃/CORS 등 → 템플릿 폴백 유지
        }
      } else {
        // AI 미설정: 템플릿이 즉시 뜨면 어색하므로 짧은 지연만
        await new Promise((r) => setTimeout(r, 600));
      }

      const missing = required.filter(f => !parsed[f]);
      if (missing.length > 0) throw new Error('가이드 일부가 누락되었습니다.');

      const domObj = DOMAINS.find(d => d.id === (parsed.domainId || domId));
      const result = {
        topic: t,
        childName: childName.trim(),
        functionInfo: fn,
        domainId: parsed.domainId || domId,
        domainLabel: domObj ? domObj.label : '',
        generatedBy: usedAI ? 'ai' : 'template',
        otherDetail: fn.id === 'other' ? otherDetail.trim() : '',
        ...parsed,
        createdAt: new Date().toISOString(),
      };
      setGuide(result);
      setCheckTable(Array(7).fill(null).map(() => ({ attempts: '', success: '' })));

      if (supabaseConfigured() && session) {
        // 본인 소유로 DB 저장, guide_id 회수
        try {
          const inserted = await dbInsertGuide({
            ownerId: session.id,
            topic: t,
            childName: childName.trim(),
            payload: result,
          });
          if (inserted && inserted.guide_id) {
            result.guide_id = inserted.guide_id;
            result.owner_id = session.id;
          }
        } catch (e) { /* 저장 실패해도 화면 표시는 유지 */ }
        setGuide({ ...result });
        setHistory([result, ...history.filter(h => h.guide_id !== result.guide_id)].slice(0, 50));
      } else {
        const nextHistory = [result, ...history.filter(h => h.topic !== t || h.functionInfo?.id !== fn.id)].slice(0, 30);
        saveHistory(nextHistory);
      }

      // 결과 카드로 부드럽게 스크롤
      setTimeout(() => {
        const card = document.getElementById('printable-guide');
        if (card && typeof card.scrollIntoView === 'function') {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (e) {
      setError(e.message || '가이드 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const buildPlainText = (g) => {
    if (!g) return '';
    const titlePrefix = g.childName ? `${namePlusReul(g.childName)} 위한 ` : '';
    const lines = [
      `[${titlePrefix}집에서 하는 5분 ABA 가이드]`, ``,
      g.intro, ``,
      `■ 오늘의 주제: ${g.topic}`,
      `■ 예상 행동 기능: ${g.functionInfo?.label} (${g.functionInfo?.desc})`,
    ];
    if (g.otherDetail) {
      lines.push(`■ 관찰된 상황: ${g.otherDetail}`);
    }
    lines.push(
      ``,
      `▶ 예상 기능 살펴보기`, g.function_analysis, ``,
      `▶ 이번 주 목표`, g.goal, ``,
      `▶ 준비물`, g.materials, ``,
      `▶ 5분 실천법`, g.practice, ``,
      `▶ 기다림의 포인트`, g.waiting, ``,
      `▶ 강화(칭찬) 타이밍`, g.reinforcement, ``,
      `▶ 이번 주 집중 관찰`, g.weekly_focus, ``,
      `▶ 다음 주 우선순위`, g.next_priority, ``,
      `▶ 이번 주 체크표 (시도 / 성공)`,
      `월: ___ / ___    화: ___ / ___    수: ___ / ___`,
      `목: ___ / ___    금: ___ / ___    토: ___ / ___`,
      `일: ___ / ___`,
      ``,
      `※ 매일 저녁 그날의 시도/성공 횟수를 기록해 주세요.`,
      `다음 센터 방문 시 치료사가 확인하여 다음 단계 결정에 반영합니다.`,
      ``,
      `— 검단ABA언어행동연구소`,
    );
    return lines.join('\n');
  };

  const copyToClipboard = async () => {
    if (!guide) return;
    const text = buildPlainText(guide);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('복사되었습니다');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e2) {}
      document.body.removeChild(ta);
      setCopyStatus('복사되었습니다');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  const handlePrint = () => {
    if (!guide) return;

    // 가이드 내용을 깔끔한 HTML로 변환
    const escapeHtml = (str) => String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const formatMultiline = (text) => {
      return String(text || '')
        .split('\n\n')
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
    };

    const checkRows = WEEK_DAYS.map((day, i) => {
      const c = checkTable[i] || { attempts: '', success: '' };
      return `
        <td class="day-cell">
          <div class="day-label">${day}</div>
          <div class="day-data">
            <div><span class="data-label">시도</span> ${escapeHtml(c.attempts) || '___'}</div>
            <div><span class="data-label">성공</span> ${escapeHtml(c.success) || '___'}</div>
          </div>
        </td>
      `;
    }).join('');

    const otherDetailBlock = guide.otherDetail
      ? `<div class="other-detail"><strong>관찰된 상황</strong> ${escapeHtml(guide.otherDetail)}</div>`
      : '';

    // functionInfo가 없는 옛 데이터를 위한 안전한 기본값
    const fnInfo = guide.functionInfo || { label: '미지정', desc: '', color: '#e07187', id: 'none' };
    const fnBoxBlock = guide.functionInfo
      ? `<div class="fn-box">
          <span class="fn-label">예상 기능</span>
          <span class="fn-value">${escapeHtml(fnInfo.label)}</span>
        </div>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${guide.childName ? escapeHtml(namePlusReul(guide.childName)) + ' 위한 ' : ''}집에서 하는 5분 ABA 가이드 - ${escapeHtml(guide.topic)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  @media print {
    .print-controls { display: none !important; }
    body { padding: 0; }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  }
  body {
    font-family: "Noto Sans KR", "Apple SD Gothic Neo", -apple-system, sans-serif;
    color: #3d2530;
    background: #fff;
    margin: 0;
    padding: 24px;
    line-height: 1.7;
    font-size: 13.5px;
  }
  .header {
    text-align: center;
    padding-bottom: 16px;
    border-bottom: 1px solid #fae8ee;
    margin-bottom: 20px;
  }
  .header-logo {
    width: 220px;
    height: auto;
    margin: 0 auto 12px;
    display: block;
  }
  .title { font-size: 22px; font-weight: 700; color: #a84960; letter-spacing: -0.5px; }
  .brand { font-size: 12px; color: #8a6571; margin-top: 4px; }
  .intro {
    background: #fef7f9;
    padding: 14px 18px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .intro p { margin: 0 0 8px 0; }
  .intro p:last-child { margin-bottom: 0; }
  .topic-row {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  .topic-box, .fn-box {
    flex: 1;
    padding: 10px 14px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .topic-box { background: #fce4ea; }
  .fn-box { background: ${fnInfo.color}25; border: 2px solid ${fnInfo.color}; }
  .topic-label, .fn-label {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    background: #fff;
    border-radius: 4px;
    color: #a84960;
    white-space: nowrap;
  }
  .topic-value { font-size: 15px; font-weight: 700; color: #a84960; }
  .fn-value { font-size: 14px; font-weight: 700; color: ${fnInfo.color}; }
  .other-detail {
    padding: 10px 14px;
    background: #fff;
    border: 1px dashed #f0a4b5;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 14px;
  }
  .other-detail strong {
    background: #fce4ea;
    color: #a84960;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    margin-right: 8px;
  }
  .guide-rows {
    margin-bottom: 18px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #f4d4dc;
  }
  @media print {
    /* overflow: hidden은 페이지 분할을 차단함 → 인쇄 시 풀어줌 */
    /* 컨테이너 border/radius도 풀어서 행 단위 분할에 간섭 없도록 */
    .guide-rows {
      overflow: visible;
      border: none;
      border-radius: 0;
    }
    /* 행마다 좌우 테두리 부여 (컨테이너 border 대체) */
    .guide-row-item {
      border-left: 1px solid #f4d4dc;
      border-right: 1px solid #f4d4dc;
      border-bottom: 1px solid #f4d4dc !important;
    }
    .guide-row-item:first-child {
      border-top: 1px solid #f4d4dc;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }
    .guide-row-item:last-child {
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
    }
  }
  .guide-row-item {
    display: flex;
    border-bottom: 1px solid #fae8ee;
    background: #fff;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .guide-row-item:last-child { border-bottom: none; }
  .guide-row-item .label-cell {
    width: 130px;
    min-width: 130px;
    padding: 12px 14px;
    background: #fef7f9;
    font-weight: 700;
    color: #a84960;
    font-size: 13px;
    border-right: 1px solid #fae8ee;
    word-break: keep-all;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .guide-row-item .label-cell.highlight { background: #fce4ea; }
  .guide-row-item .content-cell {
    padding: 12px 16px;
    font-size: 13px;
    flex: 1;
  }
  .guide-row-item .content-cell p { margin: 0 0 8px 0; }
  .guide-row-item .content-cell p:last-child { margin: 0; }
  .check-section {
    background: #fef7f9;
    border: 1px solid #f4d4dc;
    border-radius: 10px;
    padding: 16px 18px;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .check-title { font-size: 14px; font-weight: 700; color: #a84960; margin-bottom: 4px; }
  .check-subtitle { font-size: 12px; color: #8a6571; margin-bottom: 12px; }
  table.check-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 10px;
  }
  table.check-table .day-cell {
    border: 1px solid #fae8ee;
    text-align: center;
    padding: 8px 4px;
    vertical-align: top;
    width: 14.28%;
  }
  .day-label {
    font-weight: 700;
    color: #a84960;
    font-size: 13px;
    padding-bottom: 6px;
    border-bottom: 1px solid #fae8ee;
    margin-bottom: 6px;
  }
  .day-data { font-size: 12px; line-height: 1.8; }
  .day-data .data-label { color: #c89aa6; margin-right: 4px; font-size: 11px; }
  .check-note {
    font-size: 11px;
    color: #8a6571;
    padding: 8px 12px;
    background: #fff;
    border: 1px dashed #f4d4dc;
    border-radius: 6px;
    line-height: 1.5;
  }
  .footer {
    display: flex;
    justify-content: center;
    text-align: center;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #fae8ee;
    font-size: 10.5px;
    color: #8a6571;
  }
  .print-controls {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 1000;
  }
  .print-controls button {
    padding: 10px 18px;
    background: #e07187;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .print-controls button.secondary {
    background: #fff;
    color: #a84960;
    border: 1px solid #f0a4b5;
  }
</style>
</head>
<body>
  <div class="print-controls">
    <button onclick="window.print()">인쇄 / PDF 저장</button>
    <button class="secondary" onclick="window.close()">닫기</button>
  </div>

  <div class="header">
    <img class="header-logo" src="${LOGO_DATA_URI}" alt="검단ABA 로고" />
    <div class="title">${guide.childName ? escapeHtml(namePlusReul(guide.childName)) + ' 위한 ' : ''}집에서 하는 5분 ABA 가이드</div>
  </div>

  <div class="intro">${formatMultiline(guide.intro)}</div>

  <div class="topic-row">
    <div class="topic-box">
      <span class="topic-label">오늘의 주제</span>
      <span class="topic-value">${escapeHtml(guide.topic)}</span>
    </div>
    ${fnBoxBlock}
  </div>

  ${otherDetailBlock}

  <div class="guide-rows">
    <div class="guide-row-item">
      <div class="label-cell highlight">예상 기능 살펴보기</div>
      <div class="content-cell">${formatMultiline(guide.function_analysis)}</div>
    </div>
    <div class="guide-row-item">
      <div class="label-cell">이번 주 목표</div>
      <div class="content-cell">${formatMultiline(guide.goal)}</div>
    </div>
    <div class="guide-row-item">
      <div class="label-cell">준비물</div>
      <div class="content-cell">${formatMultiline(guide.materials)}</div>
    </div>
    <div class="guide-row-item">
      <div class="label-cell">5분 실천법</div>
      <div class="content-cell">${formatMultiline(guide.practice)}</div>
    </div>
    <div class="guide-row-item">
      <div class="label-cell">기다림의 포인트</div>
      <div class="content-cell">${formatMultiline(guide.waiting)}</div>
    </div>
    <div class="guide-row-item">
      <div class="label-cell">강화(칭찬) 타이밍</div>
      <div class="content-cell">${formatMultiline(guide.reinforcement)}</div>
    </div>
    <div class="guide-row-item">
      <div class="label-cell" style="background:#fce4ea;">다음 주 우선순위</div>
      <div class="content-cell">${formatMultiline(guide.next_priority)}</div>
    </div>
  </div>

  <div class="check-section">
    <div class="check-title">이번 주 체크표</div>
    <div class="check-subtitle">${escapeHtml(guide.weekly_focus)}</div>
    <table class="check-table">
      <tr>${checkRows}</tr>
    </table>
    <div class="check-note">
      ※ 매일 저녁, 그날의 시도/성공 횟수를 기록해 주세요. 다음 센터 방문 시 치료사가 확인하여 다음 단계 결정에 반영합니다.
    </div>
  </div>

  <div class="footer">
    <span>© 검단ABA언어행동연구소 · 민다혜 (BCBA) · 본 자료의 무단 복제 및 배포를 금합니다.</span>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) {
      // 팝업 차단된 경우: Blob URL로 새 탭 열기
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setCopyStatus('새 탭에서 인쇄해 주세요');
        setTimeout(() => setCopyStatus(''), 3000);
      } catch (e) {
        setError('새 창 열기가 차단되었습니다. 브라우저 팝업 차단을 해제해 주세요.');
      }
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const loadFromHistory = (item) => {
    setTopic(item.topic);
    setChildName(item.childName || '');
    setSelectedFunction(item.functionInfo);
    setOtherDetail(item.otherDetail || '');
    setGuide(item);
    setShowHistory(false);
    setIsEditing(false);
    setEditDraft(null);
    // 결과 카드로 자동 스크롤
    setTimeout(() => {
      const card = document.getElementById('printable-guide');
      if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const startEditing = () => {
    if (!guide) return;
    setEditDraft({
      childName: guide.childName || '',
      topic: guide.topic || '',
      intro: guide.intro || '',
      function_analysis: guide.function_analysis || '',
      goal: guide.goal || '',
      materials: guide.materials || '',
      practice: guide.practice || '',
      waiting: guide.waiting || '',
      reinforcement: guide.reinforcement || '',
      weekly_focus: guide.weekly_focus || '',
      next_priority: guide.next_priority || '',
    });
    setIsEditing(true);
    setShowHistory(false);
    // 가이드 카드 상단으로 스크롤
    setTimeout(() => {
      const card = document.getElementById('printable-guide');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditDraft(null);
  };

  const saveEditing = async () => {
    if (!guide || !editDraft) return;
    const updated = {
      ...guide,
      ...editDraft,
      editedAt: new Date().toISOString(),
    };
    setGuide(updated);

    if (supabaseConfigured() && guide.guide_id) {
      try {
        await dbUpdateGuide(guide.guide_id, updated, updated.topic, updated.childName);
      } catch (e) { /* 실패해도 화면은 갱신 */ }
      setHistory(history.map(h => (h.guide_id === guide.guide_id ? updated : h)));
    } else {
      // 보관함의 같은 항목 (createdAt 기준)을 업데이트
      const nextHistory = history.map(h =>
        h.createdAt === guide.createdAt ? updated : h
      );
      saveHistory(nextHistory);
    }
    setIsEditing(false);
    setEditDraft(null);
    setCopyStatus('수정 사항이 저장되었습니다');
    setTimeout(() => setCopyStatus(''), 2500);
  };

  const updateDraft = (field, value) => {
    setEditDraft(prev => ({ ...prev, [field]: value }));
  };

  const removeHistoryItem = (item) => {
    // item: 가이드 객체(또는 하위호환용 createdAt 문자열)
    const target = typeof item === 'string' ? history.find(h => h.createdAt === item) : item;
    if (!target) return;
    setConfirmAction({
      message: '이 가이드를 보관함에서 삭제하시겠습니까?',
      onConfirm: async () => {
        if (supabaseConfigured() && target.guide_id) {
          try { await dbDeleteGuide(target.guide_id); } catch (e) {}
        }
        const nextHistory = target.guide_id
          ? history.filter(h => h.guide_id !== target.guide_id)
          : history.filter(h => h.createdAt !== target.createdAt);
        saveHistory(nextHistory);

        if (historyFilter) {
          const stillHasFilter = nextHistory.some(h => {
            const key = h.childName?.trim() || '__none__';
            return key === historyFilter;
          });
          if (!stillHasFilter) setHistoryFilter('');
        }
        setConfirmAction(null);
      },
    });
  };

  const clearAllHistory = () => {
    if (history.length === 0) return;
    const isViewingOther = !!viewingTeacherId;
    const msg = isViewingOther
      ? `⚠ ${viewingTeacherId} 선생님의 보관함 가이드 ${history.length}개를 모두 삭제합니다.\n이 동작은 되돌릴 수 없습니다.`
      : `보관함의 모든 가이드 ${history.length}개를 삭제하시겠습니까?\n이 동작은 되돌릴 수 없습니다.`;
    setConfirmAction({
      message: msg,
      onConfirm: async () => {
        if (supabaseConfigured()) {
          // 현재 보고 있는 보관함의 가이드들을 DB에서 삭제
          const toDelete = history.filter(h => h.guide_id).map(h => h.guide_id);
          for (const gid of toDelete) {
            try { await dbDeleteGuide(gid); } catch (e) {}
          }
        }
        saveHistory([]);
        setHistoryFilter('');
        setConfirmAction(null);
      },
    });
  };

  const updateCheck = (idx, field, value) => {
    const next = [...checkTable];
    next[idx] = { ...next[idx], [field]: value };
    setCheckTable(next);
  };

  const renderMultiline = (text) => {
    if (!text) return null;
    return String(text).split('\n\n').map((para, i) => (
      <p key={i} style={{ margin: '0 0 12px 0', lineHeight: 1.75 }}>
        {para.split('\n').map((line, j, arr) => (
          <React.Fragment key={j}>
            {line}{j < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    ));
  };

  const currentStage = (() => {
    let stage = LOADING_STAGES[0];
    for (const s of LOADING_STAGES) if (elapsed >= s.at) stage = s;
    return stage;
  })();

  // ── 인증 핸들러 ──
  const handleLogout = () => {
    logout();
    setSession(null);
    setShowAdminPage(false);
    setViewingTeacherId(null);
    setGuide(null);
    setTopic('');
    setChildName('');
    setSelectedFunction(null);
    setOtherDetail('');
  };

  // 로그인 안 됐으면 로그인 화면만 보여줌
  if (!session) {
    return <LoginView onLogin={(s) => setSession(s)} />;
  }

  // 관리자가 관리자 페이지 보고 있으면 관리자 페이지만
  if (showAdminPage && session.role === 'admin') {
    return (
      <AdminView
        currentUser={session}
        onClose={() => setShowAdminPage(false)}
        onLogout={handleLogout}
        onViewTeacherHistory={(teacherId) => {
          setViewingTeacherId(teacherId);
          setShowAdminPage(false);
          setShowHistory(true);
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          body * { visibility: hidden; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          #printable-guide, #printable-guide * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          #printable-guide { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
          .guide-card { box-shadow: none !important; border: 1px solid #f4d4dc !important; }
          .guide-row, .check-table-print { page-break-inside: avoid; }
          .check-input { border: 1px solid #f4d4dc !important; background: #fff !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeInModal { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        .spinner { animation: spin 1.2s linear infinite; }
        .pulse-dot { animation: pulse 1.4s ease-in-out infinite; }
        .stage-text { animation: fadeIn 0.4s ease-out; }
        input:focus, button:focus, textarea:focus { outline: 2px solid #c9a987; outline-offset: 2px; }
        .fn-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(139,111,71,0.12); }
        .fav-chip-btn:hover:not(:disabled) { background: #e8d9c5 !important; border-color: #8b6f47 !important; }
        .fav-chip-btn:active:not(:disabled) { transform: scale(0.96); }
        button[aria-label="삭제"]:hover { background: #fbecec !important; color: #a85a3e !important; border-color: #f0c8c0 !important; }
        button[style*="14px"][style*="cursor: pointer"]:active { transform: scale(0.96); }

        /* ── 태블릿 (max-width: 1024px) ── */
        @media (max-width: 1024px) {
          .app-fn-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }

        /* ── 모바일/소형 태블릿 (max-width: 768px) ── */
        @media (max-width: 768px) {
          .app-header-inner { padding: 12px 14px !important; flex-wrap: wrap !important; gap: 10px !important; }
          .app-header-logo { width: 40px !important; height: 40px !important; }
          .app-brand-name { font-size: 15px !important; }
          .app-brand-sub { font-size: 11px !important; }
          .app-history-btn,
          .app-manual-btn,
          .app-admin-btn,
          .app-logout-btn { padding: 8px 12px !important; font-size: 12px !important; }
          .app-user-badge { padding: 5px 10px !important; font-size: 11px !important; }

          .app-controls { padding: 16px !important; margin: 12px 12px 0 12px !important; }

          .app-fn-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .fn-card { padding: 14px 10px !important; min-height: 64px !important; }

          .app-action-row { padding: 0 12px !important; flex-wrap: wrap !important; gap: 8px !important; }
          .app-action-btn { padding: 10px 14px !important; font-size: 13px !important; flex: 1 1 auto !important; min-height: 44px !important; }

          .app-guide-card { margin: 14px 12px !important; padding: 18px 16px !important; }
          .app-guide-header { gap: 10px !important; padding-bottom: 14px !important; margin-bottom: 14px !important; }
          .app-guide-logo { width: 70px !important; }
          .app-guide-title { font-size: 16px !important; line-height: 1.45 !important; }

          /* 가이드 표: 라벨/내용을 위아래로 쌓기 */
          .app-guide-row { flex-direction: column !important; }
          .app-row-label {
            width: 100% !important;
            min-width: 0 !important;
            padding: 10px 14px !important;
            font-size: 13px !important;
            border-right: none !important;
            border-bottom: 1px solid #fae8ee !important;
          }
          .app-row-content { padding: 12px 14px !important; font-size: 13.5px !important; }

          /* 체크표: 가로 스크롤 허용 */
          .app-check-section { padding: 14px !important; }
          .app-check-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
          .app-check-table { min-width: 520px !important; }

          /* 드로어: 전체 폭 */
          .app-drawer-panel { width: 100% !important; max-width: 100% !important; }

          /* 모달: 화면 폭에 맞춤 */
          .app-confirm-modal { width: calc(100vw - 32px) !important; max-width: 360px !important; }
        }

        /* ── 좁은 모바일 (max-width: 480px) ── */
        @media (max-width: 480px) {
          .app-fn-grid { grid-template-columns: 1fr 1fr !important; }
          .app-action-row { flex-direction: column !important; }
          .app-action-btn { width: 100% !important; flex: none !important; }
          .app-guide-title { font-size: 15px !important; }
          .app-brand-name { font-size: 14px !important; }
        }
      `}</style>

      <div className="no-print app-header" style={styles.header}>
        <div style={styles.headerInner} className="app-header-inner">
          <div style={styles.headerLeft} className="app-header-left">
            <img src={LOGO_DATA_URI} alt="검단ABA 로고" style={styles.headerLogo} className="app-header-logo" />
            <div>
              <div style={styles.brandName} className="app-brand-name">검단ABA언어행동연구소</div>
              <div style={styles.brandSub} className="app-brand-sub">ABA 기반 가정 연계 5분 가이드</div>
            </div>
          </div>
          <div className="app-header-actions" style={styles.headerActions}>
            {/* 로그인된 사용자 표시 */}
            <div style={styles.userBadge} className="app-user-badge">
              <span style={styles.userBadgeName}>{session.name}</span>
              <span style={styles.userBadgeRole}>
                {session.role === 'admin' ? '관리자' : '선생님'}
              </span>
            </div>

            {/* 관리자 전용: 관리자 페이지 진입 */}
            {session.role === 'admin' && (
              <button
                onClick={() => setShowAdminPage(true)}
                className="app-admin-btn"
                style={{
                  ...styles.historyBtn,
                  background: '#fff',
                  color: COLORS.primaryDark,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                계정 관리
              </button>
            )}

            {/* 관리자가 특정 선생님 보관함 보고 있을 때 표시 */}
            {viewingTeacherId && (
              <button
                onClick={() => setViewingTeacherId(null)}
                style={{
                  ...styles.historyBtn,
                  background: COLORS.accentLight,
                  color: COLORS.primaryDark,
                  border: `1px solid ${COLORS.primary}`,
                }}
              >
                ← 내 보관함으로
              </button>
            )}

            <button
              onClick={() => setShowManual(true)}
              className="app-manual-btn"
              style={{
                ...styles.historyBtn,
                background: '#fff',
                color: COLORS.primaryDark,
                border: `1px solid ${COLORS.border}`,
              }}
              aria-label="사용 설명서 열기"
            >
              사용 설명서
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="app-history-btn"
              style={{
                ...styles.historyBtn,
                background: showHistory ? COLORS.primary : COLORS.accentLight,
                color: showHistory ? '#fff' : COLORS.primaryDark,
              }}
            >
              보관함 ({history.length})
            </button>
            <button
              onClick={handleLogout}
              className="app-logout-btn"
              style={{
                ...styles.historyBtn,
                background: '#fff',
                color: COLORS.error,
                border: `1px solid ${COLORS.border}`,
              }}
              aria-label="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 관리자가 선생님 보관함 조회 중일 때 안내 배너 */}
      {viewingTeacherId && (
        <div className="no-print" style={styles.viewingBanner}>
          <span style={styles.viewingBannerIcon}>{viewingTeacherId === '__ALL__' ? '📂' : '👁'}</span>
          <div style={{ flex: 1 }}>
            {viewingTeacherId === '__ALL__' ? (
              <>
                <strong>전체 통합 보기 — 모든 선생님의 가이드를 조회 중입니다.</strong>
                <div style={styles.viewingBannerSub}>
                  아래 보관함에 모든 선생님이 만든 가이드가 함께 표시됩니다.
                  본인 화면으로 돌아가려면 헤더의 '내 보관함으로'를 누르세요.
                </div>
              </>
            ) : (
              <>
                <strong>{viewingTeacherId} 선생님의 보관함을 조회 중입니다.</strong>
                <div style={styles.viewingBannerSub}>
                  여기서 만드는 새 가이드는 이 선생님 보관함에 저장됩니다.
                  본인 보관함으로 돌아가려면 헤더의 '내 보관함으로'를 누르세요.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="no-print app-controls" style={{ ...styles.controls, display: isEditing ? 'none' : 'block' }}>
        {/* Step 1: 아동 이름 */}
        <div style={styles.stepLabel}>
          <span style={styles.stepNum}>1</span>
          <span>아동 이름</span>
          <span style={styles.stepHint}>(선택 입력 - 비워두면 "아이"로 표기됩니다)</span>
        </div>
        <input
          type="text"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          placeholder="예: 민준, 서연"
          style={{ ...styles.input, width: '100%', marginBottom: '20px' }}
          disabled={loading}
        />

        {/* Step 2: 주제 입력 */}
        <div style={styles.stepLabel}>
          <span style={styles.stepNum}>2</span>
          <span>오늘의 주제 입력</span>
        </div>
        <div style={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 포크로 간식 찍어 먹기"
            style={styles.input}
            disabled={loading}
          />
          <button
            onClick={addToFavorites}
            disabled={!topic.trim() || favorites.includes(topic.trim())}
            style={{
              ...styles.secondaryBtn,
              opacity: (!topic.trim() || favorites.includes(topic.trim())) ? 0.4 : 1,
            }}
          >
            ★ 즐겨찾기
          </button>
        </div>

        <div style={styles.favList}>
          {favorites.map((f) => {
            const isActive = topic.trim() === f;
            return (
              <div key={f} style={styles.favChipWrap}>
                <button
                  type="button"
                  onClick={() => selectFavorite(f)}
                  disabled={loading}
                  className="fav-chip-btn"
                  style={{
                    ...styles.favChipBtn,
                    background: isActive ? COLORS.accent : '#fff',
                    borderColor: isActive ? COLORS.primary : COLORS.border,
                    color: isActive ? '#fff' : COLORS.text,
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {f}
                </button>
                <button
                  type="button"
                  onClick={() => removeFavorite(f)}
                  style={styles.favChipRemoveBtn}
                  title="삭제"
                  aria-label={`${f} 삭제`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Step 3: 예상 행동 기능 선택 */}
        <div style={{ ...styles.stepLabel, marginTop: '24px' }}>
          <span style={styles.stepNum}>3</span>
          <span>예상 행동 기능 선택</span>
          <span style={styles.stepHint}>(아동이 왜 이 행동을 할 것 같은지)</span>
        </div>

        <div style={styles.fnGuideBox}>
          여러 기능이 섞여 있어도 <strong>이번 주는 한 가지만</strong> 선택해 주세요.
          한 번에 하나씩 다루는 것이 어머님과 아동 모두에게 가장 효과적입니다.
          기능 파악이 어려우시다면 <strong>"기타 / 복합"</strong>을 선택하시면 됩니다.
        </div>

        <div style={styles.fnGrid} className="app-fn-grid">
          {FUNCTIONS.map((fn) => {
            const isSelected = selectedFunction?.id === fn.id;
            return (
              <button
                key={fn.id}
                onClick={() => setSelectedFunction(fn)}
                disabled={loading}
                className="fn-card"
                style={{
                  ...styles.fnCard,
                  borderColor: isSelected ? fn.color : COLORS.borderLight,
                  background: isSelected ? `${fn.color}15` : '#fff',
                  boxShadow: isSelected ? `0 0 0 2px ${fn.color}40` : 'none',
                }}
              >
                <div style={{ ...styles.fnLabel, color: isSelected ? fn.color : COLORS.primaryDark }}>
                  {fn.label}
                </div>
                <div style={styles.fnDesc}>{fn.desc}</div>
                <div style={styles.fnExample}>{fn.example}</div>
              </button>
            );
          })}
        </div>

        {selectedFunction?.id === 'other' && (
          <div style={styles.otherBox}>
            <div style={styles.otherLabel}>
              상황을 짧게 적어주세요 <span style={styles.otherHint}>(선택 입력)</span>
            </div>
            <textarea
              value={otherDetail}
              onChange={(e) => setOtherDetail(e.target.value)}
              placeholder="예: 평소엔 괜찮은데 형이 옆에 있으면 갑자기 소리지르기 시작함. 형이 자기 장난감을 가져가는 것 같진 않은데 이유를 모르겠음."
              style={styles.otherTextarea}
              rows={3}
              disabled={loading}
            />
            <div style={styles.otherNote}>
              관찰된 상황을 적어주시면 더 정확한 가이드를 만들 수 있습니다.
            </div>
          </div>
        )}

        {/* Step 3.5: 영역 (자동 판별, 선택적으로 변경 가능) */}
        <div style={{ ...styles.stepLabel, marginTop: '24px' }}>
          <span style={styles.stepNum}>+</span>
          <span>연습 영역 <span style={styles.otherHint}>(자동으로 정해집니다 · 필요하면 변경)</span></span>
        </div>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          disabled={loading}
          style={styles.domainSelect}
        >
          <option value="auto">
            자동 판별{topic.trim() ? ` (현재: ${(DOMAINS.find(d => d.id === detectDomain(topic)) || {}).label || '사회성·상호작용'})` : ''}
          </option>
          {DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        <div style={styles.otherNote}>
          주제에 따라 실천법·준비물·목표가 영역에 맞게 채워집니다. 양치·신발은 자조, 눈맞춤·차례는 사회성처럼 자동 분류됩니다.
        </div>

        {/* Step 4: 생성 */}
        <div style={{ ...styles.stepLabel, marginTop: '24px' }}>
          <span style={styles.stepNum}>4</span>
          <span>가이드 생성</span>
        </div>

        <button
          onClick={() => generateGuide()}
          disabled={loading || !topic.trim() || !selectedFunction}
          style={{
            ...styles.primaryBtn,
            width: '100%',
            opacity: (loading || !topic.trim() || !selectedFunction) ? 0.4 : 1,
            cursor: (loading || !topic.trim() || !selectedFunction) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '생성 중...' : '가이드 생성하기'}
        </button>

        {error && <div style={styles.error}>{error}</div>}
      </div>

      {showHistory && (
        <>
          <div
            className="no-print"
            onClick={() => setShowHistory(false)}
            style={styles.drawerOverlay}
          />
          <div className="no-print app-drawer-panel" style={styles.drawerPanel}>
            <div style={styles.drawerHeader}>
              <div style={styles.drawerTitle}>보관함 ({history.length})</div>
              <div style={styles.drawerHeaderActions}>
                {history.length > 0 && (
                  <button onClick={clearAllHistory} style={styles.historyClearBtn}>
                    전체 삭제
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  style={styles.drawerCloseBtn}
                  aria-label="보관함 닫기"
                >
                  ×
                </button>
              </div>
            </div>

            <div style={styles.drawerBody}>
              {history.length === 0 ? (
                <div style={styles.historyEmpty}>
                  아직 생성한 가이드가 없습니다.<br />
                  주제를 입력하고 가이드를 만들어 보세요.
                </div>
              ) : (() => {
                // 아동별로 그룹핑
                const groups = {};
                history.forEach(h => {
                  const key = h.childName?.trim() || '__none__';
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(h);
                });
                const childNames = Object.keys(groups).sort((a, b) => {
                  if (a === '__none__') return 1;
                  if (b === '__none__') return -1;
                  return a.localeCompare(b, 'ko');
                });

                // 필터에 해당하는 그룹이 사라졌으면 전체 표시 (이중 안전장치)
                const filterActive = historyFilter && groups[historyFilter]?.length > 0;
                const filtered = filterActive
                  ? { [historyFilter]: groups[historyFilter] }
                  : groups;
                const filteredKeys = filterActive ? [historyFilter] : childNames;

                return (
                  <>
                    {/* 아동 이름 필터 칩 */}
                    {childNames.length > 1 && (
                      <div style={styles.filterBar}>
                        <button
                          onClick={() => setHistoryFilter('')}
                          style={{
                            ...styles.filterChip,
                            background: !filterActive ? COLORS.primary : '#fff',
                            color: !filterActive ? '#fff' : COLORS.text,
                            borderColor: !filterActive ? COLORS.primary : COLORS.border,
                            fontWeight: !filterActive ? 700 : 500,
                          }}
                        >
                          전체 ({history.length})
                        </button>
                        {childNames.map(name => {
                          const isActive = filterActive && historyFilter === name;
                          const display = name === '__none__' ? '이름 미입력' : nameWithSuffix(name);
                          return (
                            <button
                              key={name}
                              onClick={() => setHistoryFilter(isActive ? '' : name)}
                              style={{
                                ...styles.filterChip,
                                background: isActive ? COLORS.primary : '#fff',
                                color: isActive ? '#fff' : COLORS.text,
                                borderColor: isActive ? COLORS.primary : COLORS.border,
                                fontWeight: isActive ? 700 : 500,
                              }}
                            >
                              {display} ({groups[name].length})
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 그룹별 목록 */}
                    {filteredKeys.map(name => (
                      <div key={name} style={styles.historyGroup}>
                        <div style={styles.historyGroupHeader}>
                          {name === '__none__' ? (
                            <span style={styles.historyGroupNameNone}>이름 미입력</span>
                          ) : (
                            <span style={styles.historyGroupName}>{nameWithSuffix(name)}</span>
                          )}
                          <span style={styles.historyGroupCount}>{filtered[name].length}개</span>
                        </div>
                        <div style={styles.historyList}>
                          {filtered[name].map((h, i) => (
                            <div key={h.createdAt || i} style={styles.historyItemWrap}>
                              <button onClick={() => loadFromHistory(h)} style={styles.historyItem}>
                                <span style={styles.historyTopic}>
                                  {h.topic}
                                  {h.functionInfo && (
                                    <span style={{ ...styles.historyTag, background: `${h.functionInfo.color}25`, color: h.functionInfo.color }}>
                                      {h.functionInfo.label}
                                    </span>
                                  )}
                                  {viewingTeacherId === '__ALL__' && h.owner_id && (
                                    <span style={styles.historyOwnerTag}>
                                      {h.owner_id}
                                    </span>
                                  )}
                                </span>
                                <span style={styles.historyDate}>{new Date(h.createdAt).toLocaleDateString('ko-KR')}</span>
                              </button>
                              <button
                                onClick={() => removeHistoryItem(h)}
                                style={styles.historyItemRemove}
                                title="이 가이드 삭제"
                                aria-label="삭제"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ─────────── 사용 설명서 드로어 ─────────── */}
      {showManual && (
        <>
          <div
            className="no-print"
            onClick={() => setShowManual(false)}
            style={styles.drawerOverlay}
          />
          <div className="no-print app-drawer-panel" style={styles.drawerPanel}>
            <div style={styles.drawerHeader}>
              <div style={styles.drawerTitle}>사용 설명서</div>
              <button
                onClick={() => setShowManual(false)}
                style={styles.drawerCloseBtn}
                aria-label="설명서 닫기"
              >
                ×
              </button>
            </div>
            <div style={styles.drawerBody}>
              <div style={styles.manualContent}>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>이 앱은 무엇인가요</div>
                  <p style={styles.manualParagraph}>
                    검단ABA언어행동연구소가 만든 가정 연계 도구입니다. 센터에서 ABA 수업을 마친 뒤, 어머님께 그 주에 집에서 같이 해볼 5분 연습 가이드를 카카오톡이나 PDF로 보내드리기 위한 용도로 설계되었습니다.
                  </p>
                  <p style={styles.manualParagraph}>
                    주제와 예상 행동 기능을 고르면, 임상 메모 톤의 가이드 초안이 자동으로 채워집니다. 미사여구나 응원 멘트 없이, 어머님이 그날 저녁 5분 동안 따라할 수 있는 실천법 중심으로 구성되어 있습니다. 초안을 그대로 보내셔도 되고, '수정' 버튼으로 아이 상황에 맞게 어휘와 내용을 손보신 뒤 보내셔도 됩니다.
                  </p>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>가이드 한 장 만드는 순서</div>

                  <div style={styles.manualStep}>
                    <div style={styles.manualStepNum}>1</div>
                    <div style={styles.manualStepBody}>
                      <div style={styles.manualStepTitle}>아동 이름 입력 (선택)</div>
                      <div style={styles.manualStepText}>
                        비워두시면 가이드 전체에서 "아이"로 표기됩니다. 받침이 있으면 자동으로 "이"가 붙고("민준" → "민준이"), 받침이 없으면 그대로 나옵니다("다혜" → "다혜").
                      </div>
                    </div>
                  </div>

                  <div style={styles.manualStep}>
                    <div style={styles.manualStepNum}>2</div>
                    <div style={styles.manualStepBody}>
                      <div style={styles.manualStepTitle}>오늘의 주제 입력</div>
                      <div style={styles.manualStepText}>
                        그 주에 집중하실 한 가지 주제만 적습니다. 예: "소리지름 대신 카드 사용", "밥상에서 자리 유지", "옷 갈아입기 도움 줄이기".
                      </div>
                      <div style={styles.manualTip}>
                        자주 쓰시는 주제는 즐겨찾기 칩으로 등록해두시면 다음에 한 번에 선택할 수 있습니다.
                      </div>
                    </div>
                  </div>

                  <div style={styles.manualStep}>
                    <div style={styles.manualStepNum}>3</div>
                    <div style={styles.manualStepBody}>
                      <div style={styles.manualStepTitle}>예상 행동 기능 선택</div>
                      <div style={styles.manualStepText}>
                        다섯 가지 중 한 가지를 고릅니다. 단정이 아니라 "이번 주에는 이쪽으로 살펴보겠습니다" 정도의 가설입니다.
                      </div>
                      <ul style={styles.manualList}>
                        <li><strong>관심끌기</strong> — 어른의 반응을 끌어내려는 행동</li>
                        <li><strong>회피</strong> — 과제·상황에서 벗어나려는 행동</li>
                        <li><strong>요구</strong> — 물건·활동을 얻으려는 행동</li>
                        <li><strong>자기자극</strong> — 감각 자극을 위한 행동</li>
                        <li><strong>기타 / 복합</strong> — 분명하지 않거나 여러 기능이 섞인 경우. 선택하시면 상황을 직접 적는 칸이 나옵니다.</li>
                      </ul>
                    </div>
                  </div>

                  <div style={styles.manualStep}>
                    <div style={styles.manualStepNum}>4</div>
                    <div style={styles.manualStepBody}>
                      <div style={styles.manualStepTitle}>가이드 생성</div>
                      <div style={styles.manualStepText}>
                        '가이드 생성' 버튼을 누르면 20~30초 안에 결과가 나옵니다. 생성된 가이드는 자동으로 보관함에 저장됩니다.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>가이드 구성</div>
                  <p style={styles.manualParagraph}>
                    자동으로 채워지는 가이드는 항상 같은 구조를 따릅니다. 모든 항목은 '수정' 버튼으로 고칠 수 있습니다.
                  </p>
                  <ul style={styles.manualList}>
                    <li><strong>도입부</strong> — 어머님께 보내는 짧은 인사와 이번 주 방향</li>
                    <li><strong>예상 기능 살펴보기</strong> — 선택하신 기능을 어떻게 해석하는지 1~2문장</li>
                    <li><strong>이번 주 목표</strong> — 측정 가능한 형태 (예: "하루 5분 연습에서 카드 사용 3회 이상")</li>
                    <li><strong>준비물</strong> — 집에서 바로 준비할 수 있는 것</li>
                    <li><strong>5분 실천법</strong> — 1단계(2분) / 2단계(2분) / 3단계(1분) 구성</li>
                    <li><strong>기다림의 포인트</strong> — 어머님이 개입을 줄이고 기다려야 할 순간</li>
                    <li><strong>강화(칭찬) 타이밍</strong> — 언제, 어떻게 칭찬할지</li>
                    <li><strong>이번 주 집중 관찰</strong> — 한 문장</li>
                    <li><strong>다음 주 우선순위</strong> — 이번 주 결과에 따라 어디로 갈지</li>
                    <li><strong>주간 체크표</strong> — 어머님이 매일 시도/성공 횟수를 적으실 7칸</li>
                  </ul>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>결과 가이드로 할 수 있는 일</div>

                  <div style={styles.manualFeature}>
                    <div style={styles.manualFeatureTitle}>✎ 수정</div>
                    <div style={styles.manualStepText}>
                      모든 칸을 직접 손볼 수 있습니다. 아동 이름, 도입부 문장, 단계별 실천법까지 textarea가 자동으로 높이를 늘려가며 편집됩니다. 저장하시면 보관함의 해당 가이드도 함께 갱신되고 "수정됨" 배지가 붙습니다.
                    </div>
                  </div>

                  <div style={styles.manualFeature}>
                    <div style={styles.manualFeatureTitle}>어머님께 전송용 텍스트 복사</div>
                    <div style={styles.manualStepText}>
                      카카오톡에 그대로 붙여넣을 수 있는 평문 텍스트가 클립보드에 복사됩니다. 표 대신 줄 단위로 정리되어 있고, 주간 체크표는 빈 양식으로 들어갑니다.
                    </div>
                  </div>

                  <div style={styles.manualFeature}>
                    <div style={styles.manualFeatureTitle}>PDF / 인쇄</div>
                    <div style={styles.manualStepText}>
                      새 창이 열리면서 시스템 인쇄 대화상자가 나타납니다. "PDF로 저장"을 선택하시면 A4 1~2장 분량의 PDF 파일이 만들어집니다. 색상이 잘 안 나오면 인쇄 옵션에서 '배경 그래픽' 또는 '컬러' 설정을 확인해주세요.
                    </div>
                  </div>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>보관함</div>
                  <p style={styles.manualParagraph}>
                    생성하신 가이드는 자동으로 보관함에 저장됩니다. 헤더의 '보관함' 버튼을 누르시면 우측에서 패널이 열립니다.
                  </p>
                  <ul style={styles.manualList}>
                    <li>아동 이름별로 자동 그룹화됩니다.</li>
                    <li>아동 이름 칩을 누르시면 해당 아동 가이드만 필터링됩니다.</li>
                    <li>가이드 항목을 누르시면 그대로 불러옵니다 (현재 작업 중인 내용은 사라지니 주의).</li>
                    <li>최대 30개까지 보관되며, 그 이상은 가장 오래된 것부터 자동 삭제됩니다.</li>
                    <li>개별 삭제와 전체 삭제 모두 확인 모달이 한 번 더 뜹니다.</li>
                  </ul>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>주간 체크표 사용법</div>
                  <p style={styles.manualParagraph}>
                    어머님께서 매일 저녁 그날 시도한 횟수와 성공한 횟수를 적으시도록 만들어진 표입니다. 7일치를 다 채우신 다음, 다음 센터 방문 때 보여주시면 치료사가 다음 주 방향 결정에 반영합니다.
                  </p>
                  <p style={styles.manualParagraph}>
                    이전 버전에 있던 '총 시도/총 성공/성공률' 자동 계산은 제거되었습니다. 어머님이 부담을 덜 가지시고 횟수만 적으실 수 있도록 한 의도입니다.
                  </p>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>가이드 작성 톤</div>
                  <p style={styles.manualParagraph}>
                    AI에게 명시적으로 금지된 표현이 있습니다.
                  </p>
                  <ul style={styles.manualList}>
                    <li>"부모님" → 반드시 "어머님"</li>
                    <li>"~하는 그 순간" 같은 감성·시적 표현 금지</li>
                    <li>"화이팅", "잘하고 계세요" 같은 응원 멘트 금지</li>
                    <li>"이 가이드는", "출발점", "시작점" 같은 메타 발화 금지</li>
                    <li>"정말", "꼭", "반드시", "절대" 같은 강조 부사 거의 사용 금지</li>
                    <li>이모티콘, 별표, 느낌표 거의 사용 금지</li>
                    <li>없는 일을 지어내지 않음 — AI는 그날 센터에서 실제로 어떤 일이 있었는지 알지 못합니다. 도입부에는 일반적인 한 문장만 들어가고, 구체적인 장면이 필요하면 수정 모드에서 직접 적어주셔야 합니다.</li>
                  </ul>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>주의사항</div>
                  <ul style={styles.manualList}>
                    <li>AI 생성 내용은 초안입니다. 발송 전 반드시 한 번 읽어보시고 필요하면 수정해주세요.</li>
                    <li>"이번 주 목표"의 횟수, 회기 시간, 강도는 아동의 실제 수준과 다를 수 있으니 임상 판단으로 보정해주세요.</li>
                    <li>같은 주제·기능으로 여러 번 생성해도 매번 다른 가이드가 나옵니다. 마음에 드는 안이 나올 때까지 다시 생성하셔도 됩니다.</li>
                    <li>보관함 데이터는 기기/브라우저에 저장됩니다. 브라우저 캐시를 비우시면 사라질 수 있으니 중요한 가이드는 PDF로 따로 저장해두시는 것을 권장합니다.</li>
                  </ul>
                </div>

                <div style={styles.manualSection}>
                  <div style={styles.manualSectionTitle}>문의</div>
                  <p style={styles.manualParagraph}>
                    검단ABA언어행동연구소
                  </p>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

      {loading && (
        <div className="no-print" style={styles.loadingBox}>
          <div style={styles.loadingHeader}>
            <div className="spinner" style={styles.spinnerEl}></div>
            <div style={styles.loadingTitle}>ABA 가이드를 작성하고 있습니다</div>
            <div style={styles.loadingSubtitle}>약 20~30초 정도 소요됩니다</div>
          </div>
          <div style={styles.progressWrap}>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${currentStage.percent}%` }} />
            </div>
            <div style={styles.progressMeta}>
              <span>{elapsed}초 경과</span>
              <span style={{ color: COLORS.primary, fontWeight: 600 }}>{currentStage.percent}%</span>
            </div>
          </div>
          <div key={currentStage.text} className="stage-text" style={styles.stageRow}>
            <span className="pulse-dot" style={styles.stageDot}></span>
            <span style={styles.stageText}>{currentStage.text}</span>
          </div>
          <div style={styles.stagesList}>
            {LOADING_STAGES.slice(0, 5).map((s, i) => {
              const nextStage = LOADING_STAGES[i + 1];
              const done = nextStage ? elapsed >= nextStage.at : false;
              const active = currentStage.text === s.text;
              return (
                <div key={i} style={styles.stageItem}>
                  <span style={{
                    ...styles.stageCheck,
                    background: done ? '#8b6f47' : active ? '#c9a987' : '#e5d9c9',
                    color: done || active ? '#fff' : '#a89c8e',
                  }}>{done ? '✓' : i + 1}</span>
                  <span style={{
                    ...styles.stageItemText,
                    color: done ? '#3d3128' : active ? '#6b5436' : '#a89c8e',
                    fontWeight: active ? 600 : 400,
                  }}>{s.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {guide && !loading && (
        <>
          <div className="no-print app-action-row" style={styles.actionRow}>
            {!isEditing ? (
              <>
                <button onClick={startEditing} style={styles.editBtn} className="app-action-btn">✎ 수정</button>
                <button onClick={copyToClipboard} style={styles.actionBtn} className="app-action-btn">어머님께 전송용 텍스트 복사</button>
                <button onClick={handlePrint} style={styles.actionBtn} className="app-action-btn">PDF / 인쇄</button>
                {guide.editedAt && (
                  <span style={styles.editedBadge}>
                    {new Date(guide.editedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 수정됨
                  </span>
                )}
                {copyStatus && <span style={styles.copyStatus}>{copyStatus}</span>}
              </>
            ) : (
              <>
                <button onClick={saveEditing} style={styles.saveBtn} className="app-action-btn">저장</button>
                <button onClick={cancelEditing} style={styles.cancelBtn} className="app-action-btn">취소</button>
                <span style={styles.editingHint}>편집 모드 — 모든 칸을 직접 수정할 수 있습니다</span>
              </>
            )}
          </div>

          <div id="printable-guide" style={styles.guideCard} className="guide-card app-guide-card">
            <div style={styles.guideHeader} className="app-guide-header">
              <img src={LOGO_DATA_URI} alt="검단ABA 로고" style={styles.guideLogo} className="app-guide-logo" />
              <div style={styles.guideTitle} className="app-guide-title">
                {(isEditing ? editDraft.childName : guide.childName)
                  ? `${namePlusReul(isEditing ? editDraft.childName : guide.childName)} 위한 `
                  : ''}집에서 하는 5분 ABA 가이드
              </div>
            </div>

            {isEditing && (
              <div style={styles.editNameRow}>
                <span style={styles.editNameLabel}>아동 이름</span>
                <input
                  type="text"
                  value={editDraft.childName}
                  onChange={(e) => updateDraft('childName', e.target.value)}
                  placeholder="비워두면 '아이'로 표기됩니다"
                  style={styles.editNameInput}
                />
              </div>
            )}

            {isEditing ? (
              <div style={styles.intro}>
                <AutoTextarea
                  value={editDraft.intro}
                  onChange={(e) => updateDraft('intro', e.target.value)}
                  style={styles.editTextarea}
                  minRows={3}
                />
              </div>
            ) : (
              <div style={styles.intro}>{renderMultiline(guide.intro)}</div>
            )}

            <div style={styles.topicRow}>
              <div style={styles.todayTopic}>
                <span style={styles.todayLabel}>오늘의 주제</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editDraft.topic}
                    onChange={(e) => updateDraft('topic', e.target.value)}
                    style={styles.editTopicInput}
                  />
                ) : (
                  <span style={styles.todayValue}>{guide.topic}</span>
                )}
              </div>
              {guide.functionInfo && (
                <div style={{ ...styles.fnTag, background: `${guide.functionInfo.color}20`, borderColor: guide.functionInfo.color }}>
                  <span style={styles.fnTagLabel}>예상 기능</span>
                  <span style={{ ...styles.fnTagValue, color: guide.functionInfo.color }}>
                    {guide.functionInfo.label}
                  </span>
                </div>
              )}
            </div>

            {guide.otherDetail && !isEditing && (
              <div style={styles.otherDetailDisplay}>
                <span style={styles.otherDetailLabel}>관찰된 상황</span>
                <span style={styles.otherDetailText}>{guide.otherDetail}</span>
              </div>
            )}

            <div style={styles.tableWrap}>
              {[
                { key: 'function_analysis', label: '예상 기능 살펴보기', highlight: true, rows: 4 },
                { key: 'goal', label: '이번 주 목표', rows: 3 },
                { key: 'materials', label: '준비물', rows: 4 },
                { key: 'practice', label: '5분 실천법', rows: 8 },
                { key: 'waiting', label: '기다림의 포인트', rows: 3 },
                { key: 'reinforcement', label: '강화(칭찬) 타이밍', rows: 5 },
                { key: 'next_priority', label: '다음 주 우선순위', rows: 3, soft: true },
              ].map((row, i) => (
                <div key={i} style={styles.row} className="guide-row app-guide-row">
                  <div className="app-row-label" style={{
                    ...styles.rowLabel,
                    background: row.highlight ? COLORS.accentLight : row.soft ? '#f5ede0' : COLORS.rowBg,
                  }}>
                    {row.label}
                  </div>
                  <div style={styles.rowContent} className="app-row-content">
                    {isEditing ? (
                      <AutoTextarea
                        value={editDraft[row.key]}
                        onChange={(e) => updateDraft(row.key, e.target.value)}
                        style={styles.editTextarea}
                        minRows={row.rows}
                      />
                    ) : (
                      renderMultiline(guide[row.key])
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 주간 체크표 */}
            <div style={styles.checkSection} className="check-table-print app-check-section">
              <div style={styles.checkHeader}>
                <div>
                  <div style={styles.checkTitle}>이번 주 체크표</div>
                  {isEditing ? (
                    <AutoTextarea
                      value={editDraft.weekly_focus}
                      onChange={(e) => updateDraft('weekly_focus', e.target.value)}
                      style={{ ...styles.editTextarea, fontSize: '13px', minHeight: '40px' }}
                      minRows={2}
                    />
                  ) : (
                    <div style={styles.checkSubtitle}>{guide.weekly_focus}</div>
                  )}
                </div>
              </div>

              <div style={styles.checkTableWrap} className="app-check-table-wrap">
                <table style={styles.checkTable} className="app-check-table">
                  <thead>
                    <tr>
                      <th style={styles.checkTh}>구분</th>
                      {WEEK_DAYS.map(d => (
                        <th key={d} style={styles.checkTh}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={styles.checkRowLabel}>시도 횟수</td>
                      {checkTable.map((c, i) => (
                        <td key={i} style={styles.checkTd}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={c.attempts}
                            onChange={(e) => updateCheck(i, 'attempts', e.target.value.replace(/[^0-9]/g, ''))}
                            style={styles.checkInput}
                            className="check-input"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={styles.checkRowLabel}>성공 횟수</td>
                      {checkTable.map((c, i) => (
                        <td key={i} style={styles.checkTd}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={c.success}
                            onChange={(e) => updateCheck(i, 'success', e.target.value.replace(/[^0-9]/g, ''))}
                            style={styles.checkInput}
                            className="check-input"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={styles.checkNote}>
                ※ 매일 저녁, 그날의 시도와 성공 횟수를 기록해 주세요. 다음 센터 방문 시 치료사가 확인하여 다음 단계 결정에 반영합니다.
              </div>
            </div>

            <div style={styles.guideFooter}>
              <span>{new Date(guide.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span>검단ABA언어행동연구소</span>
            </div>
          </div>
        </>
      )}

      {!guide && !loading && (
        <div className="no-print" style={styles.emptyState}>
          아동 이름, 주제, 행동의 기능을 입력하면 개별화된 ABA 가이드가 생성됩니다.
        </div>
      )}

      {confirmAction && (
        <>
          <div
            className="no-print"
            style={styles.confirmOverlay}
            onClick={() => setConfirmAction(null)}
          />
          <div className="no-print app-confirm-modal" style={styles.confirmModal} role="dialog" aria-modal="true">
            <div style={styles.confirmIcon}>!</div>
            <div style={styles.confirmMessage}>
              {confirmAction.message.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < confirmAction.message.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
            <div style={styles.confirmActions}>
              <button onClick={() => setConfirmAction(null)} style={styles.confirmCancelBtn}>
                취소
              </button>
              <button onClick={confirmAction.onConfirm} style={styles.confirmDeleteBtn}>
                삭제
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const COLORS = {
  bg: '#fdf5f5',
  cardBg: '#ffffff',
  primary: '#e07187',
  primaryDark: '#a84960',
  accent: '#f0a4b5',
  accentLight: '#fce4ea',
  text: '#3d2530',
  textLight: '#8a6571',
  border: '#f4d4dc',
  borderLight: '#fae8ee',
  rowBg: '#fef7f9',
  error: '#a83e5a',
  errorBg: '#fbe8ec',
};

const styles = {
  container: {
    minHeight: '100vh',
    background: COLORS.bg,
    fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", -apple-system, sans-serif',
    color: COLORS.text,
    padding: '24px 16px 80px',
    maxWidth: '960px',
    margin: '0 auto',
  },
  header: { marginBottom: '20px' },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    background: COLORS.cardBg,
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  headerLogo: {
    width: '110px',
    height: 'auto',
    flexShrink: 0,
  },
  brandName: { fontSize: '18px', fontWeight: 700, color: COLORS.primaryDark },
  brandSub: { fontSize: '13px', color: COLORS.textLight, marginTop: '4px' },
  historyBtn: {
    padding: '10px 16px',
    background: COLORS.accentLight,
    color: COLORS.primaryDark,
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  controls: {
    background: COLORS.cardBg,
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
    padding: '24px',
    marginBottom: '20px',
  },
  stepLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    marginBottom: '12px',
  },
  stepNum: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: COLORS.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
  },
  stepHint: { fontSize: '12px', color: COLORS.textLight, fontWeight: 400 },
  inputRow: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  input: {
    flex: '1 1 280px',
    minWidth: '200px',
    padding: '12px 14px',
    fontSize: '15px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    background: '#fff',
    color: COLORS.text,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '14px 22px',
    background: COLORS.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '12px 16px',
    background: '#fff',
    color: COLORS.primary,
    border: `1px solid ${COLORS.accent}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  error: {
    padding: '10px 14px',
    background: COLORS.errorBg,
    color: COLORS.error,
    borderRadius: '6px',
    fontSize: '14px',
    marginTop: '12px',
  },
  favList: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' },
  favChipWrap: {
    display: 'inline-flex',
    alignItems: 'stretch',
    gap: '4px',
  },
  favChipBtn: {
    padding: '8px 14px',
    border: '1.5px solid',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
    lineHeight: 1.4,
  },
  favChipRemoveBtn: {
    width: '28px',
    height: '32px',
    padding: 0,
    background: 'transparent',
    border: 'none',
    color: COLORS.textLight,
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    borderRadius: '4px',
  },
  fnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '4px',
  },
  fnGuideBox: {
    padding: '12px 16px',
    background: '#fffaf2',
    border: `1px dashed ${COLORS.accent}`,
    borderRadius: '8px',
    fontSize: '13px',
    color: COLORS.primaryDark,
    lineHeight: 1.7,
    marginBottom: '12px',
  },
  fnCard: {
    padding: '14px 16px',
    background: '#fff',
    border: `2px solid ${COLORS.borderLight}`,
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  fnLabel: {
    fontSize: '15px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    marginBottom: '6px',
  },
  fnDesc: {
    fontSize: '12.5px',
    color: COLORS.text,
    lineHeight: 1.5,
    marginBottom: '6px',
  },
  fnExample: {
    fontSize: '11.5px',
    color: COLORS.textLight,
    lineHeight: 1.4,
  },
  otherBox: {
    marginTop: '12px',
    padding: '14px 16px',
    background: COLORS.rowBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '10px',
  },
  otherLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    marginBottom: '8px',
  },
  otherHint: {
    fontSize: '11px',
    color: COLORS.textLight,
    fontWeight: 400,
    marginLeft: '4px',
  },
  otherTextarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13.5px',
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '8px',
    background: '#fff',
    color: COLORS.text,
    fontFamily: 'inherit',
    lineHeight: 1.6,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  domainSelect: {
    width: '100%',
    padding: '11px 12px',
    fontSize: '14px',
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '8px',
    background: '#fff',
    color: COLORS.text,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  otherNote: {
    fontSize: '11.5px',
    color: COLORS.textLight,
    marginTop: '6px',
    lineHeight: 1.5,
  },
  otherDetailDisplay: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '14px 18px',
    background: '#fff',
    border: `1px dashed ${COLORS.accent}`,
    borderRadius: '10px',
    marginBottom: '20px',
  },
  otherDetailLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    padding: '4px 10px',
    background: COLORS.accentLight,
    borderRadius: '6px',
    flexShrink: 0,
  },
  otherDetailText: {
    fontSize: '14px',
    color: COLORS.text,
    lineHeight: 1.6,
    flex: 1,
  },
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(61, 49, 40, 0.45)',
    zIndex: 998,
    animation: 'fadeInOverlay 0.2s ease-out',
  },
  drawerPanel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '420px',
    maxWidth: '90vw',
    background: COLORS.cardBg,
    boxShadow: '-8px 0 32px rgba(61, 49, 40, 0.15)',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInRight 0.28s cubic-bezier(0.32, 0.72, 0.32, 1)',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 22px',
    borderBottom: `1px solid ${COLORS.borderLight}`,
    background: COLORS.rowBg,
    flexShrink: 0,
  },
  drawerTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: COLORS.primaryDark,
  },
  drawerHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  drawerCloseBtn: {
    width: '32px',
    height: '32px',
    background: '#fff',
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '8px',
    color: COLORS.textLight,
    cursor: 'pointer',
    fontSize: '20px',
    lineHeight: 1,
    padding: 0,
    fontFamily: 'inherit',
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 18px',
  },
  filterBar: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '16px',
    paddingBottom: '14px',
    borderBottom: `1px solid ${COLORS.borderLight}`,
  },
  filterChip: {
    padding: '6px 12px',
    border: '1.5px solid',
    borderRadius: '14px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  historyGroup: {
    marginBottom: '18px',
  },
  historyGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 4px 8px',
    marginBottom: '6px',
    borderBottom: `1px dashed ${COLORS.borderLight}`,
  },
  historyGroupName: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    padding: '3px 10px',
    background: COLORS.accentLight,
    borderRadius: '12px',
  },
  historyGroupNameNone: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.textLight,
    padding: '3px 10px',
    background: COLORS.borderLight,
    borderRadius: '12px',
    fontStyle: 'italic',
  },
  historyGroupCount: {
    fontSize: '11px',
    color: COLORS.textLight,
    fontWeight: 500,
  },
  historyClearBtn: {
    padding: '6px 12px',
    background: '#fff',
    color: COLORS.error,
    border: `1px solid ${COLORS.errorBg}`,
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  historyEmpty: {
    fontSize: '13px',
    color: COLORS.textLight,
    padding: '40px 8px',
    textAlign: 'center',
    lineHeight: 1.8,
  },
  historyList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  historyItemWrap: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '6px',
  },
  historyItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
    padding: '12px 14px',
    background: COLORS.rowBg,
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  historyItemRemove: {
    width: '36px',
    background: '#fff',
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '8px',
    color: COLORS.textLight,
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: 0,
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  historyTopic: {
    fontSize: '14px',
    color: COLORS.text,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  historyTag: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 600,
  },
  historyOwnerTag: {
    fontSize: '10.5px',
    padding: '2px 7px',
    borderRadius: '10px',
    fontWeight: 600,
    background: '#ede0e4',
    color: '#7a5560',
    marginLeft: '4px',
  },
  historyDate: {
    fontSize: '11px',
    color: COLORS.textLight,
    alignSelf: 'flex-end',
  },

  loadingBox: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '14px',
    padding: '40px 32px',
  },
  loadingHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '28px',
  },
  spinnerEl: {
    width: '36px',
    height: '36px',
    border: `3px solid ${COLORS.borderLight}`,
    borderTopColor: COLORS.primary,
    borderRadius: '50%',
  },
  loadingTitle: { fontSize: '17px', fontWeight: 700, color: COLORS.primaryDark },
  loadingSubtitle: { fontSize: '13px', color: COLORS.textLight },
  progressWrap: { marginBottom: '20px' },
  progressBar: {
    height: '8px',
    background: COLORS.borderLight,
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.primary})`,
    borderRadius: '4px',
    transition: 'width 0.6s ease-out',
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: COLORS.textLight,
  },
  stageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    background: COLORS.rowBg,
    borderRadius: '8px',
    marginBottom: '20px',
  },
  stageDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: COLORS.primary,
    flexShrink: 0,
  },
  stageText: { fontSize: '14px', color: COLORS.primaryDark, fontWeight: 500 },
  stagesList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  stageItem: { display: 'flex', alignItems: 'center', gap: '12px' },
  stageCheck: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
    transition: 'all 0.3s ease',
  },
  stageItemText: { fontSize: '13px', transition: 'all 0.3s ease' },

  actionRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '10px 16px',
    background: '#fff',
    color: COLORS.primaryDark,
    border: `1px solid ${COLORS.accent}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  editBtn: {
    padding: '10px 18px',
    background: COLORS.accentLight,
    color: COLORS.primaryDark,
    border: `1px solid ${COLORS.accent}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '10px 22px',
    background: COLORS.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '10px 18px',
    background: '#fff',
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  editingHint: {
    fontSize: '12.5px',
    color: COLORS.primary,
    fontStyle: 'italic',
    marginLeft: '4px',
  },
  editedBadge: {
    fontSize: '11.5px',
    color: COLORS.textLight,
    padding: '4px 8px',
    background: COLORS.rowBg,
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '6px',
  },
  copyStatus: { fontSize: '13px', color: COLORS.primary, fontWeight: 600 },
  editTextarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14.5px',
    border: `1px solid ${COLORS.accent}`,
    borderRadius: '6px',
    background: '#fffdf9',
    color: COLORS.text,
    fontFamily: 'inherit',
    lineHeight: 1.75,
    boxSizing: 'border-box',
    display: 'block',
  },
  editTopicInput: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '15px',
    fontWeight: 700,
    border: `1px solid ${COLORS.primary}`,
    borderRadius: '6px',
    background: '#fff',
    color: COLORS.primaryDark,
    fontFamily: 'inherit',
  },
  editNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    background: '#fffaf2',
    border: `1px dashed ${COLORS.accent}`,
    borderRadius: '8px',
    marginBottom: '14px',
  },
  editNameLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    padding: '4px 10px',
    background: '#fff',
    borderRadius: '6px',
    flexShrink: 0,
  },
  editNameInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '6px',
    background: '#fff',
    color: COLORS.text,
    fontFamily: 'inherit',
  },

  guideCard: {
    background: COLORS.cardBg,
    borderRadius: '14px',
    border: `1px solid ${COLORS.border}`,
    padding: '36px 32px',
    boxShadow: '0 1px 3px rgba(139, 111, 71, 0.05)',
  },
  guideHeader: {
    textAlign: 'center',
    paddingBottom: '20px',
    borderBottom: `1px solid ${COLORS.borderLight}`,
    marginBottom: '24px',
  },
  guideLogo: {
    width: '220px',
    height: 'auto',
    margin: '0 auto 12px',
    display: 'block',
  },
  guideTitle: { fontSize: '22px', fontWeight: 700, color: COLORS.primaryDark, letterSpacing: '-0.5px' },
  intro: {
    background: COLORS.rowBg,
    padding: '18px 20px',
    borderRadius: '10px',
    fontSize: '15px',
    color: COLORS.text,
    marginBottom: '20px',
    lineHeight: 1.75,
  },
  topicRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  todayTopic: {
    flex: '1 1 320px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    background: COLORS.accentLight,
    borderRadius: '10px',
  },
  todayLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    padding: '4px 10px',
    background: '#fff',
    borderRadius: '6px',
    flexShrink: 0,
  },
  todayValue: { fontSize: '16px', fontWeight: 700, color: COLORS.primaryDark },
  fnTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 18px',
    borderRadius: '10px',
    border: '2px solid',
  },
  fnTagLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    padding: '4px 10px',
    background: '#fff',
    borderRadius: '6px',
    flexShrink: 0,
  },
  fnTagValue: { fontSize: '15px', fontWeight: 700 },
  tableWrap: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '28px',
  },
  row: {
    display: 'flex',
    borderBottom: `1px solid ${COLORS.borderLight}`,
    background: '#fff',
  },
  rowLabel: {
    flex: '0 0 140px',
    padding: '18px 16px',
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    borderRight: `1px solid ${COLORS.borderLight}`,
  },
  rowContent: {
    flex: 1,
    padding: '18px 20px',
    fontSize: '14.5px',
    color: COLORS.text,
    lineHeight: 1.75,
  },

  // 주간 체크표
  checkSection: {
    background: COLORS.rowBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
  },
  checkHeader: { marginBottom: '16px' },
  checkTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    marginBottom: '6px',
  },
  checkSubtitle: {
    fontSize: '13px',
    color: COLORS.textLight,
    lineHeight: 1.5,
  },
  checkTableWrap: { overflowX: 'auto', marginBottom: '14px' },
  checkTable: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    minWidth: '560px',
  },
  checkTh: {
    padding: '10px 6px',
    background: COLORS.rowBg,
    fontSize: '13px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    borderBottom: `1px solid ${COLORS.border}`,
    textAlign: 'center',
  },
  checkRowLabel: {
    padding: '12px 14px',
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.primaryDark,
    background: COLORS.rowBg,
    borderRight: `1px solid ${COLORS.borderLight}`,
    whiteSpace: 'nowrap',
  },
  checkTd: {
    padding: '6px',
    borderRight: `1px solid ${COLORS.borderLight}`,
    textAlign: 'center',
  },
  checkInput: {
    width: '100%',
    minWidth: '36px',
    padding: '8px 4px',
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '6px',
    background: '#fff',
    fontSize: '14px',
    textAlign: 'center',
    color: COLORS.text,
    fontFamily: 'inherit',
  },
  checkNote: {
    fontSize: '12px',
    color: COLORS.textLight,
    lineHeight: 1.6,
    padding: '10px 12px',
    background: '#fff',
    borderRadius: '6px',
    border: `1px dashed ${COLORS.border}`,
  },

  guideFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: `1px solid ${COLORS.borderLight}`,
    fontSize: '12px',
    color: COLORS.textLight,
  },
  emptyState: {
    background: COLORS.cardBg,
    border: `1px dashed ${COLORS.border}`,
    borderRadius: '12px',
    padding: '60px 24px',
    textAlign: 'center',
    color: COLORS.textLight,
    fontSize: '14px',
    lineHeight: 1.6,
  },
  confirmOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(61, 49, 40, 0.55)',
    zIndex: 1000,
    animation: 'fadeInOverlay 0.18s ease-out',
  },
  confirmModal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '380px',
    maxWidth: '90vw',
    background: COLORS.cardBg,
    borderRadius: '14px',
    padding: '28px 24px 20px',
    boxShadow: '0 10px 40px rgba(61, 49, 40, 0.25)',
    zIndex: 1001,
    animation: 'fadeInModal 0.22s cubic-bezier(0.32, 0.72, 0.32, 1)',
    textAlign: 'center',
  },
  confirmIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: COLORS.errorBg,
    color: COLORS.error,
    fontSize: '24px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  confirmMessage: {
    fontSize: '14.5px',
    color: COLORS.text,
    lineHeight: 1.7,
    marginBottom: '22px',
    padding: '0 8px',
  },
  confirmActions: {
    display: 'flex',
    gap: '8px',
  },
  confirmCancelBtn: {
    flex: 1,
    padding: '12px',
    background: '#fff',
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmDeleteBtn: {
    flex: 1,
    padding: '12px',
    background: COLORS.error,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: COLORS.rowBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    fontSize: '12px',
  },
  userBadgeName: {
    fontWeight: 700,
    color: COLORS.text,
  },
  userBadgeRole: {
    fontSize: '11px',
    color: COLORS.textLight,
    padding: '2px 6px',
    background: '#fff',
    borderRadius: '4px',
  },
  viewingBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 18px',
    margin: '0 16px',
    background: '#fef4d6',
    border: '1px solid #f0d68c',
    borderRadius: '8px',
    color: '#7a5a1e',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  viewingBannerIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  viewingBannerSub: {
    fontSize: '12px',
    color: '#8a7140',
    marginTop: '4px',
  },
  manualContent: {
    color: COLORS.text,
    fontSize: '13.5px',
    lineHeight: 1.75,
  },
  manualSection: {
    marginBottom: '26px',
    paddingBottom: '20px',
    borderBottom: `1px dashed ${COLORS.borderLight}`,
  },
  manualSectionTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    marginBottom: '12px',
    paddingLeft: '10px',
    borderLeft: `3px solid ${COLORS.primary}`,
  },
  manualParagraph: {
    margin: '0 0 10px 0',
    color: COLORS.text,
    lineHeight: 1.75,
  },
  manualList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
    color: COLORS.text,
    lineHeight: 1.85,
  },
  manualStep: {
    display: 'flex',
    gap: '14px',
    marginBottom: '16px',
    padding: '12px 14px',
    background: COLORS.rowBg,
    borderRadius: '8px',
    border: `1px solid ${COLORS.borderLight}`,
  },
  manualStepNum: {
    flexShrink: 0,
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: COLORS.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
  },
  manualStepBody: {
    flex: 1,
    minWidth: 0,
  },
  manualStepTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    marginBottom: '4px',
  },
  manualStepText: {
    fontSize: '13px',
    color: COLORS.text,
    lineHeight: 1.7,
  },
  manualTip: {
    marginTop: '8px',
    padding: '8px 10px',
    background: COLORS.accentLight,
    borderRadius: '6px',
    fontSize: '12px',
    color: COLORS.primaryDark,
    lineHeight: 1.6,
  },
  manualFeature: {
    marginBottom: '14px',
    padding: '12px 14px',
    background: '#fff',
    borderRadius: '8px',
    border: `1px solid ${COLORS.borderLight}`,
  },
  manualFeatureTitle: {
    fontSize: '13.5px',
    fontWeight: 700,
    color: COLORS.primaryDark,
    marginBottom: '6px',
  },
};

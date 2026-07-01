// ============================================================
// Supabase 데이터 계층 (Edge Function 경유)
// - gd_* 테이블에 직접 접근하지 않고 gd-data Edge Function을 호출
// - service_role 키는 서버(Edge Function)에만 있어 브라우저에 노출되지 않음
// - 테이블 RLS를 켜도 정상 동작
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const FN_URL = `${SUPABASE_URL}/functions/v1/gd-data`;

export function supabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON);
}

// Edge Function 호출 공통 래퍼
async function callFn(action, params = {}) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, params }),
  });
  let body;
  try {
    body = await res.json();
  } catch (_) {
    throw new Error('서버 응답을 읽지 못했습니다');
  }
  if (!res.ok || body.error) {
    throw new Error(body.error || '서버 오류');
  }
  return body.data;
}

// ── 사용자 ─────────────────────────────────────────────────
export async function dbGetUser(id) {
  return callFn('getUser', { id });
}

export async function dbListUsers() {
  return callFn('listUsers', {});
}

export async function dbCreateUser({ id, name, role, password }) {
  return callFn('createUser', { id, name, role, password });
}

export async function dbUpdatePassword(id, newPassword) {
  await callFn('updatePassword', { id, newPassword });
  return true;
}

export async function dbDeleteUser(id) {
  await callFn('deleteUser', { id });
  return true;
}

// 로그인: 서버에서 비밀번호를 검증하고 해시 없는 사용자 정보를 반환
// { ok: true, user } | { ok: false, error }
export async function dbVerifyLogin(id, password) {
  return callFn('verifyLogin', { id, password });
}

// ── 가이드(보관함) ─────────────────────────────────────────
export async function dbListGuides(ownerId) {
  return callFn('listGuides', { ownerId: ownerId || null });
}

export async function dbInsertGuide({ ownerId, topic, childName, payload }) {
  return callFn('insertGuide', { ownerId, topic, childName, payload });
}

export async function dbDeleteGuide(guideId) {
  await callFn('deleteGuide', { guideId });
  return true;
}

export async function dbUpdateGuide(guideId, payload, topic, childName) {
  await callFn('updateGuide', { guideId, payload, topic, childName });
  return true;
}

// ── 즐겨찾기 ───────────────────────────────────────────────
export async function dbGetFavorites(ownerId) {
  return callFn('getFavorites', { ownerId });
}

export async function dbSetFavorites(ownerId, items) {
  await callFn('setFavorites', { ownerId, items });
  return true;
}

// ── 커스텀 템플릿 (전체 공유, 관리자 편집) ──────────────────
export async function dbGetCustomTemplates() {
  return callFn('getCustomTemplates', {});
}

export async function dbSetCustomTemplates(data) {
  await callFn('setCustomTemplates', { data });
  return true;
}

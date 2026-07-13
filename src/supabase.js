// ============================================================
// Supabase 데이터 계층 (A방식: Supabase Auth + RLS)
// - 로그인: 이메일 + 비밀번호 (Supabase Auth)
// - 세션: sessionStorage (창 닫으면 로그아웃) + refresh_token 자동 갱신
// - 데이터: gd_guides / gd_favorites 는 owner_id = 내 Auth UUID (RLS로 본인만)
// - 관리자: admin_list_users / admin_list_guides RPC 로 전체 조회
// - 계정 관리: admin-users Edge Function (create/delete/update_password)
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vdubgrxwijydwfabwpnk.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkdWJncnh3aWp5ZHdmYWJ3cG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk1ODgsImV4cCI6MjA5NzE4NTU4OH0.nqNO3vany3M6fzmG5BG6QVdvi8BW2UbhTDhxNnwvA88';

export function supabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON);
}

function restUrl(path) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

// ── Auth 세션 관리 (sessionStorage) ────────────────────────
const AUTH_SESSION_KEY = 'sb-auth-session-gd';

function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.expires_at && s.expires_at * 1000 < Date.now() + 5 * 60 * 1000) return null;
    return s;
  } catch (e) { return null; }
}

function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch (e) {}
}

async function refreshSession(refreshToken) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.access_token) { saveSession(data); return data; }
    return null;
  } catch (e) { return null; }
}

async function getValidAccessToken() {
  const session = getStoredSession();
  if (session?.access_token) return session.access_token;
  const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (raw) {
    try {
      const old = JSON.parse(raw);
      if (old.refresh_token) {
        const refreshed = await refreshSession(old.refresh_token);
        if (refreshed?.access_token) return refreshed.access_token;
      }
    } catch (e) {}
  }
  return null;
}

async function authHeaders(extra = {}) {
  const token = await getValidAccessToken();
  return {
    'apikey': SUPABASE_ANON,
    'Authorization': token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// ── Auth 로그인/로그아웃/현재사용자 ────────────────────────
// 반환 형식은 App.jsx authenticate()가 기대하는 { ok, user, error } 로 맞춤
export async function authSignIn(email, password) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: (email || '').trim(), password }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = (data.error_description || data.msg || data.error || '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('credential')) {
        return { ok: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' };
      }
      if (msg.includes('not confirmed')) {
        return { ok: false, error: '이메일 확인이 필요합니다. 관리자에게 문의하세요' };
      }
      return { ok: false, error: data.error_description || data.msg || '로그인 실패' };
    }
    saveSession(data);
    const authU = data.user;
    const meta = authU.user_metadata || {};
    return {
      ok: true,
      user: {
        id: authU.id,                       // Auth UUID → owner_id 로 사용
        email: authU.email,
        name: meta.display_name || (authU.email ? authU.email.split('@')[0] : '사용자'),
        role: meta.role || 'teacher',
      },
    };
  } catch (e) {
    return { ok: false, error: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' };
  }
}

export async function authSignOut() {
  try {
    const token = await getValidAccessToken();
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
      });
    }
  } catch (e) {}
  saveSession(null);
}

// 현재 Auth 세션의 사용자 (세션 복원용). 없으면 null
export async function authCurrentUser() {
  try {
    const token = await getValidAccessToken();
    if (!token) return null;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const authU = await r.json();
    const meta = authU.user_metadata || {};
    return {
      id: authU.id,
      email: authU.email,
      name: meta.display_name || (authU.email ? authU.email.split('@')[0] : '사용자'),
      role: meta.role || 'teacher',
    };
  } catch (e) { return null; }
}

// ── 사용자 (관리자용, admin-users Edge Function + RPC) ──────
// dbGetUser: 세션 확인용. Auth 현재 사용자와 id 일치하면 반환
export async function dbGetUser(id) {
  const u = await authCurrentUser();
  if (u && u.id === id) return { ...u, is_active: true };
  return null;
}

export async function dbListUsers() {
  try {
    const headers = await authHeaders();
    const r = await fetch(restUrl('rpc/admin_list_users'), {
      method: 'POST', headers, body: '{}',
    });
    if (!r.ok) return [];
    const users = await r.json();
    // App.jsx 가 기대하는 형식 { id, name, role } 로 매핑
    return (users || []).map(u => ({
      id: u.id || u.user_id,
      name: u.display_name || u.name || (u.email ? u.email.split('@')[0] : ''),
      email: u.email,
      role: u.role || u.user_metadata?.role || 'teacher',
      is_active: true,
    }));
  } catch (e) { return []; }
}

export async function dbCreateUser({ id, name, role, password, email }) {
  // A방식: id 대신 email 로 계정 생성. 호출부에서 email 을 넘기거나 id에 이메일을 담음.
  const targetEmail = email || id;
  try {
    const headers = await authHeaders();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
      method: 'POST', headers,
      body: JSON.stringify({
        action: 'create', email: targetEmail, password,
        display_name: name || (targetEmail ? targetEmail.split('@')[0] : ''),
        role: role || 'teacher',
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      if ((data.error || '').includes('already') || (data.error || '').includes('duplicate')) {
        throw new Error('이미 존재하는 이메일입니다');
      }
      throw new Error(data.error || '계정 생성 실패');
    }
    const created = data.user || {};
    return {
      id: created.id, email: created.email || targetEmail,
      name: name || (targetEmail ? targetEmail.split('@')[0] : ''),
      role: role || 'teacher',
    };
  } catch (e) { throw e; }
}

export async function dbUpdatePassword(userId, newPassword) {
  const headers = await authHeaders();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST', headers,
    body: JSON.stringify({ action: 'update_password', user_id: userId, password: newPassword }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || '비밀번호 변경 실패');
  }
  return true;
}

export async function dbDeleteUser(userId) {
  const headers = await authHeaders();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST', headers,
    body: JSON.stringify({ action: 'delete', user_id: userId }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || '계정 삭제 실패');
  }
  return true;
}

// ── 가이드(보관함) — owner_id = Auth UUID, RLS로 본인만 ─────
// ownerId 없으면(관리자 통합) admin_list_guides RPC 사용
export async function dbListGuides(ownerId) {
  const headers = await authHeaders();
  if (!ownerId) {
    // 관리자 통합 조회
    const r = await fetch(restUrl('rpc/admin_list_guides'), {
      method: 'POST', headers, body: '{}',
    });
    if (!r.ok) throw new Error('보관함 조회 실패');
    return r.json();
  }
  const r = await fetch(restUrl(`gd_guides?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&order=created_at.desc`), {
    headers,
  });
  if (!r.ok) throw new Error('보관함 조회 실패');
  return r.json();
}

export async function dbInsertGuide({ ownerId, topic, childName, payload }) {
  const headers = await authHeaders({ 'Prefer': 'return=representation' });
  const r = await fetch(restUrl('gd_guides'), {
    method: 'POST', headers,
    body: JSON.stringify({ owner_id: ownerId, topic, child_name: childName || '', payload }),
  });
  if (!r.ok) throw new Error('가이드 저장 실패');
  const arr = await r.json();
  return arr[0];
}

export async function dbDeleteGuide(guideId) {
  const headers = await authHeaders();
  const r = await fetch(restUrl(`gd_guides?guide_id=eq.${encodeURIComponent(guideId)}`), {
    method: 'DELETE', headers,
  });
  if (!r.ok) throw new Error('가이드 삭제 실패');
  return true;
}

export async function dbUpdateGuide(guideId, payload, topic, childName) {
  const patch = { payload };
  if (topic !== undefined) patch.topic = topic;
  if (childName !== undefined) patch.child_name = childName || '';
  const headers = await authHeaders();
  const r = await fetch(restUrl(`gd_guides?guide_id=eq.${encodeURIComponent(guideId)}`), {
    method: 'PATCH', headers, body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('가이드 수정 실패');
  return true;
}

// ── 즐겨찾기 — owner_id = Auth UUID ─────────────────────────
export async function dbGetFavorites(ownerId) {
  const headers = await authHeaders();
  const r = await fetch(restUrl(`gd_favorites?owner_id=eq.${encodeURIComponent(ownerId)}&select=items`), {
    headers,
  });
  if (!r.ok) throw new Error('즐겨찾기 조회 실패');
  const arr = await r.json();
  return arr[0] ? arr[0].items : null;
}

export async function dbSetFavorites(ownerId, items) {
  const headers = await authHeaders({ 'Prefer': 'resolution=merge-duplicates' });
  const r = await fetch(restUrl('gd_favorites'), {
    method: 'POST', headers,
    body: JSON.stringify({ owner_id: ownerId, items, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('즐겨찾기 저장 실패');
  return true;
}

// ── 커스텀 템플릿 (전체 공유, 관리자만 편집) ────────────────
export async function dbGetCustomTemplates() {
  const headers = await authHeaders();
  const r = await fetch(restUrl('gd_custom_templates?id=eq.1&select=data'), { headers });
  if (!r.ok) throw new Error('템플릿 조회 실패');
  const arr = await r.json();
  return arr[0] ? arr[0].data : {};
}

export async function dbSetCustomTemplates(data) {
  const headers = await authHeaders();
  const r = await fetch(restUrl('gd_custom_templates?id=eq.1'), {
    method: 'PATCH', headers,
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('템플릿 저장 실패');
  return true;
}

// ── 하위호환: 기존 App.jsx 가 import 하던 verifyPassword ──────
// A방식에서는 Auth가 검증하므로 직접 쓰이지 않지만, import 에러 방지용으로 남김.
export async function verifyPassword() {
  return false;
}

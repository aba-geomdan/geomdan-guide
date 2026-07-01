// ============================================================
// Supabase 데이터 계층 (REST 직접 호출)
// - 계정/가이드/즐겨찾기/커스텀템플릿을 중앙 DB에 저장
// - 비밀번호는 PBKDF2-SHA256 해시로 저장
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vdubgrxwijydwfabwpnk.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkdWJncnh3aWp5ZHdmYWJ3cG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk1ODgsImV4cCI6MjA5NzE4NTU4OH0.nqNO3vany3M6fzmG5BG6QVdvi8BW2UbhTDhxNnwvA88';

export function supabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON);
}

function restUrl(path) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

function baseHeaders(extra = {}) {
  return {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// ── PBKDF2 해시 ────────────────────────────────────────────
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  let salt;
  if (saltB64) {
    salt = new Uint8Array(b64ToBuf(saltB64));
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return { hash: bufToB64(bits), salt: bufToB64(salt.buffer || salt) };
}

export async function verifyPassword(password, saltB64, hashB64) {
  const { hash } = await hashPassword(password, saltB64);
  return hash === hashB64;
}

// ── 사용자 ─────────────────────────────────────────────────
export async function dbGetUser(id) {
  const res = await fetch(restUrl(`gd_users?id=eq.${encodeURIComponent(id)}&select=*`), {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error('사용자 조회 실패');
  const arr = await res.json();
  return arr[0] || null;
}

export async function dbListUsers() {
  const res = await fetch(restUrl('gd_users?select=*&order=created_at.asc'), {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error('사용자 목록 실패');
  return res.json();
}

export async function dbCreateUser({ id, name, role, password }) {
  const { hash, salt } = await hashPassword(password);
  const res = await fetch(restUrl('gd_users'), {
    method: 'POST',
    headers: baseHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify({ id, name, role, pw_hash: hash, pw_salt: salt }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (t.includes('duplicate')) throw new Error('이미 존재하는 아이디입니다');
    throw new Error('계정 생성 실패');
  }
  const arr = await res.json();
  return arr[0];
}

export async function dbUpdatePassword(id, newPassword) {
  const { hash, salt } = await hashPassword(newPassword);
  const res = await fetch(restUrl(`gd_users?id=eq.${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: baseHeaders(),
    body: JSON.stringify({ pw_hash: hash, pw_salt: salt }),
  });
  if (!res.ok) throw new Error('비밀번호 변경 실패');
  return true;
}

export async function dbDeleteUser(id) {
  const res = await fetch(restUrl(`gd_users?id=eq.${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error('계정 삭제 실패');
  return true;
}

// ── 가이드(보관함) ─────────────────────────────────────────
export async function dbListGuides(ownerId) {
  // ownerId 가 없으면(관리자 통합) 전체 조회
  const filter = ownerId ? `owner_id=eq.${encodeURIComponent(ownerId)}&` : '';
  const res = await fetch(restUrl(`gd_guides?${filter}select=*&order=created_at.desc`), {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error('보관함 조회 실패');
  return res.json();
}

export async function dbInsertGuide({ ownerId, topic, childName, payload }) {
  const res = await fetch(restUrl('gd_guides'), {
    method: 'POST',
    headers: baseHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify({ owner_id: ownerId, topic, child_name: childName || '', payload }),
  });
  if (!res.ok) throw new Error('가이드 저장 실패');
  const arr = await res.json();
  return arr[0];
}

export async function dbDeleteGuide(guideId) {
  const res = await fetch(restUrl(`gd_guides?guide_id=eq.${encodeURIComponent(guideId)}`), {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error('가이드 삭제 실패');
  return true;
}

export async function dbUpdateGuide(guideId, payload, topic, childName) {
  const patch = { payload };
  if (topic !== undefined) patch.topic = topic;
  if (childName !== undefined) patch.child_name = childName || '';
  const res = await fetch(restUrl(`gd_guides?guide_id=eq.${encodeURIComponent(guideId)}`), {
    method: 'PATCH',
    headers: baseHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('가이드 수정 실패');
  return true;
}

// ── 즐겨찾기 ───────────────────────────────────────────────
export async function dbGetFavorites(ownerId) {
  const res = await fetch(restUrl(`gd_favorites?owner_id=eq.${encodeURIComponent(ownerId)}&select=items`), {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error('즐겨찾기 조회 실패');
  const arr = await res.json();
  return arr[0] ? arr[0].items : null;
}

export async function dbSetFavorites(ownerId, items) {
  // upsert
  const res = await fetch(restUrl('gd_favorites'), {
    method: 'POST',
    headers: baseHeaders({ 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify({ owner_id: ownerId, items, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error('즐겨찾기 저장 실패');
  return true;
}

// ── 커스텀 템플릿 (전체 공유, 관리자 편집) ──────────────────
export async function dbGetCustomTemplates() {
  const res = await fetch(restUrl('gd_custom_templates?id=eq.1&select=data'), {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error('템플릿 조회 실패');
  const arr = await res.json();
  return arr[0] ? arr[0].data : {};
}

export async function dbSetCustomTemplates(data) {
  const res = await fetch(restUrl('gd_custom_templates?id=eq.1'), {
    method: 'PATCH',
    headers: baseHeaders(),
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error('템플릿 저장 실패');
  return true;
}

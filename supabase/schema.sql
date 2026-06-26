-- ============================================================
-- 검단ABA 가정연계 5분 가이드 — Supabase 테이블 설계
-- ============================================================
-- 목적:
--   1) 어디서든 로그인        → 계정을 중앙(users)에 저장
--   2) 본인 데이터 기기 무관   → 가이드를 중앙(guides)에 owner_id로 저장
--   3) 관리자 통합 조회        → 관리자는 전체 guides 조회
--
-- 인증 방식:
--   Supabase Auth 를 쓰지 않고, 앱이 직접 users 테이블로 로그인 검증.
--   비밀번호는 PBKDF2 해시로 저장(평문 저장 안 함).
--
-- 실행 방법:
--   Supabase 대시보드 → SQL Editor → 아래 전체 붙여넣고 Run.
-- ============================================================

-- 1) 사용자(계정) 테이블 ---------------------------------------
create table if not exists gd_users (
  id          text primary key,              -- 로그인 아이디 (영문/숫자)
  name        text not null,                 -- 표시 이름
  role        text not null default 'teacher', -- 'admin' 또는 'teacher'
  pw_hash     text not null,                 -- PBKDF2 해시 (base64)
  pw_salt     text not null,                 -- 솔트 (base64)
  is_active   boolean not null default true, -- 비활성화 플래그
  created_at  timestamptz not null default now()
);

-- 2) 가이드(보관함) 테이블 -------------------------------------
create table if not exists gd_guides (
  guide_id    uuid primary key default gen_random_uuid(),
  owner_id    text not null references gd_users(id) on delete cascade,
  topic       text not null,
  child_name  text default '',
  payload     jsonb not null,                -- 가이드 본문 전체(JSON)
  created_at  timestamptz not null default now()
);
create index if not exists gd_guides_owner_idx on gd_guides(owner_id);
create index if not exists gd_guides_created_idx on gd_guides(created_at desc);

-- 3) 즐겨찾기 테이블 -------------------------------------------
create table if not exists gd_favorites (
  owner_id    text primary key references gd_users(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,  -- 즐겨찾기 주제 배열
  updated_at  timestamptz not null default now()
);

-- 4) 커스텀 템플릿 테이블 (관리자 전용, 전체 공유) --------------
create table if not exists gd_custom_templates (
  id          int primary key default 1,     -- 항상 1행만 사용
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
insert into gd_custom_templates (id, data)
  values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- ============================================================
-- RLS(행 수준 보안)
-- ============================================================
-- 이 앱은 Supabase Auth 를 쓰지 않고 anon 키로 접근하므로,
-- auth.uid() 기반 RLS 는 적용할 수 없다.
-- 데이터 격리는 앱 코드(owner_id 필터)와 Edge Function 으로 처리한다.
--
-- anon 키로 테이블에 접근하려면 RLS 를 켜되 정책을 열어두거나,
-- 더 안전하게는 모든 읽기/쓰기를 Edge Function 으로 우회시킨다.
-- 여기서는 1차로 RLS 를 끄고(내부용), 배포 후 Edge Function 경유로
-- 강화하는 것을 권장한다. (배포방법.md 참고)

alter table gd_users            disable row level security;
alter table gd_guides           disable row level security;
alter table gd_favorites        disable row level security;
alter table gd_custom_templates disable row level security;

-- ============================================================
-- 최초 관리자 계정
-- ============================================================
-- 비밀번호 해시는 앱에서 생성해야 하므로, 여기서는 만들지 않는다.
-- 앱 최초 실행 시 관리자 계정이 없으면 자동 생성되도록 처리한다.
-- (.env 의 VITE_ADMIN_PASSWORD 사용)

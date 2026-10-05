-- Boys Wonder — schema สำหรับ Supabase (Postgres)
-- วิธีใช้: เปิด Supabase Dashboard → SQL Editor → วางไฟล์นี้ทั้งหมด → Run
-- แก้ตัวเลขใน INSERT ด้านล่างให้ตรงกับ Sheet ปัจจุบันก่อนกด Run

-- 1) ตารางคะแนน (7 คน)
create table if not exists scores (
  name text primary key,
  score integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 2) ตาราง log ทุกโหวต (ไว้ทำฟีดสด + สถิติ)
create table if not exists votes_log (
  id bigint generated always as identity primary key,
  name text not null,
  delta smallint not null check (delta in (1, -1)),
  created_at timestamptz not null default now()
);
create index if not exists votes_log_created_idx
  on votes_log (created_at desc);

-- 3) ล็อก RLS: ปิดไม่ให้ client ยิงตรง แล้วให้ server ใช้ service_role key เท่านั้น
alter table scores enable row level security;
alter table votes_log enable row level security;
-- (ไม่สร้าง policy ใดๆ = anon key ทำอะไรไม่ได้เลย service_role bypass RLS ได้)

-- 4) ฟังก์ชันโหวตแบบ atomic (กันกดพร้อมกันแล้วคะแนนหาย)
create or replace function vote_member(p_name text, p_delta smallint)
returns setof scores
language plpgsql
as $$
begin
  if p_delta not in (1, -1) then
    raise exception 'delta must be 1 or -1';
  end if;

  insert into votes_log (name, delta) values (p_name, p_delta);

  insert into scores (name, score, updated_at)
  values (p_name, p_delta, now())
  on conflict (name) do update
    set score = scores.score + excluded.score,
        updated_at = now();

  return query select * from scores;
end;
$$;

-- 5) seed คะแนนตั้งต้น (แก้ตัวเลขให้ตรง Sheet ปัจจุบันก่อน Run)
insert into scores (name, score) values
  ('พี่แม้ก', 0),
  ('น้องซี', 0),
  ('น้องไอซ์', 0),
  ('น้องเข้ม', 0),
  ('จารมอส', 0),
  ('ปอแซก', 0),
  ('พี่บาม', 0)
on conflict (name) do nothing;

-- 6) ตารางสมาชิก: ชื่อ / ฉายา / รูปโปร (แก้ผ่านหน้า /edit)
create table if not exists members (
  name text primary key,
  subtitle text not null default '',
  avatar_url text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table members enable row level security;
-- (ไม่สร้าง policy = anon อ่านไม่ได้ ให้ server ใช้ service_role เท่านั้น)

insert into members (name, subtitle, avatar_url, sort_order) values
  ('พี่แม้ก', 'จอมหัวร้อนประจำตึก', '', 0),
  ('น้องซี', 'สายซัพพอร์ต', '', 1),
  ('น้องไอซ์', 'แนวหน้าสายสับ', '', 2),
  ('น้องเข้ม', 'เงียบแต่เฉียบคม', '', 3),
  ('จารมอส', 'ปรมาจารย์แผนที่', '', 4),
  ('ปอแซก', 'ตัวฮาประจำวอยซ์', '', 5),
  ('พี่บาม', 'โปรเพลเยอร์ประจำทีม', '', 6)
on conflict (name) do nothing;

-- 7) ตั้งค่าข้อความเว็บ (แก้ผ่านหน้า /edit)
create table if not exists site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;

insert into site_settings (key, value) values
  ('site_name', 'BOYS WONDER'),
  ('site_tagline', 'CONDUCT PROTOCOL'),
  ('vote_title', 'โหวตความประพฤติ'),
  ('vote_subtitle', 'ใครก็กดได้ กดได้เรื่อยๆ ไม่จำกัด'),
  ('rule_threshold', '-10'),
  ('rule_text', 'ผู้ที่ได้แต้มต่ำกว่า -10 ในวันอาทิตย์ จะต้องเลี้ยงชานมไข่มุก หรือเป็นคนเปิดตี้เกมรอบดึกตามมติสภา Boys Wonder!')
on conflict (key) do nothing;

-- 8) ฟังก์ชันเปลี่ยนชื่อสมาชิกแบบ atomic (อัปเดต members + scores + votes_log พร้อมกัน)
create or replace function rename_member(p_old text, p_new text)
returns void
language plpgsql
as $$
begin
  if p_old is null or p_new is null or btrim(p_old) = '' or btrim(p_new) = '' then
    raise exception 'ชื่อห้ามว่าง';
  end if;
  if p_old = p_new then
    return;
  end if;
  if exists (select 1 from members where name = p_new) then
    raise exception 'มีชื่อนี้อยู่แล้ว';
  end if;
  update members set name = p_new where name = p_old;
  update scores set name = p_new, updated_at = now() where name = p_old;
  update votes_log set name = p_new where name = p_old;
end;
$$;

-- 9) Storage bucket สำหรับรูปโปรไฟล์ (public read, เขียนผ่าน service_role เท่านั้น)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- policy อ่านรูปได้ทุกคน (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars public read'
  ) then
    create policy "avatars public read"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
end
$$;

-- 10) ระบบ role: role กลาง + ผูก role ให้แต่ละสมาชิก (จัดการผ่านหน้า /edit)
create table if not exists roles (
  name text primary key,
  color text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table roles enable row level security;

create table if not exists member_roles (
  member_name text not null,
  role_name text not null,
  created_at timestamptz not null default now(),
  primary key (member_name, role_name)
);
alter table member_roles enable row level security;
-- (ทั้งสองตารางไม่สร้าง policy = anon อ่านไม่ได้ ให้ server ใช้ service_role เท่านั้น)

-- FK แบบ cascade: เปลี่ยนชื่อ/ลบสมาชิกหรือ role แล้วตารางผูกอัปเดตตามเอง
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'member_roles_member_fk') then
    alter table member_roles
      add constraint member_roles_member_fk
      foreign key (member_name) references members (name)
      on update cascade on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'member_roles_role_fk') then
    alter table member_roles
      add constraint member_roles_role_fk
      foreign key (role_name) references roles (name)
      on update cascade on delete cascade;
  end if;
end
$$;

-- 11) รูปพื้นหลังการ์ดสมาชิก (ใส่ผ่านหน้า /edit)
alter table members add column if not exists bg_url text not null default '';

-- 12) อัปเดตฟังก์ชันเปลี่ยนชื่อให้พาประวัติ role ไปด้วย (กัน DB ที่ FK ยังไม่เข้า)
create or replace function rename_member(p_old text, p_new text)
returns void
language plpgsql
as $$
begin
  if p_old is null or p_new is null or btrim(p_old) = '' or btrim(p_new) = '' then
    raise exception 'ชื่อห้ามว่าง';
  end if;
  if p_old = p_new then
    return;
  end if;
  if exists (select 1 from members where name = p_new) then
    raise exception 'มีชื่อนี้อยู่แล้ว';
  end if;
  update members set name = p_new where name = p_old;
  update scores set name = p_new, updated_at = now() where name = p_old;
  update votes_log set name = p_new where name = p_old;
  update member_roles set member_name = p_new where member_name = p_old;
end;
$$;

-- 13) ประวัติการลบสมาชิก + เหตุผล (ดูได้ในหน้า /edit)
create table if not exists deleted_log (
  id bigint generated always as identity primary key,
  name text not null,
  reason text not null default '',
  hard boolean not null default false,
  created_at timestamptz not null default now()
);
alter table deleted_log enable row level security;
-- (ไม่สร้าง policy = anon อ่านไม่ได้ ให้ server ใช้ service_role เท่านั้น)

-- 14) เหตุผลตอนกดโหวต (+1 / -1 บังคับกรอกทุกครั้ง): เก็บใน votes_log
alter table votes_log add column if not exists reason text not null default '';

create or replace function vote_member(p_name text, p_delta smallint, p_reason text default '')
returns setof scores
language plpgsql
as $$
begin
  if p_delta not in (1, -1) then
    raise exception 'delta must be 1 or -1';
  end if;

  insert into votes_log (name, delta, reason) values (p_name, p_delta, coalesce(p_reason, ''));

  insert into scores (name, score, updated_at)
  values (p_name, p_delta, now())
  on conflict (name) do update
    set score = scores.score + excluded.score,
        updated_at = now();

  return query select * from scores;
end;
$$;

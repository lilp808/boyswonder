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

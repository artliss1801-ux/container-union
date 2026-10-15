-- =====================================================================
--  Платформа «Контейнерный Союз» — схема базы данных (Supabase / PostgreSQL)
--  Версия 1.1 · 15.10.2026
--
--  Как применить: Supabase → проект → SQL Editor → New query →
--  вставить весь файл → Run. Затем «Settings → API» и взять Project URL
--  и anon public key в файл config.js.
--
--  ВАЖНО про безопасность: ниже включён режим «прототип» — открытые
--  политики (anon может читать и писать). Это допустимо только на этапе
--  демонстрации. Перед реальным запуском включите блок STRICT-РЕЖИМ
--  в конце файла (потребуется авторизация Supabase Auth).
-- =====================================================================

-- ---------- 1. Тарифная сетка ----------
create table if not exists tariff (
  id          int primary key default 1,
  version     text        not null,
  approved    date        not null default current_date,
  approved_by text        not null default '—',
  val         jsonb       not null,
  updated_at  timestamptz not null default now(),
  constraint tariff_single_row check (id = 1)
);

create table if not exists tariff_log (
  id          bigserial primary key,
  version     text        not null,
  approved    date        not null,
  approved_by text        not null,
  val         jsonb       not null,
  created_at  timestamptz not null default now()
);

-- ---------- 2. Перевозчики и заявки на верификацию ----------
create table if not exists carriers (
  id         text primary key,
  name       text        not null,
  form       text,
  inn        text,
  city       text,
  region     text,
  fleet      int         default 0,
  containers int         default 0,
  types      text[]      default '{}',
  status     text        not null default 'pending',   -- pending | verified | suspended
  joined     date        default current_date,
  docs       jsonb       default '{}'::jsonb,           -- чек-лист доверия
  metrics    jsonb       default '{}'::jsonb,           -- показатели для рейтинга
  demo       boolean     default false,                 -- демонстрационный профиль (в счёт выборов не идёт)
  created_at timestamptz default now()
);

create table if not exists applications (
  id         text primary key,
  name       text not null,
  city       text,
  inn        text,
  fleet      int  default 0,
  containers int  default 0,
  submitted  date default current_date,
  status     text default 'pending',                    -- pending | verified | rejected
  docs       boolean default false,
  created_at timestamptz default now()
);

-- ---------- 3. Биржа грузов и ставки ----------
create table if not exists loads (
  id         text primary key,
  from_city  text not null,
  to_city    text not null,
  type       text,
  cargo      text,
  weight     numeric(6,2),
  pickup     date,
  shipper    text,
  status     text default 'open',                       -- open | bid | assigned | done
  mode       text default 'внутрироссия',              -- импорт | экспорт | внутрироссия | транзит
  bids       int  default 0,
  floor      bigint default 0,                          -- минимальная ставка Совета, ₽
  carrier_id text references carriers(id) on delete set null,
  rate       bigint,
  created_at timestamptz default now()
);

create table if not exists bids (
  id         bigserial primary key,
  load_id    text not null references loads(id) on delete cascade,
  carrier_id text,
  rate       bigint not null,
  days       int,
  kind       text default 'bid',                        -- bid | assign
  created_at timestamptz default now()
);

-- ---------- 4. Совет перевозчиков ----------
create table if not exists council_members (
  id         text primary key,
  name       text not null,
  company    text,
  city       text,
  district   text,
  committee  text,
  until      date,
  elected_by int  default 0,
  chair      boolean default false,
  created_at timestamptz default now()
);

create table if not exists votes (
  id         text primary key,
  kind       text not null,                             -- tariff | org | charter
  title      text not null,
  summary    text,
  author     text,
  created    date default current_date,
  deadline   date not null,
  payload    jsonb default '{}'::jsonb,
  status     text default 'voting',                     -- voting | passed | rejected | expired
  result     jsonb,
  created_at timestamptz default now()
);

create table if not exists vote_ballots (
  vote_id   text not null references votes(id) on delete cascade,
  member_id text not null,
  choice    text not null,                              -- for | against | abstain | none
  at        timestamptz default now(),
  primary key (vote_id, member_id)
);

create table if not exists decisions (
  id         text primary key,                          -- = номер принятого вопроса
  title      text not null,
  kind       text,
  at         date default current_date,
  result     text,
  effect     text,
  created_at timestamptz default now()
);

-- Настройки платформы (переходный период, выборы Совета)
create table if not exists settings (
  key        text primary key,
  val        jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists journal (
  id   bigserial primary key,
  at   date default current_date,
  text text not null,
  created_at timestamptz default now()
);

-- ---------- 5. Представления (то, что видно в отчётах) ----------
-- Итоги голосований с порогами: тариф 6/9, платформа 5/9, Устав 7/9, кворум 7
create or replace view v_vote_results as
select v.id,
       v.kind,
       v.title,
       v.status,
       v.deadline,
       count(*) filter (where b.choice = 'for')     as votes_for,
       count(*) filter (where b.choice = 'against') as votes_against,
       count(*) filter (where b.choice = 'abstain') as votes_abstain,
       count(*) filter (where b.choice is not null and b.choice <> 'none') as cast,
       case v.kind when 'tariff' then 6 when 'charter' then 7 else 5 end as threshold,
       7 as quorum
from votes v
left join vote_ballots b on b.vote_id = v.id and b.choice <> 'none'
group by v.id, v.kind, v.title, v.status, v.deadline;

-- Реестр перевозчиков «как его видит грузовладелец»
create or replace view v_registry as
select c.id,
       c.name,
       c.form,
       c.inn,
       c.city,
       c.region,
       c.fleet,
       c.containers,
       c.types,
       c.status,
       c.joined,
       (select count(*) from loads l where l.carrier_id = c.id)              as loads_total,
       (select count(*) from loads l where l.carrier_id = c.id and l.status = 'done') as loads_done
from carriers c
where c.status <> 'suspended'
  and coalesce(c.demo, false) = false;

-- Экономика плеч: сколько рейсов и по какой средней ставке прошло
create or replace view v_route_stats as
select from_city,
       to_city,
       type,
       count(*)                                                  as loads_total,
       count(*) filter (where status = 'done')                   as loads_done,
       round(avg(rate) filter (where rate is not null))          as avg_rate,
       max(floor)                                                as council_floor
from loads
group by from_city, to_city, type;

-- ---------- 6. Триггеры ----------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_tariff_touch on tariff;
create trigger trg_tariff_touch before update on tariff
  for each row execute function touch_updated_at();

-- История тарифной сетки: при изменении активной версии пишем снимок
create or replace function log_tariff_version() returns trigger as $$
begin
  insert into tariff_log(version, approved, approved_by, val)
  values (new.version, new.approved, new.approved_by, new.val);
  return new;
end $$ language plpgsql;

drop trigger if exists trg_tariff_log on tariff;
create trigger trg_tariff_log after insert or update on tariff
  for each row execute function log_tariff_version();

-- Журнал: при принятии решения пишем строку в журнал
create or replace function log_decision() returns trigger as $$
begin
  insert into journal(text) values (new.id || ': ' || new.title || ' — ' || coalesce(new.result, 'принято'));
  return new;
end $$ language plpgsql;

drop trigger if exists trg_decision_log on decisions;
create trigger trg_decision_log after insert on decisions
  for each row execute function log_decision();

-- ---------- 7. Данные для старта ----------
-- Текущая тарифная сетка (значения соответствуют прототипу: ДТ 86,72 ₽/л — Росстат на 05.10.2026,
-- «Платон» 3,53 ₽/км с 01.02.2026, ориентир рынка 88 ₽/км)
insert into tariff (id, version, approved, approved_by, val)
values (1, 'в. 2.3', date '2026-08-20', 'Решение ТАР-2026-02',
  '{"fuelPrice":86.72,"fuelConsLoaded":33,"fuelConsEmpty":26,"platon":3.53,"platonShare":85,
    "leasing":14,"driverKm":9,"perDiem":1800,"repair":5.5,"tires":1.9,"insurance":2.4,
    "overheadPct":14,"marginBase":14,"marginMin":4,"detentionFree":4,"detentionRate":1500,
    "marketPerKm":88,"seasonK":6,"urgencyK":10,"emptyReturnK":35}'::jsonb)
on conflict (id) do nothing;

-- Совет перевозчиков: таблица пуста до выборов.
-- Переходный период: тарифную сетку ведёт Администрация строго по методике,
-- проекты решений публикуются как открытые обсуждения.
-- Выборы назначаются при достижении 50 реальных верифицированных перевозчиков:
--   выдвижение кандидатов — 20 дней, кумулятивное голосование участников — 15 дней,
--   квоты по округам: ЮФО/СКФО — 2, СЗФО — 2, ЦФО — 1, ПФО — 1, УФО/СФО — 2, ДФО — 1.
-- После голосования избранные 9 членов вносятся так:
--   insert into council_members (id,name,company,city,district,committee,until,elected_by,chair)
--   values ('M-1','Фамилия Имя Отчество','ООО «Компания»','Город','ЮФО','Тарифный комитет', date '2028-10-15', 120, true);

insert into settings (key, val) values
  ('council', '{"demoCouncil": false, "electionThreshold": 50, "elections": null}'::jsonb)
on conflict (key) do nothing;

-- ---------- 8. Режим «прототип»: открытые политики ----------
-- ПОМНИТЕ: при таких политиках любой, у кого есть anon-ключ, может читать и писать.
-- Для прототипа и приёма первых заявок это допустимо; перед реальным запуском
-- примените STRICT-РЕЖИМ ниже.
alter table tariff          enable row level security;
alter table tariff_log      enable row level security;
alter table carriers        enable row level security;
alter table applications    enable row level security;
alter table loads           enable row level security;
alter table bids            enable row level security;
alter table council_members enable row level security;
alter table votes           enable row level security;
alter table vote_ballots    enable row level security;
alter table decisions       enable row level security;
alter table journal         enable row level security;
alter table settings        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tariff','tariff_log','carriers','applications','loads','bids',
                            'council_members','votes','vote_ballots','decisions','journal','settings']
  loop
    execute format('drop policy if exists proto_all on %I', t);
    execute format('create policy proto_all on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- 9. STRICT-РЕЖИМ (включить перед реальным запуском) ----------
-- 1) Authentication → включить Email/Phone вход, а также MFA для членов Совета.
-- 2) Добавить в carriers колонку owner uuid references auth.users(id) и заполнять её при регистрации.
-- 3) Заменить политики proto_all на:
--    -- чтение открытых данных — всем
--    create policy read_all on carriers for select to anon, authenticated using (true);
--    create policy read_loads on loads  for select to anon, authenticated using (true);
--    -- изменение карточки — только владелец
--    create policy own_carrier on carriers for update to authenticated
--      using (owner = auth.uid()) with check (owner = auth.uid());
--    -- ставки и заявки — только авторизованные
--    create policy ins_loads on loads for insert to authenticated with check (true);
--    create policy ins_bids  on bids  for insert to authenticated with check (true);
--    -- бюллетени Совета — только члены Совета (таблица сопоставления user_id → member_id)
--    create policy ins_ballot on vote_ballots for insert to authenticated
--      with check (exists (select 1 from council_users cu
--                          where cu.user_id = auth.uid() and cu.member_id = vote_ballots.member_id));
--    -- тариф, решения и settings — только Администрация (роль service_role, ключ НИКОГДА не публикуется)
-- 4) anon-ключ оставить только на чтение открытых данных; все записи — через authenticated.

-- ---------- 10. Полезные проверки ----------
-- select * from v_vote_results order by deadline desc;     -- итоги голосований
-- select * from v_registry order by fleet desc;            -- реестр перевозчиков
-- select * from v_route_stats order by loads_total desc;   -- статистика по плечам
-- select * from tariff_log order by created_at desc;       -- история тарифной сетки
-- select count(*) from carriers where status='verified' and coalesce(demo,false)=false;
--                                                          -- готовность к выборам Совета (порог 50)
-- select * from settings;                                   -- статус переходного периода и выборов
-- delete from carriers where demo;                          -- удалить демонстрационные профили

-- =====================================================================
--  «Контейнерный Союз» — СТРОГИЕ ПРАВИЛА ДОСТУПА К БАЗЕ (RLS)
--  Заменяет режим «прототип» на нормальную защиту:
--    • читать может любой (прозрачность платформы);
--    • регистрироваться и размещать заявки может любой;
--    • менять статусы, тарифы, решения Совета и настройки — только кураторы.
--
--  ПОРЯДОК ПРИМЕНЕНИЯ (5 минут):
--   1) Supabase → Authentication → Users → Add user:
--      укажите e-mail Администрации и пароль, включите «Auto Confirm User».
--   2) Authentication → Sign In / Providers (или Settings) → выключите
--      «Allow new users to sign up» — регистрация посторонних закрыта.
--   3) SQL Editor → вставьте весь этот файл → Run.
--   4) В конце файла раскомментируйте и выполните один INSERT INTO curators,
--      указав тот же e-mail — это выдаёт вашему аккаунту права Администратора.
--   5) На сайте нажмите «Вход» в шапке и войдите этим e-mail и паролем.
--
--  Проверка: без входа кнопки админ-панели не работают, а прямые запросы
--  к базе на изменение отклоняются (это видно в консоли браузера).
-- =====================================================================

-- ---------- 1. Таблица кураторов (Администрация платформы) ----------
create table if not exists curators (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text default 'admin',          -- admin | council (после выборов Совета)
  created_at timestamptz default now()
);

alter table curators enable row level security;
drop policy if exists curator_self on curators;
-- куратор видит только свою запись; управление — через SQL Editor
create policy curator_self on curators for select to authenticated using (user_id = auth.uid());

-- Функция проверки прав: читает таблицу кураторов в обход RLS
create or replace function is_curator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from curators where user_id = auth.uid());
$$;
revoke all on function is_curator() from public;
grant execute on function is_curator() to anon, authenticated;

-- ---------- 2. Снимаем открытые политики режима «прототип» ----------
do $$
declare t text;
begin
  foreach t in array array['tariff','tariff_log','carriers','applications','loads','bids',
                            'council_members','votes','vote_ballots','decisions','journal','settings']
  loop
    execute format('drop policy if exists proto_all on %I', t);
  end loop;
end $$;

-- ---------- 3. Чтение: открыто всем (кроме заявок на верификацию) ----------
do $$
declare t text;
begin
  foreach t in array array['tariff','tariff_log','carriers','loads','bids',
                            'council_members','votes','vote_ballots','decisions','journal','settings']
  loop
    execute format('drop policy if exists read_all on %I', t);
    execute format('create policy read_all on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Заявки на верификацию содержат ИНН и контакты — читают только кураторы
drop policy if exists read_all on applications;
drop policy if exists curator_read_applications on applications;
create policy curator_read_applications on applications for select to authenticated using (is_curator());

-- ---------- 4. Публичная запись: то, что делает любой участник ----------
-- Регистрация перевозчика: только со статусом «ожидает верификации» и без пометки «демо»
drop policy if exists anon_insert_carriers on carriers;
create policy anon_insert_carriers on carriers for insert to anon, authenticated
  with check (coalesce(demo, false) = false and status = 'pending');

-- Заявка на верификацию
drop policy if exists anon_insert_applications on applications;
create policy anon_insert_applications on applications for insert to anon, authenticated with check (true);

-- Размещение заявки грузовладельцем
drop policy if exists anon_insert_loads on loads;
create policy anon_insert_loads on loads for insert to anon, authenticated with check (true);

-- Ставка перевозчика по заявке
drop policy if exists anon_insert_bids on bids;
create policy anon_insert_bids on bids for insert to anon, authenticated with check (true);

-- Журнал платформы (записи о действиях)
drop policy if exists anon_insert_journal on journal;
create policy anon_insert_journal on journal for insert to anon, authenticated with check (true);

-- ---------- 5. Изменения: только кураторы ----------
do $$
declare t text;
begin
  foreach t in array array['carriers','applications','loads','bids','council_members',
                            'votes','vote_ballots','decisions','journal','settings','tariff','tariff_log']
  loop
    execute format('drop policy if exists curator_all on %I', t);
    execute format('create policy curator_all on %I for all to authenticated using (is_curator()) with check (is_curator())', t);
  end loop;
end $$;

-- ---------- 6. Выдача прав Администрации ----------
-- Раскомментируйте, подставьте e-mail из шага 1 и выполните отдельно:
--
-- insert into curators (user_id, email, role)
-- select id, email, 'admin' from auth.users where email = 'ВАШ_EMAIL@пример.ру'
-- on conflict (user_id) do nothing;
--
-- Проверить, кто уже куратор:
-- select c.email, c.role, c.created_at from curators c order by c.created_at;

-- ---------- 7. Что теперь можно и нельзя (для проверки) ----------
--  • без входа (anon):
--      select — можно; insert в carriers/applications/loads/bids/journal — можно;
--      update/delete — нельзя; чтение applications — нельзя.
--  • после входа куратором (authenticated + запись в curators):
--      всё можно, включая тарифную сетку и решения Совета.
--  • после регистрации на сайте под своим e-mail без записи в curators:
--      права как у обычного анонимного участника — изменения будут отклонены.

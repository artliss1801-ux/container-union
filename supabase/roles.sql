-- =====================================================================
--  «Контейнерный Союз» — РОЛИ УЧАСТНИКОВ
--  Заменяет прежнюю модель «кураторов» (таблица curators) на роли:
--    admin    — администратор платформы (назначает только администратор);
--    council  — член Совета перевозчиков (назначает администратор после выборов);
--    carrier  — перевозчик (роль присваивается АВТОМАТИЧЕСКИ при регистрации).
--  Главный администратор (владелец платформы) помечен is_primary: его нельзя
--  понизить в правах или удалить никому — ни из интерфейса, ни через API.
--
--  ПОРЯДОК ПРИМЕНЕНИЯ:
--    Supabase → SQL Editor → вставить весь файл → Run.  Ожидаемый ответ: Success.
--  Файл можно запускать повторно — повторный запуск безопасен.
--  Он заменяет правила доступа из supabase/security.sql (запускать security.sql после него не нужно).
-- =====================================================================

-- ---------- 1. Таблица ролей участников ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'carrier' check (role in ('admin','council','carrier')),
  is_primary boolean not null default false,        -- главный администратор платформы (владелец)
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table profiles enable row level security;

-- ---------- 2. Функции прав ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','council'));
$$;
revoke all on function is_admin() from public;
revoke all on function is_member() from public;
grant execute on function is_admin() to anon, authenticated;
grant execute on function is_member() to anon, authenticated;

-- ---------- 3. Кто что видит и меняет в таблице ролей ----------
drop policy if exists profiles_self_read on profiles;
drop policy if exists profiles_admin_all on profiles;
-- участник видит свою роль; администратор видит всех
create policy profiles_self_read on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
-- менять роли (назначать и снимать администраторов и членов Совета) может только администратор
create policy profiles_admin_all on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 4. Защита главного администратора ----------
create or replace function profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Служебные операции из SQL-редактора Supabase (без пользователя) не ограничиваем:
  -- иначе нельзя ни перенести главного администратора, ни исправить данные руками.
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and old.is_primary then
    if new.role <> 'admin' then raise exception 'Главного администратора платформы нельзя понизить в правах'; end if;
    if new.is_primary = false then raise exception 'С главного администратора нельзя снять признак владельца'; end if;
  end if;
  if tg_op = 'DELETE' and old.is_primary then
    raise exception 'Главного администратора платформы нельзя удалить';
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' and not is_admin() then
    raise exception 'Назначать администраторов может только администратор';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update or delete on profiles
  for each row execute function profiles_guard();

-- ---------- 5. Роль автоматически при регистрации ----------
-- Новый аккаунт (регистрация перевозчика на сайте) сразу получает роль «перевозчик».
create or replace function profiles_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, role, note)
  values (new.id, new.email, 'carrier', 'автоматически при регистрации')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists profiles_on_signup on auth.users;
create trigger profiles_on_signup after insert on auth.users
  for each row execute function profiles_on_signup();

-- ---------- 6. Перенос действующих администраторов из таблицы curators ----------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'curators') then
    insert into profiles (id, email, role, is_primary, note)
    select c.user_id, c.email, 'admin', (c.user_id = (select c2.user_id from curators c2
             where coalesce(c2.role,'admin') = 'admin' order by c2.created_at limit 1)),
           'перенесён из таблицы curators'
    from curators c
    where coalesce(c.role, 'admin') = 'admin'
    on conflict (id) do update set role = 'admin', is_primary = true;
  end if;
end $$;

-- ---------- 7. Привязки, нужные правилам ниже ----------
alter table carriers add column if not exists owner uuid;
alter table council_members add column if not exists user_id uuid;

-- ---------- 8. Замена правил: изменения делает администратор ----------
do $$
declare t text;
begin
  foreach t in array array['carriers','applications','loads','bids','council_members','votes',
                            'decisions','journal','settings','tariff','tariff_log','vote_ballots']
  loop
    execute format('drop policy if exists curator_all on %I', t);
    execute format('drop policy if exists admin_all on %I', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Заявки на верификацию содержат ИНН и контакты — читает только администратор
drop policy if exists curator_read_applications on applications;
drop policy if exists admin_read_applications on applications;
create policy admin_read_applications on applications for select to authenticated using (is_admin());

-- Член Совета голосует лично: бюллетень только по своей карточке Совета
drop policy if exists member_ballot_write on vote_ballots;
create policy member_ballot_write on vote_ballots for all to authenticated
  using (is_member() and exists (select 1 from council_members m where m.id = member_id and m.user_id = auth.uid()))
  with check (is_member() and exists (select 1 from council_members m where m.id = member_id and m.user_id = auth.uid()));

-- Член Совета может вносить предложения на голосование
drop policy if exists member_votes_write on votes;
create policy member_votes_write on votes for all to authenticated
  using (is_member()) with check (is_member());

-- Регистрация (карточка перевозчика): карточку создаёт сам перевозчик и не может объявить себя проверенным
drop policy if exists anon_insert_carriers on carriers;
create policy anon_insert_carriers on carriers for insert to anon, authenticated
  with check (coalesce(demo, false) = false and status = 'pending'
              and (owner is null or owner = auth.uid()));

-- Перевозчик сам ведёт свою карточку, пока она не верифицирована
drop policy if exists own_carrier_update on carriers;
create policy own_carrier_update on carriers for update to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid() and coalesce(demo, false) = false and status in ('pending','suspended'));

-- ---------- 9. Убираем прежнюю модель «кураторов» ----------
drop function if exists is_curator();
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'curators') then
    drop table curators;
  end if;
end $$;

-- ---------- 10. Как этим пользоваться ----------
--  • Перевозчик: заполняет форму в разделе «Кабинет» — создаётся аккаунт (e-mail и пароль),
--    роль «перевозчик» присваивается автоматически, карточка попадает в реестр как «ожидает верификации».
--  • Администратор (главный): входит со своим e-mail и паролем, в «Кабинете» видит раздел
--    «Пользователи и роли» и назначает новых администраторов и членов Совета.
--  • Назначить администратора можно только из аккаунта администратора — иначе база отклонит запрос.
--  • Главного администратора нельзя понизить или удалить (защита на уровне базы).
--
-- Проверить состав ролей:
--   select email, role, is_primary, created_at from profiles order by created_at;
-- Сделать члена Совета членом (в интерфейсе это делается кнопкой, для справки):
--   update profiles set role = 'council' where email = 'member@example.com';

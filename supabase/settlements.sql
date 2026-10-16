-- Дополнения к базе населённых пунктов: порты, терминалы, пункты пропуска.
-- Основная база городов России (1130 пунктов) встроена в индекс сборки,
-- здесь — то, что дополняют и уточняют участники платформы.
create table if not exists settlements (
  id bigserial primary key,
  name text not null,
  region text,
  okrug text,
  lat double precision not null,
  lon double precision not null,
  population integer default 0,
  kind text default 'город',
  source text default 'platform',
  created_at timestamptz default now()
);
create unique index if not exists settlements_name_region_uidx on settlements (lower(name), coalesce(lower(region), ''));
create index if not exists settlements_name_idx on settlements (lower(name));
alter table settlements enable row level security;
drop policy if exists settlements_read_all on settlements;
create policy settlements_read_all on settlements for select using (true);
drop policy if exists settlements_admin_all on settlements;
create policy settlements_admin_all on settlements for all using (is_admin()) with check (is_admin());
grant select on settlements to anon, authenticated;
grant insert, update, delete on settlements to authenticated;
grant usage, select on sequence settlements_id_seq to authenticated;
insert into settlements (name, region, okrug, lat, lon, population, kind, source) values
  ('Усть-Луга','Ленинградская','СЗФО',59.672,28.283,2400,'порт','platform'),
  ('Бронка','Ленинградская','СЗФО',59.952,29.68,0,'порт','platform'),
  ('Тамань','Краснодарский','ЮФО',45.212,36.716,11000,'порт','platform'),
  ('Порт Кавказ','Краснодарский','ЮФО',45.339,36.675,0,'порт','platform'),
  ('Сабетта','Ямало-Ненецкий','УФО',71.273,72.063,0,'порт','platform'),
  ('Восточный','Приморский','ДФО',42.766,133.0,0,'порт','platform'),
  ('Дальний (Мурманск)','Мурманская','СЗФО',69.05,33.12,0,'порт','platform'),
  ('Оля','Астраханская','ЮФО',45.79,47.55,1200,'порт','platform'),
  ('Славянка (порт)','Приморский','ДФО',42.86,131.38,0,'порт','platform'),
  ('Зарубино','Приморский','ДФО',42.63,131.06,2900,'порт','platform'),
  ('Торфяновка','Ленинградская','СЗФО',60.65,28.55,0,'таможня','platform'),
  ('Брусничное','Ленинградская','СЗФО',61.02,28.79,0,'таможня','platform'),
  ('Ивангород','Ленинградская','СЗФО',59.37,28.22,9800,'таможня','platform'),
  ('Бурачки','Псковская','СЗФО',56.32,28.25,0,'таможня','platform'),
  ('Верхний Ларс','Северная Осетия','СКФО',42.79,44.63,0,'таможня','platform'),
  ('Хасан','Приморский','ДФО',42.43,130.65,0,'таможня','platform'),
  ('Пограничный','Приморский','ДФО',44.41,131.38,10600,'таможня','platform'),
  ('Забайкальск','Забайкальский','ДФО',49.65,117.32,11700,'таможня','platform'),
  ('Кяхта','Бурятия','СФО',50.35,106.45,20000,'таможня','platform'),
  ('Мамонтово','Калининградская','СЗФО',54.45,19.81,0,'таможня','platform'),
  ('Белый Раст','Московская','ЦФО',56.15,37.45,0,'терминал','platform'),
  ('Электроугли (терминал)','Московская','ЦФО',55.72,38.2,0,'терминал','platform'),
  ('Химки (терминал)','Московская','ЦФО',55.89,37.43,0,'терминал','platform'),
  ('Колпино (терминал)','Санкт-Петербург','СЗФО',59.75,30.6,0,'терминал','platform'),
  ('Шушары (терминал)','Санкт-Петербург','СЗФО',59.8,30.38,0,'терминал','platform')
on conflict do nothing;

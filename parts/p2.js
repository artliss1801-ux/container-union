/* ============================================================
   Контейнерный Союз — прототип платформы контейнерных автоперевозок
   Часть 1/2: модель данных, тарифная сетка, расчёт ставки, рейтинг, Совет
   ============================================================ */
'use strict';

/* ---------- утилиты ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmt   = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const fmt2  = n => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const money = n => fmt(n) + ' ₽';
const num   = v => { const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isNaN(x) ? 0 : x; };
const uid   = p => p + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() + (Date.now() % 1000);
const esc   = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => new Date().toISOString().slice(0, 10);
const dt = iso => iso ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const addDays = (iso, d) => { const x = new Date(iso); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso) - new Date()) / 86400000));
const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; };

/* ---------- хранилище (localStorage с откатом в память) ---------- */
const Store = (() => {
  const mem = {}; let ls = false;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); ls = true; } catch (e) { ls = false; }
  return {
    ls,
    get(k, def) { try { const v = ls ? localStorage.getItem(k) : mem[k]; return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { const s = JSON.stringify(v); if (ls) { try { localStorage.setItem(k, s); return true; } catch (e) { mem[k] = s; return false; } } mem[k] = s; return true; },
    reset() { if (ls) { try { localStorage.clear(); } catch (e) { } } for (const k in mem) delete mem[k]; }
  };
})();

/* ---------- справочник городов (координаты для справочного расчёта плеча) ---------- */
const CITIES = [
  ['Москва', 55.755, 37.617, 'ЦФО', 'терминал'],
  ['Санкт-Петербург', 59.938, 30.314, 'СЗФО', 'порт'],
  ['Новороссийск', 44.724, 37.768, 'ЮФО', 'порт'],
  ['Калининград', 54.710, 20.452, 'СЗФО', 'порт'],
  ['Мурманск', 68.958, 33.083, 'СЗФО', 'порт'],
  ['Архангельск', 64.539, 40.518, 'СЗФО', 'порт'],
  ['Екатеринбург', 56.838, 60.605, 'УФО', 'терминал'],
  ['Казань', 55.796, 49.106, 'ПФО', 'терминал'],
  ['Нижний Новгород', 56.326, 44.006, 'ПФО', 'терминал'],
  ['Самара', 53.196, 50.150, 'ПФО', 'терминал'],
  ['Уфа', 54.738, 55.972, 'ПФО', 'терминал'],
  ['Челябинск', 55.164, 61.436, 'УФО', 'терминал'],
  ['Пермь', 58.010, 56.250, 'ПФО', 'терминал'],
  ['Волгоград', 48.719, 44.502, 'ЮФО', 'терминал'],
  ['Ростов-на-Дону', 47.231, 39.723, 'ЮФО', 'терминал'],
  ['Краснодар', 45.035, 38.975, 'ЮФО', 'терминал'],
  ['Воронеж', 51.661, 39.200, 'ЦФО', 'терминал'],
  ['Саратов', 51.533, 46.034, 'ПФО', 'терминал'],
  ['Тюмень', 57.153, 65.534, 'УФО', 'терминал'],
  ['Омск', 54.992, 73.368, 'СФО', 'терминал'],
  ['Новосибирск', 55.030, 82.920, 'СФО', 'терминал'],
  ['Барнаул', 53.355, 83.771, 'СФО', 'терминал'],
  ['Красноярск', 56.010, 92.852, 'СФО', 'терминал'],
  ['Иркутск', 52.286, 104.280, 'СФО', 'терминал'],
  ['Улан-Удэ', 51.828, 107.606, 'ДФО', 'терминал'],
  ['Чита', 52.034, 113.500, 'ДФО', 'терминал'],
  ['Хабаровск', 48.482, 135.083, 'ДФО', 'терминал'],
  ['Владивосток', 43.116, 131.885, 'ДФО', 'порт'],
  ['Ярославль', 57.626, 39.874, 'ЦФО', 'город'],
  ['Тула', 54.196, 37.618, 'ЦФО', 'город'],
  ['Брянск', 53.243, 34.363, 'ЦФО', 'город'],
  ['Смоленск', 54.782, 32.045, 'ЦФО', 'город'],
  ['Тверь', 56.858, 35.911, 'ЦФО', 'город'],
  ['Владимир', 56.136, 40.397, 'ЦФО', 'город'],
  ['Рязань', 54.626, 39.691, 'ЦФО', 'город'],
  ['Липецк', 52.608, 39.600, 'ЦФО', 'город'],
  ['Белгород', 50.595, 36.587, 'ЦФО', 'город'],
  ['Курск', 51.737, 36.187, 'ЦФО', 'город'],
  ['Тамбов', 52.722, 41.452, 'ЦФО', 'город'],
  ['Пенза', 53.195, 45.018, 'ПФО', 'город'],
  ['Ульяновск', 54.318, 48.403, 'ПФО', 'город'],
  ['Чебоксары', 56.143, 47.251, 'ПФО', 'город'],
  ['Киров', 58.603, 49.668, 'ПФО', 'город'],
  ['Ижевск', 56.852, 53.211, 'ПФО', 'город'],
  ['Оренбург', 51.768, 55.097, 'ПФО', 'город'],
  ['Вологда', 59.220, 39.891, 'СЗФО', 'город'],
  ['Петрозаводск', 61.789, 34.346, 'СЗФО', 'город'],
  ['Астрахань', 46.349, 48.040, 'ЮФО', 'город'],
  ['Сочи', 43.602, 39.734, 'ЮФО', 'город'],
  ['Ставрополь', 45.043, 41.969, 'СКФО', 'город'],
  ['Пятигорск', 44.049, 43.059, 'СКФО', 'город'],
  ['Махачкала', 42.977, 47.505, 'СКФО', 'порт'],
  ['Сургут', 61.254, 73.396, 'УФО', 'город'],
  ['Орск', 51.205, 58.545, 'ПФО', 'город'],
  ['Томск', 56.484, 84.948, 'СФО', 'город'],
  ['Кемерово', 55.354, 86.087, 'СФО', 'город'],
  ['Владимир (Ковров)', 56.357, 41.320, 'ЦФО', 'город']
];
const cityByName = n => CITIES.find(c => c[0] === n);
const RAD = Math.PI / 180;
function roadKm(a, b) {
  const A = cityByName(a), B = cityByName(b); if (!A || !B) return 0;
  const dLat = (B[1] - A[1]) * RAD, dLon = (B[2] - A[2]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A[1] * RAD) * Math.cos(B[1] * RAD) * Math.sin(dLon / 2) ** 2;
  const straight = 2 * 6371 * Math.asin(Math.sqrt(h));
  const road = straight * 1.24 + 25;              // коэффициент извилистости дорожной сети
  return Math.max(0, Math.round(road / 5) * 5);
}

/* ---------- тарифная сетка (редактируется решениями Совета) ---------- */
const TARIFF_META = [
  ['fuelPrice', 'Цена дизельного топлива', '₽/л', 'Росстат, средняя по РФ на 05.10.2026 — 86,72 ₽/л; сетка хранит значение, утверждённое Советом'],
  ['fuelConsLoaded', 'Расход гружёным', 'л/100 км', 'контейнеровоз 40′ с грузом'],
  ['fuelConsEmpty', 'Расход порожним', 'л/100 км', ''],
  ['platon', 'Тариф «Платон»', '₽/км', '3,53 ₽/км с 01.02.2026 (индексация по ПП РФ № 843)'],
  ['platonShare', 'Доля пробега по федеральным трассам', '%', 'для контейнерных плеч обычно 75–90%'],
  ['leasing', 'Амортизация / лизинг', '₽/км', 'тягач + контейнерная площадка'],
  ['driverKm', 'ФОТ водителя (сдельная часть)', '₽/км', ''],
  ['perDiem', 'Суточные и командировочные', '₽/сутки', ''],
  ['repair', 'Ремонт, ТО, расходники', '₽/км', ''],
  ['tires', 'Шины', '₽/км', ''],
  ['insurance', 'Страхование (ОСАГО, КАСКО, ОСГОП)', '₽/км', 'ОСГОП — обязательное для перевозчика'],
  ['overheadPct', 'Накладные, налоги, администрирование', '% от прямых', 'зависит от налогового режима и структуры парка'],
  ['marginBase', 'Базовая маржа', '%', 'утверждается Советом как ориентир для расчёта'],
  ['marginMin', 'Нижняя граница коридора (маржа)', '%', 'ставка ниже этой границы помечается как демпинг'],
  ['detentionFree', 'Бесплатное время на погрузке/выгрузке', 'ч', ''],
  ['detentionRate', 'Простой сверх нормы', '₽/час', 'типовое условие договора-перевозки'],
  ['marketPerKm', 'Рыночный бенчмарк ставки', '₽/км', 'ориентир рынка 85–88 ₽/км по прогнозам отраслевых ассоциаций на 2026 г.'],
  ['seasonK', 'Сезонная надбавка', '%', 'пик спроса (сентябрь–декабрь), закрытие навигации, распутица'],
  ['urgencyK', 'Надбавка за срочность', '%', 'срок доставки менее нормативного'],
  ['emptyReturnK', 'Возврат порожнего контейнера (типовая доля)', '% от плеча', '35% — возврат на ближний терминал/депо; 100% — если контейнер возвращается в порт отправки; 0% — если порожний сдаётся на терминале в пункте назначения']
];
const DEFAULT_TARIFF = {
  version: 'в. 2.3', approved: '2026-08-20', approvedBy: 'Решение ТАР-2026-02',
  val: {
    fuelPrice: 86.72, fuelConsLoaded: 33, fuelConsEmpty: 26, platon: 3.53, platonShare: 85,
    leasing: 14.0, driverKm: 9.0, perDiem: 1800, repair: 5.5, tires: 1.9, insurance: 2.4,
    overheadPct: 14, marginBase: 14, marginMin: 4,
    detentionFree: 4, detentionRate: 1500, marketPerKm: 88, seasonK: 6, urgencyK: 10, emptyReturnK: 35
  }
};

/* ---------- рейтинг перевозчика ---------- */
const RATING_LEVELS = [
  [90, 'Платина', 'b-gold'], [80, 'Золото', 'b-warn'], [70, 'Серебро', 'b-info'], [60, 'Бронза', 'b-mut'], [0, 'Наблюдение', 'b-bad']
];
const RATING_WEIGHTS = [
  ['onTime', 'Соблюдение сроков доставки', 28],
  ['quality', 'Отсутствие срывов и повреждений', 18],
  ['reviews', 'Отзывы грузовладельцев', 14],
  ['tenure', 'Стаж работы на платформе', 10],
  ['discipline', 'Исполнительская дисциплина (решения Совета, арбитраж)', 12],
  ['transparency', 'Прозрачность: документы, верификация, ЭТрН', 10],
  ['volume', 'Объём выполненных рейсов', 8]
];
function rating(c) {
  const m = c.metrics;
  const quality = Math.max(0, 100 - (m.failures / Math.max(1, m.completed)) * 1000);
  const parts = {
    onTime: m.onTime,
    quality,
    reviews: Math.min(100, (m.reviews / 5) * 100),
    tenure: Math.min(100, (m.tenureMonths / 60) * 100),
    discipline: m.discipline,
    transparency: m.transparency,
    volume: Math.min(100, (m.completed / 500) * 100)
  };
  let score = 0, rows = [];
  for (const [k, label, w] of RATING_WEIGHTS) { const v = Math.max(0, Math.min(100, parts[k])); score += v * w / 100; rows.push({ label, w, v, add: v * w / 100 }); }
  score = Math.round(score * 10) / 10;
  const level = RATING_LEVELS.find(l => score >= l[0]);
  return { score, level: level[1], cls: level[2], rows: rows.reverse(), stars: Math.max(1, Math.round(score / 20)) };
}
function starsHtml(n) { return '<span class="stars">' + '★'.repeat(n) + '<span style="opacity:.28">' + '★'.repeat(5 - n) + '</span></span>'; }

/* ---------- параметры Совета перевозчиков ---------- */
const COUNCIL_RULES = {
  seats: 9, quorum: 7,
  thresholds: { tariff: 6, org: 5, charter: 7 },
  kinds: { tariff: 'Тарифное регулирование', org: 'Работа платформы', charter: 'Изменение Устава' },
  termMonths: 24, voteDays: 7, chairTermMonths: 6
};

/* ---------- демонстрационные данные ---------- */
function seed() {
  const cities = ['Новороссийск', 'Санкт-Петербург', 'Москва', 'Екатеринбург', 'Казань', 'Ростов-на-Дону', 'Владивосток', 'Калининград', 'Уфа', 'Краснодар'];
  const names = [
    ['ООО «ТрансКонт-Юг»', 'ЮФО', 42, 38, 'ООО', '2317089012'],
    ['ООО «СеверПорт-Логистик»', 'СЗФО', 68, 84, 'ООО', '7801453099'],
    ['ИП Гареев Р. Р.', 'ПФО', 11, 34, 'ИП', '165912340088'],
    ['ООО «УралКонтейнерСервис»', 'УФО', 95, 120, 'ООО', '6659012347'],
    ['ООО «СибТрансЛиния»', 'СФО', 27, 52, 'ООО', '5406123459'],
    ['ООО «ДальВосток-Карго»', 'ДФО', 33, 61, 'ООО', '2543123456'],
    ['ООО «БалтКонтейнерТранс»', 'СЗФО', 54, 47, 'ООО', '3915123458'],
    ['ИП Мамедов А. О.', 'ЮФО', 6, 22, 'ИП', '234809876543'],
    ['ООО «Волга-Бокс»', 'ПФО', 22, 29, 'ООО', '5261123450'],
    ['ООО «Сибирь-Азия Транзит»', 'СФО', 18, 40, 'ООО', '5407987654']
  ];
  const carriers = names.map((n, i) => {
    const completed = 60 + i * 47;
    const onTime = 82 + ((i * 7) % 16), misses = 1 + (i % 5);
    return {
      id: 'C-' + String(101 + i),
      name: n[0], region: n[1], city: cities[i % cities.length],
      form: n[4], inn: n[5],
      fleet: n[2], containers: n[3],
      types: i % 3 === 0 ? ['20′', '40′', '40′HC', 'реф'] : i % 2 === 0 ? ['20′', '40′HC'] : ['40′', '40′HC'],
      demo: true,
      status: i === 8 ? 'verified' : i === 7 ? 'pending' : i === 9 ? 'suspended' : 'verified',
      joined: '20' + (22 + (i % 3)) + '-0' + ((i % 8) + 1) + '-1' + (i % 9),
      docs: { egrul: i !== 7, osgop: i % 5 !== 4, ports: i % 3 === 0, etrn: i % 4 !== 3, taxes: i % 7 !== 5 },
      metrics: {
        completed, onTime, failures: misses, reviews: Math.round((4.1 + ((i * 3) % 8) / 10) * 10) / 10,
        tenureMonths: 10 + i * 4, discipline: 70 + ((i * 9) % 29), transparency: i === 7 ? 40 : 70 + ((i * 11) % 31)
      },
      loads: [] // id заявок
    };
  });
  const members = [
    ['Смирнов Алексей Викторович', 'ООО «ТрансКонт-Юг»', 'Новороссийск', 'ЮФО', 'Тарифный комитет', '2027-04-01', 412],
    ['Ковалёва Ирина Петровна', 'ООО «СеверПорт-Логистик»', 'Санкт-Петербург', 'СЗФО', 'Комитет по качеству', '2026-12-01', 388],
    ['Гареев Руслан Ринатович', 'ИП Гареев Р. Р.', 'Казань', 'ПФО', 'Тарифный комитет', '2027-04-01', 205],
    ['Ахметов Дамир Ильдарович', 'ООО «УралКонтейнерСервис»', 'Екатеринбург', 'УФО', 'Комитет по цифровизации', '2026-12-01', 301],
    ['Новиков Сергей Андреевич', 'ООО «СибТрансЛиния»', 'Новосибирск', 'СФО', 'Тарифный комитет', '2027-08-01', 257],
    ['Ли Виктор Сунг-Ирович', 'ООО «ДальВосток-Карго»', 'Владивосток', 'ДФО', 'Комитет по цифровизации', '2026-12-01', 199],
    ['Берзиньш Андрей Мартиньевич', 'ООО «БалтКонтейнерТранс»', 'Калининград', 'СЗФО', 'Комитет по качеству', '2027-04-01', 233],
    ['Мамедов Ариф Октаевич', 'ИП Мамедов А. О.', 'Ростов-на-Дону', 'ЮФО', 'Тарифный комитет', '2027-08-01', 176],
    ['Юсупова Алия Маратовна', 'ООО «Волга-Бокс»', 'Нижний Новгород', 'ПФО', 'Комитет по качеству', '2026-12-01', 221]
  ].map((m, i) => ({ id: 'M-' + (i + 1), name: m[0], company: m[1], city: m[2], district: m[3], committee: m[4], until: m[5], electedBy: m[6], chair: i === 0, role: i === 0 ? 'Председатель Совета' : 'Член Совета' }));

  const createdBase = '2026-10-05';
  const votes = [
    {
      id: 'ТАР-2026-06', demo: true, kind: 'tariff', title: 'Индексация тарифной сетки: цена ДТ 86,72 → 89,50 ₽/л, базовая маржа 14% → 15%',
      summary: 'Основание: рост розничных цен на ДТ за сентябрь–октябрь 2026 г. и удорожание ремонта. Проект предполагает пересчёт всех ставок калькулятора и признание расчётов по прежней сетке неактуальными с 01.11.2026.',
      author: 'Тарифный комитет', created: '2026-10-08', deadline: '2026-10-19',
      payload: { fuelPrice: 89.5, marginBase: 15 }, status: 'voting',
      votes: { 'M-1': 'for', 'M-2': 'for', 'M-3': 'against', 'M-4': 'for', 'M-5': 'abstain' }
    },
    {
      id: 'ТАР-2026-05', demo: true, kind: 'tariff', title: 'Минимальная ставка плеча Новороссийск — Москва, 40′HC: 168 000 ₽',
      summary: 'Расчёт калькулятора по действующей сетке (ДТ 86,72 ₽/л, Платон 3,53 ₽/км, маржа 14%) даёт себестоимость рейса 148 000 ₽ с учётом СВХ, хранения на терминале и ПРР. Проект фиксирует рекомендованный «пол» ставки 168 000 ₽ для защиты от демпинга на импортных направлениях.',
      author: 'Смирнов А. В.', created: '2026-10-06', deadline: '2026-10-16',
      payload: { floorRoute: 'Новороссийск→Москва', floorType: '40′HC', floor: 168000 }, status: 'voting',
      votes: { 'M-1': 'for', 'M-3': 'for', 'M-6': 'for', 'M-8': 'against', 'M-9': 'for', 'M-5': 'for' }
    },
    {
      id: 'ОРГ-2026-04', demo: true, kind: 'org', title: 'Обязательная верификация полиса ОСГОП для допуска к бирже грузов',
      summary: 'С 01.12.2026 заявки на бирже видны только перевозчикам со статусом «Верифицирован» и действующим договором обязательного страхования ответственности перевозчика.',
      author: 'Комитет по качеству', created: '2026-10-02', deadline: '2026-10-12',
      payload: { requireOsgop: true, effective: '2026-12-01' }, status: 'voting',
      votes: { 'M-2': 'for', 'M-4': 'for', 'M-7': 'for', 'M-9': 'for', 'M-3': 'for' }
    },
    {
      id: 'ТАР-2026-04', demo: true, kind: 'tariff', title: 'Плата за простой сверх 4 часов: 1 500 ₽/час, фиксация в типовом договоре-перевозки',
      summary: 'Принято 7 голосами «за». Значение внесено в тарифную сетку калькулятора.',
      author: 'Тарифный комитет', created: '2026-09-14', deadline: '2026-09-24',
      payload: { detentionRate: 1500, detentionFree: 4 }, status: 'passed',
      votes: { 'M-1': 'for', 'M-2': 'for', 'M-3': 'for', 'M-4': 'for', 'M-5': 'for', 'M-6': 'for', 'M-7': 'for', 'M-8': 'against', 'M-9': 'abstain' },
      result: { for: 7, against: 1, abstain: 1, decision: 'Принято', at: '2026-09-24' }
    },
    {
      id: 'ТАР-2026-02', demo: true, kind: 'tariff', title: 'Учёт индексации «Платона» до 3,53 ₽/км в тарифной сетке',
      summary: 'Принято 8 голосами «за». Сетка пересчитана с 20.08.2026.',
      author: 'Тарифный комитет', created: '2026-08-10', deadline: '2026-08-20',
      payload: { platon: 3.53 }, status: 'passed',
      votes: { 'M-1': 'for', 'M-2': 'for', 'M-3': 'for', 'M-4': 'for', 'M-5': 'for', 'M-6': 'for', 'M-7': 'for', 'M-8': 'for', 'M-9': 'against' },
      result: { for: 8, against: 1, abstain: 0, decision: 'Принято', at: '2026-08-20' }
    },
    {
      id: 'ОРГ-2026-01', demo: true, kind: 'org', title: 'Вступительный взнос участника 25 000 ₽ и годовой взнос 1 200 ₽ за ТС',
      summary: 'Отклонено: 3 «за» при необходимых 5. Совет подтвердил принцип бесплатного участия перевозчиков.',
      author: 'Смирнов А. В.', created: '2026-07-15', deadline: '2026-07-25',
      payload: { fee: 25000 }, status: 'rejected',
      votes: { 'M-1': 'for', 'M-3': 'for', 'M-5': 'for', 'M-2': 'against', 'M-4': 'against', 'M-6': 'against', 'M-7': 'against', 'M-8': 'abstain', 'M-9': 'against' },
      result: { for: 3, against: 5, abstain: 1, decision: 'Отклонено', at: '2026-07-25' }
    }
  ];

  const loads = [
    { id: 'ГР-2026-118', from: 'Новороссийск', to: 'Москва', type: '40′HC', cargo: 'Импорт: оборудование (СВХ)', weight: 26.4, date: '2026-10-22', shipper: 'ООО «Импорт-Терминал»', status: 'open', mode: 'импорт', bids: 3, floor: 168000 },
    { id: 'ГР-2026-117', from: 'Новороссийск', to: 'Екатеринбург', type: '40′HC', cargo: 'Импорт: товары народного потребления', weight: 24.0, date: '2026-10-24', shipper: 'ТД «Восток»', status: 'open', mode: 'импорт', bids: 2, floor: 0 },
    { id: 'ГР-2026-116', from: 'Санкт-Петербург', to: 'Казань', type: '20′', cargo: 'Экспорт: полимеры', weight: 21.0, date: '2026-10-21', shipper: 'ООО «Полимер-Трейд»', status: 'bid', mode: 'экспорт', bids: 5, floor: 0 },
    { id: 'ГР-2026-115', from: 'Москва', to: 'Владивосток', type: '40′', cargo: 'Внутренняя: сборный груз', weight: 18.5, date: '2026-10-28', shipper: 'ООО «Ритейл-Дистрибуция»', status: 'open', mode: 'внутрироссия', bids: 1, floor: 0 },
    { id: 'ГР-2026-114', from: 'Екатеринбург', to: 'Новосибирск', type: '40′HC', cargo: 'Внутренняя: стройматериалы', weight: 27.0, date: '2026-10-20', shipper: 'ООО «Стройбаза Урал»', status: 'open', mode: 'внутрироссия', bids: 4, floor: 0 },
    { id: 'ГР-2026-113', from: 'Калининград', to: 'Москва', type: '40′HC (реф)', cargo: 'Импорт: продукты питания', weight: 22.0, date: '2026-10-23', shipper: 'ООО «Фреш-Логистика»', status: 'open', mode: 'импорт', bids: 0, floor: 0 },
    { id: 'ГР-2026-112', from: 'Владивосток', to: 'Хабаровск', type: '20′', cargo: 'Импорт: комплектующие', weight: 19.0, date: '2026-10-19', shipper: 'ООО «Азия-Трейд»', status: 'assigned', carrierId: 'C-106', mode: 'импорт', bids: 2, floor: 0 },
    { id: 'ГР-2026-111', from: 'Ростов-на-Дону', to: 'Краснодар', type: '20′', cargo: 'Внутренняя: зерно в контейнерах', weight: 20.0, date: '2026-10-18', shipper: 'АО «Агро-Юг»', status: 'done', carrierId: 'C-101', mode: 'внутрироссия', bids: 3, floor: 0 }
  ];

  const applications = [
    { id: 'З-2026-07', name: 'ООО «КонтТранс-Поволжье»', city: 'Самара', inn: '6317123450', fleet: 14, containers: 12, submitted: '2026-10-13', status: 'pending', docs: true },
    { id: 'З-2026-06', name: 'ИП Шевченко Д. П.', city: 'Архангельск', inn: '290112340055', fleet: 4, containers: 3, submitted: '2026-10-11', status: 'pending', docs: false }
  ];

  const calcs = [];
  const decisions = [
    { demo: true, id: 'ТАР-2026-04', title: 'Плата за простой сверх 4 часов — 1 500 ₽/час', kind: 'tariff', at: '2026-09-24', result: 'Принято (7/9)', effect: 'Значение внесено в тарифную сетку, действует в типовом договоре-перевозки.' },
    { demo: true, id: 'ТАР-2026-02', title: 'Индексация «Платона» до 3,53 ₽/км', kind: 'tariff', at: '2026-08-20', result: 'Принято (8/9)', effect: 'Тарифная сетка калькулятора пересчитана.' },
    { demo: true, id: 'ОРГ-2026-01', title: 'Вступительный взнос участника 25 000 ₽', kind: 'org', at: '2026-07-25', result: 'Отклонено (3/9)', effect: 'Участие перевозчиков на платформе остаётся бесплатным.' }
  ];

  return {
    carriers, members, votes, loads, applications, calcs, decisions,
    profiles: [],   /* роли участников: в онлайне приходят из защищённой базы */
    settings: {
      demoCouncil: false, electionThreshold: 50, elections: null,
      /* Актуальные показатели строки под шапкой: официальные курсы ЦБ РФ. */
      indicators: { usd: 83.76, cny: 12.4991, eur: 93.7693, asOf: '2026-10-16', src: 'ЦБ РФ' }
    },
    tariff: JSON.parse(JSON.stringify(DEFAULT_TARIFF)),
    log: [{ at: '2026-10-15', text: 'Демонстрационные данные загружены (прототип v0.9).' }]
  };
}

let DB = Store.get('ks_db', null) || seed();
const save = () => Store.set('ks_db', DB);
if (!Store.get('ks_db', null)) save();

/* ---------- роль / сессия ---------- */
let ROLE = Store.get('ks_role', 'guest');
let ME = Store.get('ks_me', null);   // перевозчик-сессия (демо)

/* ---------- расчёт ставки ---------- */
const EXTRAS = [
  ['expedition', 'Транспортно-экспедиционное обслуживание (ТЭО)', 2500],
  ['docs', 'Оформление документов, ЭТрН, пломбы', 1500],
  ['svh', 'СВХ / таможенное сопровождение', 6000],
  ['terminal', 'Хранение на терминале, сутки × 3 500 ₽', 3500],
  ['lifting', 'Погрузо-разгрузочные работы (кран/ричстакер)', 3500],
  ['oversize', 'Разрешения, спецсопровождение, негабарит', 0]
];
function calc(inp) {
  const t = DB.tariff.val;
  const c = DB.tariff;
  const km = Math.max(0, num(inp.km));
  const emptyKm = inp.empty ? Math.max(0, num(inp.emptyKm || km * t.emptyReturnK / 100)) : 0;
  const units = Math.max(1, num(inp.units) || 1);
  const kmTotal = (km + emptyKm) * units;
  const loadedTot = km * units, emptyTot = emptyKm * units;
  const days = Math.max(1, num(inp.days) || 1);

  const L = [];
  const push = (name, val, note) => L.push({ name, val, note: note || '' });

  const fuel = (loadedTot * t.fuelConsLoaded / 100 + emptyTot * t.fuelConsEmpty / 100) * t.fuelPrice;
  push('Топливо (ДТ)', fuel, `${t.fuelConsLoaded} л/100 км гружёным, ${t.fuelConsEmpty} л/100 км порожним × ${fmt2(t.fuelPrice)} ₽/л`);
  const platon = kmTotal * t.platon * t.platonShare / 100;
  push('Система «Платон»', platon, `${t.platon} ₽/км × ${t.platonShare}% пробега по федеральным трассам`);
  const leasing = kmTotal * t.leasing;
  push('Амортизация / лизинг', leasing, `${fmt2(t.leasing)} ₽/км × ${fmt(kmTotal)} км`);
  const driver = kmTotal * t.driverKm + days * t.perDiem;
  push('ФОТ водителя + суточные', driver, `${fmt2(t.driverKm)} ₽/км + ${fmt(t.perDiem)} ₽ × ${days} ${plural(days, 'сутки', 'суток', 'суток')}`);
  const repair = kmTotal * t.repair, tires = kmTotal * t.tires, ins = kmTotal * t.insurance;
  push('Ремонт, ТО, расходники', repair, `${fmt2(t.repair)} ₽/км`);
  push('Шины', tires, `${fmt2(t.tires)} ₽/км`);
  push('Страхование (ОСАГО/КАСКО/ОСГОП)', ins, `${fmt2(t.insurance)} ₽/км`);
  const direct = fuel + platon + leasing + driver + repair + tires + ins;

  let extras = 0, extraRows = [];
  for (const [key, label, def] of EXTRAS) {
    const on = inp['ex_' + key];
    if (on) {
      let v = num(inp['exv_' + key] ?? def);
      if (key === 'terminal') v = num(inp['exv_terminal_units'] || 1) * (num(inp['exv_terminal'] ?? def));
      extras += v; extraRows.push([label, v]);
    }
  }
  const detention = Math.max(0, num(inp.detention) - t.detentionFree) * t.detentionRate;
  const overhead = (direct + extras + detention) * t.overheadPct / 100;
  push('Накладные, налоги, администрирование', overhead, `${t.overheadPct}% от прямых затрат, услуг и простоя`);

  const cost = direct + extras + detention + overhead;

  let kSeason = inp.season ? t.seasonK / 100 : 0;
  let kUrg = inp.urgency ? t.urgencyK / 100 : 0;
  const kMode = { 'экспорт': 0, 'импорт': .03, 'внутрироссия': 0, 'транзит': .05 }[inp.mode] || 0;   // доп. риск/оформление
  const k = 1 + kSeason + kUrg + kMode;

  const min = cost * (1 + t.marginMin / 100) * k;
  const base = cost * (1 + t.marginBase / 100) * k;
  const max = cost * (1 + t.marginBase * 2 / 100) * k;
  const perKm = kmTotal ? base / kmTotal : 0;
  const floorDecision = inp.floor || 0;

  return {
    lines: L, extras: extras, extraRows, detention, direct, overhead, cost, k,
    min, base, max, perKm, perUnit: base / units, units, km, emptyKm, kmTotal, days, mode: inp.mode,
    marketPerKm: t.marketPerKm, vsMarket: t.marketPerKm ? (perKm / t.marketPerKm - 1) * 100 : 0,
    belowFloor: floorDecision && base < floorDecision,
    floorDecision
  };
}

/* ---------- голосования Совета ---------- */
function tally(v) {
  const t = { 'for': 0, 'against': 0, 'abstain': 0, none: 0 };
  for (const m of DB.members) { const x = v.votes[m.id] || 'none'; t[x]++; }
  const cast = t['for'] + t['against'] + t['abstain'];
  const need = COUNCIL_RULES.thresholds[v.kind];
  const passed = t['for'] >= need;
  const expired = todayISO() > v.deadline;
  return { ...t, cast, need, quorum: cast >= COUNCIL_RULES.quorum, passed, expired, result: passed ? 'Принято' : 'Не набрано голосов' };
}
function applyDecision(v, resultText) {
  const t = DB.tariff;
  const p = v.payload || {};
  const applied = [];
  for (const k in p) {
    if (k in t.val) { t.val[k] = p[k]; applied.push(k); }
  }
  if (applied.length) { t.approved = todayISO(); t.approvedBy = 'Решение ' + v.id; const mm = String(t.version).match(/\d+(?:[.,]\d+)?/); t.version = 'в. ' + ((mm ? parseFloat(mm[0].replace(',', '.')) : 2.3) + 0.1).toFixed(1); }
  DB.decisions.unshift({
    id: v.id, title: v.title, kind: v.kind, at: todayISO(),
    result: resultText || ('Принято (' + (v.result ? v.result.for : tally(v)['for']) + '/' + COUNCIL_RULES.seats + ')'),
    effect: applied.length ? 'Обновлены параметры тарифной сетки: ' + applied.join(', ') + '.' : (p.floor ? 'Зафиксирована минимальная ставка по плечу ' + p.floorRoute + ' — ' + money(p.floor) + '.' : 'Решение общего характера, внесено в реестр и Правила платформы.')
  });
}

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const target = process.argv[2];
if (!target) {
  console.error('Kullanım: node scripts/make-fixture.cjs <userDataDir>');
  process.exit(1);
}

const dir = path.resolve(target);
fs.mkdirSync(dir, { recursive: true });

const now = Date.now();
const DAY = 86400000;

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(offset) {
  const base = new Date();
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

const companies = [
  {
    id: 'c1animax0001',
    name: 'AniMax',
    color: '#3ef2b5',
    description: 'Discord botları, abonelik altyapısı ve topluluk ürünleri.',
    links: [
      { id: 'l1discord01', label: 'Discord Sunucusu', url: 'https://discord.com' },
      { id: 'l2panel0001', label: 'Abonelik Paneli', url: 'https://example.com' },
    ],
    createdAt: now - 120 * DAY,
  },
  {
    id: 'c2ezwin00001',
    name: 'EzWin',
    color: '#5fc6ff',
    description: 'Marka, hosting ve müşteri operasyonları.',
    links: [
      { id: 'l3hosting01', label: 'Hosting Paneli', url: 'https://example.com' },
      { id: 'l4docs00001', label: 'Marka Dokümanları', url: 'https://example.org' },
    ],
    createdAt: now - 90 * DAY,
  },
  {
    id: 'c3nova000001',
    name: 'Nova Studio',
    color: '#b98bff',
    description: 'Müzik prodüksiyonu ve içerik yayını.',
    links: [{ id: 'l5studio001', label: 'YouTube Studio', url: 'https://studio.youtube.com' }],
    createdAt: now - 40 * DAY,
  },
];

const guilds = [
  { id: '901', name: 'AniMax Community' },
  { id: '902', name: 'AniMax Destek' },
  { id: '903', name: 'EzWin Hosting' },
  { id: '904', name: 'Nova Studio' },
];

const history = Array.from({ length: 34 }, (_, index) => {
  const fail = index === 18;
  return {
    t: now - (34 - index) * 60000,
    ok: !fail,
    ms: fail ? null : Math.round(105 + Math.sin(index / 2.4) * 42 + (index % 5) * 6),
  };
});

const failingHistory = Array.from({ length: 30 }, (_, index) => ({
  t: now - (30 - index) * 60000,
  ok: index > 22 ? false : true,
  ms: index > 22 ? null : Math.round(180 + index * 3),
}));

const assets = [
  {
    id: 'a1animaxbot1',
    companyId: 'c1animax0001',
    type: 'discord',
    name: 'AniMax Bot',
    config: {},
    createdAt: now - 80 * DAY,
  },
  {
    id: 'a2ezwinguard1',
    companyId: 'c2ezwin00001',
    type: 'discord',
    name: 'EzWin Guard',
    config: {},
    createdAt: now - 60 * DAY,
  },
  {
    id: 'a3oyunpanel1',
    companyId: 'c1animax0001',
    type: 'pterodactyl',
    name: 'Oyun Paneli',
    config: { baseUrl: 'https://panel.example.com' },
    createdAt: now - 40 * DAY,
  },
  {
    id: 'a4animaxsite1',
    companyId: 'c1animax0001',
    type: 'website',
    name: 'animax.com',
    config: { url: 'https://example.com/' },
    createdAt: now - 30 * DAY,
  },
  {
    id: 'a5ezwinsite01',
    companyId: 'c2ezwin00001',
    type: 'website',
    name: 'ezwin.com',
    config: { url: 'https://www.google.com/' },
    createdAt: now - 25 * DAY,
  },
  {
    id: 'a6novasite001',
    companyId: 'c3nova000001',
    type: 'website',
    name: 'novastudio.co',
    config: { url: 'https://example.org/' },
    createdAt: now - 12 * DAY,
  },
];

const statuses = {
  a1animaxbot1: {
    assetId: 'a1animaxbot1',
    checkedAt: now - 42000,
    state: 'online',
    latencyMs: 62,
    summary: 'animax_bot · 4 sunucu',
    error: null,
    discord: { botId: '10991823456789012', username: 'animax_bot', guildCount: 4, guilds },
  },
  a2ezwinguard1: {
    assetId: 'a2ezwinguard1',
    checkedAt: now - 52000,
    state: 'online',
    latencyMs: 118,
    summary: 'ezwin_guard · 2 sunucu',
    error: null,
    discord: {
      botId: '10991823456789013',
      username: 'ezwin_guard',
      guildCount: 2,
      guilds: [
        { id: '905', name: 'EzWin Destek' },
        { id: '906', name: 'EzWin Müşteri' },
      ],
    },
  },
  a3oyunpanel1: {
    assetId: 'a3oyunpanel1',
    checkedAt: now - 38000,
    state: 'online',
    latencyMs: 210,
    summary: '2/3 sunucu çalışıyor',
    error: null,
    pterodactyl: {
      account: 'animax',
      total: 3,
      servers: [
        {
          id: 'srv1',
          name: 'AniMax Bot Host',
          state: 'running',
          cpuPercent: 12.4,
          memoryMb: 486,
          memoryLimitMb: 2048,
          diskMb: 3120,
          diskLimitMb: 10240,
          uptimeMs: 8 * DAY + 4 * 3600000,
        },
        {
          id: 'srv2',
          name: 'FiveM Ana Sunucu',
          state: 'running',
          cpuPercent: 48.7,
          memoryMb: 2761,
          memoryLimitMb: 6144,
          diskMb: 15320,
          diskLimitMb: 30720,
          uptimeMs: 3 * DAY + 7 * 3600000,
        },
        {
          id: 'srv3',
          name: 'Staging Node',
          state: 'stopped',
          cpuPercent: 0,
          memoryMb: 0,
          memoryLimitMb: 2048,
          diskMb: 890,
          diskLimitMb: 10240,
          uptimeMs: 0,
        },
      ],
    },
  },
  a4animaxsite1: {
    assetId: 'a4animaxsite1',
    checkedAt: now - 45000,
    state: 'online',
    latencyMs: 142,
    summary: 'HTTP 200 · 142 ms',
    error: null,
    website: { statusCode: 200, sslExpiresAt: now + 68 * DAY, history },
  },
  a5ezwinsite01: {
    assetId: 'a5ezwinsite01',
    checkedAt: now - 49000,
    state: 'degraded',
    latencyMs: 3180,
    summary: 'HTTP 200 · 3180 ms · SSL 5 gün',
    error: 'Yavaş yanıt (3 sn üzeri) · SSL sertifikası 5 gün içinde doluyor',
    website: { statusCode: 200, sslExpiresAt: now + 5 * DAY, history: failingHistory.map((p, i) => ({ ...p, ok: true, ms: 1800 + i * 42 })) },
  },
  a6novasite001: {
    assetId: 'a6novasite001',
    checkedAt: now - 60000,
    state: 'offline',
    latencyMs: 235,
    summary: 'Alan adı çözümlenemedi',
    error: 'Alan adı çözümlenemedi',
    website: { statusCode: null, sslExpiresAt: null, history: failingHistory },
  },
};

const tasks = [
  {
    id: 't1task000001',
    title: 'Bot v14 geçişini tamamla ve komutları test et',
    companyId: 'c1animax0001',
    priority: 'high',
    due: iso(new Date(now - 2 * DAY)),
    done: false,
    createdAt: now - 6 * DAY,
  },
  {
    id: 't2task000001',
    title: 'Abonelik fiyatlandırmasını güncelle',
    companyId: 'c1animax0001',
    priority: 'med',
    due: iso(new Date()),
    done: false,
    createdAt: now - 3 * DAY,
  },
  {
    id: 't3task000001',
    title: 'Yeni hosting kampanyası görsellerini hazırla',
    companyId: 'c2ezwin00001',
    priority: 'high',
    due: iso(new Date(now + 2 * DAY)),
    done: false,
    createdAt: now - 2 * DAY,
  },
  {
    id: 't4task000001',
    title: 'Ekipman sigorta yenilemesini kontrol et',
    companyId: 'c3nova000001',
    priority: 'low',
    due: null,
    done: false,
    createdAt: now - 1 * DAY,
  },
  {
    id: 't5task000001',
    title: 'Pterodactyl yedekleme cron’unu doğrula',
    companyId: 'c1animax0001',
    priority: 'med',
    due: iso(new Date(now + 5 * DAY)),
    done: false,
    createdAt: now - 5 * DAY,
  },
  {
    id: 't6task000001',
    title: 'Discord moderasyon ekibiyle haftalık toplantı',
    companyId: 'c1animax0001',
    priority: 'low',
    due: iso(new Date(now - 5 * DAY)),
    done: true,
    createdAt: now - 9 * DAY,
  },
  {
    id: 't7task000001',
    title: 'Yeni stüdyo mikrofonu siparişi',
    companyId: 'c3nova000001',
    priority: 'low',
    due: null,
    done: true,
    createdAt: now - 8 * DAY,
  },
];

const notes = [
  {
    id: 'n1note000001',
    title: 'Bot v14 geçiş planı',
    body: 'Tüm komutları slash komutlarına taşı. Eski prefix komutlarını bir sürüm boyunca uyumluluk modunda tut.\n\nÖncelik: moderasyon → abonelik → eğlence komutları. Test sunucusunda 3 gün gözlem, sonra canlıya al.',
    companyId: 'c1animax0001',
    pinned: true,
    createdAt: now - 6 * DAY,
    updatedAt: now - 5 * 3600000,
  },
  {
    id: 'n2note000001',
    title: 'Hosting fiyatlandırma revizyonu',
    body: 'Yeni sunucu maliyetleri sonrası %12 marj kaybı var. Yıllık planlarda %15 indirim korunacak, RAM ek paketleri yeniden fiyatlanacak.',
    companyId: 'c2ezwin00001',
    pinned: false,
    createdAt: now - 4 * DAY,
    updatedAt: now - 2 * DAY,
  },
  {
    id: 'n3note000001',
    title: 'Haftalık toplantı notları',
    body: '1) Öncelik servis sağlığı.\n2) Nova için yeni prodüksiyon takvimi.\n3) EZWIN HUB üzerinden tüm metrikleri tek ekrana taşı.',
    companyId: null,
    pinned: false,
    createdAt: now - 2 * DAY,
    updatedAt: now - 26 * 3600000,
  },
  {
    id: 'n4note000001',
    title: 'Yeni jingle paketleri',
    body: 'Kısa 5 sn ve 15 sn versiyonlar. Radyo yayını için −14 LUFS hedefi. Teslim: Ekim son haftası.',
    companyId: 'c3nova000001',
    pinned: true,
    createdAt: now - 10 * DAY,
    updatedAt: now - 3 * DAY,
  },
];

const finance = [];
const incomeBase = { c1animax0001: 52000, c2ezwin00001: 24500, c3nova000001: 12500 };
const expenseBase = { c1animax0001: 18500, c2ezwin00001: 7600, c3nova000001: 5100 };
const variance = [0, 4200, -1800, 6100, 2400, -3200];
const categories = {
  c1animax0001: { income: 'Abonelikler', expense: 'Altyapı' },
  c2ezwin00001: { income: 'Hosting', expense: 'Lisanslar' },
  c3nova000001: { income: 'Prodüksiyon', expense: 'Ekipman' },
};

for (let i = 0; i < 6; i += 1) {
  const base = monthStart(i - 5);
  for (const company of companies) {
    const cid = company.id;
    const incomeDate = new Date(base.getFullYear(), base.getMonth(), 3);
    const expenseDate = new Date(base.getFullYear(), base.getMonth(), 17);
    finance.push({
      id: `f-inc-${cid}-${i}`,
      companyId: cid,
      kind: 'income',
      amount: incomeBase[cid] + variance[i],
      category: categories[cid].income,
      note: i === 5 ? 'Aylık düzenli tahsilat' : '',
      date: iso(incomeDate),
      createdAt: incomeDate.getTime(),
    });
    finance.push({
      id: `f-exp-${cid}-${i}`,
      companyId: cid,
      kind: 'expense',
      amount: expenseBase[cid] + Math.round(variance[i] * 0.4),
      category: categories[cid].expense,
      note: i === 5 ? 'Aylık sabit giderler' : '',
      date: iso(expenseDate),
      createdAt: expenseDate.getTime(),
    });
  }
}

const state = {
  version: 1,
  companies,
  assets,
  tasks,
  notes,
  finance,
  settings: { currency: 'TRY', pollIntervalSec: 60, openAtLogin: false },
  statuses,
  secrets: {
    a1animaxbot1: { enc: 'fixture', hint: '••••9f2a' },
    a2ezwinguard1: { enc: 'fixture', hint: '••••1c7d' },
    a3oyunpanel1: { enc: 'fixture', hint: '••••pacc' },
  },
};

fs.writeFileSync(path.join(dir, 'app-state.json'), JSON.stringify(state, null, 2), 'utf8');
console.log(`Fixture hazır: ${path.join(dir, 'app-state.json')}`);

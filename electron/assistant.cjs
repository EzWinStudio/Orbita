'use strict';

/**
 * EZWIN Asistan.
 *
 * İki katmanlı çalışır:
 *  1) Yerel komutlar: uygulama verisini okur/yazar (şirket, görev, not, finans,
 *     özet, çeviri, güncelleme denetimi). Veri hiçbir yere gönderilmez.
 *  2) Genel sorular: yapılandırılmış bir dil modeli uç noktasına sorulur.
 *     Varsayılan olarak anahtarsız çalışan ücretsiz uç nokta kullanılır;
 *     EZWIN_AI_URL / EZWIN_AI_MODEL / EZWIN_AI_KEY ile değiştirilebilir.
 */

const crypto = require('node:crypto');
const { translate } = require('./translate.cjs');

const FREE_ENDPOINT = String(process.env.EZWIN_AI_URL || 'https://text.pollinations.ai/openai');
const FREE_MODEL = String(process.env.EZWIN_AI_MODEL || 'openai');
const API_KEY = String(process.env.EZWIN_AI_KEY || '');

const LANGUAGE_WORDS = {
  ingilizce: 'en',
  english: 'en',
  almanca: 'de',
  german: 'de',
  fransızca: 'fr',
  fransizca: 'fr',
  french: 'fr',
  ispanyolca: 'es',
  spanish: 'es',
  türkçe: 'tr',
  turkce: 'tr',
  turkish: 'tr',
  arapça: 'ar',
  arapca: 'ar',
  rusça: 'ru',
  rusca: 'ru',
  italyanca: 'it',
  italyan: 'it',
  portekizce: 'pt',
  japonca: 'ja',
  çince: 'zh',
  cince: 'zh',
  korece: 'ko',
  flemenkçe: 'nl',
  lehçe: 'pl',
  ukraynaca: 'uk',
  farsça: 'fa',
};

const NAV_WORDS = [
  ['müzik', 'music'],
  ['muzik', 'music'],
  ['bağlantı', 'connections'],
  ['baglanti', 'connections'],
  ['çeviri', 'translate'],
  ['ceviri', 'translate'],
  ['güncelleme', 'updates'],
  ['guncelleme', 'updates'],
  ['ayar', 'settings'],
  ['finans', 'finance'],
  ['posta', 'mail'],
  ['mail', 'mail'],
  ['servis', 'services'],
  ['şirket', 'companies'],
  ['sirket', 'companies'],
  ['görev', 'tasks'],
  ['gorev', 'tasks'],
  ['asistan', 'assistant'],
];

const HELP = [
  'Merhaba, ben EZWIN Asistan. Uygulamanın içinde çalışırım ve şunları yapabilirim:',
  '',
  '• Özet: “Bu haftanın özeti”, “genel durum”',
  '• Kayıt: “Yeni şirket ekle: Nova Studio”, “Görev ekle: video kurgusu”, “Not ekle: fikirler”',
  '• Finans: “Gelir ekle: 15000 TL”, “Gider ekle: 400 TL reklam”',
  '• Sorgu: “Açık görevlerim”, “Hangi servisler kapalı?”, “Kaç şirketim var?”',
  '• Çeviri: “İngilizceye çevir: bu hafta üç video hazırlıyorum”',
  '• Denetim: “Güncellemeleri kontrol et”, “Güvenlik önerisi”',
  '• Genel bilgi: tarih, matematik, tanım, nasıl yapılır soruları',
  '',
  'Verilerin yerel kalır: yalnızca genel bilgi soruları internete gider.',
].join('\n');

function formatMoney(value) {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `${Math.round(Number(value) || 0)} TL`;
  }
}

function formatDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleString('tr-TR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function summarize(store) {
  const state = store.get();
  const openTasks = state.tasks.filter((task) => !task.done);
  const offline = state.assets.filter(
    (asset) => (state.statuses[asset.id]?.state || 'unchecked') === 'offline',
  );
  const income = state.finance
    .filter((entry) => entry.kind === 'income')
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const expense = state.finance
    .filter((entry) => entry.kind === 'expense')
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);

  return [
    '**Genel durum**',
    `• ${state.companies.length} şirket, ${state.assets.length} servis, ${state.connections.length} bağlantı`,
    `• ${openTasks.length} açık görev, ${state.notes.length} not`,
    `• ${offline.length} servis kapalı${offline.length ? `: ${offline.slice(0, 4).map((asset) => asset.name).join(', ')}` : ''}`,
    `• Finans: ${formatMoney(income)} gelir, ${formatMoney(expense)} gider, net ${formatMoney(income - expense)}`,
  ].join('\n');
}

function listCompanies(store) {
  const companies = store.get().companies;
  if (companies.length === 0) {
    return 'Henüz şirket yok. “Yeni şirket ekle: …” yazarak başlayabilirsin.';
  }
  return [
    `**${companies.length} şirket**`,
    ...companies.slice(0, 12).map((company) => `• ${company.name}${company.description ? ` — ${company.description}` : ''}`),
  ].join('\n');
}

function listTasks(store) {
  const tasks = store.get().tasks.filter((task) => !task.done);
  if (tasks.length === 0) return 'Açık görev yok. “Görev ekle: …” ile yeni görev oluşturabilirsin.';
  return [
    `**${tasks.length} açık görev**`,
    ...tasks.slice(0, 10).map((task) => {
      const priority = task.priority === 'high' ? 'yüksek' : task.priority === 'low' ? 'düşük' : 'orta';
      return `• ${task.title} (${priority})`;
    }),
  ].join('\n');
}

function listOffline(store) {
  const state = store.get();
  const offline = state.assets.filter(
    (asset) => (state.statuses[asset.id]?.state || 'unchecked') === 'offline',
  );
  if (offline.length === 0) return 'Şu anda kapalı görünen servis yok.';
  return [
    `**${offline.length} servis kapalı**`,
    ...offline.slice(0, 10).map((asset) => {
      const status = state.statuses[asset.id];
      return `• ${asset.name}${status?.error ? ` — ${status.error}` : ''}`;
    }),
  ].join('\n');
}

function findCompany(store, rawName) {
  const name = String(rawName || '').trim().toLocaleLowerCase('tr');
  if (!name) return null;
  return (
    store
      .get()
      .companies.find((company) => company.name.toLocaleLowerCase('tr') === name) ||
    store.get().companies.find((company) => company.name.toLocaleLowerCase('tr').includes(name)) ||
    null
  );
}

function addCompany(store, name) {
  const clean = String(name || '').replace(/[.!]+$/, '').trim().slice(0, 60);
  if (!clean) throw new Error('Şirket adı gerekli. Örnek: “Yeni şirket ekle: Nova Studio”.');
  const company = {
    id: crypto.randomUUID(),
    name: clean,
    color: '#3ef2b5',
    logo: null,
    description: '',
    status: 'active',
    category: 'other',
    monthlyTarget: null,
    links: [],
    createdAt: Date.now(),
  };
  store.get().companies.unshift(company);
  store.save();
  return { mutated: true, reply: `“${clean}” şirketi eklendi. Şirketler sayfasından detayları doldurabilirsin.` };
}

function addTask(store, rawTitle) {
  let title = String(rawTitle || '').trim();
  let priority = 'med';
  if (/yüksek|acil|öncelikli/i.test(title)) priority = 'high';
  if (/düşük|acele değil/i.test(title)) priority = 'low';
  title = title
    .replace(/\b(yüksek|düşük|orta|acil|öncelikli|acele değil)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:,\-\s]+|[:,\-\s]+$/g, '')
    .slice(0, 200);
  if (!title) throw new Error('Görev başlığı gerekli. Örnek: “Görev ekle: video kurgusu”.');
  store.get().tasks.unshift({
    id: crypto.randomUUID(),
    title,
    companyId: null,
    priority,
    due: null,
    done: false,
    createdAt: Date.now(),
  });
  store.save();
  return { mutated: true, reply: `“${title}” görevi eklendi.` };
}

function addNote(store, rawText) {
  const value = String(rawText || '').trim();
  if (!value) throw new Error('Not içeriği gerekli. Örnek: “Not ekle: yeni video fikri”.');
  const [first, ...rest] = value.split('\n');
  const title = (first || 'Adsız not').slice(0, 120);
  const body = rest.join('\n').trim() || (value.length > 120 ? value : '');
  store.get().notes.unshift({
    id: crypto.randomUUID(),
    title,
    body,
    companyId: null,
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  store.save();
  return { mutated: true, reply: `Not kaydedildi: “${title}”.` };
}

function addFinance(store, kind, rawAmount, rawRest) {
  const amount = Number(String(rawAmount || '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Geçerli bir tutar yaz. Örnek: “Gelir ekle: 15000 TL”.');
  }
  const rest = String(rawRest || '').trim();
  const companies = store.get().companies;
  if (companies.length === 0) {
    throw new Error('Finans kaydı için önce bir şirket eklemelisin.');
  }
  const company = findCompany(store, rest) || companies[0];
  const note = rest && (!findCompany(store, rest) || rest !== company.name) ? rest : '';
  store.get().finance.unshift({
    id: crypto.randomUUID(),
    companyId: company.id,
    kind,
    amount: Math.round(amount * 100) / 100,
    category: kind === 'income' ? 'genel' : 'genel',
    note: note.slice(0, 160),
    date: new Date().toISOString().slice(0, 10),
    createdAt: Date.now(),
  });
  store.save();
  return {
    mutated: true,
    reply: `${kind === 'income' ? 'Gelir' : 'Gider'} kaydedildi: ${formatMoney(amount)} · ${company.name}.`,
  };
}

function pickLanguage(low) {
  for (const [word, code] of Object.entries(LANGUAGE_WORDS)) {
    if (low.includes(word)) return code;
  }
  return null;
}

async function runTranslate(store, text, target) {
  const settings = store.get().settings;
  const source = settings.translateSource === 'auto' ? 'auto' : settings.translateSource || 'auto';
  const to = target || settings.translateTarget || 'tr';
  const result = await translate({ text, source, target: to });
  return `**${result.engine} · ${source === 'auto' ? 'otomatik' : source.toUpperCase()} → ${to.toUpperCase()}**\n${result.text}`;
}

function safeMath(expression) {
  const raw = String(expression || '').replace(/,/g, '.').trim();
  if (!/^[\d\s+\-*/().]+$/.test(raw) || !/\d/.test(raw) || !/[+\-*/]/.test(raw)) return null;
  try {
    const value = Function(`"use strict";return (${raw});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return `Sonuç: **${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(value)}**`;
  } catch {
    return null;
  }
}

function securityAdvice(account) {
  if (!account) return 'Güvenlik için hesabına giriş yapmalısın.';
  const security = account.security || {};
  const lines = ['**Güvenlik durumu**'];
  lines.push(`• Güvenlik puanı: ${account.securityScore ?? 0}/100`);
  if ((account.passwordScore ?? 0) < 4) {
    lines.push('• Şifreni en az 12 karakter, harf + rakam + simge olacak şekilde güçlendir.');
  } else {
    lines.push('• Şifre gücün iyi görünüyor.');
  }
  if (!security.autoLockMinutes) {
    lines.push('• Otomatik kilidi aç: Hesap > Güvenlik bölümünden 15 dakika seç.');
  } else {
    lines.push(`• Otomatik kilit ${security.autoLockMinutes} dakika olarak açık.`);
  }
  if (!security.lockOnBlur) {
    lines.push('• “Pencere odağı kaybolunca kilitle” seçeneğini açabilirsin.');
  }
  lines.push('• “Beni hatırla”yı yalnızca kendi bilgisayarında kullan.');
  return lines.join('\n');
}

function status() {
  return {
    provider: 'pollinations',
    endpoint: FREE_ENDPOINT,
    model: FREE_MODEL,
    modelLabel: 'GPT-OSS 20B',
    hasKey: Boolean(API_KEY),
    ready: true,
  };
}

async function askModel(message, history) {
  const messages = [
    {
      role: 'system',
      content: [
        'Sen EZWIN Asistan’sın: EZWIN HUB masaüstü uygulamasının içindeki Türkçe asistansın.',
        'Kısa, net ve uygulanabilir yanıtlar ver. Gerektiğinde madde işaretleri kullan.',
        'Genel bilgi sorularını yanıtlayabilirsin; emin olmadığın bilgide tahmin ettiğini söyle.',
        'Uygulama verilerine doğrudan erişimin yok; özet, görev, şirket, finans gibi isteklerde kullanıcıyı yerel komutlara yönlendir.',
        'Kullanıcı hangi dilde yazarsa o dilde yanıtla.',
      ].join(' '),
    },
  ];

  for (const item of history.slice(-8)) {
    if (!item || typeof item.content !== 'string') continue;
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    const content = item.content.trim().slice(0, 1200);
    if (!content) continue;
    messages.push({ role: item.role, content });
  }

  messages.push({ role: 'user', content: message.slice(0, 2000) });

  const response = await fetch(FREE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 700,
    }),
    signal: AbortSignal.timeout(35000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(String(detail).slice(0, 200));
  }

  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.text ||
    '';
  const reply = String(content).trim();
  if (!reply) throw new Error('Model boş yanıt döndürdü.');
  return reply.slice(0, 6000);
}

async function ask({ message, history = [], store, updates, appVersion, account }) {
  const raw = String(message || '').trim();
  if (!raw) throw new Error('Bir mesaj yaz.');
  if (raw.length > 2000) throw new Error('Mesaj 2000 karakteri aşamaz.');
  const low = raw.toLocaleLowerCase('tr');

  if (/(yardım|neler yapabilirsin|komutlar|help|ne yapabilirsin)/.test(low)) {
    return { reply: HELP, source: 'local', suggestions: ['Bu haftanın özeti', 'Açık görevlerim', 'Güvenlik önerisi'] };
  }

  if (/(özet|genel durum|durum raporu|rapor ver|haftanın özeti)/.test(low)) {
    return { reply: summarize(store), source: 'local', suggestions: ['Hangi servisler kapalı?', 'Açık görevlerim', 'Finans durumu'] };
  }

  if (/(finans|gelir|gider|bakiye|kâr|kar durumu)/.test(low) && !/ekle/.test(low)) {
    const state = store.get();
    const income = state.finance.filter((e) => e.kind === 'income').reduce((t, e) => t + Number(e.amount || 0), 0);
    const expense = state.finance.filter((e) => e.kind === 'expense').reduce((t, e) => t + Number(e.amount || 0), 0);
    return {
      reply: [
        '**Finans özeti**',
        `• Gelir: ${formatMoney(income)}`,
        `• Gider: ${formatMoney(expense)}`,
        `• Net: ${formatMoney(income - expense)}`,
        `• Kayıt sayısı: ${state.finance.length}`,
      ].join('\n'),
      source: 'local',
      suggestions: ['Gelir ekle: 15000 TL', 'Gider ekle: 400 TL reklam'],
    };
  }

  if (/(hangi servis|kapalı servis|offline|çalışmayan)/.test(low)) {
    return { reply: listOffline(store), source: 'local', suggestions: ['Bu haftanın özeti', 'Servisleri yenile'] };
  }

  if (/(açık görev|görevlerim|yapılacaklar|todo)/.test(low) && !/ekle/.test(low)) {
    return { reply: listTasks(store), source: 'local', suggestions: ['Görev ekle: haftalık plan', 'Bu haftanın özeti'] };
  }

  if (/(kaç şirket|şirketlerim|şirket listesi|companies)/.test(low) && !/ekle|oluştur/.test(low)) {
    return { reply: listCompanies(store), source: 'local', suggestions: ['Yeni şirket ekle: Nova Studio'] };
  }

  if (/(saat kaç|tarih ne|bugün günlerden|hangi gün)/.test(low)) {
    return {
      reply: `Şu an **${formatDate(Date.now())}** (yerel saat).`,
      source: 'local',
    };
  }

  const math = safeMath(raw.replace(/^(hesapla|kaç eder|sonuç)\s*[:\-]?\s*/i, ''));
  if (math) return { reply: math, source: 'local' };

  if (/(güvenlik|şifre.*(güçl|öneri|nasıl)|security)/.test(low)) {
    return { reply: securityAdvice(account), source: 'local', suggestions: ['Otomatik kilidi aç', 'Şifremi değiştir'] };
  }

  if (/(güncelleme|sürüm|update)/.test(low) && /(kontrol|denetle|var mı|bak)/.test(low)) {
    const feed = store.get().settings.updateFeedUrl;
    if (!feed) {
      return {
        reply: 'Güncelleme kanalı tanımlı değil. Güncellemeler sayfasından bir JSON adresi eklediğinde yeni sürümleri otomatik denetlerim.',
        source: 'local',
        navigate: 'updates',
      };
    }
    try {
      const result = await updates.checkFeed(feed, appVersion);
      return {
        reply: result.available
          ? `Yeni sürüm hazır: **v${result.latest}**. Güncellemeler sayfasından indirebilirsin.`
          : `Güncel görünüyorsun. Yüklü sürüm **v${appVersion}**.`,
        source: 'local',
        navigate: 'updates',
        suggestions: ['Güncellemeleri aç'],
      };
    } catch (err) {
      return { reply: `Güncelleme denetlenemedi: ${err.message}`, source: 'local', navigate: 'updates' };
    }
  }

  const translateMatch = raw.match(/^(?:çevir|translate)\s*[:\-]\s*([\s\S]+)$/i);
  if (translateMatch) {
    try {
      return {
        reply: await runTranslate(store, translateMatch[1].trim(), null),
        source: 'local',
      };
    } catch (err) {
      return { reply: `Çeviri yapılamadı: ${err.message}`, source: 'local' };
    }
  }

  const languagePattern =
    'ingilizce|almanca|fransızca|fransizca|ispanyolca|türkçe|turkce|arapça|arapca|rusça|rusca|italyanca|portekizce|japonca|çince|cince|korece';

  const targetFirst = low.match(
    new RegExp(`^(${languagePattern})(?:ye|ya|e|a)?\\s*(?:çevir|cevir)\\s*[:\\-]\\s*([\\s\\S]+)$`),
  );
  if (targetFirst) {
    const target = pickLanguage(targetFirst[1]);
    const colonIndex = raw.search(/[:\-]/);
    const body = colonIndex >= 0 ? raw.slice(colonIndex + 1).trim() : '';
    if (body && target) {
      try {
        return { reply: await runTranslate(store, body, target), source: 'local' };
      } catch (err) {
        return { reply: `Çeviri yapılamadı: ${err.message}`, source: 'local' };
      }
    }
  }

  const targetLast = low.match(
    new RegExp(`(${languagePattern})(?:ye|ya|e|a)?\\s*(?:çevir|cevir)\\s*[.!]?$`),
  );
  if (targetLast && typeof targetLast.index === 'number') {
    const target = pickLanguage(targetLast[1]);
    const body = raw
      .slice(0, targetLast.index)
      .replace(/^(şunu|bunu|şu metni|bu metni)\s*/i, '')
      .replace(/^[:\-\s]+/, '')
      .trim();
    if (body && target) {
      try {
        return { reply: await runTranslate(store, body, target), source: 'local' };
      } catch (err) {
        return { reply: `Çeviri yapılamadı: ${err.message}`, source: 'local' };
      }
    }
  }

  const companyMatch = raw.match(/^(?:yeni\s+)?şirket\s+(?:ekle|oluştur|aç)\s*[:\-]?\s*(.+)$/i);
  if (companyMatch) return { ...addCompany(store, companyMatch[1]), source: 'local', navigate: 'companies' };

  const taskMatch = raw.match(/^(?:yeni\s+)?görev\s+(?:ekle|oluştur)\s*[:\-]?\s*(.+)$/i);
  if (taskMatch) return { ...addTask(store, taskMatch[1]), source: 'local', navigate: 'tasks' };

  const noteMatch = raw.match(/^(?:yeni\s+)?not\s+(?:ekle|al|oluştur|kaydet)\s*[:\-]?\s*([\s\S]+)$/i);
  if (noteMatch) return { ...addNote(store, noteMatch[1]), source: 'local', navigate: 'tasks' };

  const financeMatch = raw.match(/^(gelir|gider|harcama)\s+ekle\s*[:\-]?\s*([\d.,]+)\s*(?:tl|₺|try|usd|\$|eur|€|dolar|euro)?\s*(.*)$/i);
  if (financeMatch) {
    const kind = /gelir/i.test(financeMatch[1]) ? 'income' : 'expense';
    return {
      ...addFinance(store, kind, financeMatch[2], financeMatch[3]),
      source: 'local',
      navigate: 'finance',
    };
  }

  if (/(müzik|muzik|çalar|calar)/.test(low) && /(aç|cal|çal|sayfa|göster)/.test(low)) {
    return { reply: 'Müzik sayfasını açıyorum. “Müzik ekle” ile kendi dosyalarını içe aktarabilirsin.', source: 'local', navigate: 'music' };
  }

  for (const [word, page] of NAV_WORDS) {
    if (low === word || low === `${word} aç` || low === `${word} sayfası` || low === `${word} sayfasini ac`) {
      return { reply: `${word} sayfasını açıyorum.`, source: 'local', navigate: page };
    }
  }

  try {
    const reply = await askModel(raw, history);
    return {
      reply,
      source: 'model',
      suggestions: ['Bu haftanın özeti', 'Açık görevlerim', 'İngilizceye çevir: …'],
    };
  } catch (err) {
    const limited = /limit reached|retry after|too many requests/i.test(err.message);
    return {
      reply: limited
        ? [
            'Ücretsiz model katmanı kısa süreliğine sınıra takıldı (yaklaşık bir yanıt / 45 saniye).',
            '',
            'Yerel komutlar sınırsız çalışıyor: “Bu haftanın özeti”, “Görev ekle: …”, “Gelir ekle: 5000 TL”, “İngilizceye çevir: …”.',
            'Genel soru için 20–30 saniye sonra tekrar dene.',
          ].join('\n')
        : [
            'Genel bilgi için model servisine ulaşamadım.',
            '',
            `Sebep: ${err.message}`,
            '',
            'Yerel komutlar çalışmaya devam ediyor. Örneğin “Bu haftanın özeti”, “Görev ekle: …”, “İngilizceye çevir: …”.',
          ].join('\n'),
      source: 'local',
      suggestions: ['Yardım', 'Bu haftanın özeti'],
    };
  }
}

module.exports = { ask, status };

'use strict';

/**
 * Platform connectors. Every platform can hold any number of accounts: the
 * tokens live encrypted inside the store's secrets map, one entry per
 * connection, so adding a second YouTube channel never overwrites the first.
 */

const PLATFORMS = {
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    color: '#ff4d4d',
    hint: 'Google OAuth erişim jetonu (ya29.…) veya kanal bazlı jeton',
    docsUrl: 'https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly',
    refreshEnv: ['EZWIN_YOUTUBE_CLIENT_ID', 'EZWIN_YOUTUBE_CLIENT_SECRET'],
    tokenPrefix: 'ya29.',
    exampleToken: 'ya29.a0AfH6SMBx7Kd9… (yaklaşık 120+ karakter)',
    exampleRefresh: '1//0gXa… (Google yenileme jetonu)',
    note: 'Erişim jetonu 1 saatte dolar. Yenileme jetonu eklersen Bağlantılar sayfasındaki “Yenile” düğmesiyle uzatabilirsin.',
    steps: [
      'Google Cloud Console > APIs & Services bölümünde yeni proje oluştur.',
      'Library > YouTube Data API v3 servisini etkinleştir.',
      'Credentials > OAuth client ID (Web application) oluştur, yönlendirme adresini ekle.',
      'OAuth onay ekranını https://www.googleapis.com/auth/youtube.readonly kapsamıyla tamamla.',
      'Dönen access_token değerini aşağıdaki “Erişim jetonu” alanına yapıştır; refresh_token varsa ikinci alana ekle.',
    ],
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    color: '#e1306c',
    hint: 'Instagram API uzun ömürlü erişim jetonu (IGQV…)',
    docsUrl: 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login',
    scopes: 'instagram_business_basic',
    refreshEnv: [],
    tokenPrefix: 'IGQV',
    exampleToken: 'IGQVJXa2ZAk… (uzun ömürlü kullanıcı jetonu)',
    exampleRefresh: null,
    note: 'Instagram profesyonel (iş veya yaratıcı) hesap gerektirir. Jeton yaklaşık 60 gün geçerlidir; süresi dolmadan Yenile düğmesi yeni jeton üretir. Basic Display API 2024’te kapatıldığı için bu bağlantı Instagram Login akışını kullanır.',
    steps: [
      'Meta for Developers > My Apps bölümünde uygulama oluştur ve Instagram ürününü ekle.',
      'Instagram API with Instagram Login kurulumunu aç; Instagram hesabını profesyonel hesaba çevir.',
      'instagram_business_basic izniyle Instagram Login OAuth akışını tamamla.',
      'Dönen uzun ömürlü access_token değerini al; gerekirse /refresh_access_token ile uzat.',
      'IGQV ile başlayan jetonu “Erişim jetonu” alanına yapıştır ve Doğrula ile profili çek.',
    ],
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    color: '#25f4ee',
    hint: 'TikTok Login Kit erişim jetonu (act.…)',
    docsUrl: 'https://developers.tiktok.com/doc/login-kit-web',
    scopes: 'user.info.basic',
    refreshEnv: ['EZWIN_TIKTOK_CLIENT_KEY', 'EZWIN_TIKTOK_CLIENT_SECRET'],
    tokenPrefix: 'act.',
    exampleToken: 'act.1a2b3c4d5e6f7g8h… (access_token)',
    exampleRefresh: 'rft.9z8y7x… (refresh_token)',
    note: 'user.info.basic izni olmadan profil okunamaz. Yenileme jetonu 1 yıl geçerlidir; erişim jetonu 24 saatte dolar.',
    steps: [
      'TikTok for Developers > Manage apps > Connect an app oluştur.',
      'Login Kit ürününü ekle ve https://open.tiktokapis.com/v2/oauth/token/ yönlendirmesini tanımla.',
      'user.info.basic kapsamıyla OAuth akışını tamamla.',
      'Yanıttaki access_token (act.…) değerini “Erişim jetonu”, refresh_token (rft.…) değerini “Yenileme jetonu” alanına yaz.',
      'Hesabı ekledikten sonra Doğrula ile profili çek; hata alırsan jetonun süresini kontrol et.',
    ],
  },
};

const PLATFORM_LIST = Object.values(PLATFORMS);

function platformOf(id) {
  const platform = PLATFORMS[id];
  if (!platform) throw new Error('Desteklenmeyen platform.');
  return platform;
}

async function readJson(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
  }
  if (!response.ok) {
    const nested = data.error;
    const message =
      typeof nested === 'string'
        ? nested
        : nested && typeof nested === 'object'
          ? nested.message || nested.error_description || JSON.stringify(nested).slice(0, 200)
          : data.message || data.error_description || `${response.status} ${response.statusText}`;
    throw new Error(String(message).slice(0, 300));
  }
  return data;
}

function fetchWithTimeout(url, init = {}, timeoutMs = 12000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function fetchProfile(platform, accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('Erişim jetonu boş.');

  if (platform === 'youtube') {
    const response = await fetchWithTimeout(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { authorization: `Bearer ${token}` } },
    );
    const data = await readJson(response);
    const channel = Array.isArray(data.items) ? data.items[0] : null;
    if (!channel) {
      throw new Error('Bu jetonun bağlı olduğu bir YouTube kanalı bulunamadı.');
    }
    return {
      externalId: String(channel.id || ''),
      name: String(channel.snippet?.title || 'YouTube kanalı'),
      handle: channel.snippet?.customUrl ? String(channel.snippet.customUrl) : null,
      avatar: channel.snippet?.thumbnails?.default?.url
        ? String(channel.snippet.thumbnails.default.url)
        : null,
      meta: {
        subscribers: channel.statistics?.subscriberCount ?? null,
        views: channel.statistics?.viewCount ?? null,
        videos: channel.statistics?.videoCount ?? null,
        hiddenSubscribers: channel.statistics?.hiddenSubscriberCount ? 1 : null,
        statsUpdatedAt: Date.now(),
      },
    };
  }

  if (platform === 'instagram') {
    const url = new URL('https://graph.instagram.com/me');
    url.searchParams.set('fields', 'id,username,account_type,profile_picture_url');
    url.searchParams.set('access_token', token);
    const data = await readJson(await fetchWithTimeout(url));
    if (!data.id) throw new Error('Instagram bu jeton için hesap bilgisi döndürmedi.');
    return {
      externalId: String(data.id),
      name: String(data.username || 'Instagram hesabı'),
      handle: data.username ? `@${data.username}` : null,
      avatar: data.profile_picture_url ? String(data.profile_picture_url) : null,
      meta: { accountType: data.account_type ?? null },
    };
  }

  const data = await readJson(
    await fetchWithTimeout(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,username,avatar_url',
      { headers: { authorization: `Bearer ${token}` } },
    ),
  );
  const user = data.data?.user;
  if (!user || !user.open_id) throw new Error('TikTok bu jeton için profil döndürmedi.');
  return {
    externalId: String(user.open_id),
    name: String(user.display_name || user.username || 'TikTok hesabı'),
    handle: user.username ? `@${user.username}` : null,
    avatar: user.avatar_url ? String(user.avatar_url) : null,
    meta: {},
  };
}

async function refreshToken(platform, refreshTokenValue, accessTokenValue) {
  const refresh = String(refreshTokenValue || '').trim();
  const access = String(accessTokenValue || '').trim();

  if (platform === 'instagram') {
    const token = refresh || access;
    if (!token) throw new Error('Instagram için yenilenecek jeton yok.');
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', token);
    const data = await readJson(await fetchWithTimeout(url));
    if (!data.access_token) throw new Error('Instagram yeni jeton döndürmedi.');
    return {
      accessToken: String(data.access_token),
      refreshToken: refresh || null,
      expiresAt: Number(data.expires_in) ? Date.now() + Number(data.expires_in) * 1000 : null,
    };
  }

  if (platform === 'youtube') {
    const clientId = process.env.EZWIN_YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.EZWIN_YOUTUBE_CLIENT_SECRET;
    if (!refresh) throw new Error('Bu bağlantıda yenileme jetonu yok.');
    if (!clientId || !clientSecret) {
      throw new Error(
        'YouTube yenilemesi için EZWIN_YOUTUBE_CLIENT_ID ve EZWIN_YOUTUBE_CLIENT_SECRET ortam değişkenleri gerekli.',
      );
    }
    const data = await readJson(
      await fetchWithTimeout('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refresh,
          grant_type: 'refresh_token',
        }).toString(),
      }),
    );
    if (!data.access_token) throw new Error('Google yeni erişim jetonu döndürmedi.');
    return {
      accessToken: String(data.access_token),
      refreshToken: refresh,
      expiresAt: Number(data.expires_in) ? Date.now() + Number(data.expires_in) * 1000 : null,
    };
  }

  const clientKey = process.env.EZWIN_TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.EZWIN_TIKTOK_CLIENT_SECRET;
  if (!refresh) throw new Error('Bu bağlantıda yenileme jetonu yok.');
  if (!clientKey || !clientSecret) {
    throw new Error(
      'TikTok yenilemesi için EZWIN_TIKTOK_CLIENT_KEY ve EZWIN_TIKTOK_CLIENT_SECRET ortam değişkenleri gerekli.',
    );
  }
  const data = await readJson(
    await fetchWithTimeout('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refresh,
      }).toString(),
    }),
  );
  if (!data.access_token) throw new Error('TikTok yeni erişim jetonu döndürmedi.');
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : refresh,
    expiresAt: Number(data.expires_in) ? Date.now() + Number(data.expires_in) * 1000 : null,
  };
}

module.exports = { PLATFORMS, PLATFORM_LIST, platformOf, fetchProfile, refreshToken };

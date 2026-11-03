# EzWin Sites

EzWin şirketlerinin web siteleri. Her site kendi klasöründe; yayın ayarları (`wasmer.toml`, `app.yaml`) ve statik dosyalar (`public/`) birlikte durur.

## Bu klasördeki siteler

| Site | Klasör | Wasmer uygulaması | Canlı adres | Durum |
| --- | --- | --- | --- | --- |
| EzCraft | `ezcraft/` | `ezwinstudio/ezcraft` | https://ezcraft.wasmer.app | Yapım aşamasında |
| EzWinMusic | `ezwinmusic/` | `ezwinstudio/ezwinmusic` | https://ezwinmusic.wasmer.app | Yapım aşamasında |
| CATA Store | `catastore/` | `ezwinstudio/cata-store` | https://cata-store.wasmer.app | Yayında |

EzCraft ve EzWinMusic yalnızca doğrulanmış bilgileri yayınlar; sunucu adresi, çalışma veya iletişim kanalı henüz yayınlanmadığı için sayfalarda "Yakında" olarak işaretlenmiştir.

CATA Store'da siparişler Discord üzerinden yürür; sitede ödeme alınmaz. Paket tutarları liste fiyatıdır; güncel fiyat ve stok Discord'da doğrulanır. Teslimat Roblox grup ödemesiyle yapılır.

### Şirket siteleri (2026-11-01)

Yedi marka, ayrı statik site ve ayrı Wasmer uygulaması olarak yayında. Üretim kaynağı `companies/build.mjs`; her site kendi `public/` klasörü, yerel fontları ve resmi logosuyla bağımsız çalışır.

| Site | Klasör | Wasmer uygulaması | Canlı adres |
| --- | --- | --- | --- |
| EZWIN Corporation | `companies/corporation/` | `ezwinstudio/ezwin-corporation` | https://ezwin-corporation.wasmer.app |
| EzWin FiveM | `companies/fivem/` | `ezwinstudio/ezwin-fivem` | https://ezwin-fivem.wasmer.app |
| EzWin Hesap Hizmetleri | `companies/hesap/` | `ezwinstudio/ezwin-hesap` | https://ezwin-hesap.wasmer.app |
| EzWin Site Sys | `companies/site-sys/` | `ezwinstudio/ezwin-site-sys` | https://ezwin-site-sys.wasmer.app |
| EzWin Template | `companies/template/` | `ezwinstudio/ezwin-template` | https://ezwin-template.wasmer.app |
| EzWin Uncopylocked | `companies/uncopylocked/` | `ezwinstudio/ezwin-uncopylocked` | https://ezwin-uncopylocked.wasmer.app |
| EzWinCheat | `companies/cheat/` | `ezwinstudio/ezwin-cheat` | https://ezwin-cheat.wasmer.app |

Siteleri yeniden üretmek için:

```sh
cd sites/companies
node build.mjs
```

Tek bir siteyi yayınlamak için:

```sh
cd sites/companies/fivem
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-fivem --dir . --publish-package
```

## Güncelleme ve yayınlama

Dosyayı düzenledikten sonra ilgili klasörde:

```sh
cd sites/ezcraft
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezcraft --dir . --publish-package
```

```sh
cd sites/ezwinmusic
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwinmusic --dir . --publish-package
```

```sh
cd sites/catastore
wasmer deploy --non-interactive --owner ezwinstudio --app-name cata-store --dir . --publish-package
```

Yayın sonrası canlı adresi doğrula:

```sh
curl -I https://ezcraft.wasmer.app
curl -I https://ezwinmusic.wasmer.app
curl -I https://cata-store.wasmer.app
```

## Panele bağlı diğer siteler

| Site | Canlı adres | Kaynak |
| --- | --- | --- |
| EzWin Development | https://ezwindevelopment.wasmer.app | Bu klasörde değil |
| EzWin Portfolyo | https://ezwin-portfolyo.wasmer.app | `C:\Users\yekta\Desktop\EzWinPortFolyo` |
| AniMax | https://animax.wasmer.app | `C:\Users\yekta\Desktop\EzAnime` |
| EnterScans | https://enterscans.wasmer.app | `C:\Users\yekta\Documents\Qoder\2026-10-30\a5e410a7\enterscans` |
| EzWinStudio | https://ezwinstudio.github.io/EzWinStudio/ | GitHub Pages |
| Şimşek Diecast | https://simsekdiecast.wasmer.app | `ezwinstudio/project3sd` (özel alan adı) |

## Notlar

- Bu klasördeki siteler statiktir; harici font, CDN veya çalışma zamanı bağımlılığı yoktur.
- CATA Store fontları (`Anybody`, `Archivo`) `public/fonts` altında yerel tutulur; lisanslar aynı klasördedir ve site yasal sayfasından bağlanır.
- Logolar `public/logo.png` ve `public/favicon.png` olarak yerel tutulur. CATA Store ayrıca 1200×630 `public/og.png` sosyal kartını kullanır; kaynak sayfası `catastore/og-source.html`, yayınlanan klasörün dışındadır.
- Yeni bir site eklerken aynı yapıyı kullan: `public/index.html`, `public/styles.css`, `wasmer.toml`, `app.yaml`.

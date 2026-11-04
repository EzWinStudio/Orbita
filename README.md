# Orbita

Orbita, şirketlerini tek ekrandan yöneten yerel öncelikli komuta merkezidir. Web uygulaması, Windows tepsi uygulaması, telefon PWA kurulumu ve isteğe bağlı şifreli cihaz eşitlemesi aynı kaynak kodunu kullanır.

Bu depo, Orbita ekosistemindeki her şeyi tek yerden indirmek için hazırlandı.

## Hızlı indirme

| Ne | Bağlantı |
| --- | --- |
| Tüm kaynak (ZIP) | [ezwin-hub-app/main.zip](https://github.com/EzWinStudio/ezwin-hub-app/archive/refs/heads/main.zip) |
| Windows kurulum paketi | [Sürümler / Releases](https://github.com/EzWinStudio/ezwin-hub-app/releases/latest) |
| Canlı web uygulaması | [orbita.wasmer.app](https://orbita.wasmer.app) |
| Windows kurulum sayfası | [orbita.wasmer.app/indir](https://orbita.wasmer.app/indir/) |

Kurulum paketi `Orbita-Setup-2.2.0.exe` adıyla sürüm sayfasına yüklenir. Premium kurulum sayfası [orbita.wasmer.app/indir](https://orbita.wasmer.app/indir/) üzerinden doğrudan indirilebilir. Uygulama `%LOCALAPPDATA%\Programs\Orbita` klasörüne kurulur; mevcut EZWIN HUB verileri, yedekler ve bot sırları korunur. İlk açılışta mevcut WebView2 oturumu ve şirket verileri yeni Electron profiline otomatik taşınır.

Kanıtlanmış eski adres [ezwin-hub.wasmer.app](https://ezwin-hub.wasmer.app) de aynı Orbita sürümünü sunar.

## Tüm repoları tek komutla indir

PowerShell açıp bu depoyu indirdikten sonra:

```powershell
.\download-all.ps1
```

Betik; uygulamayı, Orbita web sitesini, Şimşek Diecast'i, tüm şirket sitelerini ve portfolyo kaynaklarını `EZWIN-REPOS` klasörüne ZIP olarak indirip açar; ardından Windows kurulum paketini indirir ve SHA-256 ile doğrular.

## Neler var?

| Klasör | İçerik |
| --- | --- |
| `src/` | React/TypeScript arayüzü, 10 dil, kimlik doğrulama, çeviri, servis izleme |
| `src/web/` | Tarayıcı veri katmanı, giriş kapısı, tepsi köprüsü, şifreli eşitleme |
| `electron/` | Güncel Electron masaüstü kabuğu, tepsi ve arka plan ajanı |
| `installer/` | NSIS kurulum tanımı ve veri göçü adımları |
| `tray/` | Eski C# / WebView2 sürümü (2.1.1, arşiv) |
| `sites/` | Orbita web yayını ve tüm şirket siteleri (statik HTML/CSS/JS) |
| `sync-service/` | İsteğe bağlı şifreli eşitleme servisi (Qoder Edge Function) |
| `scripts/` | Derleme, ikon ve i18n doğrulama betikleri |
| `public/` | Marka ikonları, şirket logoları, yerel seed verisi |


Masaüstü ürünü **Electron 45 tabanlı Windows uygulamasıdır** (sürüm 2.2.0). Gömülü Chromium ile gelir; harici WebView2 çalışma zamanı gerekmez. Tepside çalışır, kapatınca küçülür, site ve bot sağlığını arka planda izler, günlük yedek alır ve GitHub Releases üzerinden otomatik güncellenir. C# + WebView2 kaynakları `tray/` altında arşiv olarak korunur.

## Siteler

| Site | Canlı adres |
| --- | --- |
| Orbita web | [orbita.wasmer.app](https://orbita.wasmer.app) |
| Orbita web (eski adres) | [ezwin-hub.wasmer.app](https://ezwin-hub.wasmer.app) |
| Şimşek Diecast | [simsekdiecast.wasmer.app](https://simsekdiecast.wasmer.app) |
| CATA Store | [cata-store.wasmer.app](https://cata-store.wasmer.app) |
| EzCraft | [ezcraft.wasmer.app](https://ezcraft.wasmer.app) |
| EzWinMusic | [ezwinmusic.wasmer.app](https://ezwinmusic.wasmer.app) |
| EZWIN Corporation | [ezwin-corporation.wasmer.app](https://ezwin-corporation.wasmer.app) |
| EzWin FiveM | [ezwin-fivem.wasmer.app](https://ezwin-fivem.wasmer.app) |
| EzWin Hesap Hizmetleri | [ezwin-hesap.wasmer.app](https://ezwin-hesap.wasmer.app) |
| EzWin Site Sys | [ezwin-site-sys.wasmer.app](https://ezwin-site-sys.wasmer.app) |
| EzWin Template | [ezwin-template.wasmer.app](https://ezwin-template.wasmer.app) |
| EzWin Uncopylocked | [ezwin-uncopylocked.wasmer.app](https://ezwin-uncopylocked.wasmer.app) |
| EzWinCheat | [ezwin-cheat.wasmer.app](https://ezwin-cheat.wasmer.app) |
| EzWin Portfolyo | [ezwin-portfolyo.wasmer.app](https://ezwin-portfolyo.wasmer.app) |
| EzWinStudio | [ezwinstudio.github.io/EzWinStudio](https://ezwinstudio.github.io/EzWinStudio/) |
| AniMax | [animax.wasmer.app](https://animax.wasmer.app) |
| EnterScans | [enterscans.wasmer.app](https://enterscans.wasmer.app) |

AniMax ve EnterScans kaynakları bu deponun dışındaki çalışma alanlarında tutuluyor; canlı adresleri yukarıdadır.

## Web uygulamasını derleme

Gereksinim: Node.js 20+.

```sh
npm install
npm run build:web
```

Çıktı `web-dist/` klasörüne yazılır. Yerel önizleme:

```sh
npm run preview:web
```

## Telefon, PWA ve cihaz eşitleme

Web uygulaması telefonda tarayıcıdan açılır. Android/Chrome ve iPhone/Safari menüsündeki **Ana ekrana ekle** ile PWA olarak kurulur; uygulama tam ekran açılır ve çevrimdışı kabuk önbelleği kullanır.

Ayarlar > **Cihaz eşitleme** bölümünden bir eşitleme kodu oluşturulur. Veriler AES-GCM ile şifrelenir; sunucu yalnızca şifreli paketi saklar. Aynı kod web, masaüstü ve telefonda girilerek ortak veriler kullanılır. Bot tokenları, şifreler ve cihaza özel görünüm ayarları eşitlenmez. Kod kaybolursa şifreli verilere erişilemez.

`sync-service/` bu isteğe bağlı eşitleme servisinin kaynağıdır (Qoder Edge Function ve `sync_blobs` tablosu).

## Masaüstü uygulamasını derleme

Gereksinim: Windows ve Node.js 20+.

```sh
npm install
npm run build:electron
```

Çıktı `release-artifacts-electron/Orbita-Setup-2.2.0.exe` olarak oluşur. Taşınabilir paket için:

```sh
npx electron-builder --win portable
```

## Güvenlik ve veri

- Hesaplar ve şirket verileri yalnızca bu cihazda tutulur; eşitleme açıksa yalnızca AES-GCM ile şifrelenmiş kopya gönderilir.
- Bot tokenları Windows DPAPI ile şifrelenir; depoda veya sunucuda token yoktur.
- Discord bot kontrolleri yalnızca bot API'sine yapılır; kullanıcı hesabına erişilmez.
- Web sitesi yalnızca envanter ve canlı olmayan bağlantı bilgilerini gösterir; sahte durum üretmez.
- Çeviri metni MyMemory servisine gönderilir; Orbita sunucusunda saklanmaz.

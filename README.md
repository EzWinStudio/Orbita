# EZWIN HUB

EZWIN HUB'ın tam kaynak kodu: tarayıcı uygulaması, yerel Windows tepsi uygulaması, kurulum paketi ve şirket siteleri.

Bu depo, EZWIN HUB ekosistemindeki her şeyi tek yerden indirmek için hazırlandı.

## Hızlı indirme

| Ne | Bağlantı |
| --- | --- |
| Tüm kaynak (ZIP) | [ezwin-hub-app/main.zip](https://github.com/EzWinStudio/ezwin-hub-app/archive/refs/heads/main.zip) |
| Windows kurulum paketi | [Sürümler / Releases](https://github.com/EzWinStudio/ezwin-hub-app/releases/latest) |
| Canlı web uygulaması | [ezwin-hub.wasmer.app](https://ezwin-hub.wasmer.app) |

Kurulum paketi `EZWIN-HUB-Tray-Setup-1.0.9.exe` adıyla sürüm sayfasına yüklenir. Uygulama `%LOCALAPPDATA%\Programs\EZWIN HUB Tray` klasörüne kurulur ve veriler kullanıcı profilinde kalır.

## Tüm repoları tek komutla indir

PowerShell açıp bu depoyu indirdikten sonra:

```powershell
.\download-all.ps1
```

Betik; uygulamayı, EZWIN HUB web sitesini, Şimşek Diecast'i, tüm şirket sitelerini ve portfolyo kaynaklarını `EZWIN-REPOS` klasörüne ZIP olarak indirip açar; ardından Windows kurulum paketini indirir ve SHA-256 ile doğrular.

## Neler var?

| Klasör | İçerik |
| --- | --- |
| `src/` | React/TypeScript arayüzü, 10 dil, kimlik doğrulama, çeviri, servis izleme |
| `src/web/` | Tarayıcı veri katmanı, giriş kapısı, tepsi köprüsü |
| `tray/` | C# / .NET Framework 4.8 + WebView2 yerel Windows uygulaması |
| `installer/` | NSIS kurulum tanımı |
| `sites/` | Tüm şirket siteleri (statik HTML/CSS/JS) |
| `sync-service/` | İsteğe bağlı şifreli eşitleme servisi (Qoder Edge Function) |
| `scripts/` | Derleme, ikon ve i18n doğrulama betikleri |
| `public/` | Marka ikonları, şirket logoları, yerel seed verisi |
| `electron/` | Eski Electron sürümü; mevcut masaüstü ürününde kullanılmıyor |

Masaüstü ürünü **C# + WebView2 tepsi uygulamasıdır**. Electron klasörü yalnızca eski kaynakların kaybolmaması için burada durur; güncel kurulum Electron kullanmaz.

## Siteler

| Site | Canlı adres | Ayrı GitHub deposu |
| --- | --- | --- |
| EZWIN HUB web | [ezwin-hub.wasmer.app](https://ezwin-hub.wasmer.app) | [ezwin-hub-website](https://github.com/EzWinStudio/ezwin-hub-website) |
| Şimşek Diecast | [simsekdiecast.wasmer.app](https://simsekdiecast.wasmer.app) | [simsek-diecast-website](https://github.com/EzWinStudio/simsek-diecast-website) |
| CATA Store | [cata-store.wasmer.app](https://cata-store.wasmer.app) | [cata-store-website](https://github.com/EzWinStudio/cata-store-website) |
| EzCraft | [ezcraft.wasmer.app](https://ezcraft.wasmer.app) | [ezcraft-website](https://github.com/EzWinStudio/ezcraft-website) |
| EzWinMusic | [ezwinmusic.wasmer.app](https://ezwinmusic.wasmer.app) | [ezwinmusic-website](https://github.com/EzWinStudio/ezwinmusic-website) |
| EZWIN Corporation | [ezwin-corporation.wasmer.app](https://ezwin-corporation.wasmer.app) | [ezwin-corporation-website](https://github.com/EzWinStudio/ezwin-corporation-website) |
| EzWin FiveM | [ezwin-fivem.wasmer.app](https://ezwin-fivem.wasmer.app) | [ezwin-fivem-website](https://github.com/EzWinStudio/ezwin-fivem-website) |
| EzWin Hesap Hizmetleri | [ezwin-hesap.wasmer.app](https://ezwin-hesap.wasmer.app) | [ezwin-hesap-website](https://github.com/EzWinStudio/ezwin-hesap-website) |
| EzWin Site Sys | [ezwin-site-sys.wasmer.app](https://ezwin-site-sys.wasmer.app) | [ezwin-site-sys-website](https://github.com/EzWinStudio/ezwin-site-sys-website) |
| EzWin Template | [ezwin-template.wasmer.app](https://ezwin-template.wasmer.app) | [ezwin-template-website](https://github.com/EzWinStudio/ezwin-template-website) |
| EzWin Uncopylocked | [ezwin-uncopylocked.wasmer.app](https://ezwin-uncopylocked.wasmer.app) | [ezwin-uncopylocked-website](https://github.com/EzWinStudio/ezwin-uncopylocked-website) |
| EzWinCheat | [ezwin-cheat.wasmer.app](https://ezwin-cheat.wasmer.app) | [ezwin-cheat-website](https://github.com/EzWinStudio/ezwin-cheat-website) |
| EzWin Portfolyo | [ezwin-portfolyo.wasmer.app](https://ezwin-portfolyo.wasmer.app) | [Project2](https://github.com/EzWinStudio/Project2) |
| EzWinStudio | [ezwinstudio.github.io/EzWinStudio](https://ezwinstudio.github.io/EzWinStudio/) | [EzWinStudio](https://github.com/EzWinStudio/EzWinStudio) |
| AniMax | [animax.wasmer.app](https://animax.wasmer.app) | — |
| EnterScans | [enterscans.wasmer.app](https://enterscans.wasmer.app) | — |

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

Gereksinim: Windows, .NET Framework 4.8 derleyicisi (`csc.exe`) ve NSIS.

```sh
npm run build:tray
```

Çıktılar `release-artifacts-tray/` altında oluşur:

- `EZWIN HUB Tray.exe`
- `EZWIN-HUB-Tray-Setup-1.0.9.exe`
- `EZWIN-HUB-Tray-1.0.9-portable.zip`

## Güvenlik ve veri

- Hesaplar ve şirket verileri yalnızca bu cihazda tutulur; eşitleme açıksa yalnızca AES-GCM ile şifrelenmiş kopya gönderilir.
- Bot tokenları Windows DPAPI ile şifrelenir; depoda veya sunucuda token yoktur.
- Discord bot kontrolleri yalnızca bot API'sine yapılır; kullanıcı hesabına erişilmez.
- Web sitesi yalnızca envanter ve canlı olmayan bağlantı bilgilerini gösterir; sahte durum üretmez.
- Çeviri metni MyMemory servisine gönderilir; EZWIN HUB sunucusunda saklanmaz.

# Orbita — Kurulum

Orbita; web, Windows masaüstü, Android ve telefon PWA olarak aynı veriyle çalışan yerel öncelikli komuta merkezidir.

## İndirme sayfası

Premium kurulum sayfası: [orbita.wasmer.app/indir](https://orbita.wasmer.app/indir/)

## Web ve telefon

1. [orbita.wasmer.app](https://orbita.wasmer.app) adresini aç.
2. Hesabını seç, giriş yap veya hesap oluşturmadan devam et. Aynı cihaza birden fazla hesap eklenebilir; başka bir cihazdaki hesap, Ayarlar > **Hesabı dışa aktar** ile taşınabilir.
3. Telefonda tarayıcı menüsünden **Ana ekrana ekle** seçeneğiyle PWA olarak kur. Android uygulamasını kurduysan PWA kurulumu gerekmez.

Web verileri tarayıcıda kalır. Cihazlar arasında ortak veri için Ayarlar > **Cihaz eşitleme** bölümünden eşitleme kodu oluştur ve aynı kodu diğer cihazlarda gir.

## Android

| | |
| --- | --- |
| Dosya | `Orbita-Android-2.6.4.apk` |
| İşletim sistemi | Android 7.0 ve üzeri |
| Paket | `com.ezwin.orbita` |
| Boyut | yaklaşık 5 MB |
| İmza | Orbita sürüm anahtarıyla imzalı APK |

APK'yı [GitHub Releases](https://github.com/EzWinStudio/Orbita/releases/tag/v2.6.4) sayfasından indir. Telefonda dosyayı aç; Android izin isterse tarayıcı veya dosya yöneticisi için **bilinmeyen uygulamaları yükle** seçeneğini aç ve kurulumu tamamla. Uygulama mağaza dışından, imzalı APK olarak dağıtılır.

Orbita hesabınla giriş yap. Hesap ve çalışma alanı cihazda tutulur; Android oturumu uygulamaya özel saklanır. Eşitleme açıksa şifreli paket sunucudan alınır ve şirketler, görevler, finans ve iletişim kayıtları telefon, web ve masaüstünde aynı kalır. Eşitleme kapalıysa telefon kendi yerel çalışma alanını kullanır.

Güncelleme için yeni APK'yı mevcut uygulamanın üzerine kur; aynı imza anahtarı kullanıldığı sürece veriler korunur. Sürüm anahtarı depoya eklenmez; yalnızca yayın derlemesinde kullanılır.

### Android geliştirme

Gereksinimler: Node.js 20+, JDK 21 ve Android SDK (platform 35/36, build-tools 35+). Android Studio şart değildir.

```bash
npm install
npm run android:debug   # web paketi + debug APK
npm run android:release # web paketi + imzalı release APK
```

`npm run cap:sync` web paketini Android'e kopyalar; `web-dist/download` klasörü APK'ya alınmaz. Release imzası için `android/keystore.properties` dosyası gerekir; bu dosya, keystore ve parolalar depoya eklenmez. Ayrıntılar `README.md` içindedir.

## Windows masaüstü

| | |
| --- | --- |
| Dosya | `Orbita-Setup-2.6.4.exe` |
| İşletim sistemi | Windows 10 / 11, 64 bit |
| Çalışma zamanı | Gömülü Chromium (Electron) — harici WebView2 gerekmez |
| Disk alanı | yaklaşık 360 MB |
| Yetki | Yönetici izni istemez (kullanıcı klasörüne kurulur) |
| Kurulum yeri | `%LOCALAPPDATA%\Programs\Orbita` |

Kurulumdan sonra Orbita tepside çalışır; masaüstü ve Başlat menüsü kısayolları oluşturulur. Eski EZWIN HUB Tray kurulumu varsa sessizce kaldırılır; veri klasörleri korunur.

Mevcut veriler şurada kalır:

```
%LOCALAPPDATA%\EZWIN HUB Tray
Documents\EZWIN HUB\Yedekler
```

Bu klasörler ürün adı değişse de silinmez; mevcut WebView2 profili ilk açılışta yeni Electron profiline otomatik taşınır. DPAPI ile şifrelenmiş bot sırları ve yedekler buradan okunur.

## Güncelleme

Yeni sürümler [GitHub Releases](https://github.com/EzWinStudio/Orbita/releases/latest) sayfasına yüklenir. Orbita altı saatte bir güncellemeyi kontrol eder; hazır olduğunda tepsi menüsünden tek tıkla kurabilirsin. Kurulum dosyasını indirip çalıştırmak da yeterlidir; veriler korunur. Android güncellemesi yeni APK'nın mevcut uygulamanın üzerine kurulmasıyla yapılır.

## Kaldırma

**Ayarlar → Uygulamalar → Orbita → Kaldır** ya da kurulum klasöründeki `Uninstall Orbita.exe`. Kaldırma veri klasörlerini silmez; tamamen temizlemek için yukarıdaki iki klasörü de sil.

## Dağıtım notu

Kurulum dosyası kod imzası sertifikası olmadan paketleniyor; SmartScreen uyarısı çıkarsa **Ek bilgi → Yine de çalıştır** kullanılabilir. Geniş kitleye dağıtımda imzalı sertifika önerilir.

# Orbita — Kurulum

Orbita; web, Windows masaüstü ve telefon PWA olarak aynı veriyle çalışan yerel öncelikli komuta merkezidir.

## İndirme sayfası

Premium kurulum sayfası: [orbita.wasmer.app/indir](https://orbita.wasmer.app/indir/)

## Web ve telefon

1. [orbita.wasmer.app](https://orbita.wasmer.app) adresini aç.
2. Hesabını seç, giriş yap veya hesap oluşturmadan devam et. Aynı cihaza birden fazla hesap eklenebilir; başka bir cihazdaki hesap, Ayarlar > **Hesabı dışa aktar** ile taşınabilir.
3. Telefonda tarayıcı menüsünden **Ana ekrana ekle** seçeneğiyle PWA olarak kur.

Web verileri tarayıcıda kalır. Cihazlar arasında ortak veri için Ayarlar > **Cihaz eşitleme** bölümünden eşitleme kodu oluştur ve aynı kodu diğer cihazlarda gir.

## Windows masaüstü

| | |
| --- | --- |
| Dosya | `Orbita-Setup-2.1.0.exe` |
| İşletim sistemi | Windows 10 / 11, 64 bit |
| Yetki | Yönetici izni istemez (kullanıcı klasörüne kurulur) |
| Kurulum yeri | `%LOCALAPPDATA%\Programs\Orbita` |

Kurulumdan sonra Orbita tepside çalışır; masaüstü ve Başlat menüsü kısayolları oluşturulur. Eski EZWIN HUB Tray kurulumu varsa sessizce kaldırılır; veri klasörleri korunur.

Mevcut veriler şurada kalır:

```
%LOCALAPPDATA%\EZWIN HUB Tray
Documents\EZWIN HUB\Yedekler
```

Bu klasörler ürün adı değişse de silinmez; WebView2 profili, DPAPI ile şifrelenmiş bot sırları ve yedekler buradan okunur.

## Güncelleme

Yeni sürümler [GitHub Releases](https://github.com/EzWinStudio/ezwin-hub-app/releases/latest) sayfasına yüklenir. Kurulum dosyasını indirip çalıştırmak yeterlidir; veriler korunur.

## Kaldırma

**Ayarlar → Uygulamalar → Orbita → Kaldır** ya da kurulum klasöründeki `Uninstall Orbita.exe`. Kaldırma veri klasörlerini silmez; tamamen temizlemek için yukarıdaki iki klasörü de sil.

## Dağıtım notu

Kurulum dosyası kod imzası sertifikası olmadan paketleniyor; SmartScreen uyarısı çıkarsa **Ek bilgi → Yine de çalıştır** kullanılabilir. Geniş kitleye dağıtımda imzalı sertifika önerilir.

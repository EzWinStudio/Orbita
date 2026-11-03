# EzWin Hesap Hizmetleri

Hesap kurulumu, erişim ayarları ve dijital teslim süreçleri; doğrulama odaklı akış.

EZWIN şirket siteleri serisinin bir parçası.

- **Canlı site:** https://ezwin-hesap.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwin-hesap`)
- **Portfolyo:** https://ezwin-portfolyo.wasmer.app

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-hesap --dir . --publish-package
```

## Notlar

- EZWIN şirket siteleri serisinin bir parçası.

# EzWin Site Sys

Tanıtım siteleri, panel arayüzleri ve ortak tasarım sistemleri üreten web stüdyosu.

EZWIN şirket siteleri serisinin bir parçası.

- **Canlı site:** https://ezwin-site-sys.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwin-site-sys`)
- **Portfolyo:** https://ezwin-portfolyo.wasmer.app

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-site-sys --dir . --publish-package
```

## Notlar

- EZWIN şirket siteleri serisinin bir parçası.

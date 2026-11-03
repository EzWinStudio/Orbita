# EzWinCheat

Kendi test ortamında Luau davranışını izleyen, ölçen ve raporlayan çalışma alanı.

EZWIN şirket siteleri serisinin bir parçası.

- **Canlı site:** https://ezwin-cheat.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwin-cheat`)
- **Portfolyo:** https://ezwin-portfolyo.wasmer.app

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-cheat --dir . --publish-package
```

## Notlar

- EZWIN şirket siteleri serisinin bir parçası.

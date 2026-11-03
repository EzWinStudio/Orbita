# EzWin FiveM

QBCore tabanlı FiveM kaynak paketleri; oxmysql, PolyZone, spawn seçici, txAdmin ve test sunucusu.

EZWIN şirket siteleri serisinin bir parçası.

- **Canlı site:** https://ezwin-fivem.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwin-fivem`)
- **Portfolyo:** https://ezwin-portfolyo.wasmer.app

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-fivem --dir . --publish-package
```

## Notlar

- EZWIN şirket siteleri serisinin bir parçası.

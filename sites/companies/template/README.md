# EzWin Template

Roblox Studio için menü, HUD ve oyun döngüsü şablonları.

EZWIN şirket siteleri serisinin bir parçası.

- **Canlı site:** https://ezwin-template.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwin-template`)
- **Portfolyo:** https://ezwin-portfolyo.wasmer.app

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-template --dir . --publish-package
```

## Notlar

- EZWIN şirket siteleri serisinin bir parçası.

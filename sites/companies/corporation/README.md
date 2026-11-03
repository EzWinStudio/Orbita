# EZWIN Corporation

EzWin markalarını tek çatı altında toplayan kurum. Stüdyo, ticaret ve topluluk hatları.

EZWIN şirket siteleri serisinin bir parçası.

- **Canlı site:** https://ezwin-corporation.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwin-corporation`)
- **Portfolyo:** https://ezwin-portfolyo.wasmer.app

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-corporation --dir . --publish-package
```

## Notlar

- EZWIN şirket siteleri serisinin bir parçası.

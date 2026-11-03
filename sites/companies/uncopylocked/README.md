# EzWin Uncopylocked

Roblox Studio için uncopylocked tabanlar, 3D prop setleri ve düzenlenebilir sahneler.

EZWIN şirket siteleri serisinin bir parçası.

- **Canlı site:** https://ezwin-uncopylocked.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwin-uncopylocked`)
- **Portfolyo:** https://ezwin-portfolyo.wasmer.app

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwin-uncopylocked --dir . --publish-package
```

## Notlar

- EZWIN şirket siteleri serisinin bir parçası.

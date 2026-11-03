# EzWinMusic

EzWinMusic web sitesi — müzik stüdyosu tanıtımı.

- **Canlı site:** https://ezwinmusic.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezwinmusic`)

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezwinmusic --dir . --publish-package
```

## Notlar

- Site yalnızca doğrulanmış bilgileri yayınlar; stüdyo ve iletişim bilgileri hazır olduğunda eklenecektir.

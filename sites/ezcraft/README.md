# EzCraft

EzCraft web sitesi — Minecraft sunucusu tanıtımı.

- **Canlı site:** https://ezcraft.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/ezcraft`)

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name ezcraft --dir . --publish-package
```

## Notlar

- Site yalnızca doğrulanmış bilgileri yayınlar; sunucu adresi ve iletişim kanalı henüz yayınlanmadığı için "Yakında" olarak işaretlenmiştir.

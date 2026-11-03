# CATA Store

CATA Store resmi web sitesi. Roblox R$ paketleri, grup ödemesiyle teslimat ve destek kanalları.

- **Canlı site:** https://cata-store.wasmer.app
- **Tür:** Statik site — HTML, CSS ve JavaScript; harici bağımlılık yok
- **Yayın:** Wasmer Edge (`ezwinstudio/cata-store`)

## Yapı

| Yol | Açıklama |
| --- | --- |
| `public/` | Yayınlanan statik dosyalar (HTML, CSS, JS, fontlar, görseller) |
| `app.yaml` | Wasmer uygulama tanımı |
| `wasmer.toml` | Wasmer paket tanımı |
| `og-source.html` | Sosyal kart kaynağı (yayınlanan klasörün dışında) |

## Yayınlama

```sh
wasmer deploy --non-interactive --owner ezwinstudio --app-name cata-store --dir . --publish-package
```

## Notlar

- Ödeme sitede alınmaz; siparişler Discord üzerinden yürür.
- Paket tutarları liste fiyatıdır; güncel fiyat ve stok Discord'da doğrulanır.
- Teslimat Roblox grup ödemesiyle yapılır.
